'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { calcDREFromTransacoes, fmtBRLCompact, type TransacaoDRE } from '@/lib/dre-calculations'
import ProximosCompromissos from '@/components/dashboard/ProximosCompromissos'
import EntradasSaidasChart from '@/components/dashboard/EntradasSaidasChart'
import { DashboardErrorBoundary } from '@/components/dashboard/DashboardErrorBoundary'
import type { TransacaoLista } from '@/lib/transacao-types'
import { useHolding } from '@/lib/holding-context'

type Kpi = { receita: number; despesas: number; saldo: number }
type ScoreComponente = { nome: string; pontos: number; max: number; descricao: string; detalhe: string }
type ScoreData = { total: number; grade: string; componentes: ScoreComponente[] }
type Conversa = { id: string; visitante_nome: string | null; status: string; updated_at: string }
type Resumo = {
  caixa_consolidado: number; receita_mes: number; despesas_mes: number; lucro_liquido_mes: number
  receita_por_membro: { empresa_id: string; nome: string; receita: number }[]
}

function fmtBRL(n: number) { return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function iniciais(nome: string | null): string {
  const s = (nome || 'Visitante').trim()
  const partes = s.split(/\s+/).filter(Boolean)
  return ((partes[0]?.[0] ?? '?') + (partes[1]?.[0] ?? '')).toUpperCase()
}

function CardHoje({ icone, titulo, status, ok, alerta, href, textoLink }: {
  icone: string; titulo: string; status: 'ok' | 'warn' | 'crit'; ok: string; alerta: string | null; href: string; textoLink: string
}) {
  const cor = status === 'ok' ? 'var(--acc)' : status === 'warn' ? 'var(--warn)' : 'var(--neg)'
  return (
    <div className="card-v2">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 700, fontSize: 13, color: 'var(--ink)' }}>
          <i className={`fa-solid ${icone}`} style={{ color: 'var(--acc-ink)', fontSize: 12 }} />{titulo}
        </div>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: cor, flexShrink: 0 }} />
      </div>
      <div style={{ fontSize: 12, color: 'var(--ink)', marginBottom: 4, display: 'flex', gap: 6 }}><span style={{ color: 'var(--acc-ink)' }}>✓</span>{ok}</div>
      {alerta && <div style={{ fontSize: 12, color: 'var(--warn)', marginBottom: 8, display: 'flex', gap: 6 }}><span>⚠</span>{alerta}</div>}
      <Link href={href} className="link-v2">{textoLink} →</Link>
    </div>
  )
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [kpiAtual, setKpiAtual] = useState<Kpi>({ receita: 0, despesas: 0, saldo: 0 })
  const [kpiAnt, setKpiAnt] = useState<Kpi>({ receita: 0, despesas: 0, saldo: 0 })
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [empresaNome, setEmpresaNome] = useState('')
  const [dreMes, setDreMes] = useState({ liquido: 0, liquidoAnt: 0, receitaBruta: 0, ebitda: 0 })
  const [fluxo30, setFluxo30] = useState(0)
  const [saldoBanco, setSaldoBanco] = useState(0)
  const [score, setScore] = useState<ScoreData | null>(null)
  const [topCats, setTopCats] = useState<{ cat: string; val: number }[]>([])
  const [insight, setInsight] = useState('')
  const [pendencias, setPendencias] = useState({ reembolsos: 0, aprovacoes: 0, contasPagarVencendo: 0 })
  const [prioridades, setPrioridades] = useState<{ id: string; tipo: string; origem: string; score: number; prazo: string | null; impacto_valor: number | null }[]>([])
  const [hoje, setHoje] = useState({
    financeiro: { pagos: 0, vencendo: 0 },
    vendas: { novosHoje: 0, semResposta: 0 },
    fiscal: { notasHoje: 0, diasProximaObrigacao: null as number | null },
    banco: { ultimaSync: null as string | null, ultimaMov: null as string | null },
  })
  const [conversas, setConversas] = useState<Conversa[]>([])
  const [resumoGrupo, setResumoGrupo] = useState<Resumo | null>(null)
  const router = useRouter()
  const { grupos, grupoAtivoId, escopo } = useHolding()

  useEffect(() => {
    async function load() {
      try {
        const { data: { user: u } } = await supabase.auth.getUser()
        if (!u) { router.push('/auth'); return }
        setUser(u)

        const { data: usrRow } = await supabase.from('usuarios').select('empresa_id').eq('id', u.id).maybeSingle()
        const eid = (usrRow?.empresa_id as string | null) ?? u.id
        setEmpresaId(eid)

        if (usrRow?.empresa_id) {
          const { data: emp } = await supabase.from('empresas').select('nome').eq('id', usrRow.empresa_id).maybeSingle()
          setEmpresaNome((emp?.nome as string) || '')
        }

        const now = new Date()
        const a0 = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
        const a1 = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)
        const b0 = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10)
        const b1 = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10)
        const d30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
        const hojeStr = now.toISOString().slice(0, 10)

        const [{ data: tAtual }, { data: tAnt }, { data: t30 }, { data: contaPri }] = await Promise.all([
          supabase.from('transacoes').select('*').eq('empresa_id', eid).gte('data', a0).lte('data', a1).order('data', { ascending: false }),
          supabase.from('transacoes').select('*').eq('empresa_id', eid).gte('data', b0).lte('data', b1),
          supabase.from('transacoes').select('tipo,valor').eq('empresa_id', eid).gte('data', d30),
          supabase.from('contas_bancarias').select('saldo_disponivel,saldo').eq('empresa_id', eid).eq('is_principal', true).maybeSingle(),
        ])

        const fold = (rows: TransacaoLista[]) => {
          const rec = rows.filter(x => x.tipo === 'entrada').reduce((s, x) => s + Number(x.valor), 0)
          const desp = rows.filter(x => x.tipo === 'saida').reduce((s, x) => s + Number(x.valor), 0)
          return { receita: rec, despesas: desp, saldo: rec - desp }
        }
        const ka = fold((tAtual ?? []) as TransacaoLista[])
        const kb = fold((tAnt ?? []) as TransacaoLista[])
        setKpiAtual(ka)
        setKpiAnt(kb)

        const dreA = calcDREFromTransacoes((tAtual || []) as TransacaoDRE[])
        const dreB = calcDREFromTransacoes((tAnt || []) as TransacaoDRE[])
        setDreMes({ liquido: dreA.lucroLiquido, liquidoAnt: dreB.lucroLiquido, receitaBruta: dreA.receitaBruta, ebitda: dreA.ebitda })

        const f30 = (t30 || []).reduce((s, x) => s + (x.tipo === 'entrada' ? Number(x.valor) : -Number(x.valor)), 0)
        setFluxo30(f30)
        setSaldoBanco(Number(contaPri?.saldo_disponivel ?? contaPri?.saldo ?? 0))

        const catMap = new Map<string, number>()
        for (const t of tAtual || []) {
          if (t.tipo !== 'saida') continue
          const cat = (t.categoria as string) || 'Outros'
          catMap.set(cat, (catMap.get(cat) || 0) + Number(t.valor) || 0)
        }
        setTopCats(Array.from(catMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([cat, val]) => ({ cat, val })))

        // Pendências & Aprovações (rail direito)
        const [rPendRes, aPendRes, cPagarRes] = await Promise.all([
          supabase.from('reembolsos').select('id').eq('empresa_id', eid).eq('status', 'pendente'),
          supabase.from('despesas').select('id').eq('empresa_id', eid).eq('status', 'pendente_aprovacao'),
          supabase.from('contas_pagar').select('id').eq('empresa_id', eid).neq('status', 'paga').lte('data_vencimento', new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)),
        ])
        setPendencias({
          reembolsos: (rPendRes.data ?? []).length,
          aprovacoes: (aPendRes.data ?? []).length,
          contasPagarVencendo: (cPagarRes.data ?? []).length,
        })

        const { data: sessWi } = await supabase.auth.getSession()
        const wiTk = sessWi.session?.access_token ?? ''
        if (wiTk) {
          const wiRes = await fetch('/api/action-engine/work-items', { headers: { Authorization: `Bearer ${wiTk}` } }).catch(() => null)
          if (wiRes?.ok) {
            const wiJson = await wiRes.json().catch(() => null) as { work_items?: typeof prioridades } | null
            if (wiJson) setPrioridades((wiJson.work_items ?? []).slice(0, 5))
          }
        }

        // "Hoje na sua operação" — Financeiro, Vendas, Fiscal, Banco
        const em48h = new Date(Date.now() + 48 * 3600_000).toISOString().slice(0, 10)
        const [pagosHojeR, vencendoR, leadsHojeR, leadsParadosR, notasHojeR, syncR, movR] = await Promise.all([
          supabase.from('contas_pagar').select('id').eq('empresa_id', eid).eq('status', 'paga').eq('data_pagamento', hojeStr),
          supabase.from('contas_pagar').select('id').eq('empresa_id', eid).neq('status', 'paga').gte('data_vencimento', hojeStr).lte('data_vencimento', em48h),
          supabase.from('clientes').select('id').eq('empresa_id', eid).eq('status', 'prospect').gte('created_at', a0),
          supabase.from('clientes').select('id').eq('empresa_id', eid).eq('status', 'prospect').lte('updated_at', new Date(Date.now() - 24 * 3600_000).toISOString()),
          supabase.from('notas_emitidas').select('id').eq('empresa_id', eid).gte('created_at', hojeStr),
          supabase.from('belvo_contas').select('updated_at').eq('empresa_id', eid).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
          supabase.from('extrato_bancario').select('data_transacao').eq('empresa_id', eid).order('data_transacao', { ascending: false }).limit(1).maybeSingle(),
        ])
        setHoje({
          financeiro: { pagos: (pagosHojeR.data ?? []).length, vencendo: (vencendoR.data ?? []).length },
          vendas: { novosHoje: (leadsHojeR.data ?? []).length, semResposta: (leadsParadosR.data ?? []).length },
          fiscal: { notasHoje: (notasHojeR.data ?? []).length, diasProximaObrigacao: null },
          banco: { ultimaSync: (syncR.data?.updated_at as string) ?? null, ultimaMov: (movR.data?.data_transacao as string) ?? null },
        })

        // Conversas em tempo real (rail direito) — mesma fonte da tela Conversas
        const { data: convData } = await supabase
          .from('atendimento_conversas')
          .select('id, visitante_nome, status, updated_at')
          .eq('empresa_id', eid)
          .order('updated_at', { ascending: false })
          .limit(5)
        setConversas((convData ?? []) as Conversa[])

        // Insight proativo de IA
        const { data: sessData } = await supabase.auth.getSession()
        const tk = sessData.session?.access_token
        fetch('/api/transacoes/analisar', { method: 'POST', headers: tk ? { Authorization: `Bearer ${tk}` } : {} })
          .then(r => r.json()).then(j => { if (Array.isArray(j.analise) && j.analise[0]) setInsight(j.analise[0] as string) }).catch(() => {})

        const scoreRes = await fetch('/api/score/calcular', { headers: tk ? { Authorization: `Bearer ${tk}` } : {} }).catch(() => null)
        if (scoreRes?.ok) {
          const scoreJson = await scoreRes.json().catch(() => null) as ScoreData | null
          if (scoreJson) setScore(scoreJson)
        }
      } catch (err) {
        console.error('[dashboard] load error', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router])

  // Resumo consolidado do Holding — só busca se o usuário tiver grupo (Fase 0).
  // Sem grupo, os KPIs abaixo usam o kpiAtual/dreMes de empresa única acima.
  useEffect(() => {
    if (!grupoAtivoId) { setResumoGrupo(null); return }
    void (async () => {
      const { data: sess } = await supabase.auth.getSession()
      const tk = sess.session?.access_token
      if (!tk) return
      const r = await fetch(`/api/grupos/${grupoAtivoId}/resumo?escopo=${escopo}`, { headers: { Authorization: `Bearer ${tk}` } })
      if (r.ok) setResumoGrupo(await r.json())
    })()
  }, [grupoAtivoId, escopo])

  const hora = new Date().getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'
  const nome = user?.email?.split('@')[0] ?? '—'
  const dataLabel = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })

  const caixa = resumoGrupo?.caixa_consolidado ?? saldoBanco
  const receita = resumoGrupo?.receita_mes ?? kpiAtual.receita
  const lucro = resumoGrupo ? resumoGrupo.receita_mes - resumoGrupo.despesas_mes : dreMes.liquido
  const margemEbitda = dreMes.receitaBruta > 0 ? (dreMes.ebitda / dreMes.receitaBruta) * 100 : 0
  const receitaVar = useMemo(() => kpiAnt.receita > 0 ? ((kpiAtual.receita - kpiAnt.receita) / kpiAnt.receita) * 100 : 0, [kpiAtual, kpiAnt])
  const lucroVar = useMemo(() => dreMes.liquidoAnt !== 0 ? ((dreMes.liquido - dreMes.liquidoAnt) / Math.abs(dreMes.liquidoAnt)) * 100 : 0, [dreMes])

  const scoreScaled = score ? Math.round(score.total / 10) : null
  const scoreLabel = scoreScaled === null ? '—' : scoreScaled >= 80 ? 'Excelente' : scoreScaled >= 60 ? 'Bom' : scoreScaled >= 40 ? 'Atenção' : 'Crítico'

  const totalCats = topCats.reduce((s, c) => s + c.val, 0)

  if (loading || !user || !empresaId) {
    return (
      <div className="kpis" style={{ marginBottom: 16 }}>
        {[1, 2, 3, 4].map(i => <div key={i} className="kpi-v2" style={{ height: 88, background: 'var(--line)', animation: 'pulse 1.5s infinite' }} />)}
      </div>
    )
  }

  return (
    <DashboardErrorBoundary>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 316px', gap: 14, alignItems: 'start' }}>
        {/* COLUNA PRINCIPAL */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>

          {/* 1. Hero */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 14 }}>
            <div className="card-v2">
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", color: 'var(--ink)' }}>{saudacao}, {nome} 👋</div>
              <div style={{ fontSize: 12.5, color: 'var(--mut)', marginTop: 4, textTransform: 'capitalize' }}>{empresaNome || 'Sua operação'} · {dataLabel}</div>
            </div>
            <div className="card-v2">
              <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--mut)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Score da Empresa</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 4 }}>
                <span style={{ fontSize: 30, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", color: 'var(--ink)' }}>{scoreScaled ?? '—'}</span>
                <span style={{ fontSize: 13, color: 'var(--mut)' }}>/100</span>
              </div>
              <span className={`chip-v2 ${scoreScaled === null ? 'y' : scoreScaled >= 80 ? 'g' : scoreScaled >= 60 ? 'g' : scoreScaled >= 40 ? 'y' : 'r'}`}>{scoreLabel}</span>
            </div>
          </div>

          {/* 2. Hoje na sua operação */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 8, fontFamily: "'Space Grotesk', sans-serif" }}>Hoje na sua operação</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              <CardHoje
                icone="fa-chart-line" titulo="Financeiro" href="/dashboard/financeiro" textoLink="Resolver"
                status={hoje.financeiro.vencendo > 0 ? 'warn' : 'ok'}
                ok={`${hoje.financeiro.pagos} pagamento(s) realizado(s) hoje`}
                alerta={hoje.financeiro.vencendo > 0 ? `${hoje.financeiro.vencendo} conta(s) vencendo em 48h` : null}
              />
              <CardHoje
                icone="fa-users" titulo="Vendas" href="/dashboard/crm" textoLink="Responder"
                status={hoje.vendas.semResposta > 0 ? 'warn' : 'ok'}
                ok={`${hoje.vendas.novosHoje} novo(s) lead(s) captado(s)`}
                alerta={hoje.vendas.semResposta > 0 ? `${hoje.vendas.semResposta} lead(s) sem resposta há 24h` : null}
              />
              <CardHoje
                icone="fa-file-invoice-dollar" titulo="Fiscal" href="/dashboard/contabilidade/livros" textoLink="Ver guia"
                status="ok"
                ok={`${hoje.fiscal.notasHoje} nota(s) emitida(s) hoje`}
                alerta={null}
              />
              <CardHoje
                icone="fa-building-columns" titulo="Banco" href="/dashboard/banco" textoLink="Ver extrato"
                status="ok"
                ok={hoje.banco.ultimaSync ? `Sincronizado ${new Date(hoje.banco.ultimaSync).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'Sem sincronização ainda'}
                alerta={null}
              />
            </div>
          </div>

          {/* 3. KPIs consolidados */}
          <div className="kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
            <div className="kpi-v2">
              <div className="l">Caixa Consolidado</div>
              <div className="v">{fmtBRLCompact(caixa)}</div>
            </div>
            <div className="kpi-v2">
              <div className="l">Receita (Mês)</div>
              <div className="v">{fmtBRLCompact(receita)}</div>
              <div className="c" style={{ color: receitaVar >= 0 ? 'var(--acc-ink)' : 'var(--neg)' }}>{receitaVar >= 0 ? '↑' : '↓'} {Math.abs(receitaVar).toFixed(1)}% vs mês ant.</div>
            </div>
            <div className={`kpi-v2${lucro < 0 ? ' neg' : ''}`}>
              <div className="l">Lucro Líquido (Mês)</div>
              <div className="v">{fmtBRLCompact(lucro)}</div>
              <div className="c" style={{ color: lucroVar >= 0 ? 'var(--acc-ink)' : 'var(--neg)' }}>{lucroVar >= 0 ? '↑' : '↓'} {Math.abs(lucroVar).toFixed(1)}% vs mês ant.</div>
            </div>
            <div className={`kpi-v2${fluxo30 < 0 ? ' warn' : ''}`}>
              <div className="l">Fluxo Previsto (30d)</div>
              <div className="v">{fmtBRLCompact(fluxo30)}</div>
            </div>
            <div className="kpi-v2">
              <div className="l">Margem EBITDA</div>
              <div className="v">{margemEbitda.toFixed(1)}%</div>
            </div>
          </div>

          {/* 4. Gráficos */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: 14 }}>
            <div className="card-v2">
              <div className="card-v2-h"><h3>Fluxo de Caixa · 30 dias</h3></div>
              <EntradasSaidasChart empresaId={empresaId} />
            </div>
            <div className="card-v2">
              <div className="card-v2-h"><h3>Receita por Empresa</h3></div>
              {resumoGrupo && resumoGrupo.receita_por_membro.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {resumoGrupo.receita_por_membro.map(m => (
                    <div key={m.empresa_id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                      <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{m.nome}</span>
                      <span style={{ color: 'var(--mut)' }}>{fmtBRLCompact(m.receita)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 12.5, color: 'var(--mut)' }}>
                  Crie um grupo (Holding) em <Link href="/dashboard/holding-teste" className="link-v2">Holding</Link> pra ver receita por empresa aqui.
                </div>
              )}
            </div>
          </div>

          {/* 5. Insights de hoje */}
          {insight && (
            <div className="insights-v2">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 10, fontWeight: 800, background: 'var(--acc2)', color: '#06130C', padding: '2px 8px', borderRadius: 20, letterSpacing: '.04em' }}>FACTORONE AI</span>
                <span style={{ fontSize: 12.5, fontWeight: 700 }}>Insights de hoje</span>
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.5, color: '#EAF6F0' }}>{insight}</div>
            </div>
          )}

          {/* 6. Despesas por Categoria + DRE resumido */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="card-v2">
              <div className="card-v2-h"><h3>Despesas por Categoria</h3></div>
              {topCats.length === 0 ? <div style={{ fontSize: 12.5, color: 'var(--mut)' }}>Sem despesas neste mês ainda.</div> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {topCats.map(c => (
                    <div key={c.cat}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                        <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{c.cat}</span>
                        <span style={{ color: 'var(--mut)' }}>{fmtBRLCompact(c.val)} · {totalCats > 0 ? ((c.val / totalCats) * 100).toFixed(1) : 0}%</span>
                      </div>
                      <div style={{ height: 5, background: 'var(--line)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${totalCats > 0 ? (c.val / totalCats) * 100 : 0}%`, background: 'var(--acc)', borderRadius: 3 }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="card-v2">
              <div className="card-v2-h"><h3>DRE (Mês)</h3><Link href="/dashboard/relatorios" className="link-v2">Ver completo →</Link></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--mut)' }}>Receita Bruta</span><span style={{ fontWeight: 600 }}>{fmtBRL(dreMes.receitaBruta)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--mut)' }}>EBITDA</span><span style={{ fontWeight: 600 }}>{fmtBRL(dreMes.ebitda)} · {margemEbitda.toFixed(1)}%</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--line)', paddingTop: 6, marginTop: 2 }}>
                  <span style={{ fontWeight: 700, color: 'var(--ink)' }}>Lucro Líquido</span>
                  <span style={{ fontWeight: 800, color: dreMes.liquido >= 0 ? 'var(--acc-ink)' : 'var(--neg)' }}>{fmtBRL(dreMes.liquido)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RAIL LATERAL DIREITO */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card-v2">
            <div className="card-v2-h"><h3>Conversas em tempo real</h3><Link href="/dashboard/agentes/conversas" className="link-v2">Ver todas</Link></div>
            {conversas.length === 0 ? <div style={{ fontSize: 12, color: 'var(--mut)' }}>Nenhuma conversa ainda.</div> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {conversas.map(c => (
                  <Link key={c.id} href="/dashboard/agentes/conversas" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none' }}>
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--acc-soft)', color: 'var(--acc-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 11, flexShrink: 0 }}>{iniciais(c.visitante_nome)}</div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.visitante_nome || 'Visitante'}</div>
                      <div style={{ fontSize: 11, color: 'var(--mut)' }}>Site · {new Date(c.updated_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                    {c.status === 'aguardando_humano' && <span className="chip-v2 r">novo</span>}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="card-v2">
            <div className="card-v2-h"><h3>Agenda de hoje</h3></div>
            <ProximosCompromissos empresaId={empresaId} />
          </div>

          <div className="card-v2">
            <div className="card-v2-h"><h3>Pendências & Aprovações</h3></div>
            {prioridades.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--mut)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
                  Prioridades
                </div>
                {prioridades.map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 12.5 }}>
                    <span style={{ width: 6, height: 6, borderRadius: 3, background: p.score >= 70 ? '#B0413E' : p.score >= 40 ? '#B08A3E' : 'var(--acc)', flexShrink: 0 }} />
                    <span style={{ color: 'var(--ink)', flex: 1 }}>
                      {p.origem === 'obrigacao_fiscal' ? 'Obrigação fiscal' : p.origem === 'documento' ? 'Documento pendente' : 'Transação a confirmar'}
                      {p.prazo && <span style={{ color: 'var(--mut)' }}> · vence {new Date(`${p.prazo}T12:00:00`).toLocaleDateString('pt-BR')}</span>}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}><b style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{pendencias.aprovacoes}</b><span style={{ color: 'var(--mut)' }}>solicitações aguardando aprovação</span></div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}><b style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{pendencias.contasPagarVencendo}</b><span style={{ color: 'var(--mut)' }}>contas a pagar vencendo (7d)</span></div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}><b style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{pendencias.reembolsos}</b><span style={{ color: 'var(--mut)' }}>reembolso(s) pendente(s)</span></div>
            </div>
          </div>

          <div className="card-v2">
            <div className="card-v2-h"><h3>Atalhos rápidos</h3></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { icon: 'fa-file-invoice-dollar', label: 'Nova cobrança', href: '/dashboard/financeiro/visao-geral' },
                { icon: 'fa-file-lines', label: 'Emitir NF-e', href: '/dashboard/notas' },
                { icon: 'fa-receipt', label: 'Registrar despesa', href: '/dashboard/despesas' },
                { icon: 'fa-building-columns', label: 'Conectar banco', href: '/dashboard/conexoes' },
              ].map(a => (
                <Link key={a.label} href={a.href} style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '12px 6px', borderRadius: 9, border: '1px solid var(--line)', color: 'var(--ink)' }}>
                  <i className={`fa-solid ${a.icon}`} style={{ fontSize: 15, color: 'var(--acc-ink)' }} />
                  <span style={{ fontSize: 11, fontWeight: 600, textAlign: 'center' }}>{a.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardErrorBoundary>
  )
}
