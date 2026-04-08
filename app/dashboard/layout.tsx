'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import {
  LayoutDashboard,
  Landmark,
  CreditCard,
  Tags,
  ArrowLeftRight,
  Wallet,
  BarChart3,
  Zap,
  Receipt,
  Building2,
  Settings,
  LogOut,
  PieChart,
} from 'lucide-react'
import Link from 'next/link'

/** Ordem e rótulos alinhados ao visual de referência (Financial OS) */
const menu: Array<{
  href: string
  icon: typeof LayoutDashboard
  label: string
  match?: (path: string) => boolean
}> = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', match: (p) => p === '/dashboard' || p === '/dashboard/' },
  { href: '/dashboard/conta-pj', icon: Landmark, label: 'Banco PJ' },
  { href: '/dashboard/cartoes', icon: CreditCard, label: 'Cartões' },
  { href: '/dashboard/despesas', icon: Tags, label: 'Categorização' },
  { href: '/dashboard/cashflow', icon: ArrowLeftRight, label: 'Fluxo de Caixa' },
  { href: '/dashboard/financeiro', icon: Wallet, label: 'Financeiro' },
  { href: '/dashboard/relatorios', icon: BarChart3, label: 'DRE Auto' },
  { href: '/dashboard/aicfo', icon: Zap, label: 'CFO IA' },
  { href: '/dashboard/notas', icon: Receipt, label: 'Fiscal' },
  { href: '/dashboard/orcamento', icon: PieChart, label: 'Orçamento' },
  { href: '/dashboard/patrimonio', icon: Building2, label: 'Patrimônio' },
  { href: '/dashboard/integracoes', icon: Settings, label: 'Integrações' },
]

function itemActive(pathname: string, item: (typeof menu)[0]): boolean {
  if (item.match) return item.match(pathname)
  if (item.href === '/dashboard') return false
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}

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
    <div className="flex h-screen overflow-hidden bg-[#F9FAFB]">
      <aside className="flex w-[260px] flex-shrink-0 flex-col border-r border-gray-200/90 bg-[#F3F4F6]">
        <div className="flex h-16 items-center border-b border-gray-200/80 px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 shadow-sm">
              <span className="text-sm font-bold text-white">F1</span>
            </div>
            <div>
              <p className="leading-none font-bold text-gray-900">FactorOne</p>
              <p className="mt-0.5 text-[11px] leading-none text-gray-500">Financial OS</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5 py-4">
          {menu.map((item) => {
            const isActive = itemActive(pathname, item)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200/80'
                    : 'text-gray-600 hover:bg-gray-200/60 hover:text-gray-900'
                }`}
              >
                <item.icon
                  size={18}
                  strokeWidth={isActive ? 2.25 : 2}
                  className={isActive ? 'text-emerald-700' : 'text-gray-400'}
                />
                <span className="flex-1">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-gray-200/80 p-3">
          <div className="group flex items-center gap-2 rounded-xl px-2 py-2 transition-colors hover:bg-gray-200/50">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white text-sm font-semibold text-emerald-800 shadow-sm ring-1 ring-gray-200/80">
              {user?.email?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-gray-800">{user?.email}</p>
              <p className="text-[10px] text-gray-500">Conta ativa</p>
            </div>
            <button
              type="button"
              onClick={sair}
              className="text-gray-400 opacity-0 transition-all hover:text-red-600 group-hover:opacity-100"
              title="Sair"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto bg-[#F9FAFB]">{children}</main>
    </div>
  )
}
