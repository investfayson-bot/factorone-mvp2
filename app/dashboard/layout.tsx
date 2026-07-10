'use client'
import InsightFloating from '@/components/aicfo/InsightFloating'
import NotificacoesDrawer, { useNotificacoes } from '@/components/dashboard/NotificacoesDrawer'
import GlobalSearch from '@/components/dashboard/GlobalSearch'
import NotificationBell from '@/components/ui/NotificationBell'
import CompanySwitcher from '@/components/dashboard/CompanySwitcher'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { fetchInstalledIds } from '@/lib/marketplace'
import { HoldingProvider, useHolding } from '@/lib/holding-context'

type NavItem = { href: string; icon: string; label: string; badge?: string; match?: (p: string) => boolean }
type NavGroup = { label: string; items: NavItem[] }

// Fase 1 (docs/factorone-cursor-package/FASE-1) — estrutura definitiva do
// menu, não muda mais por fase: PRINCIPAL / SOLUÇÕES / EXTRAS.
const GRUPO_ROLES: Record<string, string[]> = {
  'Financeiro': ['admin', 'financeiro', 'viewer'],
  'Contábil & Fiscal': ['admin', 'financeiro'],
  'Banco': ['admin', 'financeiro'],
  'Clientes & Vendas': ['admin', 'comercial'],
  'Configurações': ['admin'],
}

function buildNavGroups(badges: { reembolsos: number }, installedIds: string[] = [], role: string = 'admin'): NavGroup[] {
  const groups: NavGroup[] = [
    {
      label: 'PRINCIPAL',
      items: [
        { href: '/dashboard', icon: 'fa-house', label: 'Início', match: (p) => p === '/dashboard' || p === '/dashboard/' },
        { href: '/dashboard/agentes', icon: 'fa-sparkles', label: 'Agentes IA' },
      ],
    },
    {
      label: 'SOLUÇÕES',
      items: [
        { href: '/dashboard/banco', icon: 'fa-building-columns', label: 'Banco' },
        { href: '/dashboard/financeiro', icon: 'fa-chart-line', label: 'Financeiro', badge: badges.reembolsos > 0 ? String(badges.reembolsos) : undefined },
        { href: '/dashboard/crm', icon: 'fa-users', label: 'Clientes & Vendas' },
        { href: '/dashboard/contabilidade/livros', icon: 'fa-file-invoice-dollar', label: 'Contábil & Fiscal' },
        { href: '/dashboard/marketing/central', icon: 'fa-bullhorn', label: 'Marketing' },
      ],
    },
    {
      label: 'EXTRAS',
      items: [
        { href: '/dashboard/marketplace', icon: 'fa-grip', label: 'Apps & Marketplace' },
        { href: '/dashboard/equipe', icon: 'fa-user-group', label: 'Equipe & Planos' },
        { href: '/dashboard/integracoes', icon: 'fa-plug', label: 'Integrações' },
        { href: '/dashboard/configuracoes', icon: 'fa-sliders', label: 'Configurações' },
      ],
    },
  ]

  let out = groups
  if (role !== 'admin') {
    out = out.map(g => g.label === 'SOLUÇÕES'
      ? { ...g, items: g.items.filter(i => (GRUPO_ROLES[i.label] ?? ['admin', 'financeiro', 'comercial', 'operacional', 'logistica', 'viewer']).includes(role)) }
      : g
    )
  }
  return out
}

const pageTitles: Record<string, string> = {
  '/dashboard': 'Início',
  '/dashboard/aicfo': 'Acessor',
  '/dashboard/agentes/conversas': 'Conversas',
  '/dashboard/agentes/automacoes': 'Automações',
  '/dashboard/agentes': 'Agentes IA',
  '/dashboard/banco': 'Banco',
  '/dashboard/financeiro': 'Financeiro',
  '/dashboard/crm': 'Clientes & Vendas',
  '/dashboard/contabilidade/livros': 'Contábil & Fiscal',
  '/dashboard/marketing/central': 'Marketing',
  '/dashboard/marketplace': 'Apps & Marketplace',
  '/dashboard/equipe': 'Equipe & Planos',
  '/dashboard/integracoes': 'Integrações',
  '/dashboard/configuracoes': 'Configurações',
  '/dashboard/holding-teste': 'Holding (teste)',
}

