'use client'
import InsightFloating from '@/components/aicfo/InsightFloating'
import NotificacoesDrawer, { useNotificacoes } from '@/components/dashboard/NotificacoesDrawer'
import GlobalSearch from '@/components/dashboard/GlobalSearch'
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
        { href: '/dashboard/aicfo', icon: 'fa-robot', label: 'AI CFO' },
      ],
    },
    {
      label: 'Financeiro',
      items: [
        { href: '/dashboard/cashflow', icon: 'fa-water', label: 'Cash Flow' },
        { href: '/dashboard/receitas', icon: 'fa-arrow-trend-up', label: 'Receitas' },
        { href: '/dashboard/financeiro', icon: 'fa-arrow-right-arrow-left', label: 'Contas Pagar/Receber' },
        { href: '/dashboard/reembolsos', icon: 'fa-money-bill-transfer', label: 'Reembolsos', badge: badges.reembolsos > 0 ? String(badges.reembolsos) : undefined, badgeColor: 'var(--teal)' },
      ],
    },
    {
      label: 'Banco & Cartões',
      items: [
        { href: '/dashboard/conta-pj', icon: 'fa-building-columns', label: 'Conta PJ' },
        { href: '/dashboard/cartoes', icon: 'fa-credit-card', label: 'Cartões' },
      ],
    },
    {
      label: 'Clientes & Vendas',
      items: [
        { href: '/dashboard/clientes', icon: 'fa-users', label: 'Clientes' },
        { href: '/dashboard/crm', icon: 'fa-handshake', label: 'CRM', badge: 'PLUS', badgeColor: '#7C3AED', match: (p) => p.startsWith('/dashboard/crm') },
      ],
    },
    {
      label: 'Marketing',
      items: [
        { href: '/dashboard/marketing', icon: 'fa-bullhorn', label: 'Marketing' },
      ],
    },
    {
      label: 'Logística',
      items: [
        { href: '/dashboard/logistica', icon: 'fa-truck-fast', label: 'Logística', badge: 'PLUS', badgeColor: '#7C3AED' },
      ],
    },
    {
      label: 'Operacional',
      items: [
        { href: '/dashboard/despesas', icon: 'fa-receipt', label: 'Despesas & Recibos' },
        { href: '/dashboard/aprovacoes', icon: 'fa-clipboard-check', label: 'Aprovações', badge: badges.aprovacoes > 0 ? String(badges.aprovacoes) : undefined, badgeColor: 'var(--teal)' },
        { href: '/dashboard/fornecedores', icon: 'fa-truck', label: 'Fornecedores' },
        { href: '/dashboard/orcamento', icon: 'fa-chart-pie', label: 'Orçamento' },
      ],
    },
    {
      label: 'Patrimônio & Ativos',
      items: [
        { href: '/dashboard/patrimonio', icon: 'fa-building', label: 'Patrimônio' },
      ],
    },
    {
      label: 'Contabilidade & Fiscal',
      items: [
        { href: '/dashboard/relatorios', icon: 'fa-file-invoice-dollar', label: 'DRE & Relatórios' },
        { href: '/dashboard/conciliacao', icon: 'fa-code-branch', label: 'Conciliação Bancária' },
        { href: '/dashboard/notas', icon: 'fa-landmark', label: 'Fiscal & NF-e' },
        { href: '/dashboard/contabilidade', icon: 'fa-calculator', label: 'Contabilidade' },
      ],
    },
    {
      label: 'Inteligência & Ecossistema',
      items: [
        { href: '/dashboard/integracoes', icon: 'fa-plug', label: 'Hub de Integrações' },
        { href: '/dashboard/marketplace', icon: 'fa-store', label: 'Marketplace', badge: 'NEW', badgeColor: '#7C3AED' },
      ],
    },
    {
      label: 'Configurações',
      items: [
        { href: '/dashboard/equipe', icon: 'fa-users-gear', label: 'Equipe' },
        { href: '/dashboard/automacoes', icon: 'fa-robot', label: 'Automações' },
        { href: '/dashboard/planos', icon: 'fa-star', label: 'Planos & Billing' },
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
  '/dashboard/contadores': 'Portal Contador',
  '/dashboard/clientes': 'Clientes',
  '/dashboard/crm': 'CRM',
  '/dashboard/marketing': 'Marketing',
  '/dashboard/logistica': 'Logística',
  '/dashboard/receitas': 'Receitas',
  '/dashboard/equipe': 'Equipe',
  '/dashboard/automacoes': 'Automações',
  '/dashboard/planos': 'Planos & Billing',
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
  const [empresaId, setEmpresaId] = useState('')
  const [badges, setBadges] = useState({ reembolsos: 0, aprovacoes: 0 })
  const [notifOpen, setNotifOpen] = useState(false)
  const { count: notifCount, refresh: refreshNotif } = useNotificacoes(empresaId)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user: u } }) => {
      if (!u) { router.push('/auth'); return }
      setUser(u)
      const { data: row } = await supabase.from('usuarios').select('empresa_id').eq('id', u.id).maybeSingle()
      const eid = row?.empresa_id ?? u.id
      setEmpresaId(eid)
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
            <button
              onClick={() => { const e = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }); window.dispatchEvent(e) }}
              style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--gray-100)', border: '1px solid var(--gray-200)', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', color: 'var(--gray-500)', fontSize: 12 }}
              title="Busca Global (Ctrl+K)"
            >
              <i className="fa-solid fa-magnifying-glass" style={{ fontSize: 11 }} />
              <span>Buscar</span>
              <kbd style={{ fontSize: 9, background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 3, padding: '1px 4px', fontFamily: 'monospace', color: 'var(--gray-400)' }}>⌘K</kbd>
            </button>
            <button onClick={() => setNotifOpen(true)} style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 8, color: 'var(--gray-400)' }} title="Notificações">
              <i className="fa-regular fa-bell" style={{ fontSize: 16 }} />
              {notifCount > 0 && (
                <span style={{ position: 'absolute', top: 0, right: 0, width: 16, height: 16, borderRadius: '50%', background: 'var(--red)', color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {notifCount > 9 ? '9+' : notifCount}
                </span>
              )}
            </button>
            <div className="topbar-av" onClick={sair} title="Sair">{initials}</div>
          </div>
          <div className="fo-content">
            {children}
          </div>
        </div>
      </div>

      <InsightFloating />
      <GlobalSearch empresaId={empresaId} />
      <NotificacoesDrawer
        empresaId={empresaId}
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        onRead={refreshNotif}
      />
    </>
  )
}
