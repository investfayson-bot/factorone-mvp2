'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
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

  useEffect(() => { void carregar() }, [carregar])

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
    () => transacoes.filter(
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
  const mediaDiaria = transacoes.length
    ? transacoes.reduce((s, t) => s + (t.tipo === 'entrada' ? Number(t.valor) : -Number(t.valor)), 0) / transacoes.length
    : 0
  const projecao30 = saldoAcumulado + mediaDiaria * 30
  const serieComProjecao = [
    ...serie,
    { data: 'Proj 30d', descricao: 'Projeção', categoria: 'projecao', tipo: 'entrada' as const, valor: 0, saldo: saldoAcumulado, projecao: projecao30 },
  ]

  const entradasMes = transacoes.filter((t) => t.tipo === 'entrada').reduce((s, t) => s + Number(t.valor), 0)
  const saidasMes = transacoes.filter((t) => t.tipo === 'saida').reduce((s, t) => s + Number(t.valor), 0)
  const saldoAtual = entradasMes - saidasMes

  const inputStyle = { width: '100%', padding: '9px 12px', border: '1.5px solid var(--gray-200)', borderRadius: 8, fontSize: 13, fontFamily: "'Inter', sans-serif", color: 'var(--navy)', outline: 'none' }
  const labelStyle = { fontSize: 10, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase' as const, letterSpacing: '.06em', fontFamily: "'DM Mono', monospace", display: 'block', marginBottom: 5 }

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }} className="space-y-4">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 17, fontWeight: 700, color: 'var(--navy)' }}>Cash Flow Intelligence</div>
          <div style={{ fontSize: 11, color: 'var(--gray-400)', fontFamily: "'DM Mono', monospace", marginTop: 2 }}>Últimos {filtroPeriodo} dias · Real + Projeção</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            style={{ padding: '7px 16px', background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            onClick={() => setModalAberto(true)}
          >
            + Nova transação
          </button>
          <button
            style={{ padding: '7px 16px', background: 'transparent', border: '1.5px solid var(--gray-200)', color: 'var(--gray-700)', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            onClick={() => void analisarIA()}
            disabled={loadingIA}
          >
            {loadingIA ? 'Analisando...' : 'Analisar com IA'}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Entradas período', val: entradasMes, color: 'var(--fo-green)' },
          { label: 'Saídas período', val: saidasMes, color: 'var(--fo-red)' },
          { label: 'Saldo Líquido', val: saldoAtual, color: saldoAtual >= 0 ? 'var(--fo-green)' : 'var(--fo-red)' },
          { label: 'Projeção 30 dias', val: projecao30, color: projecao30 >= 0 ? 'var(--fo-green)' : 'var(--fo-gold)' },
        ].map((k) => (
          <div key={k.label} style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--gray-400)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 6, fontFamily: "'DM Mono', monospace" }}>{k.label}</div>
            <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 20, fontWeight: 800, color: k.color, letterSpacing: '-.03em', lineHeight: 1.1 }}>{formatBRL(k.val)}</div>
          </div>
        ))}
      </div>

      {/* Alert */}
      {projecao30 < 5000 && (
        <div style={{ background: 'rgba(192,80,74,.06)', border: '1px solid rgba(192,80,74,.2)', borderRadius: 10, padding: '10px 14px', color: 'var(--fo-red)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          ⚠ Alerta: projeção abaixo de R$ 5.000 nos próximos 30 dias.
        </div>
      )}

      {/* Chart */}
      {transacoes.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: '48px 24px', textAlign: 'center', color: 'var(--gray-400)', fontSize: 13 }}>
          Nenhuma transação no período. Use o botão &ldquo;Nova transação&rdquo; para registrar.
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: 18, marginBottom: 14 }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--gray-400)', letterSpacing: '.1em', textTransform: 'uppercase', fontFamily: "'DM Mono', monospace", marginBottom: 14 }}>
            Saldo Acumulado
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={serieComProjecao}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
              <XAxis dataKey="data" tick={{ fill: 'var(--gray-400)', fontSize: 10 }} />
              <YAxis tick={{ fill: 'var(--gray-400)', fontSize: 10 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => formatBRL(v)} />
              <Area type="monotone" dataKey="saldo" name="Saldo acumulado" stroke="#5E8C87" fill="rgba(94,140,135,.12)" />
              <Area type="monotone" dataKey="projecao" name="Projeção" stroke="#B8922A" fill="transparent" strokeDasharray="6 6" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {[
          { val: filtroPeriodo, set: setFiltroPeriodo as (v: string) => void, opts: [{ v: '30', l: 'Últimos 30 dias' }, { v: '90', l: 'Últimos 90 dias' }, { v: '365', l: 'Último ano' }] },
          { val: filtroCategoria, set: setFiltroCategoria, opts: categorias.map(c => ({ v: c, l: c })) },
          { val: filtroTipo, set: setFiltroTipo as (v: string) => void, opts: [{ v: 'todos', l: 'Todos' }, { v: 'entrada', l: 'Entradas' }, { v: 'saida', l: 'Saídas' }] },
        ].map((sel, idx) => (
          <select
            key={idx}
            value={sel.val}
            onChange={e => sel.set(e.target.value)}
            style={{ background: '#fff', border: '1.5px solid var(--gray-200)', borderRadius: 8, padding: '6px 12px', fontSize: 12, color: 'var(--navy)', outline: 'none' }}
          >
            {sel.opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: 'var(--cream)' }}>
                {['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor', 'Saldo acumulado'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '9px 14px', fontSize: 9, fontWeight: 700, color: 'var(--gray-400)', letterSpacing: '.08em', textTransform: 'uppercase', borderBottom: '1px solid var(--gray-100)', fontFamily: "'DM Mono', monospace" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtradas.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: 'var(--gray-400)' }}>Nenhuma transação com os filtros atuais.</td></tr>
              ) : (
                filtradas.map((t) => (
                  <tr key={t.id} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                    <td style={{ padding: '11px 14px', color: 'var(--navy)' }}>{new Date(t.data + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                    <td style={{ padding: '11px 14px', fontWeight: 600, color: 'var(--navy)' }}>{t.descricao}</td>
                    <td style={{ padding: '11px 14px', color: 'var(--gray-500)' }}>{t.categoria}</td>
                    <td style={{ padding: '11px 14px' }}>
                      <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600, background: t.tipo === 'entrada' ? 'rgba(45,155,111,.12)' : 'rgba(192,80,74,.1)', color: t.tipo === 'entrada' ? 'var(--fo-green)' : 'var(--fo-red)' }}>
                        {t.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                      </span>
                    </td>
                    <td style={{ padding: '11px 14px', fontFamily: "'Sora', sans-serif", fontWeight: 700, color: t.tipo === 'entrada' ? 'var(--fo-green)' : 'var(--fo-red)' }}>
                      {t.tipo === 'entrada' ? '+' : '-'}{formatBRL(Number(t.valor))}
                    </td>
                    <td style={{ padding: '11px 14px', fontFamily: "'DM Mono', monospace", color: 'var(--navy)' }}>
                      {formatBRL(serie.find((s) => s.id === t.id)?.saldo || 0)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Insight */}
      {insightIA && (
        <div style={{ background: 'rgba(94,140,135,.06)', border: '1px solid rgba(94,140,135,.2)', borderRadius: 12, padding: 18 }}>
          <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 13, fontWeight: 700, color: 'var(--navy)', marginBottom: 8 }}>Análise FactorOne</div>
          <p style={{ fontSize: 12, color: 'var(--navy)', whiteSpace: 'pre-line', lineHeight: 1.6 }}>{insightIA}</p>
        </div>
      )}

      {/* Modal */}
      {modalAberto && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: 440, maxWidth: '95vw', boxShadow: '0 24px 64px rgba(0,0,0,.2)' }}>
            <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 16, fontWeight: 700, color: 'var(--navy)', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              Nova transação
              <button onClick={() => setModalAberto(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--gray-400)', lineHeight: 1 }}>×</button>
            </div>
            <div className="space-y-3">
              <div>
                <label style={labelStyle}>Descrição</label>
                <input style={inputStyle} placeholder="Descrição" value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Categoria</label>
                <select style={{ ...inputStyle }} value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}>
                  <option value="operacional">Operacional</option>
                  <option value="impostos">Impostos</option>
                  <option value="custo">Custo</option>
                  <option value="receita_extra">Receita extra</option>
                  <option value="despesa_operacional">Despesa operacional</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Tipo</label>
                <select style={{ ...inputStyle }} value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value as 'entrada' | 'saida' })}>
                  <option value="entrada">Entrada</option>
                  <option value="saida">Saída</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Valor</label>
                <input type="number" style={inputStyle} placeholder="0,00" value={form.valor || ''} onChange={e => setForm({ ...form, valor: Number(e.target.value) })} />
              </div>
              <div>
                <label style={labelStyle}>Data</label>
                <input type="date" style={inputStyle} value={form.data} onChange={e => setForm({ ...form, data: e.target.value })} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setModalAberto(false)} style={{ padding: '7px 16px', background: 'transparent', border: '1.5px solid var(--gray-200)', borderRadius: 8, fontSize: 13, color: 'var(--gray-700)', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={() => void criarTransacao()} style={{ padding: '7px 16px', background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
