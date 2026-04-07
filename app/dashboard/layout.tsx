'use client'
export const dynamic = 'force-dynamic'
import React, { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { LayoutDashboard, TrendingUp, Receipt, Building2, BarChart3, FileText, Zap, Settings } from 'lucide-react'

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/cashflow', label: 'Fluxo de Caixa', icon: TrendingUp },
  { href: '/dashboard/nota-fiscal', label: 'Nota Fiscal', icon: Receipt },
  { href: '/dashboard/conta-pj', label: 'Conta PJ', icon: Building2 },
  { href: '/dashboard/relatorios', label: 'DRE', icon: BarChart3 },
  { href: '/dashboard/despesas', label: 'Despesas', icon: FileText },
  { href: '/dashboard/aicfo', label: 'AI CFO', icon: Zap, badge: 'AI' },
  { href: '/dashboard/integracoes', label: 'Integrações', icon: Settings },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [empresa, setEmpresa] = useState<any>(null)
  const [usuario, setUsuario] = useState<any>(null)
  const router = useRouter()
  const pathname = usePathname()
  const sb = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await sb.auth.getUser()
      if (!user) { router.push('/auth'); return }
      const { data: u } = await sb.from('usuarios').select('*, empresas(*)').eq('id', user.id).single()
      if (u) { setUsuario(u); setEmpresa(u.empresas) }
    }
    load()
  }, [])

  async function handleLogout() {
    await sb.auth.signOut()
    router.push('/auth')
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#09100F' }}>
      {/* Sidebar */}
      <aside style={{ width: 220, minWidth: 220, background: '#111A19', borderRight: '1px solid #233130', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Logo */}
        <div style={{ padding: '14px 14px 8px', borderBottom: '1px solid #233130', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, background: '#C8F135', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, color: '#000', fontFamily: 'Sora, sans-serif' }}>F1</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#E4E8E7', fontFamily: 'Sora, sans-serif' }}>FactorOne</div>
              <div style={{ fontSize: 9, color: '#7A9290', fontFamily: 'monospace' }}>Finance OS</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
          {NAV.map(item => {
            const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
            const Icon = item.icon
            return (
              <Link key={item.href} href={item.href}
                style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 10px', borderRadius: 8, margin: '1px 8px', fontSize: 13, color: active ? '#000' : '#7A9290', background: active ? '#C8F135' : 'transparent', fontWeight: active ? 700 : 400, textDecoration: 'none', transition: 'all .15s' }}>
                <Icon size={14} style={{ opacity: active ? 1 : 0.7 }} />
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.badge && (
                  <span style={{ fontSize: 9, background: active ? '#000' : '#C8F135', color: active ? '#C8F135' : '#000', padding: '1px 5px', borderRadius: 3, fontWeight: 800, fontFamily: 'monospace' }}>{item.badge}</span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div style={{ padding: 10, borderTop: '1px solid #233130' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 10px', background: '#182120', borderRadius: 8, cursor: 'pointer' }} onClick={handleLogout}>
            <div style={{ width: 26, height: 26, background: '#3B8BFF', borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
              {empresa?.nome?.slice(0, 2).toUpperCase() || 'F1'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#E4E8E7', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{empresa?.nome || 'Carregando...'}</div>
              <div style={{ fontSize: 10, color: '#7A9290' }}>{empresa?.plano || 'trial'} · Sair</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {children}
        </div>
      </main>
    </div>
  )
}
