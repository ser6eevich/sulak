'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { Folder, Image as ImageIcon, ChevronRight, ArrowLeft, Loader2, X, AlertCircle } from 'lucide-react'

interface YandexItem {
  name: string
  type: 'dir' | 'file'
  path: string
  preview: string | null
  size: number
  mimeType: string | null
}

interface YandexDiskPickerModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectImage: (imageUrl: string) => void
}

export function YandexDiskPickerModal({ isOpen, onClose, onSelectImage }: YandexDiskPickerModalProps) {
  const [pathHistory, setPathHistory] = useState<{ name: string; path: string }[]>([
    { name: 'Корень', path: '/' }
  ])
  const [items, setItems] = useState<YandexItem[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [selectingPath, setSelectingPath] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadResources = useCallback(async (path: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/yandex-disk/resources?path=${encodeURIComponent(path)}`)
      const data = await res.json()

      if (!res.ok || data.error) {
        setError(data.error || 'Не удалось загрузить содержимое папки')
        setItems([])
      } else {
        setItems(data.items || [])
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка подключения к Яндекс.Диску')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isOpen) return
    const timeoutId = window.setTimeout(() => {
      setPathHistory([{ name: 'Корень', path: '/' }])
      void loadResources('/')
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [isOpen, loadResources])

  const handleOpenFolder = (folderName: string, folderPath: string) => {
    setPathHistory(prev => [...prev, { name: folderName, path: folderPath }])
    loadResources(folderPath)
  }

  const handleNavigateBreadcrumb = (index: number) => {
    const target = pathHistory[index]
    if (target) {
      setPathHistory(prev => prev.slice(0, index + 1))
      loadResources(target.path)
    }
  }

  const handleGoBack = () => {
    if (pathHistory.length > 1) {
      handleNavigateBreadcrumb(pathHistory.length - 2)
    }
  }

  const handleSelectFile = async (item: YandexItem) => {
    setSelectingPath(item.path)
    try {
      const res = await fetch('/api/yandex-disk/select-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: item.path,
        }),
      })

      const data = await res.json()

      if (!res.ok || data.error) {
        alert(data.error || 'Не удалось выбрать фото')
      } else if (data.imageUrl) {
        onSelectImage(data.imageUrl)
        onClose()
      }
    } catch (err: unknown) {
      alert('Ошибка при выборе фотографии: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setSelectingPath(null)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
        
        {/* Шапка модального окна */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-500/10 text-yellow-600 rounded-xl">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Выбор фото из Яндекс.Диска</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Выберите готовый снимок из галереи склада</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Навигационная панель (Хлебные крошки) */}
        <div className="flex items-center gap-2 px-6 py-3 bg-zinc-100/70 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800 text-sm overflow-x-auto">
          {pathHistory.length > 1 && (
            <button
              onClick={handleGoBack}
              className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg text-zinc-600 dark:text-zinc-300 transition"
              title="Назад"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}

          {pathHistory.map((crumb, idx) => (
            <React.Fragment key={crumb.path}>
              {idx > 0 && <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0" />}
              <button
                onClick={() => handleNavigateBreadcrumb(idx)}
                className={`font-medium whitespace-nowrap transition ${
                  idx === pathHistory.length - 1
                    ? 'text-yellow-600 dark:text-yellow-500 cursor-default'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                {crumb.name}
              </button>
            </React.Fragment>
          ))}
        </div>

        {/* Содержимое папки / Сетка файлов */}
        <div className="flex-1 overflow-y-auto p-6 min-h-[350px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
              <Loader2 className="w-8 h-8 animate-spin text-yellow-500 mb-3" />
              <p className="text-sm">Загрузка содержимого Яндекс.Диска...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-3 bg-red-500/10 text-red-500 rounded-full mb-3">
                <AlertCircle className="w-8 h-8" />
              </div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">{error}</p>
              <p className="text-xs text-zinc-500 max-w-md">Убедитесь, что в Настройках CRM указана корректная ссылка на общую папку Яндекс.Диска</p>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center text-zinc-400">
              <Folder className="w-12 h-12 stroke-[1.5] mb-2 text-zinc-300 dark:text-zinc-600" />
              <p className="text-sm">Эта папка пуста или не содержит изображений</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {items.map(item => {
                if (item.type === 'dir') {
                  return (
                    <button
                      key={item.path}
                      onClick={() => handleOpenFolder(item.name, item.path)}
                      className="group flex flex-col items-center p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-yellow-500/50 hover:bg-yellow-500/5 transition text-center"
                    >
                      <div className="p-3 bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 rounded-xl mb-2 group-hover:scale-110 transition">
                        <Folder className="w-8 h-8 fill-current stroke-none" />
                      </div>
                      <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 line-clamp-3 break-words w-full leading-snug" title={item.name}>
                        {item.name}
                      </span>
                    </button>
                  )
                }

                const isSelecting = selectingPath === item.path

                return (
                  <button
                    key={item.path}
                    onClick={() => handleSelectFile(item)}
                    disabled={isSelecting || selectingPath !== null}
                    className="group relative flex flex-col rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 hover:border-yellow-500 hover:ring-2 hover:ring-yellow-500/30 transition text-left bg-zinc-50 dark:bg-zinc-800/40"
                  >
                    <div className="aspect-square w-full bg-zinc-200 dark:bg-zinc-800 relative overflow-hidden flex items-center justify-center">
                      {item.preview ? (
                        <Image
                          src={item.preview}
                          alt={item.name}
                          fill
                          sizes="(max-width: 640px) 50vw, 200px"
                          unoptimized
                          className="object-cover group-hover:scale-105 transition duration-300"
                        />
                      ) : (
                        <ImageIcon className="w-8 h-8 text-zinc-400" />
                      )}

                      {isSelecting && (
                        <div className="absolute inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center text-white">
                          <Loader2 className="w-6 h-6 animate-spin" />
                        </div>
                      )}
                    </div>
                    <div className="p-2">
                      <p className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300 line-clamp-2 break-words leading-tight" title={item.name}>
                        {item.name}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Футер */}
        <div className="px-6 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex items-center justify-between text-xs text-zinc-500">
          <span>Кликните по фотографии для её быстрой подстановки в заказ</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-xl font-medium transition"
          >
            Закрыть
          </button>
        </div>

      </div>
    </div>
  )
}
