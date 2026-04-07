'use client'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { LayoutDashboard, TrendingUp, Receipt, Building2, BarChart3, FileText, Zap, Settings, LogOut, ChevronRight } from 'lucide-react'
import Link from 'next/link'

const menu = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', group: 'principal' },
  { href: '/dashboard/cashflow', icon: TrendingUp, label: 'Fluxo de Caixa', group: 'financeiro' },
  { href: '/dashboard/nota-fiscal', icon: Receipt, label: 'Nota Fiscal', group: 'financeiro' },
  { href: '/dashboard/relatorios', icon: BarChart3, label: 'DRE', group: 'financeiro' },
  { href: '/dashboard/despesas', icon: FileText, label: 'Despesas', group: 'financeiro' },
  { href: '/dashboard/conta-pj', icon: Building2, label: 'Conta PJ', group: 'servicos' },
  { href: '/dashboard/aicfo', icon: Zap, label: 'AI CFO', group: 'ia', badge: 'IA' },
  { href: '/dashboard/integracoes', icon: Settings, label: 'Integrações', group: 'config' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push('/auth')
      else setUser(user)
    })
  }, [])

  async function sair() {
    await supabase.auth.signOut()
    router.push('/auth')
  }

  return (
    <div className="flex h-screen bg-[#0A0A0F] text-white overflow-hidden">
      <aside className="w-60 flex-shrink-0 flex flex-col border-r border-white/5 bg-[#0D0D14]">
        <div className="p-5 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center font-bold text-white text-sm shadow-lg shadow-blue-500/25">F1</div>
            <div>
              <p className="font-bold text-white text-sm leading-tight">FactorOne</p>
              <p className="text-gray-500 text-xs">Finance OS</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {menu.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
            return (
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                  isActive
                    ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20 border-l-2 border-l-blue-500'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}>
                <item.icon size={17} className={isActive ? 'text-blue-400' : 'text-gray-500 group-hover:text-gray-300'} />
                <span className="flex-1">{item.label}</span>
                {item.badge && (
                  <span className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-md animate-pulse">{item.badge}</span>
                )}
                {isActive && <ChevronRight size={14} className="text-blue-400" />}
              </Link>
            )
          })}
        </nav>

        <div className="p-3 border-t border-white/5">
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-xs flex-shrink-0">
              {user?.email?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-medium truncate">{user?.email}</p>
              <p className="text-gray-500 text-xs">Trial</p>
            </div>
            <button onClick={sair} className="text-gray-500 hover:text-red-400 transition-colors" title="Sair">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
