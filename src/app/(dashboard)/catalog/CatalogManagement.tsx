'use client'

import { useState } from 'react'
import { 
  createProductWithVariantsAction, 
  updateProductWithVariantsAction,
  archiveProductAction,
  createFolderAction,
  deleteFolderAction
} from './actions'
import { 
  Plus, 
  Search, 
  Trash2, 
  X, 
  Grid, 
  Layers, 
  ChevronDown, 
  ChevronUp,
  Folder,
  FolderPlus,
  ArrowLeft,
  ArrowRight,
  Pencil,
  Copy,
  PackageOpen
} from 'lucide-react'

interface Category {
  id: string
  name: string
  slug: string
  sortOrder: number
}

interface ProductFolder {
  id: string
  categoryId: string
  parentId: string | null
  name: string
}

export interface CatalogAttributes {
  tableVariantId?: string
  tableSku?: string
  tableName?: string
  tableSize?: string
  tableColor?: string
  tablePattern?: string
  chairVariantId?: string
  chairSku?: string
  chairName?: string
  chairColor?: string
  chairQuantity?: number
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
  weight: unknown | null
  volume: unknown | null
  attributes: CatalogAttributes | null
}

interface VariantRow {
  id?: string | null
  sku: string
  size: string
  color: string
  material: string
  thickness: string
  purchasePrice: number | string
  salePrice: number | string
  weight: number | string
  volume: number | string
  isCustomSku: boolean
  attributes?: CatalogAttributes | null
}

interface ProductWithVariants {
  id: string
  name: string
  description: string | null
  baseSku: string
  unit: string
  trackInventory: boolean
  categoryId: string
  folderId: string | null
  variants: ProductVariant[]
  category: Category
}

interface CatalogManagementProps {
  categories: Category[]
  initialProducts: ProductWithVariants[]
  initialFolders: ProductFolder[]
  initialCategorySlug?: string
  initialFolderId?: string | null
  userRole?: string
}

const COLORS = [
  'Коричневый с золотом',
  'Слоновая кость с золотом',
  'Белый с серебром'
]

const PATTERNS = [
  'Мрамор',
  'Версаче',
  'Гладкий'
]

function createNewVariantRow(categorySlug: string) {
  return {
    id: null,
    sku: '',
    size: (categorySlug === 'chairs' || categorySlug === 'sofas') ? '' : '120/160x80',
    color: categorySlug === 'sofas' ? '' : COLORS[0],
    material: 'Золото/Серебро',
    thickness: (categorySlug !== 'chairs' && categorySlug !== 'sofas') ? 'Мрамор' : '',
    purchasePrice: 0,
    salePrice: 0,
    weight: 0,
    volume: 0,
    isCustomSku: false,
    attributes: null
  }
}

function generateSku(base: string, color: string, pattern: string, size: string) {
  if (!base) return ''
  
  const colorAbbr: Record<string, string> = {
    'Коричневый с золотом': 'BR-GLD',
    'Слоновая кость с золотом': 'IV-GLD',
    'Белый с серебром': 'WH-SLV'
  }

  const patternAbbr: Record<string, string> = {
    'Мрамор': 'MRB',
    'Версаче': 'VRC',
    'Гладкий': 'PLAIN'
  }

  const c = colorAbbr[color] || ''
  const p = patternAbbr[pattern] || ''
  const s = size ? size.replace(/[^a-zA-Z0-9]/g, '') : ''

  let sku = base.trim().toUpperCase()
  if (c) sku += `-${c}`
  if (p) sku += `-${p}`
  if (s) sku += `-${s}`
  
  return sku
}

