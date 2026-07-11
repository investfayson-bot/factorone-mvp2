'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const TABS: { href: string; label: string; countKey?: 'pagar' | 'receber' }[] = [
  { href: '/dashboard/financeiro/visao-geral', label: 'Visão Geral' },
  { href: '/dashboard/financeiro/contas-a-pagar', label: 'Contas a Pagar', countKey: 'pagar' },
  { href: '/dashboard/financeiro/contas-a-receber', label: 'Contas a Receber', countKey: 'receber' },
  { href: '/dashboard/financeiro/fluxo-de-caixa', label: 'Fluxo de Caixa' },
  { href: '/dashboard/financeiro/dre', label: 'DRE' },
]

const MAIS: { href: string; label: string }[] = [
  { href: '/dashboard/cobrancas', label: 'Assinaturas & Recorrências' },
  { href: '/dashboard/reembolsos', label: 'Reembolsos' },
  { href: '/dashboard/orcamento', label: 'Orçamentos' },
  { href: '/dashboard/despesas', label: 'Centro de Custos' },
  { href: '/dashboard/despesas', label: 'Categorias' },
  { href: '/dashboard/financeiro/fluxo-de-caixa', label: 'Forecast & Cenários' },
  { href: '/dashboard/financeiro/precificacao', label: 'Precificação & Margem' },
  { href: '/dashboard/financeiro/conciliacao', label: 'Conciliação bancária' },
  { href: '/dashboard/financeiro/aging', label: 'Aging (inadimplência)' },
]

const NOVO_LABEL: Record<string, string> = {
  '/dashboard/financeiro/contas-a-pagar': '+ Nova conta a pagar',
  '/dashboard/financeiro/contas-a-receber': '+ Nova conta a receber',
}

const EXPORTAVEL = new Set([
  '/dashboard/financeiro/visao-geral',
  '/dashboard/financeiro/contas-a-pagar',
  '/dashboard/financeiro/contas-a-receber',
])

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const t = data.session?.access_token
  return t ? { Authorization: `Bearer ${t}` } : {}
}

export default function FinanceiroLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [mostrarMais, setMostrarMais] = useState(false)
  const [counts, setCounts] = useState<{ pagar: number; receber: number }>({ pagar: 0, receber: 0 })
  const [exportando, setExportando] = useState(false)

  useEffect(() => {
    let ativo = true
    async function carregarContadores() {
      const h = await authHeaders()
      const [pPend, pVenc, rPend, rVenc] = await Promise.all([
        fetch('/api/financeiro/pagar?status=pendente', { headers: h }).then(r => r.json()).catch(() => ({ pagination: { total: 0 } })),
        fetch('/api/financeiro/pagar?status=vencida', { headers: h }).then(r => r.json()).catch(() => ({ pagination: { total: 0 } })),
        fetch('/api/financeiro/receber?status=pendente', { headers: h }).then(r => r.json()).catch(() => ({ pagination: { total: 0 } })),
        fetch('/api/financeiro/receber?status=vencida', { headers: h }).then(r => r.json()).catch(() => ({ pagination: { total: 0 } })),
      ])
      if (!ativo) return
      setCounts({
        pagar: (pPend.pagination?.total || 0) + (pVenc.pagination?.total || 0),
        receber: (rPend.pagination?.total || 0) + (rVenc.pagination?.total || 0),
      })
    }
    void carregarContadores()
    return () => { ativo = false }
  }, [])

  const routeBadge = pathname.replace(/^\/dashboard/, 'factorone.app')
  const novoHref = `${pathname.startsWith('/dashboard/financeiro/contas-a-receber') ? '/dashboard/financeiro/contas-a-receber' : '/dashboard/financeiro/contas-a-pagar'}?novo=1`
  const novoLabel = NOVO_LABEL[pathname] ?? '+ Novo lançamento'

  async function exportarPdf() {
    setExportando(true)
    try {
      const { baixarArquivo } = await import('@/lib/download-arquivo')
      const r = await baixarArquivo('/api/financeiro/exportar-pdf', 'financeiro.pdf')
      if ('erro' in r) {
        const { default: toast } = await import('react-hot-toast')
        toast.error(r.erro)
      }
    } finally {
      setExportando(false)
    }
  }

  return (
    <div style={{ margin: '-20px -24px 14px', background: 'var(--card)' }}>
      <div className="mod-head">
        <div className="mod-title">
          <h1>Financeiro</h1>
          <span className="route-v2">{routeBadge}</span>
          <div className="mod-actions">
            {EXPORTAVEL.has(pathname) && (
              <button className="btn-v2" onClick={() => void exportarPdf()} disabled={exportando}>
                {exportando ? 'Exportando…' : 'Exportar'}
              </button>
            )}
            <Link href={novoHref} className="btn-v2 primary" style={{ textDecoration: 'none', display: 'inline-block' }}>
              {novoLabel}
            </Link>
          </div>
        </div>
        <div className="mod-tabs">
          {TABS.map(t => (
            <Link key={t.href} href={t.href} className={`mod-tab${pathname === t.href ? ' on' : ''}`}>
              {t.label}
              {t.countKey && <span className="cnt">{counts[t.countKey]}</span>}
            </Link>
          ))}
          <div style={{ position: 'relative' }}>
            <div className="mod-tab" onClick={() => setMostrarMais(v => !v)}>Mais ▾</div>
            {mostrarMais && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 9 }} onClick={() => setMostrarMais(false)} />
                <div style={{ position: 'absolute', top: '100%', left: 0, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.12)', padding: 6, minWidth: 210, zIndex: 10 }}>
                  {MAIS.map(m => (
                    <Link key={m.label} href={m.href} onClick={() => setMostrarMais(false)} style={{ display: 'block', padding: '8px 10px', borderRadius: 7, fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', textDecoration: 'none' }}>
                      {m.label}
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      <div style={{ padding: '14px 24px 0' }}>
        {children}
      </div>
    </div>
  )
}
