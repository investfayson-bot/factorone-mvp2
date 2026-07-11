'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import toast from 'react-hot-toast'
import Modal from '@/components/ui/Modal'

type Transacao = { id: string; data: string; descricao: string; categoria: string; tipo: 'entrada' | 'saida'; valor: number }
type DiaPrevisao = { data: string; saldo: number; saida: number; entrada: number }
type PrevisaoData = { saldoAtual: number; d7: number; d30: number; d90: number; dias: DiaPrevisao[]; avgBurnDaily: number; avgReceiveDaily: number }
type SimItem = { id: string; descricao: string; tipo: 'entrada' | 'saida'; valor: number; frequencia: 'unica' | 'mensal'; diaInicio: number }

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
const fmtCompact = (v: number) => {
  if (Math.abs(v) >= 1_000_000) return `R$${(v / 1_000_000).toFixed(1)}M`
  if (Math.abs(v) >= 1_000) return `R$${(v / 1_000).toFixed(0)}k`
  return fmt(v)
}

const CATEGORIAS_FORM = ['operacional', 'impostos', 'custo', 'receita_extra', 'financeira']
const PERIODOS = [
  { key: '7', label: '7 dias' },
  { key: '30', label: '30 dias' },
  { key: '90', label: '90 dias' },
] as const

