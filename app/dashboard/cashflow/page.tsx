'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { AreaChart, Area, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatBRL } from '@/lib/currency-brl'

type Tx = { id: string; data: string; descricao: string; categoria: string; tipo: 'entrada' | 'saida'; valor: number }

export default function CashflowPage() {
  const [txs, setTxs] = useState<Tx[]>([])
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'entrada' | 'saida'>('todos')
  const [filtroCategoria, setFiltroCategoria] = useState('todas')
  const [periodo, setPeriodo] = useState<'30' | '90' | '365'>('30')
  const [modal, setModal] = useState(false)
  const [loadingIA, setLoadingIA] = useState(false)
  const [insightIA, setInsightIA] = useState('')
  const [form, setForm] = useState({ descricao: '', categoria: 'operacional', tipo: 'saida', valor: 0, data: new Date().toISOString().slice(0, 10) })

  const carregar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const dt = new Date(); dt.setDate(dt.getDate() - Number(periodo))
    const { data } = await supabase.from('transacoes').select('*').eq('empresa_id', user.id).gte('data', dt.toISOString().slice(0, 10)).order('data', { ascending: true })
    setTxs((data as Tx[]) || [])
  }, [periodo])

  useEffect(() => { void carregar() }, [carregar])

  async function salvar() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('transacoes').insert({ empresa_id: user.id, ...form, status: 'confirmada' })
    setModal(false)
    setForm({ descricao: '', categoria: 'operacional', tipo: 'saida', valor: 0, data: new Date().toISOString().slice(0, 10) })
    await carregar()
  }

  async function analisarIA() {
    setLoadingIA(true)
    const { data: sess } = await supabase.auth.getSession()
    const res = await fetch('/api/aicfo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(sess.session?.access_token ? { Authorization: `Bearer ${sess.session.access_token}` } : {}) },
      body: JSON.stringify({ message: 'Analise meu fluxo de caixa e traga riscos e ações para os próximos 30 dias.', context: JSON.stringify({ txs }) }),
    })
    const d = await res.json()
    setInsightIA(d.response || d.error || '')
    setLoadingIA(false)
  }

  const categorias = useMemo(() => ['todas', ...Array.from(new Set(txs.map(t => t.categoria || 'sem_categoria')))], [txs])
  const filtradas = useMemo(() => txs.filter(t => (filtroTipo === 'todos' || t.tipo === filtroTipo) && (filtroCategoria === 'todas' || t.categoria === filtroCategoria)), [txs, filtroTipo, filtroCategoria])

  const serie = txs.map((t, i) => {
    const saldo = txs.slice(0, i + 1).reduce((s, x) => s + (x.tipo === 'entrada' ? Number(x.valor) : -Number(x.valor)), 0)
    return { ...t, saldo, projecao: null as number | null }
  })
  const saldoAcum = serie.length ? serie[serie.length - 1].saldo : 0
  const mediaDia = txs.length ? txs.reduce((s, t) => s + (t.tipo === 'entrada' ? Number(t.valor) : -Number(t.valor)), 0) / txs.length : 0
  const proj30 = saldoAcum + mediaDia * 30
  const chartData = [...serie, { data: 'Proj 30d', descricao: '', categoria: '', tipo: 'entrada' as const, valor: 0, id: '', saldo: saldoAcum, projecao: proj30 }]

  const entradas = txs.filter(t => t.tipo === 'entrada').reduce((s, t) => s + Number(t.valor), 0)
  const saidas = txs.filter(t => t.tipo === 'saida').reduce((s, t) => s + Number(t.valor), 0)
  const saldoAtual = entradas - saidas

  return (
    <>
      {/* Header */}
      <div className="page-hdr">
        <div>
          <div className="page-title">Cash Flow Intelligence</div>
          <div className="page-sub">Últimos {periodo} dias · Real + Projeção</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-action" onClick={() => setModal(true)}>+ Nova transação</button>
          <button className="btn-action btn-ghost" onClick={() => void analisarIA()} disabled={loadingIA}>
            {loadingIA ? 'Analisando...' : 'Analisar com IA'}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpis">
        <div className="kpi">
          <div className="kpi-lbl">Entradas período</div>
          <div className="kpi-val" style={{ color: 'var(--green)' }}>{formatBRL(entradas)}</div>
          <div className="kpi-delta up">↑ recebimentos</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Saídas período</div>
          <div className="kpi-val" style={{ color: 'var(--red)' }}>{formatBRL(saidas)}</div>
          <div className="kpi-delta dn">↓ pagamentos</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Saldo Líquido</div>
          <div className="kpi-val" style={{ color: saldoAtual >= 0 ? 'var(--green)' : 'var(--red)' }}>{formatBRL(saldoAtual)}</div>
          <div className={`kpi-delta ${saldoAtual >= 0 ? 'up' : 'dn'}`}>{saldoAtual >= 0 ? '✓ positivo' : '⚠ negativo'}</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Projeção 30 dias</div>
          <div className="kpi-val" style={{ color: proj30 >= 0 ? 'var(--green)' : 'var(--gold)' }}>{formatBRL(proj30)}</div>
          <div className={`kpi-delta ${proj30 < 5000 ? 'warn' : 'up'}`}>{proj30 < 5000 ? '⚠ atenção' : '✓ ok'}</div>
        </div>
      </div>

      {/* Gráfico */}
      <div className="cf-chart-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="chart-title" style={{ marginBottom: 0 }}>Saldo Acumulado</div>
          <div className="cf-legend">
            <div className="cf-leg-item"><div className="cf-leg-dot" style={{ background: 'var(--teal)' }} /> Saldo</div>
            <div className="cf-leg-item"><div className="cf-leg-dot" style={{ background: 'var(--gold)', border: '1px dashed var(--gold)' }} /> Projeção</div>
          </div>
        </div>
        {txs.length === 0 ? (
          <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gray-400)', fontSize: 12, marginTop: 14 }}>
            Nenhuma transação. Use &ldquo;+ Nova transação&rdquo; para começar.
          </div>
        ) : (
          <div style={{ height: 160, marginTop: 14 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
                <XAxis dataKey="data" tick={{ fontSize: 9, fill: 'var(--gray-400)', fontFamily: "'DM Mono', monospace" }} />
                <YAxis tick={{ fontSize: 9, fill: 'var(--gray-400)' }} tickFormatter={v => `R$${(Number(v) / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatBRL(v)} contentStyle={{ borderRadius: 8, border: '1px solid var(--gray-100)', fontSize: 11 }} />
                <Area type="monotone" dataKey="saldo" name="Saldo" stroke="var(--teal)" fill="rgba(94,140,135,.1)" />
                <Area type="monotone" dataKey="projecao" name="Projeção" stroke="var(--gold)" fill="transparent" strokeDasharray="6 3" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {[
          { val: periodo, set: setPeriodo as (v: string) => void, opts: [{ v: '30', l: 'Últimos 30 dias' }, { v: '90', l: 'Últimos 90 dias' }, { v: '365', l: 'Último ano' }] },
          { val: filtroCategoria, set: setFiltroCategoria, opts: categorias.map(c => ({ v: c, l: c })) },
          { val: filtroTipo, set: setFiltroTipo as (v: string) => void, opts: [{ v: 'todos', l: 'Todos' }, { v: 'entrada', l: 'Entradas' }, { v: 'saida', l: 'Saídas' }] },
        ].map((sel, i) => (
          <select key={i} value={sel.val} onChange={e => sel.set(e.target.value)} className="form-input" style={{ width: 'auto', padding: '6px 10px', fontSize: 12 }}>
            {sel.opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        ))}
      </div>

      {/* Tabela */}
      <div className="expenses-table">
        <table>
          <thead>
            <tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Tipo</th><th>Valor</th><th>Saldo acumulado</th></tr>
          </thead>
          <tbody>
            {filtradas.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 32 }}>Nenhuma transação com os filtros atuais.</td></tr>
            ) : filtradas.map(t => (
              <tr key={t.id}>
                <td>{new Date(t.data + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                <td style={{ fontWeight: 600 }}>{t.descricao}</td>
                <td>{t.categoria}</td>
                <td><span className={`tag ${t.tipo === 'entrada' ? 'green' : 'red'}`}>{t.tipo === 'entrada' ? 'Entrada' : 'Saída'}</span></td>
                <td style={{ fontWeight: 700, color: t.tipo === 'entrada' ? 'var(--green)' : 'var(--red)', fontFamily: "'Sora', sans-serif" }}>
                  {t.tipo === 'entrada' ? '+' : '-'}{formatBRL(Number(t.valor))}
                </td>
                <td style={{ fontFamily: "'DM Mono', monospace" }}>{formatBRL(serie.find(s => s.id === t.id)?.saldo || 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Insight IA */}
      {insightIA && (
        <div style={{ marginTop: 14, background: 'rgba(94,140,135,.06)', border: '1px solid rgba(94,140,135,.2)', borderRadius: 12, padding: 16 }}>
          <div className="chart-title" style={{ marginBottom: 8 }}>Análise FactorOne</div>
          <p style={{ fontSize: 12, color: 'var(--navy)', whiteSpace: 'pre-line', lineHeight: 1.65 }}>{insightIA}</p>
        </div>
      )}

      {/* Modal nova transação */}
      {modal && (
        <div className="modal-bg" onClick={() => setModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-title">
              Nova transação
              <button className="modal-close" onClick={() => setModal(false)}>×</button>
            </div>
            <div className="form-group">
              <label className="form-label">Descrição</label>
              <input className="form-input" placeholder="Descrição" value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Categoria</label>
                <select className="form-input" value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}>
                  <option value="operacional">Operacional</option>
                  <option value="impostos">Impostos</option>
                  <option value="custo">Custo</option>
                  <option value="receita_extra">Receita extra</option>
                  <option value="financeira">Financeira</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Tipo</label>
                <select className="form-input" value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value as 'entrada' | 'saida' })}>
                  <option value="entrada">Entrada</option>
                  <option value="saida">Saída</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Valor</label>
                <input type="number" className="form-input" placeholder="0,00" value={form.valor || ''} onChange={e => setForm({ ...form, valor: Number(e.target.value) })} />
              </div>
              <div className="form-group">
                <label className="form-label">Data</label>
                <input type="date" className="form-input" value={form.data} onChange={e => setForm({ ...form, data: e.target.value })} />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-action btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn-action" onClick={() => void salvar()}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
