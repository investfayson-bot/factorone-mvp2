'use client'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type NavItem = { href: string; icon: string; label: string; badge?: string; badgeColor?: string }
type NavGroup = { label: string; items: NavItem[] }

const NAV: NavGroup[] = [
  {
    label: 'Visão geral',
    items: [
      { href: '/dashboard-pessoal', icon: 'fa-house', label: 'Início' },
      { href: '/dashboard-pessoal/aicfo', icon: 'fa-robot', label: 'FactorOne AI' },
    ],
  },
  {
    label: 'Finanças',
    items: [
      { href: '/dashboard-pessoal/gastos', icon: 'fa-receipt', label: 'Gastos' },
      { href: '/dashboard-pessoal/receitas', icon: 'fa-arrow-trend-up', label: 'Receitas' },
      { href: '/dashboard-pessoal/orcamento', icon: 'fa-chart-pie', label: 'Orçamento' },
      { href: '/dashboard-pessoal/cartoes', icon: 'fa-credit-card', label: 'Cartões' },
      { href: '/dashboard-pessoal/assinaturas', icon: 'fa-rotate', label: 'Assinaturas' },
    ],
  },
  {
    label: 'Planejamento',
    items: [
      { href: '/dashboard-pessoal/metas', icon: 'fa-bullseye', label: 'Metas' },
      { href: '/dashboard-pessoal/investimentos', icon: 'fa-seedling', label: 'Investimentos' },
      { href: '/dashboard-pessoal/ir', icon: 'fa-file-invoice', label: 'Imposto de Renda' },
      { href: '/dashboard-pessoal/open-finance', icon: 'fa-building-columns', label: 'Open Finance' },
    ],
  },
  {
    label: 'Conta',
    items: [
      { href: '/dashboard-pessoal/planos', icon: 'fa-star', label: 'Meu Plano' },
    ],
  },
]

const PAGE_TITLES: Record<string, string> = {
  '/dashboard-pessoal': 'Início',
  '/dashboard-pessoal/aicfo': 'AI CFO Pessoal',
  '/dashboard-pessoal/gastos': 'Gastos & Recibos',
  '/dashboard-pessoal/receitas': 'Receitas',
  '/dashboard-pessoal/orcamento': 'Orçamento',
  '/dashboard-pessoal/cartoes': 'Cartões',
  '/dashboard-pessoal/assinaturas': 'Assinaturas & Fixos',
  '/dashboard-pessoal/planos': 'Meu Plano',
  '/dashboard-pessoal/metas': 'Metas Financeiras',
}

function isActive(pathname: string, href: string) {
  if (href === '/dashboard-pessoal') return pathname === href
  return pathname === href || pathname.startsWith(href + '/')
}

export default function DashboardPessoalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [nome, setNome] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user: u } }) => {
      if (!u) { router.push('/auth'); return }
      setUser(u)
      const { data } = await supabase.from('perfil_usuario').select('nome_completo,tipo').eq('user_id', u.id).maybeSingle()
      if (data?.tipo !== 'pessoal') { router.push('/onboarding'); return }
      if (data?.nome_completo) setNome(data.nome_completo)
    })
  }, [router])

  async function sair() {
    await supabase.auth.signOut()
    router.push('/auth')
  }

  const initials = nome ? nome.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() : user?.email?.slice(0, 2).toUpperCase() ?? 'PF'
  const pageTitle = PAGE_TITLES[pathname] ?? 'FactorOne Pessoal'

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <aside className="sidebar">
        <div className="sb-logo">
          <div className="sb-logo-txt">Factor<span>One</span></div>
          <div style={{ fontSize: 9, color: 'var(--teal)', fontWeight: 700, letterSpacing: '.08em', marginTop: 2 }}>PESSOAL</div>
        </div>
        <nav className="sb-nav">
          {NAV.map(group => (
            <div key={group.label}>
              <div className="nav-section">{group.label}</div>
              {group.items.map(item => (
                <Link key={item.href} href={item.href} className={`nav-item${isActive(pathname, item.href) ? ' active' : ''}`}>
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
        </nav>
        <div className="sb-footer">
          <div style={{ padding: '8px 8px 8px', marginBottom: 6 }}>
            <Link href="/dashboard" style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
              borderRadius: 8, background: 'rgba(61,122,110,0.12)', textDecoration: 'none',
              transition: 'background 0.15s',
            }}>
              <div style={{ width: 24, height: 24, borderRadius: 6, background: 'rgba(61,122,110,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fa-solid fa-building" style={{ fontSize: 10, color: '#6FA595' }} />
              </div>
              <span style={{ fontSize: 11, color: '#6FA595', fontWeight: 600 }}>Modo Empresarial</span>
              <i className="fa-solid fa-arrow-right" style={{ fontSize: 9, color: '#6FA595', marginLeft: 'auto' }} />
            </Link>
          </div>
          <div className="sb-co" style={{ cursor: 'default' }}>
            <div className="sb-co-av">{initials}</div>
            <div>
              <div className="sb-co-name" style={{ maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {nome || user?.email?.split('@')[0] || 'Você'}
              </div>
              <div className="sb-co-plan" onClick={sair} style={{ cursor: 'pointer', color: '#6FA595' }}>Sair</div>
            </div>
          </div>
        </div>
      </aside>

      <div className="fo-main">
        <div className="topbar">
          <div className="topbar-title">{pageTitle}</div>
          <div className="live-badge"><div className="live-dot" /> PESSOAL</div>
          <div className="topbar-av" onClick={sair} title="Sair">{initials}</div>
        </div>
        <div className="fo-content">{children}</div>
      </div>
    </div>
  )
}
