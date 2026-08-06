export default function DashboardLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-5" aria-busy="true" aria-label="Загрузка раздела">
      <div className="h-7 w-56 animate-pulse rounded-md bg-[var(--bg-surface-hover)]" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="erp-card h-24 animate-pulse bg-[var(--bg-surface-hover)]" />
        ))}
      </div>
      <div className="erp-card h-80 animate-pulse bg-[var(--bg-surface-hover)]" />
    </div>
  )
}
