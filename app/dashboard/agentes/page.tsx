'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { AGENTES_DASHBOARD } from '@/lib/agentes-log'

type Acao = { id: string; agente_id: string; agente_nome: string; acao: string; detalhe: string | null; custo_usd: number; created_at: string }

function tempoRelativo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diffMs / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min}min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h}h`
  return `há ${Math.floor(h / 24)}d`
}

export default function AgentesPage() {
  const [acoes, setAcoes] = useState<Acao[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      const { data: sess } = await supabase.auth.getSession()
      const tk = sess.session?.access_token ?? ''
      try {
        const r = await fetch('/api/agentes/acoes', { headers: tk ? { Authorization: `Bearer ${tk}` } : {} })
        const j = await r.json()
        if (r.ok) setAcoes(j.acoes ?? [])
      } catch { /* ignore */ }
      setLoading(false)
    })()
  }, [])

  const porAgente = useMemo(() => {
    const m = new Map<string, { count: number; custo: number; ultima: Acao | null }>()
    for (const a of acoes) {
      const cur = m.get(a.agente_id) ?? { count: 0, custo: 0, ultima: null }
      cur.count += 1
      cur.custo += Number(a.custo_usd || 0)
      if (!cur.ultima || a.created_at > cur.ultima.created_at) cur.ultima = a
      m.set(a.agente_id, cur)
    }
    return m
  }, [acoes])

  const totalCusto = acoes.reduce((s, a) => s + Number(a.custo_usd || 0), 0)

  return (
    <>
      <div className="page-hdr">
        <div>
          <div className="page-title">Agentes</div>
          <div className="page-sub">Seu squad de IA — o que cada um faz e o que já fez de verdade no seu negócio.</div>
        </div>
      </div>

      <div className="kpis" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="kpi"><div className="kpi-lbl">Ações registradas</div><div className="kpi-val">{loading ? '—' : acoes.length}</div></div>
        <div className="kpi"><div className="kpi-lbl">Agentes ativos</div><div className="kpi-val">{loading ? '—' : porAgente.size}</div></div>
        <div className="kpi"><div className="kpi-lbl">Custo de IA (registrado)</div><div className="kpi-val" style={{ fontSize: 20 }}>{loading ? '—' : `$${totalCusto.toFixed(4)}`}</div></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12, marginBottom: 24 }}>
        {AGENTES_DASHBOARD.map(ag => {
          const stats = porAgente.get(ag.id)
          return (
            <Link key={ag.id} href={ag.href} className="txs-card" style={{ padding: '16px 18px', display: 'block', textDecoration: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${ag.cor}1E`, color: ag.cor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800 }}>{ag.inicial}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{ag.nome}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-mut)' }}>{ag.modulo}</div>
                </div>
              </div>
              <div style={{ fontSize: 13.5, color: 'var(--ink-soft)', marginBottom: 10, lineHeight: 1.5 }}>{ag.papel}</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--ink-mut)' }}>
                <span>{stats ? `${stats.count} ação${stats.count === 1 ? '' : 'ões'}` : 'sem ações ainda'}</span>
                <span>{stats?.ultima ? tempoRelativo(stats.ultima.created_at) : ''}</span>
              </div>
            </Link>
          )
        })}
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-mut)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>Atividade recente</div>
      {loading ? (
        <div style={{ padding: 30, textAlign: 'center', color: 'var(--ink-mut)', fontSize: 15 }}>Carregando…</div>
      ) : acoes.length === 0 ? (
        <div className="txs-card" style={{ padding: 36, textAlign: 'center', color: 'var(--ink-mut)', fontSize: 15 }}>
          Nada registrado ainda. Use o Assistente ou classifique transações com IA — as ações aparecem aqui.
        </div>
      ) : (
        <div className="txs-card">
          {acoes.slice(0, 40).map((a, i) => {
            const ag = AGENTES_DASHBOARD.find(x => x.id === a.agente_id)
            return (
              <div key={a.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '11px 18px', borderBottom: i < Math.min(acoes.length, 40) - 1 ? '1px solid var(--line-soft)' : 'none' }}>
                <div style={{ width: 26, height: 26, borderRadius: 8, background: `${ag?.cor ?? '#7B8C88'}1E`, color: ag?.cor ?? 'var(--ink-mut)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11.5, fontWeight: 800, flexShrink: 0, marginTop: 1 }}>{ag?.inicial ?? '??'}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, color: 'var(--ink)' }}><b>{a.agente_nome}</b> {a.acao}</div>
                  {a.detalhe && <div style={{ fontSize: 13, color: 'var(--ink-mut)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.detalhe}</div>}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', flexShrink: 0 }}>{tempoRelativo(a.created_at)}</div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
