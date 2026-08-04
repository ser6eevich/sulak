'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  createOrderAction, 
  updateOrderAction,
  updateOrderStatusAction, 
  searchClientByPhoneAction,
  getOrderAuditLogsAction,
  deleteOrderAction,
  updateOrderFeedbackAction,
  updateOrderImageAction,
  batchUpdateOrdersDeliveredAction
} from './actions'
import { normalizeAddress } from '@/utils/address'
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
  RefreshCw,
  Paperclip,
  Clipboard,
  Pencil,
  Sparkles,
  CheckCircle2,
  Truck,
  Check
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
  totalPrice: number
  discount: number
  deliveryPrice: number
  assemblyPrice: number
  prepayment: number
  deliveryAddress: string | null
  comment: string | null
  createdAt: Date | string
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

export default function OrderManagement({ 
  initialOrders, 
  products,
  folders,
  categories,
  userRole,
  drivers,
  sellers,
  currentUserId
}: OrderManagementProps) {
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>(initialOrders)

  useEffect(() => {
    setOrders(initialOrders)
  }, [initialOrders])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState<string | null>(null)
  const [ordersPerPage, setOrdersPerPage] = useState(20)

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
  const [pasteTargetSubOrderIdx, setPasteTargetSubOrderIdx] = useState<number | null>(null)
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

  // Функция парсинга совпадений номеров заказов
  const parseMatchedOrders = () => {
    if (!batchInputText.trim()) return { foundOrders: [], notFoundTokens: [] }

    const rawTokens = Array.from(new Set(
      batchInputText
        .replace(/[№#]/g, ' ')
        .split(/[\s,;\n\t]+/)
        .map(t => t.trim())
        .filter(Boolean)
    ))

    const foundOrders: Order[] = []
    const foundKeys = new Set<string>()
    const notFoundTokens: string[] = []

    for (const token of rawTokens) {
      const cleanToken = token.replace(/^0+/, '')
      const matched = orders.find(o => {
        const num = o.number ? String(o.number) : ''
        const shortId = o.id.slice(-6).toUpperCase()
        return num === cleanToken || num === token || shortId === token.toUpperCase() || o.id === token
      })

      if (matched) {
        if (!foundKeys.has(matched.id)) {
          foundKeys.add(matched.id)
          foundOrders.push(matched)
        }
      } else {
        if (/^\d+$/.test(cleanToken)) {
          notFoundTokens.push(token)
        }
      }
    }

    return { foundOrders, notFoundTokens }
  }

  const handleBatchSubmit = async () => {
    const { foundOrders } = parseMatchedOrders()
    const targetOrders = foundOrders.filter(o => !batchUncheckedIds.has(o.id))

    if (targetOrders.length === 0) {
      setBatchErrorMsg('Нет выбранных заказов для обновления')
      return
    }

    setBatchLoading(true)
    setBatchErrorMsg('')
    setBatchSuccessMsg('')

    const idsToUpdate = targetOrders.map(o => o.id)
    const res = await batchUpdateOrdersDeliveredAction(idsToUpdate, batchDeliveredAt || null)
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
          setCreateModalOpen(false)
          resetOrderForm()
        } else if (selectedOrder) {
          closeOrderDetails()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [quickStatusModalOpen, selectingItemIndex, createModalOpen, selectedOrder])
  const [errorMsg, setErrorMsg] = useState('')

  // Фото по подзаказам при создании заказа: { subOrderIndex: url }
  const [subOrderImages, setSubOrderImages] = useState<Record<number, string>>({})
  const [imageUploading, setImageUploading] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)

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
      // Просмотр/редактирование заказа
      if (selectedOrder && pasteTargetSubOrderIdx !== null) {
        const items = Array.from(e.clipboardData?.items || [])
        const imageItem = items.find(i => i.type.startsWith('image/'))
        if (imageItem) {
          e.preventDefault()
          const blob = imageItem.getAsFile()
          if (blob) {
            const ext = imageItem.type.split('/')[1] || 'png'
            uploadImageBlob(blob, `clipboard-paste.${ext}`, pasteTargetSubOrderIdx)
            setPasteTargetSubOrderIdx(null)
          }
        }
      }
    }

    window.addEventListener('paste', handleGlobalPaste)
    return () => window.removeEventListener('paste', handleGlobalPaste)
  }, [createModalOpen, pasteTargetCreateSubIdx, selectedOrder, pasteTargetSubOrderIdx])

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
  const openOrderDetails = async (order: Order) => {
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
  const closeOrderDetails = () => {
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
      openOrderDetails(match)
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
  const resetOrderForm = () => {
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
      status: isRetroactive ? customStatus : 'pending',
      paymentStatus: isRetroactive ? customPaymentStatus : 'unpaid',
      plannedDeliveryDate: plannedDeliveryDate ? new Date(plannedDeliveryDate).toISOString() : null,
      // Собираем JSON из словаря фото: если одно фото - просто URL, если несколько - JSON
      imageUrl: (() => {
        const keys = Object.keys(subOrderImages)
        if (keys.length === 0) return null
        if (keys.length === 1 && keys[0] === '0') return subOrderImages[0]
        return JSON.stringify(Object.fromEntries(keys.map(k => [k, subOrderImages[Number(k)]])))
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
    
    // Подтягиваем имеющиеся фото комплекта
    if (order.imageUrl) {
      try {
        const parsed = JSON.parse(order.imageUrl)
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          setSubOrderImages(parsed)
        } else {
          setSubOrderImages({ 0: order.imageUrl })
        }
      } catch {
        setSubOrderImages({ 0: order.imageUrl })
      }
    } else {
      setSubOrderImages({})
    }

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
  const handleCreateImageUpload = async (file: File | Blob, fileName: string, subIdx: number) => {
    setImageUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file instanceof File ? file : new File([file], fileName, { type: file.type }))
      const res = await fetch('/api/upload-image', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok || data.error) {
        alert(data.error || 'Ошибка загрузки')
      } else if (data.imageUrl) {
        setSubOrderImages(prev => ({ ...prev, [subIdx]: data.imageUrl }))
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка загрузки')
    } finally {
      setImageUploading(false)
    }
  }

  // Вставка фото из буфера обмена при создании заказа
  const handleCreateImagePaste = async (subIdx: number) => {
    // Сначала пробуем через Clipboard API (работает в Chrome/Firefox с разрешением)
    try {
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
    } catch {
      // Clipboard API недоступен — ожидаем глобальный paste-event
    }
    // Fallback: активируем режим ожидания Ctrl+V / ⌘+V
    setPasteTargetCreateSubIdx(subIdx)
    alert('Нажмите Ctrl+V (⌘+V) чтобы вставить изображение из буфера обмена')
  }

  // Вспомогательная функция: парсим imageUrl (может быть JSON с картами по подзаказам или просто URL)
  const parseOrderImages = (imageUrl: string | null | undefined): Record<string, string> => {
    if (!imageUrl) return {}
    try {
      const parsed = JSON.parse(imageUrl)
      if (typeof parsed === 'object' && !Array.isArray(parsed)) return parsed
    } catch {
      // Старый формат: просто строка URL — относим к подзаказу 0
      return { '0': imageUrl }
    }
    return {}
  }

  // Загрузка файла/blob для существующего заказа (через FormData, без base64)
  const uploadImageBlob = async (blob: Blob, fileName: string, subOrderIndex: number | null): Promise<void> => {
    if (!selectedOrder) return
    setLoading('image')
    try {
      const formData = new FormData()
      formData.append('file', blob instanceof File ? blob : new File([blob], fileName, { type: blob.type }))
      const res = await fetch('/api/upload-image', { method: 'POST', body: formData })
      const uploadData = await res.json()
      if (!res.ok || uploadData.error) {
        alert(uploadData.error || 'Ошибка загрузки')
        setLoading(null)
        return
      }
      if (uploadData.imageUrl) {
        const updateRes = await updateOrderImageAction(selectedOrder.id, uploadData.imageUrl, subOrderIndex)
        setLoading(null)
        if (updateRes.error) {
          alert(updateRes.error)
        } else if (updateRes.imageUrl !== undefined) {
          setSelectedOrder(prev => prev ? { ...prev, imageUrl: updateRes.imageUrl } : null)
          setOrders(prev => prev.map(o => o.id === selectedOrder.id ? { ...o, imageUrl: updateRes.imageUrl } : o))
        }
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка загрузки')
      setLoading(null)
    }
  }

  // Обновление фото для существующего заказа (без подзаказа — главное фото)
  const handleUpdateExistingOrderImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedOrder) return
    const file = e.target.files?.[0]
    if (!file) return
    await uploadImageBlob(file, file.name, null)
  }

  // Загрузка фото конкретного подзаказа
  const handleSubOrderImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, subOrderIndex: number) => {
    if (!selectedOrder) return
    const file = e.target.files?.[0]
    if (!file) return
    await uploadImageBlob(file, file.name, subOrderIndex)
  }

  // Вставка фото из буфера обмена для конкретного подзаказа
  const handleSubOrderImagePaste = async (subOrderIndex: number) => {
    if (!selectedOrder) return
    // Сначала пробуем через Clipboard API
    try {
      const clipboardItems = await navigator.clipboard.read()
      for (const item of clipboardItems) {
        const imageType = item.types.find(t => t.startsWith('image/'))
        if (imageType) {
          const blob = await item.getType(imageType)
          const ext = imageType.split('/')[1] || 'png'
          await uploadImageBlob(blob, `clipboard-paste.${ext}`, subOrderIndex)
          return
        }
      }
    } catch {
      // Clipboard API недоступен — ожидаем глобальный paste-event
    }
    // Fallback: активируем режим ожидания Ctrl+V / ⌘+V
    setPasteTargetSubOrderIdx(subOrderIndex)
    alert('Нажмите Ctrl+V (⌘+V) чтобы вставить изображение из буфера обмена')
  }

  // Удаление фото конкретного подзаказа
  const handleDeleteSubOrderImage = async (subOrderIndex: number) => {
    if (!selectedOrder) return
    if (!confirm('Удалить фото этого подзаказа?')) return
    setLoading('image')
    const updateRes = await updateOrderImageAction(selectedOrder.id, null, subOrderIndex)
    setLoading(null)
    if (updateRes.error) {
      alert(updateRes.error)
    } else if (updateRes.imageUrl !== undefined) {
      setSelectedOrder(prev => prev ? { ...prev, imageUrl: updateRes.imageUrl } : null)
      setOrders(prev => prev.map(o => o.id === selectedOrder.id ? { ...o, imageUrl: updateRes.imageUrl } : o))
    }
  }

  // Удаление фото для существующего заказа
  const handleDeleteExistingOrderImage = async () => {
    if (!selectedOrder) return
    if (!confirm('Вы уверены, что хотите удалить изображение этого заказа?')) return

    setLoading('image')
    const updateRes = await updateOrderImageAction(selectedOrder.id, null)
    setLoading(null)

    if (updateRes.error) {
      alert(updateRes.error)
    } else {
      setSelectedOrder(prev => prev ? { ...prev, imageUrl: null } : null)
      setOrders(prev => prev.map(o => o.id === selectedOrder.id ? { ...o, imageUrl: null } : o))
    }
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

  // Фильтрация и поиск заказов
  const filteredOrders = orders.filter(order => {
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter
    
    const shortId = order.id.slice(-6).toUpperCase()
    const matchesSearch = 
      (order.number && order.number.toString().includes(search)) ||
      shortId.includes(search.toUpperCase()) ||
      order.client.fullName.toLowerCase().includes(search.toLowerCase()) ||
      order.client.primaryPhone.includes(search) ||
      (order.client.additionalPhone && order.client.additionalPhone.includes(search))
      
    return matchesStatus && matchesSearch
  })

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

  const totalPages = Math.ceil(sortedOrders.length / ordersPerPage)
  const paginatedOrders = sortedOrders.slice((currentPage - 1) * ordersPerPage, currentPage * ordersPerPage)

  // Быстрые статистики для панели сверху
  const totalActive = orders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled').length
  const totalDelivered = orders.filter(o => o.status === 'delivered').length
  const totalSum = orders.reduce((sum, o) => sum + (o.status !== 'cancelled' ? (o.totalPrice + o.deliveryPrice + o.assemblyPrice - o.discount) : 0), 0) / 100

  return (
    <div className="space-y-4 min-w-0 max-w-full overflow-hidden">
      {/* Сводная статистика */}
      {/* Сводная статистика */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="erp-card p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Активные заказы</p>
            <h3 className="text-xl font-semibold text-[var(--text-primary)] mt-0.5">{totalActive} шт</h3>
          </div>
          <div className="h-9 w-9 rounded-md bg-[var(--accent-soft)] text-[var(--accent-primary)] flex items-center justify-center font-medium text-xs">
            {totalActive}
          </div>
        </div>

        <div className="erp-card p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Выполнено заказов</p>
            <h3 className="text-xl font-semibold text-[var(--success)] mt-0.5">{totalDelivered} шт</h3>
          </div>
          <div className="h-9 w-9 rounded-md bg-[var(--success-soft)] text-[var(--success)] flex items-center justify-center font-medium text-xs">
            {totalDelivered}
          </div>
        </div>

        <div className="erp-card p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Сумма активных заказов</p>
            <h3 className="text-xl font-semibold text-[var(--text-primary)] mt-0.5">
              {totalSum.toLocaleString('ru-RU')} ₽
            </h3>
          </div>
          <div className="h-9 w-9 rounded-md bg-[var(--accent-soft)] text-[var(--accent-primary)] flex items-center justify-center font-medium text-xs">
            ₽
          </div>
        </div>
      </div>

      {/* Панель фильтров и добавления */}
      <div className="flex flex-col gap-3 erp-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2.5 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-tertiary)] pointer-events-none z-10" />
            <input
              type="text"
              placeholder="Поиск по ФИО, телефону, № заказа..."
              value={search}
              onChange={e => {
                setSearch(e.target.value)
                setCurrentPage(1)
              }}
              className="erp-input w-full !pl-9 font-normal"
            />
          </div>

          {/* Фильтр по статусу выполнения */}
          <select
            value={statusFilter}
            onChange={e => {
              setStatusFilter(e.target.value)
              setCurrentPage(1)
            }}
            className="erp-input font-medium cursor-pointer"
          >
            <option value="all">Все статусы выполнения ({orders.length})</option>
            {Object.entries(STATUSES).map(([key, value]) => {
              const count = orders.filter(o => o.status === key).length
              return (
                <option key={key} value={key}>{value.label} ({count})</option>
              )
            })}
          </select>
        </div>

        {['admin', 'owner', 'manager', 'logistician'].includes(userRole) && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setBatchInputText('')
                setBatchErrorMsg('')
                setBatchSuccessMsg('')
                setBatchUncheckedIds(new Set())
                setBatchModalOpen(true)
              }}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-700 dark:text-emerald-400 border border-emerald-600/20 text-xs font-semibold rounded-md transition-colors cursor-pointer"
              title="Отметить доставленные заказы списком из текста"
            >
              <Truck className="h-4 w-4 text-emerald-600" />
              <span>Пакетная доставка</span>
            </button>

            {['admin', 'owner', 'manager'].includes(userRole) && (
              <button
                onClick={() => {
                  resetOrderForm()
                  setCreateModalOpen(true)
                }}
                className="erp-button-primary inline-flex items-center justify-center gap-1.5 cursor-pointer text-xs"
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
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[var(--border-primary)] text-[var(--text-tertiary)] font-medium uppercase text-[10px] tracking-wider bg-[var(--bg-table-header)]">
                <th className="p-4 pl-6">Заказ ID</th>
                <th className="p-4">Дата</th>
                <th className="p-4">Клиент</th>
                <th className="p-4 whitespace-nowrap">Сумма заказа</th>
                <th className="p-4">Телефоны</th>
                <th className="p-4 pr-6">Статус</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-primary)] text-[var(--text-primary)] font-normal">
              {paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-[var(--text-tertiary)] font-normal">
                    Заказы не найдены
                  </td>
                </tr>
              ) : (
                paginatedOrders.map(order => {
                  const shortId = order.id.slice(-6).toUpperCase()
                  const grandTotalCents = order.totalPrice + order.deliveryPrice + order.assemblyPrice - order.discount
                  return (
                    <tr 
                      key={order.id} 
                      onClick={() => openOrderDetails(order)}
                      className="hover:bg-[var(--bg-table-row-hover)] cursor-pointer transition-colors"
                    >
                      <td className="p-3.5 pl-6 font-mono font-semibold text-[var(--text-primary)]">
                        {order.number ? `№${order.number}` : `#${shortId}`}
                      </td>
                      <td className="p-3.5 text-[var(--text-tertiary)]">
                        <div>{new Date(order.createdAt).toLocaleDateString('ru-RU')}</div>
                        {order.plannedDeliveryDate && (
                          <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--accent-primary)] bg-[var(--accent-soft)] px-1.5 py-0.5 rounded">
                            📅 {new Date(order.plannedDeliveryDate).toLocaleDateString('ru-RU')}
                          </div>
                        )}
                      </td>
                      <td className="p-3.5">
                        <div className="font-medium text-[var(--text-primary)]">{order.client.fullName}</div>
                      </td>
                      <td className="p-3.5 whitespace-nowrap font-semibold text-[var(--text-primary)]">
                        {(grandTotalCents / 100).toLocaleString('ru-RU')} ₽
                      </td>
                      <td className="p-3.5 text-[var(--text-secondary)] font-mono text-[11px]">
                        <div>{order.client.primaryPhone}</div>
                        {order.client.additionalPhone && (
                          <div className="text-[var(--text-tertiary)] text-[10px]">{order.client.additionalPhone}</div>
                        )}
                      </td>
                      <td className="p-3.5 pr-6" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={order.status}
                          onChange={(e) => handleDirectStatusChange(order, e.target.value)}
                          className="erp-badge cursor-pointer outline-none font-medium py-1 px-2.5 rounded-full transition-all hover:opacity-85"
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
        {filteredOrders.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-[var(--border-primary)] bg-[var(--bg-table-header)] px-6 py-3">
            <div className="flex items-center gap-4">
              <div className="text-[var(--text-tertiary)] text-xs font-normal">
                Показано {(currentPage - 1) * ordersPerPage + 1} - {Math.min(currentPage * ordersPerPage, filteredOrders.length)} из {filteredOrders.length}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] font-normal">
                <span>Показывать по:</span>
                <select
                  value={ordersPerPage}
                  onChange={e => {
                    setOrdersPerPage(Number(e.target.value))
                    setCurrentPage(1)
                  }}
                  className="erp-input px-2 py-1 text-xs font-medium cursor-pointer"
                >
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                  <option value={20}>20</option>
                </select>
              </div>
            </div>
            
            {totalPages > 1 && (
              <div className="flex gap-1">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  className="erp-button-secondary px-2.5 py-1 text-xs cursor-pointer disabled:opacity-50"
                >
                  Назад
                </button>
                {Array.from({ length: totalPages }).map((_, idx) => {
                  const page = idx + 1
                  if (totalPages > 5 && Math.abs(page - currentPage) > 1 && page !== 1 && page !== totalPages) {
                    if (page === 2 || page === totalPages - 1) {
                      return <span key={page} className="px-2 py-1 text-[var(--text-tertiary)] text-xs font-medium">...</span>
                    }
                    return null
                  }
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
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
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  className="erp-button-secondary px-2.5 py-1 text-xs cursor-pointer disabled:opacity-50"
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--bg-overlay)] backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeOrderDetails()
          }}
        >
          <div className="relative w-full max-w-5xl h-[85vh] max-h-[85vh] bg-[var(--bg-surface)] border border-[var(--border-primary)] rounded-lg shadow-md overflow-hidden flex flex-col">
            <div className="flex h-12 items-center justify-between border-b border-[var(--border-primary)] bg-[var(--bg-table-header)] px-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)]">
                Информация о заказе {selectedOrder.number ? `№${selectedOrder.number}` : `#${selectedOrder.id.slice(-6).toUpperCase()}`}
              </h3>
              <div className="flex items-center gap-2">
                {['admin', 'owner', 'manager'].includes(userRole) && (
                  <button
                    onClick={() => openEditOrderModal(selectedOrder)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded bg-[var(--accent-primary)] text-white hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
                    title="Редактировать состав и данные заказа"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    <span>Редактировать</span>
                  </button>
                )}
                {['admin', 'owner'].includes(userRole) && (
                  <button
                    onClick={handleDeleteOrder}
                    disabled={loading === 'delete'}
                    className="p-1 text-[var(--text-tertiary)] hover:text-[var(--danger)] hover:bg-[var(--danger-soft)] rounded transition-colors cursor-pointer disabled:opacity-50"
                    title="Удалить заказ"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={closeOrderDetails}
                  className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] rounded transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 grid gap-4 md:grid-cols-3">
              {/* Левая колонка: Реквизиты и Позиции */}
              <div className="md:col-span-2 space-y-4">
                {/* Реквизиты клиента */}
                <div className="bg-[var(--bg-surface-secondary)] border border-[var(--border-primary)] rounded-md p-3 space-y-2">
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
                      <div className="sm:col-span-2 flex items-start gap-1">
                        <span className="text-[var(--text-tertiary)] whitespace-nowrap">Адрес доставки: </span>
                        <span className="font-semibold text-[var(--text-primary)] flex items-center gap-1">
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
                        <span className="flex items-center gap-1 font-semibold text-[var(--accent-primary)] bg-[var(--accent-soft)] px-2 py-0.5 rounded">
                          📅 Желаемая дата доставки: {new Date(selectedOrder.plannedDeliveryDate).toLocaleDateString('ru-RU')}
                        </span>
                      )}
                      <span className="font-semibold text-[var(--text-primary)]">
                        💼 Продавец: {selectedOrder.seller?.fullName || selectedOrder.creator.fullName}
                      </span>
                      {selectedOrder.seller && selectedOrder.seller.fullName !== selectedOrder.creator.fullName && (
                        <span className="text-[var(--text-tertiary)]">(Оформил: {selectedOrder.creator.fullName})</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Изображение комплекта — аккуратная компактная галерея превью */}
                {(() => {
                  const imagesMap = parseOrderImages(selectedOrder.imageUrl)
                  const uniqueSubIdxs = Array.from(new Set(selectedOrder.items.map(i => i.subOrderIndex || 0))).sort((a, b) => a - b)
                  const hasMultipleSubOrders = uniqueSubIdxs.length > 1
                  const canEditPhotos = ['admin', 'owner', 'manager'].includes(userRole)

                  return (
                    <div className="bg-[var(--bg-surface-secondary)] border border-[var(--border-primary)] rounded-lg p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-xs text-[var(--text-primary)] flex items-center gap-1.5 uppercase tracking-wider">
                          <Paperclip className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                          Фото комплекта ({uniqueSubIdxs.filter(i => !!imagesMap[String(i)]).length}/{uniqueSubIdxs.length})
                        </h4>
                        <span className="text-[10px] text-[var(--text-tertiary)]">Нажмите на фото для просмотра</span>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        {uniqueSubIdxs.map((subIdx, idx) => {
                          const subPhoto = imagesMap[String(subIdx)]
                          return (
                            <div key={subIdx} className="bg-[var(--bg-surface)] border border-[var(--border-primary)] rounded-lg p-2 flex flex-col items-center gap-1.5 shadow-xs relative group">
                              <span className="text-[9px] font-semibold text-[var(--text-tertiary)] uppercase tracking-tight">
                                {hasMultipleSubOrders ? `Подзаказ ${idx + 1}` : 'Комплект'}
                              </span>

                              {subPhoto ? (
                                <div className="relative h-24 w-28 rounded-md overflow-hidden border border-[var(--border-primary)] bg-[var(--bg-surface-secondary)] flex items-center justify-center">
                                  <img
                                    src={subPhoto}
                                    alt={hasMultipleSubOrders ? `Комплект заказа ${idx + 1}` : 'Комплект'}
                                    className="h-full w-full object-cover cursor-zoom-in transition-transform duration-200 group-hover:scale-105"
                                    onClick={() => setLightboxUrl(subPhoto)}
                                  />
                                  <div 
                                    className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-zoom-in"
                                    onClick={() => setLightboxUrl(subPhoto)}
                                  >
                                    <Eye className="h-5 w-5 text-white drop-shadow" />
                                  </div>
                                  
                                  {canEditPhotos && (
                                    <div className="absolute top-1 right-1 flex gap-1 bg-black/60 p-0.5 rounded backdrop-blur-xs">
                                      <label
                                        htmlFor={`update-image-input-${subIdx}`}
                                        title="Заменить фото"
                                        className="p-1 hover:bg-white/20 text-white rounded transition-colors cursor-pointer select-none"
                                      >
                                        <RefreshCw className="h-3 w-3" />
                                      </label>
                                      
                                      <button
                                        type="button"
                                        title="Удалить фото"
                                        disabled={loading === 'image'}
                                        onClick={() => handleDeleteSubOrderImage(subIdx)}
                                        className="p-1 hover:bg-red-500/50 text-white rounded transition-colors cursor-pointer disabled:opacity-50"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="flex flex-col items-center justify-center border border-dashed border-[var(--border-strong)] rounded-md bg-[var(--bg-surface-secondary)] h-24 w-28 p-2 text-center">
                                  <p className="text-[10px] text-[var(--text-tertiary)] mb-1">Нет фото</p>
                                  {canEditPhotos && (
                                    <div className="flex flex-col gap-1 w-full">
                                      <label
                                        htmlFor={`update-image-input-${subIdx}`}
                                        className="inline-flex items-center justify-center gap-1 py-1 bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] text-[9px] font-semibold rounded border border-[var(--border-primary)] cursor-pointer select-none transition-colors"
                                      >
                                        <Paperclip className="h-2.5 w-2.5" />
                                        Файл
                                      </label>
                                      <button
                                        type="button"
                                        onClick={() => handleSubOrderImagePaste(subIdx)}
                                        disabled={loading === 'image'}
                                        className="inline-flex items-center justify-center gap-1 py-1 bg-[#4B63FF]/10 hover:bg-[#4B63FF]/20 text-[#4B63FF] text-[9px] font-semibold rounded transition-colors cursor-pointer disabled:opacity-50"
                                      >
                                        <Clipboard className="h-2.5 w-2.5" />
                                        Вставить
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}

                              {canEditPhotos && (
                                <input
                                  type="file"
                                  accept="image/*"
                                  id={`update-image-input-${subIdx}`}
                                  className="hidden"
                                  onChange={(e) => handleSubOrderImageUpload(e, subIdx)}
                                  disabled={loading === 'image'}
                                />
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}

                {/* Позиции заказа */}
                <div className="space-y-4">
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
                        const hasMultipleSubOrders = groupedDetailsItems.size > 1
                        const canEditPhotos = ['admin', 'owner', 'manager'].includes(userRole)

                        return (
                          <div key={subIdx} className="space-y-3 border border-[var(--border-primary)] rounded-lg overflow-hidden p-4 bg-[var(--bg-surface-secondary)]">
                            <h5 className="font-semibold text-xs text-[var(--text-primary)] uppercase tracking-wider">
                              Заказ {idx + 1}
                            </h5>
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="border-b border-[var(--border-primary)] text-[var(--text-tertiary)] font-medium bg-[var(--bg-table-header)]">
                                  <th className="p-3 pl-0">Товар / Вариант</th>
                                  <th className="p-3">Артикул (SKU)</th>
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
                                          🪑 Стульев в комплекте: {item.customChairsCount} шт
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
                <div className="space-y-3">
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
              <div className="space-y-6 border-t md:border-t-0 md:border-l border-[var(--border-primary)] md:pl-6 pt-6 md:pt-0">
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--bg-overlay)] backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setCreateModalOpen(false)
              resetOrderForm()
            }
          }}
        >
          <div className="relative w-full max-w-5xl h-[85vh] max-h-[85vh] bg-[var(--bg-surface)] border border-[var(--border-primary)] rounded-lg shadow-md overflow-hidden flex flex-col">
            <div className="flex h-12 items-center justify-between border-b border-[var(--border-primary)] bg-[var(--bg-table-header)] px-4">
              <h3 className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider">
                {editingOrderId 
                  ? `Редактирование заказа ${selectedOrder?.number ? `№${selectedOrder.number}` : ''}` 
                  : 'Оформление нового заказа'}
              </h3>
              <button
                onClick={() => { setCreateModalOpen(false); resetOrderForm() }}
                className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] rounded transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-4 space-y-4 overflow-y-auto flex-1 grid gap-4 md:grid-cols-3">
                {/* Левая часть: данные клиента и позиции */}
                <div className="md:col-span-2 space-y-4">
                  {errorMsg && (
                    <div className="p-3 text-xs bg-[var(--danger-soft)] border border-[var(--danger)]/20 text-[var(--danger)] font-medium rounded-md">
                      {errorMsg}
                    </div>
                  )}

                  {/* Блок клиента */}
                  <div className="p-3 bg-[var(--bg-surface-secondary)] rounded-md border border-[var(--border-primary)] space-y-3">
                    <h4 className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-1.5">
                      <User className="h-4 w-4 text-[var(--accent-primary)]" />
                      Клиент (Два телефона и регистрация)
                    </h4>
                    <div className="grid gap-2.5 sm:grid-cols-2 relative">
                      <div>
                        <label className="block text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                          Основной телефон клиента *
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
                          Дополнительный телефон клиента
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
                        <label className="block text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-1 flex items-center justify-between">
                          <span>Желаемая дата доставки (опционально)</span>
                          <span className="text-[var(--text-tertiary)] font-normal lowercase">(например, если нужно через пару месяцев)</span>
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
                          Продавец (Кто продал заказ) *
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
                          {subOrderImages[subIdx] ? (
                            <div className="space-y-1.5">
                              <img
                                src={subOrderImages[subIdx]}
                                alt={`Комплект заказа ${pos + 1}`}
                                className="w-full max-h-36 object-contain rounded-lg border border-[var(--border-primary)] bg-[var(--bg-surface)]"
                              />
                              <div className="flex gap-2">
                                <label
                                  htmlFor={`create-image-input-${subIdx}`}
                                  className="flex-1 text-center px-3 py-1 bg-[var(--bg-surface-secondary)] hover:bg-[var(--bg-surface-active)] text-[var(--text-secondary)] text-[10px] font-medium rounded-lg border border-[var(--border-primary)] cursor-pointer select-none transition-colors"
                                >
                                  Заменить
                                </label>
                                <button
                                  type="button"
                                  onClick={() => setSubOrderImages(prev => { const n = {...prev}; delete n[subIdx]; return n })}
                                  className="flex-1 px-3 py-1 text-red-600 hover:bg-red-50 text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                                >
                                  Удалить
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <label
                                htmlFor={`create-image-input-${subIdx}`}
                                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-[var(--bg-surface-secondary)] hover:bg-[var(--bg-surface-active)] text-[var(--text-secondary)] text-[10px] font-semibold rounded-md border border-[var(--border-primary)] cursor-pointer select-none transition-colors"
                              >
                                <Paperclip className="h-3 w-3" />
                                {imageUploading ? 'Загрузка...' : 'Загрузить фото'}
                              </label>
                              <button
                                type="button"
                                onClick={() => handleCreateImagePaste(subIdx)}
                                disabled={imageUploading}
                                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-[#4B63FF]/10 hover:bg-[#4B63FF]/20 text-[#4B63FF] text-[10px] font-semibold rounded-md transition-colors cursor-pointer disabled:opacity-50"
                              >
                                <Clipboard className="h-3 w-3" />
                                Вставить
                              </button>
                            </div>
                          )}
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
                            if (e.target.checked) {
                              setCustomCreatedAt(new Date().toISOString().slice(0, 16))
                              setCustomStatus('pending')
                              setCustomPaymentStatus('unpaid')
                              setCustomDeliveredAt(new Date().toISOString().slice(0, 16))
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
              <div className="p-4 border-t border-[var(--border-primary)] bg-[var(--bg-table-header)] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setCreateModalOpen(false); resetOrderForm() }}
                  className="erp-button-secondary cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={loading === 'create'}
                  className="erp-button-primary cursor-pointer disabled:opacity-50"
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
            <img
              src={lightboxUrl}
              alt="Увеличенное изображение"
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
          <div className="relative w-full max-w-2xl bg-[var(--bg-surface)] border border-[var(--border-primary)] rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
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
                    onChange={e => setBatchInputText(e.target.value)}
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
                const { foundOrders, notFoundTokens } = parseMatchedOrders()
                const activeCount = foundOrders.filter(o => !batchUncheckedIds.has(o.id)).length

                return (
                  <div className="space-y-3">
                    {/* Статистика по распознанным заказам */}
                    {foundOrders.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-[var(--text-primary)]">
                            Распознано заказов в базе: {foundOrders.length} (К обновлению: {activeCount})
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
                                <th className="p-2.5">Текущий статус</th>
                                <th className="p-2.5 pr-3 text-right">Сумма</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border-primary)] text-[var(--text-primary)]">
                              {foundOrders.map(o => {
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
                    {notFoundTokens.length > 0 && (
                      <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-700 dark:text-amber-400 text-xs">
                        <span className="font-bold">⚠️ Не найдены заказы с номерами: </span>
                        <span>{notFoundTokens.join(', ')}</span>
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
                const { foundOrders } = parseMatchedOrders()
                const activeCount = foundOrders.filter(o => !batchUncheckedIds.has(o.id)).length
                return (
                  <button
                    type="button"
                    onClick={handleBatchSubmit}
                    disabled={batchLoading || activeCount === 0}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
                  >
                    {batchLoading ? (
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
    </div>
  )
}
