'use client'

// Visão Geral de Clientes & Vendas (Fase 6) — KPIs + funil + leads quentes
// sem contato, tudo de crm_oportunidades (dado real).

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'

type Op = {
  id: string; titulo: string; valor: number | null; etapa: string
  temperatura: string | null; ultimo_contato_em: string | null
  updated_at: string | null; created_at: string; data_fechamento: string | null
}

const FUNIL: { etapa: string; label: string }[] = [
  { etapa: 'prospeccao', label: 'Prospect' },
  { etapa: 'qualificado', label: 'Qualificação' },
  { etapa: 'proposta', label: 'Proposta' },
  { etapa: 'negociacao', label: 'Negociação' },
  { etapa: 'fechado_ganho', label: 'Fechado' },
]

export default function ClientesVendasVisaoGeral() {
  const [ops, setOps] = useState<Op[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
      const eid = (u?.empresa_id as string) ?? user.id
      const { data } = await supabase
        .from('crm_oportunidades')
        .select('id, titulo, valor, etapa, temperatura, ultimo_contato_em, updated_at, created_at, data_fechamento')
        .eq('empresa_id', eid)
        .limit(500)
      setOps((data as Op[]) ?? [])
      setLoading(false)
    })()
  }, [])

  const m = useMemo(() => {
    const abertas = ops.filter(o => ['prospeccao', 'qualificado', 'proposta', 'negociacao'].includes(o.etapa))
    const totalPipeline = abertas.reduce((s, o) => s + Number(o.valor ?? 0), 0)

    const inicioMes = new Date(); inicioMes.setDate(1)
    const ganhasMes = ops.filter(o => o.etapa === 'fechado_ganho' && o.data_fechamento && new Date(o.data_fechamento) >= inicioMes)
    const perdidasMes = ops.filter(o => o.etapa === 'fechado_perdido' && o.data_fechamento && new Date(o.data_fechamento) >= inicioMes)
    const fechadasMes = ganhasMes.length + perdidasMes.length
    const conversao = fechadasMes > 0 ? (ganhasMes.length / fechadasMes) * 100 : null

    const ganhas = ops.filter(o => o.etapa === 'fechado_ganho')
    const ticket = ganhas.length > 0 ? ganhas.reduce((s, o) => s + Number(o.valor ?? 0), 0) / ganhas.length : null

    const comCiclo = ganhas.filter(o => o.data_fechamento)
    const cicloMedio = comCiclo.length > 0
      ? comCiclo.reduce((s, o) => s + Math.max(0, (new Date(o.data_fechamento!).getTime() - new Date(o.created_at).getTime()) / 86400000), 0) / comCiclo.length
      : null

    const quentesParados = abertas
      .filter(o => o.temperatura === 'quente')
      .map(o => {
        const ref = o.ultimo_contato_em || o.updated_at || o.created_at
        return { ...o, dias: Math.floor((Date.now() - new Date(ref).getTime()) / 86400000) }
      })
      .filter(o => o.dias >= 5)
      .sort((a, b) => b.dias - a.dias)
      .slice(0, 6)

    const funil = FUNIL.map(f => {
      const itens = ops.filter(o => o.etapa === f.etapa)
      return { ...f, qtd: itens.length, valor: itens.reduce((s, o) => s + Number(o.valor ?? 0), 0) }
    })
    const maxQtd = Math.max(1, ...funil.map(f => f.qtd))

    return { totalPipeline, conversao, ticket, cicloMedio, quentesParados, funil, maxQtd }
  }, [ops])

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--mut)', fontSize: 13 }}>Carregando…</div>

  return (
    <div style={{ maxWidth: 1040, paddingBottom: 30 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 18 }}>
        <div className="kpi-v2"><div className="l">Total em pipeline</div><div className="v">{formatBRL(m.totalPipeline)}</div><div className="c" style={{ color: 'var(--mut)', fontWeight: 500 }}>negócios abertos</div></div>
        <div className="kpi-v2"><div className="l">Conversão (mês)</div><div className="v">{m.conversao == null ? '—' : `${m.conversao.toFixed(0)}%`}</div><div className="c" style={{ color: 'var(--mut)', fontWeight: 500 }}>{m.conversao == null ? 'sem fechamento no mês' : 'ganhos / fechados'}</div></div>
        <div className="kpi-v2"><div className="l">Ticket médio</div><div className="v">{m.ticket == null ? '—' : formatBRL(m.ticket)}</div><div className="c" style={{ color: 'var(--mut)', fontWeight: 500 }}>dos negócios ganhos</div></div>
        <div className="kpi-v2"><div className="l">Tempo de fechamento</div><div className="v">{m.cicloMedio == null ? '—' : `${Math.round(m.cicloMedio)}d`}</div><div className="c" style={{ color: 'var(--mut)', fontWeight: 500 }}>média criação → ganho</div></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14, alignItems: 'start' }}>
        {/* Funil */}
        <div className="card-v2" style={{ padding: 16 }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--ink)', marginBottom: 12 }}>Funil de vendas</div>
          {m.funil.map((f, i) => {
            const anterior = i > 0 ? m.funil[i - 1] : null
            const passagem = anterior && anterior.qtd > 0 ? Math.round((f.qtd / anterior.qtd) * 100) : null
            return (
              <div key={f.etapa} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                  <span style={{ fontWeight: 700, color: 'var(--ink)' }}>{f.label} <span style={{ color: 'var(--mut)', fontWeight: 600 }}>· {f.qtd}</span></span>
                  <span style={{ color: 'var(--mut)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                    {formatBRL(f.valor)}{passagem != null && <span style={{ marginLeft: 8, color: passagem >= 50 ? 'var(--acc)' : 'var(--warn)' }}>{passagem}% ←</span>}
                  </span>
                </div>
                <div style={{ height: 8, background: 'var(--bg)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(f.qtd / m.maxQtd) * 100}%`, background: f.etapa === 'fechado_ganho' ? '#16A34A' : 'var(--acc)', borderRadius: 99, opacity: f.etapa === 'fechado_ganho' ? 1 : 1 - i * 0.12 }} />
                </div>
              </div>
            )
          })}
          <Link href="/dashboard/clientes-vendas/pipeline" style={{ fontSize: 12, color: 'var(--acc)', fontWeight: 700, textDecoration: 'none' }}>Abrir o Pipeline →</Link>
        </div>

        {/* Leads quentes sem contato */}
        <div className="card-v2" style={{ padding: 16 }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--ink)', marginBottom: 10 }}>
            <i className="fa-solid fa-fire" style={{ color: '#DC2626', marginRight: 6, fontSize: 12 }} />Quentes sem contato recente
          </div>
          {m.quentesParados.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--mut)' }}>Nenhum lead quente parado — ou você está em dia, ou falta classificar temperaturas no Pipeline.</div>
          ) : m.quentesParados.map(o => (
            <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.titulo}</div>
                <div style={{ fontSize: 11, color: '#B0413E', fontWeight: 700 }}>⚠ {o.dias} dias sem contato</div>
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{formatBRL(Number(o.valor ?? 0))}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
