'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { TrendingDown, ArrowUp } from 'lucide-react'
import { calcDREFromTransacoes, fmtBRL, fmtBRLCompact, variacaoPct, type TransacaoDRE } from '@/lib/dre-calculations'
import HealthScore from '@/components/dashboard/HealthScore'
import UpcomingPayments from '@/components/dashboard/UpcomingPayments'
import AnomalyAlerts from '@/components/dashboard/AnomalyAlerts'
import MiniDRE from '@/components/dashboard/MiniDRE'
import EntradasSaidasChart from '@/components/dashboard/EntradasSaidasChart'
import { DashboardErrorBoundary } from '@/components/dashboard/DashboardErrorBoundary'
import type { TransacaoLista } from '@/lib/transacao-types'

type Kpi = { receita: number; despesas: number; saldo: number; nfs: number }
type OrcamentoWidget = { consumidoPct: number; alertas: number; top: string[] }

function KpiDelta({ atual, anterior, invert }: { atual: number; anterior: number; invert?: boolean }) {
  const v = variacaoPct(atual, anterior)
  if (v === null) return <span style={{ fontSize: 10, color: 'var(--gray-400)', fontFamily: "'DM Mono', monospace" }}>1º mês</span>
  const good = invert ? v <= 0 : v >= 0
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color: good ? 'var(--fo-green)' : 'var(--fo-red)', fontFamily: "'DM Mono', monospace", display: 'inline-flex', alignItems: 'center', gap: 2 }}>
      {good ? <ArrowUp size={11} /> : <TrendingDown size={11} />}
      {v >= 0 ? '+' : ''}{v.toFixed(1).replace('.', ',')}%
    </span>
  )
}

function tituloTx(t: TransacaoLista): string {
  const d = (t.descricao || '').trim()
  if (!d) return t.tipo === 'entrada' ? 'Entrada' : 'Saída'
  if (/pix/i.test(d)) return d.toLowerCase().includes('receb') ? 'Pix Recebido' : 'Pix Saída'
  if (/ted|transfer/i.test(d)) return 'Transferência / TED'
  return d.length > 48 ? `${d.slice(0, 45)}…` : d
}

function subtituloTx(t: TransacaoLista): string {
  return `${t.categoria || '—'} · ${new Date(t.data).toLocaleDateString('pt-BR')}`
}

const card: React.CSSProperties = {
  background: '#fff',
  border: '1px solid var(--gray-100)',
  borderRadius: 12,
  padding: '14px 16px',
  boxShadow: '0 1px 4px rgba(0,0,0,.04)',
}

const lbl: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  color: 'var(--gray-400)',
  letterSpacing: '.08em',
  textTransform: 'uppercase',
  marginBottom: 6,
  fontFamily: "'DM Mono', monospace",
}