export default function FluxoDeCaixaPage() {
  const [empresaId, setEmpresaId] = useState('')
  const [transacoes, setTransacoes] = useState<Transacao[]>([])
  const [filtroPeriodo, setFiltroPeriodo] = useState<'7' | '30' | '90'>('30')
  const [loading, setLoading] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [loadingIA, setLoadingIA] = useState(false)
  const [insightIA, setInsightIA] = useState('')
  const [previsao, setPrevisao] = useState<PrevisaoData | null>(null)
  const [loadingPrevisao, setLoadingPrevisao] = useState(false)
  const [simItems, setSimItems] = useState<SimItem[]>([])
  const [simForm, setSimForm] = useState({ descricao: '', tipo: 'entrada' as 'entrada' | 'saida', valor: '', frequencia: 'mensal' as 'unica' | 'mensal', diaInicio: 30 })
  const [form, setForm] = useState({ descricao: '', categoria: 'operacional', tipo: 'saida' as 'entrada' | 'saida', valor: '', data: new Date().toISOString().slice(0, 10) })

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
      const res = await fetch('/api/cashflow/previsao', { headers: sess.session?.access_token ? { Authorization: `Bearer ${sess.session.access_token}` } : {} })
      if (res.ok) setPrevisao(await res.json() as PrevisaoData)
      else toast.error('Erro ao carregar previsão')
    } catch { toast.error('Falha na previsão') }
    setLoadingPrevisao(false)
  }, [])

  useEffect(() => { void carregar() }, [carregar])
  useEffect(() => { void carregarPrevisao() }, [carregarPrevisao])

  async function criarTransacao() {
    if (!form.descricao.trim()) { toast.error('Preencha a descrição'); return }
    const valor = Number(String(form.valor).replace(',', '.'))
    if (!valor || valor <= 0) { toast.error('Valor inválido'); return }
    const { error } = await supabase.from('transacoes').insert({ empresa_id: empresaId, data: form.data, descricao: form.descricao.trim(), categoria: form.categoria, tipo: form.tipo, valor, status: 'confirmada' })
    if (error) { toast.error(error.message); return }
    toast.success('Transação registrada')
    setModalAberto(false)
    setForm({ descricao: '', categoria: 'operacional', tipo: 'saida', valor: '', data: new Date().toISOString().slice(0, 10) })
    void carregar()
    void carregarPrevisao()
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

  const diasLimite = Number(filtroPeriodo)
  const diasVisiveis = useMemo(() => previsao ? previsao.dias.slice(0, diasLimite) : [], [previsao, diasLimite])
  const diasChart = useMemo(() => diasVisiveis
    .filter((_, i, arr) => arr.length <= 14 || i === 0 || (i + 1) % Math.ceil(arr.length / 14) === 0 || i === arr.length - 1)
    .map(d => ({ ...d, label: new Date(d.data + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) })),
  [diasVisiveis])

  const diasSimulados = useMemo(() => {
    if (!previsao) return []
    let deltaCumul = 0
    return previsao.dias.map((d, i) => {
      let extraEntrada = 0, extraSaida = 0
      for (const item of simItems) {
        if (item.frequencia === 'mensal') {
          if (i > 0 && i % 30 === item.diaInicio % 30) { if (item.tipo === 'entrada') extraEntrada += item.valor; else extraSaida += item.valor }
        } else if (i + 1 === item.diaInicio) { if (item.tipo === 'entrada') extraEntrada += item.valor; else extraSaida += item.valor }
      }
      deltaCumul += extraEntrada - extraSaida
      return { ...d, saldo_sim: Math.round((d.saldo + deltaCumul) * 100) / 100, label: new Date(d.data + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) }
    }).filter((_, i) => i === 0 || (i + 1) % 7 === 0 || i === 89)
  }, [previsao, simItems])

  const simD30 = diasSimulados.find((_, i) => i === 4)?.saldo_sim ?? previsao?.d30
  const simD90 = diasSimulados[diasSimulados.length - 1]?.saldo_sim ?? previsao?.d90

  const entradasPeriodo = transacoes.filter(t => t.tipo === 'entrada').reduce((s, t) => s + Number(t.valor), 0)
  const saidasPeriodo = transacoes.filter(t => t.tipo === 'saida').reduce((s, t) => s + Number(t.valor), 0)
  const saldoAtual = entradasPeriodo - saidasPeriodo

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div className="pill-sel-v2">
          {PERIODOS.map(p => (
            <span key={p.key} className={filtroPeriodo === p.key ? 'on' : ''} onClick={() => setFiltroPeriodo(p.key)}>{p.label}</span>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn-v2" onClick={() => void analisarIA()} disabled={loadingIA || loading}>{loadingIA ? 'Analisando…' : 'Analisar com IA'}</button>
        <button className="btn-v2 primary" onClick={() => setModalAberto(true)}>+ Nova transação</button>
      </div>

      {previsao && (previsao.d7 < 0 || previsao.d30 < 0) && (
        <div style={{ background: 'var(--neg-soft)', border: '1px solid rgba(222,75,75,.3)', borderRadius: 10, padding: '10px 14px', fontSize: 12.5, fontWeight: 700, color: 'var(--neg)' }}>
          ⚠ Seu caixa fica negativo na projeção — {previsao.d7 < 0 ? 'já em 7 dias' : 'entre 8 e 30 dias'}.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        <div className={`kpi-v2${saldoAtual < 0 ? ' neg' : ''}`}><div className="l">Saldo do período</div><div className="v">{fmtCompact(saldoAtual)}</div></div>
        <div className="kpi-v2"><div className="l">Entradas</div><div className="v">{fmtCompact(entradasPeriodo)}</div></div>
        <div className="kpi-v2 neg"><div className="l">Saídas</div><div className="v">{fmtCompact(saidasPeriodo)}</div></div>
        <div className={`kpi-v2${previsao && previsao.d30 < 0 ? ' neg' : ' warn'}`}><div className="l">Projeção 30 dias</div><div className="v">{previsao ? fmtCompact(previsao.d30) : '—'}</div></div>
      </div>

      <div className="card-v2">
        <div className="card-v2-h">
          <h3>Evolução do saldo — {PERIODOS.find(p => p.key === filtroPeriodo)?.label}</h3>
          <span style={{ fontSize: 11, color: 'var(--mut)' }}>Burn diário: {previsao ? fmtCompact(previsao.avgBurnDaily) : '—'} · Receita diária: {previsao ? fmtCompact(previsao.avgReceiveDaily) : '—'}</span>
        </div>
        {loadingPrevisao ? (
          <div style={{ height: 280, background: 'var(--bg)', borderRadius: 8 }} />
        ) : diasChart.length === 0 ? (
          <div style={{ height: 280, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--mut)' }}>
            Sem dados suficientes para projeção.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={diasChart}>
              <defs>
                <linearGradient id="gradPos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#16A34A" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#16A34A" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
              <XAxis dataKey="label" tick={{ fill: 'var(--mut)', fontSize: 12 }} />
              <YAxis tick={{ fill: 'var(--mut)', fontSize: 12 }} tickFormatter={(v: number) => v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`} />
              <Tooltip formatter={(value: number) => [fmt(value), 'Saldo previsto']} contentStyle={{ fontSize: 13, borderRadius: 8, border: '1px solid var(--line)' }} />
              <ReferenceLine y={0} stroke="var(--neg)" strokeDasharray="4 2" strokeWidth={1.5} />
              <Area type="monotone" dataKey="saldo" stroke="#16A34A" fill="url(#gradPos)" name="Saldo previsto" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="card-v2" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="card-v2-h" style={{ padding: '14px 16px 0' }}><h3>Detalhe dia a dia</h3></div>
        <table className="table-v2">
          <thead>
            <tr>
              <th style={{ padding: '10px 16px' }}>Data</th>
              <th style={{ textAlign: 'right' }}>Entradas</th>
              <th style={{ textAlign: 'right' }}>Saídas</th>
              <th style={{ textAlign: 'right' }}>Saldo do dia</th>
              <th style={{ textAlign: 'right', padding: '10px 16px' }}>Saldo acumulado</th>
            </tr>
          </thead>
          <tbody>
            {loadingPrevisao ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--mut)' }}>Carregando…</td></tr>
            ) : diasVisiveis.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--mut)' }}>Sem dados de previsão.</td></tr>
            ) : diasVisiveis.map(d => (
              <tr key={d.data} style={d.saldo < 0 ? { background: 'var(--neg-soft)' } : undefined}>
                <td style={{ padding: '7px 16px' }}>{new Date(d.data + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                <td className="num" style={{ textAlign: 'right', color: 'var(--acc-ink)' }}>+{fmt(d.entrada)}</td>
                <td className="num" style={{ textAlign: 'right', color: 'var(--neg)' }}>-{fmt(d.saida)}</td>
                <td className="num" style={{ textAlign: 'right' }}>{fmt(d.entrada - d.saida)}</td>
                <td className="num" style={{ textAlign: 'right', padding: '7px 16px', fontWeight: 800, color: d.saldo < 0 ? 'var(--neg)' : 'var(--ink)' }}>{fmt(d.saldo)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {insightIA && (
        <div className="insights-v2">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 800, background: 'var(--acc2)', color: '#06130C', padding: '2px 8px', borderRadius: 20 }}>FACTORONE AI</span>
            <button onClick={() => setInsightIA('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C4D4CB', fontSize: 16 }}>×</button>
          </div>
          <p style={{ fontSize: 12.5, lineHeight: 1.6, color: '#EAF6F0', whiteSpace: 'pre-line' }}>{insightIA}</p>
        </div>
      )}

      <div className="card-v2">
        <div className="card-v2-h"><h3>Cenários — "E se…?"</h3></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
          <div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <input className="form-input" style={{ flex: 2, minWidth: 140 }} placeholder="Descrição (ex: atraso de recebível)" value={simForm.descricao} onChange={e => setSimForm(f => ({ ...f, descricao: e.target.value }))} />
              <select className="form-input" style={{ width: 'auto' }} value={simForm.tipo} onChange={e => setSimForm(f => ({ ...f, tipo: e.target.value as 'entrada' | 'saida' }))}>
                <option value="entrada">Entrada (+)</option>
                <option value="saida">Saída (−)</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <input className="form-input" style={{ width: 120 }} placeholder="Valor" value={simForm.valor} onChange={e => setSimForm(f => ({ ...f, valor: e.target.value }))} />
              <select className="form-input" style={{ width: 'auto' }} value={simForm.frequencia} onChange={e => setSimForm(f => ({ ...f, frequencia: e.target.value as 'unica' | 'mensal' }))}>
                <option value="mensal">Mensal</option>
                <option value="unica">Única vez</option>
              </select>
              <select className="form-input" style={{ width: 'auto' }} value={simForm.diaInicio} onChange={e => setSimForm(f => ({ ...f, diaInicio: Number(e.target.value) }))}>
                {[1, 7, 14, 30, 45, 60, 90].map(d => <option key={d} value={d}>Dia {d}</option>)}
              </select>
              <button className="btn-v2 primary" onClick={addSimItem}>Adicionar</button>
            </div>
            {simItems.map(item => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '4px 0' }}>
                <span className={`chip-v2 ${item.tipo === 'entrada' ? 'g' : 'r'}`}>{item.tipo === 'entrada' ? '+' : '−'}</span>
                <span style={{ flex: 1 }}>{item.descricao} · {fmt(item.valor)} · {item.frequencia === 'mensal' ? 'mensal' : `dia ${item.diaInicio}`}</span>
                <button onClick={() => setSimItems(prev => prev.filter(i => i.id !== item.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mut)' }}>×</button>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="kpi-v2"><div className="l">Saldo simulado 30d</div><div className="v">{simD30 != null ? fmtCompact(simD30) : '—'}</div></div>
              <div className="kpi-v2"><div className="l">Saldo simulado 90d</div><div className="v">{simD90 != null ? fmtCompact(simD90) : '—'}</div></div>
            </div>
            {diasSimulados.length > 0 && (
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={diasSimulados}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                  <XAxis dataKey="label" tick={{ fill: 'var(--mut)', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'var(--mut)', fontSize: 11 }} tickFormatter={(v: number) => v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`} />
                  <Tooltip formatter={(value: number, name: string) => [fmt(value), name === 'saldo' ? 'Base' : 'Com cenário']} />
                  <ReferenceLine y={0} stroke="var(--neg)" strokeDasharray="4 2" />
                  <Area type="monotone" dataKey="saldo" stroke="var(--mut2)" fill="transparent" strokeDasharray="5 3" name="saldo" />
                  {simItems.length > 0 && <Area type="monotone" dataKey="saldo_sim" stroke="var(--ink)" fill="rgba(17,28,22,.06)" name="saldo_sim" />}
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <Modal
        open={modalAberto}
        onClose={() => setModalAberto(false)}
        title="Nova transação"
        footer={<><button className="btn-action btn-ghost" onClick={() => setModalAberto(false)}>Cancelar</button><button className="btn-action" onClick={() => void criarTransacao()}>Registrar</button></>}
      >
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
      </Modal>
    </div>
  )
}
