'use client'
import InsightFloating from '@/components/aicfo/InsightFloating'
import NotificacoesDrawer, { useNotificacoes } from '@/components/dashboard/NotificacoesDrawer'
import GlobalSearch from '@/components/dashboard/GlobalSearch'
import NotificationBell from '@/components/ui/NotificationBell'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { MARKET_APPS, fetchInstalledIds } from '@/lib/marketplace'

type NavItem = { href: string; icon: string; label: string; badge?: string; badgeColor?: string; match?: (p: string) => boolean }
type NavGroup = {
  label: string
  collapsible?: boolean
  items: NavItem[]
}

// Quem vê qual grupo do menu. admin (dono) vê tudo. Grupo não listado = visível.
const GRUPO_ROLES: Record<string, string[]> = {
  'Gestão financeira': ['admin', 'financeiro', 'viewer'],
  'Financeiro': ['admin', 'financeiro', 'viewer'],
  'Patrimônio': ['admin', 'financeiro'],
  'Contabilidade': ['admin', 'financeiro'],
  'Contabilidade & Fiscal': ['admin', 'financeiro'],
  'Banco': ['admin', 'financeiro'],
  'Clientes & Vendas': ['admin', 'comercial'],
  'Operacional': ['admin', 'operacional', 'logistica'],
  'Configurações': ['admin'],
}

