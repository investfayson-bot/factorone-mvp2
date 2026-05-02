'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Wallet,
  AlertTriangle,
  Plus,
  TrendingUp,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'

type Transacao = {
  id: string
  data: string
  descricao: string
  categoria: string
  tipo: 'entrada' | 'saida'
  valor: number
}

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)

export default function CashflowPage() {
  const [empresaId, setEmpresaId] = useState('')
  const [transacoes, setTransacoes] = useState<Transacao[]>([])
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'entrada' | 'saida'>('todos')
  const [filtroCategoria, setFiltroCategoria] = useState('todas')
  const [filtroPeriodo, setFiltroPeriodo] = useState<'30' | '90' | '365'>('30')
  const [loading, setLoading] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [loadingIA, setLoadingIA] = useState(false)
  const [insightIA, setInsightIA] = useState('')
  const [form, setForm] = useState({
    descricao: '',
    categoria: 'operacional',
    tipo: 'saida' as 'entrada' | 'saida',
    valor: '',
    data: new Date().toISOString().slice(0, 10),
  })

  const carregar = useCallback(async () => {
    setLoading(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    // Resolver empresa como todas as outras páginas fazem
    const { data: u } = await supabase
      .from('usuarios')
      .select('empresa_id')
      .eq('id', user.id)
      .maybeSingle()
    const empresa = u?.empresa_id ?? user.id
    setEmpresaId(empresa)

    const dt = new Date()
    dt.setDate(dt.getDate() - Number(filtroPeriodo))

    const { data, error } = await supabase
      .from('transacoes')
      .select('*')
      .eq('empresa_id', empresa)
      .gte('data', dt.toISOString().slice(0, 10))
      .order('data', { ascending: true })

    if (error) toast.error('Erro ao carregar transações: ' + error.message)
    setTransacoes((data as Transacao[]) || [])
    setLoading(false)
  }, [filtroPeriodo])

  useEffect(() => {
    void carregar()
  }, [carregar])

  async function criarTransacao() {
    if (!form.descricao.trim()) {
      toast.error('Preencha a descrição')
      return
    }
    const valor = Number(String(form.valor).replace(',', '.'))
    if (!valor || valor <= 0) {
      toast.error('Valor inválido')
      return
    }
    const { error } = await supabase.from('transacoes').insert({
      empresa_id: empresaId,
      data: form.data,
      descricao: form.descricao.trim(),
      categoria: form.categoria,
      tipo: form.tipo,
      valor,
      status: 'confirmada',
    })
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Transação registrada')
    setModalAberto(false)
    setForm({
      descricao: '',
      categoria: 'operacional',
      tipo: 'saida',
      valor: '',
      data: new Date().toISOString().slice(0, 10),
    })
    void carregar()
  }

  async function analisarIA() {
    setLoadingIA(true)
    setInsightIA('')
    try {
      const { data: sess } = await supabase.auth.getSession()
      const res = await fetch('/api/aicfo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sess.session?.access_token
            ? { Authorization: `Bearer ${sess.session.access_token}` }
            : {}),
        },
        body: JSON.stringify({
          message: 'Analise meu fluxo de caixa e traga riscos e ações para os próximos 30 dias.',
          context: JSON.stringify({ transacoes }),
        }),
      })
      const out = (await res.json()) as { response?: string; error?: string }
      setInsightIA(out.response || out.error || 'Sem resposta')
    } catch {
      toast.error('Falha na análise de IA')
    } finally {
      setLoadingIA(false)
    }
  }

  const categorias = useMemo(
    () => ['todas', ...Array.from(new Set(transacoes.map((t) => t.categoria || 'sem_categoria')))],
    [transacoes]
  )

  const filtradas = useMemo(
    () =>
      transacoes.filter(
        (t) =>
          (filtroTipo === 'todos' || t.tipo === filtroTipo) &&
          (filtroCategoria === 'todas' || t.categoria === filtroCategoria)
      ),
    [transacoes, filtroTipo, filtroCategoria]
  )

  const serie = transacoes.map((t, i) => {
    const saldo = transacoes
      .slice(0, i + 1)
      .reduce((s, x) => s + (x.tipo === 'entrada' ? Number(x.valor) : -Number(x.valor)), 0)
    return { ...t, saldo, projecao: null as number | null }
  })

  const saldoAcumulado = serie.length ? serie[serie.length - 1].saldo : 0
  const mediaDiaria =
    transacoes.length
      ? transacoes.reduce(
          (s, t) => s + (t.tipo === 'entrada' ? Number(t.valor) : -Number(t.valor)),
          0
        ) / Math.max(Number(filtroPeriodo), 1)
      : 0
  const projecao30 = saldoAcumulado + mediaDiaria * 30
  const serieComProjecao = [
    ...serie,
    {
      data: 'Proj. 30d',
      descricao: 'Projeção',
      categoria: 'projecao',
      tipo: 'entrada' as const,
      valor: 0,
      id: 'proj',
      saldo: saldoAcumulado,
      projecao: projecao30,
    },
  ]

  const entradasPeriodo = transacoes
    .filter((t) => t.tipo === 'entrada')
    .reduce((s, t) => s + Number(t.valor), 0)
  const saidasPeriodo = transacoes
    .filter((t) => t.tipo === 'saida')
    .reduce((s, t) => s + Number(t.valor), 0)
  const saldoAtual = entradasPeriodo - saidasPeriodo

  const periodoLabel = { '30': '30 dias', '90': '90 dias', '365': '12 meses' }[filtroPeriodo]

  return (
    <div className="min-h-full bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Fluxo de Caixa</h1>
            <p className="mt-1 text-sm text-slate-500">Últimos {periodoLabel} · dados reais</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => void analisarIA()}
              disabled={loadingIA || loading}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
            >
              {loadingIA ? 'Analisando…' : 'Analisar com IA'}
            </button>
            <button
              onClick={() => setModalAberto(true)}
              className="rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 flex items-center gap-2"
            >
              <Plus size={15} /> Nova transação
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            titulo="Saldo do período"
            valor={fmt(saldoAtual)}
            icon={<Wallet size={18} />}
            cor={saldoAtual >= 0 ? 'emerald' : 'red'}
          />
          <KpiCard
            titulo="Entradas"
            valor={fmt(entradasPeriodo)}
            icon={<ArrowUpCircle size={18} />}
            cor="emerald"
          />
          <KpiCard
            titulo="Saídas"
            valor={fmt(saidasPeriodo)}
            icon={<ArrowDownCircle size={18} />}
            cor="red"
          />
          <KpiCard
            titulo="Projeção 30 dias"
            valor={fmt(projecao30)}
            icon={<TrendingUp size={18} />}
            cor={projecao30 >= 0 ? 'blue' : 'red'}
          />
        </div>

        {/* Alerta saldo baixo */}
        {projecao30 < 5000 && transacoes.length > 0 && (
          <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertTriangle size={16} className="shrink-0" />
            <span>
              Atenção: projeção de caixa para os próximos 30 dias está abaixo de R$ 5.000.
            </span>
          </div>
        )}

        {/* Gráfico */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">
            Evolução do saldo acumulado
          </h2>
          {loading ? (
            <div className="h-64 animate-pulse rounded-xl bg-slate-100" />
          ) : transacoes.length === 0 ? (
            <EmptyState onAdd={() => setModalAberto(true)} />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={serieComProjecao}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="data"
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  tickFormatter={(v: string) =>
                    v === 'Proj. 30d'
                      ? 'Proj.'
                      : new Date(v + 'T12:00:00').toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                        })
                  }
                />
                <YAxis
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  tickFormatter={(v: number) =>
                    v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`
                  }
                />
                <Tooltip
                  formatter={(value: number) => [fmt(value), '']}
                  labelFormatter={(label: string) =>
                    label === 'Proj. 30d' ? 'Projeção 30 dias' : label
                  }
                />
                <Area
                  type="monotone"
                  dataKey="saldo"
                  stroke="#1d4ed8"
                  fill="#dbeafe"
                  name="Saldo"
                />
                <Area
                  type="monotone"
                  dataKey="projecao"
                  stroke="#f59e0b"
                  fill="transparent"
                  strokeDasharray="6 3"
                  name="Projeção"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <select
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
            value={filtroPeriodo}
            onChange={(e) => setFiltroPeriodo(e.target.value as '30' | '90' | '365')}
          >
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
            <option value="365">Último ano</option>
          </select>
          <select
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria(e.target.value)}
          >
            {categorias.map((c) => (
              <option key={c} value={c}>
                {c === 'todas' ? 'Todas as categorias' : c}
              </option>
            ))}
          </select>
          <select
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value as 'todos' | 'entrada' | 'saida')}
          >
            <option value="todos">Todos os tipos</option>
            <option value="entrada">Entradas</option>
            <option value="saida">Saídas</option>
          </select>
        </div>

        {/* Tabela */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="p-3">Data</th>
                  <th className="p-3">Descrição</th>
                  <th className="p-3">Categoria</th>
                  <th className="p-3">Tipo</th>
                  <th className="p-3 text-right">Valor</th>
                  <th className="p-3 text-right">Saldo acumulado</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      {Array.from({ length: 6 }).map((__, j) => (
                        <td key={j} className="p-3">
                          <div className="h-4 animate-pulse rounded bg-slate-100" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtradas.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      {transacoes.length === 0
                        ? 'Nenhuma transação registrada. Clique em "Nova transação" para começar.'
                        : 'Nenhuma transação com os filtros atuais.'}
                    </td>
                  </tr>
                ) : (
                  filtradas.map((t) => {
                    const saldoRow = serie.find((s) => s.id === t.id)?.saldo ?? 0
                    return (
                      <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50/80">
                        <td className="p-3 text-slate-600">
                          {new Date(t.data + 'T12:00:00').toLocaleDateString('pt-BR')}
                        </td>
                        <td className="p-3 font-medium text-slate-800">{t.descricao}</td>
                        <td className="p-3 text-slate-600">{t.categoria || '—'}</td>
                        <td className="p-3">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                              t.tipo === 'entrada'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {t.tipo === 'entrada' ? (
                              <ArrowUpCircle size={11} />
                            ) : (
                              <ArrowDownCircle size={11} />
                            )}
                            {t.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                          </span>
                        </td>
                        <td
                          className={`p-3 text-right font-semibold tabular-nums ${
                            t.tipo === 'entrada' ? 'text-emerald-700' : 'text-red-600'
                          }`}
                        >
                          {t.tipo === 'entrada' ? '+' : '-'}
                          {fmt(Number(t.valor))}
                        </td>
                        <td className="p-3 text-right tabular-nums text-slate-700">
                          {fmt(saldoRow)}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Insight IA */}
        {insightIA && (
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-blue-900">Análise de Fluxo — FactorOne IA</h2>
              <button onClick={() => setInsightIA('')} className="text-blue-400 hover:text-blue-600">
                <X size={16} />
              </button>
            </div>
            <p className="whitespace-pre-line text-sm text-blue-800">{insightIA}</p>
          </div>
        )}
      </div>

      {/* Modal nova transação */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-800">Nova transação</h3>
            <p className="mb-4 text-sm text-slate-500">Registre uma entrada ou saída de caixa.</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-600">Descrição *</label>
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  placeholder="Ex.: Pagamento cliente XYZ"
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600">Tipo *</label>
                  <select
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    value={form.tipo}
                    onChange={(e) => setForm({ ...form, tipo: e.target.value as 'entrada' | 'saida' })}
                  >
                    <option value="entrada">Entrada</option>
                    <option value="saida">Saída</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Categoria</label>
                  <select
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    value={form.categoria}
                    onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                  >
                    <option value="operacional">Operacional</option>
                    <option value="impostos">Impostos</option>
                    <option value="custo">Custo</option>
                    <option value="receita_extra">Receita extra</option>
                    <option value="financeira">Financeira</option>
                    <option value="depreciacao">Depreciação</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600">Valor (R$) *</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    placeholder="0,00"
                    value={form.valor}
                    onChange={(e) => setForm({ ...form, valor: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Data</label>
                  <input
                    type="date"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    value={form.data}
                    onChange={(e) => setForm({ ...form, data: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700"
                onClick={() => setModalAberto(false)}
              >
                Cancelar
              </button>
              <button
                className="rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
                onClick={() => void criarTransacao()}
              >
                Registrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function KpiCard({
  titulo,
  valor,
  icon,
  cor,
}: {
  titulo: string
  valor: string
  icon: React.ReactNode
  cor: 'emerald' | 'red' | 'blue' | 'slate'
}) {
  const colorMap = {
    emerald: 'text-emerald-600',
    red: 'text-red-600',
    blue: 'text-blue-600',
    slate: 'text-slate-600',
  }
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className={`flex items-center gap-2 text-sm ${colorMap[cor]}`}>
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{titulo}</span>
      </div>
      <p className="mt-2 text-xl font-bold text-slate-900">{valor}</p>
    </div>
  )
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
      <Wallet size={40} className="text-slate-300" />
      <div>
        <p className="font-medium text-slate-700">Nenhuma transação registrada</p>
        <p className="mt-1 text-sm text-slate-500">
          Registre entradas e saídas para visualizar seu fluxo de caixa.
        </p>
      </div>
      <button
        onClick={onAdd}
        className="mt-2 rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
      >
        + Registrar primeira transação
      </button>
    </div>
  )
}
