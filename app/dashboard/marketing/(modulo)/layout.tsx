'use client'

// Casca do módulo Marketing (Fase 7) — route group: só as 5 sub-abas novas
// ganham o header; marketing/central e marketing/site (telas antigas)
// continuam standalone, linkadas no "Mais ▾".

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'

const TABS: { href: string; label: string }[] = [
  { href: '/dashboard/marketing/visao-geral', label: 'Visão Geral' },
  { href: '/dashboard/marketing/calendario', label: 'Calendário Editorial' },
  { href: '/dashboard/marketing/trafego', label: 'Tráfego Pago' },
  { href: '/dashboard/marketing/campanhas', label: 'Campanhas' },
  { href: '/dashboard/marketing/email', label: 'E-mail Marketing' },
]

const MAIS: { href: string; label: string }[] = [
  { href: '/dashboard/marketing/central', label: 'Central (legado)' },
  { href: '/dashboard/marketing/site', label: 'Meu site' },
  { href: '/dashboard/captacao', label: 'Captação de Leads' },
]

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [maisAberto, setMaisAberto] = useState(false)
  const routeBadge = pathname.replace(/^\/dashboard/, 'factorone.app')

  return (
    <div style={{ margin: '-20px -24px 14px', background: 'var(--card)' }}>
      <div className="mod-head">
        <div className="mod-title">
          <h1>Marketing</h1>
          <span className="route-v2">{routeBadge}</span>
        </div>
        <div className="mod-tabs">
          {TABS.map(t => (
            <Link key={t.href} href={t.href} className={`mod-tab${pathname === t.href ? ' on' : ''}`}>{t.label}</Link>
          ))}
          <span style={{ position: 'relative' }}>
            <span className="mod-tab" style={{ cursor: 'pointer' }} onClick={() => setMaisAberto(v => !v)}>Mais ▾</span>
            {maisAberto && (
              <span style={{ position: 'absolute', top: '100%', right: 0, zIndex: 60, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.12)', minWidth: 190, padding: 6, display: 'block' }}>
                {MAIS.map(m => (
                  <Link key={m.href} href={m.href} onClick={() => setMaisAberto(false)} style={{ display: 'block', padding: '8px 12px', borderRadius: 7, fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', textDecoration: 'none' }}>
                    {m.label}
                  </Link>
                ))}
              </span>
            )}
          </span>
        </div>
      </div>
      <div style={{ padding: '14px 24px 0' }}>
        {children}
      </div>
    </div>
  )
}
