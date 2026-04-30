'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowDownCircle, ArrowUpCircle, Wallet, AlertTriangle, Plus } from 'lucide-react'
import { formatBRL } from '@/lib/currency-brl'

type Transacao = {
  id: string
  data: string
  descricao: string
  categoria: string
  tipo: 'entrada' | 'saida'
  valor: number
}

export default function CashflowPage() {
  const [empresaId, setEmpresaId] = useState('')
  const [transacoes, setTransacoes] = useState<Transacao[]>([])
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'entrada' | 'saida'>('todos')
  const [filtroCategoria, setFiltroCategoria] = useState('todas')
  const [filtroPeriodo, setFiltroPeriodo] = useState<'30' | '90' | '365'>('30')
  const [modalAberto, setModalAberto] = useState(false)
  const [loadingIA, setLoadingIA] = useState(false)
  const [insightIA, setInsightIA] = useState('')
  const [form, setForm] = useState({
    descricao: '',
    categoria: 'operacional',
    tipo: 'saida',
    valor: 0,
    data: new Date().toISOString().slice(0, 10),
  })

  const carregar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setEmpresaId(user.id)

    const dt = new Date()
    dt.setDate(dt.getDate() - Number(filtroPeriodo))
    const { data } = await supabase
      .from('transacoes')
      .select('*')
      .eq('empresa_id', user.id)
      .gte('data', dt.toISOString().slice(0, 10))
      .order('data', { ascending: true })
    setTransacoes((data as Transacao[]) || [])
  }, [filtroPeriodo])

  useEffect(() => {
    void carregar()
  }, [carregar])

  async function criarTransacao() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('transacoes').insert({
      empresa_id: user.id,
      data: form.data,
      descricao: form.descricao,
      categoria: form.categoria,
      tipo: form.tipo,
      valor: form.valor,
      status: 'confirmada',
    })
    setModalAberto(false)
    setForm({ descricao: '', categoria: 'operacional', tipo: 'saida', valor: 0, data: new Date().toISOString().slice(0, 10) })
    await carregar()
  }

  async function analisarIA() {
    setLoadingIA(true)
    const { data: sess } = await supabase.auth.getSession()
    const res = await fetch('/api/aicfo', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(sess.session?.access_token ? { Authorization: `Bearer ${sess.session.access_token}` } : {}),
      },
      body: JSON.stringify({
        message: 'Analise meu fluxo de caixa e traga riscos e ações para os próximos 30 dias.',
        context: JSON.stringify({ transacoes }),
      }),
    })
    const data = await res.json()
    setInsightIA(data.response || data.error || '')
    setLoadingIA(false)
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
      ? transacoes.reduce((s, t) => s + (t.tipo === 'entrada' ? Number(t.valor) : -Number(t.valor)), 0) /
        transacoes.length
      : 0
  const projecao30 = saldoAcumulado + mediaDiaria * 30
  const serieComProjecao = [
    ...serie,
    {
      data: 'Projeção 30d',
      descricao: 'Projeção',
      categoria: 'projecao',
      tipo: 'entrada' as const,
      valor: 0,
      saldo: saldoAcumulado,
      projecao: projecao30,
    },
  ]

  const entradasMes = transacoes.filter((t) => t.tipo === 'entrada').reduce((s, t) => s + Number(t.valor), 0)
  const saidasMes = transacoes.filter((t) => t.tipo === 'saida').reduce((s, t) => s + Number(t.valor), 0)
  const saldoAtual = entradasMes - saidasMes

  return (
    <div className="min-h-full bg-slate-50 p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Fluxo de Caixa</h1>
        <div className="flex gap-2">
          <button
            className="bg-blue-700 hover:bg-blue-800 text-white font-semibold px-5 py-2.5 rounded-xl shadow-sm flex items-center gap-2"
            onClick={() => setModalAberto(true)}
          >
            <Plus size={15} /> Nova transação
          </button>
          <button
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-medium px-5 py-2.5 rounded-xl"
            onClick={() => void analisarIA()}
            disabled={loadingIA}
          >
            {loadingIA ? 'Analisando...' : 'Analisar com IA'}
          </button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard titulo="Saldo atual" valor={formatBRL(saldoAtual)} icon={<Wallet size={16} />} cor={saldoAtual >= 0 ? 'text-emerald-600' : 'text-red-600'} />
        <KPICard titulo="Entradas período" valor={formatBRL(entradasMes)} icon={<ArrowUpCircle size={16} />} cor="text-emerald-600" />
        <KPICard titulo="Saídas período" valor={formatBRL(saidasMes)} icon={<ArrowDownCircle size={16} />} cor="text-red-600" />
        <KPICard titulo="Projeção 30 dias" valor={formatBRL(projecao30)} icon={<Wallet size={16} />} cor={projecao30 >= 0 ? 'text-blue-600' : 'text-red-600'} />
      </div>

      {projecao30 < 5000 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-2 text-red-800 text-sm">
          <AlertTriangle size={16} /> Alerta: projeção abaixo de R$ 5.000 nos próximos 30 dias.
        </div>
      )}

      {transacoes.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500">
          Nenhuma transação no período. Use o botão &quot;Nova transação&quot; para registrar.
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={serieComProjecao}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="data" tick={{ fill: '#64748b', fontSize: 11 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => formatBRL(v)} />
              <Area type="monotone" dataKey="saldo" name="Saldo acumulado" stroke="#2563eb" fill="#dbeafe" />
              <Area type="monotone" dataKey="projecao" name="Projeção" stroke="#f59e0b" fill="transparent" strokeDasharray="6 6" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <select
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700"
          value={filtroPeriodo}
          onChange={(e) => setFiltroPeriodo(e.target.value as '30' | '90' | '365')}
        >
          <option value="30">Últimos 30 dias</option>
          <option value="90">Últimos 90 dias</option>
          <option value="365">Último ano</option>
        </select>
        <select
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700"
          value={filtroCategoria}
          onChange={(e) => setFiltroCategoria(e.target.value)}
        >
          {categorias.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700"
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value as 'todos' | 'entrada' | 'saida')}
        >
          <option value="todos">Todos</option>
          <option value="entrada">Entradas</option>
          <option value="saida">Saídas</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="p-3">Data</th>
                <th className="p-3">Descrição</th>
                <th className="p-3">Categoria</th>
                <th className="p-3">Tipo</th>
                <th className="p-3">Valor</th>
                <th className="p-3">Saldo acumulado</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    Nenhuma transação com os filtros atuais.
                  </td>
                </tr>
              ) : (
                filtradas.map((t) => (
                  <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50/80">
                    <td className="p-3 text-slate-600">
                      {new Date(t.data + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </td>
                    <td className="p-3 font-medium text-slate-800">{t.descricao}</td>
                    <td className="p-3 text-slate-600">{t.categoria}</td>
                    <td className={`p-3 font-medium ${t.tipo === 'entrada' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {t.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                    </td>
                    <td className={`p-3 font-semibold tabular-nums ${t.tipo === 'entrada' ? 'text-emerald-700' : 'text-red-700'}`}>
                      {formatBRL(Number(t.valor))}
                    </td>
                    <td className="p-3 tabular-nums text-slate-700">
                      {formatBRL(serie.find((s) => s.id === t.id)?.saldo || 0)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {insightIA && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
          <h2 className="font-semibold text-blue-900 mb-2">Análise FactorOne</h2>
          <p className="text-slate-700 whitespace-pre-line text-sm">{insightIA}</p>
        </div>
      )}

      {modalAberto && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 space-y-3 shadow-xl">
            <h3 className="font-bold text-slate-800">Nova transação</h3>
            <input
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              placeholder="Descrição"
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            />
            <select
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-slate-800"
              value={form.categoria}
              onChange={(e) => setForm({ ...form, categoria: e.target.value })}
            >
              <option value="operacional">Operacional</option>
              <option value="impostos">Impostos</option>
              <option value="custo">Custo</option>
              <option value="receita_extra">Receita extra</option>
              <option value="despesa_operacional">Despesa operacional</option>
            </select>
            <select
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-slate-800"
              value={form.tipo}
              onChange={(e) => setForm({ ...form, tipo: e.target.value as 'entrada' | 'saida' })}
            >
              <option value="entrada">Entrada</option>
              <option value="saida">Saída</option>
            </select>
            <input
              type="number"
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-slate-800"
              placeholder="Valor"
              value={form.valor || ''}
              onChange={(e) => setForm({ ...form, valor: Number(e.target.value) })}
            />
            <input
              type="date"
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-slate-800"
              value={form.data}
              onChange={(e) => setForm({ ...form, data: e.target.value })}
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => setModalAberto(false)}
              >
                Cancelar
              </button>
              <button
                className="rounded-xl bg-blue-700 px-4 py-2.5 font-semibold text-white hover:bg-blue-800"
                onClick={() => void criarTransacao()}
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function KPICard({ titulo, valor, icon, cor }: { titulo: string; valor: string; icon: React.ReactNode; cor: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`flex items-center gap-2 text-sm mb-2 ${cor}`}>
        {icon}
        <span className="text-slate-500">{titulo}</span>
      </div>
      <p className="text-xl font-bold text-slate-800">{valor}</p>
    </div>
  )
}
