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
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold text-emerald-800 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            LIVE
          </span>
        )}
        {badge === 'tempo-real' && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50/80 px-3 py-1 text-xs font-semibold text-emerald-800">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Tempo real
          </span>
        )}
      </div>
    </div>
  )
}
