'use client'

type Props = {
  title: string
  subtitle?: string
  /** Badge no canto direito (estilo mockups FactorOne) */
  badge?: 'live' | 'tempo-real' | 'none'
  children?: React.ReactNode
}

export default function DashboardPageHeader({ title, subtitle, badge = 'live', children }: Props) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight text-gray-900 md:text-2xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-gray-500">{subtitle}</p> : null}
      </div>
      <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
        {children}
        {badge === 'live' && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--fo-border)] bg-white px-3 py-1 text-xs font-semibold text-[var(--fo-teal)] shadow-sm">
            <span className="fo-live-dot" />
            LIVE
          </span>
        )}
        {badge === 'tempo-real' && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--fo-border)] bg-[var(--fo-teal-bg)] px-3 py-1 text-xs font-semibold text-[var(--fo-teal)]">
            <span className="fo-live-dot" />
            Tempo real
          </span>
        )}
      </div>
    </div>
  )
}
