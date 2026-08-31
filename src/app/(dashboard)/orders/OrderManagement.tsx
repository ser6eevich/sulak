'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { 
  createOrderAction, 
  updateOrderAction,
  updateOrderStatusAction, 
  searchClientByPhoneAction,
  getOrderAuditLogsAction,
  deleteOrderAction,
  updateOrderFeedbackAction,
  updateOrderImageAction,
  findOrdersForBatchDeliveryAction,
  batchUpdateOrdersDeliveredAction
} from './actions'
import { normalizeAddress } from '@/utils/address'
import {
  extractBatchOrderNumbers,
  type BatchDeliveryOrderPreview,
} from '@/lib/orders/batch-delivery'
import { YandexDiskPickerModal } from '@/components/orders/YandexDiskPickerModal'
import { 
  Plus, 
  Search, 
  X, 
  ShoppingBag, 
  User, 
  MapPin, 
  Calendar, 
  CreditCard, 
  History,
  ShoppingCart,
  Trash2,
  Folder,
  ChevronRight,
  Eye,
  Paperclip,
  Clipboard,
  Pencil,
  Sparkles,
  CheckCircle2,
  Truck,
} from 'lucide-react'

// Интерфейсы типов из Prisma
interface Client {
  id: string
  fullName: string
  primaryPhone: string
  additionalPhone: string | null
  address: string | null
  city: string | null
}

interface ProductVariant {
  id: string
  sku: string
  size: string | null
  color: string | null
  material: string | null
  thickness: string | null
  purchasePrice: number
  salePrice: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  attributes: any
}

interface Product {
  id: string
  name: string
  categoryId: string
  folderId: string | null
  baseSku: string
  variants: ProductVariant[]
}

interface OrderItem {
  id: string
  variantId?: string
  quantity: number
  unitPrice: number
  subOrderIndex: number
  customTableSize: string | null
  customChairsCount: number | null
  variant: ProductVariant & {
    product: {
      name: string
    }
  }
}

interface Order {
  id: string
  number?: string | null
  status: string
  paymentStatus: string
  totalPrice: number
  discount: number
  deliveryPrice: number
  assemblyPrice: number
  prepayment: number
  deliveryAddress: string | null
  comment: string | null
  createdAt: Date | string
  deliveredAt?: Date | string | null
  client: Client
  creator: {
    fullName: string
  }
  sellerId?: string | null
  feedbackType?: string
  feedbackAuthor?: string | null
  feedbackUrl?: string | null
  driverId?: string | null
  driver?: {
    id: string
    fullName: string
  } | null
  imageUrl?: string | null
  plannedDeliveryDate?: string | Date | null
  seller?: {
    id: string
    fullName: string
  } | null
  items: OrderItem[]
}

interface OrderFormItem {
  productId: string
  variantId: string
  quantity: number
  unitPrice: number | string
  subOrderIndex: number
  customTableSize?: string
  customChairsCount?: number
}

interface AuditLogWithUser {
  id: string
  comment: string | null
  createdAt: Date | string
  user: {
    fullName: string
  } | null
}

interface ProductFolder {
  id: string
  categoryId: string
  parentId: string | null
  name: string
}

interface ProductCategory {
  id: string
  name: string
  slug: string
}

interface OrderManagementProps {
  initialOrders: Order[]
  products: Product[]
  folders: ProductFolder[]
  categories: ProductCategory[]
  userRole: string
  drivers: { id: string; fullName: string }[]
  sellers: { id: string; fullName: string }[]
  currentUserId: string
  initialQuery: string
  initialStatus: string
  page: number
  pageSize: number
  totalPages: number
  totalOrders: number
  summary: { active: number; delivered: number; revenue: number; statuses: Record<string, number> }
}

// Статусы выполнения заказа — цвета определяются через CSS-токены (.erp-badge[data-status])
const STATUSES: Record<string, { label: string }> = {
  pending: { label: 'Ожидает подтверждения' },
  confirmed: { label: 'Подтвержден' },
  production: { label: 'На производстве' },
  warehouse: { label: 'На складе' },
  awaiting_delivery: { label: 'Ожидает доставку' },
  delivery: { label: 'Доставляется' },
  delivered: { label: 'Доставлен' },
  cancelled: { label: 'Отменен' },
}

function toDateTimeLocalValue(value: Date | string) {
  const date = new Date(value)
  const localTime = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return localTime.toISOString().slice(0, 16)
}

const STAGE_LABELS: Record<string, string> = {
  pending: 'Новые',
  confirmed: 'Подтверждены',
  production: 'В производстве',
  warehouse: 'На складе',
  awaiting_delivery: 'Ждут доставку',
  delivery: 'В доставке',
  delivered: 'Доставлены',
  cancelled: 'Отменены',
}

