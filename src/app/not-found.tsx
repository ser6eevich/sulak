import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--bg-app)] px-4 text-center">
      <div className="max-w-md">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">Ошибка 404</p>
        <h1 className="mt-3 text-2xl font-semibold text-[var(--text-primary)]">Страница не найдена</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">Ссылка устарела или у раздела изменился адрес.</p>
        <Link href="/dashboard" className="erp-button-primary mt-6 inline-flex">Вернуться в CRM</Link>
      </div>
    </main>
  )
}
