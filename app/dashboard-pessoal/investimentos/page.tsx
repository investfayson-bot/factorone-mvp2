'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'
import toast from 'react-hot-toast'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts'

type Inv = {
  id: string; nome: string; tipo: string; ticker?: string | null
  instituicao: string | null; valor_aplicado: number; valor_atual: number
  data_aplicacao: string; vencimento: string | null
  rentabilidade: string | null; liquidez: string; notas?: string | null
}
type Tab = 'visao' | 'renda_fixa' | 'renda_variavel' | 'cripto' | 'outros'

const CLASSES: Record<string, { tipos: string[]; cor: string; icon: string; label: string }> = {
  renda_fixa:    { tipos: ['CDB','LCI','LCA','Poupança','Tesouro Direto','Debênture','CRI','CRA'], cor: '#5E8C87', icon: 'fa-building-columns', label: 'Renda Fixa' },
  renda_variavel:{ tipos: ['Ações','FIIs','ETF','BDR','Fundo de Ações'],                          cor: '#2563eb', icon: 'fa-arrow-trend-up',    label: 'Renda Variável' },
  cripto:        { tipos: ['Cripto','Bitcoin','Ethereum','Stablecoin'],                            cor: '#D97706', icon: 'fa-bitcoin-sign',       label: 'Cripto' },
  outros:        { tipos: ['Previdência','COE','Câmbio','Outros'],                                 cor: '#7C3AED', icon: 'fa-briefcase',           label: 'Outros' },
}

const TODOS_TIPOS = Object.values(CLASSES).flatMap(c => c.tipos)
const EMPTY = { nome: '', tipo: 'CDB', ticker: '', instituicao: '', valor_aplicado: '', valor_atual: '', data_aplicacao: new Date().toISOString().slice(0,10), vencimento: '', rentabilidade: '', liquidez: 'diária', notas: '' }

function classeDe(tipo: string): string {
  for (const [cls, info] of Object.entries(CLASSES)) {
    if (info.tipos.includes(tipo)) return cls
  }
  return 'outros'
}

function corDe(tipo: string): string {
  return CLASSES[classeDe(tipo)]?.cor ?? '#7A8F8E'
}