function isActive(pathname: string, item: NavItem) {
  if (item.match) return item.match(pathname)
  if (item.href === '/dashboard') return false
  return pathname === item.href || pathname.startsWith(item.href + '/')
}

function HoldingSelector() {
  const { grupos, grupoAtivoId, setGrupoAtivoId, escopo, setEscopo } = useHolding()
  const [aberto, setAberto] = useState(false)
  const grupoAtivo = grupos.find(g => g.id === grupoAtivoId)

  if (grupos.length === 0) return null // sem grupo criado ainda — some, não força a UI

  const escopoLabel = escopo === 'consolidado' ? 'Consolidado' : escopo === 'empresas' ? 'Só empresas' : 'Só PF'

  return (
    <div style={{ position: 'relative' }}>
      <div className="holding" onClick={() => setAberto(v => !v)}>
        <span className="hd-ic">{(grupoAtivo?.nome || 'G').slice(0, 2).toUpperCase()}</span>
        <span>{grupoAtivo?.nome ?? 'Grupo'} · {escopoLabel}</span>
        <i className="fa-solid fa-chevron-down" style={{ fontSize: 10, color: 'var(--mut)' }} />
      </div>
      {aberto && (
        <div style={{ position: 'absolute', top: 40, left: 0, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.12)', zIndex: 200, minWidth: 240, padding: 8 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--mut)', textTransform: 'uppercase', letterSpacing: '.06em', padding: '6px 8px' }}>Grupo</div>
          {grupos.map(g => (
            <div key={g.id} onClick={() => { setGrupoAtivoId(g.id); }} style={{ padding: '7px 10px', borderRadius: 7, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, background: g.id === grupoAtivoId ? 'var(--acc-soft)' : 'transparent', color: g.id === grupoAtivoId ? 'var(--acc-ink)' : 'var(--ink)' }}>
              {g.nome} · {g.membros} membro(s)
            </div>
          ))}
          <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--mut)', textTransform: 'uppercase', letterSpacing: '.06em', padding: '10px 8px 6px', borderTop: '1px solid var(--line)', marginTop: 6 }}>Escopo</div>
          {(['consolidado', 'empresas', 'pf'] as const).map(e => (
            <div key={e} onClick={() => { setEscopo(e); setAberto(false) }} style={{ padding: '7px 10px', borderRadius: 7, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, background: e === escopo ? 'var(--acc-soft)' : 'transparent', color: e === escopo ? 'var(--acc-ink)' : 'var(--ink)' }}>
              {e === 'consolidado' ? 'Consolidado (PJ+PF)' : e === 'empresas' ? 'Só empresas' : 'Só pessoa física'}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [empresaNome, setEmpresaNome] = useState('')
  const [empresaId, setEmpresaId] = useState('')
  const [badges, setBadges] = useState({ reembolsos: 0 })
  const [installedIds, setInstalledIds] = useState<string[]>([])
  const [role, setRole] = useState('admin')

  useEffect(() => {
    const sync = () => { void fetchInstalledIds().then(setInstalledIds) }
    sync()
    window.addEventListener('fo-apps-changed', sync)
    return () => { window.removeEventListener('fo-apps-changed', sync) }
  }, [])
  const [notifOpen, setNotifOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { refresh: refreshNotif } = useNotificacoes(empresaId)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user: u } }) => {
      if (!u) { router.push('/auth'); return }
      setUser(u)
      const { data: row } = await supabase.from('usuarios').select('empresa_id').eq('id', u.id).maybeSingle()
      const eid = row?.empresa_id ?? u.id
      setEmpresaId(eid)
      if (row?.empresa_id) {
        try {
          const { data: membership } = await supabase.from('usuario_empresas').select('papel').eq('user_id', u.id).eq('empresa_id', eid).maybeSingle()
          if (membership?.papel) {
            setRole(membership.papel as string)
          } else if (u.email) {
            const { data: mem } = await supabase.from('membros_equipe').select('role,status').eq('empresa_id', eid).eq('email', u.email).maybeSingle()
            if (mem?.role && mem.status !== 'revogado') setRole(mem.role as string)
          }
        } catch { /* mantém default */ }
      }
      if (row?.empresa_id) {
        const { data: emp } = await supabase.from('empresas').select('nome').eq('id', row.empresa_id).maybeSingle()
        if (emp?.nome) setEmpresaNome(emp.nome as string)
      }
      const { count: r } = await supabase.from('reembolsos').select('id', { count: 'exact', head: true }).eq('empresa_id', eid).eq('status', 'pendente')
      setBadges({ reembolsos: r ?? 0 })
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
      <div className="app">
        {sidebarOpen && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 998, background: 'rgba(15,23,42,.45)' }} onClick={() => setSidebarOpen(false)} />
        )}

        {/* SIDEBAR */}
        <aside className="sidebar-v2">
          <div className="logo">
            <div className="logo-mark">F</div>
            <div className="logo-name">Factor<span>One</span></div>
          </div>
          <nav style={{ flex: 1, overflowY: 'auto' }}>
            {buildNavGroups(badges, installedIds, role).map(group => (
              <div key={group.label}>
                <div className="nav-label">{group.label}</div>
                {group.items.map(item => (
                  <Link key={item.href} href={item.href} className={`nav-item${isActive(pathname, item) ? ' on' : ''}`} onClick={() => setSidebarOpen(false)}>
                    <i className={`fa-solid ${item.icon}`} />
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {item.badge && <span className="nav-badge">{item.badge}</span>}
                  </Link>
                ))}
              </div>
            ))}
          </nav>
          <div className="side-foot">
            {/* Trocar entre empresas com acesso (contador multi-cliente, etc.)
                — mecanismo diferente do Holding (troca a empresa ATIVA via
                usuario_empresas, não soma várias ao mesmo tempo). */}
            <CompanySwitcher nome={empresaNome || user?.email?.split('@')[0] || 'Conta'} iniciais={empresaInitials} onSair={sair} />
          </div>
        </aside>

        {/* MAIN */}
        <div className="main-v2">
          <div className="topbar-v2">
            <button
              onClick={() => setSidebarOpen(v => !v)}
              style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink)', padding: '4px 8px', borderRadius: 6 }}
              className="sb-hamburger"
            >
              <i className="fa-solid fa-bars" style={{ fontSize: 16 }} />
            </button>
            <HoldingSelector />
            <div
              className="search-v2"
              onClick={() => { const e = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }); window.dispatchEvent(e) }}
              style={{ cursor: 'pointer' }}
            >
              <i className="fa-solid fa-magnifying-glass" />
              <span>Buscar no sistema…</span>
              <kbd style={{ marginLeft: 'auto', fontSize: 10.5, opacity: .7 }}>⌘K</kbd>
            </div>
            <div className="tb-actions">
              <div className="tb-btn green" title="Nova ação"><i className="fa-solid fa-plus" /></div>
              <div style={{ position: 'relative' }}>
                <NotificationBell />
              </div>
              <div className="tb-btn" onClick={sair} title="Sair" style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>{initials}</div>
            </div>
          </div>
          <div className="content-v2">
            {children}
          </div>
        </div>
      </div>

      <InsightFloating />
      <GlobalSearch empresaId={empresaId} />
      <NotificacoesDrawer empresaId={empresaId} open={notifOpen} onClose={() => setNotifOpen(false)} onRead={refreshNotif} />
    </>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <HoldingProvider>
      <DashboardShell>{children}</DashboardShell>
    </HoldingProvider>
  )
}
