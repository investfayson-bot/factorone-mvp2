'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { href: '/dashboard/conta-pj', label: 'Dashboard' },
  { href: '/dashboard/conta-pj/extrato', label: 'Extrato' },
  { href: '/dashboard/conta-pj/investimentos', label: 'Investimentos' },
  { href: '/dashboard/conta-pj/transferencias', label: 'Transferências' },
  { href: '/dashboard/conta-pj/conectar-banco', label: 'Conectar Banco' },
]

export default function ContaPJLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <div>
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-6 py-3 backdrop-blur">
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => {
            const active = pathname === t.href
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`rounded-xl px-3 py-1.5 text-sm font-medium transition-all ${active ? 'bg-emerald-700 text-white shadow-sm' : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}
              >
                {t.label}
              </Link>
            )
          })}
        </div>
      </div>
      {children}
    </div>
  )
}
