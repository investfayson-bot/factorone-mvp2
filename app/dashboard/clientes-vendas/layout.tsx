'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'

const TABS: { href: string; label: string }[] = [
  { href: '/dashboard/clientes-vendas/visao-geral', label: 'Visão Geral' },
  { href: '/dashboard/clientes-vendas/pipeline', label: 'Pipeline' },
  { href: '/dashboard/clientes-vendas/agendamento', label: 'Agendamento' },
  { href: '/dashboard/clientes-vendas/propostas', label: 'Propostas' },
  { href: '/dashboard/clientes-vendas/pos-venda', label: 'Pós-venda' },
]

// "Mais ▾" abriga o Dashboard de Ofertas (spec Fase 6) e os atalhos pras
// telas antigas do CRM que continuam standalone.
const MAIS: { href: string; label: string }[] = [
  { href: '/dashboard/clientes-vendas/ofertas', label: 'Dashboard de Ofertas' },
  { href: '/dashboard/crm', label: 'CRM completo (clientes)' },
  { href: '/dashboard/captacao', label: 'Captação de Leads' },
]

export default function ClientesVendasLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [maisAberto, setMaisAberto] = useState(false)
  const routeBadge = pathname.replace(/^\/dashboard/, 'factorone.app')
  const emMais = MAIS.some(m => pathname === m.href)

  return (
    <div style={{ margin: '-20px -24px 14px', background: 'var(--card)' }}>
      <div className="mod-head">
        <div className="mod-title">
          <h1>Clientes &amp; Vendas</h1>
          <span className="route-v2">{routeBadge}</span>
        </div>
        <div className="mod-tabs">
          {TABS.map(t => (
            <Link key={t.href} href={t.href} className={`mod-tab${pathname === t.href ? ' on' : ''}`}>
              {t.label}
            </Link>
          ))}
          <span style={{ position: 'relative' }}>
            <span className={`mod-tab${emMais ? ' on' : ''}`} style={{ cursor: 'pointer' }} onClick={() => setMaisAberto(v => !v)}>Mais ▾</span>
            {maisAberto && (
              <span style={{ position: 'absolute', top: '100%', right: 0, zIndex: 60, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.12)', minWidth: 210, padding: 6, display: 'block' }}>
                {MAIS.map(m => (
                  <Link key={m.href} href={m.href} onClick={() => setMaisAberto(false)} style={{ display: 'block', padding: '8px 12px', borderRadius: 7, fontSize: 12.5, fontWeight: 600, color: pathname === m.href ? 'var(--acc-ink)' : 'var(--ink)', background: pathname === m.href ? 'var(--acc-soft)' : 'transparent', textDecoration: 'none' }}>
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