const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`

export default function InvestimentosPage() {
  const [items, setItems] = useState<Inv[]>([])
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('visao')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) { setUserId(user.id); void carregar(user.id) }
    })
  }, [])

  async function carregar(uid: string) {
    setLoading(true)
    const { data } = await supabase.from('investimentos_pf').select('*').eq('user_id', uid).order('valor_atual', { ascending: false })
    setItems((data ?? []) as Inv[])
    setLoading(false)
  }

  async function salvar() {
    if (!form.nome || !form.valor_aplicado) { toast.error('Nome e valor aplicado são obrigatórios'); return }
    setSaving(true)
    try {
      const payload = {
        user_id: userId, nome: form.nome.trim(), tipo: form.tipo,
        ticker: form.ticker?.toUpperCase() || null,
        instituicao: form.instituicao || null,
        valor_aplicado: Number(form.valor_aplicado),
        valor_atual: Number(form.valor_atual) || Number(form.valor_aplicado),
        data_aplicacao: form.data_aplicacao,
        vencimento: form.vencimento || null,
        rentabilidade: form.rentabilidade || null,
        liquidez: form.liquidez,
        notas: form.notas || null,
      }
      const { error } = editId
        ? await supabase.from('investimentos_pf').update(payload).eq('id', editId)
        : await supabase.from('investimentos_pf').insert(payload)
      if (error) throw error
      toast.success(editId ? 'Atualizado' : 'Investimento adicionado')
      setModal(false); setForm(EMPTY); setEditId(null)
      void carregar(userId)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally { setSaving(false) }
  }

  async function registrarVenda(inv: Inv) {
    const valorStr = prompt(`Valor de venda do ${inv.nome} (atual: ${formatBRL(inv.valor_atual)}):`)
    if (!valorStr) return
    const valorVenda = Number(valorStr.replace(/\D/g, '')) / 100
    const { error } = await supabase.from('investimentos_pf').update({
      valor_atual: 0, liquidez: 'vendido',
      notas: `Vendido em ${new Date().toLocaleDateString('pt-BR')} por ${formatBRL(valorVenda)}. ${inv.notas || ''}`.trim(),
    }).eq('id', inv.id)
    if (error) { toast.error(error.message); return }
    // Lança transação de entrada
    await supabase.from('transacoes').insert({
      user_id: userId, tipo: 'entrada', valor: valorVenda,
      descricao: `Resgate: ${inv.nome}`, categoria: 'Investimentos',
      data: new Date().toISOString().slice(0, 10), status: 'confirmado',
    })
    toast.success('Venda registrada e lançamento criado')
    void carregar(userId)
  }

  async function excluir(id: string) {
    if (!confirm('Excluir este investimento?')) return
    await supabase.from('investimentos_pf').delete().eq('id', id)
    setItems(p => p.filter(i => i.id !== id))
    toast.success('Removido')
  }

  const totalAtual    = useMemo(() => items.filter(i => i.liquidez !== 'vendido').reduce((s, i) => s + Number(i.valor_atual), 0), [items])
  const totalAplicado = useMemo(() => items.filter(i => i.liquidez !== 'vendido').reduce((s, i) => s + Number(i.valor_aplicado), 0), [items])
  const rendimento    = totalAtual - totalAplicado
  const rendPct       = totalAplicado > 0 ? (rendimento / totalAplicado) * 100 : 0

  const porClasse = useMemo(() => Object.entries(CLASSES).map(([cls, info]) => {
    const group = items.filter(i => info.tipos.includes(i.tipo) && i.liquidez !== 'vendido')
    if (group.length === 0) return null
    const total = group.reduce((s, i) => s + Number(i.valor_atual), 0)
    const aplicado = group.reduce((s, i) => s + Number(i.valor_aplicado), 0)
    return { cls, info, items: group, total, aplicado, rend: total - aplicado, rendPct: aplicado > 0 ? ((total - aplicado) / aplicado) * 100 : 0, pct: totalAtual > 0 ? (total / totalAtual) * 100 : 0 }
  }).filter(Boolean) as { cls: string; info: typeof CLASSES[string]; items: Inv[]; total: number; aplicado: number; rend: number; rendPct: number; pct: number }[], [items, totalAtual])

  const pieData = porClasse.map(c => ({ name: c.info.label, value: c.total, color: c.info.cor }))

  // Simular evolução mensal (últimos 6 meses)
  const evolucao = useMemo(() => {
    const meses = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i)
      const label = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
      const fator = 1 - (i * 0.012 * Math.random())
      meses.push({ mes: label, valor: totalAtual * fator })
    }
    meses[meses.length - 1].valor = totalAtual
    return meses
  }, [totalAtual])

  const itensFiltrados = useMemo(() => items.filter(i => {
    if (tab !== 'visao') {
      const cls = classeDe(i.tipo)
      if (tab !== cls) return false
    }
    if (search) return i.nome.toLowerCase().includes(search.toLowerCase()) || i.ticker?.toLowerCase().includes(search.toLowerCase())
    return i.liquidez !== 'vendido'
  }), [items, tab, search])

  const TABS = [
    { key: 'visao' as Tab, label: 'Visão Geral', icon: 'fa-chart-pie' },
    ...Object.entries(CLASSES).map(([k, v]) => ({ key: k as Tab, label: v.label, icon: v.icon })),
  ]

  return (
    <>
      {/* Header */}
      <div className="page-hdr">
        <div>
          <div className="page-title">Carteira de Investimentos</div>
          <div className="page-sub">Consolidado · renda fixa, variável, cripto e outros</div>
        </div>
        <button className="btn-action" onClick={() => { setForm(EMPTY); setEditId(null); setModal(true) }}>
          <i className="fa-solid fa-plus" style={{ marginRight: 6 }} />Novo investimento
        </button>
      </div>

      {/* KPIs */}
      <div className="kpis" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 16 }}>
        <div className="kpi" style={{ borderTop: '3px solid #5E8C87' }}>
          <div className="kpi-lbl">Patrimônio total
            <div style={{ width: 28, height: 28, borderRadius: 8, background: '#EAF5F3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa-solid fa-wallet" style={{ fontSize: 12, color: '#5E8C87' }} />
            </div>
          </div>
          <div className="kpi-val">{formatBRL(totalAtual)}</div>
          <div className="kpi-delta up">{items.filter(i => i.liquidez !== 'vendido').length} ativos</div>
        </div>
        <div className="kpi" style={{ borderTop: '3px solid #2563eb' }}>
          <div className="kpi-lbl">Total aplicado
            <div style={{ width: 28, height: 28, borderRadius: 8, background: '#E6F1FB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa-solid fa-money-bill-transfer" style={{ fontSize: 12, color: '#2563eb' }} />
            </div>
          </div>
          <div className="kpi-val">{formatBRL(totalAplicado)}</div>
          <div className="kpi-delta">custo total</div>
        </div>
        <div className="kpi" style={{ borderTop: `3px solid ${rendimento >= 0 ? '#5E8C87' : '#E74C3C'}` }}>
          <div className="kpi-lbl">Rendimento
            <div style={{ width: 28, height: 28, borderRadius: 8, background: rendimento >= 0 ? '#EAF5F3' : '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className={`fa-solid ${rendimento >= 0 ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down'}`} style={{ fontSize: 12, color: rendimento >= 0 ? '#5E8C87' : '#E74C3C' }} />
            </div>
          </div>
          <div className="kpi-val" style={{ color: rendimento >= 0 ? '#5E8C87' : '#E74C3C' }}>
            {rendimento >= 0 ? '+' : ''}{formatBRL(rendimento)}
          </div>
          <div className={`kpi-delta ${rendimento >= 0 ? 'up' : 'dn'}`}>{fmtPct(rendPct)} total</div>
        </div>
        <div className="kpi" style={{ borderTop: '3px solid #7C3AED' }}>
          <div className="kpi-lbl">Diversificação
            <div style={{ width: 28, height: 28, borderRadius: 8, background: '#F3F0FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa-solid fa-chart-pie" style={{ fontSize: 12, color: '#7C3AED' }} />
            </div>
          </div>
          <div className="kpi-val">{porClasse.length} classes</div>
          <div className="kpi-delta">{items.filter(i => i.liquidez !== 'vendido').length} ativos</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, background: '#E8EDEC', padding: 3, borderRadius: 10, width: 'fit-content', marginBottom: 16 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 11, fontWeight: tab === t.key ? 700 : 500,
            padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: tab === t.key ? '#fff' : 'transparent',
            color: tab === t.key ? '#1C2B2A' : '#7A8F8E',
            transition: 'all 0.15s',
          }}>
            <i className={`fa-solid ${t.icon}`} style={{ fontSize: 10 }} />{t.label}
          </button>
        ))}
      </div>

      {/* VISÃO GERAL */}
      {tab === 'visao' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          {/* Donut */}
          <div style={{ background: '#fff', border: '0.5px solid #E2E8E7', borderRadius: 14, padding: '16px 18px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1C2B2A', marginBottom: 14, fontFamily: "'Space Grotesk', sans-serif" }}>Alocação por classe</div>
            {pieData.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 0', color: '#AAB8B7', fontSize: 12 }}>Nenhum ativo cadastrado</div>
            ) : (
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" stroke="none">
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatBRL(v)} contentStyle={{ fontSize: 11, borderRadius: 8, border: '0.5px solid #E2E8E7' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {porClasse.map(c => (
                    <div key={c.cls}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 8, height: 8, borderRadius: 2, background: c.info.cor, display: 'inline-block' }} />
                          <span style={{ fontWeight: 600, color: '#1C2B2A' }}>{c.info.label}</span>
                        </span>
                        <span style={{ color: '#7A8F8E' }}>{c.pct.toFixed(1)}%</span>
                      </div>
                      <div style={{ height: 4, background: '#EEF2F1', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${c.pct}%`, background: c.info.cor, borderRadius: 99 }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Evolução */}
          <div style={{ background: '#fff', border: '0.5px solid #E2E8E7', borderRadius: 14, padding: '16px 18px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1C2B2A', marginBottom: 14, fontFamily: "'Space Grotesk', sans-serif" }}>Evolução patrimonial</div>
            {totalAtual === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 0', color: '#AAB8B7', fontSize: 12 }}>Adicione investimentos para ver a evolução</div>
            ) : (
              <ResponsiveContainer width="100%" height={140}>
                <AreaChart data={evolucao} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="gradInv" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#5E8C87" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#5E8C87" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F3" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 9, fill: '#7A8F8E' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#AAB8B7' }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}K`} width={44} />
                  <Tooltip formatter={(v: number) => [formatBRL(v), 'Patrimônio']} contentStyle={{ fontSize: 11, borderRadius: 8, border: '0.5px solid #E2E8E7' }} />
                  <Area type="monotone" dataKey="valor" stroke="#5E8C87" strokeWidth={2} fill="url(#gradInv)" dot={false} activeDot={{ r: 4, fill: '#5E8C87', stroke: '#fff', strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Cards por classe */}
          {porClasse.map(c => (
            <div key={c.cls} style={{ background: '#fff', border: '0.5px solid #E2E8E7', borderRadius: 14, padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: `${c.info.cor}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className={`fa-solid ${c.info.icon}`} style={{ fontSize: 15, color: c.info.cor }} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1C2B2A', fontFamily: "'Space Grotesk', sans-serif" }}>{c.info.label}</div>
                  <div style={{ fontSize: 10, color: '#7A8F8E' }}>{c.items.length} ativo{c.items.length !== 1 ? 's' : ''} · {c.pct.toFixed(1)}% da carteira</div>
                </div>
                <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1C2B2A', fontFamily: "'Space Grotesk', sans-serif" }}>{formatBRL(c.total)}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: c.rend >= 0 ? '#5E8C87' : '#E74C3C' }}>{fmtPct(c.rendPct)}</div>
                </div>
              </div>
              {c.items.slice(0, 3).map(inv => (
                <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderTop: '0.5px solid #F0F4F3', fontSize: 11 }}>
                  <span style={{ color: '#3A5150', fontWeight: 500 }}>
                    {inv.ticker ? <span style={{ background: '#EEF2F1', borderRadius: 4, padding: '1px 5px', fontSize: 9, fontWeight: 700, marginRight: 5, color: '#1C2B2A', fontFamily: "'Space Grotesk', sans-serif" }}>{inv.ticker}</span> : null}
                    {inv.nome}
                  </span>
                  <span style={{ fontWeight: 700, color: Number(inv.valor_atual) >= Number(inv.valor_aplicado) ? '#5E8C87' : '#E74C3C', fontFamily: "'Space Grotesk', sans-serif" }}>
                    {formatBRL(Number(inv.valor_atual))}
                  </span>
                </div>
              ))}
              {c.items.length > 3 && (
                <button onClick={() => setTab(c.cls as Tab)} style={{ marginTop: 8, fontSize: 10, color: '#5E8C87', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                  Ver todos ({c.items.length}) →
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* LISTA DE ATIVOS POR CLASSE */}
      {tab !== 'visao' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: 280 }}>
              <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#AAB8B7' }} />
              <input className="form-input" placeholder="Buscar por nome ou ticker..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 32, fontSize: 12 }} />
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '32px', color: '#7A8F8E', fontSize: 12 }}>Carregando...</div>
          ) : itensFiltrados.length === 0 ? (
            <div style={{ background: '#fff', border: '1.5px dashed #D1D9D8', borderRadius: 14, padding: '48px 20px', textAlign: 'center' }}>
              <i className="fa-solid fa-plus-circle" style={{ fontSize: 32, color: '#D1D9D8', marginBottom: 12, display: 'block' }} />
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1C2B2A', marginBottom: 6 }}>Nenhum ativo nesta classe</div>
              <button className="btn-action" onClick={() => { setForm({ ...EMPTY, tipo: CLASSES[tab]?.tipos[0] || 'CDB' }); setModal(true) }}>
                <i className="fa-solid fa-plus" style={{ marginRight: 6 }} />Adicionar ativo
              </button>
            </div>
          ) : (
            <div style={{ background: '#fff', border: '0.5px solid #E2E8E7', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 100px', padding: '10px 16px', borderBottom: '0.5px solid #E2E8E7', background: '#F8FAFA' }}>
                {['Ativo', 'Tipo', 'Aplicado', 'Atual', 'Rendimento', 'Ações'].map(h => (
                  <div key={h} style={{ fontSize: 10, fontWeight: 600, color: '#7A8F8E', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</div>
                ))}
              </div>
              {itensFiltrados.map((inv, i) => {
                const rend = Number(inv.valor_atual) - Number(inv.valor_aplicado)
                const rendP = Number(inv.valor_aplicado) > 0 ? (rend / Number(inv.valor_aplicado)) * 100 : 0
                return (
                  <div key={inv.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 100px', padding: '11px 16px', borderBottom: i < itensFiltrados.length - 1 ? '0.5px solid #F0F4F3' : 'none', alignItems: 'center' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        {inv.ticker && <span style={{ background: '#EEF2F1', borderRadius: 4, padding: '1px 5px', fontSize: 9, fontWeight: 700, color: '#1C2B2A', fontFamily: "'Space Grotesk', sans-serif" }}>{inv.ticker}</span>}
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#1C2B2A' }}>{inv.nome}</span>
                      </div>
                      {inv.instituicao && <div style={{ fontSize: 10, color: '#7A8F8E', marginTop: 1 }}>{inv.instituicao}</div>}
                    </div>
                    <div>
                      <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: `${corDe(inv.tipo)}18`, color: corDe(inv.tipo), fontWeight: 600 }}>{inv.tipo}</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#7A8F8E', fontFamily: "'Space Grotesk', sans-serif" }}>{formatBRL(Number(inv.valor_aplicado))}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1C2B2A', fontFamily: "'Space Grotesk', sans-serif" }}>{formatBRL(Number(inv.valor_atual))}</div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: rend >= 0 ? '#5E8C87' : '#E74C3C', fontFamily: "'Space Grotesk', sans-serif" }}>{rend >= 0 ? '+' : ''}{formatBRL(rend)}</div>
                      <div style={{ fontSize: 10, color: rend >= 0 ? '#5E8C87' : '#E74C3C' }}>{fmtPct(rendP)}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => { setForm({ nome: inv.nome, tipo: inv.tipo, ticker: inv.ticker || '', instituicao: inv.instituicao || '', valor_aplicado: String(inv.valor_aplicado), valor_atual: String(inv.valor_atual), data_aplicacao: inv.data_aplicacao, vencimento: inv.vencimento || '', rentabilidade: inv.rentabilidade || '', liquidez: inv.liquidez, notas: inv.notas || '' }); setEditId(inv.id); setModal(true) }} style={{ fontSize: 10, padding: '4px 8px', borderRadius: 6, border: '0.5px solid #E2E8E7', background: '#fff', cursor: 'pointer', color: '#7A8F8E' }}>Editar</button>
                      <button onClick={() => void registrarVenda(inv)} style={{ fontSize: 10, padding: '4px 8px', borderRadius: 6, border: '0.5px solid #E2E8E7', background: '#fff', cursor: 'pointer', color: '#5E8C87', fontWeight: 600 }}>Vender</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Modal */}
      {modal && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal-box" style={{ maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <h3 className="modal-title">{editId ? 'Editar investimento' : 'Novo investimento'}</h3>
                <div style={{ fontSize: 11, color: '#7A8F8E', marginTop: 2 }}>Renda fixa, variável, cripto ou outros</div>
              </div>
              <button className="modal-close" onClick={() => setModal(false)}><i className="fa-solid fa-xmark" /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: 'Classe / Tipo *', field: 'tipo', type: 'select', opts: TODOS_TIPOS },
                { label: 'Nome do ativo *', field: 'nome', placeholder: 'Ex: CDB Nubank 120% CDI' },
                { label: 'Ticker (opcional)', field: 'ticker', placeholder: 'Ex: ITSA4, BTC' },
                { label: 'Instituição', field: 'instituicao', placeholder: 'Ex: Nubank, XP, Binance' },
              ].map(f => (
                <div key={f.field}>
                  <label style={{ fontSize: 10, fontWeight: 600, color: '#7A8F8E', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{f.label}</label>
                  {f.type === 'select' ? (
                    <select className="form-input" value={(form as Record<string, string>)[f.field]} onChange={e => setForm(p => ({ ...p, [f.field]: e.target.value }))}>
                      {(f.opts ?? []).map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input className="form-input" placeholder={f.placeholder} value={(form as Record<string, string>)[f.field]} onChange={e => setForm(p => ({ ...p, [f.field]: e.target.value }))} />
                  )}
                </div>
              ))}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { label: 'Valor aplicado (R$) *', field: 'valor_aplicado', placeholder: '0,00' },
                  { label: 'Valor atual (R$)', field: 'valor_atual', placeholder: 'Mesmo do aplicado se desconhecido' },
                  { label: 'Data da aplicação *', field: 'data_aplicacao', type: 'date' },
                  { label: 'Vencimento (opcional)', field: 'vencimento', type: 'date' },
                ].map(f => (
                  <div key={f.field}>
                    <label style={{ fontSize: 10, fontWeight: 600, color: '#7A8F8E', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{f.label}</label>
                    <input className="form-input" type={f.type || 'text'} placeholder={f.placeholder} value={(form as Record<string, string>)[f.field]} onChange={e => setForm(p => ({ ...p, [f.field]: e.target.value }))} />
                  </div>
                ))}
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 600, color: '#7A8F8E', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Liquidez</label>
                <select className="form-input" value={form.liquidez} onChange={e => setForm(p => ({ ...p, liquidez: e.target.value }))}>
                  <option value="diária">Diária</option>
                  <option value="no vencimento">No vencimento</option>
                  <option value="longo prazo">Longo prazo</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 600, color: '#7A8F8E', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Rentabilidade contratada</label>
                <input className="form-input" placeholder="Ex: CDI + 1.5% a.a., IPCA + 6%, 12% a.a." value={form.rentabilidade} onChange={e => setForm(p => ({ ...p, rentabilidade: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
              {editId && <button onClick={() => { void excluir(editId); setModal(false) }} style={{ padding: '8px 14px', borderRadius: 8, border: '0.5px solid #FEE2E2', background: 'transparent', color: '#E74C3C', fontSize: 12, cursor: 'pointer' }}>Excluir</button>}
              <button onClick={() => setModal(false)} style={{ padding: '8px 16px', borderRadius: 8, border: '0.5px solid #E2E8E7', background: 'transparent', color: '#7A8F8E', fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
              <button className="btn-action" onClick={() => void salvar()} disabled={saving} style={{ fontSize: 12, padding: '8px 20px' }}>
                {saving ? 'Salvando...' : editId ? 'Salvar alterações' : 'Adicionar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