function buildNavGroups(badges: { reembolsos: number; aprovacoes: number }, installedIds: string[] = [], role: string = 'admin', hidePatrimonio: boolean = false): NavGroup[] {
  const groups: NavGroup[] = [
    {
      label: 'Visão geral',
      items: [
        { href: '/dashboard', icon: 'fa-layout-dashboard', label: 'Dashboard', match: (p) => p === '/dashboard' || p === '/dashboard/' },
        { href: '/dashboard/assistente', icon: 'fa-robot', label: 'Assistente', badge: '24/7', badgeColor: 'var(--teal)' },
      ],
    },
    {
      label: 'Gestão financeira',
      items: [
        { href: '/dashboard/classificar', icon: 'fa-layer-group', label: 'Classificar', badge: 'NEW', badgeColor: 'var(--teal)' },
        { href: '/dashboard/cashflow', icon: 'fa-chart-line', label: 'Fluxo de Caixa' },
        { href: '/dashboard/relatorios', icon: 'fa-chart-bar', label: 'DRE' },
        { href: '/dashboard/financeiro', icon: 'fa-receipt', label: 'Financeiro', badge: badges.reembolsos > 0 ? String(badges.reembolsos) : undefined, badgeColor: 'var(--teal)' },
        { href: '/dashboard/despesas', icon: 'fa-file-invoice', label: 'Despesas' },
      ],
    },
    {
      label: 'Patrimônio',
      items: [
        { href: '/dashboard/patrimonio/imoveis', icon: 'fa-building', label: 'Imóveis', badge: 'NEW', badgeColor: 'var(--teal)' },
        { href: '/dashboard/patrimonio/recibos', icon: 'fa-receipt', label: 'Recibos' },
        { href: '/dashboard/patrimonio/obras', icon: 'fa-helmet-safety', label: 'Obras' },
        { href: '/dashboard/patrimonio/veiculos', icon: 'fa-car', label: 'Veículos' },
        { href: '/dashboard/patrimonio/socios', icon: 'fa-users', label: 'Distribuição' },
      ],
    },
    {
      label: 'Contabilidade',
      items: [
        { href: '/dashboard/conciliacao', icon: 'fa-building-columns', label: 'Conciliação', badge: badges.aprovacoes > 0 ? String(badges.aprovacoes) : undefined, badgeColor: 'var(--teal)' },
        { href: '/dashboard/contadores', icon: 'fa-calculator', label: 'Contador' },
        { href: '/dashboard/contabilidade/livros', icon: 'fa-book', label: 'Livros contábeis' },
        { href: '/dashboard/notas', icon: 'fa-file-invoice-dollar', label: 'Fiscal & NF-e' },
      ],
    },
    ...(installedIds.includes('banco') ? [{
      label: 'Banco',
      collapsible: true,
      items: [
        { href: '/dashboard/conta-pj', icon: 'fa-building-columns', label: 'Visão geral', match: (p: string) => p === '/dashboard/conta-pj' },
        { href: '/dashboard/conta-pj/extrato', icon: 'fa-list-ul', label: 'Extrato' },
        { href: '/dashboard/conta-pj/transferencias', icon: 'fa-bolt', label: 'PIX & Transferências' },
        { href: '/dashboard/cartoes', icon: 'fa-credit-card', label: 'Cartões' },
        { href: '/dashboard/credito', icon: 'fa-hand-holding-dollar', label: 'Crédito & Financiamento' },
        { href: '/dashboard/conexoes', icon: 'fa-link', label: 'Open Finance (Belvo)' },
        { href: '/dashboard/conta-pj/abrir', icon: 'fa-circle-plus', label: 'Abrir conta' },
      ],
    }] : []),
    {
      label: 'Configurações',
      items: [
        { href: '/dashboard/marketplace', icon: 'fa-store', label: 'Apps & Marketplace', badge: 'NEW', badgeColor: '#7A6A9E' },
        { href: '/dashboard/equipe', icon: 'fa-users-gear', label: 'Equipe' },
        { href: '/dashboard/planos', icon: 'fa-star', label: 'Planos & Billing' },
      ],
    },
  ]

  // Apps instalados pelo Marketplace aparecem no seu grupo funcional.
  for (const app of MARKET_APPS) {
    if (app.id === 'banco') continue // Banco é um grupo inteiro, tratado acima
    if (app.id === 'classificar' || app.id === 'cfoia') continue // já são itens fixos do menu
    if (!installedIds.includes(app.id)) continue
    const item: NavItem = { href: app.href, icon: app.icon, label: app.name, badge: 'APP', badgeColor: '#7A6A9E' }
    let group = groups.find(g => g.label === app.navGroup)
    if (!group) { group = { label: app.navGroup, items: [] }; groups.push(group) }
    if (!group.items.some(i => i.href === item.href)) group.items.push(item)
  }

  // Aplica o papel: admin vê tudo; os demais só os grupos permitidos.
  let out = groups
  if (role !== 'admin') out = out.filter(g => (GRUPO_ROLES[g.label] ?? ['admin', 'financeiro', 'comercial', 'operacional', 'logistica', 'viewer']).includes(role))
  // Segmento de negócio: quem não gerencia imóveis não precisa do grupo Patrimônio.
  if (hidePatrimonio) out = out.filter(g => g.label !== 'Patrimônio')
  return out
}

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/aicfo': 'FactorOne AI',
  '/dashboard/assistente': 'Assistente',
  '/dashboard/cashflow': 'Fluxo de Caixa',
  '/dashboard/relatorios': 'DRE',
  '/dashboard/indicadores': 'Indicadores',
  '/dashboard/ma': 'Preparação para M&A',
  '/dashboard/prefeituras': 'Prefeituras & NFS-e',
  '/dashboard/juridico': 'Jurídico',
  '/dashboard/marketing/central': 'Marketing',
  '/dashboard/marketing/site': 'Gere seu site',
  '/dashboard/contabilidade/livros': 'Livros contábeis',
  '/dashboard/credito': 'Crédito & Financiamento',
  '/dashboard/financeiro': 'Financeiro',
  '/dashboard/despesas': 'Despesas',
  '/dashboard/patrimonio/imoveis': 'Imóveis',
  '/dashboard/patrimonio/obras': 'Obras e Reformas',
  '/dashboard/patrimonio/recibos': 'Recibos de Locação',
  '/dashboard/patrimonio/socios': 'Distribuição por sócio',
  '/dashboard/patrimonio/veiculos': 'Veículos',
  '/dashboard/classificar': 'Classificar transações',
  '/dashboard/captacao': 'Captação de Leads',
  '/dashboard/agenda': 'Agendamento',
  '/dashboard/orcamento': 'Orçamento',
  '/dashboard/conciliacao': 'Conciliação Bancária',
  '/dashboard/conciliacao/relatorio': 'Relatório de Conciliação',
  '/dashboard/contadores': 'Portal do Contador',
  '/dashboard/notas': 'Fiscal & NF-e',
  '/dashboard/fiscal': 'Portais Fiscais & Gov.br',
  '/dashboard/conta-pj': 'Banco — Visão geral',
  '/dashboard/conta-pj/transferencias': 'Banco — PIX & Transferências',
  '/dashboard/conta-pj/conectar-banco': 'Banco — Open Finance',
  '/dashboard/conexoes': 'Banco — Open Finance (Belvo)',
  '/dashboard/conta-pj/solucoes': 'Banco — Soluções',
  '/dashboard/conta-pj/abrir': 'Banco — Abrir / conectar conta',
  '/dashboard/conta-pj/extrato': 'Banco — Extrato',
  '/dashboard/conta-pj/investimentos': 'Banco — Investimentos',
  '/dashboard/cartoes': 'Cartão Corporativo',
  '/dashboard/integracoes': 'Integrações',
  '/dashboard/marketplace': 'Marketplace',
  '/dashboard/equipe': 'Equipe',
  '/dashboard/planos': 'Planos & Billing',
  '/dashboard/patrimonio': 'Patrimônio & Ativos',
  '/dashboard/fornecedores': 'Fornecedores',
  '/dashboard/contabilidade': 'Contabilidade',
  '/dashboard/clientes': 'Clientes',
  '/dashboard/invoices': 'Invoices',
  '/dashboard/reembolsos': 'Reembolsos',
  '/dashboard/aprovacoes': 'Aprovações',
  '/dashboard/receitas': 'Receitas',
  '/dashboard/automacoes': 'Automações',
  '/dashboard/crm': 'CRM',
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
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})

  function toggleGroup(label: string, groups: NavGroup[]) {
    const group = groups.find(g => g.label === label)
    const inGroup = group?.items.some(i => isActive(pathname, i))
    setCollapsedGroups(prev => ({ ...prev, [label]: !prev[label] }))
    if (inGroup) setCollapsedGroups(prev => ({ ...prev, [label]: false }))
  }
  const [empresaId, setEmpresaId] = useState('')
  const [badges, setBadges] = useState({ reembolsos: 0, aprovacoes: 0 })
  const [installedIds, setInstalledIds] = useState<string[]>([])
  const [role, setRole] = useState('admin')
  const [segmento, setSegmento] = useState('')

  useEffect(() => {
    const sync = () => { void fetchInstalledIds().then(setInstalledIds) }
    sync()
    window.addEventListener('fo-apps-changed', sync)
    return () => { window.removeEventListener('fo-apps-changed', sync) }
  }, [])
  const [notifOpen, setNotifOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { count: notifCount, refresh: refreshNotif } = useNotificacoes(empresaId)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user: u } }) => {
      if (!u) { router.push('/auth'); return }
      setUser(u)
      const { data: row } = await supabase.from('usuarios').select('empresa_id').eq('id', u.id).maybeSingle()
      const eid = row?.empresa_id ?? u.id
      setEmpresaId(eid)
      if (typeof window !== 'undefined') setSegmento(localStorage.getItem(`fo_segmento_${eid}`) || '')
      // Papel do usuário: dono (sem empresa_id, é o próprio workspace) = admin;
      // membro convidado carrega o role de membros_equipe. Sem registro = admin (não trava ninguém).
      if (row?.empresa_id && u.email) {
        try {
          const { data: mem } = await supabase.from('membros_equipe').select('role,status').eq('empresa_id', eid).eq('email', u.email).maybeSingle()
          if (mem?.role && mem.status !== 'revogado') setRole(mem.role as string)
        } catch { /* tabela pode não existir → admin */ }
      }
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
        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 998, background: 'rgba(15,23,42,.45)' }}
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* SIDEBAR */}
        <aside className="sidebar" style={{ transform: sidebarOpen ? 'translateX(0)' : undefined } as React.CSSProperties}>
          <div className="sb-logo">
            <div className="sb-logo-txt">Factor<span>One</span></div>
            {empresaNome && (
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', marginTop: 2, fontWeight: 500, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {empresaNome}
              </div>
            )}
            <button
              onClick={() => setSidebarOpen(false)}
              style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.5)', padding: 4, marginLeft: 'auto' }}
              className="sb-close-btn"
            >
              <i className="fa-solid fa-xmark" style={{ fontSize: 16 }} />
            </button>
          </div>
          <nav className="sb-nav">
            {buildNavGroups(badges, installedIds, role, ['produto', 'servico', 'industria'].includes(segmento)).map(group => {
              const inGroup = group.items.some(i => isActive(pathname, i))
              const isCollapsed = group.collapsible && collapsedGroups[group.label] && !inGroup
              return (
                <div key={group.label}>
                  {group.collapsible ? (
                    <div className="nav-section" onClick={() => toggleGroup(group.label, buildNavGroups(badges, installedIds, role, ['produto', 'servico', 'industria'].includes(segmento)))}
                      style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', userSelect: 'none' }}>
                      <span>{group.label}</span>
                      <i className={`fa-solid fa-chevron-${isCollapsed ? 'right' : 'down'}`} style={{ fontSize: 8, opacity: .5 }} />
                    </div>
                  ) : (
                    <div className="nav-section">{group.label}</div>
                  )}
                  {!isCollapsed && group.items.map(item => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`nav-item${isActive(pathname, item) ? ' active' : ''}${group.collapsible ? ' nav-item-sub' : ''}`}
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
              )
            })}
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
            <button
              className="sb-hamburger"
              onClick={() => setSidebarOpen(v => !v)}
              style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--navy)', padding: '4px 8px', borderRadius: 6 }}
            >
              <i className="fa-solid fa-bars" style={{ fontSize: 16 }} />
            </button>
            <div className="topbar-title">{pageTitle}</div>
            <div className="live-badge"><div className="live-dot" /> LIVE</div>
            <button
              onClick={() => { const e = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }); window.dispatchEvent(e) }}
              style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--gray-100)', border: '1px solid var(--gray-200)', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', color: 'var(--gray-500)', fontSize: 12 }}
              title="Busca Global (Ctrl+K)"
            >
              <i className="fa-solid fa-magnifying-glass" style={{ fontSize: 11 }} />
              <span>Buscar</span>
              <kbd style={{ fontSize: 9, background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 3, padding: '1px 4px', fontVariantNumeric: 'tabular-nums', color: 'var(--gray-400)' }}>⌘K</kbd>
            </button>
            <NotificationBell />
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
