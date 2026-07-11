'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'

const TABS: { href: string; label: string }[] = [
  { href: '/dashboard/contabil-fiscal/visao-geral', label: 'Visão Geral' },
  { href: '/dashboard/contabil-fiscal/obrigacoes', label: 'Obrigações' },
  { href: '/dashboard/contabil-fiscal/impostos-regime', label: 'Impostos & Regime' },
  { href: '/dashboard/contabil-fiscal/cofre-fiscal', label: 'Cofre Fiscal' },
  { href: '/dashboard/contabil-fiscal/portal-contador', label: 'Portal do Contador' },
]

export default function ContabilFiscalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const routeBadge = pathname.replace(/^\/dashboard/, 'factorone.app')

  return (
    <div style={{ margin: '-20px -24px 14px', background: 'var(--card)' }}>
      <div className="mod-head">
        <div className="mod-title">
          <h1>Contábil &amp; Fiscal</h1>
          <span className="route-v2">{routeBadge}</span>
        </div>
        <div className="mod-tabs">
          {TABS.map(t => (
            <Link key={t.href} href={t.href} className={`mod-tab${pathname === t.href ? ' on' : ''}`}>
              {t.label}
            </Link>
          ))}
        </div>
      </div>
      <div style={{ padding: '14px 24px 0' }}>
        {children}
      </div>
    </div>
  )
}
