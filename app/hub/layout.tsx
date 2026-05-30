'use client'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type NavItem = { href: string; icon: string; label: string; badge?: string; badgeColor?: string; match?: (p: string) => boolean }

const NAV: { label: string; items: NavItem[] }[] = [
  {
    label: 'FactorHub',
    items: [
      { href: '/hub', icon: 'fa-house', label: 'Visão Geral', match: (p) => p === '/hub' || p === '/hub/' },
      { href: '/hub/agentes', icon: 'fa-robot', label: 'Agentes IA', badge: 'AI', badgeColor: '#7C3AED' },
      { href: '/hub/uso', icon: 'fa-chart-bar', label: 'Consumo & Custo' },
    ],
  },
  {
    label: 'Operação',
    items: [
      { href: '/hub/projetos', icon: 'fa-diagram-project', label: 'Projetos' },
      { href: '/hub/ideias', icon: 'fa-lightbulb', label: 'Ideias' },
      { href: '/hub/clientes', icon: 'fa-users', label: 'Clientes & Leads' },
      { href: '/hub/eventos', icon: 'fa-calendar-star', label: 'Eventos' },
      { href: '/hub/conteudo', icon: 'fa-pen-nib', label: 'Conteúdo' },
    ],
  },
]

const TITLES: Record<string, string> = {
  '/hub': 'FactorHub — Visão Geral',
  '/hub/agentes': 'Agentes IA',
  '/hub/uso': 'Consumo & Custo de Tokens',
  '/hub/projetos': 'Projetos',
  '/hub/ideias': 'Ideias',
  '/hub/clientes': 'Clientes & Leads',
  '/hub/eventos': 'Eventos',
  '/hub/conteudo': 'Conteúdo',
}

function isActive(pathname: string, item: NavItem) {
  if (item.match) return item.match(pathname)
  return pathname === item.href || pathname.startsWith(item.href + '/')
}

export default function HubLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (!u) { router.push('/auth'); return }
      setUser(u)
    })
  }, [router])

  async function sair() {
    await supabase.auth.signOut()
    router.push('/auth')
  }

  const pageTitle = TITLES[pathname] ?? 'FactorHub'
  const initials = user?.email?.slice(0, 2).toUpperCase() ?? 'FH'

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {sidebarOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 998, background: 'rgba(15,23,42,.45)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className="sidebar" style={{ transform: sidebarOpen ? 'translateX(0)' : undefined } as React.CSSProperties}>
        <div className="sb-logo">
          <div className="sb-logo-txt">Factor<span>Hub</span></div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', marginTop: 2, fontWeight: 500 }}>
            Hub de operações &amp; IA
          </div>
        </div>
        <nav className="sb-nav">
          {NAV.map((group) => (
            <div key={group.label}>
              <div className="nav-section">{group.label}</div>
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-item${isActive(pathname, item) ? ' active' : ''}`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <i className={`fa-solid ${item.icon}`} />
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.badge && (
                    <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 20, background: item.badgeColor, color: '#fff' }}>
                      {item.badge}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          ))}
          <div className="nav-section">Voltar</div>
          <Link href="/dashboard" className="nav-item">
            <i className="fa-solid fa-arrow-left" />
            <span style={{ flex: 1 }}>FactorOne</span>
          </Link>
        </nav>
        <div className="sb-footer">
          <div className="sb-co" onClick={sair} title="Clique para sair">
            <div className="sb-co-av">{initials}</div>
            <div>
              <div className="sb-co-name" style={{ maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.email?.split('@')[0] || 'Conta'}
              </div>
              <div className="sb-co-plan">FactorHub</div>
            </div>
          </div>
        </div>
      </aside>

      <div className="fo-main">
        <div className="topbar">
          <button
            className="sb-hamburger"
            onClick={() => setSidebarOpen((v) => !v)}
            style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--navy)', padding: '4px 8px', borderRadius: 6 }}
          >
            <i className="fa-solid fa-bars" style={{ fontSize: 16 }} />
          </button>
          <div className="topbar-title">{pageTitle}</div>
          <div className="live-badge"><div className="live-dot" /> LIVE</div>
          <div className="topbar-av" onClick={sair} title="Sair" style={{ marginLeft: 'auto' }}>{initials}</div>
        </div>
        <div className="fo-content">{children}</div>
      </div>
    </div>
  )
}
