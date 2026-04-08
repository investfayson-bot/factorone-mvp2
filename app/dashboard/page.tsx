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
} from 'lucide-react'
import { fmtBRL } from '@/lib/dre-calculations'
import HealthScore from '@/components/dashboard/HealthScore'
import UpcomingPayments from '@/components/dashboard/UpcomingPayments'
import AnomalyAlerts from '@/components/dashboard/AnomalyAlerts'
import MiniDRE from '@/components/dashboard/MiniDRE'
import CashflowMiniChart from '@/components/dashboard/CashflowMiniChart'
import { DashboardErrorBoundary } from '@/components/dashboard/DashboardErrorBoundary'
import type { TransacaoLista } from '@/lib/transacao-types'

type Kpi = {
  receita: number
  despesas: number
  saldo: number
  nfs: number
}

function pctVar(atual: number, anterior: number): number | null {
  if (anterior === 0) return null
  return ((atual - anterior) / Math.abs(anterior)) * 100
}

function VarLabel({ atual, anterior }: { atual: number; anterior: number }) {
  const v = pctVar(atual, anterior)
  if (v === null) {
    return <span className="text-xs font-medium text-blue-600">Primeiro mês</span>
  }
  const pos = v >= 0
  return (
    <span className={`text-xs font-semibold ${pos ? 'text-emerald-600' : 'text-red-600'}`}>
      {pos ? '+' : ''}
      {v.toFixed(1)}% vs mês anterior
    </span>
  )
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [kpiAtual, setKpiAtual] = useState<Kpi>({ receita: 0, despesas: 0, saldo: 0, nfs: 0 })
  const [kpiAnt, setKpiAnt] = useState<Kpi>({ receita: 0, despesas: 0, saldo: 0, nfs: 0 })
  const [aiInsight, setAiInsight] = useState('')
  const [loadingAi, setLoadingAi] = useState(false)
  const [transacoes, setTransacoes] = useState<TransacaoLista[]>([])
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

      const now = new Date()
      const inicioAtual = new Date(now.getFullYear(), now.getMonth(), 1)
      const fimAtual = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      const inicioAnt = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const fimAnt = new Date(now.getFullYear(), now.getMonth(), 0)

      const a0 = inicioAtual.toISOString().slice(0, 10)
      const a1 = fimAtual.toISOString().slice(0, 10)
      const b0 = inicioAnt.toISOString().slice(0, 10)
      const b1 = fimAnt.toISOString().slice(0, 10)

      const { data: tAtual } = await supabase
        .from('transacoes')
        .select('*')
        .eq('empresa_id', u.id)
        .gte('data', a0)
        .lte('data', a1)
        .order('data', { ascending: false })

      const { data: tAnt } = await supabase
        .from('transacoes')
        .select('*')
        .eq('empresa_id', u.id)
        .gte('data', b0)
        .lte('data', b1)

      const fold = (rows: TransacaoLista[]) => {
        const rec = rows.filter((x) => x.tipo === 'entrada').reduce((s, x) => s + Number(x.valor), 0)
        const desp = rows.filter((x) => x.tipo === 'saida').reduce((s, x) => s + Number(x.valor), 0)
        return { receita: rec, despesas: desp, saldo: rec - desp }
      }

      const ka = fold((tAtual ?? []) as TransacaoLista[])
      const kb = fold((tAnt ?? []) as TransacaoLista[])

      const { count: cAtual } = await supabase
        .from('notas_fiscais')
        .select('*', { count: 'exact', head: true })
        .eq('empresa_id', u.id)
        .eq('status', 'pendente')
        .gte('data_emissao', a0)
        .lte('data_emissao', a1)

      const { count: cAnt } = await supabase
        .from('notas_fiscais')
        .select('*', { count: 'exact', head: true })
        .eq('empresa_id', u.id)
        .eq('status', 'pendente')
        .gte('data_emissao', b0)
        .lte('data_emissao', b1)

      setKpiAtual({ ...ka, nfs: cAtual ?? 0 })
      setKpiAnt({ ...kb, nfs: cAnt ?? 0 })

      setTransacoes((tAtual || []).slice(0, 5))

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

  if (loading || !user) {
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

  const empresaId = user.id

  const cards = [
    {
      label: 'Receita do mês',
      value: fmtBRL(kpiAtual.receita),
      icon: TrendingUp,
      varEl: <VarLabel atual={kpiAtual.receita} anterior={kpiAnt.receita} />,
      iconWrap: 'bg-emerald-50 border-emerald-100',
      iconColor: 'text-emerald-600',
    },
    {
      label: 'Despesas do mês',
      value: fmtBRL(kpiAtual.despesas),
      icon: TrendingDown,
      varEl: <VarLabel atual={kpiAtual.despesas} anterior={kpiAnt.despesas} />,
      iconWrap: 'bg-red-50 border-red-100',
      iconColor: 'text-red-600',
    },
    {
      label: 'Saldo do mês',
      value: fmtBRL(kpiAtual.saldo),
      icon: DollarSign,
      varEl: <VarLabel atual={kpiAtual.saldo} anterior={kpiAnt.saldo} />,
      iconWrap: kpiAtual.saldo >= 0 ? 'bg-blue-50 border-blue-100' : 'bg-red-50 border-red-100',
      iconColor: kpiAtual.saldo >= 0 ? 'text-blue-600' : 'text-red-600',
    },
    {
      label: 'NFs pendentes (mês)',
      value: String(kpiAtual.nfs),
      icon: FileText,
      varEl: <VarLabel atual={kpiAtual.nfs} anterior={kpiAnt.nfs} />,
      iconWrap: 'bg-amber-50 border-amber-100',
      iconColor: 'text-amber-600',
    },
  ]

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Linha 1 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800">
            {saudacao}, {nome}!
          </h1>
          <p className="text-slate-500 text-sm mt-1 capitalize">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <button
          type="button"
          onClick={gerarInsight}
          disabled={loadingAi}
          className="bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 text-sm w-full sm:w-auto"
        >
          <Zap size={16} />
          {loadingAi ? 'Analisando...' : 'Análise IA'}
        </button>
      </div>

      {/* Linha 2 */}
      <DashboardErrorBoundary title="Alertas">
        <AnomalyAlerts empresaId={empresaId} />
      </DashboardErrorBoundary>

      {/* Linha 3 — KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((m) => (
          <div
            key={m.label}
            className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-blue-200 transition-all"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-slate-500 text-xs font-semibold uppercase tracking-wide">{m.label}</span>
              <div className={`w-8 h-8 rounded-lg border flex items-center justify-center ${m.iconWrap}`}>
                <m.icon size={16} className={m.iconColor} />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-800">{m.value}</p>
            <div className="mt-2 min-h-[1.25rem]">{m.varEl}</div>
          </div>
        ))}
      </div>

      {/* Linha 4 — Health + Vencimentos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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

      {/* Linha 5 — Gráfico + Mini DRE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="min-w-0 lg:col-span-2">
          <DashboardErrorBoundary title="Fluxo de caixa">
            <CashflowMiniChart empresaId={empresaId} />
          </DashboardErrorBoundary>
        </div>
        <div className="lg:col-span-1">
          <DashboardErrorBoundary title="DRE resumido">
            <MiniDRE empresaId={empresaId} />
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
                      <TrendingUp size={14} className="text-emerald-600" />
                    ) : (
                      <TrendingDown size={14} className="text-red-600" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-slate-800 text-sm font-medium truncate">{t.descricao || 'Sem descrição'}</p>
                    <p className="text-slate-400 text-xs truncate">
                      {t.categoria || 'Sem categoria'} • {new Date(t.data).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
                <span
                  className={`font-semibold text-sm shrink-0 ${
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
