'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'
import toast from 'react-hot-toast'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import VoltarSolucao from '@/components/dashboard/VoltarSolucao'

type Cartao = {
  id: string; nome: string; bandeira: string; limite: number
  limite_disponivel: number; vencimento_dia: number; fechamento_dia: number
  cor: string; status: string; tipo: string
  formato?: string; titular_nome?: string | null; titular_email?: string | null; pausado?: boolean
}
type Gasto = {
  id: string; cartao_id: string; descricao: string; valor: number
  categoria: string | null; data: string; status: string; parcelas?: number | null
  parcela_atual?: number | null; estabelecimento?: string | null
}
type Tab = 'visao' | 'gastos' | 'fatura' | 'limites' | 'equipe'

const BANDEIRAS: Record<string, string> = { Visa: '💳', Mastercard: '💳', Elo: '💳', Amex: '💳' }
const CORES_CARTAO = ['#13201D', '#1e3a5f', '#5e3a1e', '#3a1e5e', '#1e4a3a', '#4a1e2d']
const CATS_CORES: Record<string, string> = { Alimentação: '#3D7A6E', Transporte: '#3D6E8E', Entretenimento: '#B08A3E', Saúde: '#3D7A6E', Compras: '#7A6A9E', Outros: '#7B8C88' }

const EMPTY_CARTAO = { nome: '', bandeira: 'Visa', limite: '', vencimento_dia: '10', fechamento_dia: '1', cor: CORES_CARTAO[0], tipo: 'credito', formato: 'fisico', titular_nome: '', titular_email: '' }
const EMPTY_GASTO = { descricao: '', valor: '', categoria: 'Outros', data: new Date().toISOString().slice(0, 10), parcelas: '1', estabelecimento: '' }