export default function CatalogManagement({
  categories,
  initialProducts,
  initialFolders,
  initialCategorySlug,
  initialFolderId,
  userRole,
}: CatalogManagementProps) {
  const canEditCatalog = ['admin', 'owner'].includes(userRole || '')
  const [products, setProducts] = useState<ProductWithVariants[]>(initialProducts)
  const [folders, setFolders] = useState<ProductFolder[]>(initialFolders)
  const resolvedCategorySlug: string = initialCategorySlug && categories.some(category => category.slug === initialCategorySlug)
    ? initialCategorySlug
    : categories[0]?.slug || ''
  const resolvedFolderId = initialFolderId && initialFolders.some(folder => folder.id === initialFolderId)
    ? initialFolderId
    : null
  const [activeCategorySlug, setActiveCategorySlug] = useState(
    resolvedCategorySlug
  )
  
  // Текущая папка внутри категории (поддерживается в столах и комплектах)
  const [activeFolderId, setActiveFolderId] = useState<string | null>(
    resolvedFolderId
  )

  const updateUrlParams = (catSlug: string, fldId: string | null) => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      params.set('category', catSlug)
      if (fldId) {
        params.set('folder', fldId)
      } else {
        params.delete('folder')
      }
      window.history.replaceState(null, '', `?${params.toString()}`)
    }
  }
  
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState<string | null>(null)
  
  // Модалка выбора составляющих комплекта из каталога
  const [setsSelectOpen, setSetsSelectOpen] = useState(false)
  const [setsSelectType, setSetsSelectType] = useState<'table' | 'chair'>('table')
  const [setsSelectIndex, setSetsSelectIndex] = useState<number | null>(null)
  const [setsSelectFolderId, setSetsSelectFolderId] = useState<string | null>(null)
  const [setsSelectSearch, setSetsSelectSearch] = useState('')

  // Развернутые карточки товаров
  const [expandedProductIds, setExpandedProductIds] = useState<Set<string>>(new Set())

  // Поля модалки создания/редактирования
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [editProduct, setEditProduct] = useState<ProductWithVariants | null>(null)
  
  const [formName, setFormName] = useState('')
  const [formCategoryId, setFormCategoryId] = useState(categories[0]?.id || '')
  const [formFolderId, setFormFolderId] = useState<string>('')
  const [formDescription, setFormDescription] = useState('')
  const [formBaseSku, setFormBaseSku] = useState('')
  const [formUnit, setFormUnit] = useState('шт')
  const [formTrackInventory, setFormTrackInventory] = useState(true)
  
  // Модалка создания папки
  const [folderModalOpen, setFolderModalOpen] = useState(false)
  const [folderName, setFolderName] = useState('')

  // Список вариантов в форме
  const [variantsList, setVariantsList] = useState<VariantRow[]>([])
  const [errorMsg, setErrorMsg] = useState('')

  const selectedCategorySlug = categories.find(c => c.id === formCategoryId)?.slug || ''
  const supportsFolders = activeCategorySlug === 'tables' || activeCategorySlug === 'sets'
  const formSupportsFolders = selectedCategorySlug === 'tables' || selectedCategorySlug === 'sets'

  const activeCategoryId = categories.find(c => c.slug === activeCategorySlug)?.id || ''
  
  // Фильтруем папки по текущей категории и текущему уровню вложенности (activeFolderId)
  const categoryFolders = folders.filter(f => f.categoryId === activeCategoryId && f.parentId === activeFolderId)

  const getFolderOptions = (catId: string) => {
    const catFolders = folders.filter(f => f.categoryId === catId)
    const options: { id: string; label: string }[] = []
    const buildTree = (parentId: string | null, depth: number) => {
      const levelFolders = catFolders.filter(f => f.parentId === parentId)
      for (const folder of levelFolders) {
        options.push({
          id: folder.id,
          label: '— '.repeat(depth) + folder.name
        })
        buildTree(folder.id, depth + 1)
      }
    }
    buildTree(null, 0)
    return options
  }

  const getRecursiveFolderProductsCount = (folderId: string, catId: string) => {
    const subFolderIds = [folderId]
    const collectIds = (parentId: string) => {
      const children = folders.filter(f => f.parentId === parentId && f.categoryId === catId)
      for (const child of children) {
        subFolderIds.push(child.id)
        collectIds(child.id)
      }
    }
    collectIds(folderId)
    return products.filter(p => p.categoryId === catId && p.folderId && subFolderIds.includes(p.folderId)).length
  }

  const handleVariantFieldChange = (index: number, field: string, value: string | number | boolean | null) => {
    setVariantsList(prev => 
      prev.map((v, idx) => {
        if (idx !== index) return v
        
        let updated = { ...v, [field]: value }
        
        if (field === 'chairQuantity') {
          const attributes = { ...(v.attributes || {}) }
          attributes.chairQuantity = Number(value) || 6
          
          const material = attributes.chairVariantId 
            ? `${attributes.chairQuantity} шт — ${attributes.chairName}` 
            : v.material

          const tableColorAbbr: Record<string, string> = {
            'Коричневый с золотом': 'BR-GLD',
            'Слоновая кость с золотом': 'IV-GLD',
            'Белый с серебром': 'WH-SLV'
          }
          
          const patternAbbr: Record<string, string> = {
            'Мрамор': 'MRB',
            'Версаче': 'VRC',
            'Гладкий': 'PLAIN'
          }

          const cAbbr = tableColorAbbr[v.color] || ''
          const pAbbr = patternAbbr[v.thickness] || ''
          const sClean = v.size ? v.size.replace(/[^a-zA-Z0-9]/g, '') : ''

          let newSku = formBaseSku.trim().toUpperCase()
          if (cAbbr) newSku += `-${cAbbr}`
          if (pAbbr) newSku += `-${pAbbr}`
          if (sClean) newSku += `-${sClean}`
          newSku += `-${attributes.chairQuantity}C`

          updated = {
            ...v,
            material,
            sku: newSku,
            isCustomSku: false,
            attributes
          }
        }

        if (field === 'sku') {
          updated.isCustomSku = true
        }

        if (field === 'color' || field === 'size' || field === 'thickness') {
          updated.isCustomSku = false
        }

        if (!updated.isCustomSku && field !== 'chairQuantity') {
          const color = selectedCategorySlug === 'sofas' ? '' : (field === 'color' ? (value as string) : updated.color)
          const size = field === 'size' ? (value as string) : updated.size
          const pattern = (selectedCategorySlug !== 'chairs' && selectedCategorySlug !== 'sofas') ? (field === 'thickness' ? (value as string) : updated.thickness) : ''
          
          const attributes = { ...(v.attributes || {}) }
          if (attributes.tableVariantId) {
            attributes.tableSize = size
            attributes.tableColor = color
            attributes.tablePattern = pattern
          }
          if (attributes.chairVariantId) {
            attributes.chairColor = color
          }

          const tableColorAbbr: Record<string, string> = {
            'Коричневый с золотом': 'BR-GLD',
            'Слоновая кость с золотом': 'IV-GLD',
            'Белый с серебром': 'WH-SLV'
          }
          
          const patternAbbr: Record<string, string> = {
            'Мрамор': 'MRB',
            'Версаче': 'VRC',
            'Гладкий': 'PLAIN'
          }

          const cAbbr = tableColorAbbr[color] || ''
          const pAbbr = patternAbbr[pattern] || ''
          const sClean = size ? size.replace(/[^a-zA-Z0-9]/g, '') : ''

          let newSku = formBaseSku.trim().toUpperCase()
          if (cAbbr) newSku += `-${cAbbr}`
          if (pAbbr) newSku += `-${pAbbr}`
          if (sClean) newSku += `-${sClean}`
          if (attributes.chairQuantity) {
            newSku += `-${attributes.chairQuantity}C`
          }

          updated.sku = newSku
          updated.attributes = attributes
        }

        return updated
      })
    )
  }

  const addVariantRow = () => {
    setVariantsList(prev => {
      const newRow = createNewVariantRow(selectedCategorySlug)
      const color = selectedCategorySlug === 'sofas' ? '' : newRow.color
      const pattern = (selectedCategorySlug !== 'chairs' && selectedCategorySlug !== 'sofas') ? (newRow.thickness || '') : ''
      newRow.sku = generateSku(formBaseSku, color, pattern, newRow.size)
      return [...prev, newRow]
    })
  }

  const removeVariantRow = (index: number) => {
    if (variantsList.length <= 1) return
    setVariantsList(prev => prev.filter((_, idx) => idx !== index))
  }

  const toggleExpand = (productId: string) => {
    setExpandedProductIds(prev => {
      const next = new Set(prev)
      if (next.has(productId)) {
        next.delete(productId)
      } else {
        next.add(productId)
      }
      return next
    })
  }

  // Создать товар
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    if (variantsList.length === 0) {
      setErrorMsg('Добавьте хотя бы один вариант товара')
      return
    }

    setLoading('create')

    const formattedVariants = variantsList.map(v => ({
      sku: v.sku.trim(),
      size: v.size.trim() || null,
      color: v.color || null,
      material: selectedCategorySlug === 'chairs' ? v.material : null,
      thickness: (selectedCategorySlug !== 'chairs' && selectedCategorySlug !== 'sofas') ? v.thickness : null,
      purchasePrice: Number(v.purchasePrice) || 0,
      salePrice: Number(v.salePrice) || 0,
      weight: v.weight ? Number(v.weight) : null,
      volume: v.volume ? Number(v.volume) : null,
      attributes: v.attributes || null,
    }))

    const result = await createProductWithVariantsAction({
      name: formName.trim(),
      description: formDescription.trim() || null,
      categoryId: formCategoryId,
      folderId: formSupportsFolders && formFolderId ? formFolderId : null,
      baseSku: formBaseSku.trim().toUpperCase(),
      unit: formUnit,
      trackInventory: formTrackInventory,
    }, formattedVariants)

    setLoading(null)

    if (result.error) {
      setErrorMsg(result.error)
    } else {
      setAddModalOpen(false)
      window.location.reload()
    }
  }

  // Редактировать товар
  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editProduct) return
    setErrorMsg('')

    if (variantsList.length === 0) {
      setErrorMsg('Добавьте хотя бы один вариант товара')
      return
    }

    setLoading('edit')

    const formattedVariants = variantsList.map(v => ({
      id: v.id || null,
      sku: v.sku.trim(),
      size: v.size.trim() || null,
      color: v.color || null,
      material: selectedCategorySlug === 'chairs' ? v.material : null,
      thickness: (selectedCategorySlug !== 'chairs' && selectedCategorySlug !== 'sofas') ? v.thickness : null,
      purchasePrice: Number(v.purchasePrice) || 0,
      salePrice: Number(v.salePrice) || 0,
      weight: v.weight ? Number(v.weight) : null,
      volume: v.volume ? Number(v.volume) : null,
      attributes: v.attributes || null,
    }))

    const result = await updateProductWithVariantsAction(
      editProduct.id,
      {
        name: formName.trim(),
        description: formDescription.trim() || null,
        categoryId: formCategoryId,
        folderId: formSupportsFolders && formFolderId ? formFolderId : null,
        baseSku: formBaseSku.trim().toUpperCase(),
        unit: formUnit,
        trackInventory: formTrackInventory,
      },
      formattedVariants
    )

    setLoading(null)

    if (result.error) {
      setErrorMsg(result.error)
    } else {
      setEditProduct(null)
      window.location.reload()
    }
  }

  // Создать папку
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!folderName.trim()) return
    setLoading('folder')

    const result = await createFolderAction(activeCategoryId, folderName.trim(), activeFolderId)
    setLoading(null)

    if (result.error) {
      alert(result.error)
    } else {
      setFolderModalOpen(false)
      setFolderName('')
      window.location.reload()
    }
  }

  // Удалить папку
  const handleDeleteFolder = async (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Вы уверены, что хотите удалить эту папку? Модели внутри папки не удалятся, а перенесутся в корень этой категории.')) return
    
    const result = await deleteFolderAction(folderId)
    if (result.error) {
      alert(result.error)
    } else {
      setFolders(prev => prev.filter(f => f.id !== folderId))
      if (activeFolderId === folderId) {
        setActiveFolderId(null)
      }
      window.location.reload()
    }
  }

  // Архивировать товар
  const handleArchiveProduct = async (productId: string) => {
    if (!confirm('Вы уверены, что хотите перенести эту модель в архив? Все ее артикулы также перестанут отображаться.')) return
    setLoading(productId)

    const result = await archiveProductAction(productId)
    setLoading(null)

    if (result.error) {
      alert(result.error)
    } else {
      setProducts(prev => prev.filter(p => p.id !== productId))
    }
  }

  // Открыть модалку редактирования
  const openEditModal = (product: ProductWithVariants) => {
    setEditProduct(product)
    setFormName(product.name)
    setFormCategoryId(product.categoryId)
    setFormFolderId(product.folderId || '')
    setFormDescription(product.description || '')
    setFormBaseSku(product.baseSku)
    setFormUnit(product.unit)
    setFormTrackInventory(product.trackInventory)
    setErrorMsg('')
    
    // Преобразуем варианты из копеек в рубли
    const rows: VariantRow[] = product.variants.map(v => ({
      id: v.id,
      sku: v.sku,
      size: v.size || '',
      color: v.color || '',
      material: v.material || '',
      thickness: v.thickness || '',
      purchasePrice: v.purchasePrice / 100,
      salePrice: v.salePrice / 100,
      weight: v.weight ? Number(v.weight) : 0,
      volume: v.volume ? Number(v.volume) : 0,
      isCustomSku: true,
      attributes: v.attributes || null
    }))
    setVariantsList(rows)
  }

  // Открыть модалку создания копии товара
  const openCopyModal = (product: ProductWithVariants) => {
    setFormName(product.name)
    setFormCategoryId(product.categoryId)
    setFormFolderId(product.folderId || '')
    setFormDescription(product.description || '')
    setFormBaseSku(product.baseSku)
    setFormUnit(product.unit)
    setFormTrackInventory(product.trackInventory)
    setErrorMsg('')
    
    const rows: VariantRow[] = product.variants.map((v) => ({
      id: null,
      sku: v.sku,
      size: v.size || '',
      color: v.color || '',
      material: v.material || '',
      thickness: v.thickness || '',
      purchasePrice: v.purchasePrice / 100,
      salePrice: v.salePrice / 100,
      weight: v.weight ? Number(v.weight) : 0,
      volume: v.volume ? Number(v.volume) : 0,
      isCustomSku: false,
      attributes: v.attributes || null
    }))
    setVariantsList(rows)
    setAddModalOpen(true)
  }

  const handleBaseSkuChange = (newBase: string) => {
    setFormBaseSku(newBase)
    setVariantsList(prev => 
      prev.map((v) => {
        if (v.isCustomSku) return v
        const color = selectedCategorySlug === 'sofas' ? '' : v.color
        const pattern = (selectedCategorySlug !== 'chairs' && selectedCategorySlug !== 'sofas') ? (v.thickness || '') : ''
        const sku = generateSku(newBase, color, pattern, v.size)
        return { ...v, sku }
      })
    )
  }

  const handleSelectSetComponent = (variant: ProductVariant, product: ProductWithVariants) => {
    if (setsSelectIndex === null) return

    setVariantsList(prev => 
      prev.map((v, idx) => {
        if (idx !== setsSelectIndex) return v

        const attributes = { ...(v.attributes || {}) }
        
        if (setsSelectType === 'table') {
          attributes.tableVariantId = variant.id
          attributes.tableSku = variant.sku
          attributes.tableName = product.name
          attributes.tableSize = variant.size || ''
          attributes.tableColor = variant.color || ''
          attributes.tablePattern = variant.thickness || ''
        } else {
          attributes.chairVariantId = variant.id
          attributes.chairSku = variant.sku
          attributes.chairName = product.name
          attributes.chairColor = variant.color || ''
          attributes.chairQuantity = attributes.chairQuantity || 6
        }

        const size = attributes.tableSize || v.size
        const color = attributes.tableColor || v.color
        const thickness = attributes.tablePattern || v.thickness
        const material = attributes.chairVariantId 
          ? `${attributes.chairQuantity} шт — ${attributes.chairName}` 
          : v.material

        const tableColorAbbr: Record<string, string> = {
          'Коричневый с золотом': 'BR-GLD',
          'Слоновая кость с золотом': 'IV-GLD',
          'Белый с серебром': 'WH-SLV'
        }
        
        const patternAbbr: Record<string, string> = {
          'Мрамор': 'MRB',
          'Версаче': 'VRC',
          'Гладкий': 'PLAIN'
        }

        const cAbbr = tableColorAbbr[color] || ''
        const pAbbr = patternAbbr[thickness] || ''
        const sClean = size ? size.replace(/[^a-zA-Z0-9]/g, '') : ''

        let newSku = formBaseSku.trim().toUpperCase()
        if (cAbbr) newSku += `-${cAbbr}`
        if (pAbbr) newSku += `-${pAbbr}`
        if (sClean) newSku += `-${sClean}`
        if (attributes.chairQuantity) newSku += `-${attributes.chairQuantity}C`

        return {
          ...v,
          size,
          color,
          thickness,
          material,
          sku: newSku,
          isCustomSku: false,
          attributes
        }
      })
    )

    setSetsSelectOpen(false)
    setSetsSelectIndex(null)
    setSetsSelectSearch('')
    setSetsSelectFolderId(null)
  }

  const handleCategoryChange = (newCatId: string) => {
    setFormCategoryId(newCatId)
    const newSlug = categories.find(c => c.id === newCatId)?.slug || ''
    setFormFolderId('') // сбрасываем папку
    setVariantsList([createNewVariantRow(newSlug)])
  }

  // Фильтрация товаров по поиску, категории и ПАПКЕ
  const filteredProducts = products.filter(p => {
    const matchesCategory = p.categoryId === activeCategoryId
    
    // Если категория поддерживает папки, проверяем соответствие активной папке
    let matchesFolder = true
    if (supportsFolders) {
      matchesFolder = p.folderId === activeFolderId
    }

    const matchesSearch = 
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.baseSku.toLowerCase().includes(search.toLowerCase()) ||
      p.variants.some(v => v.sku.toLowerCase().includes(search.toLowerCase()))
    
    return matchesCategory && matchesFolder && matchesSearch
  })

  const activeCategory = categories.find(category => category.id === activeCategoryId)
  const activeCategoryProducts = products.filter(product => product.categoryId === activeCategoryId)
  const activeCategoryVariants = activeCategoryProducts.reduce((total, product) => total + product.variants.length, 0)
  const activeFolder = activeFolderId ? folders.find(folder => folder.id === activeFolderId) : null


  return (
    <div className="space-y-3">
      <section className="erp-card overflow-hidden">
        <div className="flex min-w-0 items-center gap-1 overflow-x-auto border-b border-[var(--border-primary)] px-3 py-2 scrollbar-none">
          {categories.map(cat => {
            const categoryCount = products.filter(product => product.categoryId === cat.id).length

            return (
              <button
                key={cat.id}
                type="button"
                aria-pressed={activeCategorySlug === cat.slug}
                onClick={() => {
                  setActiveCategorySlug(cat.slug)
                  setActiveFolderId(null)
                  updateUrlParams(cat.slug, null)
                }}
                className={`inline-flex min-h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-xs font-medium transition-colors ${
                  activeCategorySlug === cat.slug
                    ? 'bg-[var(--accent-soft)] text-[var(--accent-text)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]'
                }`}
              >
                {cat.name}
                <span className={`rounded-md px-1.5 py-0.5 text-[9px] tabular-nums ${
                  activeCategorySlug === cat.slug
                    ? 'bg-[var(--bg-surface)]/75 text-[var(--accent-primary)]'
                    : 'bg-[var(--bg-surface-hover)] text-[var(--text-tertiary)]'
                }`}>
                  {categoryCount}
                </span>
              </button>
            )
          })}
        </div>

        <div className="flex flex-col gap-3 px-4 py-3.5 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative min-w-0 flex-1 lg:max-w-[520px]">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" strokeWidth={1.8} />
            <input
              type="search"
              aria-label="Поиск моделей"
              placeholder="Название модели, базовый SKU или модификация"
              value={search}
              onChange={event => setSearch(event.target.value)}
              className="erp-input h-10 w-full !rounded-xl !pl-10 !pr-10"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Очистить поиск"
                className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {supportsFolders && canEditCatalog && (
              <button
                type="button"
                onClick={() => {
                  setFolderName('')
                  setFolderModalOpen(true)
                }}
                className="erp-button-secondary inline-flex min-h-10 items-center justify-center gap-2 !rounded-xl"
              >
                <FolderPlus className="h-4 w-4" strokeWidth={1.8} />
                {activeFolderId ? 'Создать подпапку' : 'Создать папку'}
              </button>
            )}

            {canEditCatalog && (
              <button
                type="button"
                onClick={() => {
                  setFormName('')
                  setFormDescription('')
                  setFormBaseSku('')
                  setFormUnit('шт')
                  setFormTrackInventory(true)
                  setFormCategoryId(activeCategoryId)
                  setFormFolderId(activeFolderId || '')
                  setErrorMsg('')
                  setVariantsList([createNewVariantRow(activeCategorySlug)])
                  setAddModalOpen(true)
                }}
                className="erp-button-primary inline-flex min-h-10 items-center justify-center gap-2 !rounded-xl"
              >
                <Plus className="h-4 w-4" strokeWidth={2} />
                Добавить модель
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-[var(--border-primary)] bg-[var(--bg-surface-hover)]/45 px-4 py-2 text-[10px] text-[var(--text-tertiary)]">
          <span><strong className="font-medium text-[var(--text-secondary)]">{activeCategory?.name || 'Категория'}</strong></span>
          <span>{activeCategoryProducts.length} моделей</span>
          <span>{activeCategoryVariants} SKU</span>
          {activeFolder && <span>Папка: <strong className="font-medium text-[var(--text-secondary)]">{activeFolder.name}</strong></span>}
        </div>
      </section>

      {/* Хлебные крошки, если провалились в папку */}
      {supportsFolders && activeFolderId && (() => {
        const breadcrumbs = []
        let current = folders.find(f => f.id === activeFolderId)
        while (current) {
          breadcrumbs.unshift(current)
          const pId = current.parentId
          current = pId ? folders.find(f => f.id === pId) : undefined
        }

        return (
          <div className="erp-card flex items-center justify-between px-4 py-2.5 text-xs font-medium text-[var(--text-secondary)]">
            <div className="flex items-center flex-wrap gap-2">
              <button 
                onClick={() => {
                  const currentCrumb = folders.find(f => f.id === activeFolderId)
                  const parentId = currentCrumb?.parentId || null
                  setActiveFolderId(parentId)
                  updateUrlParams(activeCategorySlug, parentId)
                }}
                className="flex items-center gap-1.5 hover:text-[var(--accent-primary)] transition-colors cursor-pointer mr-4 text-[var(--text-tertiary)]"
              >
                <ArrowLeft className="h-4 w-4" />
                Назад
              </button>
              
              <button 
                onClick={() => {
                  setActiveFolderId(null)
                  updateUrlParams(activeCategorySlug, null)
                }}
                className="hover:text-[var(--accent-primary)] transition-colors cursor-pointer text-[var(--text-tertiary)]"
              >
                {categories.find(c => c.id === activeCategoryId)?.name}
              </button>
              
              {breadcrumbs.map((crumb, idx) => (
                <div key={crumb.id} className="flex items-center gap-2">
                  <span className="text-[var(--border-strong)]">/</span>
                  <button
                    onClick={() => {
                      setActiveFolderId(crumb.id)
                      updateUrlParams(activeCategorySlug, crumb.id)
                    }}
                    className={`flex items-center gap-1.5 hover:text-[var(--accent-primary)] transition-colors cursor-pointer ${
                      idx === breadcrumbs.length - 1 ? 'text-[var(--text-primary)] font-semibold' : 'text-[var(--text-tertiary)]'
                    }`}
                  >
                    {idx === breadcrumbs.length - 1 && <Folder className="h-4 w-4 text-[var(--accent-primary)]" />}
                    {crumb.name}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {supportsFolders && categoryFolders.length > 0 && (
        <section className="space-y-2.5">
          <div className="flex items-end justify-between px-1">
            <div>
              <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">Папки</h2>
              <p className="mt-0.5 text-[10px] text-[var(--text-tertiary)]">Откройте папку, чтобы перейти к моделям</p>
            </div>
            <span className="text-[10px] tabular-nums text-[var(--text-tertiary)]">{categoryFolders.length}</span>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
            {categoryFolders.map(folder => {
              const folderProductsCount = getRecursiveFolderProductsCount(folder.id, activeCategoryId)

              return (
                <div
                  key={folder.id}
                  className="group relative min-h-[84px] rounded-[16px] border border-[var(--border-primary)] bg-[var(--bg-surface)] transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-px hover:border-[var(--accent-primary)]/35 hover:shadow-[0_8px_24px_rgba(15,23,42,0.05)]"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setActiveFolderId(folder.id)
                      updateUrlParams(activeCategorySlug, folder.id)
                    }}
                    className="flex min-h-[82px] w-full items-center gap-3 rounded-[15px] px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent-primary)]/30"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-primary)]">
                      <Folder className="h-[18px] w-[18px]" strokeWidth={1.8} />
                    </div>
                    <div className="min-w-0 flex-1 pr-5">
                      <h3 className="truncate text-xs font-medium text-[var(--text-primary)]">{folder.name}</h3>
                      <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">{folderProductsCount} моделей</p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-[var(--text-tertiary)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--accent-primary)]" strokeWidth={1.8} />
                  </button>
                  {canEditCatalog && (
                    <button
                      type="button"
                      onClick={(e) => handleDeleteFolder(folder.id, e)}
                      className="absolute right-9 top-2 flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-tertiary)] opacity-0 transition-all hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] group-hover:opacity-100 focus:opacity-100"
                      title="Удалить папку"
                      aria-label={`Удалить папку ${folder.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      <section className="overflow-hidden rounded-[18px] border border-[var(--border-primary)] bg-[var(--bg-surface)]">
        <div className="flex items-center justify-between border-b border-[var(--border-primary)] px-4 py-3.5">
          <div>
            <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">Модели</h2>
            <p className="mt-0.5 text-[10px] text-[var(--text-tertiary)]">
              {activeFolder ? `Содержимое папки «${activeFolder.name}»` : `Корневой уровень категории «${activeCategory?.name || ''}»`}
            </p>
          </div>
          <span className="rounded-lg bg-[var(--bg-surface-hover)] px-2.5 py-1 text-[10px] font-medium tabular-nums text-[var(--text-secondary)]">
            {filteredProducts.length}
          </span>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="flex min-h-[168px] flex-col items-center justify-center px-6 py-10 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--bg-surface-hover)] text-[var(--text-tertiary)]">
              <PackageOpen className="h-5 w-5" strokeWidth={1.6} />
            </div>
            <p className="mt-3 text-xs font-medium text-[var(--text-primary)]">
              {search
                ? 'По вашему запросу ничего не найдено'
                : activeFolderId
                  ? 'В этой папке пока нет моделей'
                  : categoryFolders.length > 0
                    ? 'Модели распределены по папкам выше'
                    : 'В этой категории пока нет моделей'}
            </p>
            <p className="mt-1 max-w-sm text-[10px] leading-4 text-[var(--text-tertiary)]">
              {search
                ? 'Попробуйте изменить запрос или очистить поле поиска.'
                : categoryFolders.length > 0 && !activeFolderId
                  ? 'Выберите нужную папку, чтобы открыть список моделей и модификаций.'
                  : canEditCatalog
                    ? 'Добавьте первую модель с помощью кнопки выше.'
                    : 'Здесь появятся доступные модели.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-primary)]">
            {filteredProducts.map(product => {
            const isExpanded = expandedProductIds.has(product.id)
            const salePrices = product.variants.map(variant => variant.salePrice / 100)
            const minSalePrice = salePrices.length ? Math.min(...salePrices) : 0
            const maxSalePrice = salePrices.length ? Math.max(...salePrices) : 0
            const salePriceLabel = minSalePrice === maxSalePrice
              ? `${minSalePrice.toLocaleString('ru-RU')} ₽`
              : `${minSalePrice.toLocaleString('ru-RU')}–${maxSalePrice.toLocaleString('ru-RU')} ₽`

            return (
              <div 
                key={product.id}
                className="overflow-hidden bg-[var(--bg-surface)]"
              >
                <div className="flex min-w-0 items-center gap-2 px-3 py-2.5 transition-colors hover:bg-[var(--bg-surface-hover)]/55 sm:px-4">
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    onClick={() => toggleExpand(product.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/30"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-primary)]">
                      <Grid className="h-[18px] w-[18px]" strokeWidth={1.8} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <h3 className="truncate text-xs font-medium text-[var(--text-primary)]">{product.name}</h3>
                        <span className="rounded-md border border-[var(--border-primary)] bg-[var(--bg-surface-hover)] px-1.5 py-0.5 font-mono text-[9px] text-[var(--text-tertiary)]">
                          {product.baseSku}
                        </span>
                        {product.folderId && !activeFolderId && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-[var(--accent-soft)] px-1.5 py-0.5 text-[9px] text-[var(--accent-text)]">
                            <Folder className="h-3 w-3" />
                            {folders.find(f => f.id === product.folderId)?.name}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 truncate text-[10px] text-[var(--text-tertiary)]">
                        {product.description || 'Описание не заполнено'}
                      </p>
                    </div>
                    <div className="hidden shrink-0 items-center gap-8 pr-2 text-right md:flex">
                      <div className="min-w-[72px]">
                        <p className="text-[9px] uppercase tracking-[0.1em] text-[var(--text-tertiary)]">SKU</p>
                        <p className="mt-1 text-xs font-medium tabular-nums text-[var(--text-primary)]">{product.variants.length}</p>
                      </div>
                      <div className="min-w-[130px]">
                        <p className="text-[9px] uppercase tracking-[0.1em] text-[var(--text-tertiary)]">Цена продажи</p>
                        <p className="mt-1 text-xs font-medium tabular-nums text-[var(--text-primary)]">{salePriceLabel}</p>
                      </div>
                    </div>
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--text-tertiary)]">
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </button>

                  {canEditCatalog && (
                    <div className="flex shrink-0 items-center gap-0.5 border-l border-[var(--border-primary)] pl-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              openCopyModal(product)
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-tertiary)] transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--accent-primary)]"
                            title="Копировать товар"
                            aria-label={`Копировать модель ${product.name}`}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              openEditModal(product)
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-tertiary)] transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--accent-primary)]"
                            title="Редактировать товар"
                            aria-label={`Редактировать модель ${product.name}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleArchiveProduct(product.id)
                            }}
                            disabled={loading === product.id}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-tertiary)] transition-colors hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] disabled:opacity-50"
                            title="В архив"
                            aria-label={`Архивировать модель ${product.name}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                    </div>
                  )}
                </div>

                {isExpanded && (
                  <div className="overflow-x-auto border-t border-[var(--border-primary)] bg-[var(--bg-surface-hover)]/35 px-3 py-3 sm:px-4">
                    <div className="min-w-[720px] overflow-hidden rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)]">
                      <table className="w-full text-left text-[10px]">
                        <thead>
                          <tr className="border-b border-[var(--border-primary)] bg-[var(--bg-surface-hover)]/55 text-[9px] font-medium uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
                            <th className="px-4 py-2.5">Артикул (SKU)</th>
                            <th className="px-4 py-2.5">Характеристики</th>
                            <th className="px-4 py-2.5 text-right">Закупка</th>
                            <th className="px-4 py-2.5 text-right">Продажа</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-primary)] text-[var(--text-secondary)]">
                          {product.variants.map(variant => {
                            const pattern = variant.thickness || variant.attributes?.tablePattern || null
                            const features = [
                              variant.size ? `Размер: ${variant.size}` : null,
                              variant.color ? `Цвет: ${variant.color}` : null,
                              pattern ? `Узор: ${pattern}` : null,
                              variant.material ? `Материал: ${variant.material}` : null,
                            ].filter(Boolean).join(', ')

                            return (
                              <tr key={variant.id} className="transition-colors hover:bg-[var(--bg-surface-hover)]/45">
                                <td className="px-4 py-2.5 font-mono font-medium text-[var(--text-primary)]">{variant.sku}</td>
                                <td className="px-4 py-2.5 text-[var(--text-secondary)]">{features || 'Базовый вариант'}</td>
                                <td className="px-4 py-2.5 text-right tabular-nums text-[var(--text-secondary)]">{(variant.purchasePrice / 100).toLocaleString('ru-RU')} ₽</td>
                                <td className="px-4 py-2.5 text-right font-medium tabular-nums text-[var(--text-primary)]">{(variant.salePrice / 100).toLocaleString('ru-RU')} ₽</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )
            })}
          </div>
        )}
      </section>

      {/* Модальное окно: Создание папки */}
      {folderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-[2px]">
          <div role="dialog" aria-modal="true" aria-labelledby="create-folder-title" className="relative w-full max-w-md overflow-hidden rounded-[20px] border border-[var(--border-primary)] bg-[var(--bg-surface)] shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
            <div className="flex h-16 items-center justify-between border-b border-[var(--border-primary)] px-6">
              <h3 id="create-folder-title" className="flex items-center gap-2.5 text-sm font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-primary)]">
                  <FolderPlus className="h-4 w-4" strokeWidth={1.8} />
                </span>
                Создать новую папку
              </h3>
              <button
                onClick={() => setFolderModalOpen(false)}
                className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] rounded-lg hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateFolder} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                  Название папки *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Например, Овальные столы"
                  value={folderName}
                  onChange={e => setFolderName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[var(--bg-surface-hover)] border border-[var(--border-primary)] rounded-xl outline-none transition focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border-primary)]">
                <button
                  type="button"
                  onClick={() => setFolderModalOpen(false)}
                  className="erp-button-secondary min-h-10 !rounded-xl px-4"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={loading === 'folder'}
                  className="erp-button-primary min-h-10 !rounded-xl px-5 disabled:opacity-50"
                >
                  {loading === 'folder' ? 'Создание...' : 'Создать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модальное окно: Создание модели */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-[2px]">
          <div role="dialog" aria-modal="true" aria-labelledby="create-model-title" className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[20px] border border-[var(--border-primary)] bg-[var(--bg-surface)] shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--border-primary)] px-6">
              <h3 id="create-model-title" className="flex items-center gap-2.5 text-sm font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-primary)]">
                  <Grid className="h-4 w-4" strokeWidth={1.8} />
                </span>
                Добавление новой модели
              </h3>
              <button
                onClick={() => setAddModalOpen(false)}
                className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] rounded-lg hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="flex-1 overflow-y-auto p-6 space-y-6">
              {errorMsg && (
                <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-650 font-bold rounded-lg text-center">
                  {errorMsg}
                </div>
              )}

              {/* Основные параметры */}
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Название модели *</label>
                  <input
                    type="text"
                    required
                    placeholder="Например, Стол Версаль"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[var(--bg-surface-hover)] border border-[var(--border-primary)] rounded-xl outline-none transition focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Базовый артикул (Base SKU) *</label>
                  <input
                    type="text"
                    required
                    placeholder="Например, T-VERS"
                    value={formBaseSku}
                    onChange={e => handleBaseSkuChange(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[var(--bg-surface-hover)] border border-[var(--border-primary)] rounded-xl outline-none transition focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] uppercase font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Категория мебели *</label>
                  <select
                    value={formCategoryId}
                    onChange={e => handleCategoryChange(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[var(--bg-surface-hover)] border border-[var(--border-primary)] rounded-xl outline-none transition focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] cursor-pointer"
                  >
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                {/* Выбор папки для столов и комплектов */}
                {formSupportsFolders && (
                  <div>
                    <label className="block text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Папка в каталоге</label>
                    <select
                      value={formFolderId}
                      onChange={e => setFormFolderId(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-[var(--bg-surface-hover)] border border-[var(--border-primary)] rounded-xl outline-none transition focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] cursor-pointer font-bold text-[var(--accent-primary)]"
                    >
                      <option value="">Без папки (в корне)</option>
                      {getFolderOptions(formCategoryId).map(f => (
                        <option key={f.id} value={f.id}>{f.label}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Ед. измерения</label>
                  <input
                    type="text"
                    required
                    value={formUnit}
                    onChange={e => setFormUnit(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[var(--bg-surface-hover)] border border-[var(--border-primary)] rounded-xl outline-none transition focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Учет остатков</label>
                  <select
                    value={formTrackInventory ? 'true' : 'false'}
                    onChange={e => setFormTrackInventory(e.target.value === 'true')}
                    className="w-full px-3 py-2 text-xs bg-[var(--bg-surface-hover)] border border-[var(--border-primary)] rounded-xl outline-none transition focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] cursor-pointer"
                  >
                    <option value="true">Да, отслеживать</option>
                    <option value="false">Нет, виртуальный товар</option>
                  </select>
                </div>

                <div className="sm:col-span-2 md:col-span-3">
                  <label className="block text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Описание модели</label>
                  <textarea
                    rows={2}
                    value={formDescription}
                    onChange={e => setFormDescription(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[var(--bg-surface-hover)] border border-[var(--border-primary)] rounded-xl outline-none transition focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] resize-none"
                  />
                </div>
              </div>

              {/* Блок добавления артикулов */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-t border-[var(--border-primary)] pt-6">
                  <h4 className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-2">
                    <Layers className="h-4.5 w-4.5 text-[var(--accent-primary)]" />
                    Модификации и артикулы модели
                  </h4>
                  <button
                    type="button"
                    onClick={addVariantRow}
                    className="inline-flex items-center gap-1 bg-brand hover:bg-brand-hover text-white text-[10px] font-bold uppercase tracking-wider px-3.5 py-2 rounded-xl transition-colors cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" /> Добавить модификацию
                  </button>
                </div>

                {variantsList.length === 0 ? (
                  <div className="text-center py-6 text-[var(--text-tertiary)] text-xs border border-dashed border-[var(--border-primary)] rounded-[16px]">
                    Нажмите «Добавить модификацию», чтобы создать артикулы для этой модели
                  </div>
                ) : (
                  <div className="space-y-4">
                    {variantsList.map((v, idx) => (
                      <div 
                        key={idx} 
                        className="relative p-5 bg-[var(--bg-surface-hover)]/55 border border-[var(--border-primary)] rounded-[16px] grid gap-4 sm:grid-cols-2 md:grid-cols-4 items-end"
                      >
                        {variantsList.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeVariantRow(idx)}
                            className="absolute -top-2.5 -right-2.5 p-1 bg-[var(--bg-surface)] border border-[var(--border-primary)] hover:text-red-650 rounded-full shadow-sm cursor-pointer"
                          >
                            <X className="h-3.5 w-3.5 text-[var(--text-tertiary)] hover:text-red-500" />
                          </button>
                        )}

                        {/* Артикул */}
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                            Артикул (SKU)
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="Автогенерация"
                            value={v.sku}
                            onChange={e => handleVariantFieldChange(idx, 'sku', e.target.value)}
                            className="w-full px-3 py-2 text-xs bg-[var(--bg-surface)] border border-[var(--border-primary)] rounded-xl outline-none focus:border-[var(--accent-primary)] font-mono font-bold"
                          />
                        </div>

                        {/* Выбор стола и стула для комплекта */}
                        {selectedCategorySlug === 'sets' && (
                          <div className="sm:col-span-2 md:col-span-4 grid gap-4 sm:grid-cols-2 md:grid-cols-3 bg-[var(--bg-surface)] p-4 rounded-xl border border-[var(--border-primary)] mb-2">
                            {/* Стол */}
                            <div className="space-y-1">
                              <label className="block text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
                                Стол из каталога
                              </label>
                              {v.attributes?.tableVariantId ? (
                                <div className="flex items-center justify-between gap-2 p-2 bg-[var(--bg-surface-hover)] border border-[var(--border-primary)] rounded-lg text-xs">
                                  <div className="min-w-0">
                                    <p className="font-bold text-[var(--text-primary)] truncate">{v.attributes.tableName}</p>
                                    <p className="text-[10px] text-[var(--text-tertiary)] font-medium">
                                      {v.attributes.tableSize} | {v.attributes.tableColor} | {v.attributes.tablePattern}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSetsSelectType('table')
                                      setSetsSelectIndex(idx)
                                      setSetsSelectSearch(v.color || '')
                                      setSetsSelectOpen(true)
                                    }}
                                    className="p-1 text-[var(--text-tertiary)] hover:text-[var(--accent-primary)] hover:bg-[var(--bg-surface)] rounded border border-transparent hover:border-[var(--border-primary)] transition-all cursor-pointer shrink-0"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSetsSelectType('table')
                                    setSetsSelectIndex(idx)
                                    setSetsSelectSearch(v.color || '')
                                    setSetsSelectOpen(true)
                                  }}
                                  className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 bg-brand/5 hover:bg-brand/10 border border-dashed border-brand/20 hover:border-brand/40 text-[var(--accent-primary)] text-xs font-bold rounded-lg transition-colors cursor-pointer"
                                >
                                  <Plus className="h-4 w-4" /> Выбрать стол
                                </button>
                              )}
                            </div>

                            {/* Стул */}
                            <div className="space-y-1">
                              <label className="block text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
                                Стул из каталога
                              </label>
                              {v.attributes?.chairVariantId ? (
                                <div className="flex items-center justify-between gap-2 p-2 bg-[var(--bg-surface-hover)] border border-[var(--border-primary)] rounded-lg text-xs">
                                  <div className="min-w-0">
                                    <p className="font-bold text-[var(--text-primary)] truncate">{v.attributes.chairName}</p>
                                    <p className="text-[10px] text-[var(--text-tertiary)] font-medium">{v.attributes.chairColor}</p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSetsSelectType('chair')
                                      setSetsSelectIndex(idx)
                                      setSetsSelectSearch(v.color || '')
                                      setSetsSelectOpen(true)
                                    }}
                                    className="p-1 text-[var(--text-tertiary)] hover:text-[var(--accent-primary)] hover:bg-[var(--bg-surface)] rounded border border-transparent hover:border-[var(--border-primary)] transition-all cursor-pointer shrink-0"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSetsSelectType('chair')
                                    setSetsSelectIndex(idx)
                                    setSetsSelectSearch(v.color || '')
                                    setSetsSelectOpen(true)
                                  }}
                                  className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 bg-brand/5 hover:bg-brand/10 border border-dashed border-brand/20 hover:border-brand/40 text-[var(--accent-primary)] text-xs font-bold rounded-lg transition-colors cursor-pointer"
                                >
                                  <Plus className="h-4 w-4" /> Выбрать стул
                                </button>
                              )}
                            </div>

                            {/* Количество стульев */}
                            <div className="space-y-1">
                              <label className="block text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
                                Количество стульев
                              </label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min={1}
                                  max={24}
                                  required
                                  disabled={!v.attributes?.chairVariantId}
                                  value={v.attributes?.chairQuantity || 6}
                                  onChange={e => handleVariantFieldChange(idx, 'chairQuantity', e.target.value)}
                                  className="w-full px-3 py-2 text-xs bg-[var(--bg-surface-hover)] border border-[var(--border-primary)] rounded-lg outline-none focus:border-[var(--accent-primary)] disabled:opacity-50 text-[var(--text-secondary)] font-bold"
                                />
                                <span className="text-xs text-[var(--text-tertiary)] font-medium shrink-0">шт</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Размер */}
                        {selectedCategorySlug !== 'chairs' && selectedCategorySlug !== 'sofas' && selectedCategorySlug !== 'sets' && (
                          <div>
                            <label className="block text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                              Размер
                            </label>
                            {selectedCategorySlug === 'tables' ? (
                              <select
                                value={v.size}
                                onChange={e => handleVariantFieldChange(idx, 'size', e.target.value)}
                                className="w-full px-3 py-2 text-xs bg-[var(--bg-surface)] border border-[var(--border-primary)] rounded-xl outline-none focus:border-[var(--accent-primary)] cursor-pointer font-bold text-[var(--text-secondary)]"
                              >
                                <option value="120/160x80">120/160 80</option>
                                <option value="140/180x85">140/180 85</option>
                                <option value="160/200x90">160/200 90</option>
                                <option value="200/240x100">200/240 100</option>
                                <option value="240/280x100">240/280 100</option>
                              </select>
                            ) : (
                              <input
                                type="text"
                                placeholder="120/160x80"
                                value={v.size}
                                onChange={e => handleVariantFieldChange(idx, 'size', e.target.value)}
                                className="w-full px-3 py-2 text-xs bg-[var(--bg-surface)] border border-[var(--border-primary)] rounded-xl outline-none focus:border-[var(--accent-primary)]"
                              />
                            )}
                          </div>
                        )}

                        {/* Цвет */}
                        {selectedCategorySlug !== 'sofas' && (
                          <div>
                            <label className="block text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                              Цвет патины / каркаса
                            </label>
                            <select
                              value={v.color}
                              onChange={e => handleVariantFieldChange(idx, 'color', e.target.value)}
                              className="w-full px-3 py-2 text-xs bg-[var(--bg-surface)] border border-[var(--border-primary)] rounded-xl outline-none focus:border-[var(--accent-primary)] cursor-pointer"
                            >
                              {COLORS.map(c => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Узор (для всех кроме стульев и диванов) */}
                        {selectedCategorySlug !== 'chairs' && selectedCategorySlug !== 'sofas' && (
                          <div>
                            <label className="block text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                              Узор
                            </label>
                            <select
                              value={v.thickness}
                              onChange={e => handleVariantFieldChange(idx, 'thickness', e.target.value)}
                              className="w-full px-3 py-2 text-xs bg-[var(--bg-surface)] border border-[var(--border-primary)] rounded-xl outline-none focus:border-[var(--accent-primary)] cursor-pointer"
                            >
                              {PATTERNS.map(p => (
                                <option key={p} value={p}>{p}</option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Закупка */}
                        <div>
                          <label className="block text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                            Закупка (₽)
                          </label>
                          <input
                            type="number"
                            min="0"
                            required
                            placeholder="12000"
                            value={v.purchasePrice}
                            onChange={e => handleVariantFieldChange(idx, 'purchasePrice', Number(e.target.value))}
                            className="w-full px-3 py-2 text-xs bg-[var(--bg-surface)] border border-[var(--border-primary)] rounded-xl outline-none focus:border-[var(--accent-primary)]"
                          />
                        </div>

                        {/* Розничная цена */}
                        <div>
                          <label className="block text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                            Продажа (₽) *
                          </label>
                          <input
                            type="number"
                            min="0"
                            required
                            placeholder="19500"
                            value={v.salePrice}
                            onChange={e => handleVariantFieldChange(idx, 'salePrice', Number(e.target.value))}
                            className="w-full px-3 py-2 text-xs bg-[var(--bg-surface)] border border-[var(--border-primary)] rounded-xl outline-none focus:border-[var(--accent-primary)] font-bold text-[var(--accent-primary)]"
                          />
                        </div>

                        {/* Вес */}
                        <div>
                          <label className="block text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                            Вес (кг)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="25"
                            value={v.weight || ''}
                            onChange={e => handleVariantFieldChange(idx, 'weight', e.target.value)}
                            className="w-full px-3 py-2 text-xs bg-[var(--bg-surface)] border border-[var(--border-primary)] rounded-xl outline-none focus:border-[var(--accent-primary)]"
                          />
                        </div>

                        {/* Объем */}
                        <div>
                          <label className="block text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                            Объем (м³)
                          </label>
                          <input
                            type="number"
                            step="0.0001"
                            placeholder="0.15"
                            value={v.volume || ''}
                            onChange={e => handleVariantFieldChange(idx, 'volume', e.target.value)}
                            className="w-full px-3 py-2 text-xs bg-[var(--bg-surface)] border border-[var(--border-primary)] rounded-xl outline-none focus:border-[var(--accent-primary)]"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Подвал формы */}
              <div className="flex justify-end gap-3 pt-6 border-t border-[var(--border-primary)] shrink-0">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="erp-button-secondary min-h-10 !rounded-xl px-4"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={loading === 'create'}
                  className="erp-button-primary min-h-10 !rounded-xl px-5 disabled:opacity-50"
                >
                  {loading === 'create' ? 'Создание...' : 'Добавить модель'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модальное окно: Редактирование модели */}
      {editProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-[2px]">
          <div role="dialog" aria-modal="true" aria-labelledby="edit-model-title" className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[20px] border border-[var(--border-primary)] bg-[var(--bg-surface)] shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--border-primary)] px-6">
              <h3 id="edit-model-title" className="flex items-center gap-2.5 text-sm font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-primary)]">
                  <Pencil className="h-4 w-4" strokeWidth={1.8} />
                </span>
                Редактирование модели: {editProduct.name}
              </h3>
              <button
                onClick={() => setEditProduct(null)}
                className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] rounded-lg hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateProduct} className="flex-1 overflow-y-auto p-6 space-y-6">
              {errorMsg && (
                <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-650 font-bold rounded-lg text-center">
                  {errorMsg}
                </div>
              )}

              {/* Основные параметры */}
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Название модели *</label>
                  <input
                    type="text"
                    required
                    placeholder="Например, Стол Версаль"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[var(--bg-surface-hover)] border border-[var(--border-primary)] rounded-xl outline-none transition focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Базовый артикул (Base SKU) *</label>
                  <input
                    type="text"
                    required
                    placeholder="Например, T-VERS"
                    value={formBaseSku}
                    onChange={e => handleBaseSkuChange(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[var(--bg-surface-hover)] border border-[var(--border-primary)] rounded-xl outline-none transition focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] uppercase font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Категория мебели *</label>
                  <select
                    value={formCategoryId}
                    onChange={e => handleCategoryChange(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[var(--bg-surface-hover)] border border-[var(--border-primary)] rounded-xl outline-none transition focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] cursor-pointer"
                  >
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                {/* Выбор папки для столов и комплектов */}
                {formSupportsFolders && (
                  <div>
                    <label className="block text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Папка в каталоге</label>
                    <select
                      value={formFolderId}
                      onChange={e => setFormFolderId(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-[var(--bg-surface-hover)] border border-[var(--border-primary)] rounded-xl outline-none transition focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] cursor-pointer font-bold text-[var(--accent-primary)]"
                    >
                      <option value="">Без папки (в корне)</option>
                      {getFolderOptions(formCategoryId).map(f => (
                        <option key={f.id} value={f.id}>{f.label}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Ед. измерения</label>
                  <input
                    type="text"
                    required
                    value={formUnit}
                    onChange={e => setFormUnit(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[var(--bg-surface-hover)] border border-[var(--border-primary)] rounded-xl outline-none transition focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Учет остатков</label>
                  <select
                    value={formTrackInventory ? 'true' : 'false'}
                    onChange={e => setFormTrackInventory(e.target.value === 'true')}
                    className="w-full px-3 py-2 text-xs bg-[var(--bg-surface-hover)] border border-[var(--border-primary)] rounded-xl outline-none transition focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] cursor-pointer"
                  >
                    <option value="true">Да, отслеживать</option>
                    <option value="false">Нет, виртуальный товар</option>
                  </select>
                </div>

                <div className="sm:col-span-2 md:col-span-3">
                  <label className="block text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Описание модели</label>
                  <textarea
                    rows={2}
                    value={formDescription}
                    onChange={e => setFormDescription(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[var(--bg-surface-hover)] border border-[var(--border-primary)] rounded-xl outline-none transition focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] resize-none"
                  />
                </div>
              </div>

              {/* Блок добавления артикулов */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-t border-[var(--border-primary)] pt-6">
                  <h4 className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-2">
                    <Layers className="h-4.5 w-4.5 text-[var(--accent-primary)]" />
                    Модификации и артикулы модели
                  </h4>
                  <button
                    type="button"
                    onClick={addVariantRow}
                    className="inline-flex items-center gap-1 bg-brand hover:bg-brand-hover text-white text-[10px] font-bold uppercase tracking-wider px-3.5 py-2 rounded-xl transition-colors cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" /> Добавить модификацию
                  </button>
                </div>

                {variantsList.length === 0 ? (
                  <div className="text-center py-6 text-[var(--text-tertiary)] text-xs border border-dashed border-[var(--border-primary)] rounded-[16px]">
                    Нажмите «Добавить модификацию», чтобы создать артикулы для этой модели
                  </div>
                ) : (
                  <div className="space-y-4">
                    {variantsList.map((v, idx) => (
                      <div 
                        key={idx} 
                        className="relative p-5 bg-[var(--bg-surface-hover)]/55 border border-[var(--border-primary)] rounded-[16px] grid gap-4 sm:grid-cols-2 md:grid-cols-4 items-end"
                      >
                        {variantsList.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeVariantRow(idx)}
                            className="absolute -top-2.5 -right-2.5 p-1 bg-[var(--bg-surface)] border border-[var(--border-primary)] hover:text-red-650 rounded-full shadow-sm cursor-pointer"
                          >
                            <X className="h-3.5 w-3.5 text-[var(--text-tertiary)] hover:text-red-500" />
                          </button>
                        )}

                        {/* Артикул */}
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                            Артикул (SKU)
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="Автогенерация"
                            value={v.sku}
                            onChange={e => handleVariantFieldChange(idx, 'sku', e.target.value)}
                            className="w-full px-3 py-2 text-xs bg-[var(--bg-surface)] border border-[var(--border-primary)] rounded-xl outline-none focus:border-[var(--accent-primary)] font-mono font-bold"
                          />
                        </div>

                        {/* Выбор стола и стула для комплекта */}
                        {selectedCategorySlug === 'sets' && (
                          <div className="sm:col-span-2 md:col-span-4 grid gap-4 sm:grid-cols-2 md:grid-cols-3 bg-[var(--bg-surface)] p-4 rounded-xl border border-[var(--border-primary)] mb-2">
                            {/* Стол */}
                            <div className="space-y-1">
                              <label className="block text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
                                Стол из каталога
                              </label>
                              {v.attributes?.tableVariantId ? (
                                <div className="flex items-center justify-between gap-2 p-2 bg-[var(--bg-surface-hover)] border border-[var(--border-primary)] rounded-lg text-xs">
                                  <div className="min-w-0">
                                    <p className="font-bold text-[var(--text-primary)] truncate">{v.attributes.tableName}</p>
                                    <p className="text-[10px] text-[var(--text-tertiary)] font-medium">
                                      {v.attributes.tableSize} | {v.attributes.tableColor} | {v.attributes.tablePattern}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSetsSelectType('table')
                                      setSetsSelectIndex(idx)
                                      setSetsSelectSearch(v.color || '')
                                      setSetsSelectOpen(true)
                                    }}
                                    className="p-1 text-[var(--text-tertiary)] hover:text-[var(--accent-primary)] hover:bg-[var(--bg-surface)] rounded border border-transparent hover:border-[var(--border-primary)] transition-all cursor-pointer shrink-0"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSetsSelectType('table')
                                    setSetsSelectIndex(idx)
                                    setSetsSelectSearch(v.color || '')
                                    setSetsSelectOpen(true)
                                  }}
                                  className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 bg-brand/5 hover:bg-brand/10 border border-dashed border-brand/20 hover:border-brand/40 text-[var(--accent-primary)] text-xs font-bold rounded-lg transition-colors cursor-pointer"
                                >
                                  <Plus className="h-4 w-4" /> Выбрать стол
                                </button>
                              )}
                            </div>

                            {/* Стул */}
                            <div className="space-y-1">
                              <label className="block text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
                                Стул из каталога
                              </label>
                              {v.attributes?.chairVariantId ? (
                                <div className="flex items-center justify-between gap-2 p-2 bg-[var(--bg-surface-hover)] border border-[var(--border-primary)] rounded-lg text-xs">
                                  <div className="min-w-0">
                                    <p className="font-bold text-[var(--text-primary)] truncate">{v.attributes.chairName}</p>
                                    <p className="text-[10px] text-[var(--text-tertiary)] font-medium">{v.attributes.chairColor}</p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSetsSelectType('chair')
                                      setSetsSelectIndex(idx)
                                      setSetsSelectSearch(v.color || '')
                                      setSetsSelectOpen(true)
                                    }}
                                    className="p-1 text-[var(--text-tertiary)] hover:text-[var(--accent-primary)] hover:bg-[var(--bg-surface)] rounded border border-transparent hover:border-[var(--border-primary)] transition-all cursor-pointer shrink-0"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSetsSelectType('chair')
                                    setSetsSelectIndex(idx)
                                    setSetsSelectSearch(v.color || '')
                                    setSetsSelectOpen(true)
                                  }}
                                  className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 bg-brand/5 hover:bg-brand/10 border border-dashed border-brand/20 hover:border-brand/40 text-[var(--accent-primary)] text-xs font-bold rounded-lg transition-colors cursor-pointer"
                                >
                                  <Plus className="h-4 w-4" /> Выбрать стул
                                </button>
                              )}
                            </div>

                            {/* Количество стульев */}
                            <div className="space-y-1">
                              <label className="block text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
                                Количество стульев
                              </label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min={1}
                                  max={24}
                                  required
                                  disabled={!v.attributes?.chairVariantId}
                                  value={v.attributes?.chairQuantity || 6}
                                  onChange={e => handleVariantFieldChange(idx, 'chairQuantity', e.target.value)}
                                  className="w-full px-3 py-2 text-xs bg-[var(--bg-surface-hover)] border border-[var(--border-primary)] rounded-lg outline-none focus:border-[var(--accent-primary)] disabled:opacity-50 text-[var(--text-secondary)] font-bold"
                                />
                                <span className="text-xs text-[var(--text-tertiary)] font-medium shrink-0">шт</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Размер */}
                        {selectedCategorySlug !== 'chairs' && selectedCategorySlug !== 'sofas' && selectedCategorySlug !== 'sets' && (
                          <div>
                            <label className="block text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                              Размер
                            </label>
                            {selectedCategorySlug === 'tables' ? (
                              <select
                                value={v.size}
                                onChange={e => handleVariantFieldChange(idx, 'size', e.target.value)}
                                className="w-full px-3 py-2 text-xs bg-[var(--bg-surface)] border border-[var(--border-primary)] rounded-xl outline-none focus:border-[var(--accent-primary)] cursor-pointer font-bold text-[var(--text-secondary)]"
                              >
                                <option value="120/160x80">120/160 80</option>
                                <option value="140/180x85">140/180 85</option>
                                <option value="160/200x90">160/200 90</option>
                                <option value="200/240x100">200/240 100</option>
                                <option value="240/280x100">240/280 100</option>
                              </select>
                            ) : (
                              <input
                                type="text"
                                placeholder="120/160x80"
                                value={v.size}
                                onChange={e => handleVariantFieldChange(idx, 'size', e.target.value)}
                                className="w-full px-3 py-2 text-xs bg-[var(--bg-surface)] border border-[var(--border-primary)] rounded-xl outline-none focus:border-[var(--accent-primary)]"
                              />
                            )}
                          </div>
                        )}

                        {/* Цвет */}
                        {selectedCategorySlug !== 'sofas' && (
                          <div>
                            <label className="block text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                              Цвет патины / каркаса
                            </label>
                            <select
                              value={v.color}
                              onChange={e => handleVariantFieldChange(idx, 'color', e.target.value)}
                              className="w-full px-3 py-2 text-xs bg-[var(--bg-surface)] border border-[var(--border-primary)] rounded-xl outline-none focus:border-[var(--accent-primary)] cursor-pointer"
                            >
                              {COLORS.map(c => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Узор (для всех кроме стульев и диванов) */}
                        {selectedCategorySlug !== 'chairs' && selectedCategorySlug !== 'sofas' && (
                          <div>
                            <label className="block text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                              Узор
                            </label>
                            <select
                              value={v.thickness}
                              onChange={e => handleVariantFieldChange(idx, 'thickness', e.target.value)}
                              className="w-full px-3 py-2 text-xs bg-[var(--bg-surface)] border border-[var(--border-primary)] rounded-xl outline-none focus:border-[var(--accent-primary)] cursor-pointer"
                            >
                              {PATTERNS.map(p => (
                                <option key={p} value={p}>{p}</option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Закупка */}
                        <div>
                          <label className="block text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                            Закупка (₽)
                          </label>
                          <input
                            type="number"
                            min="0"
                            required
                            placeholder="12000"
                            value={v.purchasePrice}
                            onChange={e => handleVariantFieldChange(idx, 'purchasePrice', Number(e.target.value))}
                            className="w-full px-3 py-2 text-xs bg-[var(--bg-surface)] border border-[var(--border-primary)] rounded-xl outline-none focus:border-[var(--accent-primary)]"
                          />
                        </div>

                        {/* Розничная цена */}
                        <div>
                          <label className="block text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                            Продажа (₽) *
                          </label>
                          <input
                            type="number"
                            min="0"
                            required
                            placeholder="19500"
                            value={v.salePrice}
                            onChange={e => handleVariantFieldChange(idx, 'salePrice', Number(e.target.value))}
                            className="w-full px-3 py-2 text-xs bg-[var(--bg-surface)] border border-[var(--border-primary)] rounded-xl outline-none focus:border-[var(--accent-primary)] font-bold text-[var(--accent-primary)]"
                          />
                        </div>

                        {/* Вес */}
                        <div>
                          <label className="block text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                            Вес (кг)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="25"
                            value={v.weight || ''}
                            onChange={e => handleVariantFieldChange(idx, 'weight', e.target.value)}
                            className="w-full px-3 py-2 text-xs bg-[var(--bg-surface)] border border-[var(--border-primary)] rounded-xl outline-none focus:border-[var(--accent-primary)]"
                          />
                        </div>

                        {/* Объем */}
                        <div>
                          <label className="block text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                            Объем (м³)
                          </label>
                          <input
                            type="number"
                            step="0.0001"
                            placeholder="0.15"
                            value={v.volume || ''}
                            onChange={e => handleVariantFieldChange(idx, 'volume', e.target.value)}
                            className="w-full px-3 py-2 text-xs bg-[var(--bg-surface)] border border-[var(--border-primary)] rounded-xl outline-none focus:border-[var(--accent-primary)]"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Подвал формы */}
              <div className="flex justify-end gap-3 pt-6 border-t border-[var(--border-primary)] shrink-0">
                <button
                  type="button"
                  onClick={() => setEditProduct(null)}
                  className="erp-button-secondary min-h-10 !rounded-xl px-4"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={loading === 'edit'}
                  className="erp-button-primary min-h-10 !rounded-xl px-5 disabled:opacity-50"
                >
                  {loading === 'edit' ? 'Сохранение...' : 'Сохранить изменения'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модальное окно выбора составляющей комплекта */}
      {setsSelectOpen && (() => {
        const targetSlug = setsSelectType === 'table' ? 'tables' : 'chairs';
        const targetCategory = categories.find(c => c.slug === targetSlug);
        if (!targetCategory) return null;
        
        const targetCatId = targetCategory.id;

        // Хлебные крошки
        const crumbs: ProductFolder[] = [];
        let currentFolder = folders.find(f => f.id === setsSelectFolderId);
        while (currentFolder) {
          crumbs.unshift(currentFolder);
          const pId = currentFolder.parentId;
          currentFolder = pId ? folders.find(f => f.id === pId) : undefined;
        }

        // Фильтрация папок и товаров на текущем уровне
        const activeFolders = folders.filter(f => f.categoryId === targetCatId && f.parentId === setsSelectFolderId);
        const activeProducts = products.filter(p => p.categoryId === targetCatId && p.folderId === setsSelectFolderId);

        // Поиск
        const searchTrim = setsSelectSearch.trim().toLowerCase();
        const isSearching = searchTrim.length > 0;

        // Все варианты для поиска
        const allProductsOfCat = products.filter(p => p.categoryId === targetCatId);
        const matchedVariants: { product: ProductWithVariants; variant: ProductVariant }[] = [];
        if (isSearching) {
          for (const p of allProductsOfCat) {
            for (const v of p.variants) {
              if (
                p.name.toLowerCase().includes(searchTrim) ||
                v.sku.toLowerCase().includes(searchTrim) ||
                (v.size && v.size.toLowerCase().includes(searchTrim)) ||
                (v.color && v.color.toLowerCase().includes(searchTrim))
              ) {
                matchedVariants.push({ product: p, variant: v });
              }
            }
          }
        }

        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm">
            <div className="relative w-full max-w-4xl bg-[var(--bg-surface)] border border-[var(--border-primary)] rounded-card shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
              {/* Шапка */}
              <div className="flex h-14 items-center justify-between border-b border-[var(--border-primary)] px-6 shrink-0 bg-[var(--bg-surface-hover)]/55">
                <h3 className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-2">
                  <Grid className="h-4.5 w-4.5 text-[var(--accent-primary)]" />
                  {setsSelectType === 'table' ? 'Выбор стола из каталога' : 'Выбор стула из каталога'}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setSetsSelectOpen(false);
                    setSetsSelectIndex(null);
                    setSetsSelectSearch('');
                    setSetsSelectFolderId(null);
                  }}
                  className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] rounded-lg hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Поисковая строка */}
              <div className="p-4 border-b border-[var(--border-primary)] bg-[var(--bg-surface)] shrink-0">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-tertiary)] pointer-events-none z-10" />
                  <input
                    type="text"
                    placeholder="Поиск по названию модели, артикулу, размеру или цвету..."
                    value={setsSelectSearch}
                    onChange={e => setSetsSelectSearch(e.target.value)}
                    className="w-full !pl-10 pr-4 py-2 text-xs bg-[var(--bg-surface-hover)] border border-[var(--border-primary)] rounded-xl text-slate-850 placeholder-slate-400 outline-none transition focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)]"
                  />
                </div>
              </div>

              {/* Тело модалки */}
              <div className="flex-1 overflow-y-auto p-6 min-h-[300px]">
                {isSearching ? (
                  // Результаты поиска
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">Результаты поиска ({matchedVariants.length})</h4>
                    {matchedVariants.length === 0 ? (
                      <div className="text-center py-12 text-[var(--text-tertiary)] text-xs font-semibold uppercase tracking-wider">
                        Ничего не найдено
                      </div>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {matchedVariants.map(({ product, variant }) => {
                          const desc = [
                            variant.size ? `Размер: ${variant.size}` : null,
                            variant.color ? `Цвет: ${variant.color}` : null,
                            variant.thickness ? `Узор: ${variant.thickness}` : null,
                            variant.material ? `Каркас: ${variant.material}` : null,
                          ].filter(Boolean).join(', ');

                          return (
                            <div
                              key={variant.id}
                              onClick={() => handleSelectSetComponent(variant, product)}
                              className="p-4 bg-[var(--bg-surface)] border border-[var(--border-primary)] hover:border-brand/40 hover:shadow-sm rounded-xl cursor-pointer transition-all flex flex-col justify-between"
                            >
                              <div>
                                <h5 className="font-bold text-xs text-[var(--text-primary)]">{product.name}</h5>
                                <p className="text-[10px] font-mono text-[var(--text-tertiary)] font-bold mt-0.5">{variant.sku}</p>
                                <p className="text-[10px] text-[var(--text-secondary)] font-medium mt-1">{desc || 'Базовый вариант'}</p>
                              </div>
                              <div className="mt-3 pt-2 border-t border-slate-55 bg-[var(--bg-surface-hover)]/55 rounded p-1.5 text-right">
                                <span className="text-[10px] font-bold text-[var(--accent-primary)] uppercase tracking-wider">Выбрать</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  // Навигация по каталогу (папки и товары)
                  <div className="space-y-6">
                    {/* Хлебные крошки */}
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
                      <button
                        type="button"
                        onClick={() => setSetsSelectFolderId(null)}
                        className="hover:text-[var(--accent-primary)] transition-colors cursor-pointer"
                      >
                        {targetCategory.name}
                      </button>
                      {crumbs.map((crumb) => (
                        <div key={crumb.id} className="flex items-center gap-1.5">
                          <span>/</span>
                          <button
                            type="button"
                            onClick={() => setSetsSelectFolderId(crumb.id)}
                            className="hover:text-[var(--accent-primary)] transition-colors cursor-pointer"
                          >
                            {crumb.name}
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Папки */}
                    {activeFolders.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">Папки</h4>
                        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
                          {activeFolders.map(f => (
                            <div
                              key={f.id}
                              onClick={() => setSetsSelectFolderId(f.id)}
                              className="p-4 bg-[var(--bg-surface-hover)] border border-[var(--border-primary)] hover:border-brand/40 hover:bg-[var(--bg-surface)] rounded-xl cursor-pointer transition-all flex items-center gap-3"
                            >
                              <Folder className="h-5 w-5 text-[var(--accent-primary)]/70" />
                              <span className="font-bold text-xs text-[var(--text-primary)] truncate">{f.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Товары */}
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">Модели</h4>
                      {activeProducts.length === 0 ? (
                        <div className="text-center py-12 text-[var(--text-tertiary)] text-xs font-semibold uppercase tracking-wider border border-dashed border-[var(--border-primary)] rounded-xl">
                          В этой папке нет товаров
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {activeProducts.map(p => (
                            <div key={p.id} className="border border-[var(--border-primary)] rounded-xl overflow-hidden bg-[var(--bg-surface)]">
                              <div className="bg-[var(--bg-surface-hover)]/55 px-4 py-2 border-b border-[var(--border-primary)] flex items-center justify-between">
                                <span className="font-bold text-xs text-slate-850">{p.name}</span>
                                <span className="text-[9px] font-bold text-[var(--text-tertiary)] uppercase font-mono">{p.baseSku}</span>
                              </div>
                              <div className="p-3 divide-y divide-slate-100">
                                {p.variants.map(v => {
                                  const desc = [
                                    v.size ? `Размер: ${v.size}` : null,
                                    v.color ? `Цвет: ${v.color}` : null,
                                    v.thickness ? `Узор: ${v.thickness}` : null,
                                    v.material ? `Каркас: ${v.material}` : null,
                                  ].filter(Boolean).join(', ');

                                  return (
                                    <div
                                      key={v.id}
                                      onClick={() => handleSelectSetComponent(v, p)}
                                      className="py-2.5 px-3 hover:bg-[var(--bg-surface-hover)] flex items-center justify-between text-xs cursor-pointer transition-colors"
                                    >
                                      <div>
                                        <p className="font-mono font-bold text-[var(--text-primary)]">{v.sku}</p>
                                        <p className="text-[10px] text-[var(--text-tertiary)] font-medium mt-0.5">{desc || 'Базовый вариант'}</p>
                                      </div>
                                      <span className="text-[10px] font-bold text-[var(--accent-primary)] uppercase tracking-wider">Выбрать</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  )
}