export default function OrderManagement({ 
  initialOrders, 
  products,
  folders,
  categories,
  userRole,
  drivers,
  sellers,
  currentUserId,
  initialQuery,
  initialStatus,
  page: currentPage,
  pageSize: ordersPerPage,
  totalPages,
  totalOrders,
  summary,
}: OrderManagementProps) {
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>(initialOrders)
  const [search, setSearch] = useState(initialQuery)
  const [statusFilter, setStatusFilter] = useState(initialStatus)
  const [loading, setLoading] = useState<string | null>(null)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setOrders(initialOrders), 0)
    return () => window.clearTimeout(timeoutId)
  }, [initialOrders])

  function navigateList(next: { query?: string; status?: string; page?: number; pageSize?: number }) {
    const params = new URLSearchParams(window.location.search)
    const nextQuery = next.query ?? search
    const nextStatus = next.status ?? statusFilter
    const nextPage = next.page ?? currentPage
    const nextPageSize = next.pageSize ?? ordersPerPage

    if (nextQuery) params.set('q', nextQuery)
    else params.delete('q')
    if (nextStatus !== 'all') params.set('status', nextStatus)
    else params.delete('status')
    if (nextPage > 1) params.set('page', String(nextPage))
    else params.delete('page')
    if (nextPageSize !== 20) params.set('pageSize', String(nextPageSize))
    else params.delete('pageSize')
    router.push(`/orders${params.size ? `?${params.toString()}` : ''}`)
  }

  // Состояния для модалки деталей заказа
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [auditLogs, setAuditLogs] = useState<AuditLogWithUser[]>([])
  const [newStatus, setNewStatus] = useState('')
  const [statusComment, setStatusComment] = useState('')
  const [selectedDriverId, setSelectedDriverId] = useState('')
  const [customStatusDeliveredAt, setCustomStatusDeliveredAt] = useState('')

  // Состояния для отзывов
  const [feedbackType, setFeedbackType] = useState('none')
  const [feedbackAuthor, setFeedbackAuthor] = useState('')
  const [feedbackUrl, setFeedbackUrl] = useState('')
  const [feedbackLoading, setFeedbackLoading] = useState(false)

  // Состояния для модалки создания/редактирования заказа
  const [createModalOpen, setCreateModalOpen] = useState(false)
  // Целевой subOrderIndex для вставки фото из буфера (для paste-listener fallback)
  const [pasteTargetCreateSubIdx, setPasteTargetCreateSubIdx] = useState<number | null>(null)
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null)
  const [sellerId, setSellerId] = useState(currentUserId)
  const [clientPhone, setClientPhone] = useState('')
  const [clientAdditionalPhone, setClientAdditionalPhone] = useState('')
  const [clientName, setClientName] = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [discount, setDiscount] = useState('0')
  const [deliveryPrice, setDeliveryPrice] = useState('0')
  const [assemblyPrice, setAssemblyPrice] = useState('0')
  const [comment, setComment] = useState('')
  const [plannedDeliveryDate, setPlannedDeliveryDate] = useState('')
  
  // Ретроспективный ввод прошедших заказов
  const [isRetroactive, setIsRetroactive] = useState(false)
  const [customCreatedAt, setCustomCreatedAt] = useState('')
  const [customDeliveredAt, setCustomDeliveredAt] = useState('')
  const [customStatus, setCustomStatus] = useState('pending')
  const [customPaymentStatus, setCustomPaymentStatus] = useState('unpaid')
  
  // Выбранные клиенты при автопоиске
  const [foundClients, setFoundClients] = useState<Client[]>([])
  const [searchClientLoading, setSearchClientLoading] = useState(false)

  // Состояния для модалки каталога при выборе позиций
  const [selectingItemIndex, setSelectingItemIndex] = useState<number | null>(null)
  const [catalogModalCategory, setCatalogModalCategory] = useState<string | null>(null)
  const [catalogModalFolder, setCatalogModalFolder] = useState<string | null>(null)
  const [catalogModalSearch, setCatalogModalSearch] = useState('')

  // Выбранные позиции заказа: [{ productId, variantId, quantity, unitPrice, subOrderIndex }]
  const [orderItemsList, setOrderItemsList] = useState<OrderFormItem[]>([
    { productId: '', variantId: '', quantity: 1, unitPrice: 0, subOrderIndex: 0 }
  ])

  // Быстрая смена статуса из таблицы
  const [quickStatusTarget, setQuickStatusTarget] = useState<{ order: Order; targetStatus: string } | null>(null)
  const [quickStatusModalOpen, setQuickStatusModalOpen] = useState(false)
  const [quickStatusComment, setQuickStatusComment] = useState('')
  const [quickStatusDriverId, setQuickStatusDriverId] = useState('')
  const [quickStatusDeliveredAt, setQuickStatusDeliveredAt] = useState('')

  // Пакетная отметка доставленных заказов списком из текста
  const [batchModalOpen, setBatchModalOpen] = useState(false)
  const [batchInputText, setBatchInputText] = useState('')
  const [batchDeliveredAt, setBatchDeliveredAt] = useState('')
  const [batchLoading, setBatchLoading] = useState(false)
  const [batchErrorMsg, setBatchErrorMsg] = useState('')
  const [batchSuccessMsg, setBatchSuccessMsg] = useState('')
  const [batchUncheckedIds, setBatchUncheckedIds] = useState<Set<string>>(new Set())
  const [batchMatchedOrders, setBatchMatchedOrders] = useState<BatchDeliveryOrderPreview[]>([])
  const [batchNotFoundNumbers, setBatchNotFoundNumbers] = useState<string[]>([])
  const [batchLookupLoading, setBatchLookupLoading] = useState(false)
  const [batchLookupError, setBatchLookupError] = useState('')

  useEffect(() => {
    if (!batchModalOpen) return

    const orderNumbers = extractBatchOrderNumbers(batchInputText)
    let ignoreResult = false
    const timeoutId = window.setTimeout(async () => {
      if (orderNumbers.length === 0) {
        setBatchMatchedOrders([])
        setBatchNotFoundNumbers([])
        setBatchLookupError('')
        setBatchLookupLoading(false)
        return
      }

      setBatchLookupLoading(true)
      setBatchLookupError('')
      const result = await findOrdersForBatchDeliveryAction(orderNumbers)
      if (ignoreResult) return

      setBatchMatchedOrders(result.orders)
      setBatchNotFoundNumbers(result.notFoundNumbers)
      setBatchLookupError(result.error || '')
      setBatchUncheckedIds(new Set())
      setBatchLookupLoading(false)
    }, 250)

    return () => {
      ignoreResult = true
      window.clearTimeout(timeoutId)
    }
  }, [batchInputText, batchModalOpen])

  const handleBatchSubmit = async () => {
    const targetOrders = batchMatchedOrders.filter(o => !batchUncheckedIds.has(o.id))

    if (targetOrders.length === 0) {
      setBatchErrorMsg('Нет выбранных заказов для обновления')
      return
    }

    setBatchLoading(true)
    setBatchErrorMsg('')
    setBatchSuccessMsg('')

    const idsToUpdate = targetOrders.map(o => o.id)
    const deliveredAtIso = batchDeliveredAt
      ? new Date(batchDeliveredAt).toISOString()
      : null
    const res = await batchUpdateOrdersDeliveredAction(idsToUpdate, deliveredAtIso)
    setBatchLoading(false)

    if (res.error) {
      setBatchErrorMsg(res.error)
    } else {
      setBatchSuccessMsg(`Успешно отмечено ${res.updatedCount} заказов как «Доставлен»!`)
      setTimeout(() => {
        setBatchModalOpen(false)
        setBatchInputText('')
        setBatchDeliveredAt('')
        setBatchSuccessMsg('')
        router.refresh()
      }, 1500)
    }
  }

  // Запрос на подтверждение закрытия модалки создания/редактирования заказа
  const handleRequestCloseOrderModal = () => {
    const isFormDirty =
      clientName.trim() !== '' ||
      clientPhone.trim() !== '' ||
      deliveryAddress.trim() !== '' ||
      comment.trim() !== '' ||
      editingOrderId !== null ||
      orderItemsList.some(item => (item.variantId && item.variantId !== '') || (item.productId && item.productId !== ''))

    if (isFormDirty) {
      const confirmClose = window.confirm('Вы уверены, что хотите закрыть окно оформления заказа? Введённые данные не сохранятся.')
      if (!confirmClose) return
    }
    setCreateModalOpen(false)
    resetOrderForm()
  }

  // Глобальное закрытие модальных окон по клавише Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (quickStatusModalOpen) {
          setQuickStatusModalOpen(false)
          setQuickStatusTarget(null)
        } else if (selectingItemIndex !== null) {
          setSelectingItemIndex(null)
        } else if (createModalOpen) {
          handleRequestCloseOrderModal()
        } else if (selectedOrder) {
          closeOrderDetails()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    // Dirty-form dependencies below deliberately mirror handleRequestCloseOrderModal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickStatusModalOpen, selectingItemIndex, createModalOpen, selectedOrder, clientName, clientPhone, deliveryAddress, comment, editingOrderId, orderItemsList])
  const [errorMsg, setErrorMsg] = useState('')

  const [subOrderImages, setSubOrderImages] = useState<Record<number, string[]>>({})
  const [imageUploading, setImageUploading] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  // Яндекс.Диск модальное окно выбора фото
  const [yandexPickerOpen, setYandexPickerOpen] = useState(false)
  const [yandexPickerSubOrderIdx, setYandexPickerSubOrderIdx] = useState<number | null>(null)

  const handleSelectYandexDiskImage = async (imageUrl: string, subIdx: number | null) => {
    if (selectedOrder) {
      setLoading('image')
      const updateRes = await updateOrderImageAction(selectedOrder.id, imageUrl, subIdx)
      setLoading(null)
      if (updateRes.error) {
        alert(updateRes.error)
      } else if (updateRes.imageUrl !== undefined) {
        setSelectedOrder(prev => prev ? { ...prev, imageUrl: updateRes.imageUrl } : null)
        setOrders(prev => prev.map(o => o.id === selectedOrder.id ? { ...o, imageUrl: updateRes.imageUrl } : o))
      }
    } else {
      const targetSubIdx = subIdx ?? 0
      setSubOrderImages(prev => ({
        ...prev,
        [targetSubIdx]: [...(prev[targetSubIdx] || []), imageUrl]
      }))
    }
  }

  // Глобальный paste-listener: fallback для clipboard.read() на macOS/Yandex Browser
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      // Создание заказа
      if (createModalOpen && pasteTargetCreateSubIdx !== null) {
        const items = Array.from(e.clipboardData?.items || [])
        const imageItem = items.find(i => i.type.startsWith('image/'))
        if (imageItem) {
          e.preventDefault()
          const blob = imageItem.getAsFile()
          if (blob) {
            const ext = imageItem.type.split('/')[1] || 'png'
            handleCreateImageUpload(blob, `clipboard-paste.${ext}`, pasteTargetCreateSubIdx)
            setPasteTargetCreateSubIdx(null)
          }
        }
      }
    }

    window.addEventListener('paste', handleGlobalPaste)
    return () => window.removeEventListener('paste', handleGlobalPaste)
  }, [createModalOpen, pasteTargetCreateSubIdx])

  // Живой поиск клиентов по телефону в форме заказа
  useEffect(() => {
    const searchClient = async () => {
      if (clientPhone.length < 3) {
        setFoundClients([])
        return
      }
      setSearchClientLoading(true)
      const res = await searchClientByPhoneAction(clientPhone)
      setFoundClients(res as Client[])
      setSearchClientLoading(false)
    }

    const timer = setTimeout(searchClient, 300)
    return () => clearTimeout(timer)
  }, [clientPhone])

  // Открытие деталей заказа с обновлением URL для возможности прямого перехода по ссылке
  async function openOrderDetails(order: Order) {
    setSelectedOrder(order)
    setNewStatus(order.status)
    setStatusComment('')
    setSelectedDriverId('')
    setFeedbackType(order.feedbackType || 'none')
    setFeedbackAuthor(order.feedbackAuthor || '')
    setFeedbackUrl(order.feedbackUrl || '')
    setAuditLogs([])

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.set('id', order.number || order.id)
      window.history.pushState(null, '', url.toString())
    }
    
    // Асинхронная подгрузка истории аудита
    const logs = await getOrderAuditLogsAction(order.id)
    setAuditLogs(logs)
  }

  // Закрытие деталей заказа со сбросом URL параметра
  function closeOrderDetails() {
    setSelectedOrder(null)
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.delete('id')
      url.searchParams.delete('number')
      url.searchParams.delete('orderId')
      window.history.pushState(null, '', url.toString())
    }
  }

  // Автоматическое открытие модалки заказа при переходе по ссылке (?id=... или ?number=...)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const rawVal = params.get('id') || params.get('number') || params.get('orderId')
    if (!rawVal) return

    const cleanVal = rawVal.trim()
    const match = orders.find(o => 
      o.number === cleanVal || 
      o.number === `#${cleanVal}` || 
      o.id === cleanVal
    )
    if (match) {
      const timeoutId = window.setTimeout(() => void openOrderDetails(match), 0)
      return () => window.clearTimeout(timeoutId)
    }
  }, [orders])

  // Расчет сумм по форме
  const itemsTotal = orderItemsList.reduce((sum, item) => {
    const price = parseFloat(String(item.unitPrice)) || 0
    return sum + (item.quantity * price)
  }, 0)

  const disc = parseFloat(discount) || 0
  const deliv = parseFloat(deliveryPrice) || 0
  const assemb = parseFloat(assemblyPrice) || 0

  const grandTotal = Math.max(0, itemsTotal + deliv + assemb - disc)

  // Обработчики позиций заказа
  const handleItemFieldChange = (index: number, field: string, value: string | number) => {
    setOrderItemsList(prev => 
      prev.map((item, idx) => {
        if (idx !== index) return item
        const updated = { ...item, [field]: value }

        if (field === 'productId') {
          // При выборе модели сбрасываем вариант и ставим первый доступный
          const prod = products.find(p => p.id === value)
          const firstVariant = prod?.variants[0]
          updated.variantId = firstVariant?.id || ''
          updated.unitPrice = firstVariant ? firstVariant.salePrice / 100 : 0
        } else if (field === 'variantId') {
          // При выборе варианта подтягиваем его цену продажи
          const prod = products.find(p => p.id === item.productId)
          const variant = prod?.variants.find(v => v.id === value)
          updated.unitPrice = variant ? variant.salePrice / 100 : 0
        }

        return updated
      })
    )
  }

  const addProductToSubOrder = (subIdx: number) => {
    setOrderItemsList(prev => [...prev, { productId: '', variantId: '', quantity: 1, unitPrice: 0, subOrderIndex: subIdx }])
  }

  // Полный сброс полей формы создания/редактирования заказа
  function resetOrderForm() {
    setEditingOrderId(null)
    setClientPhone('')
    setClientAdditionalPhone('')
    setClientName('')
    setDeliveryAddress('')
    setDiscount('0')
    setDeliveryPrice('0')
    setAssemblyPrice('0')
    setComment('')
    setPlannedDeliveryDate('')
    setSubOrderImages({})
    setIsRetroactive(false)
    setCustomCreatedAt('')
    setCustomDeliveredAt('')
    setCustomStatus('pending')
    setCustomPaymentStatus('unpaid')
    setOrderItemsList([{ productId: '', variantId: '', quantity: 1, unitPrice: 0, subOrderIndex: 0 }])
    setErrorMsg('')
    setSellerId(currentUserId)
  }

  const addSubOrder = () => {
    const maxIdx = orderItemsList.reduce((max, item) => Math.max(max, item.subOrderIndex), -1)
    setOrderItemsList(prev => [...prev, { productId: '', variantId: '', quantity: 1, unitPrice: 0, subOrderIndex: maxIdx + 1 }])
  }

  const removeOrderItemRow = (index: number) => {
    if (orderItemsList.length <= 1) return
    const filtered = orderItemsList.filter((_, idx) => idx !== index)
    
    // Перенумеровываем subOrderIndex, чтобы они шли последовательно
    const uniqueOldIndices = Array.from(new Set(filtered.map(it => it.subOrderIndex))).sort((a, b) => a - b)
    const mapped = filtered.map(item => ({
      ...item,
      subOrderIndex: uniqueOldIndices.indexOf(item.subOrderIndex)
    }))
    setOrderItemsList(mapped)
  }

  // Создать заказ
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setLoading('create')

    if (!sellerId) {
      setErrorMsg('Пожалуйста, выберите продавца, который продал данный заказ')
      setLoading(null)
      return
    }

    // Проверяем позиции
    const invalidItem = orderItemsList.some(item => !item.productId || !item.variantId)
    if (invalidItem) {
      setErrorMsg('Необходимо выбрать товары во всех позициях')
      setLoading(null)
      return
    }

    const payload = {
      clientName,
      clientPhone,
      clientAdditionalPhone: clientAdditionalPhone || null,
      deliveryAddress: deliveryAddress || null,
      discount: disc,
      deliveryPrice: deliv,
      assemblyPrice: assemb,
      comment: comment || null,
      sellerId,
      items: orderItemsList.map(item => ({
        productVariantId: item.variantId,
        quantity: Number(item.quantity) || 1,
        unitPrice: parseFloat(String(item.unitPrice)) || 0,
        subOrderIndex: item.subOrderIndex,
        customTableSize: item.customTableSize || null,
        customChairsCount: item.customChairsCount || null,
      })),
      customCreatedAt: isRetroactive && customCreatedAt ? new Date(customCreatedAt).toISOString() : null,
      customDeliveredAt: isRetroactive && customDeliveredAt && customStatus === 'delivered' ? new Date(customDeliveredAt).toISOString() : null,
      isRetroactive,
      status: isRetroactive ? customStatus : 'pending',
      paymentStatus: isRetroactive ? customPaymentStatus : 'unpaid',
      plannedDeliveryDate: plannedDeliveryDate ? new Date(plannedDeliveryDate).toISOString() : null,
      // Собираем JSON из словаря фото: если одно фото - просто URL, если несколько - JSON
      imageUrl: (() => {
        const keys = Object.keys(subOrderImages).filter(k => (subOrderImages[Number(k)] || []).length > 0)
        if (keys.length === 0) return null
        return JSON.stringify(subOrderImages)
      })(),
    }

    const result = editingOrderId 
      ? await updateOrderAction({ orderId: editingOrderId, ...payload })
      : await createOrderAction(payload)
      
    setLoading(null)

    if (result.error) {
      setErrorMsg(result.error)
    } else {
      setCreateModalOpen(false)
      resetOrderForm()
      router.refresh()
    }
  }

  // Функция открытия модалки редактирования существующего заказа
  const openEditOrderModal = (order: Order) => {
    setEditingOrderId(order.id)
    setClientName(order.client.fullName)
    setClientPhone(order.client.primaryPhone)
    setClientAdditionalPhone(order.client.additionalPhone || '')
    setDeliveryAddress(order.deliveryAddress || '')
    setDiscount(String((order.discount || 0) / 100))
    setDeliveryPrice(String((order.deliveryPrice || 0) / 100))
    setAssemblyPrice(String((order.assemblyPrice || 0) / 100))
    setComment(order.comment || '')
    setSellerId(order.sellerId || (order.seller ? order.seller.id : currentUserId))
    setPlannedDeliveryDate(order.plannedDeliveryDate ? new Date(order.plannedDeliveryDate).toISOString().slice(0, 10) : '')
    setIsRetroactive(false)
    setCustomCreatedAt(toDateTimeLocalValue(order.createdAt))
    setCustomDeliveredAt(order.deliveredAt ? toDateTimeLocalValue(order.deliveredAt) : '')
    setCustomStatus(order.status)
    setCustomPaymentStatus(order.paymentStatus)
    
    // Подтягиваем имеющиеся фото комплекта через parseOrderImages
    const parsed = parseOrderImages(order.imageUrl)
    const numericSubOrderImages: Record<number, string[]> = {}
    for (const [k, v] of Object.entries(parsed)) {
      numericSubOrderImages[Number(k)] = v
    }
    setSubOrderImages(numericSubOrderImages)

    // Собираем позиции заказа
    const mappedItems: OrderFormItem[] = order.items.map(it => {
      const vId = it.variantId || it.variant?.id || ''
      const prod = products.find(p => p.variants.some(v => v.id === vId))
      return {
        productId: prod?.id || '',
        variantId: vId,
        quantity: it.quantity,
        unitPrice: it.unitPrice / 100,
        subOrderIndex: it.subOrderIndex || 0,
        customTableSize: it.customTableSize || undefined,
        customChairsCount: it.customChairsCount !== null && it.customChairsCount !== undefined ? it.customChairsCount : undefined,
      }
    })

    setOrderItemsList(mappedItems.length > 0 ? mappedItems : [{ productId: '', variantId: '', quantity: 1, unitPrice: 0, subOrderIndex: 0 }])
    setErrorMsg('')
    setCreateModalOpen(true)
  }

  // Загрузка фото при создании заказа (для конкретного подзаказа)
  // Используем fetch + FormData к /api/upload-image, чтобы избежать ограничения Server Actions на размер аргументов
  async function handleCreateImageUpload(file: File | Blob, fileName: string, subIdx: number) {
    setImageUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file instanceof File ? file : new File([file], fileName, { type: file.type }))
      const res = await fetch('/api/upload-image', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok || data.error) {
        alert(data.error || 'Ошибка загрузки')
      } else if (data.imageUrl) {
        setSubOrderImages(prev => ({
          ...prev,
          [subIdx]: [...(prev[subIdx] || []), data.imageUrl]
        }))
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка загрузки')
    } finally {
      setImageUploading(false)
    }
  }

  // Вставка фото из буфера обмена при создании заказа
  const handleCreateImagePaste = async (subIdx: number) => {
    setPasteTargetCreateSubIdx(subIdx)
    try {
      if (navigator.clipboard && navigator.clipboard.read) {
        const clipboardItems = await navigator.clipboard.read()
        for (const item of clipboardItems) {
          const imageType = item.types.find(t => t.startsWith('image/'))
          if (imageType) {
            const blob = await item.getType(imageType)
            const ext = imageType.split('/')[1] || 'png'
            await handleCreateImageUpload(blob, `clipboard-paste.${ext}`, subIdx)
            return
          }
        }
      }
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText()
        if (text && (text.startsWith('http://') || text.startsWith('https://'))) {
          setSubOrderImages(prev => ({
            ...prev,
            [subIdx]: [...(prev[subIdx] || []), text.trim()]
          }))
          return
        }
      }
    } catch (err) {
      console.log('Clipboard API read error, waiting for Ctrl+V event:', err)
    }
  }

  // Вспомогательная функция: парсим imageUrl в карту массивов фото по подзаказам
  const parseOrderImages = (imageUrl: string | null | undefined): Record<string, string[]> => {
    if (!imageUrl) return {}
    try {
      const parsed = JSON.parse(imageUrl)
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        const result: Record<string, string[]> = {}
        for (const [key, val] of Object.entries(parsed)) {
          if (Array.isArray(val)) {
            result[key] = val.filter((v): v is string => typeof v === 'string' && !!v.trim())
          } else if (typeof val === 'string' && val.trim()) {
            result[key] = [val.trim()]
          }
        }
        return result
      }
      if (typeof parsed === 'string' && parsed.trim()) {
        return { '0': [parsed.trim()] }
      }
    } catch {
      if (typeof imageUrl === 'string' && imageUrl.trim()) {
        return { '0': [imageUrl.trim()] }
      }
    }
    return {}
  }

  // Сменить статус заказа
  const handleUpdateStatus = async () => {
    if (!selectedOrder) return

    if (newStatus === 'cancelled' && !statusComment.trim()) {
      alert('Необходимо обязательно указать причину отмены заказа')
      return
    }

    if (newStatus === 'delivery' && !selectedDriverId) {
      alert('Пожалуйста, выберите водителя для отправки в доставку')
      return
    }

    setLoading('status')
    const result = await updateOrderStatusAction(
      selectedOrder.id, 
      newStatus, 
      statusComment, 
      newStatus === 'delivery' ? selectedDriverId : null,
      newStatus === 'delivered' && customStatusDeliveredAt ? new Date(customStatusDeliveredAt).toISOString() : null
    )
    setLoading(null)

    if (result.error) {
      alert(result.error)
    } else {
      // Обновляем локальный стейт
      setOrders(prev => prev.map(o => o.id === selectedOrder.id ? { ...o, status: newStatus } : o))
      const updatedOrder = { ...selectedOrder, status: newStatus }
      setSelectedOrder(updatedOrder)
      
      // Перезапрашиваем аудит-логи
      const logs = await getOrderAuditLogsAction(selectedOrder.id)
      setAuditLogs(logs)
      setStatusComment('')
      setSelectedDriverId('')
    }
  }

  // Прямая смена статуса из таблицы заказов
  const handleDirectStatusChange = async (order: Order, targetStatus: string) => {
    if (targetStatus === order.status) return

    if (targetStatus === 'cancelled' || targetStatus === 'delivery' || targetStatus === 'delivered') {
      setQuickStatusTarget({ order, targetStatus })
      setQuickStatusComment('')
      setQuickStatusDriverId(order.driverId || '')
      setQuickStatusDeliveredAt(new Date().toISOString().slice(0, 16))
      setQuickStatusModalOpen(true)
      return
    }

    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: targetStatus } : o))

    const result = await updateOrderStatusAction(order.id, targetStatus)
    if (result.error) {
      alert(result.error)
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: order.status } : o))
    } else {
      router.refresh()
    }
  }

  const handleConfirmQuickStatusChange = async () => {
    if (!quickStatusTarget) return

    const { order, targetStatus } = quickStatusTarget

    if (targetStatus === 'cancelled' && !quickStatusComment.trim()) {
      alert('Необходимо обязательно указать причину отмены заказа')
      return
    }
    if (targetStatus === 'delivery' && !quickStatusDriverId) {
      alert('Пожалуйста, выберите водителя для отправки в доставку')
      return
    }

    setLoading('quickStatus')
    const result = await updateOrderStatusAction(
      order.id,
      targetStatus,
      quickStatusComment,
      targetStatus === 'delivery' ? quickStatusDriverId : null,
      targetStatus === 'delivered' && quickStatusDeliveredAt ? new Date(quickStatusDeliveredAt).toISOString() : null
    )
    setLoading(null)

    if (result.error) {
      alert(result.error)
    } else {
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: targetStatus, driverId: quickStatusDriverId || o.driverId } : o))
      setQuickStatusModalOpen(false)
      setQuickStatusTarget(null)
      router.refresh()
    }
  }

  const handleUpdateFeedback = async () => {
    if (!selectedOrder) return

    setFeedbackLoading(true)
    const result = await updateOrderFeedbackAction(
      selectedOrder.id,
      feedbackType,
      feedbackAuthor,
      feedbackUrl
    )
    setFeedbackLoading(false)

    if (result.error) {
      alert(result.error)
    } else {
      const updatedOrder = {
        ...selectedOrder,
        feedbackType,
        feedbackAuthor: feedbackAuthor.trim() || null,
        feedbackUrl: feedbackUrl.trim() || null
      }
      setOrders(prev => prev.map(o => o.id === selectedOrder.id ? updatedOrder : o))
      setSelectedOrder(updatedOrder)

      const logs = await getOrderAuditLogsAction(selectedOrder.id)
      setAuditLogs(logs)
    }
  }

  const handleDeleteOrder = async () => {
    if (!selectedOrder) return
    const orderNum = selectedOrder.number ? `№${selectedOrder.number}` : `#${selectedOrder.id.slice(-6).toUpperCase()}`
    if (!confirm(`Вы уверены, что хотите навсегда удалить заказ ${orderNum}? Это действие необратимо и удалит все связанные позиции.`)) return

    setLoading('delete')
    const result = await deleteOrderAction(selectedOrder.id)
    setLoading(null)

    if (result.error) {
      alert(result.error)
    } else {
      closeOrderDetails()
      router.refresh()
    }
  }

  const filteredOrders = orders

  const parseOrderNumParts = (numStr?: string | null) => {
    if (!numStr) return { main: 0, sub: 0 }
    const parts = numStr.split('_')
    const mainMatch = parts[0].match(/\d+/)
    const main = mainMatch ? parseInt(mainMatch[0], 10) : 0
    const sub = parts[1] ? parseInt(parts[1], 10) || 0 : 0
    return { main, sub }
  }

  // Четкая числовая сортировка заказов по убыванию номера (293 -> 292 -> ... -> 74 -> 74_2 -> 73)
  const sortedOrders = [...filteredOrders].sort((a, b) => {
    const partA = parseOrderNumParts(a.number)
    const partB = parseOrderNumParts(b.number)
    
    if (partB.main !== partA.main) {
      return partB.main - partA.main
    }
    if (partB.sub !== partA.sub) {
      return partA.sub - partB.sub
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  const paginatedOrders = sortedOrders

  // Быстрые статистики для панели сверху
  const totalActive = summary.active
  const totalDelivered = summary.delivered
  const totalSum = summary.revenue

  return (
    <div className="min-w-0 max-w-full space-y-3 overflow-hidden">
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="erp-card flex min-h-[94px] items-center justify-between px-5 py-4">
          <div>
            <p className="text-[9px] font-medium uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Активные заказы</p>
            <p className="mt-2 text-[22px] font-medium leading-none tracking-[-0.035em] text-[var(--text-primary)]">{totalActive}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-primary)]">
            <ShoppingBag className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </div>
        </div>

        <div className="erp-card flex min-h-[94px] items-center justify-between px-5 py-4">
          <div>
            <p className="text-[9px] font-medium uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Выполнено заказов</p>
            <p className="mt-2 text-[22px] font-medium leading-none tracking-[-0.035em] text-[var(--text-primary)]">{totalDelivered}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--success-soft)] text-[var(--success)]">
            <CheckCircle2 className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </div>
        </div>

        <div className="erp-card flex min-h-[94px] items-center justify-between px-5 py-4">
          <div>
            <p className="text-[9px] font-medium uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Выручка без отменённых</p>
            <p className="mt-2 whitespace-nowrap text-[22px] font-medium leading-none tracking-[-0.035em] text-[var(--text-primary)]">
              {totalSum.toLocaleString('ru-RU')} ₽
            </p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-primary)]">
            <CreditCard className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </div>
        </div>
      </div>

      <section className="erp-card px-4 py-3.5">
        <div className="flex flex-col gap-3 md:min-h-8 md:flex-row md:items-center md:justify-between">
          <div className="shrink-0">
            <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">Этапы заказов</h2>
            <p className="mt-0.5 text-[10px] text-[var(--text-tertiary)]">Текущая загрузка по статусам</p>
          </div>
          <div className="erp-scrollbar-hidden flex min-w-0 flex-1 flex-nowrap gap-1 overflow-x-auto">
            {Object.entries(STATUSES).map(([key, value]) => {
              const isActive = statusFilter === key
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => {
                    setStatusFilter(isActive ? 'all' : key)
                    navigateList({ status: isActive ? 'all' : key, page: 1 })
                  }}
                  className={`inline-flex min-h-7 shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border px-2 text-[9px] font-medium transition-colors ${
                    isActive
                      ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-white'
                      : 'border-[var(--border-primary)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <span>{STAGE_LABELS[key] || value.label}</span>
                  <span className={`rounded-md px-1 py-0.5 tabular-nums ${isActive ? 'bg-white/15' : 'bg-[var(--bg-surface-hover)] text-[var(--text-tertiary)]'}`}>
                    {summary.statuses[key] || 0}
                  </span>
                </button>
              )
            })}
          </div>
          <button
            type="button"
            onClick={() => {
              setStatusFilter('all')
              navigateList({ status: 'all', page: 1 })
            }}
            disabled={statusFilter === 'all'}
            aria-hidden={statusFilter === 'all'}
            tabIndex={statusFilter === 'all' ? -1 : 0}
            className={`inline-flex min-h-8 w-[86px] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-[10px] font-medium text-[var(--accent-primary)] transition-colors hover:bg-[var(--accent-soft)] ${statusFilter === 'all' ? 'invisible pointer-events-none' : ''}`}
          >
            <X className="h-3 w-3" />
            Сбросить
          </button>
        </div>
      </section>

      {/* Панель фильтров и добавления */}
      <div className="erp-card flex flex-col gap-3 p-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-2.5 md:flex-row md:items-center">
          <div className="relative min-w-0 flex-1 xl:max-w-[460px]">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" strokeWidth={1.8} />
            <input
              type="search"
              aria-label="Поиск заказов"
              placeholder="Поиск по ФИО, телефону, № заказа..."
              value={search}
              onChange={e => {
                setSearch(e.target.value)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') navigateList({ query: search.trim(), page: 1 })
              }}
              onBlur={() => {
                if (search.trim() !== initialQuery) navigateList({ query: search.trim(), page: 1 })
              }}
              className="erp-input h-10 w-full !rounded-xl !pl-10 !pr-10 font-normal"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch('')
                  navigateList({ query: '', page: 1 })
                }}
                aria-label="Очистить поиск заказов"
                className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Фильтр по статусу выполнения */}
          <select
            aria-label="Фильтр заказов по статусу"
            value={statusFilter}
            onChange={e => {
              setStatusFilter(e.target.value)
              navigateList({ status: e.target.value, page: 1 })
            }}
            className="erp-input h-10 w-full cursor-pointer !rounded-xl font-medium md:w-56"
          >
            <option value="all">Все статусы выполнения</option>
            {Object.entries(STATUSES).map(([key, value]) => (
              <option key={key} value={key}>{value.label}</option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => {
              setSearch('')
              setStatusFilter('all')
              navigateList({ query: '', status: 'all', page: 1 })
            }}
            disabled={!search && statusFilter === 'all'}
            aria-hidden={!search && statusFilter === 'all'}
            tabIndex={!search && statusFilter === 'all' ? -1 : 0}
            className={`erp-button-secondary inline-flex min-h-10 w-24 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap !rounded-xl ${!search && statusFilter === 'all' ? 'invisible pointer-events-none' : ''}`}
          >
            <X className="h-3.5 w-3.5" />
            Очистить
          </button>
        </div>

        {['admin', 'owner', 'manager', 'logistician'].includes(userRole) && (
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-nowrap">
            <button
              onClick={() => {
                setBatchInputText('')
                setBatchErrorMsg('')
                setBatchSuccessMsg('')
                setBatchUncheckedIds(new Set())
                setBatchMatchedOrders([])
                setBatchNotFoundNumbers([])
                setBatchLookupLoading(false)
                setBatchLookupError('')
                setBatchModalOpen(true)
              }}
              className="erp-button-secondary inline-flex min-h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap !rounded-xl"
              title="Отметить доставленные заказы списком из текста"
            >
              <Truck className="h-4 w-4 text-[var(--success)]" />
              <span>Пакетная доставка</span>
            </button>

            {['admin', 'owner', 'manager'].includes(userRole) && (
              <button
                onClick={() => {
                  resetOrderForm()
                  setCreateModalOpen(true)
                }}
                className="erp-button-primary inline-flex min-h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap !rounded-xl text-xs"
              >
                <Plus className="h-4 w-4" />
                Новый заказ
              </button>
            )}
          </div>
        )}
      </div>

      {/* Список заказов в виде таблицы */}
      <div className="erp-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--border-primary)] bg-[var(--bg-table-header)] text-[9px] font-medium uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
                <th className="px-4 py-2.5">Заказ</th>
                <th className="px-4 py-2.5">Клиент</th>
                <th className="px-4 py-2.5">Состав</th>
                <th className="px-4 py-2.5">Дата</th>
                <th className="px-4 py-2.5">Менеджер</th>
                <th className="px-4 py-2.5">Сумма</th>
                <th className="px-4 py-2.5">Статус</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-primary)] text-[var(--text-primary)] font-normal">
              {paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--bg-surface-hover)] text-[var(--text-tertiary)]">
                        <ShoppingCart className="h-[18px] w-[18px]" strokeWidth={1.6} />
                      </div>
                      <p className="mt-3 text-xs font-medium text-[var(--text-primary)]">Заказы не найдены</p>
                      <button
                        type="button"
                        onClick={() => {
                          setSearch('')
                          setStatusFilter('all')
                          navigateList({ query: '', status: 'all', page: 1 })
                        }}
                        className="mt-1 text-[10px] text-[var(--accent-primary)] hover:underline"
                      >
                        Сбросить фильтры
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedOrders.map(order => {
                  const shortId = order.id.slice(-6).toUpperCase()
                  const grandTotalCents = order.totalPrice + order.deliveryPrice + order.assemblyPrice - order.discount
                  const productNames = Array.from(new Set(order.items.map(item => item.variant.product.name)))
                  const itemQuantity = order.items.reduce((sum, item) => sum + item.quantity, 0)
                  return (
                    <tr
                      key={order.id}
                      tabIndex={0}
                      aria-label={`Открыть заказ ${order.number || shortId}`}
                      onClick={() => openOrderDetails(order)}
                      onKeyDown={event => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          openOrderDetails(order)
                        }
                      }}
                      className="cursor-pointer transition-colors hover:bg-[var(--bg-table-row-hover)] focus-visible:bg-[var(--accent-soft)] focus-visible:outline-none"
                    >
                      <td className="px-4 py-2.5">
                        <span className="font-mono text-[11px] font-semibold text-[var(--text-primary)]">
                          {order.number ? `№${order.number}` : `#${shortId}`}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-primary)]">
                            <User className="h-3.5 w-3.5" strokeWidth={1.8} />
                          </div>
                          <div className="min-w-0">
                            <p className="max-w-[170px] truncate text-[11px] font-medium text-[var(--text-primary)]">{order.client.fullName}</p>
                            <p className="mt-0.5 whitespace-nowrap font-mono text-[9px] text-[var(--text-tertiary)]">{order.client.primaryPhone}</p>
                          </div>
                        </div>
                      </td>
                      <td className="max-w-[250px] px-4 py-2.5">
                        <p className="truncate text-[10px] font-medium text-[var(--text-secondary)]" title={productNames.join(', ')}>
                          {productNames.join(', ') || 'Состав не указан'}
                        </p>
                        <p className="mt-1 text-[9px] text-[var(--text-tertiary)]">Позиций: {itemQuantity}</p>
                      </td>
                      <td className="px-4 py-2.5 text-[10px] tabular-nums text-[var(--text-secondary)]">
                        <div className="whitespace-nowrap">{new Date(order.createdAt).toLocaleDateString('ru-RU')}</div>
                        {order.plannedDeliveryDate && (
                          <div className="mt-1 inline-flex items-center gap-1 whitespace-nowrap text-[9px] font-medium text-[var(--accent-primary)]">
                            <Calendar className="h-3 w-3" />
                            Доставка {new Date(order.plannedDeliveryDate).toLocaleDateString('ru-RU')}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-[10px] text-[var(--text-secondary)]">
                        <span className="block max-w-[140px] truncate">{order.seller?.fullName || order.creator.fullName}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-[11px] font-semibold tabular-nums text-[var(--text-primary)]">
                        {(grandTotalCents / 100).toLocaleString('ru-RU')} ₽
                      </td>
                      <td className="px-4 py-2.5" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                        <select
                          aria-label={`Статус заказа ${order.number || shortId}`}
                          value={order.status}
                          onChange={(e) => handleDirectStatusChange(order, e.target.value)}
                          className="erp-badge w-[178px] cursor-pointer whitespace-nowrap rounded-full px-2.5 py-1 font-medium outline-none transition-all hover:opacity-85"
                          data-status={order.status}
                          title="Нажмите, чтобы изменить статус заказа"
                        >
                          {Object.entries(STATUSES).map(([key, val]) => (
                            <option key={key} value={key} className="bg-[var(--bg-surface)] text-[var(--text-primary)] font-normal">
                              {val.label}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        
        {/* Пагинация и выбор лимита */}
        {totalOrders > 0 && (
          <div className="flex flex-col gap-3 border-t border-[var(--border-primary)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-4">
              <div className="whitespace-nowrap text-[10px] font-normal text-[var(--text-tertiary)]">
                Показано {(currentPage - 1) * ordersPerPage + 1}–{Math.min(currentPage * ordersPerPage, totalOrders)} из {totalOrders}
              </div>
              <div className="flex items-center gap-1.5 whitespace-nowrap text-[10px] font-normal text-[var(--text-secondary)]">
                <span>На странице</span>
                <select
                  value={ordersPerPage}
                  onChange={e => {
                    navigateList({ pageSize: Number(e.target.value), page: 1 })
                  }}
                  className="erp-input h-8 cursor-pointer !rounded-lg px-2 py-1 text-[10px] font-medium"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>
            
            {totalPages > 1 && (
              <div className="erp-scrollbar-hidden flex max-w-full items-center gap-1 overflow-x-auto">
                <button
                  disabled={currentPage === 1}
                  onClick={() => navigateList({ page: Math.max(currentPage - 1, 1) })}
                  className="erp-button-secondary h-8 cursor-pointer px-2.5 py-1 text-[10px] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Назад
                </button>
                {Array.from({ length: totalPages }).map((_, idx) => {
                  const page = idx + 1
                  if (totalPages > 5 && Math.abs(page - currentPage) > 1 && page !== 1 && page !== totalPages) {
                    if (page === 2 || page === totalPages - 1) {
                      return <span key={page} className="px-2 py-1 text-[10px] font-medium text-[var(--text-tertiary)]">…</span>
                    }
                    return null
                  }
                  return (
                    <button
                      key={page}
                      onClick={() => navigateList({ page })}
                      className={`h-8 min-w-8 cursor-pointer whitespace-nowrap rounded-lg px-2.5 py-1 text-[10px] font-medium transition-colors ${
                        currentPage === page
                          ? 'bg-[var(--accent-primary)] text-white'
                          : 'bg-[var(--bg-surface-secondary)] border border-[var(--border-primary)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]'
                      }`}
                    >
                      {page}
                    </button>
                  )
                })}
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => navigateList({ page: Math.min(currentPage + 1, totalPages) })}
                  className="erp-button-secondary h-8 cursor-pointer px-2.5 py-1 text-[10px] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Вперед
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Модальное окно: Просмотр и редактирование заказа */}
      {selectedOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-overlay)] p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="order-details-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeOrderDetails()
          }}
        >
          <div className="relative flex h-[88vh] max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] shadow-lg">
            <div className="flex min-h-16 items-center justify-between gap-4 border-b border-[var(--border-primary)] px-5 py-3">
              <div className="min-w-0">
                <h3 id="order-details-title" className="truncate text-base font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
                  Заказ {selectedOrder.number ? `№${selectedOrder.number}` : `#${selectedOrder.id.slice(-6).toUpperCase()}`}
                </h3>
                <p className="mt-0.5 truncate text-[10px] text-[var(--text-tertiary)]">{selectedOrder.client.fullName} · {new Date(selectedOrder.createdAt).toLocaleDateString('ru-RU')}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {['admin', 'owner', 'manager'].includes(userRole) && (
                  <button
                    type="button"
                    onClick={() => openEditOrderModal(selectedOrder)}
                    className="erp-button-secondary inline-flex shrink-0 items-center gap-2 whitespace-nowrap"
                    title="Редактировать состав и данные заказа"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Редактировать</span>
                  </button>
                )}
                {['admin', 'owner'].includes(userRole) && (
                  <button
                    type="button"
                    onClick={handleDeleteOrder}
                    disabled={loading === 'delete'}
                    aria-label="Удалить заказ"
                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[var(--text-tertiary)] transition-colors hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] disabled:opacity-50"
                    title="Удалить заказ"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={closeOrderDetails}
                  aria-label="Закрыть карточку заказа"
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="border-b border-[var(--border-primary)] bg-[var(--bg-surface-secondary)] px-4 py-3 sm:px-5">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <div className="min-w-0 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-surface)] px-3 py-2">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Клиент</p>
                  <p className="mt-1 truncate text-xs font-semibold text-[var(--text-primary)]">{selectedOrder.client.fullName}</p>
                </div>
                <div className="min-w-0 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-surface)] px-3 py-2">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Телефон</p>
                  <p className="mt-1 truncate font-mono text-xs font-semibold text-[var(--text-primary)]">{selectedOrder.client.primaryPhone}</p>
                </div>
                <div className="min-w-0 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-surface)] px-3 py-2">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Продавец</p>
                  <p className="mt-1 truncate text-xs font-semibold text-[var(--text-primary)]">{selectedOrder.seller?.fullName || selectedOrder.creator.fullName}</p>
                </div>
                <div className="min-w-0 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-surface)] px-3 py-2">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Итого</p>
                  <p className="mt-1 whitespace-nowrap text-xs font-semibold text-[var(--accent-primary)]">
                    {((selectedOrder.totalPrice + selectedOrder.deliveryPrice + selectedOrder.assemblyPrice - selectedOrder.discount) / 100).toLocaleString('ru-RU')} ₽
                  </p>
                </div>
              </div>
            </div>

            <div className="grid flex-1 gap-4 overflow-y-auto p-4 sm:p-5 md:grid-cols-3">
              {/* Левая колонка: Реквизиты и Позиции */}
              <div className="flex min-w-0 flex-col gap-4 md:col-span-2">
                {/* Реквизиты клиента */}
                <div className="order-1 bg-[var(--bg-surface-secondary)] border border-[var(--border-primary)] rounded-md p-3 space-y-2">
                  <h4 className="font-semibold text-xs text-[var(--text-primary)] flex items-center gap-1.5">
                    <User className="h-4 w-4 text-[var(--accent-primary)]" />
                    Данные клиента
                  </h4>
                  <div className="grid gap-2 sm:grid-cols-2 text-xs">
                    <div>
                      <span className="text-[var(--text-tertiary)]">ФИО: </span>
                      <span className="font-medium text-[var(--text-primary)]">{selectedOrder.client.fullName}</span>
                    </div>
                    <div>
                      <span className="text-[var(--text-tertiary)]">Основной телефон: </span>
                      <span className="font-mono font-medium text-[var(--text-primary)]">{selectedOrder.client.primaryPhone}</span>
                    </div>
                    {selectedOrder.client.additionalPhone && (
                      <div>
                        <span className="text-[var(--text-tertiary)]">Доп. телефон: </span>
                        <span className="font-mono font-medium text-[var(--text-primary)]">{selectedOrder.client.additionalPhone}</span>
                      </div>
                    )}
                    {selectedOrder.deliveryAddress && (
                      <div className="flex min-w-0 items-start gap-1 sm:col-span-2">
                        <span className="text-[var(--text-tertiary)] whitespace-nowrap">Адрес доставки: </span>
                        <span className="flex min-w-0 items-center gap-1 break-words font-semibold text-[var(--text-primary)]">
                          <MapPin className="h-3 w-3 text-red-500 shrink-0 mt-0.5" />
                          {selectedOrder.deliveryAddress}
                        </span>
                      </div>
                    )}
                    {selectedOrder.comment && (
                      <div className="sm:col-span-2">
                        <span className="text-[var(--text-tertiary)]">Комментарий: </span>
                        <span className="text-[var(--text-primary)] italic">{selectedOrder.comment}</span>
                      </div>
                    )}
                    <div className="sm:col-span-2 text-[10px] text-[var(--text-tertiary)] flex flex-wrap items-center gap-3 border-t border-[var(--border-primary)] pt-2 mt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        Создан {new Date(selectedOrder.createdAt).toLocaleString('ru-RU')}
                      </span>
                      {selectedOrder.plannedDeliveryDate && (
                        <span className="flex items-center gap-1 whitespace-nowrap rounded bg-[var(--accent-soft)] px-2 py-0.5 font-semibold text-[var(--accent-primary)]">
                          <Calendar className="h-3 w-3" />
                          Желаемая дата доставки: {new Date(selectedOrder.plannedDeliveryDate).toLocaleDateString('ru-RU')}
                        </span>
                      )}
                      <span className="flex items-center gap-1 whitespace-nowrap font-semibold text-[var(--text-primary)]">
                        <User className="h-3 w-3 text-[var(--text-tertiary)]" />
                        Продавец: {selectedOrder.seller?.fullName || selectedOrder.creator.fullName}
                      </span>
                      {selectedOrder.seller && selectedOrder.seller.fullName !== selectedOrder.creator.fullName && (
                        <span className="text-[var(--text-tertiary)]">(Оформил: {selectedOrder.creator.fullName})</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Изображение комплекта — аккуратная галерея с поддержкой нескольких фото на подзаказ */}
                {(() => {
                  const imagesMap = parseOrderImages(selectedOrder.imageUrl)
                  const uniqueSubIdxs = Array.from(new Set(selectedOrder.items.map(i => i.subOrderIndex || 0))).sort((a, b) => a - b)
                  const hasMultipleSubOrders = uniqueSubIdxs.length > 1
                  const totalPhotosCount = Object.values(imagesMap).flat().length

                  return (
                    <div className="order-3 min-w-0 space-y-2.5 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-surface-secondary)] p-3.5">
                      <div className="flex items-center justify-between gap-3">
                        <h4 className="flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-[var(--text-primary)]">
                          <Paperclip className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                          Фотографии заказа · {totalPhotosCount}
                        </h4>
                        <span className="hidden whitespace-nowrap text-[10px] text-[var(--text-tertiary)] sm:inline">Нажмите на фото для просмотра</span>
                      </div>

                      <div className="space-y-3">
                        {uniqueSubIdxs.map((subIdx, idx) => {
                          const subPhotos = imagesMap[String(subIdx)] || []
                          return (
                            <div key={subIdx} className="bg-[var(--bg-surface)] border border-[var(--border-primary)] rounded-lg p-2.5 space-y-2 shadow-xs">
                              <div className="flex items-center justify-between">
                                <span className="shrink-0 whitespace-nowrap text-[10px] font-semibold text-[var(--text-secondary)]">
                                  {hasMultipleSubOrders ? `Подзаказ ${idx + 1}` : 'Комплект'} ({subPhotos.length} фото)
                                </span>
                              </div>

                              {subPhotos.length > 0 ? (
                                <div className="flex flex-wrap gap-2 pt-1">
                                  {subPhotos.map((photoUrl, photoIdx) => (
                                    <div key={photoIdx} className="relative h-24 w-28 rounded-md overflow-hidden border border-[var(--border-primary)] bg-[var(--bg-surface-secondary)] group">
                                      <Image
                                        src={photoUrl}
                                        alt={`Фото ${photoIdx + 1}`}
                                        fill
                                        sizes="112px"
                                        unoptimized
                                        className="h-full w-full object-cover cursor-zoom-in transition-transform duration-200 group-hover:scale-105"
                                        onClick={() => setLightboxUrl(photoUrl)}
                                      />
                                      <div 
                                        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-zoom-in"
                                        onClick={() => setLightboxUrl(photoUrl)}
                                      >
                                        <Eye className="h-5 w-5 text-white drop-shadow" />
                                      </div>
                                      
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="p-3 border border-dashed border-[var(--border-strong)] rounded-md bg-[var(--bg-surface-secondary)] text-center text-[10px] text-[var(--text-tertiary)]">
                                  Нет загруженных фотографий для этого подзаказа
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}

                {/* Позиции заказа */}
                <div className="order-2 space-y-4">
                  <h4 className="font-semibold text-sm text-[var(--text-primary)] flex items-center gap-2">
                    <ShoppingBag className="h-4 w-4 text-emerald-600" />
                    Состав заказа
                  </h4>
                  {(() => {
                    // Группируем позиции по subOrderIndex
                    const groupedDetailsItems = new Map<number, typeof selectedOrder.items>()
                    for (const item of selectedOrder.items) {
                      const sIdx = item.subOrderIndex || 0
                      if (!groupedDetailsItems.has(sIdx)) {
                        groupedDetailsItems.set(sIdx, [])
                      }
                      groupedDetailsItems.get(sIdx)!.push(item)
                    }

                    return Array.from(groupedDetailsItems.entries()).sort((a, b) => a[0] - b[0]).map(([subIdx, items], idx) => {
                        return (
                          <div key={subIdx} className="space-y-3 overflow-x-auto rounded-lg border border-[var(--border-primary)] bg-[var(--bg-surface-secondary)] p-4">
                            <h5 className="font-semibold text-xs text-[var(--text-primary)] uppercase tracking-wider">
                              Заказ {idx + 1}
                            </h5>
                            <table className="w-full min-w-[620px] border-collapse text-left text-xs">
                              <thead>
                                <tr className="border-b border-[var(--border-primary)] text-[var(--text-tertiary)] font-medium bg-[var(--bg-table-header)]">
                                  <th className="whitespace-nowrap p-3 pl-0">Товар / Вариант</th>
                                  <th className="whitespace-nowrap p-3">Артикул (SKU)</th>
                                  <th className="p-3 text-center whitespace-nowrap">Кол-во</th>
                                  <th className="p-3 whitespace-nowrap">Цена продажи</th>
                                  <th className="p-3 pr-0 text-right whitespace-nowrap">Итого</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[var(--border-primary)] font-normal text-[var(--text-primary)]">
                                {items.map(item => (
                                  <tr key={item.id}>
                                    <td className="p-3 pl-0">
                                      <div className="font-medium text-[var(--text-primary)]">
                                        {item.variant.product.name}
                                      </div>
                                      <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5">
                                        {[
                                          (item.customTableSize ? `Размер стола: ${item.customTableSize} (Инд.)` : (item.variant.size && `Размер стола: ${item.variant.size}`)),
                                          item.variant.color && `Цвет: ${item.variant.color}`,
                                          (item.variant.thickness || (item.variant.attributes as { tablePattern?: string } | null)?.tablePattern) && `Узор: ${item.variant.thickness || (item.variant.attributes as { tablePattern?: string } | null)?.tablePattern}`
                                        ].filter(Boolean).join(' / ')}
                                      </div>
                                      {item.customChairsCount !== null && item.customChairsCount !== undefined && (
                                        <div className="text-[10px] text-brand font-bold mt-0.5">
                                          Стульев в комплекте: {item.customChairsCount} шт
                                        </div>
                                      )}
                                    </td>
                                    <td className="p-3 font-mono text-[10px]">
                                      {item.variant.sku}
                                    </td>
                                    <td className="p-3 text-center font-bold whitespace-nowrap">
                                      {item.quantity} шт
                                    </td>
                                    <td className="p-3 whitespace-nowrap font-medium">
                                      {(item.unitPrice / 100).toLocaleString('ru-RU')} ₽
                                    </td>
                                    <td className="p-3 pr-0 text-right whitespace-nowrap font-semibold text-[var(--text-primary)]">
                                      {((item.quantity * item.unitPrice) / 100).toLocaleString('ru-RU')} ₽
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>                            
                          </div>
                        )
                      })
                  })()}
                </div>

                {/* История изменений логов */}
                <div className="order-4 space-y-3">
                  <h4 className="font-semibold text-sm text-[var(--text-primary)] flex items-center gap-2">
                    <History className="h-4 w-4 text-emerald-600" />
                    История и аудит изменений
                  </h4>
                  <div className="border border-[var(--border-primary)] rounded-lg max-h-48 overflow-y-auto divide-y divide-[var(--border-primary)] text-xs">
                    {auditLogs.length === 0 ? (
                      <div className="p-4 text-center text-[var(--text-tertiary)]">Загрузка истории...</div>
                    ) : (
                      auditLogs.map(log => (
                        <div key={log.id} className="p-3 hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition-colors">
                          <div className="flex justify-between text-[10px] text-slate-400">
                            <span className="font-bold text-slate-600 dark:text-slate-300">
                              {log.user?.fullName || 'Система'}
                            </span>
                            <span>{new Date(log.createdAt).toLocaleString('ru-RU')}</span>
                          </div>
                          <p className="font-medium text-[var(--text-primary)] mt-1">
                            {log.comment}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Правая колонка: Финансы, Статусы и Действия */}
              <div className="min-w-0 space-y-6 border-t border-[var(--border-primary)] pt-6 md:border-l md:border-t-0 md:pl-6 md:pt-0">
                {/* Блок финансов */}
                <div className="bg-[var(--bg-surface-secondary)] border border-[var(--border-primary)] rounded-lg p-4 space-y-3">
                  <h4 className="font-semibold text-sm text-[var(--text-primary)] flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-emerald-600" />
                    Финансовая сводка
                  </h4>
                  <div className="space-y-2 text-xs divide-y divide-[var(--border-primary)]">
                    <div className="flex justify-between pt-1">
                      <span className="text-[var(--text-tertiary)]">Товары:</span>
                      <span className="font-semibold text-[var(--text-primary)]">{(selectedOrder.totalPrice / 100).toLocaleString('ru-RU')} ₽</span>
                    </div>
                    {selectedOrder.discount > 0 && (
                      <div className="flex justify-between pt-2">
                        <span className="text-[var(--text-tertiary)]">Скидка:</span>
                        <span className="font-bold text-red-500">-{(selectedOrder.discount / 100).toLocaleString('ru-RU')} ₽</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-2">
                      <span className="text-[var(--text-tertiary)]">Доставка:</span>
                      <span className="font-semibold text-[var(--text-primary)]">{(selectedOrder.deliveryPrice / 100).toLocaleString('ru-RU')} ₽</span>
                    </div>
                    <div className="flex justify-between pt-2">
                      <span className="text-[var(--text-tertiary)]">Сборка:</span>
                      <span className="font-semibold text-[var(--text-primary)]">{(selectedOrder.assemblyPrice / 100).toLocaleString('ru-RU')} ₽</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t font-bold text-sm">
                      <span className="text-[var(--text-primary)]">Итого к оплате:</span>
                      <span className="text-emerald-600 dark:text-emerald-400">
                        {((selectedOrder.totalPrice + selectedOrder.deliveryPrice + selectedOrder.assemblyPrice - selectedOrder.discount) / 100).toLocaleString('ru-RU')} ₽
                      </span>
                    </div>
                  </div>
                </div>

                {/* Управление статусом */}
                {['admin', 'owner', 'manager'].includes(userRole) && 
                  (selectedOrder.status !== 'cancelled' || ['admin', 'owner'].includes(userRole)) && (
                  <div className="space-y-3 p-4 border border-[var(--border-primary)] rounded-lg">
                    <h4 className="font-semibold text-xs text-[var(--text-primary)]">Изменить статус выполнения</h4>
                    <div className="space-y-2">
                      <select
                        value={newStatus}
                        onChange={e => {
                          setNewStatus(e.target.value)
                          setSelectedDriverId('')
                        }}
                        className="erp-input w-full py-1.5"
                      >
                        {Object.entries(STATUSES).map(([key, val]) => (
                          <option key={key} value={key}>{val.label}</option>
                        ))}
                      </select>

                      {newStatus === 'delivery' && (
                        <div className="space-y-1">
                          <label className="erp-label">Назначить водителя *</label>
                          <select
                            value={selectedDriverId}
                            onChange={e => setSelectedDriverId(e.target.value)}
                            className="erp-input w-full py-1.5"
                          >
                            <option value="">-- Выберите водителя --</option>
                            {drivers.map(d => (
                              <option key={d.id} value={d.id}>{d.fullName}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {newStatus === 'delivered' && (
                        <div className="space-y-1">
                          <label className="erp-label">Дата и время фактической доставки *</label>
                          <input
                            type="datetime-local"
                            required
                            value={customStatusDeliveredAt || new Date().toISOString().slice(0, 16)}
                            onChange={e => setCustomStatusDeliveredAt(e.target.value)}
                            className="erp-input w-full py-1.5 font-normal text-xs"
                          />
                          <p className="text-[10px] text-[var(--text-tertiary)] font-normal">
                            По умолчанию установлены текущие дата и время. Укажите прошедшую дату, если заказ был доставлен ранее.
                          </p>
                        </div>
                      )}

                      <input
                        type="text"
                        placeholder={newStatus === 'cancelled' ? "Укажите причину отмены заказа *" : "Комментарий к статусу (необязательно)"}
                        value={statusComment}
                        onChange={e => setStatusComment(e.target.value)}
                        className="erp-input w-full py-1.5"
                      />
                      <button
                        onClick={handleUpdateStatus}
                        disabled={loading === 'status'}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 rounded text-xs transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {loading === 'status' ? 'Сохранение...' : 'Обновить статус'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Учет отзыва клиента */}
                {['admin', 'owner', 'manager'].includes(userRole) && (
                  <div className="space-y-3 p-4 border border-[var(--border-primary)] rounded-lg bg-[var(--bg-surface-secondary)]">
                    <h4 className="font-semibold text-xs text-[var(--text-primary)]">Отзыв клиента и бонусы</h4>
                    <div className="space-y-2">
                      <div>
                        <label className="erp-label">Тип отзыва</label>
                        <select
                          value={feedbackType}
                          onChange={e => setFeedbackType(e.target.value)}
                          className="erp-input w-full py-1"
                        >
                          <option value="none">Без отзыва (0 ₽)</option>
                          <option value="no_photo">Отзыв без фото (+300 ₽ менеджеру)</option>
                          <option value="with_photo">Отзыв с фото (+500 ₽ менеджеру)</option>
                        </select>
                      </div>

                      {feedbackType !== 'none' && (
                        <>
                          <div>
                            <label className="erp-label">Имя автора отзыва *</label>
                            <input
                              type="text"
                              placeholder="Иван И. или логин"
                              value={feedbackAuthor}
                              onChange={e => setFeedbackAuthor(e.target.value)}
                              className="erp-input w-full py-1"
                            />
                          </div>
                          <div>
                            <label className="erp-label">Ссылка на страницу с отзывом *</label>
                            <input
                              type="text"
                              placeholder="https://avito.ru/profile/..."
                              value={feedbackUrl}
                              onChange={e => setFeedbackUrl(e.target.value)}
                              className="erp-input w-full py-1"
                            />
                          </div>
                        </>
                      )}

                      <button
                        onClick={handleUpdateFeedback}
                        disabled={feedbackLoading || (feedbackType !== 'none' && (!feedbackAuthor.trim() || !feedbackUrl.trim()))}
                        className="erp-button-primary w-full py-1.5 cursor-pointer disabled:opacity-50 mt-1"
                      >
                        {feedbackLoading ? 'Сохранение...' : 'Сохранить данные отзыва'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно: Создание нового заказа */}
      {createModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-overlay)] p-2 backdrop-blur-xs sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="order-form-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleRequestCloseOrderModal()
            }
          }}
        >
          <div className="relative flex h-[92vh] max-h-[92vh] w-full max-w-[1080px] flex-col overflow-hidden rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] shadow-lg sm:h-[88vh] sm:max-h-[88vh]">
            <div className="flex min-h-16 items-center justify-between gap-4 border-b border-[var(--border-primary)] px-4 py-3 sm:px-5">
              <div className="min-w-0">
              <h3 id="order-form-title" className="truncate text-base font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
                {editingOrderId
                  ? `Редактирование заказа ${selectedOrder?.number ? `№${selectedOrder.number}` : ''}`
                  : 'Оформление нового заказа'}
              </h3>
                <p className="mt-0.5 text-[10px] text-[var(--text-tertiary)]">Клиент, доставка, состав заказа и расчёт — в одном окне</p>
              </div>
              <button
                type="button"
                onClick={handleRequestCloseOrderModal}
                aria-label="Закрыть форму заказа"
                className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="flex flex-col flex-1 overflow-hidden">
              <div className="grid flex-1 gap-4 overflow-y-auto p-4 sm:p-5 md:grid-cols-3">
                {/* Левая часть: данные клиента и позиции */}
                <div className="space-y-4 md:col-span-2">
                  {errorMsg && (
                    <div className="p-3 text-xs bg-[var(--danger-soft)] border border-[var(--danger)]/20 text-[var(--danger)] font-medium rounded-md">
                      {errorMsg}
                    </div>
                  )}

                  {/* Блок клиента */}
                  <div className="p-3 bg-[var(--bg-surface-secondary)] rounded-md border border-[var(--border-primary)] space-y-3">
                    <h4 className="flex items-center gap-1.5 text-sm font-semibold text-[var(--text-primary)]">
                      <User className="h-4 w-4 text-[var(--accent-primary)]" />
                      Данные клиента
                    </h4>
                    <div className="grid gap-2.5 sm:grid-cols-2 relative">
                      <div>
                        <label className="block text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                          Основной телефон *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="+7 (999) 123-45-67"
                          value={clientPhone}
                          onChange={e => setClientPhone(e.target.value)}
                          className="erp-input w-full font-mono"
                        />
                        {/* Подсказки автопоиска */}
                        {foundClients.length > 0 && (
                          <div className="absolute left-0 right-0 z-10 mt-1 bg-[var(--bg-surface)] border border-[var(--border-primary)] rounded-md shadow-md max-h-48 overflow-y-auto text-xs">
                            <div className="p-1.5 bg-[var(--bg-table-header)] text-[10px] font-medium text-[var(--text-tertiary)] border-b border-[var(--border-primary)]">
                              Найдено в базе клиентов:
                            </div>
                            {foundClients.map(c => (
                              <div
                                key={c.id}
                                onClick={() => {
                                  setClientPhone(c.primaryPhone)
                                  setClientAdditionalPhone(c.additionalPhone || '')
                                  setClientName(c.fullName)
                                  setDeliveryAddress(c.address || '')
                                  setFoundClients([])
                                }}
                                className="p-2 hover:bg-[var(--bg-surface-hover)] cursor-pointer flex justify-between"
                              >
                                <span className="font-medium text-[var(--text-primary)]">{c.fullName}</span>
                                <span className="font-mono text-[var(--text-tertiary)]">{c.primaryPhone}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {searchClientLoading && (
                          <div className="text-[10px] text-[var(--text-tertiary)] mt-1 font-normal">Поиск по базе...</div>
                        )}
                      </div>

                      <div>
                        <label className="block text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                          Дополнительный телефон
                        </label>
                        <input
                          type="text"
                          placeholder="+7 (910) 123-45-67"
                          value={clientAdditionalPhone}
                          onChange={e => setClientAdditionalPhone(e.target.value)}
                          className="erp-input w-full font-mono"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                          ФИО клиента *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Иванов Иван Иванович"
                          value={clientName}
                          onChange={e => setClientName(e.target.value)}
                          className="erp-input w-full font-normal"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
                            Адрес доставки
                          </label>
                          {deliveryAddress && (
                            <button
                              type="button"
                              onClick={() => setDeliveryAddress(normalizeAddress(deliveryAddress))}
                              className="text-[10px] font-semibold text-[var(--accent-primary)] hover:underline flex items-center gap-1 cursor-pointer"
                              title="Автоматически исправить опечатки и отформатировать адрес"
                            >
                              <Sparkles className="h-3 w-3" />
                              <span>Исправить опечатки</span>
                            </button>
                          )}
                        </div>
                        <input
                          type="text"
                          placeholder="г. Калуга, ул. Ленина, д. 10, кв. 5"
                          value={deliveryAddress}
                          onChange={e => setDeliveryAddress(e.target.value)}
                          className="erp-input w-full font-normal"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                          <span>Желаемая дата доставки</span>
                        </label>
                        <input
                          type="date"
                          value={plannedDeliveryDate}
                          onChange={e => setPlannedDeliveryDate(e.target.value)}
                          className="erp-input w-full font-normal"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                          Продавец *
                        </label>
                        <select
                          required
                          value={sellerId}
                          onChange={e => setSellerId(e.target.value)}
                          className="erp-input w-full font-medium"
                        >
                          <option value="">-- Выберите продавца --</option>
                          {sellers.map(s => (
                            <option key={s.id} value={s.id}>{s.fullName}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Добавление товаров по подзаказам */}
                  <div className="space-y-6">
                    <div className="flex items-center justify-between border-b pb-2">
                      <h4 className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
                        <ShoppingCart className="h-4 w-4 text-[var(--accent-primary)]" />
                        Товары в заказе
                      </h4>
                      <button
                        type="button"
                        onClick={addSubOrder}
                        className="inline-flex items-center gap-1 rounded-lg bg-[var(--accent-primary)]/10 hover:bg-[var(--accent-primary)]/20 text-[10px] font-bold text-[var(--accent-primary)] px-2.5 py-1.5 transition cursor-pointer select-none"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Добавить заказ
                      </button>
                    </div>

                    {/* Группируем по subOrderIndex */}
                    {(() => {
                      const subOrderIndices = Array.from(new Set(orderItemsList.map(item => item.subOrderIndex))).sort((a, b) => a - b)
                      return subOrderIndices.map((subIdx, orderNumIdx) => {
                        const subOrderItems = orderItemsList.map((item, globalIdx) => ({ item, globalIdx })).filter(x => x.item.subOrderIndex === subIdx)
                        return (
                          <div key={subIdx} className="border border-[var(--border-primary)] rounded-lg p-4 bg-[var(--bg-surface-secondary)] space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider">
                                Заказ {orderNumIdx + 1}
                              </span>
                              <button
                                type="button"
                                onClick={() => addProductToSubOrder(subIdx)}
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-brand hover:text-brand-hover cursor-pointer"
                              >
                                <Plus className="h-3 w-3" />
                                Добавить товар
                              </button>
                            </div>

                            <div className="space-y-3">
                              {subOrderItems.map(({ item, globalIdx }) => (
                                <div 
                                  key={globalIdx}
                                  className="p-3 bg-[var(--bg-surface)] border border-[var(--border-primary)] rounded-lg relative grid gap-3 sm:grid-cols-5"
                                >
                                  {/* Удалить строку */}
                                  {orderItemsList.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => removeOrderItemRow(globalIdx)}
                                      className="absolute -top-2 -right-2 p-1 bg-[var(--bg-surface)] border border-[var(--border-primary)] text-[var(--text-tertiary)] hover:text-[var(--danger)] rounded-full shadow cursor-pointer"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  )}

                                  {/* Выбор товара через модальное окно каталога */}
                                  <div className="sm:col-span-3">
                                    <label className="erp-label">Товар и модификация</label>
                                    {item.productId && item.variantId ? (
                                      <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
                                        <div className="text-xs">
                                          <div className="font-bold text-slate-800 dark:text-slate-200">
                                            {products.find(p => p.id === item.productId)?.name}
                                          </div>
                                          <div className="text-[10px] text-[var(--text-tertiary)] font-mono">
                                            SKU: {(() => {
                                              const prod = products.find(p => p.id === item.productId)
                                              const vr = prod?.variants.find(v => v.id === item.variantId)
                                              return vr ? `${vr.sku} (${[vr.size && `Размер: ${vr.size}`, vr.color && `Цвет: ${vr.color}`, vr.thickness && `Узор: ${vr.thickness}`].filter(Boolean).join(' / ')})` : ''
                                            })()}
                                          </div>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setSelectingItemIndex(globalIdx)
                                            setCatalogModalCategory(null)
                                            setCatalogModalFolder(null)
                                            setCatalogModalSearch('')
                                          }}
                                          className="px-2 py-1 text-[10px] font-bold text-brand hover:bg-brand/5 border border-brand/20 rounded-md cursor-pointer transition"
                                        >
                                          Изменить
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectingItemIndex(globalIdx)
                                          setCatalogModalCategory(null)
                                          setCatalogModalFolder(null)
                                          setCatalogModalSearch('')
                                        }}
                                        className="w-full flex items-center justify-center gap-2 p-3 bg-[var(--bg-surface-secondary)] hover:bg-[var(--bg-surface)] border border-dashed border-[var(--border-strong)] hover:border-[var(--accent-primary)] text-[var(--text-tertiary)] hover:text-[var(--accent-primary)] font-medium text-xs rounded-lg transition cursor-pointer"
                                      >
                                        <Search className="h-4 w-4" />
                                        Выбрать товар из каталога...
                                      </button>
                                    )}
                                  </div>

                                  {/* Кол-во */}
                                  <div>
                                    <label className="erp-label">Кол-во</label>
                                    <input
                                      type="number"
                                      required
                                      min="1"
                                      value={item.quantity}
                                      onChange={e => handleItemFieldChange(globalIdx, 'quantity', parseInt(e.target.value) || 1)}
                                      className="erp-input w-full py-1"
                                    />
                                  </div>

                                  {/* Фактическая цена продажи */}
                                  <div>
                                    <label className="erp-label">Цена продажи (₽)</label>
                                    <input
                                      type="number"
                                      required
                                      min="0"
                                      placeholder="Рекомендуемая"
                                      value={item.unitPrice}
                                      onChange={e => handleItemFieldChange(globalIdx, 'unitPrice', parseFloat(e.target.value) || 0)}
                                      className="w-full px-2 py-1 text-xs bg-[var(--bg-surface-secondary)] border border-[var(--border-primary)] rounded focus:outline-none font-bold text-emerald-600"
                                    />
                                  </div>

                                  {/* Кастомные настройки для Столов и Комплектов */}
                                  {(() => {
                                    const prod = products.find(p => p.id === item.productId)
                                    const cat = prod ? categories.find(c => c.id === prod.categoryId) : null
                                    
                                    if (!cat) return null
                                    
                                    const isSet = cat.slug === 'sets'
                                    const isTable = cat.slug === 'tables'
                                    
                                    if (!isSet && !isTable) return null
                                    
                                    return (
                                      <div className="sm:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[var(--border-primary)] mt-1">
                                        {/* Настройка размера стола */}
                                        <div>
                                          <label className="block text-[9px] font-bold text-[var(--text-tertiary)] mb-0.5">
                                            Размер стола {isSet ? '(в комплекте)' : ''}
                                          </label>
                                          <input
                                            type="text"
                                            placeholder="Напр. 150х85 или инд. размер"
                                            value={item.customTableSize || ''}
                                            onChange={e => handleItemFieldChange(globalIdx, 'customTableSize', e.target.value)}
                                            className="w-full px-2 py-1 text-xs bg-[var(--bg-surface-secondary)] border border-[var(--border-primary)] rounded focus:outline-none focus:border-brand"
                                          />
                                        </div>

                                        {/* Настройка количества стульев */}
                                        {isSet && (
                                          <div>
                                            <label className="block text-[9px] font-bold text-[var(--text-tertiary)] mb-0.5">
                                              Количество стульев в комплекте
                                            </label>
                                            <input
                                              type="number"
                                              min="1"
                                              value={item.customChairsCount !== undefined ? item.customChairsCount : 4}
                                              onChange={e => handleItemFieldChange(globalIdx, 'customChairsCount', parseInt(e.target.value) || 0)}
                                              className="w-full px-2 py-1 text-xs bg-[var(--bg-surface-secondary)] border border-[var(--border-primary)] rounded focus:outline-none focus:border-brand"
                                            />
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })()}
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })
                    })()}
                  </div>

                </div>

                {/* Правая часть: Расчет стоимости */}
                <div className="space-y-6 border-t md:border-t-0 md:border-l border-[var(--border-primary)] md:pl-6 pt-6 md:pt-0">
                  <h4 className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-emerald-600" />
                    Расчет калькуляции
                  </h4>

                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="erp-label">Сумма по позициям</label>
                      <input
                        type="text"
                        disabled
                        value={`${itemsTotal.toLocaleString('ru-RU')} ₽`}
                        className="erp-input w-full py-2 font-semibold"
                      />
                    </div>

                    <div>
                      <label className="erp-label">Скидка (₽)</label>
                      <input
                        type="number"
                        min="0"
                        value={discount}
                        onChange={e => setDiscount(e.target.value)}
                        className="erp-input w-full py-2 text-[var(--danger)] font-semibold"
                      />
                    </div>

                    <div>
                      <label className="erp-label">Доставка (₽)</label>
                      <input
                        type="number"
                        min="0"
                        value={deliveryPrice}
                        onChange={e => setDeliveryPrice(e.target.value)}
                        className="erp-input w-full py-2"
                      />
                    </div>

                    <div>
                      <label className="erp-label">Сборка и подъем (₽)</label>
                      <input
                        type="number"
                        min="0"
                        value={assemblyPrice}
                        onChange={e => setAssemblyPrice(e.target.value)}
                        className="erp-input w-full py-2"
                      />
                    </div>

                    <div className="p-3 bg-[var(--bg-surface-secondary)] border border-[var(--border-primary)] rounded-lg space-y-2">
                      <div className="flex justify-between font-bold text-sm">
                        <span>Итого к оплате:</span>
                        <span className="text-emerald-600 dark:text-emerald-400">{grandTotal.toLocaleString('ru-RU')} ₽</span>
                      </div>
                    </div>

                    <div>
                      <label className="erp-label">Комментарий к заказу</label>
                      <textarea
                        rows={3}
                        placeholder="Специфика доставки, подъем на этаж, особые требования..."
                        value={comment}
                        onChange={e => setComment(e.target.value)}
                        className="erp-input w-full py-2 resize-none"
                      />
                    </div>

                    {/* Фото по каждому подзаказу */}
                    {(() => {
                      // Собираем уникальные подзаказы
                      const uniqueSubIdxs = Array.from(new Set(orderItemsList.map(i => i.subOrderIndex))).sort((a, b) => a - b)
                      return uniqueSubIdxs.map((subIdx, pos) => (
                        <div key={subIdx} className="pt-2 space-y-1">
                          <label className="erp-label">
                            {uniqueSubIdxs.length > 1 ? `Фото комплекта — Заказ ${pos + 1}` : 'Фото комплекта'}
                          </label>
                        {(() => {
                          const currentPhotos = subOrderImages[subIdx] || []
                          return (
                            <div className="space-y-2">
                              {currentPhotos.length > 0 && (
                                <div className="flex flex-wrap gap-2 p-2 bg-[var(--bg-surface-secondary)] border border-[var(--border-primary)] rounded-lg">
                                  {currentPhotos.map((url, imgIdx) => (
                                    <div key={imgIdx} className="relative h-16 w-20 rounded border border-[var(--border-primary)] overflow-hidden group">
                                      <Image src={url} alt={`Превью ${imgIdx + 1}`} fill sizes="80px" unoptimized className="object-cover" />
                                      <button
                                        type="button"
                                        title="Удалить фото"
                                        onClick={() => {
                                          setSubOrderImages(prev => {
                                            const updated = [...(prev[subIdx] || [])]
                                            updated.splice(imgIdx, 1)
                                            return { ...prev, [subIdx]: updated }
                                          })
                                        }}
                                        className="absolute top-0.5 right-0.5 p-0.5 bg-black/70 hover:bg-red-500 text-white rounded transition-colors"
                                      >
                                        <X className="h-3 w-3" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}

                              <div className="flex gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setYandexPickerSubOrderIdx(subIdx)
                                    setYandexPickerOpen(true)
                                  }}
                                  disabled={imageUploading}
                                  className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-600 dark:text-yellow-500 text-[10px] font-semibold rounded-md transition-colors cursor-pointer disabled:opacity-50"
                                >
                                  <Folder className="h-3 w-3" />
                                  + Я.Диск
                                </button>

                                <label
                                  htmlFor={`create-image-input-${subIdx}`}
                                  className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 bg-[var(--bg-surface-secondary)] hover:bg-[var(--bg-surface-active)] text-[var(--text-secondary)] text-[10px] font-semibold rounded-md border border-[var(--border-primary)] cursor-pointer select-none transition-colors"
                                >
                                  <Paperclip className="h-3 w-3" />
                                  {imageUploading ? 'Загрузка...' : '+ Файл'}
                                </label>

                                <button
                                  type="button"
                                  onClick={() => handleCreateImagePaste(subIdx)}
                                  disabled={imageUploading}
                                  className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 bg-[#4B63FF]/10 hover:bg-[#4B63FF]/20 text-[#4B63FF] text-[10px] font-semibold rounded-md transition-colors cursor-pointer disabled:opacity-50"
                                >
                                  <Clipboard className="h-3 w-3" />
                                  + Вставить
                                </button>
                              </div>
                            </div>
                          )
                        })()}
                          <input
                            type="file"
                            accept="image/*"
                            id={`create-image-input-${subIdx}`}
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) handleCreateImageUpload(file, file.name, subIdx)
                            }}
                            disabled={imageUploading}
                          />
                        </div>
                      ))
                    })()}

                    {/* Ретроспективный ввод */}
                    <div className="pt-4 border-t border-slate-200/50 mt-4 space-y-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isRetroactive}
                          onChange={e => {
                            setIsRetroactive(e.target.checked)
                            if (e.target.checked && !editingOrderId) {
                              setCustomCreatedAt(toDateTimeLocalValue(new Date()))
                              setCustomStatus('pending')
                              setCustomPaymentStatus('unpaid')
                              setCustomDeliveredAt(toDateTimeLocalValue(new Date()))
                            }
                          }}
                          className="rounded text-brand focus:ring-brand h-4 w-4 cursor-pointer"
                        />
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          Внести прошедший заказ
                        </span>
                      </label>

                      {isRetroactive && (
                        <div className="p-3 bg-[var(--bg-surface-secondary)] border border-[var(--border-primary)] rounded-md space-y-2.5">
                          <div>
                            <label className="block text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                              Статус выполнения
                            </label>
                            <select
                              value={customStatus}
                              onChange={e => setCustomStatus(e.target.value)}
                              className="erp-input w-full font-medium"
                            >
                              <option value="pending">Ожидает подтверждения</option>
                              <option value="confirmed">Подтвержден</option>
                              <option value="production">В производстве</option>
                              <option value="production_completed">Готов на производстве</option>
                              <option value="warehouse">На складе</option>
                              <option value="delivery">Доставка</option>
                              <option value="delivered">Доставлен</option>
                              <option value="cancelled">Отменен</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                              Статус оплаты
                            </label>
                            <select
                              value={customPaymentStatus}
                              onChange={e => setCustomPaymentStatus(e.target.value)}
                              className="erp-input w-full font-medium"
                            >
                              <option value="unpaid">Не оплачен</option>
                              <option value="partially_paid">Частично оплачен</option>
                              <option value="paid">Оплачен</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                              Дата и время создания *
                            </label>
                            <input
                              type="datetime-local"
                              required
                              value={customCreatedAt}
                              onChange={e => setCustomCreatedAt(e.target.value)}
                              className="erp-input w-full"
                            />
                          </div>

                          {customStatus === 'delivered' && (
                            <div>
                              <label className="block text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                                Дата и время доставки *
                              </label>
                              <input
                                type="datetime-local"
                                required
                                value={customDeliveredAt}
                                onChange={e => setCustomDeliveredAt(e.target.value)}
                                className="erp-input w-full"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

              </div>

              {/* Футер создания/редактирования заказа */}
              <div className="flex items-center justify-between gap-3 border-t border-[var(--border-primary)] bg-[var(--bg-table-header)] p-4 sm:px-5">
                <button
                  type="button"
                  onClick={handleRequestCloseOrderModal}
                  className="erp-button-secondary shrink-0 cursor-pointer whitespace-nowrap"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={loading === 'create'}
                  className="erp-button-primary min-w-[154px] shrink-0 cursor-pointer whitespace-nowrap disabled:opacity-50"
                >
                  {loading === 'create'
                    ? (editingOrderId ? 'Сохранение...' : 'Создание...')
                    : (editingOrderId ? 'Сохранить изменения' : 'Оформить заказ')
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модальное окно выбора товара из каталога */}
      {selectingItemIndex !== null && (() => {
        const activeCatId = catalogModalCategory || categories[0]?.id
        const currentCategory = categories.find(c => c.id === activeCatId)
        
        const getBreadcrumbs = (folderId: string | null): ProductFolder[] => {
          if (!folderId) return []
          const list: ProductFolder[] = []
          let curr: ProductFolder | undefined = folders.find(f => f.id === folderId)
          while (curr) {
            list.unshift(curr)
            curr = folders.find(f => f.id === curr?.parentId)
          }
          return list
        }

        const crumbs = getBreadcrumbs(catalogModalFolder)
        const activeFolders = folders.filter(f => f.categoryId === activeCatId && f.parentId === catalogModalFolder)
        const activeProducts = products.filter(p => {
          if (p.categoryId !== activeCatId) return false
          if (catalogModalFolder === null) {
            return p.folderId === null
          }
          return p.folderId === catalogModalFolder
        })

        const isSearching = catalogModalSearch.trim().length > 0
        const searchedProducts = products.filter(p => {
          const query = catalogModalSearch.toLowerCase()
          const matchName = p.name.toLowerCase().includes(query)
          const matchBaseSku = p.baseSku.toLowerCase().includes(query)
          const matchVariant = p.variants.some(v => v.sku.toLowerCase().includes(query))
          return matchName || matchBaseSku || matchVariant
        })

        const displayProducts = isSearching ? searchedProducts : activeProducts

        return (
          <div 
            className="fixed inset-0 z-[70] flex items-center justify-center bg-[var(--bg-overlay)] backdrop-blur-xs p-2 sm:p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) setSelectingItemIndex(null)
            }}
          >
            <div className="w-full max-w-4xl h-[90vh] sm:h-[75vh] max-h-[90vh] bg-[var(--bg-surface)] rounded-xl shadow-2xl border border-[var(--border-primary)] overflow-hidden flex flex-col">
              
              {/* Шапка модалки */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-primary)] bg-[var(--bg-table-header)]">
                <div>
                  <h3 className="text-xs font-semibold text-[var(--text-primary)]">Выбор товара из каталога</h3>
                  <p className="text-[10px] text-[var(--text-tertiary)] font-normal">Выберите модель и её модификацию (SKU)</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectingItemIndex(null)}
                  className="p-1 hover:bg-[var(--bg-surface-hover)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] rounded transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Поисковая панель */}
              <div className="px-4 py-2 border-b border-[var(--border-primary)] bg-[var(--bg-surface-secondary)] flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-tertiary)] pointer-events-none z-10" />
                  <input
                    type="text"
                    placeholder="Поиск по названию товара или артикулу (SKU)..."
                    value={catalogModalSearch}
                    onChange={e => setCatalogModalSearch(e.target.value)}
                    className="erp-input w-full !pl-9 font-normal"
                  />
                </div>
                {isSearching && (
                  <button
                    type="button"
                    onClick={() => setCatalogModalSearch('')}
                    className="text-xs font-medium text-[var(--accent-primary)] hover:underline cursor-pointer"
                  >
                    Сбросить
                  </button>
                )}
              </div>

              {/* Контентная область */}
              <div className="flex-1 flex overflow-hidden">
                
                {/* Левая панель: Категории */}
                <div className="w-44 border-r border-[var(--border-primary)] bg-[var(--bg-table-header)] p-3 space-y-1 overflow-y-auto">
                  <span className="block text-[9px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-2 px-1">Категории</span>
                  {categories.map(cat => (
                    <button
                      type="button"
                      key={cat.id}
                      onClick={() => {
                        setCatalogModalCategory(cat.id)
                        setCatalogModalFolder(null)
                        setCatalogModalSearch('')
                      }}
                      className={`w-full text-left px-2.5 py-1.5 text-xs font-medium rounded transition-all cursor-pointer ${
                        activeCatId === cat.id
                          ? 'bg-[var(--accent-soft)] text-[var(--accent-text)] font-semibold'
                          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]'
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>

                {/* Правая панель: Папки и товары */}
                <div className="flex-1 p-4 overflow-y-auto space-y-4">
                  
                  {/* Хлебные крошки и заголовок */}
                  {!isSearching && (
                    <div className="flex items-center flex-wrap gap-1 text-[11px] text-[var(--text-tertiary)] font-normal bg-[var(--bg-surface-secondary)] p-2 rounded border border-[var(--border-primary)]">
                      <button
                        type="button"
                        onClick={() => setCatalogModalFolder(null)}
                        className="hover:text-[var(--accent-primary)] cursor-pointer"
                      >
                        {currentCategory?.name || 'Каталог'}
                      </button>
                      
                      {crumbs.map((crumb, cIdx) => (
                        <div key={crumb.id} className="flex items-center gap-1">
                          <ChevronRight className="h-3 w-3 text-[var(--text-tertiary)]" />
                          <button
                            type="button"
                            onClick={() => setCatalogModalFolder(crumb.id)}
                            className={`hover:text-[var(--accent-primary)] cursor-pointer ${
                              cIdx === crumbs.length - 1 ? 'text-[var(--text-primary)] font-medium' : ''
                            }`}
                          >
                            {crumb.name}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Очередь папок на текущем уровне */}
                  {!isSearching && activeFolders.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="block text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">Папки</span>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {activeFolders.map(folder => {
                          const getFolderIdsRecursive = (fId: string): string[] => {
                            const ids = [fId]
                            const subfolders = folders.filter(f => f.parentId === fId)
                            for (const sub of subfolders) {
                              ids.push(...getFolderIdsRecursive(sub.id))
                            }
                            return ids
                          }
                          const folderIds = getFolderIdsRecursive(folder.id)
                          const itemsCount = products.filter(p => p.folderId && folderIds.includes(p.folderId)).length
                          return (
                            <button
                              type="button"
                              key={folder.id}
                              onClick={() => setCatalogModalFolder(folder.id)}
                              className="flex items-center gap-2.5 p-2.5 bg-[var(--bg-surface)] border border-[var(--border-primary)] hover:bg-[var(--bg-surface-hover)] rounded-md transition text-left cursor-pointer group"
                            >
                              <div className="p-1.5 bg-[var(--accent-soft)] text-[var(--accent-primary)] rounded shrink-0">
                                <Folder className="h-3.5 w-3.5" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-medium text-[var(--text-primary)] truncate">
                                  {folder.name}
                                </div>
                                <div className="text-[10px] text-[var(--text-tertiary)] font-normal">
                                  {itemsCount} моделей
                                </div>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Список товаров */}
                  <div className="space-y-2">
                    <span className="block text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
                      {isSearching ? 'Результаты поиска' : 'Товары'}
                    </span>

                    {displayProducts.length === 0 ? (
                      <div className="p-6 text-center text-[var(--text-tertiary)] bg-[var(--bg-surface-secondary)] border border-[var(--border-primary)] rounded-md text-xs font-normal">
                        В этой папке пока нет товаров
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {displayProducts.map(product => (
                          <div
                            key={product.id}
                            className="bg-[var(--bg-surface)] border border-[var(--border-primary)] rounded-md overflow-hidden"
                          >
                            {/* Название товара */}
                            <div className="px-3 py-1.5 bg-[var(--bg-table-header)] border-b border-[var(--border-primary)] flex items-center justify-between">
                              <span className="text-xs font-semibold text-[var(--text-primary)]">{product.name}</span>
                              <span className="text-[10px] font-mono text-[var(--text-tertiary)]">
                                Базовый SKU: {product.baseSku}
                              </span>
                            </div>

                            {/* Его модификации (варианты) */}
                            <div className="divide-y divide-[var(--border-primary)]">
                              {product.variants.map(variant => (
                                <div
                                  key={variant.id}
                                  className="p-2.5 flex items-center justify-between gap-3 hover:bg-[var(--bg-table-row-hover)] transition"
                                >
                                  <div className="text-xs space-y-0.5">
                                    <div className="font-mono font-medium text-[var(--text-primary)]">{variant.sku}</div>
                                    <div className="text-[10px] text-[var(--text-secondary)] font-normal flex flex-wrap gap-x-2">
                                      {variant.size && <span>Размер: {variant.size}</span>}
                                      {variant.color && <span>Цвет: {variant.color}</span>}
                                      {(variant.thickness || variant.attributes?.tablePattern as string | undefined) && <span>Узор: {variant.thickness || variant.attributes?.tablePattern}</span>}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-3">
                                    <div className="text-right">
                                      <span className="block text-xs font-semibold text-[var(--text-primary)] font-mono">
                                        {(variant.salePrice / 100).toLocaleString('ru-RU')} ₽
                                      </span>
                                      <span className="block text-[8px] text-[var(--text-tertiary)] font-mono">
                                        Закупка: {(variant.purchasePrice / 100).toLocaleString('ru-RU')} ₽
                                      </span>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (selectingItemIndex !== null) {
                                          const prod = product
                                          const vr = variant
                                          const cat = categories.find(c => c.id === prod.categoryId)
                                          
                                          let defaultChairs: number | undefined = undefined
                                          let defaultSize: string | undefined = undefined
                                          
                                          if (cat?.slug === 'sets') {
                                            const matchChairs = prod.name.match(/(\d+)\s*стул/i) || vr.sku.match(/(\d+)C/i)
                                            defaultChairs = matchChairs ? parseInt(matchChairs[1], 10) : 4
                                            defaultSize = vr.size || ''
                                          } else if (cat?.slug === 'tables') {
                                            defaultSize = vr.size || ''
                                          }

                                          setOrderItemsList(prev => prev.map((item, idx) => {
                                            if (idx !== selectingItemIndex) return item
                                            return {
                                              ...item,
                                              productId: prod.id,
                                              variantId: vr.id,
                                              unitPrice: vr.salePrice / 100,
                                              customChairsCount: defaultChairs,
                                              customTableSize: defaultSize,
                                            }
                                          }))
                                        }
                                        
                                        // Закрываем модалку
                                        setSelectingItemIndex(null)
                                      }}
                                      className="erp-button-primary py-1 px-3 text-xs cursor-pointer"
                                    >
                                      Выбрать
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>

              </div>

            </div>
          </div>
        )
      })()}

      {/* Лайтбокс для увеличения фотографий */}
      {lightboxUrl && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 cursor-zoom-out animate-fade-in"
          onClick={() => setLightboxUrl(null)}
        >
          <div className="relative max-w-5xl max-h-[90vh] flex items-center justify-center">
            <button 
              className="absolute -top-12 right-0 p-2 text-white hover:text-white/80 cursor-pointer bg-white/10 rounded-full transition hover:scale-105"
              onClick={() => setLightboxUrl(null)}
            >
              <X className="h-6 w-6" />
            </button>
            <Image
              src={lightboxUrl}
              alt="Увеличенное изображение"
              width={1600}
              height={1200}
              unoptimized
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl cursor-default"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
      {/* Быстрое модальное окно смены статуса из таблицы */}
      {quickStatusModalOpen && quickStatusTarget && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--bg-overlay)] backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setQuickStatusModalOpen(false)
              setQuickStatusTarget(null)
            }
          }}
        >
          <div className="erp-modal-content max-w-md p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--border-primary)] pb-3">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Смена статуса: {quickStatusTarget.order.number ? `№${quickStatusTarget.order.number}` : `#${quickStatusTarget.order.id.slice(-6).toUpperCase()}`}
              </h3>
              <button 
                onClick={() => { setQuickStatusModalOpen(false); setQuickStatusTarget(null); }}
                className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-1">
                  Новый статус
                </label>
                <div>
                  <span className="erp-badge text-xs" data-status={quickStatusTarget.targetStatus}>
                    {STATUSES[quickStatusTarget.targetStatus]?.label}
                  </span>
                </div>
              </div>

              {quickStatusTarget.targetStatus === 'cancelled' && (
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-1">
                    Причина отмены заказа *
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Укажите причину отмены..."
                    value={quickStatusComment}
                    onChange={e => setQuickStatusComment(e.target.value)}
                    className="erp-input w-full text-xs"
                  />
                </div>
              )}

              {quickStatusTarget.targetStatus === 'delivery' && (
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-1">
                    Выберите водителя *
                  </label>
                  <select
                    required
                    value={quickStatusDriverId}
                    onChange={e => setQuickStatusDriverId(e.target.value)}
                    className="erp-input w-full text-xs font-medium"
                  >
                    <option value="">-- Выберите водителя --</option>
                    {drivers.map(d => (
                      <option key={d.id} value={d.id}>{d.fullName}</option>
                    ))}
                  </select>
                </div>
              )}

              {quickStatusTarget.targetStatus === 'delivered' && (
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-1">
                    Дата и время фактической доставки *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={quickStatusDeliveredAt}
                    onChange={e => setQuickStatusDeliveredAt(e.target.value)}
                    className="erp-input w-full text-xs"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-primary)]">
              <button
                type="button"
                onClick={() => { setQuickStatusModalOpen(false); setQuickStatusTarget(null); }}
                className="erp-button-secondary py-1.5 px-3 text-xs cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleConfirmQuickStatusChange}
                disabled={loading === 'quickStatus'}
                className="erp-button-primary py-1.5 px-3 text-xs cursor-pointer disabled:opacity-50"
              >
                {loading === 'quickStatus' ? 'Сохранение...' : 'Подтвердить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно: Пакетная отметка доставленных заказов списком из текста */}
      {batchModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--bg-overlay)] backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) setBatchModalOpen(false)
          }}
        >
          <div className="relative w-full max-w-4xl bg-[var(--bg-surface)] border border-[var(--border-primary)] rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* Заголовок */}
            <div className="flex h-13 items-center justify-between border-b border-[var(--border-primary)] bg-[var(--bg-table-header)] px-5">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-600">
                  <Truck className="h-4 w-4 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                    Пакетная отметка доставленных заказов
                  </h3>
                  <p className="text-[10px] text-[var(--text-tertiary)] font-normal">
                    Вставьте список номеров или скопированный отчет от водителя
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBatchModalOpen(false)}
                className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] rounded transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {batchSuccessMsg && (
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  {batchSuccessMsg}
                </div>
              )}

              {batchErrorMsg && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 text-xs font-semibold flex items-center gap-2">
                  <X className="h-4 w-4 shrink-0 text-red-500" />
                  {batchErrorMsg}
                </div>
              )}

              {/* Поля ввода: Список заказов и Выбор даты доставки */}
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="block text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider">
                    Вставьте списком номера заказов
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Вставьте номера заказов через запятую, пробел или из переписки.&#10;Пример: 74, 105, 118, 120&#10;Или скопированный отчёт: «Заказы №74, №105 и №118 доставлены»"
                    value={batchInputText}
                    onChange={e => {
                      const nextValue = e.target.value
                      setBatchInputText(nextValue)
                      setBatchMatchedOrders([])
                      setBatchNotFoundNumbers([])
                      setBatchLookupError('')
                      setBatchLookupLoading(extractBatchOrderNumbers(nextValue).length > 0)
                    }}
                    className="erp-input w-full font-mono text-xs p-3 leading-relaxed"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider">
                    Дата и время доставки
                  </label>
                  <input
                    type="datetime-local"
                    value={batchDeliveredAt}
                    onChange={e => setBatchDeliveredAt(e.target.value)}
                    className="erp-input w-full text-xs py-2"
                  />
                  <p className="text-[10px] text-[var(--text-tertiary)] leading-normal mt-1">
                    Укажите нужную дату для всей пачки. Если оставить пустым — проставится текущее время.
                  </p>
                </div>
              </div>

              {/* Результат разбора текста */}
              {(() => {
                const activeCount = batchMatchedOrders.filter(o => !batchUncheckedIds.has(o.id)).length

                return (
                  <div className="space-y-3">
                    {batchLookupLoading && (
                      <div className="text-xs text-[var(--text-secondary)]">
                        Проверяем номера по всему реестру заказов…
                      </div>
                    )}

                    {batchLookupError && (
                      <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-600">
                        {batchLookupError}
                      </div>
                    )}

                    {/* Статистика по распознанным заказам */}
                    {batchMatchedOrders.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-[var(--text-primary)]">
                            Распознано заказов в базе: {batchMatchedOrders.length} (К обновлению: {activeCount})
                          </span>
                          {batchUncheckedIds.size > 0 && (
                            <button
                              type="button"
                              onClick={() => setBatchUncheckedIds(new Set())}
                              className="text-[10px] text-[var(--accent-primary)] hover:underline cursor-pointer"
                            >
                              Выбрать все
                            </button>
                          )}
                        </div>

                        <div className="border border-[var(--border-primary)] rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="border-b border-[var(--border-primary)] bg-[var(--bg-table-header)] text-[var(--text-tertiary)] font-medium text-[10px] uppercase">
                                <th className="p-2.5 pl-3 w-8 text-center">✓</th>
                                <th className="p-2.5">Заказ</th>
                                <th className="p-2.5">Клиент</th>
                                <th className="p-2.5">Менеджер</th>
                                <th className="p-2.5">Текущий статус</th>
                                <th className="p-2.5 pr-3 text-right">Сумма</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border-primary)] text-[var(--text-primary)]">
                              {batchMatchedOrders.map(o => {
                                const isChecked = !batchUncheckedIds.has(o.id)
                                const isAlreadyDelivered = o.status === 'delivered'
                                return (
                                  <tr 
                                    key={o.id}
                                    onClick={() => {
                                      const next = new Set(batchUncheckedIds)
                                      if (isChecked) next.add(o.id)
                                      else next.delete(o.id)
                                      setBatchUncheckedIds(next)
                                    }}
                                    className={`cursor-pointer transition-colors ${isChecked ? 'bg-[var(--accent-soft)]/20' : 'opacity-60'}`}
                                  >
                                    <td className="p-2.5 pl-3 text-center" onClick={(e) => e.stopPropagation()}>
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={e => {
                                          const next = new Set(batchUncheckedIds)
                                          if (!e.target.checked) next.add(o.id)
                                          else next.delete(o.id)
                                          setBatchUncheckedIds(next)
                                        }}
                                        className="rounded cursor-pointer"
                                      />
                                    </td>
                                    <td className="p-2.5 font-mono font-bold">
                                      {o.number ? `№${o.number}` : `#${o.id.slice(-6).toUpperCase()}`}
                                    </td>
                                    <td className="p-2.5 font-medium">
                                      {o.client.fullName}
                                    </td>
                                    <td className="p-2.5 font-medium whitespace-nowrap">
                                      {o.seller?.fullName || 'Не назначен'}
                                    </td>
                                    <td className="p-2.5">
                                      <span 
                                        className="erp-badge py-0.5 px-2 text-[10px] rounded-full"
                                        data-status={o.status}
                                      >
                                        {isAlreadyDelivered ? 'Уже доставлен' : (STATUSES[o.status as keyof typeof STATUSES]?.label || o.status)}
                                      </span>
                                    </td>
                                    <td className="p-2.5 pr-3 text-right font-semibold whitespace-nowrap">
                                      {((o.totalPrice + o.deliveryPrice + o.assemblyPrice - o.discount) / 100).toLocaleString('ru-RU')} ₽
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Ненайденные номера */}
                    {batchNotFoundNumbers.length > 0 && (
                      <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-700 dark:text-amber-400 text-xs">
                        <span className="font-bold">⚠️ Не найдены заказы с номерами: </span>
                        <span>{batchNotFoundNumbers.join(', ')}</span>
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>

            {/* Подвал с кнопкой действия */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--border-primary)] bg-[var(--bg-table-header)]">
              <button
                type="button"
                onClick={() => setBatchModalOpen(false)}
                className="erp-button-secondary py-1.5 px-3 text-xs cursor-pointer"
              >
                Отмена
              </button>
              {(() => {
                const activeCount = batchMatchedOrders.filter(o => !batchUncheckedIds.has(o.id)).length
                return (
                  <button
                    type="button"
                    onClick={handleBatchSubmit}
                    disabled={batchLoading || batchLookupLoading || activeCount === 0}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
                  >
                    {batchLookupLoading ? (
                      <span>Проверяем номера…</span>
                    ) : batchLoading ? (
                      <span>Обновление заказов...</span>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Отметить ({activeCount}) как «Доставлен»</span>
                      </>
                    )}
                  </button>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно выбора фото из Яндекс.Диска */}
      <YandexDiskPickerModal
        isOpen={yandexPickerOpen}
        onClose={() => setYandexPickerOpen(false)}
        onSelectImage={(imageUrl) => handleSelectYandexDiskImage(imageUrl, yandexPickerSubOrderIdx)}
      />
    </div>
  )
}
