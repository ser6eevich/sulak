import { logoutAction } from '@/app/login/actions'

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg-page px-4 select-none">
      <div className="w-full max-w-md text-center bg-white p-8 rounded-card border border-border-main shadow-sm">
        <h1 className="text-6xl font-black tracking-tight text-brand">403</h1>
        <h2 className="mt-4 text-base font-bold text-slate-800 uppercase tracking-wider">
          Доступ ограничен
        </h2>
        <p className="mt-2 text-xs text-slate-500 font-medium leading-relaxed">
          У вас нет прав для доступа к этому разделу. Если вы считаете, что это ошибка, пожалуйста, обратитесь к администратору системы.
        </p>
        <div className="mt-6">
          <form action={logoutAction}>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-btn bg-slate-900 hover:bg-slate-800 px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition-colors cursor-pointer"
            >
              Выйти и войти под другим аккаунтом
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
