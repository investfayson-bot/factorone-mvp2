'use client'
import InsightFloating from "@/components/aicfo/InsightFloating"

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type NavGroup = {
  label: string
  items: Array<{ href: string; icon: string; label: string; badge?: string; badgeColor?: string; match?: (p: string) => boolean }>
}

const navGroups: NavGroup[] = [
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
      { href: '/dashboard/reembolsos', icon: 'fa-money-bill-transfer', label: 'Reembolsos', badge: '3', badgeColor: 'bg-[var(--teal)]' },
    ],
  },
  {
    label: 'Automação',
    items: [
      { href: '/dashboard/despesas', icon: 'fa-receipt', label: 'Despesas & Recibos' },
      { href: '/dashboard/aprovacoes', icon: 'fa-clipboard-check', label: 'Aprovações', badge: '5', badgeColor: 'bg-[var(--teal)]' },
      { href: '/dashboard/relatorios', icon: 'fa-file-invoice-dollar', label: 'DRE & Plano de Contas' },
      { href: '/dashboard/conciliacao', icon: 'fa-code-branch', label: 'Conciliação Bancária' },
      { href: '/dashboard/notas', icon: 'fa-landmark', label: 'Fiscal & NF-e' },
    ],
  },
  {
    label: 'Inteligência',
    items: [
      { href: '/dashboard/aicfo', icon: 'fa-robot', label: 'AI CFO' },
      { href: '/dashboard/integracoes', icon: 'fa-plug', label: 'Hub de Integrações' },
      { href: '/dashboard/marketplace', icon: 'fa-store', label: 'Marketplace', badge: 'NEW', badgeColor: 'bg-[#7C3AED]' },
    ],
  },
]

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
  '/dashboard/orcamento': 'Orçamento',
  '/dashboard/patrimonio': 'Patrimônio',
}

function itemActive(pathname: string, item: NavGroup['items'][0]): boolean {
  if (item.match) return item.match(pathname)
  if (item.href === '/dashboard') return false
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [empresaNome, setEmpresaNome] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user: u } }) => {
      if (!u) { router.push('/auth'); return }
      setUser(u)
      const { data: row } = await supabase.from('usuarios').select('empresa_id').eq('id', u.id).maybeSingle()
      if (row?.empresa_id) {
        const { data: emp } = await supabase.from('empresas').select('nome').eq('id', row.empresa_id).maybeSingle()
        if (emp?.nome) setEmpresaNome(emp.nome as string)
      }
    })
  }, [router])

  async function sair() {
    await supabase.auth.signOut()
    router.push('/auth')
  }

  const pageTitle = pageTitles[pathname] ?? 'FactorOne'
  const initials = user?.email?.slice(0, 2).toUpperCase() ?? 'FO'
  const empresaInitials = empresaNome ? empresaNome.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() : initials

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--cream)' }}>
      {/* Font Awesome for icons */}
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />

      {/* ── SIDEBAR ── */}
      <aside style={{ width: 200, minWidth: 200, background: 'var(--navy)', display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        {/* Logo */}
        <div style={{ padding: '22px 18px 16px', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
          <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 19, fontWeight: 800, color: '#fff', letterSpacing: '-.04em' }}>
            Factor<span style={{ color: 'var(--teal)' }}>One</span>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '10px 0', scrollbarWidth: 'none' }}>
          {navGroups.map((group) => (
            <div key={group.label}>
              <div style={{ padding: '8px 14px 2px', fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,.25)', letterSpacing: '.1em', textTransform: 'uppercase' }}>
                {group.label}
              </div>
              {group.items.map((item) => {
                const isActive = itemActive(pathname, item)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 9, padding: '9px 14px',
                      fontSize: 13, fontWeight: 500,
                      color: isActive ? '#fff' : 'rgba(255,255,255,.45)',
                      background: isActive ? 'rgba(94,140,135,.15)' : 'transparent',
                      borderLeft: isActive ? '2px solid var(--teal)' : '2px solid transparent',
                      textDecoration: 'none', transition: 'all .15s',
                    }}
                    onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,.8)'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.04)' } }}
                    onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,.45)'; (e.currentTarget as HTMLElement).style.background = 'transparent' } }}
                  >
                    <i className={`fa-solid ${item.icon}`} style={{ width: 15, textAlign: 'center', fontSize: 12, flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {item.badge && (
                      <span className={item.badgeColor} style={{ fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 20, color: '#fff' }}>
                        {item.badge}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div style={{ padding: 12, borderTop: '1px solid rgba(255,255,255,.07)' }}>
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'rgba(255,255,255,.05)', borderRadius: 8, cursor: 'pointer' }}
            onClick={sair}
            title="Clique para sair"
          >
            <div style={{ width: 26, height: 26, background: 'var(--teal)', borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
              {empresaInitials}
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.7)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {empresaNome || user?.email?.split('@')[0] || 'Conta'}
              </div>
              <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,.3)' }}>Plano Profissional</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Topbar */}
        <div style={{ height: 52, background: '#fff', borderBottom: '1px solid var(--gray-100)', display: 'flex', alignItems: 'center', padding: '0 24px', gap: 10, flexShrink: 0 }}>
          <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 15, fontWeight: 700, color: 'var(--navy)', flex: 1 }}>
            {pageTitle}{empresaNome ? ` — ${empresaNome}` : ''}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, color: 'var(--teal)', background: 'rgba(94,140,135,.1)', padding: '4px 10px', borderRadius: 100 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--teal)', animation: 'fo-pulse 1.8s ease-out infinite', display: 'inline-block' }} />
            LIVE
          </div>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--navy)', color: '#fff', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginLeft: 8 }} onClick={sair} title="Sair">
            {initials}
          </div>
        </div>

        {/* Content */}
        <main style={{ flex: 1, overflowY: 'auto', background: '#fff', padding: 0 }}>
          {children}
        </main>
      </div>

      <InsightFloating />
    </div>
  )
}