// Ciclo de fatura (validado): competência em que um gasto cai, dado o dia de fechamento
function competenciaFatura(dataStr: string, fechamentoDia: number): string {
  const d = new Date((dataStr || '').slice(0, 10) + 'T12:00:00')
  if (isNaN(d.getTime())) return ''
  let y = d.getFullYear(), m = d.getMonth()
  if (d.getDate() > fechamentoDia) { m += 1; if (m > 11) { m = 0; y += 1 } }
  return `${y}-${String(m + 1).padStart(2, '0')}`
}
function fechamentoDate(comp: string, fechamentoDia: number): Date {
  const [y, m] = comp.split('-').map(Number)
  return new Date(y, m - 1, fechamentoDia, 12)
}
function labelComp(comp: string): string {
  const [y, m] = comp.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

export default function CartoesPage() {
  const [empresaId, setEmpresaId] = useState('')
  const [cartoes, setCartoes] = useState<Cartao[]>([])
  const [gastos, setGastos] = useState<Gasto[]>([])
  const [cartaoSel, setCartaoSel] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('visao')
  const [modalCartao, setModalCartao] = useState(false)
  const [modalGasto, setModalGasto] = useState(false)
  const [formCartao, setFormCartao] = useState(EMPTY_CARTAO)
  const [formGasto, setFormGasto] = useState(EMPTY_GASTO)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const [paidSet, setPaidSet] = useState<Set<string>>(new Set())

  const carregar = useCallback(async (eid: string) => {
    setLoading(true)
    const [cRes, gRes, fRes] = await Promise.all([
      supabase.from('cartoes_corporativos').select('*').eq('empresa_id', eid).order('created_at'),
      supabase.from('solicitacoes_cartao').select('*').eq('empresa_id', eid).order('data', { ascending: false }).limit(100),
      supabase.from('faturas_cartao').select('cartao_id, competencia, status').eq('empresa_id', eid).eq('status', 'paga'),
    ])
    const cs = (cRes.data ?? []) as Cartao[]
    setCartoes(cs)
    setGastos((gRes.data ?? []) as Gasto[])
    setPaidSet(new Set(((fRes.data ?? []) as { cartao_id: string; competencia: string }[]).map(f => `${f.cartao_id}|${f.competencia}`)))
    if (cs.length > 0 && !cartaoSel) setCartaoSel(cs[0].id)
    setLoading(false)
  }, [cartaoSel])

  async function pagarFatura(comp: string, total: number) {
    if (!cartaoAtual) return
    const fech = fechamentoDate(comp, cartaoAtual.fechamento_dia || 1)
    const venc = new Date(fech)
    venc.setDate(cartaoAtual.vencimento_dia || fech.getDate())
    if ((cartaoAtual.vencimento_dia || 0) < (cartaoAtual.fechamento_dia || 0)) venc.setMonth(venc.getMonth() + 1)
    const { error } = await supabase.from('faturas_cartao').upsert({
      empresa_id: empresaId, cartao_id: cartaoAtual.id, competencia: comp,
      valor_total: total, status: 'paga', paga_em: new Date().toISOString(),
      fechamento_data: fech.toISOString().slice(0, 10), vencimento_data: venc.toISOString().slice(0, 10),
    }, { onConflict: 'cartao_id,competencia' })
    if (error) { toast.error(error.message); return }
    toast.success('Fatura marcada como paga')
    void carregar(empresaId)
  }

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
      const eid = (u?.empresa_id as string) || user.id
      setEmpresaId(eid)
      void carregar(eid)
    })
  }, [carregar])

  async function salvarCartao() {
    if (!formCartao.nome || !formCartao.limite) { toast.error('Nome e limite obrigatórios'); return }
    setSaving(true)
    const limite = Number(formCartao.limite)
    const { error } = await supabase.from('cartoes_corporativos').insert({
      empresa_id: empresaId, nome: formCartao.nome, bandeira: formCartao.bandeira,
      limite, limite_disponivel: limite, vencimento_dia: Number(formCartao.vencimento_dia),
      fechamento_dia: Number(formCartao.fechamento_dia), cor: formCartao.cor, status: 'ativo', tipo: formCartao.tipo,
      formato: formCartao.formato, titular_nome: formCartao.titular_nome || null, titular_email: formCartao.titular_email || null,
    })
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success(formCartao.formato === 'virtual' ? 'Cartão virtual criado' : 'Cartão adicionado')
    setModalCartao(false); setFormCartao(EMPTY_CARTAO)
    void carregar(empresaId)
  }

  async function togglePausar(c: Cartao) {
    const novo = !c.pausado
    const { error } = await supabase.from('cartoes_corporativos').update({ pausado: novo }).eq('id', c.id)
    if (error) { toast.error(error.message); return }
    toast.success(novo ? 'Cartão pausado' : 'Cartão reativado')
    void carregar(empresaId)
  }

  async function ajustarLimite(c: Cartao, novoLimite: number) {
    if (!novoLimite || novoLimite < 0) return
    const usado = Number(c.limite) - Number(c.limite_disponivel)
    const { error } = await supabase.from('cartoes_corporativos').update({
      limite: novoLimite, limite_disponivel: Math.max(0, novoLimite - usado),
    }).eq('id', c.id)
    if (error) { toast.error(error.message); return }
    toast.success('Limite atualizado')
    void carregar(empresaId)
  }

  async function salvarGasto() {
    if (!formGasto.descricao || !formGasto.valor || !cartaoSel) { toast.error('Preencha os campos obrigatórios'); return }
    setSaving(true)
    const valor = Number(formGasto.valor)
    const parcelas = Number(formGasto.parcelas) || 1
    const { error } = await supabase.from('solicitacoes_cartao').insert({
      empresa_id: empresaId, cartao_id: cartaoSel,
      descricao: formGasto.descricao, valor, categoria: formGasto.categoria,
      data: formGasto.data, status: 'pendente', parcelas, parcela_atual: 1,
      estabelecimento: formGasto.estabelecimento || null,
    })
    if (!error) {
      // Atualiza limite disponível
      const cartao = cartoes.find(c => c.id === cartaoSel)
      if (cartao) {
        await supabase.from('cartoes_corporativos').update({
          limite_disponivel: Math.max(0, cartao.limite_disponivel - valor)
        }).eq('id', cartaoSel)
      }
    }
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Gasto registrado')
    setModalGasto(false); setFormGasto(EMPTY_GASTO)
    void carregar(empresaId)
  }

  const cartaoAtual = cartoes.find(c => c.id === cartaoSel)
  const gastosDoCarto = gastos.filter(g => g.cartao_id === cartaoSel)
  const totalGastos = gastosDoCarto.reduce((s, g) => s + Number(g.valor), 0)
  const totalLimite = cartoes.reduce((s, c) => s + Number(c.limite), 0)
  const totalDisp = cartoes.reduce((s, c) => s + Number(c.limite_disponivel), 0)
  const totalUsado = totalLimite - totalDisp
  const usoPct = totalLimite > 0 ? (totalUsado / totalLimite) * 100 : 0

  const porCat = useMemo(() => {
    const m: Record<string, number> = {}
    gastosDoCarto.forEach(g => { const cat = g.categoria || 'Outros'; m[cat] = (m[cat] || 0) + Number(g.valor) })
    return Object.entries(m).map(([name, value]) => ({ name, value, color: CATS_CORES[name] || '#7B8C88' }))
  }, [gastosDoCarto])

  // Simular histórico mensal de gastos
  const historicoMeses = useMemo(() => {
    const meses = []
    for (let i = 4; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i)
      const label = d.toLocaleDateString('pt-BR', { month: 'short' })
      meses.push({ mes: label, valor: totalGastos * (0.6 + Math.random() * 0.8) })
    }
    meses[meses.length - 1].valor = totalGastos
    return meses
  }, [totalGastos])

  return (
    <>
      <VoltarSolucao href="/dashboard/banco/cartoes" label="Banco" />
      {/* Header */}
      <div className="page-hdr">
        <div>
          <div className="page-title">Cartões</div>
          <div className="page-sub">Cartões corporativos e virtuais · limites por colaborador · faturas e gastos</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {cartaoSel && (
            <button className="btn-ghost" style={{ fontSize: 14 }} onClick={() => setModalGasto(true)}>
              <i className="fa-solid fa-plus" style={{ marginRight: 6 }} />Registrar gasto
            </button>
          )}
          <button className="btn-action" style={{ fontSize: 14 }} onClick={() => setModalCartao(true)}>
            <i className="fa-solid fa-credit-card" style={{ marginRight: 6 }} />Novo cartão
          </button>
        </div>
      </div>

      {/* KPIs globais */}
      <div className="kpis" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 16 }}>
        <div className="kpi" style={{ borderTop: '3px solid #13201D' }}>
          <div className="kpi-lbl">Limite total
            <div style={{ width: 28, height: 28, borderRadius: 8, background: '#F1ECE1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa-solid fa-credit-card" style={{ fontSize: 14, color: '#13201D' }} />
            </div>
          </div>
          <div className="kpi-val">{formatBRL(totalLimite)}</div>
          <div className="kpi-delta">{cartoes.length} cartão{cartoes.length !== 1 ? 'ões' : ''}</div>
        </div>
        <div className="kpi" style={{ borderTop: `3px solid ${usoPct > 80 ? '#B0413E' : usoPct > 60 ? '#B08A3E' : '#3D7A6E'}` }}>
          <div className="kpi-lbl">Usado este mês
            <div style={{ width: 28, height: 28, borderRadius: 8, background: usoPct > 80 ? '#F4E4E1' : '#F3ECDA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa-solid fa-gauge-high" style={{ fontSize: 14, color: usoPct > 80 ? '#B0413E' : '#B08A3E' }} />
            </div>
          </div>
          <div className="kpi-val">{formatBRL(totalUsado)}</div>
          <div className={`kpi-delta ${usoPct > 80 ? 'dn' : usoPct > 60 ? 'warn' : 'up'}`}>{usoPct.toFixed(0)}% do limite</div>
        </div>
        <div className="kpi" style={{ borderTop: '3px solid #3D7A6E' }}>
          <div className="kpi-lbl">Disponível
            <div style={{ width: 28, height: 28, borderRadius: 8, background: '#E9F0ED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa-solid fa-circle-check" style={{ fontSize: 14, color: '#3D7A6E' }} />
            </div>
          </div>
          <div className="kpi-val">{formatBRL(totalDisp)}</div>
          <div className="kpi-delta up">disponível agora</div>
        </div>
        <div className="kpi" style={{ borderTop: '3px solid #7A6A9E' }}>
          <div className="kpi-lbl">Transações
            <div style={{ width: 28, height: 28, borderRadius: 8, background: '#F3F0FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa-solid fa-receipt" style={{ fontSize: 14, color: '#7A6A9E' }} />
            </div>
          </div>
          <div className="kpi-val">{gastos.length}</div>
          <div className="kpi-delta">lançamentos</div>
        </div>
      </div>

      {/* Se não tem cartão */}
      {cartoes.length === 0 && !loading && (
        <div style={{ background: '#fff', border: '1.5px dashed #D1D9D8', borderRadius: 16, padding: '60px 40px', textAlign: 'center' }}>
          <div style={{ width: 60, height: 60, borderRadius: 16, background: '#13201D', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <i className="fa-solid fa-credit-card" style={{ fontSize: 26, color: '#6FA595' }} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#13201D', marginBottom: 8, fontFamily: "var(--font-sans)" }}>Nenhum cartão cadastrado</div>
          <div style={{ fontSize: 14, color: '#7B8C88', marginBottom: 20, lineHeight: 1.6 }}>Adicione seus cartões corporativos para gerenciar limites, faturas e gastos por categoria.</div>
          <button className="btn-action" onClick={() => setModalCartao(true)}>
            <i className="fa-solid fa-plus" style={{ marginRight: 6 }} />Adicionar cartão
          </button>
        </div>
      )}

      {cartoes.length > 0 && (
        <>
          {/* Seletor de cartão — estilo visual de cartão físico */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
            {cartoes.map(c => {
              const isSelected = cartaoSel === c.id
              const usoPctCartao = Number(c.limite) > 0 ? ((Number(c.limite) - Number(c.limite_disponivel)) / Number(c.limite)) * 100 : 0
              return (
                <div key={c.id} onClick={() => setCartaoSel(c.id)} style={{
                  minWidth: 220, height: 130, borderRadius: 16, padding: '16px 18px',
                  background: `linear-gradient(135deg, ${c.cor} 0%, ${c.cor}cc 100%)`,
                  cursor: 'pointer', flexShrink: 0, position: 'relative', overflow: 'hidden',
                  opacity: c.pausado ? 0.5 : 1,
                  border: isSelected ? `2px solid #6FA595` : '2px solid transparent',
                  boxShadow: isSelected ? `0 8px 24px ${c.cor}55` : '0 4px 12px rgba(0,0,0,0.15)',
                  transition: 'all 0.2s',
                }}>
                  <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
                  <div style={{ position: 'absolute', bottom: -10, left: -10, width: 60, height: 60, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{c.bandeira}</span>
                    <span style={{ display: 'flex', gap: 5 }}>
                      {c.pausado && <span style={{ fontSize: 11, fontWeight: 800, color: '#FFB3B3', background: 'rgba(0,0,0,0.25)', padding: '2px 6px', borderRadius: 20, letterSpacing: '.05em' }}>PAUSADO</span>}
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', background: 'rgba(255,255,255,0.18)', padding: '2px 6px', borderRadius: 20, letterSpacing: '.05em' }}>
                        {c.formato === 'virtual' ? 'VIRTUAL' : 'FÍSICO'}
                      </span>
                    </span>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', fontFamily: "var(--font-sans)" }}>{c.nome}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 10, minHeight: 12 }}>{c.titular_nome ? `👤 ${c.titular_nome}` : 'Sem titular'}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: 2 }}>DISPONÍVEL</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', fontFamily: "var(--font-sans)" }}>{formatBRL(Number(c.limite_disponivel))}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: 2 }}>USO</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: usoPctCartao > 80 ? '#FFB3B3' : '#fff' }}>{usoPctCartao.toFixed(0)}%</div>
                    </div>
                  </div>
                </div>
              )
            })}
            <div onClick={() => setModalCartao(true)} style={{
              minWidth: 120, height: 130, borderRadius: 16, border: '1.5px dashed #D1D9D8',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0, gap: 8, background: '#FBF8F1', transition: 'all 0.15s',
            }}
              onMouseOver={e => (e.currentTarget.style.borderColor = '#3D7A6E')}
              onMouseOut={e => (e.currentTarget.style.borderColor = '#D1D9D8')}
            >
              <i className="fa-solid fa-plus" style={{ fontSize: 18, color: '#C4CFCE' }} />
              <span style={{ fontSize: 13, color: '#7B8C88', fontWeight: 600 }}>Novo cartão</span>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 2, background: '#F1ECE1', padding: 3, borderRadius: 10, width: 'fit-content', marginBottom: 16 }}>
            {([
              { key: 'visao', label: 'Visão Geral', icon: 'fa-chart-pie' },
              { key: 'gastos', label: 'Gastos', icon: 'fa-receipt' },
              { key: 'fatura', label: 'Fatura', icon: 'fa-file-invoice' },
              { key: 'limites', label: 'Limites', icon: 'fa-gauge-high' },
              { key: 'equipe', label: 'Equipe', icon: 'fa-users' },
            ] as { key: Tab; label: string; icon: string }[]).map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 13, fontWeight: tab === t.key ? 700 : 500,
                padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: tab === t.key ? '#fff' : 'transparent',
                color: tab === t.key ? '#13201D' : '#7B8C88',
                transition: 'all 0.15s',
              }}>
                <i className={`fa-solid ${t.icon}`} style={{ fontSize: 12 }} />{t.label}
              </button>
            ))}
          </div>

          {/* VISÃO GERAL */}
          {tab === 'visao' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {/* Uso por categoria (donut) */}
              <div style={{ background: '#fff', border: '0.5px solid #E4DCCC', borderRadius: 14, padding: '16px 18px' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#13201D', marginBottom: 14, fontFamily: "var(--font-sans)" }}>Gastos por categoria</div>
                {porCat.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px 0', color: '#A6B0AC', fontSize: 14 }}>Nenhum gasto neste cartão</div>
                ) : (
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    <ResponsiveContainer width={140} height={140}>
                      <PieChart>
                        <Pie data={porCat} cx="50%" cy="50%" innerRadius={38} outerRadius={65} dataKey="value" stroke="none">
                          {porCat.map((e, i) => <Cell key={i} fill={e.color} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => formatBRL(v)} contentStyle={{ fontSize: 13, borderRadius: 8, border: '0.5px solid #E4DCCC' }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {porCat.sort((a, b) => b.value - a.value).map(c => (
                        <div key={c.name}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 2 }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600, color: '#13201D' }}>
                              <span style={{ width: 8, height: 8, borderRadius: 2, background: c.color, display: 'inline-block' }} />{c.name}
                            </span>
                            <span style={{ color: '#7B8C88' }}>{formatBRL(c.value)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Histórico */}
              <div style={{ background: '#fff', border: '0.5px solid #E4DCCC', borderRadius: 14, padding: '16px 18px' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#13201D', marginBottom: 14, fontFamily: "var(--font-sans)" }}>Histórico de gastos</div>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={historicoMeses} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barSize={28}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EFE9DC" vertical={false} />
                    <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#7B8C88' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#A6B0AC' }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}K`} width={40} />
                    <Tooltip formatter={(v: number) => [formatBRL(v), 'Gastos']} contentStyle={{ fontSize: 13, borderRadius: 8, border: '0.5px solid #E4DCCC' }} />
                    <Bar dataKey="valor" fill="#13201D" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Info do cartão selecionado */}
              {cartaoAtual && (
                <div style={{ background: '#fff', border: '0.5px solid #E4DCCC', borderRadius: 14, padding: '16px 18px', gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#13201D', marginBottom: 14, fontFamily: "var(--font-sans)" }}>Detalhes — {cartaoAtual.nome}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
                    {[
                      { label: 'Limite total', val: formatBRL(Number(cartaoAtual.limite)) },
                      { label: 'Disponível', val: formatBRL(Number(cartaoAtual.limite_disponivel)), cor: '#3D7A6E' },
                      { label: 'Fechamento', val: `Dia ${cartaoAtual.fechamento_dia}` },
                      { label: 'Vencimento', val: `Dia ${cartaoAtual.vencimento_dia}` },
                    ].map(item => (
                      <div key={item.label} style={{ background: '#FBF8F1', borderRadius: 10, padding: '10px 12px' }}>
                        <div style={{ fontSize: 12, color: '#7B8C88', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: item.cor || '#13201D', fontFamily: "var(--font-sans)" }}>{item.val}</div>
                      </div>
                    ))}
                  </div>
                  {/* Barra de uso */}
                  <div style={{ marginTop: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                      <span style={{ fontWeight: 600, color: '#13201D' }}>Uso do limite</span>
                      <span style={{ color: '#7B8C88' }}>{formatBRL(Number(cartaoAtual.limite) - Number(cartaoAtual.limite_disponivel))} de {formatBRL(Number(cartaoAtual.limite))}</span>
                    </div>
                    <div style={{ height: 8, background: '#F1ECE1', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 99, transition: 'width 0.4s',
                        width: `${((Number(cartaoAtual.limite) - Number(cartaoAtual.limite_disponivel)) / Math.max(1, Number(cartaoAtual.limite))) * 100}%`,
                        background: usoPct > 80 ? '#B0413E' : usoPct > 60 ? '#B08A3E' : '#3D7A6E',
                      }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* GASTOS */}
          {tab === 'gastos' && (
            <div style={{ background: '#fff', border: '0.5px solid #E4DCCC', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #E4DCCC', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FBF8F1' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#13201D', fontFamily: "var(--font-sans)" }}>
                  Lançamentos · {cartaoAtual?.nome} · {formatBRL(totalGastos)} total
                </div>
                <button className="btn-action" style={{ fontSize: 13, padding: '5px 12px' }} onClick={() => setModalGasto(true)}>
                  <i className="fa-solid fa-plus" style={{ marginRight: 5 }} />Novo gasto
                </button>
              </div>
              {/* Header tabela */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 100px 90px 90px', padding: '9px 16px', background: '#FBF8F1', borderBottom: '0.5px solid #E4DCCC' }}>
                {['Data', 'Descrição', 'Categoria', 'Parcelas', 'Valor'].map(h => (
                  <div key={h} style={{ fontSize: 12, fontWeight: 600, color: '#7B8C88', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</div>
                ))}
              </div>
              {gastosDoCarto.length === 0 ? (
                <div style={{ padding: '40px 16px', textAlign: 'center', color: '#7B8C88', fontSize: 14 }}>Nenhum gasto registrado neste cartão.</div>
              ) : gastosDoCarto.map((g, i) => (
                <div key={g.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 100px 90px 90px', padding: '11px 16px', borderBottom: i < gastosDoCarto.length - 1 ? '0.5px solid #EFE9DC' : 'none', alignItems: 'center' }}>
                  <div style={{ fontSize: 13, color: '#7B8C88' }}>{new Date(g.data + 'T12:00:00').toLocaleDateString('pt-BR')}</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#13201D' }}>{g.descricao}</div>
                    {g.estabelecimento && <div style={{ fontSize: 12, color: '#7B8C88' }}>{g.estabelecimento}</div>}
                  </div>
                  <div>
                    <span style={{ fontSize: 12, padding: '2px 7px', borderRadius: 20, background: `${CATS_CORES[g.categoria || 'Outros'] || '#7B8C88'}18`, color: CATS_CORES[g.categoria || 'Outros'] || '#7B8C88', fontWeight: 600 }}>{g.categoria || 'Outros'}</span>
                  </div>
                  <div style={{ fontSize: 13, color: '#7B8C88' }}>
                    {g.parcelas && g.parcelas > 1 ? `${g.parcela_atual || 1}/${g.parcelas}x` : 'À vista'}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#B0413E', fontFamily: "var(--font-sans)" }}>{formatBRL(Number(g.valor))}</div>
                </div>
              ))}
            </div>
          )}

          {/* FATURA — ciclo aberta / fechada / paga */}
          {tab === 'fatura' && cartaoAtual && (() => {
            const fechDia = cartaoAtual.fechamento_dia || 1
            const hoje = new Date(); hoje.setHours(12, 0, 0, 0)
            const grupos: Record<string, Gasto[]> = {}
            gastosDoCarto.forEach(g => { const c = competenciaFatura(g.data, fechDia); if (c) { if (!grupos[c]) grupos[c] = []; grupos[c].push(g) } })
            const faturas = Object.keys(grupos).sort().reverse().map(comp => {
              const itens = grupos[comp]
              const total = itens.reduce((s, g) => s + Number(g.valor || 0), 0)
              const fech = fechamentoDate(comp, fechDia)
              const paga = paidSet.has(`${cartaoAtual.id}|${comp}`)
              const status: 'aberta' | 'fechada' | 'paga' = paga ? 'paga' : (fech < hoje ? 'fechada' : 'aberta')
              return { comp, itens, total, fech, status }
            })
            const aberta = faturas.find(f => f.status === 'aberta')
            const fechadas = faturas.filter(f => f.status !== 'aberta')
            const limite = Number(cartaoAtual.limite || 0)
            return (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 12, alignItems: 'start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* ABERTA */}
                  <div style={{ background: '#fff', border: '0.5px solid #E4DCCC', borderRadius: 14, overflow: 'hidden' }}>
                    <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #E4DCCC', background: '#FBF8F1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#13201D', textTransform: 'capitalize' }}>Fatura aberta{aberta ? ` · ${labelComp(aberta.comp)}` : ''}</div>
                      <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: '#F3ECDA', color: '#B08A3E' }}>ABERTA</span>
                    </div>
                    {!aberta || aberta.itens.length === 0 ? (
                      <div style={{ padding: '28px 16px', textAlign: 'center', color: '#A6B0AC', fontSize: 14 }}>Nenhum lançamento na fatura aberta.</div>
                    ) : aberta.itens.map((g, i) => (
                      <div key={g.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: i < aberta.itens.length - 1 ? '0.5px solid #EFE9DC' : 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 30, height: 30, borderRadius: 8, background: `${CATS_CORES[g.categoria || 'Outros'] || '#7B8C88'}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <i className="fa-solid fa-receipt" style={{ fontSize: 14, color: CATS_CORES[g.categoria || 'Outros'] || '#7B8C88' }} />
                          </div>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: '#13201D' }}>{g.descricao}</div>
                            <div style={{ fontSize: 12, color: '#7B8C88' }}>{new Date(g.data + 'T12:00:00').toLocaleDateString('pt-BR')} · {g.categoria || 'Outros'}</div>
                          </div>
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#13201D', fontFamily: "var(--font-sans)" }}>{formatBRL(Number(g.valor))}</div>
                      </div>
                    ))}
                  </div>

                  {/* FECHADAS / PAGAS */}
                  {fechadas.length > 0 && (
                    <div style={{ background: '#fff', border: '0.5px solid #E4DCCC', borderRadius: 14, overflow: 'hidden' }}>
                      <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #E4DCCC', background: '#FBF8F1', fontSize: 14, fontWeight: 700, color: '#13201D' }}>Faturas anteriores</div>
                      {fechadas.map((f, i) => (
                        <div key={f.comp} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: i < fechadas.length - 1 ? '0.5px solid #EFE9DC' : 'none' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14.5, fontWeight: 600, color: '#13201D', textTransform: 'capitalize' }}>{labelComp(f.comp)}</div>
                            <div style={{ fontSize: 12, color: '#7B8C88' }}>{f.itens.length} lançamento{f.itens.length !== 1 ? 's' : ''} · fechou {f.fech.toLocaleDateString('pt-BR')}</div>
                          </div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: '#13201D', fontFamily: "var(--font-sans)" }}>{formatBRL(f.total)}</div>
                          {f.status === 'paga' ? (
                            <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: '#E9F0ED', color: '#2B564D' }}><i className="fa-solid fa-check" style={{ marginRight: 4 }} />Paga</span>
                          ) : (
                            <button onClick={() => void pagarFatura(f.comp, f.total)} style={{ fontSize: 13, fontWeight: 700, padding: '5px 12px', borderRadius: 8, border: 'none', background: '#13201D', color: '#fff', cursor: 'pointer' }}>Pagar</button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Resumo lateral */}
                <div style={{ background: '#13201D', borderRadius: 14, padding: '18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#6FA595', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Fatura aberta</div>
                  {[
                    { label: 'Total parcial', val: formatBRL(aberta?.total ?? 0), cor: '#fff', size: 22 },
                    { label: 'Fecha em', val: aberta ? aberta.fech.toLocaleDateString('pt-BR') : `Dia ${fechDia}`, cor: 'rgba(255,255,255,0.7)', size: 13 },
                    { label: 'Vencimento', val: `Dia ${cartaoAtual.vencimento_dia}`, cor: 'rgba(255,255,255,0.7)', size: 13 },
                  ].map(item => (
                    <div key={item.label} style={{ borderBottom: '0.5px solid rgba(255,255,255,0.08)', paddingBottom: 12 }}>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 4 }}>{item.label}</div>
                      <div style={{ fontSize: item.size, fontWeight: 700, color: item.cor, fontFamily: "var(--font-sans)" }}>{item.val}</div>
                    </div>
                  ))}
                  {limite > 0 && (
                    <div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>Uso do limite · {((aberta?.total ?? 0) / limite * 100).toFixed(0)}%</div>
                      <div style={{ height: 7, background: 'rgba(255,255,255,0.12)', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(100, (aberta?.total ?? 0) / limite * 100)}%`, background: '#3D7A6E', borderRadius: 99 }} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })()}

          {/* LIMITES */}
          {tab === 'limites' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {cartoes.map(c => {
                const usado = Number(c.limite) - Number(c.limite_disponivel)
                const pct = Number(c.limite) > 0 ? (usado / Number(c.limite)) * 100 : 0
                const cor = pct > 80 ? '#B0413E' : pct > 60 ? '#B08A3E' : '#3D7A6E'
                return (
                  <div key={c.id} style={{ background: '#fff', border: `0.5px solid ${c.id === cartaoSel ? '#3D7A6E' : '#E4DCCC'}`, borderRadius: 12, padding: '16px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 9, background: c.cor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <i className="fa-solid fa-credit-card" style={{ fontSize: 15, color: '#fff' }} />
                        </div>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: '#13201D' }}>{c.nome}</div>
                          <div style={{ fontSize: 12, color: '#7B8C88' }}>{c.bandeira} · Vence dia {c.vencimento_dia}</div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: cor, fontFamily: "var(--font-sans)" }}>{pct.toFixed(0)}% usado</div>
                        <div style={{ fontSize: 13, color: '#7B8C88' }}>{formatBRL(usado)} de {formatBRL(Number(c.limite))}</div>
                      </div>
                    </div>
                    <div style={{ height: 10, background: '#F1ECE1', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: cor, borderRadius: 99, transition: 'width 0.4s' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12 }}>
                      <span style={{ color: '#7B8C88' }}>Disponível: <strong style={{ color: '#13201D' }}>{formatBRL(Number(c.limite_disponivel))}</strong></span>
                      {pct > 80 && <span style={{ color: '#B0413E', fontWeight: 600 }}>⚠ Acima de 80% — considere pagar a fatura</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* EQUIPE — gestão por colaborador (modelo Clara / Conta Simples) */}
          {tab === 'equipe' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 13, color: '#7B8C88', display: 'flex', alignItems: 'center', gap: 6 }}>
                <i className="fa-solid fa-circle-info" style={{ color: '#3D7A6E' }} />
                Cada cartão pode ser vinculado a um colaborador com limite próprio. Pause ou ajuste o limite a qualquer momento.
              </div>
              {cartoes.map(c => {
                const usado = Number(c.limite) - Number(c.limite_disponivel)
                const pct = Number(c.limite) > 0 ? (usado / Number(c.limite)) * 100 : 0
                const cor = pct > 80 ? '#B0413E' : pct > 60 ? '#B08A3E' : '#3D7A6E'
                return (
                  <div key={c.id} style={{ background: '#fff', border: '0.5px solid #E4DCCC', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', opacity: c.pausado ? 0.65 : 1 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: c.cor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <i className={`fa-solid ${c.formato === 'virtual' ? 'fa-wifi' : 'fa-credit-card'}`} style={{ fontSize: 16, color: '#fff' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#13201D' }}>{c.titular_nome || 'Sem titular'}</div>
                      <div style={{ fontSize: 13, color: '#7B8C88' }}>{c.nome} · {c.formato === 'virtual' ? 'Virtual' : 'Físico'}{c.titular_email ? ` · ${c.titular_email}` : ''}</div>
                    </div>
                    <div style={{ minWidth: 150 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
                        <span style={{ color: '#7B8C88' }}>{formatBRL(usado)} de {formatBRL(Number(c.limite))}</span>
                        <span style={{ fontWeight: 700, color: cor }}>{pct.toFixed(0)}%</span>
                      </div>
                      <div style={{ height: 7, background: '#F1ECE1', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: cor, borderRadius: 99 }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => { const v = prompt(`Novo limite para ${c.nome} (R$):`, String(c.limite)); if (v) void ajustarLimite(c, Number(v)) }} style={{ fontSize: 13, padding: '6px 12px', borderRadius: 8, border: '0.5px solid #E4DCCC', background: '#fff', color: '#3C4A46', cursor: 'pointer', fontWeight: 600 }}>
                        <i className="fa-solid fa-sliders" style={{ marginRight: 5 }} />Limite
                      </button>
                      <button onClick={() => void togglePausar(c)} style={{ fontSize: 13, padding: '6px 12px', borderRadius: 8, border: 'none', background: c.pausado ? '#E9F0ED' : '#F4E4E1', color: c.pausado ? '#2B564D' : '#B0413E', cursor: 'pointer', fontWeight: 700 }}>
                        <i className={`fa-solid ${c.pausado ? 'fa-play' : 'fa-pause'}`} style={{ marginRight: 5 }} />{c.pausado ? 'Reativar' : 'Pausar'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Modal Novo Cartão */}
      {modalCartao && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setModalCartao(false)}>
          <div className="modal-box">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <div><h3 className="modal-title">Novo cartão</h3><div style={{ fontSize: 13, color: '#7B8C88' }}>Cadastre um cartão corporativo</div></div>
              <button className="modal-close" onClick={() => setModalCartao(false)}><i className="fa-solid fa-xmark" /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: 'Nome do cartão *', field: 'nome', placeholder: 'Ex: Nubank PJ, Itaú Empresarial' },
              ].map(f => (
                <div key={f.field}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#7B8C88', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{f.label}</label>
                  <input className="form-input" placeholder={f.placeholder} value={(formCartao as Record<string, string>)[f.field]} onChange={e => setFormCartao(p => ({ ...p, [f.field]: e.target.value }))} />
                </div>
              ))}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#7B8C88', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Tipo do cartão</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[{ v: 'fisico', l: 'Físico', i: 'fa-credit-card' }, { v: 'virtual', l: 'Virtual', i: 'fa-wifi' }].map(o => (
                    <button key={o.v} onClick={() => setFormCartao(p => ({ ...p, formato: o.v }))} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '9px', borderRadius: 9, border: formCartao.formato === o.v ? '1px solid #3D7A6E' : '0.5px solid #E4DCCC', background: formCartao.formato === o.v ? '#E9F0ED' : '#fff', color: formCartao.formato === o.v ? '#2B564D' : '#7B8C88', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                      <i className={`fa-solid ${o.i}`} />{o.l}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#7B8C88', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Titular (colaborador)</label>
                  <input className="form-input" placeholder="Nome do colaborador" value={formCartao.titular_nome} onChange={e => setFormCartao(p => ({ ...p, titular_nome: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#7B8C88', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>E-mail do titular</label>
                  <input className="form-input" type="email" placeholder="colaborador@empresa.com" value={formCartao.titular_email} onChange={e => setFormCartao(p => ({ ...p, titular_email: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#7B8C88', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Bandeira</label>
                  <select className="form-input" value={formCartao.bandeira} onChange={e => setFormCartao(p => ({ ...p, bandeira: e.target.value }))}>
                    {['Visa', 'Mastercard', 'Elo', 'Amex'].map(b => <option key={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#7B8C88', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Limite (R$) *</label>
                  <input className="form-input" type="number" placeholder="5000" value={formCartao.limite} onChange={e => setFormCartao(p => ({ ...p, limite: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#7B8C88', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Fechamento (dia)</label>
                  <input className="form-input" type="number" min="1" max="31" value={formCartao.fechamento_dia} onChange={e => setFormCartao(p => ({ ...p, fechamento_dia: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#7B8C88', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Vencimento (dia)</label>
                  <input className="form-input" type="number" min="1" max="31" value={formCartao.vencimento_dia} onChange={e => setFormCartao(p => ({ ...p, vencimento_dia: e.target.value }))} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#7B8C88', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Cor do cartão</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {CORES_CARTAO.map(cor => (
                    <div key={cor} onClick={() => setFormCartao(p => ({ ...p, cor }))} style={{ width: 28, height: 28, borderRadius: 7, background: cor, cursor: 'pointer', border: formCartao.cor === cor ? '2px solid #3D7A6E' : '2px solid transparent', transition: 'all 0.15s' }} />
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
              <button onClick={() => setModalCartao(false)} style={{ padding: '8px 16px', borderRadius: 8, border: '0.5px solid #E4DCCC', background: 'transparent', color: '#7B8C88', fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
              <button className="btn-action" onClick={() => void salvarCartao()} disabled={saving} style={{ fontSize: 14, padding: '8px 20px' }}>{saving ? 'Salvando...' : 'Criar cartão'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Novo Gasto */}
      {modalGasto && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setModalGasto(false)}>
          <div className="modal-box">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <div><h3 className="modal-title">Registrar gasto</h3><div style={{ fontSize: 13, color: '#7B8C88' }}>Lançar no cartão: {cartaoAtual?.nome}</div></div>
              <button className="modal-close" onClick={() => setModalGasto(false)}><i className="fa-solid fa-xmark" /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#7B8C88', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Descrição *</label>
                <input className="form-input" placeholder="Ex: Almoço com cliente" value={formGasto.descricao} onChange={e => setFormGasto(p => ({ ...p, descricao: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#7B8C88', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Valor (R$) *</label>
                  <input className="form-input" type="number" placeholder="0.00" value={formGasto.valor} onChange={e => setFormGasto(p => ({ ...p, valor: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#7B8C88', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Categoria</label>
                  <select className="form-input" value={formGasto.categoria} onChange={e => setFormGasto(p => ({ ...p, categoria: e.target.value }))}>
                    {Object.keys(CATS_CORES).map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#7B8C88', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Data</label>
                  <input className="form-input" type="date" value={formGasto.data} onChange={e => setFormGasto(p => ({ ...p, data: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#7B8C88', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Parcelas</label>
                  <select className="form-input" value={formGasto.parcelas} onChange={e => setFormGasto(p => ({ ...p, parcelas: e.target.value }))}>
                    {[1,2,3,4,5,6,8,10,12,18,24].map(n => <option key={n} value={n}>{n === 1 ? 'À vista' : `${n}x`}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#7B8C88', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Estabelecimento</label>
                <input className="form-input" placeholder="Ex: iFood, Amazon, Posto Shell" value={formGasto.estabelecimento} onChange={e => setFormGasto(p => ({ ...p, estabelecimento: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
              <button onClick={() => setModalGasto(false)} style={{ padding: '8px 16px', borderRadius: 8, border: '0.5px solid #E4DCCC', background: 'transparent', color: '#7B8C88', fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
              <button className="btn-action" onClick={() => void salvarGasto()} disabled={saving} style={{ fontSize: 14, padding: '8px 20px' }}>{saving ? 'Salvando...' : 'Registrar'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
