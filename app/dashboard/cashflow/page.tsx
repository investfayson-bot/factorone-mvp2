'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowDownCircle, ArrowUpCircle, Wallet, AlertTriangle, Plus } from 'lucide-react'

type Transacao = {
  id: string
  data: string
  descricao: string
  categoria: string
  tipo: 'entrada' | 'saida'
  valor: number
}

export default function CashflowPage() {
  const supabase = createClientComponentClient()
  const [transacoes, setTransacoes] = useState<Transacao[]>([])
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'entrada' | 'saida'>('todos')
  const [filtroCategoria, setFiltroCategoria] = useState('todas')
  const [filtroPeriodo, setFiltroPeriodo] = useState<'30' | '90' | '365'>('30')
  const [modalAberto, setModalAberto] = useState(false)
  const [loadingIA, setLoadingIA] = useState(false)
  const [insightIA, setInsightIA] = useState('')
  const [form, setForm] = useState({ descricao: '', categoria: 'operacional', tipo: 'saida', valor: 0, data: new Date().toISOString().slice(0, 10) })

  useEffect(() => {
    carregar()
  }, [filtroPeriodo])

  async function carregar() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const dt = new Date()
    dt.setDate(dt.getDate() - Number(filtroPeriodo))
    const { data } = await supabase
      .from('transacoes')
      .select('*')
      .eq('empresa_id', user.id)
      .gte('data', dt.toISOString())
      .order('data', { ascending: true })
    setTransacoes((data as Transacao[]) || [])
  }

  async function criarTransacao() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('transacoes').insert({
      empresa_id: user.id,
      data: form.data,
      descricao: form.descricao,
      categoria: form.categoria,
      tipo: form.tipo,
      valor: form.valor
    })
    setModalAberto(false)
    setForm({ descricao: '', categoria: 'operacional', tipo: 'saida', valor: 0, data: new Date().toISOString().slice(0, 10) })
    await carregar()
  }

  async function analisarIA() {
    setLoadingIA(true)
    const res = await fetch('/api/aicfo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Analise meu fluxo de caixa e traga riscos e ações para os próximos 30 dias.',
        context: JSON.stringify({ transacoes })
      })
    })
    const data = await res.json()
    setInsightIA(data.response || data.error || '')
    setLoadingIA(false)
  }

  const categorias = useMemo(() => ['todas', ...new Set(transacoes.map(t => t.categoria || 'sem_categoria'))], [transacoes])
  const filtradas = useMemo(
    () => transacoes.filter(t =>
      (filtroTipo === 'todos' || t.tipo === filtroTipo) &&
      (filtroCategoria === 'todas' || t.categoria === filtroCategoria)
    ),
    [transacoes, filtroTipo, filtroCategoria]
  )

  let saldoAcumulado = 0
  const serie = transacoes.map((t) => {
    saldoAcumulado += t.tipo === 'entrada' ? Number(t.valor) : -Number(t.valor)
    return { ...t, saldo: saldoAcumulado, projecao: null as number | null }
  })
  const mediaDiaria = transacoes.length
    ? transacoes.reduce((s, t) => s + (t.tipo === 'entrada' ? Number(t.valor) : -Number(t.valor)), 0) / transacoes.length
    : 0
  const projecao30 = saldoAcumulado + mediaDiaria * 30
  const serieComProjecao = [...serie, { data: 'Projeção 30d', descricao: 'Projeção', categoria: 'projecao', tipo: 'entrada', valor: 0, saldo: saldoAcumulado, projecao: projecao30 }]

  const entradasMes = transacoes.filter(t => t.tipo === 'entrada').reduce((s, t) => s + Number(t.valor), 0)
  const saidasMes = transacoes.filter(t => t.tipo === 'saida').reduce((s, t) => s + Number(t.valor), 0)
  const saldoAtual = entradasMes - saidasMes
  const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Fluxo de Caixa Inteligente</h1>
        <div className="flex gap-2">
          <button className="bg-[#0066FF] px-3 py-2 rounded-lg flex items-center gap-2" onClick={() => setModalAberto(true)}><Plus size={15} /> Nova transação</button>
          <button className="bg-[#111118] border border-[#2A2A35] px-3 py-2 rounded-lg" onClick={analisarIA} disabled={loadingIA}>
            {loadingIA ? 'Analisando...' : 'Analisar com IA'}
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-3">
        <Card titulo="Saldo atual" valor={fmt(saldoAtual)} icon={<Wallet size={16} />} />
        <Card titulo="Entradas mês" valor={fmt(entradasMes)} icon={<ArrowUpCircle size={16} />} />
        <Card titulo="Saídas mês" valor={fmt(saidasMes)} icon={<ArrowDownCircle size={16} />} />
        <Card titulo="Projeção 30 dias" valor={fmt(projecao30)} icon={<Wallet size={16} />} />
      </div>

      {projecao30 < 5000 && (
        <div className="bg-red-500/20 border border-red-500/40 rounded-xl p-4 flex items-center gap-2 text-red-200">
          <AlertTriangle size={16} /> Alerta: projeção abaixo de R$ 5.000 nos próximos 30 dias.
        </div>
      )}

      <div className="bg-[#111118] border border-[#1E1E2E] rounded-xl p-4">
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={serieComProjecao}>
            <CartesianGrid stroke="#1F1F2A" strokeDasharray="3 3" />
            <XAxis dataKey="data" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} />
            <Tooltip />
            <Area type="monotone" dataKey="saldo" stroke="#0066FF" fill="#0066FF33" />
            <Area type="monotone" dataKey="projecao" stroke="#F59E0B" fill="#00000000" strokeDasharray="6 6" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap gap-2">
        <select className="bg-[#111118] border border-[#2A2A35] rounded px-3 py-2" value={filtroPeriodo} onChange={(e) => setFiltroPeriodo(e.target.value as '30' | '90' | '365')}>
          <option value="30">Últimos 30 dias</option>
          <option value="90">Últimos 90 dias</option>
          <option value="365">Último ano</option>
        </select>
        <select className="bg-[#111118] border border-[#2A2A35] rounded px-3 py-2" value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)}>
          {categorias.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="bg-[#111118] border border-[#2A2A35] rounded px-3 py-2" value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value as 'todos' | 'entrada' | 'saida')}>
          <option value="todos">Todos</option>
          <option value="entrada">Entrada</option>
          <option value="saida">Saída</option>
        </select>
      </div>

      <div className="bg-[#111118] border border-[#1E1E2E] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#0F0F16] text-gray-400">
            <tr>
              <th className="text-left p-3">Data</th>
              <th className="text-left p-3">Descrição</th>
              <th className="text-left p-3">Categoria</th>
              <th className="text-left p-3">Tipo</th>
              <th className="text-left p-3">Valor</th>
              <th className="text-left p-3">Saldo acumulado</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map((t) => (
              <tr key={t.id} className="border-t border-[#1E1E2E]">
                <td className="p-3">{new Date(t.data).toLocaleDateString('pt-BR')}</td>
                <td className="p-3">{t.descricao}</td>
                <td className="p-3">{t.categoria}</td>
                <td className={`p-3 ${t.tipo === 'entrada' ? 'text-green-400' : 'text-red-400'}`}>{t.tipo}</td>
                <td className="p-3">{fmt(Number(t.valor))}</td>
                <td className="p-3">{fmt(serie.find(s => s.id === t.id)?.saldo || 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {insightIA && (
        <div className="bg-[#111118] border border-[#0066FF]/40 rounded-xl p-4">
          <h2 className="font-semibold mb-2">Insights de fluxo</h2>
          <p className="text-gray-300 whitespace-pre-line">{insightIA}</p>
        </div>
      )}

      {modalAberto && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="w-full max-w-md bg-[#111118] border border-[#2A2A35] rounded-xl p-4 space-y-3">
            <h3 className="font-semibold">Nova transação</h3>
            <input className="w-full bg-[#0A0A0F] border border-[#2A2A35] rounded p-2" placeholder="Descrição" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
            <input className="w-full bg-[#0A0A0F] border border-[#2A2A35] rounded p-2" placeholder="Categoria" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} />
            <select className="w-full bg-[#0A0A0F] border border-[#2A2A35] rounded p-2" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as 'entrada' | 'saida' })}>
              <option value="entrada">Entrada</option>
              <option value="saida">Saída</option>
            </select>
            <input type="number" className="w-full bg-[#0A0A0F] border border-[#2A2A35] rounded p-2" value={form.valor} onChange={(e) => setForm({ ...form, valor: Number(e.target.value) })} />
            <input type="date" className="w-full bg-[#0A0A0F] border border-[#2A2A35] rounded p-2" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
            <div className="flex justify-end gap-2">
              <button className="px-3 py-2 rounded bg-[#2A2A35]" onClick={() => setModalAberto(false)}>Cancelar</button>
              <button className="px-3 py-2 rounded bg-[#0066FF]" onClick={criarTransacao}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Card({ titulo, valor, icon }: { titulo: string; valor: string; icon: React.ReactNode }) {
  return (
    <div className="bg-[#111118] border border-[#1E1E2E] rounded-xl p-4">
      <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">{icon}{titulo}</div>
      <p className="text-xl font-semibold">{valor}</p>
    </div>
  )
}