const val: React.CSSProperties = {
  fontFamily: "'Sora', sans-serif",
  fontSize: 22,
  fontWeight: 800,
  color: 'var(--navy)',
  letterSpacing: '-.03em',
  lineHeight: 1.1,
  marginBottom: 4,
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [kpiAtual, setKpiAtual] = useState<Kpi>({ receita: 0, despesas: 0, saldo: 0, nfs: 0 })
  const [kpiAnt, setKpiAnt] = useState<Kpi>({ receita: 0, despesas: 0, saldo: 0, nfs: 0 })
  const [transacoes, setTransacoes] = useState<TransacaoLista[]>([])
  const [orcamentoWidget, setOrcamentoWidget] = useState<OrcamentoWidget>({ consumidoPct: 0, alertas: 0, top: [] })
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [dreMes, setDreMes] = useState({ liquido: 0, liquidoAnt: 0 })
  const [fluxo30, setFluxo30] = useState(0)
  const [riscoRunwayDias, setRiscoRunwayDias] = useState<number | null>(null)
  const [selectedTx, setSelectedTx] = useState<TransacaoLista | null>(null)
  const router = useRouter()

  function irParaAlerta(alertId: string) {
    if (alertId === 'despesa-acima-media') return router.push('/dashboard/despesas')
    if (alertId === 'saldo-caindo') return router.push('/dashboard/cashflow')
    if (alertId === 'sem-receita-15') return router.push('/dashboard/financeiro/receber')
    router.push('/dashboard/aicfo')
  }

  useEffect(() => {
    async function load() {
      const { data: { user: u } } = await supabase.auth.getUser()
      if (!u) { router.push('/auth'); return }
      setUser(u)

      const { data: usrRow } = await supabase.from('usuarios').select('empresa_id').eq('id', u.id).maybeSingle()
      const eid = (usrRow?.empresa_id as string | null) ?? u.id
      setEmpresaId(eid)

      const now = new Date()
      const a0 = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
      const a1 = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)
      const b0 = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10)
      const b1 = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10)

      const fold = (rows: TransacaoLista[]) => ({
        receita: rows.filter(x => x.tipo === 'entrada').reduce((s, x) => s + Number(x.valor), 0),
        despesas: rows.filter(x => x.tipo === 'saida').reduce((s, x) => s + Number(x.valor), 0),
        saldo: 0,
      })

      const [{ data: tAtual }, { data: tAnt }, { data: t30 }, { data: contaPri }, { count: cAtual }, { count: cAnt }] = await Promise.all([
        supabase.from('transacoes').select('*').eq('empresa_id', eid).gte('data', a0).lte('data', a1).order('data', { ascending: false }),
        supabase.from('transacoes').select('*').eq('empresa_id', eid).gte('data', b0).lte('data', b1),
        supabase.from('transacoes').select('tipo,valor').eq('empresa_id', eid).gte('data', new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)),
        supabase.from('contas_bancarias').select('saldo_disponivel,saldo').eq('empresa_id', eid).eq('is_principal', true).maybeSingle(),
        supabase.from('notas_fiscais').select('*', { count: 'exact', head: true }).eq('empresa_id', eid).eq('status', 'pendente').gte('data_emissao', a0).lte('data_emissao', a1),
        supabase.from('notas_fiscais').select('*', { count: 'exact', head: true }).eq('empresa_id', eid).eq('status', 'pendente').gte('data_emissao', b0).lte('data_emissao', b1),
      ])

      const ka = fold((tAtual ?? []) as TransacaoLista[])
      const kb = fold((tAnt ?? []) as TransacaoLista[])
      ka.saldo = ka.receita - ka.despesas
      kb.saldo = kb.receita - kb.despesas
      setKpiAtual({ ...ka, nfs: cAtual ?? 0 })
      setKpiAnt({ ...kb, nfs: cAnt ?? 0 })
      setTransacoes(((tAtual || []) as TransacaoLista[]).slice(0, 5))

      const dreA = calcDREFromTransacoes((tAtual || []) as TransacaoDRE[])
      const dreB = calcDREFromTransacoes((tAnt || []) as TransacaoDRE[])
      setDreMes({ liquido: dreA.lucroLiquido, liquidoAnt: dreB.lucroLiquido })

      const fluxo30val = (t30 || []).reduce((s, x) => s + (x.tipo === 'entrada' ? Number(x.valor) : -Number(x.valor)), 0)
      setFluxo30(fluxo30val)

      const saldoBanco = Number(contaPri?.saldo_disponivel ?? contaPri?.saldo ?? 0)
      const despDia = ka.despesas / 30
      setRiscoRunwayDias(saldoBanco > 0 && despDia > 0 ? Math.min(999, Math.floor(saldoBanco / despDia)) : saldoBanco > 0 ? 999 : null)

      const { data: orc } = await supabase.from('orcamentos').select('id').eq('empresa_id', eid).in('status', ['ativo', 'aprovado']).order('versao', { ascending: false }).limit(1).maybeSingle()
      if (orc?.id) {
        const [lin, al] = await Promise.all([
          supabase.from('orcamento_linhas').select('categoria,valor_previsto,valor_realizado').eq('orcamento_id', orc.id),
          supabase.from('alertas_orcamento').select('id').eq('empresa_id', eid).eq('lido', false),
        ])
        const previsto = (lin.data || []).reduce((s, x) => s + Number(x.valor_previsto || 0), 0)
        const realizado = (lin.data || []).reduce((s, x) => s + Number(x.valor_realizado || 0), 0)
        const byCat = new Map<string, { p: number; r: number }>()
        for (const l of lin.data || []) {
          const c = byCat.get(l.categoria) || { p: 0, r: 0 }
          c.p += Number(l.valor_previsto || 0); c.r += Number(l.valor_realizado || 0)
          byCat.set(l.categoria, c)
        }
        const top = Array.from(byCat.entries()).map(([k, v]) => ({ k, pct: v.p > 0 ? (v.r / v.p) * 100 : 0 })).sort((a, b) => b.pct - a.pct).slice(0, 3).map(x => x.k)
        setOrcamentoWidget({ consumidoPct: previsto > 0 ? (realizado / previsto) * 100 : 0, alertas: (al.data || []).length, top })
      }

      setLoading(false)
    }
    load()
  }, [router])

  const hora = new Date().getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'
  const nome = user?.email?.split('@')[0] ?? '—'

  if (loading || !user || !empresaId) {
    return (
      <div style={{ padding: 24 }} className="animate-pulse space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <div key={i} style={{ height: 88, background: 'var(--gray-100)', borderRadius: 12 }} />)}
        </div>
        <div style={{ height: 260, background: 'var(--gray-100)', borderRadius: 12 }} />
      </div>
    )
  }

  const runway = riscoRunwayDias != null
    ? riscoRunwayDias < 90
      ? { v: `⚡ ${riscoRunwayDias}d`, delta: <span style={{ fontSize: 10, color: 'var(--fo-gold)', fontFamily: "'DM Mono', monospace" }}>⚠ Atenção à liquidez</span> }
      : { v: `✓ ${riscoRunwayDias}d`, delta: <span style={{ fontSize: 10, color: 'var(--fo-green)', fontFamily: "'DM Mono', monospace" }}>Runway confortável</span> }
    : { v: '—', delta: <span style={{ fontSize: 10, color: 'var(--gray-400)', fontFamily: "'DM Mono', monospace" }}>Abra conta PJ</span> }

  const kpis = [
    { label: 'Receita Mensal', v: fmtBRLCompact(kpiAtual.receita), delta: <KpiDelta atual={kpiAtual.receita} anterior={kpiAnt.receita} /> },
    { label: 'Lucro Líquido', v: fmtBRLCompact(dreMes.liquido), delta: <KpiDelta atual={dreMes.liquido} anterior={dreMes.liquidoAnt} /> },
    { label: 'Fluxo 30 dias', v: fmtBRLCompact(fluxo30), delta: fluxo30 >= 0 ? <span style={{ fontSize: 10, color: 'var(--fo-green)', fontFamily: "'DM Mono', monospace" }}>↑ OK</span> : <span style={{ fontSize: 10, color: 'var(--fo-red)', fontFamily: "'DM Mono', monospace" }}>↓ Negativo</span> },
    { label: 'Runway', v: runway.v, delta: runway.delta },
  ]

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }} className="space-y-4">

      {/* Header */}
      <div style={{ marginBottom: 4 }}>
        <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 17, fontWeight: 700, color: 'var(--navy)' }}>Dashboard</div>
        <div style={{ fontSize: 11, color: 'var(--gray-400)', fontFamily: "'DM Mono', monospace", marginTop: 2 }}>
          {saudacao}, {nome} · {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </div>
      </div>

      {/* Alertas IA */}
      <DashboardErrorBoundary title="Alertas">
        <AnomalyAlerts empresaId={empresaId} onAlertClick={irParaAlerta} />
      </DashboardErrorBoundary>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map(k => (
          <div key={k.label} style={card}>
            <div style={lbl}>{k.label}</div>
            <div style={val}>{k.v}</div>
            <div>{k.delta}</div>
          </div>
        ))}
      </div>

      {/* Gráfico + DRE Resumo */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 min-w-0">
          <DashboardErrorBoundary title="Fluxo de caixa">
            <EntradasSaidasChart empresaId={empresaId} />
          </DashboardErrorBoundary>
        </div>
        <div className="lg:col-span-1">
          <DashboardErrorBoundary title="DRE resumido">
            <MiniDRE empresaId={empresaId} />
          </DashboardErrorBoundary>
        </div>
      </div>

      {/* Health Score + Vencimentos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1">
          <DashboardErrorBoundary title="Score de saúde">
            <HealthScore empresaId={empresaId} />
          </DashboardErrorBoundary>
        </div>
        <div className="lg:col-span-2">
          <DashboardErrorBoundary title="Vencimentos">
            <UpcomingPayments empresaId={empresaId} />
          </DashboardErrorBoundary>
        </div>
      </div>

      {/* Orçamento */}
      {(orcamentoWidget.consumidoPct > 0 || orcamentoWidget.alertas > 0) && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--gray-400)', letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: "'DM Mono', monospace" }}>Orçamento</div>
            <Link href="/dashboard/orcamento" style={{ fontSize: 11, color: 'var(--teal)', textDecoration: 'none' }}>Ver completo →</Link>
          </div>
          <div style={{ display: 'flex', gap: 24 }}>
            <div>
              <div style={{ fontSize: 9, color: 'var(--gray-400)', fontFamily: "'DM Mono', monospace", marginBottom: 3 }}>% CONSUMIDO</div>
              <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 18, fontWeight: 800, color: 'var(--navy)' }}>{orcamentoWidget.consumidoPct.toFixed(1)}%</div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: 'var(--gray-400)', fontFamily: "'DM Mono', monospace", marginBottom: 3 }}>ALERTAS ATIVOS</div>
              <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 18, fontWeight: 800, color: orcamentoWidget.alertas > 0 ? 'var(--fo-gold)' : 'var(--navy)' }}>{orcamentoWidget.alertas}</div>
            </div>
            {orcamentoWidget.top.length > 0 && (
              <div>
                <div style={{ fontSize: 9, color: 'var(--gray-400)', fontFamily: "'DM Mono', monospace", marginBottom: 3 }}>PERTO DO LIMITE</div>
                <div style={{ fontSize: 12, color: 'var(--navy)', fontWeight: 600 }}>{orcamentoWidget.top.join(', ')}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Últimas transações */}
      <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={lbl}>Últimas transações</div>
          <Link href="/dashboard/cashflow" style={{ fontSize: 11, color: 'var(--teal)', textDecoration: 'none' }}>Ver todas →</Link>
        </div>
        {transacoes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--gray-400)', fontSize: 13 }}>
            <p>Nenhuma transação este mês</p>
            <button type="button" onClick={() => router.push('/dashboard/cashflow')} style={{ marginTop: 8, color: 'var(--teal)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}>
              Adicionar transação
            </button>
          </div>
        ) : (
          transacoes.map(t => (
            <div
              key={t.id}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--gray-100)', cursor: 'pointer' }}
              onClick={() => setSelectedTx(t)}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tituloTx(t)}</div>
                <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{subtituloTx(t)}</div>
              </div>
              <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 13, fontWeight: 700, color: t.tipo === 'entrada' ? 'var(--fo-green)' : 'var(--fo-red)', flexShrink: 0 }}>
                {t.tipo === 'entrada' ? '+' : '-'}{fmtBRL(Number(t.valor))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal detalhe transação */}
      {selectedTx && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: 440, maxWidth: '95vw', boxShadow: '0 24px 64px rgba(0,0,0,.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 16, fontWeight: 700, color: 'var(--navy)' }}>Detalhe da transação</div>
              <button onClick={() => setSelectedTx(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--gray-400)' }}>×</button>
            </div>
            <div className="space-y-2">
              {[
                { l: 'Título', v: tituloTx(selectedTx) },
                { l: 'Descrição', v: selectedTx.descricao || '—' },
                { l: 'Categoria', v: selectedTx.categoria || '—' },
                { l: 'Tipo', v: selectedTx.tipo === 'entrada' ? 'Entrada' : 'Saída' },
                { l: 'Data', v: new Date(selectedTx.data).toLocaleDateString('pt-BR') },
                { l: 'Valor', v: `${selectedTx.tipo === 'entrada' ? '+' : '-'}${fmtBRL(Number(selectedTx.valor || 0))}` },
              ].map(({ l, v }) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--cream)', borderRadius: 8, padding: '8px 12px', fontSize: 13 }}>
                  <span style={{ color: 'var(--gray-500)' }}>{l}</span>
                  <span style={{ fontWeight: 600, color: 'var(--navy)' }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button onClick={() => router.push('/dashboard/cashflow')} style={{ padding: '7px 16px', background: 'transparent', border: '1.5px solid var(--gray-200)', borderRadius: 8, fontSize: 13, color: 'var(--gray-700)', cursor: 'pointer' }}>
                Abrir Cash Flow
              </button>
              <button onClick={() => setSelectedTx(null)} style={{ padding: '7px 16px', background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
