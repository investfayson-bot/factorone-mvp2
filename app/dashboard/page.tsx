'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  FileText,
  Zap,
  ArrowUpRight,
  AlertCircle,
  ArrowUp,
  CheckCircle2,
} from 'lucide-react'
import { calcDREFromTransacoes, fmtBRL, fmtBRLCompact, variacaoPct, type TransacaoDRE } from '@/lib/dre-calculations'
import HealthScore from '@/components/dashboard/HealthScore'
import UpcomingPayments from '@/components/dashboard/UpcomingPayments'
import AnomalyAlerts from '@/components/dashboard/AnomalyAlerts'
import MiniDRE from '@/components/dashboard/MiniDRE'
import EntradasSaidasChart from '@/components/dashboard/EntradasSaidasChart'
import { DashboardErrorBoundary } from '@/components/dashboard/DashboardErrorBoundary'
import DashboardPageHeader from '@/components/dashboard/DashboardPageHeader'
import type { TransacaoLista } from '@/lib/transacao-types'

type Kpi = {
  receita: number
  despesas: number
  saldo: number
  nfs: number
}
type OrcamentoWidget = { consumidoPct: number; alertas: number; top: string[] }

function KpiTrendPct({ atual, anterior, invert }: { atual: number; anterior: number; invert?: boolean }) {
  const v = variacaoPct(atual, anterior)
  if (v === null) {
    return <span className="text-xs font-medium text-slate-500">1º mês</span>
  }
  const good = invert ? v <= 0 : v >= 0
  return (
    <span className={`text-xs font-semibold inline-flex items-center gap-0.5 ${good ? 'text-emerald-600' : 'text-red-600'}`}>
      {good ? <ArrowUp className="w-3.5 h-3.5 shrink-0" /> : <TrendingDown className="w-3.5 h-3.5 shrink-0" />}
      {v >= 0 ? '+' : ''}
      {v.toFixed(1).replace('.', ',')}%
    </span>
  )
}

function tituloTransacao(t: TransacaoLista): string {
  const d = (t.descricao || '').trim()
  if (!d) return t.tipo === 'entrada' ? 'Entrada' : 'Saída'
  if (/pix/i.test(d)) return d.toLowerCase().includes('receb') ? 'Pix Recebido' : d.toLowerCase().includes('saída') || d.toLowerCase().includes('saida') ? 'Pix Saída' : 'Transferência PIX'
  if (/ted|transfer/i.test(d)) return 'Transferência / TED'
  return d.length > 48 ? `${d.slice(0, 45)}…` : d
}

