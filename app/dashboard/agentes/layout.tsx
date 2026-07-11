'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const TABS: { href: string; label: string }[] = [
  { href: '/dashboard/agentes/acessor', label: 'Acessor' },
  { href: '/dashboard/agentes/conversas', label: 'Conversas' },
  { href: '/dashboard/agentes/automacoes', label: 'Automações' },
]

export default function AgentesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [totalRegras, setTotalRegras] = useState<number | null>(null)

  useEffect(() => {
    void (async () => {
      const { data: sess } = await supabase.auth.getSession()
      const tk = sess.session?.access_token ?? ''
      try {
        const r = await fetch('/api/donna/regras', { headers: tk ? { Authorization: `Bearer ${tk}` } : {} })
        const j = await r.json()
        if (r.ok) setTotalRegras((j.regras ?? []).length)
      } catch { /* ignore */ }
    })()
  }, [])

  const routeBadge = pathname.replace(/^\/dashboard/, 'factorone.app')

  return (
    <div style={{ margin: '-20px -24px 14px', background: 'var(--card)' }}>
      <div className="mod-head">
        <div className="mod-title">
          <h1>Agentes IA</h1>
          <span className="route-v2">{routeBadge}</span>
          <div className="mod-actions">
            <Link href="/dashboard/agentes/acessor" className="btn-v2 primary" style={{ textDecoration: 'none', display: 'inline-block' }}>Falar com o Acessor</Link>
          </div>
        </div>
        <div className="mod-tabs">
          {TABS.map(t => (
            <Link key={t.href} href={t.href} className={`mod-tab${pathname === t.href ? ' on' : ''}`}>
              {t.label}
              {t.href === '/dashboard/agentes/automacoes' && totalRegras !== null && <span className="cnt">{totalRegras}</span>}
            </Link>
          ))}
        </div>
      </div>
      <div style={{ padding: '14px 24px 0' }}>
        {children}
      </div>
    </div>
  )
}
