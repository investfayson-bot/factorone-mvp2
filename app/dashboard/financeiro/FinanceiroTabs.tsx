'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

const tabs = [
  { href: '/dashboard/financeiro', label: 'Resumo', param: null as string | null },
  { href: '/dashboard/financeiro?tab=pagar', label: 'A Pagar', param: 'pagar' },
  { href: '/dashboard/financeiro?tab=receber', label: 'A Receber', param: 'receber' },
  { href: '/dashboard/financeiro?tab=conciliacao', label: 'Conciliação', param: 'conciliacao' },
  { href: '/dashboard/financeiro?tab=aging', label: 'Aging Report', param: 'aging' },
]

export default function FinanceiroTabs() {
  const searchParams = useSearchParams()
  const current = searchParams.get('tab')

  return (
    <div className="sticky top-0 z-10 border-b border-gray-200/90 bg-white/95 px-6 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap gap-2">
        {tabs.map((t) => {
          const active = t.param == null ? !current || current === 'resumo' : current === t.param
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`rounded-xl px-3 py-1.5 text-sm font-medium transition-all ${
                active
                  ? 'bg-emerald-700 text-white shadow-sm'
                  : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {t.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