function subtituloTransacao(t: TransacaoLista): string {
  const d = new Date(t.data).toLocaleDateString('pt-BR')
  const cat = t.categoria || '—'
  return `${cat} · ${d}`
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [kpiAtual, setKpiAtual] = useState<Kpi>({ receita: 0, despesas: 0, saldo: 0, nfs: 0 })
  const [kpiAnt, setKpiAnt] = useState<Kpi>({ receita: 0, despesas: 0, saldo: 0, nfs: 0 })
  const [aiInsight, setAiInsight] = useState('')
  const [loadingAi, setLoadingAi] = useState(false)
  const [transacoes, setTransacoes] = useState<TransacaoLista[]>([])
  const [orcamentoWidget, setOrcamentoWidget] = useState<OrcamentoWidget>({ consumidoPct: 0, alertas: 0, top: [] })
  const [empresaNome, setEmpresaNome] = useState('')
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [dreMes, setDreMes] = useState({ liquido: 0, liquidoAnt: 0 })
  const [fluxo30, setFluxo30] = useState(0)
  const [riscoRunwayDias, setRiscoRunwayDias] = useState<number | null>(null)
  const router = useRouter()

  useEffect(() => {
    async function load() {
      const {
        data: { user: u },
      } = await supabase.auth.getUser()
      if (!u) {
        router.push('/auth')
        return
      }
      setUser(u)

      const { data: usrRow } = await supabase.from('usuarios').select('empresa_id').eq('id', u.id).maybeSingle()
      const eid = (usrRow?.empresa_id as string | null) ?? u.id
      setEmpresaId(eid)

      if (usrRow?.empresa_id) {
        const { data: emp } = await supabase.from('empresas').select('nome').eq('id', usrRow.empresa_id).maybeSingle()
        setEmpresaNome((emp?.nome as string) || '')
      } else {
        setEmpresaNome('')
      }

      const now = new Date()
      const inicioAtual = new Date(now.getFullYear(), now.getMonth(), 1)
      const fimAtual = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      const inicioAnt = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const fimAnt = new Date(now.getFullYear(), now.getMonth(), 0)

      const a0 = inicioAtual.toISOString().slice(0, 10)
      const a1 = fimAtual.toISOString().slice(0, 10)
      const b0 = inicioAnt.toISOString().slice(0, 10)
      const b1 = fimAnt.toISOString().slice(0, 10)

      const fold = (rows: TransacaoLista[]) => {
        const rec = rows.filter((x) => x.tipo === 'entrada').reduce((s, x) => s + Number(x.valor), 0)
        const desp = rows.filter((x) => x.tipo === 'saida').reduce((s, x) => s + Number(x.valor), 0)
        return { receita: rec, despesas: desp, saldo: rec - desp }
      }

      const { data: tAtual } = await supabase
        .from('transacoes')
        .select('*')
        .eq('empresa_id', eid)
        .gte('data', a0)
        .lte('data', a1)
        .order('data', { ascending: false })

      const { data: tAnt } = await supabase
        .from('transacoes')
        .select('*')
        .eq('empresa_id', eid)
        .gte('data', b0)
        .lte('data', b1)

      const dt30 = new Date()
      dt30.setDate(dt30.getDate() - 30)
      const d30 = dt30.toISOString().slice(0, 10)
      const { data: t30 } = await supabase
        .from('transacoes')
        .select('tipo,valor')
        .eq('empresa_id', eid)
        .gte('data', d30)

      const fold30 = (rows: { tipo: string; valor: number | string }[]) => {
        let e = 0
        let s = 0
        for (const x of rows) {
          const v = Number(x.valor) || 0
          if (x.tipo === 'entrada') e += v
          else s += v
        }
        return e - s
      }
      setFluxo30(fold30((t30 || []) as { tipo: string; valor: number | string }[]))

      const ka = fold((tAtual ?? []) as TransacaoLista[])
      const kb = fold((tAnt ?? []) as TransacaoLista[])

      const dreA = calcDREFromTransacoes((tAtual || []) as TransacaoDRE[])
      const dreB = calcDREFromTransacoes((tAnt || []) as TransacaoDRE[])
      setDreMes({ liquido: dreA.lucroLiquido, liquidoAnt: dreB.lucroLiquido })

      const { data: contaPri } = await supabase
        .from('contas_bancarias')
        .select('saldo_disponivel,saldo')
        .eq('empresa_id', eid)
        .eq('is_principal', true)
        .maybeSingle()
      const saldoBanco = Number(contaPri?.saldo_disponivel ?? contaPri?.saldo ?? 0)
      const despDia = ka.despesas > 0 ? ka.despesas / 30 : 0
      if (saldoBanco > 0 && despDia > 0) {
        setRiscoRunwayDias(Math.min(999, Math.floor(saldoBanco / despDia)))
      } else if (saldoBanco > 0 && ka.despesas === 0) {
        setRiscoRunwayDias(999)
      } else {
        setRiscoRunwayDias(null)
      }

      const { count: cAtual } = await supabase
        .from('notas_fiscais')
        .select('*', { count: 'exact', head: true })
        .eq('empresa_id', eid)
        .eq('status', 'pendente')
        .gte('data_emissao', a0)
        .lte('data_emissao', a1)

      const { count: cAnt } = await supabase
        .from('notas_fiscais')
        .select('*', { count: 'exact', head: true })
        .eq('empresa_id', eid)
        .eq('status', 'pendente')
        .gte('data_emissao', b0)
        .lte('data_emissao', b1)

      setKpiAtual({ ...ka, nfs: cAtual ?? 0 })
      setKpiAnt({ ...kb, nfs: cAnt ?? 0 })

      setTransacoes((tAtual || []).slice(0, 5))
      const anoAtual = now.getFullYear()
      const { data: orc } = await supabase
        .from('orcamentos')
        .select('id')
        .eq('empresa_id', eid)
        .eq('ano_fiscal', anoAtual)
        .in('status', ['ativo', 'aprovado'])
        .order('versao', { ascending: false })
        .limit(1)
        .maybeSingle()
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
          c.p += Number(l.valor_previsto || 0)
          c.r += Number(l.valor_realizado || 0)
          byCat.set(l.categoria, c)
        }
        const top = Array.from(byCat.entries())
          .map(([k, v]) => ({ k, pct: v.p > 0 ? (v.r / v.p) * 100 : 0 }))
          .sort((a, b) => b.pct - a.pct)
          .slice(0, 3)
          .map((x) => x.k)
        setOrcamentoWidget({ consumidoPct: previsto > 0 ? (realizado / previsto) * 100 : 0, alertas: (al.data || []).length, top })
      }

      setLoading(false)
    }
    load()
  }, [router])

  async function gerarInsight() {
    setLoadingAi(true)
    setAiInsight('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/aicfo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          message:
            'Com base nos dados recentes, sintetize riscos e oportunidades para este mês.',
          context: 'dashboard',
        }),
      })
      const data = await res.json()
      setAiInsight(data.response || data.error || 'Erro ao gerar análise')
    } catch {
      setAiInsight('Erro de conexão')
    }
    setLoadingAi(false)
  }

  const hora = new Date().getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'
  const nome = user?.email?.split('@')[0] ?? '—'

  if (loading || !user || !empresaId) {
    return (
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-pulse">
        <div className="h-10 bg-slate-200 rounded-xl w-2/3 max-w-md" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-slate-200 rounded-2xl" />
          ))}
        </div>
        <div className="h-64 bg-slate-200 rounded-2xl" />
      </div>
    )
  }

  const cards = [
    {
      label: 'Receita Mensal',
      value: fmtBRLCompact(kpiAtual.receita),
      icon: TrendingUp,
      varEl: <KpiTrendPct atual={kpiAtual.receita} anterior={kpiAnt.receita} />,
      iconWrap: 'bg-emerald-50 border-emerald-100',
      iconColor: 'text-emerald-600',
    },
    {
      label: 'Lucro Líquido',
      value: fmtBRLCompact(dreMes.liquido),
      icon: DollarSign,
      varEl: <KpiTrendPct atual={dreMes.liquido} anterior={dreMes.liquidoAnt} />,
      iconWrap: 'bg-sky-50 border-sky-100',
      iconColor: 'text-sky-600',
    },
    {
      label: 'Fluxo 30d',
      value: fmtBRLCompact(fluxo30),
      icon: ArrowUpRight,
      varEl:
        fluxo30 >= 0 ? (
          <span className="text-xs font-semibold text-emerald-600 inline-flex items-center gap-0.5">
            <ArrowUp className="w-3.5 h-3.5 shrink-0" />
            OK
          </span>
        ) : (
          <span className="text-xs font-semibold text-red-600">Fluxo líquido negativo (30d)</span>
        ),
      iconWrap: 'bg-violet-50 border-violet-100',
      iconColor: 'text-violet-600',
    },
    {
      label: 'Alerta IA',
      value: riscoRunwayDias != null ? `⚡ Risco ${riscoRunwayDias}d` : '—',
      icon: Zap,
      varEl:
        riscoRunwayDias != null ? (
          riscoRunwayDias < 90 ? (
            <span className="text-xs font-medium text-amber-700">Atenção à liquidez</span>
          ) : (
            <span className="text-xs font-medium text-emerald-600">Runway confortável</span>
          )
        ) : (
          <span className="text-xs text-slate-500">Abra conta PJ para runway com saldo real</span>
        ),
      iconWrap: 'bg-amber-50 border-amber-100',
      iconColor: 'text-amber-600',
    },
  ]

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Linha 1 */}
      <DashboardPageHeader
        title={empresaNome ? `Dashboard — ${empresaNome}` : 'Dashboard'}
        subtitle={`${saudacao}, ${nome} · ${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}`}
        badge="live"
      >
        <button
          type="button"
          onClick={gerarInsight}
          disabled={loadingAi}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-800 disabled:opacity-50 sm:w-auto"
        >
          <Zap size={16} />
          {loadingAi ? 'Analisando...' : 'Análise IA'}
        </button>
      </DashboardPageHeader>

      {/* Linha 2 */}
      <DashboardErrorBoundary title="Alertas">
        <AnomalyAlerts empresaId={empresaId as string} />
      </DashboardErrorBoundary>

      {/* Linha 3 — KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((m) => (
          <div
            key={m.label}
            className="rounded-2xl border border-gray-200/90 bg-white p-5 shadow-sm transition-all hover:border-emerald-200/80 hover:shadow-md"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{m.label}</span>
              <div className={`w-8 h-8 rounded-lg border flex items-center justify-center ${m.iconWrap}`}>
                <m.icon size={16} className={m.iconColor} />
              </div>
            </div>
            <p className="text-2xl font-bold tracking-tight text-gray-900">{m.value}</p>
            <div className="mt-2 min-h-[1.25rem]">{m.varEl}</div>
          </div>
        ))}
      </div>

      {/* Linha 4 — Health + Vencimentos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <DashboardErrorBoundary title="Score de saúde">
            <HealthScore empresaId={empresaId as string} />
          </DashboardErrorBoundary>
        </div>
        <div className="lg:col-span-2">
          <DashboardErrorBoundary title="Vencimentos">
            <UpcomingPayments empresaId={empresaId as string} />
          </DashboardErrorBoundary>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200/90 bg-white p-5 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Orçamento</h3>
          <Link href="/dashboard/orcamento" className="text-sm font-medium text-emerald-700 hover:text-emerald-800">
            Ver orçamento completo
          </Link>
        </div>
        <p className="text-sm text-slate-600">% consumido do ano: <span className="font-semibold">{orcamentoWidget.consumidoPct.toFixed(1)}%</span></p>
        <p className="text-sm text-slate-600">Alertas ativos: <span className="font-semibold">{orcamentoWidget.alertas}</span></p>
        <p className="text-sm text-slate-600">Categorias próximas do limite: {orcamentoWidget.top.join(', ') || '—'}</p>
      </div>

      {/* Linha 5 — Gráfico + Mini DRE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="min-w-0 lg:col-span-2">
          <DashboardErrorBoundary title="Fluxo de caixa">
            <EntradasSaidasChart empresaId={empresaId as string} />
          </DashboardErrorBoundary>
        </div>
        <div className="lg:col-span-1">
          <DashboardErrorBoundary title="DRE resumido">
            <MiniDRE empresaId={empresaId as string} />
          </DashboardErrorBoundary>
        </div>
      </div>

      {/* CFO + Linha 6 transações */}
      <div className="bg-gradient-to-r from-blue-700 to-blue-800 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
            <Zap size={16} className="text-white" />
          </div>
          <h2 className="font-semibold text-white">CFO Inteligente</h2>
          <span className="text-xs bg-white/20 text-blue-100 px-2 py-0.5 rounded-full">IA</span>
        </div>
        {aiInsight ? (
          <p className="text-blue-50 text-sm leading-relaxed whitespace-pre-line">{aiInsight}</p>
        ) : (
          <div className="flex items-center gap-3 text-blue-100">
            <AlertCircle size={16} />
            <p className="text-sm">
              Clique em &quot;Análise IA&quot; para receber insights personalizados sobre sua empresa.
            </p>
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-800">Últimas transações</h2>
          <Link
            href="/dashboard/cashflow"
            className="text-blue-700 hover:text-blue-800 text-sm flex items-center gap-1 font-medium"
          >
            Ver todas <ArrowUpRight size={14} />
          </Link>
        </div>
        {transacoes.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <FileText size={32} className="mx-auto mb-2 opacity-50 text-slate-300" />
            <p className="text-sm">Nenhuma transação este mês</p>
            <button
              type="button"
              onClick={() => router.push('/dashboard/cashflow')}
              className="mt-3 text-blue-700 text-sm hover:underline"
            >
              Adicionar transação
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {transacoes.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      t.tipo === 'entrada' ? 'bg-emerald-100' : 'bg-red-100'
                    }`}
                  >
                    {t.tipo === 'entrada' ? (
                      <CheckCircle2 size={14} className="text-emerald-600" />
                    ) : Number(t.valor) > 50000 ? (
                      <Zap size={14} className="text-amber-600" />
                    ) : (
                      <TrendingDown size={14} className="text-red-600" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-slate-800 text-sm font-medium truncate">{tituloTransacao(t)}</p>
                    <p className="text-slate-400 text-xs truncate">{subtituloTransacao(t)}</p>
                  </div>
                </div>
                <span
                  className={`font-semibold text-sm shrink-0 tabular-nums ${
                    t.tipo === 'entrada' ? 'text-emerald-600' : 'text-red-600'
                  }`}
                >
                  {t.tipo === 'entrada' ? '+' : '-'}
                  {fmtBRL(Number(t.valor))}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
