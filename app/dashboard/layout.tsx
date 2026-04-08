'use client'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { LayoutDashboard, TrendingUp, Receipt, Building2, BarChart3, FileText, Zap, Settings, LogOut, ChevronRight } from 'lucide-react'
import Link from 'next/link'

const menu = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', group: 'principal' },
  { href: '/dashboard/cashflow', icon: TrendingUp, label: 'Fluxo de Caixa', group: 'financeiro' },
  { href: '/dashboard/notas', icon: Receipt, label: 'Notas fiscais', group: 'financeiro' },
  { href: '/dashboard/relatorios', icon: BarChart3, label: 'DRE', group: 'financeiro' },
  { href: '/dashboard/despesas', icon: FileText, label: 'Despesas', group: 'financeiro' },
  { href: '/dashboard/conta-pj', icon: Building2, label: 'Conta PJ', group: 'servicos' },
  { href: '/dashboard/conta-pj/extrato', icon: Building2, label: 'Conta PJ • Extrato', group: 'servicos' },
  { href: '/dashboard/conta-pj/investimentos', icon: Building2, label: 'Conta PJ • Investimentos', group: 'servicos' },
  { href: '/dashboard/conta-pj/transferencias', icon: Building2, label: 'Conta PJ • Transferências', group: 'servicos' },
  { href: '/dashboard/conta-pj/conectar-banco', icon: Building2, label: 'Conta PJ • Conectar Banco', group: 'servicos' },
  { href: '/dashboard/aicfo', icon: Zap, label: 'AI CFO', group: 'ia', badge: 'IA' },
  { href: '/dashboard/integracoes', icon: Settings, label: 'Integrações', group: 'config' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push('/auth')
      else setUser(user)
    })
  }, [router])

  async function sair() {
    await supabase.auth.signOut()
    router.push('/auth')
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <aside className="w-60 flex-shrink-0 flex flex-col bg-white border-r border-slate-200">
        <div className="h-16 flex items-center px-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-700 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
              <span className="text-white font-bold text-sm">F1</span>
            </div>
            <div>
              <p className="font-bold text-slate-800 leading-none">FactorOne</p>
              <p className="text-slate-400 text-xs leading-none mt-0.5">Finance OS</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {menu.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
            return (
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 border border-blue-100'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}>
                <item.icon size={16} className={isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'} />
                <span className="flex-1">{item.label}</span>
                {item.badge && (
                  <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-md font-bold">{item.badge}</span>
                )}
                {isActive && <ChevronRight size={14} className="text-blue-400" />}
              </Link>
            )
          })}
        </nav>

        <div className="p-3 border-t border-slate-100">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-slate-50 transition-all group">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
              {user?.email?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-slate-700 text-xs font-semibold truncate">{user?.email}</p>
              <p className="text-slate-400 text-[10px]">Plano Trial</p>
            </div>
            <button onClick={sair} className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100" title="Sair">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-slate-50">
        {children}
      </main>
    </div>
  )
}
