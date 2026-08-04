'use client'

import React, { useState, useTransition } from 'react'
import { changeOwnPasswordAction } from '@/app/login/actions'
import { Lock, Eye, EyeOff, ShieldAlert, CheckCircle2, RefreshCw } from 'lucide-react'

interface MustChangePasswordModalProps {
  profileName: string
}

export default function MustChangePasswordModal({ profileName }: MustChangePasswordModalProps) {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    if (!newPassword || newPassword.length < 3) {
      setErrorMsg('Новый пароль должен быть длиной не менее 3 символов')
      return
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('Введенные пароли не совпадают')
      return
    }

    startTransition(async () => {
      const res = await changeOwnPasswordAction(newPassword)
      if (res.error) {
        setErrorMsg(res.error)
      } else {
        setSuccessMsg('Пароль успешно изменён!')
        setTimeout(() => {
          window.location.reload()
        }, 800)
      }
    })
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md select-none animate-fade-in">
      <div className="w-full max-w-md bg-[var(--bg-surface)] border border-[var(--border-primary)] rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5 text-left">
        {/* Заголовок */}
        <div className="flex items-center gap-3 pb-4 border-b border-[var(--border-primary)]">
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center font-bold shrink-0">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[var(--text-primary)]">
              Обязательная смена пароля
            </h2>
            <p className="text-[11px] text-[var(--text-tertiary)]">
              Здравствуйте, <span className="font-semibold text-[var(--text-primary)]">{profileName}</span>!
            </p>
          </div>
        </div>

        {/* Описание */}
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 rounded-xl text-xs space-y-1">
          <div className="font-semibold flex items-center gap-1.5">
            <ShieldAlert className="h-4 w-4 shrink-0 text-amber-500" />
            Установлен временный пароль
          </div>
          <div className="text-[11px] leading-relaxed">
            Вам был задан временный пароль. Пожалуйста, придумывайте и введите ваш собственный постоянный пароль для входа в систему.
          </div>
        </div>

        {/* Сообщения об ошибках / успехе */}
        {errorMsg && (
          <div className="p-3 bg-[var(--danger-soft)] border border-[var(--danger)]/20 text-[var(--danger)] rounded-xl text-xs font-medium">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-[var(--success-soft)] border border-[var(--success)]/20 text-[var(--success)] rounded-xl text-xs font-medium flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            {successMsg}
          </div>
        )}

        {/* Форма смены пароля */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[var(--text-primary)]">
              Новый пароль <span className="text-[var(--danger)]">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={3}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Придумайте надежный пароль"
                className="erp-input pr-10 text-xs w-full"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] p-1 cursor-pointer"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[var(--text-primary)]">
              Повторите новый пароль <span className="text-[var(--danger)]">*</span>
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              required
              minLength={3}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Повторно введите новый пароль"
              className="erp-input text-xs w-full"
            />
          </div>

          <button
            type="submit"
            disabled={isPending || !newPassword || !confirmPassword}
            className="w-full erp-button-primary py-2.5 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
          >
            {isPending ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Сохранение пароля...
              </>
            ) : (
              <>
                <Lock className="h-4 w-4" />
                Сохранить новый пароль
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
