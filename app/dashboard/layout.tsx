'use client'
import InsightFloating from '@/components/aicfo/InsightFloating'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type NavGroup = {
  label: string
  items: Array<{ href: string; icon: string; label: string; badge?: string; badgeColor?: string; match?: (p: string) => boolean }>
}

function buildNavGroups(badges: { reembolsos: number; aprovacoes: number }): NavGroup[] {
  return [
    {
      label: 'Core',
      items: [
        { href: '/dashboard', icon: 'fa-chart-line', label: 'Dashboard', match: (p) => p === '/dashboard' || p === '/dashboard/' },
        { href: '/dashboard/cashflow', icon: 'fa-water', label: 'Cash Flow' },
      ],
    },
    {
      label: 'Financeiro',
      items: [
        { href: '/dashboard/conta-pj', icon: 'fa-building-columns', label: 'Banco PJ' },
        { href: '/dashboard/cartoes', icon: 'fa-credit-card', label: 'Cartões' },
        { href: '/dashboard/financeiro', icon: 'fa-arrow-right-arrow-left', label: 'Contas Pagar/Receber' },
        { href: '/dashboard/reembolsos', icon: 'fa-money-bill-transfer', label: 'Reembolsos', badge: badges.reembolsos > 0 ? String(badges.reembolsos) : undefined, badgeColor: 'var(--teal)' },
      ],
    },
    {
      label: 'Gestão',
      items: [
        { href: '/dashboard/despesas', icon: 'fa-receipt', label: 'Despesas & Recibos' },
        { href: '/dashboard/aprovacoes', icon: 'fa-clipboard-check', label: 'Aprovações', badge: badges.aprovacoes > 0 ? String(badges.aprovacoes) : undefined, badgeColor: 'var(--teal)' },
        { href: '/dashboard/fornecedores', icon: 'fa-truck', label: 'Fornecedores' },
        { href: '/dashboard/orcamento', icon: 'fa-chart-pie', label: 'Orçamento' },
        { href: '/dashboard/patrimonio', icon: 'fa-building', label: 'Patrimônio' },
      ],
    },
    {
      label: 'Contabilidade',
      items: [
        { href: '/dashboard/relatorios', icon: 'fa-file-invoice-dollar', label: 'DRE & Relatórios' },
        { href: '/dashboard/conciliacao', icon: 'fa-code-branch', label: 'Conciliação Bancária' },
        { href: '/dashboard/notas', icon: 'fa-landmark', label: 'Fiscal & NF-e' },
        { href: '/dashboard/contabilidade', icon: 'fa-calculator', label: 'Contabilidade' },
      ],
    },
    {
      label: 'Inteligência',
      items: [
        { href: '/dashboard/aicfo', icon: 'fa-robot', label: 'AI CFO' },
        { href: '/dashboard/integracoes', icon: 'fa-plug', label: 'Hub de Integrações' },
        { href: '/dashboard/marketplace', icon: 'fa-store', label: 'Marketplace', badge: 'NEW', badgeColor: '#7C3AED' },
      ],
    },
  ]
}

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/cashflow': 'Cash Flow Intelligence',
  '/dashboard/conta-pj': 'Banco PJ',
  '/dashboard/cartoes': 'Cartões Corporativos',
  '/dashboard/financeiro': 'Contas a Pagar / Receber',
  '/dashboard/reembolsos': 'Reembolsos',
  '/dashboard/despesas': 'Despesas & Recibos',
  '/dashboard/aprovacoes': 'Aprovações',
  '/dashboard/relatorios': 'DRE & Plano de Contas',
  '/dashboard/conciliacao': 'Conciliação Bancária',
  '/dashboard/notas': 'Fiscal & NF-e',
  '/dashboard/aicfo': 'AI CFO',
  '/dashboard/integracoes': 'Hub de Integrações',
  '/dashboard/marketplace': 'Marketplace',
  '/dashboard/orcamento': 'Orçamento Anual',
  '/dashboard/patrimonio': 'Patrimônio & Ativos',
  '/dashboard/fornecedores': 'Fornecedores & Pagamentos',
  '/dashboard/contabilidade': 'Contabilidade',
}

function isActive(pathname: string, item: NavGroup['items'][0]) {
  if (item.match) return item.match(pathname)
  if (item.href === '/dashboard') return false
  return pathname === item.href || pathname.startsWith(item.href + '/')
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [empresaNome, setEmpresaNome] = useState('')
  const [badges, setBadges] = useState({ reembolsos: 0, aprovacoes: 0 })

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user: u } }) => {
      if (!u) { router.push('/auth'); return }
      setUser(u)
      const { data: row } = await supabase.from('usuarios').select('empresa_id').eq('id', u.id).maybeSingle()
      const eid = row?.empresa_id ?? u.id
      if (row?.empresa_id) {
        const { data: emp } = await supabase.from('empresas').select('nome').eq('id', row.empresa_id).maybeSingle()
        if (emp?.nome) setEmpresaNome(emp.nome as string)
      }
      const [r, a] = await Promise.all([
        supabase.from('reembolsos').select('id', { count: 'exact', head: true }).eq('empresa_id', eid).eq('status', 'pendente'),
        supabase.from('despesas').select('id', { count: 'exact', head: true }).eq('empresa_id', eid).eq('status', 'pendente_aprovacao'),
      ])
      setBadges({ reembolsos: r.count ?? 0, aprovacoes: a.count ?? 0 })
    })
  }, [router])

  async function sair() {
    await supabase.auth.signOut()
    router.push('/auth')
  }

  const pageTitle = pageTitles[pathname] ?? 'FactorOne'
  const initials = user?.email?.slice(0, 2).toUpperCase() ?? 'FO'
  const empresaInitials = empresaNome
    ? empresaNome.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
    : initials

  return (
    <>
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        {/* SIDEBAR */}
        <aside className="sidebar">
          <div className="sb-logo">
            <div className="sb-logo-txt">Factor<span>One</span></div>
          </div>
          <nav className="sb-nav">
            {buildNavGroups(badges).map(group => (
              <div key={group.label}>
                <div className="nav-section">{group.label}</div>
                {group.items.map(item => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`nav-item${isActive(pathname, item) ? ' active' : ''}`}
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
          </nav>
          <div className="sb-footer">
            <div className="sb-co" onClick={sair} title="Clique para sair">
              <div className="sb-co-av">{empresaInitials}</div>
              <div>
                <div className="sb-co-name" style={{ maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {empresaNome || user?.email?.split('@')[0] || 'Conta'}
                </div>
                <div className="sb-co-plan">Plano Profissional</div>
              </div>
            </div>
          </div>
        </aside>

        {/* MAIN */}
        <div className="fo-main">
          <div className="topbar">
            <div className="topbar-title">{pageTitle}</div>
            <div className="live-badge"><div className="live-dot" /> LIVE</div>
            <div className="topbar-av" onClick={sair} title="Sair">{initials}</div>
          </div>
          <div className="fo-content">
            {children}
          </div>
        </div>
      </div>

      <InsightFloating />
    </>
  )
}
