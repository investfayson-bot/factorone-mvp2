'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import toast from 'react-hot-toast'

type Transacao = {
  id: string
  data: string
  descricao: string
  categoria: string
  tipo: 'entrada' | 'saida'
  valor: number
}

type DiaPrevisao = { data: string; saldo: number; saida: number; entrada: number }
type PrevisaoData = {
  saldoAtual: number; d7: number; d30: number; d90: number
  dias: DiaPrevisao[]; avgBurnDaily: number; avgReceiveDaily: number
}
type SimItem = {
  id: string; descricao: string; tipo: 'entrada' | 'saida'
  valor: number; frequencia: 'unica' | 'mensal'; diaInicio: number
}

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
const fmtCompact = (v: number) => {
  if (Math.abs(v) >= 1_000_000) return `R$${(v / 1_000_000).toFixed(1)}M`
  if (Math.abs(v) >= 1_000) return `R$${(v / 1_000).toFixed(0)}k`
  return fmt(v)
}

const CATEGORIAS_FORM = ['operacional', 'impostos', 'custo', 'receita_extra', 'financeira', 'depreciacao']
const TABS = ['Histórico', 'Previsão 90d', 'Simulador E se?']

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
  const [activeTab, setActiveTab] = useState(0)
  const [previsao, setPrevisao] = useState<PrevisaoData | null>(null)
  const [loadingPrevisao, setLoadingPrevisao] = useState(false)
  const [simItems, setSimItems] = useState<SimItem[]>([])
  const [simForm, setSimForm] = useState({
    descricao: '', tipo: 'entrada' as 'entrada' | 'saida',
    valor: '', frequencia: 'mensal' as 'unica' | 'mensal', diaInicio: 30,
  })
  const [form, setForm] = useState({
    descricao: '', categoria: 'operacional',
    tipo: 'saida' as 'entrada' | 'saida',
    valor: '', data: new Date().toISOString().slice(0, 10),
  })

  const carregar = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const empresa = (u?.empresa_id as string) || user.id
    setEmpresaId(empresa)
    const dt = new Date(); dt.setDate(dt.getDate() - Number(filtroPeriodo))
    const { data, error } = await supabase.from('transacoes').select('*').eq('empresa_id', empresa).gte('data', dt.toISOString().slice(0, 10)).order('data', { ascending: true })
    if (error) toast.error('Erro ao carregar: ' + error.message)
    setTransacoes((data as Transacao[]) || [])
    setLoading(false)
  }, [filtroPeriodo])

  const carregarPrevisao = useCallback(async () => {
    setLoadingPrevisao(true)
    try {
      const { data: sess } = await supabase.auth.getSession()
      const res = await fetch('/api/cashflow/previsao', {
        headers: sess.session?.access_token ? { Authorization: `Bearer ${sess.session.access_token}` } : {},
      })
      if (res.ok) setPrevisao(await res.json() as PrevisaoData)
      else toast.error('Erro ao carregar previsão')
    } catch { toast.error('Falha na previsão') }
    setLoadingPrevisao(false)
  }, [])

  useEffect(() => { void carregar() }, [carregar])
  useEffect(() => {
    if (activeTab === 1 || activeTab === 2) void carregarPrevisao()
  }, [activeTab, carregarPrevisao])

  async function criarTransacao() {
    if (!form.descricao.trim()) { toast.error('Preencha a descrição'); return }
    const valor = Number(String(form.valor).replace(',', '.'))
    if (!valor || valor <= 0) { toast.error('Valor inválido'); return }
    const { error } = await supabase.from('transacoes').insert({
      empresa_id: empresaId, data: form.data,
      descricao: form.descricao.trim(), categoria: form.categoria,
      tipo: form.tipo, valor, status: 'confirmada',
    })
    if (error) { toast.error(error.message); return }
    toast.success('Transação registrada')
    setModalAberto(false)
    setForm({ descricao: '', categoria: 'operacional', tipo: 'saida', valor: '', data: new Date().toISOString().slice(0, 10) })
    void carregar()
  }

  async function analisarIA() {
    setLoadingIA(true); setInsightIA('')
    try {
      const { data: sess } = await supabase.auth.getSession()
      const res = await fetch('/api/aicfo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(sess.session?.access_token ? { Authorization: `Bearer ${sess.session.access_token}` } : {}) },
        body: JSON.stringify({ message: 'Analise meu fluxo de caixa e traga riscos e ações para os próximos 30 dias.', context: JSON.stringify({ transacoes }) }),
      })
      const out = await res.json() as { response?: string; error?: string }
      setInsightIA(out.response || out.error || 'Sem resposta')
    } catch { toast.error('Falha na análise de IA') }
    finally { setLoadingIA(false) }
  }

  function addSimItem() {
    const valor = Number(String(simForm.valor).replace(',', '.'))
    if (!simForm.descricao.trim() || !valor || valor <= 0) { toast.error('Preencha descrição e valor'); return }
    setSimItems(prev => [...prev, { ...simForm, valor, id: Date.now().toString() }])
    setSimForm({ descricao: '', tipo: 'entrada', valor: '', frequencia: 'mensal', diaInicio: 30 })
  }

  const categorias = useMemo(() => ['todas', ...Array.from(new Set(transacoes.map(t => t.categoria || 'sem_categoria')))], [transacoes])
  const filtradas = useMemo(() => transacoes.filter(t => (filtroTipo === 'todos' || t.tipo === filtroTipo) && (filtroCategoria === 'todas' || t.categoria === filtroCategoria)), [transacoes, filtroTipo, filtroCategoria])

  const serie = transacoes.map((t, i) => {
    const saldo = transacoes.slice(0, i + 1).reduce((s, x) => s + (x.tipo === 'entrada' ? Number(x.valor) : -Number(x.valor)), 0)
    return { ...t, saldo, projecao: null as number | null }
  })

  const saldoAcumulado = serie.length ? serie[serie.length - 1].saldo : 0
  const mediaDiaria = transacoes.length ? transacoes.reduce((s, t) => s + (t.tipo === 'entrada' ? Number(t.valor) : -Number(t.valor)), 0) / Math.max(Number(filtroPeriodo), 1) : 0
  const projecao30 = saldoAcumulado + mediaDiaria * 30
  const serieComProjecao = [...serie, { data: 'Proj. 30d', descricao: 'Projeção', categoria: 'projecao', tipo: 'entrada' as const, valor: 0, id: 'proj', saldo: saldoAcumulado, projecao: projecao30 }]

  const entradasPeriodo = transacoes.filter(t => t.tipo === 'entrada').reduce((s, t) => s + Number(t.valor), 0)
  const saidasPeriodo = transacoes.filter(t => t.tipo === 'saida').reduce((s, t) => s + Number(t.valor), 0)
  const saldoAtual = entradasPeriodo - saidasPeriodo

  // Previsão data formatted for chart (show every 7 days)
  const diasChart = useMemo(() => {
    if (!previsao) return []
    return previsao.dias.filter((_, i) => i === 0 || (i + 1) % 7 === 0 || i === 89)
      .map(d => ({
        ...d,
        label: new Date(d.data + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      }))
  }, [previsao])

  // Simulated projection (cumulative delta applied to original saldo)
  const diasSimulados = useMemo(() => {
    if (!previsao) return []
    let deltaCumul = 0
    return previsao.dias.map((d, i) => {
      let extraEntrada = 0, extraSaida = 0
      for (const item of simItems) {
        if (item.frequencia === 'mensal') {
          if (i > 0 && i % 30 === item.diaInicio % 30) {
            if (item.tipo === 'entrada') extraEntrada += item.valor
            else extraSaida += item.valor
          }
        } else {
          if (i + 1 === item.diaInicio) {
            if (item.tipo === 'entrada') extraEntrada += item.valor
            else extraSaida += item.valor
          }
        }
      }
      deltaCumul += extraEntrada - extraSaida
      return {
        ...d,
        saldo_sim: Math.round((d.saldo + deltaCumul) * 100) / 100,
        label: new Date(d.data + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      }
    }).filter((_, i) => i === 0 || (i + 1) % 7 === 0 || i === 89)
  }, [previsao, simItems])

  const simD30 = diasSimulados.find((_, i) => i === 4)?.saldo_sim ?? previsao?.d30
  const simD90 = diasSimulados[diasSimulados.length - 1]?.saldo_sim ?? previsao?.d90

  return (
    <>
      {/* Header */}
      <div className="page-hdr">
        <div>
          <div className="page-title">Fluxo de Caixa</div>
          <div className="page-sub">Últimos {{ '30': '30 dias', '90': '90 dias', '365': '12 meses' }[filtroPeriodo]} · dados reais</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-action btn-ghost" onClick={() => void analisarIA()} disabled={loadingIA || loading}>
            {loadingIA ? 'Analisando…' : 'Analisar com IA'}
          </button>
          <button className="btn-action" onClick={() => setModalAberto(true)}>+ Nova transação</button>
        </div>
      </div>

      {/* Alerta */}
      {projecao30 < 5000 && transacoes.length > 0 && (
        <div className="alert-bar orange" style={{ marginBottom: 14 }}>
          ⚠ Projeção de caixa para os próximos 30 dias está abaixo de R$ 5.000.
        </div>
      )}

      {/* KPIs */}
      <div className="kpis">
        <div className="kpi">
          <div className="kpi-lbl">Saldo do período</div>
          <div className="kpi-val" style={{ color: saldoAtual >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmtCompact(saldoAtual)}</div>
          <div className={`kpi-delta ${saldoAtual >= 0 ? 'up' : 'dn'}`}>{saldoAtual >= 0 ? '↑ positivo' : '↓ negativo'}</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Entradas</div>
          <div className="kpi-val" style={{ color: 'var(--green)' }}>{fmtCompact(entradasPeriodo)}</div>
          <div className="kpi-delta up">{transacoes.filter(t => t.tipo === 'entrada').length} lançamentos</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Saídas</div>
          <div className="kpi-val" style={{ color: 'var(--red)' }}>{fmtCompact(saidasPeriodo)}</div>
          <div className="kpi-delta dn">{transacoes.filter(t => t.tipo === 'saida').length} lançamentos</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Projeção 30 dias</div>
          <div className="kpi-val" style={{ color: projecao30 >= 0 ? 'var(--navy)' : 'var(--red)' }}>{fmtCompact(projecao30)}</div>
          <div className={`kpi-delta ${projecao30 >= 0 ? 'up' : 'dn'}`}>{projecao30 >= 0 ? '↑ tendência positiva' : '↓ atenção'}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: 'var(--gray-100)', borderRadius: 10, padding: 4 }}>
        {TABS.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(i)}
            style={{
              flex: 1, padding: '7px 12px', fontSize: 12, fontWeight: 700, borderRadius: 7,
              border: 'none', cursor: 'pointer', fontFamily: "'Sora',sans-serif",
              background: activeTab === i ? '#fff' : 'transparent',
              color: activeTab === i ? 'var(--navy)' : 'var(--gray-400)',
              boxShadow: activeTab === i ? '0 1px 4px rgba(0,0,0,.08)' : 'none',
              transition: 'all .15s',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* TAB 0: Histórico */}
      {activeTab === 0 && (
        <>
          {/* Gráfico histórico */}
          <div className="cf-chart-card">
            <div className="chart-title">Evolução do saldo acumulado</div>
            <div className="cf-legend">
              <div className="cf-leg-item"><div className="cf-leg-dot" style={{ background: 'var(--teal)' }} /> Saldo real</div>
              <div className="cf-leg-item"><div className="cf-leg-dot" style={{ background: 'var(--gold)', opacity: .6 }} /> Projeção</div>
            </div>
            {loading ? (
              <div style={{ height: 240, background: 'var(--gray-100)', borderRadius: 8, animation: 'pulse 1.5s infinite' }} />
            ) : transacoes.length === 0 ? (
              <div style={{ height: 240, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--gray-400)' }}>
                <div style={{ fontSize: 32 }}>💸</div>
                <div style={{ fontSize: 13 }}>Nenhuma transação registrada.</div>
                <button className="btn-action" onClick={() => setModalAberto(true)}>+ Registrar primeira transação</button>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={serieComProjecao}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
                  <XAxis dataKey="data" tick={{ fill: 'var(--gray-400)', fontSize: 10 }} tickFormatter={(v: string) => v === 'Proj. 30d' ? 'Proj.' : new Date(v + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} />
                  <YAxis tick={{ fill: 'var(--gray-400)', fontSize: 10 }} tickFormatter={(v: number) => v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`} />
                  <Tooltip formatter={(value: number) => [fmt(value), '']} labelFormatter={(l: string) => l === 'Proj. 30d' ? 'Projeção 30 dias' : l} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--gray-100)' }} />
                  <Area type="monotone" dataKey="saldo" stroke="var(--teal)" fill="rgba(94,140,135,.12)" name="Saldo" />
                  <Area type="monotone" dataKey="projecao" stroke="var(--gold)" fill="transparent" strokeDasharray="6 3" name="Projeção" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Filtros + tabela */}
          <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--gray-100)', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--gray-400)', letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: "'DM Mono',monospace", flex: 1 }}>
                Lançamentos ({filtradas.length})
              </div>
              <select className="form-input" style={{ width: 'auto', padding: '5px 10px', fontSize: 11 }} value={filtroPeriodo} onChange={e => setFiltroPeriodo(e.target.value as '30' | '90' | '365')}>
                <option value="30">30 dias</option>
                <option value="90">90 dias</option>
                <option value="365">12 meses</option>
              </select>
              <select className="form-input" style={{ width: 'auto', padding: '5px 10px', fontSize: 11 }} value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}>
                {categorias.map(c => <option key={c} value={c}>{c === 'todas' ? 'Todas categorias' : c}</option>)}
              </select>
              <select className="form-input" style={{ width: 'auto', padding: '5px 10px', fontSize: 11 }} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value as 'todos' | 'entrada' | 'saida')}>
                <option value="todos">Todos</option>
                <option value="entrada">Entradas</option>
                <option value="saida">Saídas</option>
              </select>
            </div>
            <div className="expenses-table">
              <table>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Descrição</th>
                    <th>Categoria</th>
                    <th>Tipo</th>
                    <th style={{ textAlign: 'right' }}>Valor</th>
                    <th style={{ textAlign: 'right' }}>Saldo acumulado</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>{Array.from({ length: 6 }).map((__, j) => <td key={j}><div style={{ height: 12, background: 'var(--gray-100)', borderRadius: 4, animation: 'pulse 1.5s infinite' }} /></td>)}</tr>
                    ))
                  ) : filtradas.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '32px 0' }}>
                      {transacoes.length === 0 ? 'Nenhuma transação. Clique em "+ Nova transação" para começar.' : 'Nenhuma transação com os filtros atuais.'}
                    </td></tr>
                  ) : filtradas.map(t => {
                    const saldoRow = serie.find(s => s.id === t.id)?.saldo ?? 0
                    return (
                      <tr key={t.id}>
                        <td>{new Date(t.data + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                        <td style={{ fontWeight: 600 }}>{t.descricao}</td>
                        <td style={{ color: 'var(--gray-500)' }}>{t.categoria || '—'}</td>
                        <td><span className={`tag ${t.tipo === 'entrada' ? 'green' : 'red'}`}>{t.tipo === 'entrada' ? 'Entrada' : 'Saída'}</span></td>
                        <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: "'DM Mono',monospace", color: t.tipo === 'entrada' ? 'var(--green)' : 'var(--red)' }}>
                          {t.tipo === 'entrada' ? '+' : '-'}{fmt(Number(t.valor))}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: "'DM Mono',monospace", color: 'var(--navy)' }}>{fmt(saldoRow)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Insight IA */}
          {insightIA && (
            <div style={{ background: 'rgba(94,140,135,.06)', border: '1px solid rgba(94,140,135,.2)', borderRadius: 12, padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--teal2)', letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: "'DM Mono',monospace" }}>FactorOne IA — Análise de Fluxo</div>
                <button onClick={() => setInsightIA('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)', fontSize: 16, lineHeight: 1 }}>×</button>
              </div>
              <p style={{ fontSize: 13, color: 'var(--navy)', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{insightIA}</p>
            </div>
          )}
        </>
      )}

      {/* TAB 1: Previsão 90d */}
      {activeTab === 1 && (
        <>
          {/* KPIs previsão */}
          <div className="kpis" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            <div className="kpi">
              <div className="kpi-lbl">Saldo atual (banco)</div>
              <div className="kpi-val">{previsao ? fmtCompact(previsao.saldoAtual) : '—'}</div>
              <div className="kpi-delta up">contas bancárias</div>
            </div>
            <div className="kpi">
              <div className="kpi-lbl">Previsão 7 dias</div>
              <div className="kpi-val" style={{ color: previsao && previsao.d7 < 0 ? 'var(--red)' : 'var(--navy)' }}>{previsao ? fmtCompact(previsao.d7) : '—'}</div>
              <div className={`kpi-delta ${previsao && previsao.d7 < 0 ? 'dn' : 'up'}`}>{previsao && previsao.d7 < 0 ? '↓ atenção' : '↑ ok'}</div>
            </div>
            <div className="kpi">
              <div className="kpi-lbl">Previsão 30 dias</div>
              <div className="kpi-val" style={{ color: previsao && previsao.d30 < 0 ? 'var(--red)' : 'var(--navy)' }}>{previsao ? fmtCompact(previsao.d30) : '—'}</div>
              <div className={`kpi-delta ${previsao && previsao.d30 < 0 ? 'dn' : 'up'}`}>{previsao && previsao.d30 < 0 ? '↓ risco' : '↑ ok'}</div>
            </div>
            <div className="kpi">
              <div className="kpi-lbl">Previsão 90 dias</div>
              <div className="kpi-val" style={{ color: previsao && previsao.d90 < 0 ? 'var(--red)' : 'var(--teal)' }}>{previsao ? fmtCompact(previsao.d90) : '—'}</div>
              <div className={`kpi-delta ${previsao && previsao.d90 < 0 ? 'dn' : 'up'}`}>{previsao && previsao.d90 < 0 ? '↓ crítico' : '↑ positivo'}</div>
            </div>
          </div>

          {/* Gráfico 90d */}
          <div className="cf-chart-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div className="chart-title" style={{ margin: 0 }}>Projeção de saldo — próximos 90 dias</div>
              <div style={{ fontSize: 10, color: 'var(--gray-400)' }}>
                Burn diário médio: {previsao ? fmtCompact(previsao.avgBurnDaily) : '—'} ·
                Receita diária média: {previsao ? fmtCompact(previsao.avgReceiveDaily) : '—'}
              </div>
            </div>
            {loadingPrevisao ? (
              <div style={{ height: 280, background: 'var(--gray-100)', borderRadius: 8, animation: 'pulse 1.5s infinite' }} />
            ) : diasChart.length === 0 ? (
              <div style={{ height: 280, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--gray-400)' }}>
                <div style={{ fontSize: 28 }}>📊</div>
                <div style={{ fontSize: 13 }}>Sem dados suficientes para projeção.</div>
                <div style={{ fontSize: 11 }}>Cadastre contas bancárias e transações históricas.</div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={diasChart}>
                  <defs>
                    <linearGradient id="gradPos" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--teal)" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="var(--teal)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradNeg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--red)" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="var(--red)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
                  <XAxis dataKey="label" tick={{ fill: 'var(--gray-400)', fontSize: 10 }} />
                  <YAxis tick={{ fill: 'var(--gray-400)', fontSize: 10 }} tickFormatter={(v: number) => v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`} />
                  <Tooltip
                    formatter={(value: number) => [fmt(value), 'Saldo previsto']}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--gray-100)' }}
                  />
                  <ReferenceLine y={0} stroke="var(--red)" strokeDasharray="4 2" strokeWidth={1.5} label={{ value: 'Zero', fill: 'var(--red)', fontSize: 10 }} />
                  <Area
                    type="monotone" dataKey="saldo" stroke="var(--teal)"
                    fill="url(#gradPos)" name="Saldo previsto"
                    dot={(props) => {
                      const { cx, cy, payload } = props as { cx: number; cy: number; payload: { saldo: number } }
                      return payload.saldo < 0
                        ? <circle key={`dot-${cx}`} cx={cx} cy={cy} r={3} fill="var(--red)" />
                        : <circle key={`dot-${cx}`} cx={cx} cy={cy} r={2} fill="var(--teal)" />
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Aviso */}
          {previsao && previsao.d30 < 0 && (
            <div className="alert-bar orange">
              ⚠ Previsão indica saldo negativo em 30 dias. Antecipe recebíveis ou reduza despesas.
            </div>
          )}
          {previsao && previsao.d7 < 0 && (
            <div className="alert-bar" style={{ background: 'rgba(192,80,74,.08)', border: '1px solid rgba(192,80,74,.25)', color: 'var(--red)', borderRadius: 10, padding: '10px 14px', fontSize: 12, fontWeight: 600 }}>
              🚨 Saldo negativo projetado em 7 dias. Ação imediata recomendada.
            </div>
          )}

          {/* Metodologia */}
          <div style={{ background: 'rgba(94,140,135,.04)', border: '1px solid rgba(94,140,135,.12)', borderRadius: 10, padding: '12px 16px', fontSize: 11, color: 'var(--gray-400)', lineHeight: 1.7 }}>
            <strong style={{ color: 'var(--navy)' }}>Como é calculado:</strong> Saldo atual das contas bancárias + contas a receber com vencimento nos próximos 90 dias − contas a pagar nos próximos 90 dias + média diária histórica de entradas e saídas dos últimos 90 dias.
          </div>
        </>
      )}

      {/* TAB 2: Simulador E se? */}
      {activeTab === 2 && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
            {/* Painel esquerdo: adicionar cenários */}
            <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--gray-100)', fontSize: 11, fontWeight: 700, color: 'var(--navy)', letterSpacing: '.04em', textTransform: 'uppercase', fontFamily: "'DM Mono',monospace" }}>
                Adicionar cenário hipotético
              </div>
              <div style={{ padding: '14px' }}>
                <div className="form-group">
                  <label className="form-label">Descrição *</label>
                  <input className="form-input" placeholder="Ex: Novo contrato cliente, Aluguel escritório" value={simForm.descricao} onChange={e => setSimForm(f => ({ ...f, descricao: e.target.value }))} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Tipo</label>
                    <select className="form-input" value={simForm.tipo} onChange={e => setSimForm(f => ({ ...f, tipo: e.target.value as 'entrada' | 'saida' }))}>
                      <option value="entrada">Entrada (+)</option>
                      <option value="saida">Saída (−)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Frequência</label>
                    <select className="form-input" value={simForm.frequencia} onChange={e => setSimForm(f => ({ ...f, frequencia: e.target.value as 'unica' | 'mensal' }))}>
                      <option value="mensal">Mensal</option>
                      <option value="unica">Única vez</option>
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Valor (R$) *</label>
                    <input className="form-input" placeholder="0,00" value={simForm.valor} onChange={e => setSimForm(f => ({ ...f, valor: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">A partir do dia</label>
                    <select className="form-input" value={simForm.diaInicio} onChange={e => setSimForm(f => ({ ...f, diaInicio: Number(e.target.value) }))}>
                      {[1, 7, 14, 30, 45, 60, 90].map(d => <option key={d} value={d}>Dia {d}</option>)}
                    </select>
                  </div>
                </div>
                <button className="btn-action" style={{ width: '100%' }} onClick={addSimItem}>
                  + Adicionar ao cenário
                </button>
              </div>

              {/* Lista de itens adicionados */}
              {simItems.length > 0 && (
                <div style={{ borderTop: '1px solid var(--gray-100)' }}>
                  <div style={{ padding: '8px 14px', fontSize: 10, fontWeight: 700, color: 'var(--gray-400)', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                    Itens no cenário ({simItems.length})
                  </div>
                  {simItems.map(item => (
                    <div key={item.id} style={{ padding: '8px 14px', borderTop: '1px solid var(--gray-100)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className={`tag ${item.tipo === 'entrada' ? 'green' : 'red'}`} style={{ fontSize: 9 }}>{item.tipo === 'entrada' ? '+' : '−'}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--navy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.descricao}</div>
                        <div style={{ fontSize: 10, color: 'var(--gray-400)' }}>{fmt(item.valor)} · {item.frequencia === 'mensal' ? 'mensal' : `único no dia ${item.diaInicio}`}</div>
                      </div>
                      <button onClick={() => setSimItems(prev => prev.filter(i => i.id !== item.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)', fontSize: 16, lineHeight: 1, padding: '0 4px' }}>×</button>
                    </div>
                  ))}
                  <div style={{ padding: '8px 14px', borderTop: '1px solid var(--gray-100)' }}>
                    <button className="btn-ghost" style={{ fontSize: 11, width: '100%' }} onClick={() => setSimItems([])}>Limpar cenário</button>
                  </div>
                </div>
              )}
            </div>

            {/* Painel direito: resultado do cenário */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* KPIs do cenário */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { lbl: 'Saldo base 30d', base: previsao?.d30, sim: simD30 },
                  { lbl: 'Saldo base 90d', base: previsao?.d90, sim: simD90 },
                ].map(({ lbl, base, sim }) => {
                  const delta = sim != null && base != null ? sim - base : 0
                  return (
                    <div key={lbl} className="kpi" style={{ margin: 0 }}>
                      <div className="kpi-lbl">{lbl}</div>
                      <div className="kpi-val" style={{ color: (sim ?? 0) >= 0 ? 'var(--navy)' : 'var(--red)' }}>{sim != null ? fmtCompact(sim) : '—'}</div>
                      {simItems.length > 0 && delta !== 0 && (
                        <div className={`kpi-delta ${delta >= 0 ? 'up' : 'dn'}`}>
                          {delta >= 0 ? '↑ +' : '↓ '}{fmtCompact(Math.abs(delta))} vs base
                        </div>
                      )}
                      {simItems.length === 0 && <div className="kpi-delta">cenário base</div>}
                    </div>
                  )
                })}
              </div>

              {/* Gráfico simulador */}
              <div className="cf-chart-card" style={{ margin: 0 }}>
                <div className="chart-title">
                  Impacto do cenário — 90 dias
                  {simItems.length === 0 && <span style={{ fontWeight: 400, color: 'var(--gray-400)', fontSize: 11 }}> (adicione itens para ver o impacto)</span>}
                </div>
                {loadingPrevisao ? (
                  <div style={{ height: 220, background: 'var(--gray-100)', borderRadius: 8, animation: 'pulse 1.5s infinite' }} />
                ) : diasSimulados.length === 0 ? (
                  <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gray-400)', fontSize: 13 }}>
                    Sem dados de previsão base
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={diasSimulados}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
                      <XAxis dataKey="label" tick={{ fill: 'var(--gray-400)', fontSize: 10 }} />
                      <YAxis tick={{ fill: 'var(--gray-400)', fontSize: 10 }} tickFormatter={(v: number) => v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`} />
                      <Tooltip
                        formatter={(value: number, name: string) => [fmt(value), name === 'saldo' ? 'Base' : 'Com cenário']}
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      />
                      <ReferenceLine y={0} stroke="var(--red)" strokeDasharray="4 2" strokeWidth={1} />
                      <Area type="monotone" dataKey="saldo" stroke="rgba(94,140,135,.4)" fill="rgba(94,140,135,.05)" strokeDasharray="5 3" name="saldo" />
                      {simItems.length > 0 && (
                        <Area type="monotone" dataKey="saldo_sim" stroke="var(--navy)" fill="rgba(30,58,95,.08)" name="saldo_sim" />
                      )}
                    </AreaChart>
                  </ResponsiveContainer>
                )}
                {simItems.length > 0 && (
                  <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11, color: 'var(--gray-400)' }}>
                    <div><span style={{ display: 'inline-block', width: 24, height: 2, background: 'rgba(94,140,135,.4)', verticalAlign: 'middle', marginRight: 6 }} />Base</div>
                    <div><span style={{ display: 'inline-block', width: 24, height: 2, background: 'var(--navy)', verticalAlign: 'middle', marginRight: 6 }} />Com cenário</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {simItems.length === 0 && (
            <div style={{ background: 'rgba(94,140,135,.04)', border: '1px solid rgba(94,140,135,.15)', borderRadius: 10, padding: '14px 16px', fontSize: 12, color: 'var(--gray-400)', lineHeight: 1.7, textAlign: 'center' }}>
              Adicione cenários hipotéticos (novo contrato, nova despesa, antecipação de recebíveis) e veja instantaneamente o impacto no saldo dos próximos 90 dias.
            </div>
          )}
        </>
      )}

      {/* Modal nova transação */}
      {modalAberto && (
        <div className="modal-bg" onClick={() => setModalAberto(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-title">
              Nova transação
              <button className="modal-close" onClick={() => setModalAberto(false)}>×</button>
            </div>
            <div className="form-group">
              <label className="form-label">Descrição *</label>
              <input className="form-input" placeholder="Ex: Pagamento cliente XYZ" value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Tipo *</label>
                <select className="form-input" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value as 'entrada' | 'saida' }))}>
                  <option value="entrada">Entrada</option>
                  <option value="saida">Saída</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Categoria</label>
                <select className="form-input" value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
                  {CATEGORIAS_FORM.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Valor (R$) *</label>
                <input className="form-input" type="text" inputMode="decimal" placeholder="0,00" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Data</label>
                <input className="form-input" type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-action btn-ghost" onClick={() => setModalAberto(false)}>Cancelar</button>
              <button className="btn-action" onClick={() => void criarTransacao()}>Registrar</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
