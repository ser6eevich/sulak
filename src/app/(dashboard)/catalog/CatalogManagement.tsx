'use client'

import { useState, useEffect } from 'react'
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
  Pencil,
  Copy
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
  attributes: any | null
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
  attributes?: any | null
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

export default function CatalogManagement({ categories, initialProducts, initialFolders, userRole }: CatalogManagementProps) {
  const canEditCatalog = ['admin', 'owner'].includes(userRole || '')
  const [products, setProducts] = useState<ProductWithVariants[]>(initialProducts)
  const [folders, setFolders] = useState<ProductFolder[]>(initialFolders)
  const [activeCategorySlug, setActiveCategorySlug] = useState(categories[0]?.slug || '')
  
  // Текущая папка внутри категории (поддерживается в столах и комплектах)
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const cat = params.get('category')
    const fld = params.get('folder')
    if (cat) setActiveCategorySlug(cat)
    if (fld) setActiveFolderId(fld)
  }, [])

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


  return (
    <div className="space-y-4">
      {/* Выбор категории */}
      <div className="flex overflow-x-auto gap-1.5 p-1.5 erp-card max-w-full w-full min-w-0 scrollbar-none">
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => {
              setActiveCategorySlug(cat.slug)
              setActiveFolderId(null) // при смене категории сбрасываем выбранную папку
              updateUrlParams(cat.slug, null)
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer whitespace-nowrap ${
              activeCategorySlug === cat.slug
                ? 'bg-[var(--accent-soft)] text-[var(--accent-text)] font-semibold'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Поиск и создание */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between erp-card p-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-tertiary)] pointer-events-none z-10" />
          <input
            type="text"
            placeholder="Поиск по названию, базовому SKU или модификации..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="erp-input w-full !pl-9"
          />
        </div>

        {canEditCatalog && (
          <div className="flex items-center gap-2">
            {/* Кнопка "Создать папку/подпапку", если категория поддерживает папки */}
            {supportsFolders && (
              <button
                onClick={() => {
                  setFolderName('')
                  setFolderModalOpen(true)
                }}
                className="erp-button-secondary inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <FolderPlus className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                {activeFolderId ? 'Создать подпапку' : 'Создать папку'}
              </button>
            )}

            <button
              onClick={() => {
                setFormName('')
                setFormDescription('')
                setFormBaseSku('')
                setFormUnit('шт')
                setFormTrackInventory(true)
                setFormCategoryId(activeCategoryId)
                setFormFolderId(activeFolderId || '') // Если зашли в папку, создаем сразу в ней
                setErrorMsg('')
                setVariantsList([createNewVariantRow(activeCategorySlug)])
                setAddModalOpen(true)
              }}
              className="erp-button-primary inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Добавить модель
            </button>
          </div>
        )}
      </div>

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
          <div className="flex items-center justify-between bg-[var(--bg-surface)] px-4 py-2.5 rounded-lg border border-[var(--border-primary)] text-xs font-medium text-[var(--text-secondary)]">
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

      {/* Блок Папок (Notion-стиль) */}
      {supportsFolders && categoryFolders.length > 0 && (
        <div className="space-y-2">
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
            {categoryFolders.map(folder => {
              // Считаем количество товаров в этой папке (включая подпапки)
              const folderProductsCount = getRecursiveFolderProductsCount(folder.id, activeCategoryId)

              return (
                <div
                  key={folder.id}
                  onClick={() => {
                    setActiveFolderId(folder.id)
                    updateUrlParams(activeCategorySlug, folder.id)
                  }}
                  className="relative group erp-card p-4 cursor-pointer hover:border-[var(--accent-primary)]/40 hover:shadow-sm transition-all flex items-center gap-3"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--accent-soft)] text-[var(--accent-primary)]">
                    <Folder className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 pr-4">
                    <h4 className="font-medium text-[var(--text-primary)] text-xs truncate">{folder.name}</h4>
                    <p className="text-[10px] text-[var(--text-tertiary)] font-normal mt-0.5 uppercase tracking-wider">{folderProductsCount} товаров</p>
                  </div>
                  {/* Кнопка удаления папки */}
                  {canEditCatalog && (
                    <button
                      onClick={(e) => handleDeleteFolder(folder.id, e)}
                      className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[var(--danger-soft)] text-[var(--text-tertiary)] hover:text-[var(--danger)] transition-all cursor-pointer"
                      title="Удалить папку"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Список моделей */}
      <div className="space-y-3">
        {filteredProducts.length === 0 ? (
          <div className="bg-white border border-border-main rounded-card p-16 text-center text-slate-450 text-xs font-semibold uppercase tracking-wider">
            {activeFolderId 
              ? 'В этой папке пока нет моделей' 
              : 'Модели в данной категории не найдены'}
          </div>
        ) : (
          filteredProducts.map(product => {
            const isExpanded = expandedProductIds.has(product.id)
            return (
              <div 
                key={product.id}
                className="bg-white border border-border-main rounded-card overflow-hidden"
              >
                {/* Карточка модели */}
                <div 
                  className="flex items-center justify-between p-6 cursor-pointer hover:bg-slate-50/50 transition-colors"
                  onClick={() => toggleExpand(product.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-brand/10 text-brand">
                      <Grid className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                        {product.name}
                        <span className="text-[10px] font-bold text-slate-400 font-mono bg-slate-50 px-2 py-0.5 rounded border border-border-main">
                          {product.baseSku}
                        </span>
                        {product.folderId && !activeFolderId && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-brand bg-brand/5 px-2 py-0.5 rounded border border-brand/10">
                            <Folder className="h-3 w-3" />
                            {folders.find(f => f.id === product.folderId)?.name}
                          </span>
                        )}
                      </h3>
                      <p className="text-[11px] text-slate-450 font-medium mt-1">
                        {product.description || 'Описание не заполнено'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-600 ring-1 ring-inset ring-slate-500/10">
                        <Layers className="h-3.5 w-3.5" />
                        {product.variants.length} SKU
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {canEditCatalog && (
                        <>
                          {/* Кнопка Копирования */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              openCopyModal(product)
                            }}
                            className="inline-flex p-1.5 rounded-lg text-slate-400 hover:text-brand hover:bg-brand/10 transition-colors cursor-pointer"
                            title="Копировать товар"
                          >
                            <Copy className="h-4 w-4" />
                          </button>

                          {/* Кнопка Редактирования */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              openEditModal(product)
                            }}
                            className="inline-flex p-1.5 rounded-lg text-slate-400 hover:text-brand hover:bg-brand/10 transition-colors cursor-pointer"
                            title="Редактировать товар"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>

                          {/* Кнопка Архивирования */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleArchiveProduct(product.id)
                            }}
                            disabled={loading === product.id}
                            className="inline-flex p-1.5 rounded-lg text-slate-400 hover:text-red-650 hover:bg-red-50/30 transition-colors cursor-pointer disabled:opacity-50"
                            title="В архив"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      <div className="text-slate-400 p-1">
                        {isExpanded ? <ChevronUp className="h-4.5 w-4.5" /> : <ChevronDown className="h-4.5 w-4.5" />}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Выпадающий список SKU */}
                {isExpanded && (
                  <div className="border-t border-border-main bg-slate-50/30 p-6">
                    <div className="border border-border-main rounded-[16px] overflow-hidden bg-white">
                      <table className="w-full text-xs text-left">
                        <thead>
                          <tr className="border-b border-border-main text-slate-400 font-bold uppercase tracking-wider bg-slate-50/50">
                            <th className="p-3 pl-6">Артикул (SKU)</th>
                            <th className="p-3">Характеристики</th>
                            <th className="p-3 text-right">Закупка</th>
                            <th className="p-3 text-right pr-6">Продажа</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                          {product.variants.map(variant => {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const pattern = variant.thickness || (variant.attributes as any)?.tablePattern || null
                            const features = [
                              variant.size ? `Размер: ${variant.size}` : null,
                              variant.color ? `Цвет: ${variant.color}` : null,
                              pattern ? `Узор: ${pattern}` : null,
                              variant.material ? `Материал: ${variant.material}` : null,
                            ].filter(Boolean).join(', ')

                            return (
                              <tr key={variant.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-3 pl-6 font-mono font-bold text-slate-800">{variant.sku}</td>
                                <td className="p-3 text-slate-500 font-medium">{features || 'Базовый вариант'}</td>
                                <td className="p-3 text-right text-slate-500">{(variant.purchasePrice / 100).toLocaleString('ru-RU')} ₽</td>
                                <td className="p-3 text-right pr-6 font-bold text-slate-800">{(variant.salePrice / 100).toLocaleString('ru-RU')} ₽</td>
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
          })
        )}
      </div>

      {/* Модальное окно: Создание папки */}
      {folderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-white border border-border-main rounded-card shadow-xl overflow-hidden">
            <div className="flex h-14 items-center justify-between border-b border-border-main px-6">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <FolderPlus className="h-4.5 w-4.5 text-brand" />
                Создать новую папку
              </h3>
              <button
                onClick={() => setFolderModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-500 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateFolder} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Название папки *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Например, Овальные столы"
                  value={folderName}
                  onChange={e => setFolderName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-border-main rounded-btn outline-none transition focus:border-brand focus:bg-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border-main">
                <button
                  type="button"
                  onClick={() => setFolderModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-btn transition-colors cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={loading === 'folder'}
                  className="px-5 py-2 bg-brand hover:bg-brand-hover text-white rounded-btn text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm">
          <div className="relative w-full max-w-5xl bg-white border border-border-main rounded-card shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex h-14 items-center justify-between border-b border-border-main px-6 shrink-0">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Grid className="h-4.5 w-4.5 text-brand" />
                Добавление новой модели
              </h3>
              <button
                onClick={() => setAddModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-500 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
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
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Название модели *</label>
                  <input
                    type="text"
                    required
                    placeholder="Например, Стол Версаль"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-border-main rounded-btn outline-none transition focus:border-brand focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Базовый артикул (Base SKU) *</label>
                  <input
                    type="text"
                    required
                    placeholder="Например, T-VERS"
                    value={formBaseSku}
                    onChange={e => handleBaseSkuChange(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-border-main rounded-btn outline-none transition focus:border-brand focus:bg-white uppercase font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Категория мебели *</label>
                  <select
                    value={formCategoryId}
                    onChange={e => handleCategoryChange(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-border-main rounded-btn outline-none transition focus:border-brand focus:bg-white cursor-pointer"
                  >
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                {/* Выбор папки для столов и комплектов */}
                {formSupportsFolders && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Папка в каталоге</label>
                    <select
                      value={formFolderId}
                      onChange={e => setFormFolderId(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-border-main rounded-btn outline-none transition focus:border-brand focus:bg-white cursor-pointer font-bold text-brand"
                    >
                      <option value="">Без папки (в корне)</option>
                      {getFolderOptions(formCategoryId).map(f => (
                        <option key={f.id} value={f.id}>{f.label}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Ед. измерения</label>
                  <input
                    type="text"
                    required
                    value={formUnit}
                    onChange={e => setFormUnit(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-border-main rounded-btn outline-none transition focus:border-brand focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Учет остатков</label>
                  <select
                    value={formTrackInventory ? 'true' : 'false'}
                    onChange={e => setFormTrackInventory(e.target.value === 'true')}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-border-main rounded-btn outline-none transition focus:border-brand focus:bg-white cursor-pointer"
                  >
                    <option value="true">Да, отслеживать</option>
                    <option value="false">Нет, виртуальный товар</option>
                  </select>
                </div>

                <div className="sm:col-span-2 md:col-span-3">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Описание модели</label>
                  <textarea
                    rows={2}
                    value={formDescription}
                    onChange={e => setFormDescription(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-border-main rounded-btn outline-none transition focus:border-brand focus:bg-white resize-none"
                  />
                </div>
              </div>

              {/* Блок добавления артикулов */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-t border-border-main pt-6">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="h-4.5 w-4.5 text-brand" />
                    Модификации и артикулы модели
                  </h4>
                  <button
                    type="button"
                    onClick={addVariantRow}
                    className="inline-flex items-center gap-1 bg-brand hover:bg-brand-hover text-white text-[10px] font-bold uppercase tracking-wider px-3.5 py-2 rounded-btn transition-colors cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" /> Добавить модификацию
                  </button>
                </div>

                {variantsList.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-xs border border-dashed border-border-main rounded-[16px]">
                    Нажмите «Добавить модификацию», чтобы создать артикулы для этой модели
                  </div>
                ) : (
                  <div className="space-y-4">
                    {variantsList.map((v, idx) => (
                      <div 
                        key={idx} 
                        className="relative p-5 bg-slate-50/50 border border-border-main rounded-[16px] grid gap-4 sm:grid-cols-2 md:grid-cols-4 items-end"
                      >
                        {variantsList.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeVariantRow(idx)}
                            className="absolute -top-2.5 -right-2.5 p-1 bg-white border border-border-main hover:text-red-650 rounded-full shadow-sm cursor-pointer"
                          >
                            <X className="h-3.5 w-3.5 text-slate-400 hover:text-red-500" />
                          </button>
                        )}

                        {/* Артикул */}
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider mb-1">
                            Артикул (SKU)
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="Автогенерация"
                            value={v.sku}
                            onChange={e => handleVariantFieldChange(idx, 'sku', e.target.value)}
                            className="w-full px-3 py-2 text-xs bg-white border border-border-main rounded-btn outline-none focus:border-brand font-mono font-bold"
                          />
                        </div>

                        {/* Выбор стола и стула для комплекта */}
                        {selectedCategorySlug === 'sets' && (
                          <div className="sm:col-span-2 md:col-span-4 grid gap-4 sm:grid-cols-2 md:grid-cols-3 bg-white p-4 rounded-xl border border-border-main mb-2">
                            {/* Стол */}
                            <div className="space-y-1">
                              <label className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider">
                                Стол из каталога
                              </label>
                              {v.attributes?.tableVariantId ? (
                                <div className="flex items-center justify-between gap-2 p-2 bg-slate-50 border border-border-main rounded-lg text-xs">
                                  <div className="min-w-0">
                                    <p className="font-bold text-slate-800 truncate">{v.attributes.tableName}</p>
                                    <p className="text-[10px] text-slate-400 font-medium">
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
                                    className="p-1 text-slate-400 hover:text-brand hover:bg-white rounded border border-transparent hover:border-border-main transition-all cursor-pointer shrink-0"
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
                                  className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 bg-brand/5 hover:bg-brand/10 border border-dashed border-brand/20 hover:border-brand/40 text-brand text-xs font-bold rounded-lg transition-colors cursor-pointer"
                                >
                                  <Plus className="h-4 w-4" /> Выбрать стол
                                </button>
                              )}
                            </div>

                            {/* Стул */}
                            <div className="space-y-1">
                              <label className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider">
                                Стул из каталога
                              </label>
                              {v.attributes?.chairVariantId ? (
                                <div className="flex items-center justify-between gap-2 p-2 bg-slate-50 border border-border-main rounded-lg text-xs">
                                  <div className="min-w-0">
                                    <p className="font-bold text-slate-800 truncate">{v.attributes.chairName}</p>
                                    <p className="text-[10px] text-slate-400 font-medium">{v.attributes.chairColor}</p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSetsSelectType('chair')
                                      setSetsSelectIndex(idx)
                                      setSetsSelectSearch(v.color || '')
                                      setSetsSelectOpen(true)
                                    }}
                                    className="p-1 text-slate-400 hover:text-brand hover:bg-white rounded border border-transparent hover:border-border-main transition-all cursor-pointer shrink-0"
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
                                  className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 bg-brand/5 hover:bg-brand/10 border border-dashed border-brand/20 hover:border-brand/40 text-brand text-xs font-bold rounded-lg transition-colors cursor-pointer"
                                >
                                  <Plus className="h-4 w-4" /> Выбрать стул
                                </button>
                              )}
                            </div>

                            {/* Количество стульев */}
                            <div className="space-y-1">
                              <label className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider">
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
                                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-border-main rounded-lg outline-none focus:border-brand disabled:opacity-50 text-slate-700 font-bold"
                                />
                                <span className="text-xs text-slate-400 font-medium shrink-0">шт</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Размер */}
                        {selectedCategorySlug !== 'chairs' && selectedCategorySlug !== 'sofas' && selectedCategorySlug !== 'sets' && (
                          <div>
                            <label className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider mb-1">
                              Размер
                            </label>
                            {selectedCategorySlug === 'tables' ? (
                              <select
                                value={v.size}
                                onChange={e => handleVariantFieldChange(idx, 'size', e.target.value)}
                                className="w-full px-3 py-2 text-xs bg-white border border-border-main rounded-btn outline-none focus:border-brand cursor-pointer font-bold text-slate-700"
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
                                className="w-full px-3 py-2 text-xs bg-white border border-border-main rounded-btn outline-none focus:border-brand"
                              />
                            )}
                          </div>
                        )}

                        {/* Цвет */}
                        {selectedCategorySlug !== 'sofas' && (
                          <div>
                            <label className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider mb-1">
                              Цвет патины / каркаса
                            </label>
                            <select
                              value={v.color}
                              onChange={e => handleVariantFieldChange(idx, 'color', e.target.value)}
                              className="w-full px-3 py-2 text-xs bg-white border border-border-main rounded-btn outline-none focus:border-brand cursor-pointer"
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
                            <label className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider mb-1">
                              Узор
                            </label>
                            <select
                              value={v.thickness}
                              onChange={e => handleVariantFieldChange(idx, 'thickness', e.target.value)}
                              className="w-full px-3 py-2 text-xs bg-white border border-border-main rounded-btn outline-none focus:border-brand cursor-pointer"
                            >
                              {PATTERNS.map(p => (
                                <option key={p} value={p}>{p}</option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Закупка */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider mb-1">
                            Закупка (₽)
                          </label>
                          <input
                            type="number"
                            min="0"
                            required
                            placeholder="12000"
                            value={v.purchasePrice}
                            onChange={e => handleVariantFieldChange(idx, 'purchasePrice', Number(e.target.value))}
                            className="w-full px-3 py-2 text-xs bg-white border border-border-main rounded-btn outline-none focus:border-brand"
                          />
                        </div>

                        {/* Розничная цена */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider mb-1">
                            Продажа (₽) *
                          </label>
                          <input
                            type="number"
                            min="0"
                            required
                            placeholder="19500"
                            value={v.salePrice}
                            onChange={e => handleVariantFieldChange(idx, 'salePrice', Number(e.target.value))}
                            className="w-full px-3 py-2 text-xs bg-white border border-border-main rounded-btn outline-none focus:border-brand font-bold text-brand"
                          />
                        </div>

                        {/* Вес */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider mb-1">
                            Вес (кг)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="25"
                            value={v.weight || ''}
                            onChange={e => handleVariantFieldChange(idx, 'weight', e.target.value)}
                            className="w-full px-3 py-2 text-xs bg-white border border-border-main rounded-btn outline-none focus:border-brand"
                          />
                        </div>

                        {/* Объем */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider mb-1">
                            Объем (м³)
                          </label>
                          <input
                            type="number"
                            step="0.0001"
                            placeholder="0.15"
                            value={v.volume || ''}
                            onChange={e => handleVariantFieldChange(idx, 'volume', e.target.value)}
                            className="w-full px-3 py-2 text-xs bg-white border border-border-main rounded-btn outline-none focus:border-brand"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Подвал формы */}
              <div className="flex justify-end gap-3 pt-6 border-t border-border-main shrink-0">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-btn transition-colors cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={loading === 'create'}
                  className="px-5 py-2 bg-brand hover:bg-brand-hover text-white rounded-btn text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm">
          <div className="relative w-full max-w-5xl bg-white border border-border-main rounded-card shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex h-14 items-center justify-between border-b border-border-main px-6 shrink-0">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Pencil className="h-4.5 w-4.5 text-brand" />
                Редактирование модели: {editProduct.name}
              </h3>
              <button
                onClick={() => setEditProduct(null)}
                className="p-1.5 text-slate-400 hover:text-slate-500 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
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
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Название модели *</label>
                  <input
                    type="text"
                    required
                    placeholder="Например, Стол Версаль"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-border-main rounded-btn outline-none transition focus:border-brand focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Базовый артикул (Base SKU) *</label>
                  <input
                    type="text"
                    required
                    placeholder="Например, T-VERS"
                    value={formBaseSku}
                    onChange={e => handleBaseSkuChange(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-border-main rounded-btn outline-none transition focus:border-brand focus:bg-white uppercase font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Категория мебели *</label>
                  <select
                    value={formCategoryId}
                    onChange={e => handleCategoryChange(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-border-main rounded-btn outline-none transition focus:border-brand focus:bg-white cursor-pointer"
                  >
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                {/* Выбор папки для столов и комплектов */}
                {formSupportsFolders && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Папка в каталоге</label>
                    <select
                      value={formFolderId}
                      onChange={e => setFormFolderId(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-border-main rounded-btn outline-none transition focus:border-brand focus:bg-white cursor-pointer font-bold text-brand"
                    >
                      <option value="">Без папки (в корне)</option>
                      {getFolderOptions(formCategoryId).map(f => (
                        <option key={f.id} value={f.id}>{f.label}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Ед. измерения</label>
                  <input
                    type="text"
                    required
                    value={formUnit}
                    onChange={e => setFormUnit(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-border-main rounded-btn outline-none transition focus:border-brand focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Учет остатков</label>
                  <select
                    value={formTrackInventory ? 'true' : 'false'}
                    onChange={e => setFormTrackInventory(e.target.value === 'true')}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-border-main rounded-btn outline-none transition focus:border-brand focus:bg-white cursor-pointer"
                  >
                    <option value="true">Да, отслеживать</option>
                    <option value="false">Нет, виртуальный товар</option>
                  </select>
                </div>

                <div className="sm:col-span-2 md:col-span-3">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Описание модели</label>
                  <textarea
                    rows={2}
                    value={formDescription}
                    onChange={e => setFormDescription(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-border-main rounded-btn outline-none transition focus:border-brand focus:bg-white resize-none"
                  />
                </div>
              </div>

              {/* Блок добавления артикулов */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-t border-border-main pt-6">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="h-4.5 w-4.5 text-brand" />
                    Модификации и артикулы модели
                  </h4>
                  <button
                    type="button"
                    onClick={addVariantRow}
                    className="inline-flex items-center gap-1 bg-brand hover:bg-brand-hover text-white text-[10px] font-bold uppercase tracking-wider px-3.5 py-2 rounded-btn transition-colors cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" /> Добавить модификацию
                  </button>
                </div>

                {variantsList.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-xs border border-dashed border-border-main rounded-[16px]">
                    Нажмите «Добавить модификацию», чтобы создать артикулы для этой модели
                  </div>
                ) : (
                  <div className="space-y-4">
                    {variantsList.map((v, idx) => (
                      <div 
                        key={idx} 
                        className="relative p-5 bg-slate-50/50 border border-border-main rounded-[16px] grid gap-4 sm:grid-cols-2 md:grid-cols-4 items-end"
                      >
                        {variantsList.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeVariantRow(idx)}
                            className="absolute -top-2.5 -right-2.5 p-1 bg-white border border-border-main hover:text-red-650 rounded-full shadow-sm cursor-pointer"
                          >
                            <X className="h-3.5 w-3.5 text-slate-400 hover:text-red-500" />
                          </button>
                        )}

                        {/* Артикул */}
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider mb-1">
                            Артикул (SKU)
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="Автогенерация"
                            value={v.sku}
                            onChange={e => handleVariantFieldChange(idx, 'sku', e.target.value)}
                            className="w-full px-3 py-2 text-xs bg-white border border-border-main rounded-btn outline-none focus:border-brand font-mono font-bold"
                          />
                        </div>

                        {/* Выбор стола и стула для комплекта */}
                        {selectedCategorySlug === 'sets' && (
                          <div className="sm:col-span-2 md:col-span-4 grid gap-4 sm:grid-cols-2 md:grid-cols-3 bg-white p-4 rounded-xl border border-border-main mb-2">
                            {/* Стол */}
                            <div className="space-y-1">
                              <label className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider">
                                Стол из каталога
                              </label>
                              {v.attributes?.tableVariantId ? (
                                <div className="flex items-center justify-between gap-2 p-2 bg-slate-50 border border-border-main rounded-lg text-xs">
                                  <div className="min-w-0">
                                    <p className="font-bold text-slate-800 truncate">{v.attributes.tableName}</p>
                                    <p className="text-[10px] text-slate-400 font-medium">
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
                                    className="p-1 text-slate-400 hover:text-brand hover:bg-white rounded border border-transparent hover:border-border-main transition-all cursor-pointer shrink-0"
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
                                  className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 bg-brand/5 hover:bg-brand/10 border border-dashed border-brand/20 hover:border-brand/40 text-brand text-xs font-bold rounded-lg transition-colors cursor-pointer"
                                >
                                  <Plus className="h-4 w-4" /> Выбрать стол
                                </button>
                              )}
                            </div>

                            {/* Стул */}
                            <div className="space-y-1">
                              <label className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider">
                                Стул из каталога
                              </label>
                              {v.attributes?.chairVariantId ? (
                                <div className="flex items-center justify-between gap-2 p-2 bg-slate-50 border border-border-main rounded-lg text-xs">
                                  <div className="min-w-0">
                                    <p className="font-bold text-slate-800 truncate">{v.attributes.chairName}</p>
                                    <p className="text-[10px] text-slate-400 font-medium">{v.attributes.chairColor}</p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSetsSelectType('chair')
                                      setSetsSelectIndex(idx)
                                      setSetsSelectSearch(v.color || '')
                                      setSetsSelectOpen(true)
                                    }}
                                    className="p-1 text-slate-400 hover:text-brand hover:bg-white rounded border border-transparent hover:border-border-main transition-all cursor-pointer shrink-0"
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
                                  className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 bg-brand/5 hover:bg-brand/10 border border-dashed border-brand/20 hover:border-brand/40 text-brand text-xs font-bold rounded-lg transition-colors cursor-pointer"
                                >
                                  <Plus className="h-4 w-4" /> Выбрать стул
                                </button>
                              )}
                            </div>

                            {/* Количество стульев */}
                            <div className="space-y-1">
                              <label className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider">
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
                                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-border-main rounded-lg outline-none focus:border-brand disabled:opacity-50 text-slate-700 font-bold"
                                />
                                <span className="text-xs text-slate-400 font-medium shrink-0">шт</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Размер */}
                        {selectedCategorySlug !== 'chairs' && selectedCategorySlug !== 'sofas' && selectedCategorySlug !== 'sets' && (
                          <div>
                            <label className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider mb-1">
                              Размер
                            </label>
                            {selectedCategorySlug === 'tables' ? (
                              <select
                                value={v.size}
                                onChange={e => handleVariantFieldChange(idx, 'size', e.target.value)}
                                className="w-full px-3 py-2 text-xs bg-white border border-border-main rounded-btn outline-none focus:border-brand cursor-pointer font-bold text-slate-700"
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
                                className="w-full px-3 py-2 text-xs bg-white border border-border-main rounded-btn outline-none focus:border-brand"
                              />
                            )}
                          </div>
                        )}

                        {/* Цвет */}
                        {selectedCategorySlug !== 'sofas' && (
                          <div>
                            <label className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider mb-1">
                              Цвет патины / каркаса
                            </label>
                            <select
                              value={v.color}
                              onChange={e => handleVariantFieldChange(idx, 'color', e.target.value)}
                              className="w-full px-3 py-2 text-xs bg-white border border-border-main rounded-btn outline-none focus:border-brand cursor-pointer"
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
                            <label className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider mb-1">
                              Узор
                            </label>
                            <select
                              value={v.thickness}
                              onChange={e => handleVariantFieldChange(idx, 'thickness', e.target.value)}
                              className="w-full px-3 py-2 text-xs bg-white border border-border-main rounded-btn outline-none focus:border-brand cursor-pointer"
                            >
                              {PATTERNS.map(p => (
                                <option key={p} value={p}>{p}</option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Закупка */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider mb-1">
                            Закупка (₽)
                          </label>
                          <input
                            type="number"
                            min="0"
                            required
                            placeholder="12000"
                            value={v.purchasePrice}
                            onChange={e => handleVariantFieldChange(idx, 'purchasePrice', Number(e.target.value))}
                            className="w-full px-3 py-2 text-xs bg-white border border-border-main rounded-btn outline-none focus:border-brand"
                          />
                        </div>

                        {/* Розничная цена */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider mb-1">
                            Продажа (₽) *
                          </label>
                          <input
                            type="number"
                            min="0"
                            required
                            placeholder="19500"
                            value={v.salePrice}
                            onChange={e => handleVariantFieldChange(idx, 'salePrice', Number(e.target.value))}
                            className="w-full px-3 py-2 text-xs bg-white border border-border-main rounded-btn outline-none focus:border-brand font-bold text-brand"
                          />
                        </div>

                        {/* Вес */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider mb-1">
                            Вес (кг)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="25"
                            value={v.weight || ''}
                            onChange={e => handleVariantFieldChange(idx, 'weight', e.target.value)}
                            className="w-full px-3 py-2 text-xs bg-white border border-border-main rounded-btn outline-none focus:border-brand"
                          />
                        </div>

                        {/* Объем */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider mb-1">
                            Объем (м³)
                          </label>
                          <input
                            type="number"
                            step="0.0001"
                            placeholder="0.15"
                            value={v.volume || ''}
                            onChange={e => handleVariantFieldChange(idx, 'volume', e.target.value)}
                            className="w-full px-3 py-2 text-xs bg-white border border-border-main rounded-btn outline-none focus:border-brand"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Подвал формы */}
              <div className="flex justify-end gap-3 pt-6 border-t border-border-main shrink-0">
                <button
                  type="button"
                  onClick={() => setEditProduct(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-btn transition-colors cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={loading === 'edit'}
                  className="px-5 py-2 bg-brand hover:bg-brand-hover text-white rounded-btn text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50"
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
            <div className="relative w-full max-w-4xl bg-white border border-border-main rounded-card shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
              {/* Шапка */}
              <div className="flex h-14 items-center justify-between border-b border-border-main px-6 shrink-0 bg-slate-50/50">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Grid className="h-4.5 w-4.5 text-brand" />
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
                  className="p-1.5 text-slate-400 hover:text-slate-500 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Поисковая строка */}
              <div className="p-4 border-b border-border-main bg-white shrink-0">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none z-10" />
                  <input
                    type="text"
                    placeholder="Поиск по названию модели, артикулу, размеру или цвету..."
                    value={setsSelectSearch}
                    onChange={e => setSetsSelectSearch(e.target.value)}
                    className="w-full !pl-10 pr-4 py-2 text-xs bg-slate-50 border border-border-main rounded-btn text-slate-850 placeholder-slate-400 outline-none transition focus:border-brand focus:bg-white"
                  />
                </div>
              </div>

              {/* Тело модалки */}
              <div className="flex-1 overflow-y-auto p-6 min-h-[300px]">
                {isSearching ? (
                  // Результаты поиска
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Результаты поиска ({matchedVariants.length})</h4>
                    {matchedVariants.length === 0 ? (
                      <div className="text-center py-12 text-slate-400 text-xs font-semibold uppercase tracking-wider">
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
                              className="p-4 bg-white border border-border-main hover:border-brand/40 hover:shadow-sm rounded-xl cursor-pointer transition-all flex flex-col justify-between"
                            >
                              <div>
                                <h5 className="font-bold text-xs text-slate-800">{product.name}</h5>
                                <p className="text-[10px] font-mono text-slate-400 font-bold mt-0.5">{variant.sku}</p>
                                <p className="text-[10px] text-slate-500 font-medium mt-1">{desc || 'Базовый вариант'}</p>
                              </div>
                              <div className="mt-3 pt-2 border-t border-slate-55 bg-slate-50/50 rounded p-1.5 text-right">
                                <span className="text-[10px] font-bold text-brand uppercase tracking-wider">Выбрать</span>
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
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <button
                        type="button"
                        onClick={() => setSetsSelectFolderId(null)}
                        className="hover:text-brand transition-colors cursor-pointer"
                      >
                        {targetCategory.name}
                      </button>
                      {crumbs.map((crumb) => (
                        <div key={crumb.id} className="flex items-center gap-1.5">
                          <span>/</span>
                          <button
                            type="button"
                            onClick={() => setSetsSelectFolderId(crumb.id)}
                            className="hover:text-brand transition-colors cursor-pointer"
                          >
                            {crumb.name}
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Папки */}
                    {activeFolders.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Папки</h4>
                        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
                          {activeFolders.map(f => (
                            <div
                              key={f.id}
                              onClick={() => setSetsSelectFolderId(f.id)}
                              className="p-4 bg-slate-50 border border-border-main hover:border-brand/40 hover:bg-white rounded-xl cursor-pointer transition-all flex items-center gap-3"
                            >
                              <Folder className="h-5 w-5 text-brand/70" />
                              <span className="font-bold text-xs text-slate-800 truncate">{f.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Товары */}
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Модели</h4>
                      {activeProducts.length === 0 ? (
                        <div className="text-center py-12 text-slate-400 text-xs font-semibold uppercase tracking-wider border border-dashed border-border-main rounded-xl">
                          В этой папке нет товаров
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {activeProducts.map(p => (
                            <div key={p.id} className="border border-border-main rounded-xl overflow-hidden bg-white">
                              <div className="bg-slate-50/50 px-4 py-2 border-b border-border-main flex items-center justify-between">
                                <span className="font-bold text-xs text-slate-850">{p.name}</span>
                                <span className="text-[9px] font-bold text-slate-400 uppercase font-mono">{p.baseSku}</span>
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
                                      className="py-2.5 px-3 hover:bg-slate-50 flex items-center justify-between text-xs cursor-pointer transition-colors"
                                    >
                                      <div>
                                        <p className="font-mono font-bold text-slate-800">{v.sku}</p>
                                        <p className="text-[10px] text-slate-455 font-medium mt-0.5">{desc || 'Базовый вариант'}</p>
                                      </div>
                                      <span className="text-[10px] font-bold text-brand uppercase tracking-wider">Выбрать</span>
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
