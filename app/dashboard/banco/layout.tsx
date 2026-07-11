'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'

const TABS: { href: string; label: string }[] = [
  { href: '/dashboard/banco/visao-geral', label: 'Visão Geral' },
  { href: '/dashboard/banco/extrato', label: 'Extrato' },
  { href: '/dashboard/banco/pix-transferencias', label: 'PIX & Transferências' },
  { href: '/dashboard/banco/cartoes', label: 'Cartões' },
  { href: '/dashboard/banco/investimentos', label: 'Investimentos' },
]

export default function BancoLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const routeBadge = pathname.replace(/^\/dashboard/, 'factorone.app')

  return (
    <div style={{ margin: '-20px -24px 14px', background: 'var(--card)' }}>
      <div className="mod-head">
        <div className="mod-title">
          <h1>Banco</h1>
          <span className="route-v2">{routeBadge}</span>
          <div className="mod-actions">
            <Link href="/dashboard/conexoes" className="btn-v2" style={{ textDecoration: 'none', display: 'inline-block' }}>+ Conectar banco</Link>
          </div>
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
