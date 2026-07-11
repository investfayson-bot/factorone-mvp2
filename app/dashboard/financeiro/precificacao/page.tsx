'use client'

import { useEffect, useMemo, useState } from 'react'
import { formatBRL, parseBRLInput } from '@/lib/currency-brl'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

type Produto = {
  id: string; nome: string; unidade: string
  custo_insumo: number; mao_obra: number; despesas_fixas_rateadas: number
  producao_mensal_estimada: number; impostos_pct: number; comissao_pct: number; margem_pct: number
  preco_sugerido: number
}

type Form = {
  nome: string; unidade: string
  custo_insumo: string; mao_obra: string; despesas_fixas_rateadas: string
  producao_mensal_estimada: string; impostos_pct: string; comissao_pct: string; margem_pct: string
}

// A unidade muda TODA a conta (sufixos, ponto de equilíbrio) — quem vende
// por peso precifica o kg, não a hora. Rótulos por extenso pra ficar óbvio
// que dá pra escolher (o "Unidade: hora" antigo passava batido).
const UNIDADES: { valor: string; rotulo: string }[] = [
  { valor: 'hora', rotulo: 'por hora' },
  { valor: 'item', rotulo: 'por item / unidade' },
  { valor: 'kg', rotulo: 'por peso (kg)' },
  { valor: 'L', rotulo: 'por litro (L)' },
  { valor: 'm', rotulo: 'por metro (m)' },
]

const FORM_VAZIO: Form = {
  nome: '', unidade: 'hora',
  custo_insumo: '', mao_obra: '', despesas_fixas_rateadas: '',
  producao_mensal_estimada: '30', impostos_pct: '6', comissao_pct: '0', margem_pct: '35',
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const t = data.session?.access_token
  return t ? { Authorization: `Bearer ${t}` } : {}
}

function pct(s: string): number {
  const n = Number(String(s).replace(',', '.'))
  return Number.isFinite(n) ? n / 100 : 0
}

function calcular(form: Form) {
  const insumo = parseBRLInput(form.custo_insumo)
  const maoObra = parseBRLInput(form.mao_obra)
  const fixas = parseBRLInput(form.despesas_fixas_rateadas)
  const producao = Math.max(0, Number(form.producao_mensal_estimada) || 0)
  const impostosPct = pct(form.impostos_pct)
  const comissaoPct = pct(form.comissao_pct)
  const margemPct = pct(form.margem_pct)

  const custoDireto = insumo + maoObra
  const custoTotalAntes = custoDireto + fixas
  const denom = 1 - impostosPct - comissaoPct - margemPct
  const invalido = denom <= 0
  const preco = invalido ? 0 : custoTotalAntes / denom
  const impostosValor = preco * impostosPct
  const comissaoValor = preco * comissaoPct
  const margemValor = preco * margemPct
  const lucroAntesFixas = margemValor + fixas
  const lucroDepoisFixas = margemValor
  const margemContribuicao = preco - custoDireto - impostosValor - comissaoValor
  const custoFixoTotal = fixas * producao
  // margemContribuicao <= 0 com custo fixo a recuperar = nunca atinge o equilíbrio (não é "0 unidades")
  const pontoEquilibrio = invalido
    ? null
    : margemContribuicao > 0
      ? custoFixoTotal / margemContribuicao
      : custoFixoTotal > 0 ? Infinity : 0
  const markup = custoTotalAntes > 0 ? ((preco / custoTotalAntes) - 1) * 100 : 0

  return { custoDireto, custoTotalAntes, impostosValor, comissaoValor, margemValor, preco, lucroAntesFixas, lucroDepoisFixas, pontoEquilibrio, markup, invalido, margemContribuicao }
}

function unidadeSufixo(u: string) {
  return u === 'item' ? '/item' : u === 'hora' ? '/hora' : `/${u}`
}

export default function PrecificacaoPage() {
  const [subTab, setSubTab] = useState<'calculadora' | 'salvos' | 'comparar'>('calculadora')
  const [form, setForm] = useState<Form>(FORM_VAZIO)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [selecionados, setSelecionados] = useState<string[]>([])

  const calc = useMemo(() => calcular(form), [form])

  async function carregar() {
    setLoading(true)
    try {
      const h = await authHeaders()
      const r = await fetch('/api/precificacao', { headers: h }).then(x => x.json()).catch(() => ({ data: [] }))
      setProdutos((r.data || []) as Produto[])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void carregar() }, [])

  function set<K extends keyof Form>(k: K, v: string) {
    setForm(f => ({ ...f, [k]: v }))
  }

  function novoCalculo() {
    setForm(FORM_VAZIO)
    setEditandoId(null)
    setSubTab('calculadora')
  }

  function carregarProduto(p: Produto) {
    setForm({
      nome: p.nome, unidade: p.unidade,
      custo_insumo: String(p.custo_insumo).replace('.', ','),
      mao_obra: String(p.mao_obra).replace('.', ','),
      despesas_fixas_rateadas: String(p.despesas_fixas_rateadas).replace('.', ','),
      producao_mensal_estimada: String(p.producao_mensal_estimada),
      impostos_pct: String(p.impostos_pct).replace('.', ','),
      comissao_pct: String(p.comissao_pct).replace('.', ','),
      margem_pct: String(p.margem_pct).replace('.', ','),
    })
    setEditandoId(p.id)
    setSubTab('calculadora')
  }

  async function salvar() {
    if (!form.nome.trim()) { toast.error('Dê um nome para o produto/serviço'); return }
    setSalvando(true)
    try {
      const h = await authHeaders()
      const body = JSON.stringify({
        nome: form.nome,
        unidade: form.unidade,
        custo_insumo: parseBRLInput(form.custo_insumo),
        mao_obra: parseBRLInput(form.mao_obra),
        despesas_fixas_rateadas: parseBRLInput(form.despesas_fixas_rateadas),
        producao_mensal_estimada: Number(form.producao_mensal_estimada) || 1,
        impostos_pct: Number(String(form.impostos_pct).replace(',', '.')) || 0,
        comissao_pct: Number(String(form.comissao_pct).replace(',', '.')) || 0,
        margem_pct: Number(String(form.margem_pct).replace(',', '.')) || 0,
        preco_sugerido: calc.preco,
      })
      const url = editandoId ? `/api/precificacao/${editandoId}` : '/api/precificacao'
      const method = editandoId ? 'PUT' : 'POST'
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json', ...h }, body })
      if (!r.ok) { toast.error('Falha ao salvar'); return }
      toast.success('Cálculo salvo')
      await carregar()
      setSubTab('salvos')
    } finally {
      setSalvando(false)
    }
  }

  async function excluir(id: string) {
    const h = await authHeaders()
    await fetch(`/api/precificacao/${id}`, { method: 'DELETE', headers: h })
    setProdutos(prev => prev.filter(p => p.id !== id))
    setSelecionados(prev => prev.filter(x => x !== id))
  }

  function toggleSelecionado(id: string) {
    setSelecionados(prev => prev.includes(id) ? prev.filter(x => x !== id) : prev.length >= 3 ? prev : [...prev, id])
  }

  const comparando = produtos.filter(p => selecionados.includes(p.id))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div className="pill-sel-v2">
          <span className={subTab === 'calculadora' ? 'on' : ''} onClick={() => setSubTab('calculadora')}>Calculadora</span>
          <span className={subTab === 'salvos' ? 'on' : ''} onClick={() => setSubTab('salvos')}>Produtos salvos ({produtos.length})</span>
          <span className={subTab === 'comparar' ? 'on' : ''} onClick={() => setSubTab('comparar')}>Comparar cenários</span>
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn-v2 primary" onClick={novoCalculo}>+ Novo cálculo</button>
      </div>

      {subTab === 'calculadora' && (
        <div className="split" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'start' }}>
          <div className="card-v2">
            <div className="card-v2-h">
              <input
                placeholder="Nome do produto/serviço (ex: Consultoria por hora)"
                value={form.nome}
                onChange={e => set('nome', e.target.value)}
                style={{ border: 'none', fontSize: 13.5, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", outline: 'none', flex: 1 }}
              />
              <select
                className="form-input"
                title="Como você cobra: por hora, por item, por peso…"
                style={{ width: 'auto', padding: '5px 10px', fontSize: 12, fontWeight: 700, color: 'var(--acc-ink)', background: 'var(--acc-soft)', border: '1px solid var(--acc)', borderRadius: 8, cursor: 'pointer' }}
                value={form.unidade}
                onChange={e => set('unidade', e.target.value)}
              >
                {UNIDADES.map(u => <option key={u.valor} value={u.valor}>Cobrar {u.rotulo}</option>)}
              </select>
            </div>
            {[
              { k: 'custo_insumo' as const, label: 'Custo de matéria-prima / insumo', small: 'Por unidade (kg, L, m, item ou hora)', tipo: 'valor' },
              { k: 'mao_obra' as const, label: 'Mão de obra direta', small: 'Tempo dedicado por unidade', tipo: 'valor' },
              { k: 'despesas_fixas_rateadas' as const, label: 'Despesas fixas rateadas', small: 'Aluguel, sistemas, admin ÷ produção mensal', tipo: 'valor' },
              { k: 'producao_mensal_estimada' as const, label: 'Produção mensal estimada', small: 'Quantas unidades por mês (base do rateio acima)', tipo: 'numero' },
              { k: 'impostos_pct' as const, label: 'Impostos sobre a venda', small: 'Alíquota efetiva do regime atual', tipo: 'pct' },
              { k: 'comissao_pct' as const, label: 'Comissão / taxa de cartão', small: 'Se aplicável', tipo: 'pct' },
              { k: 'margem_pct' as const, label: 'Margem de lucro desejada', small: 'Sobre o preço final', tipo: 'pct' },
            ].map(f => (
              <div key={f.k} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 60px', gap: 8, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--bg)' }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>
                  {f.label}
                  <small style={{ fontSize: 10, color: 'var(--mut2)', fontWeight: 600, display: 'block' }}>{f.small}</small>
                </label>
                <input
                  className="form-input"
                  style={{ textAlign: 'right', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 12.5 }}
                  value={form[f.k]}
                  onChange={e => set(f.k, e.target.value)}
                  placeholder={f.tipo === 'pct' ? '0,0' : f.tipo === 'numero' ? '1' : '0,00'}
                />
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--mut)', textAlign: 'center' }}>
                  {f.tipo === 'pct' ? '%' : f.tipo === 'numero' ? 'un/mês' : unidadeSufixo(form.unidade)}
                </span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: 'linear-gradient(135deg,#0C1D16,#143526)', borderRadius: 12, padding: 16, color: '#DCE7E0', textAlign: 'center' }}>
              <small style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', color: '#9DB0A6' }}>Preço de venda sugerido</small>
              {calc.invalido ? (
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, fontWeight: 700, color: '#FBBF24', margin: '10px 0' }}>
                  Impostos + comissão + margem somam 100% ou mais — ajuste os percentuais
                </div>
              ) : (
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 32, fontWeight: 700, color: '#4ADE80', margin: '5px 0' }}>
                  {formatBRL(calc.preco)} <span style={{ fontSize: 14, color: '#C4D4CB' }}>{unidadeSufixo(form.unidade)}</span>
                </div>
              )}
              <div style={{ fontSize: 12, color: '#C4D4CB' }}>Cobre custos + impostos + margem de {form.margem_pct || 0}% definida</div>
            </div>

            {calc.invalido ? (
              <div className="card-v2" style={{ textAlign: 'center', color: 'var(--mut)', padding: 24 }}>
                Ajuste os percentuais acima (impostos + comissão + margem somam 100% ou mais) para ver o breakdown e a matriz.
              </div>
            ) : (
              <>
                <div className="card-v2">
                  <div className="card-v2-h"><h3>De onde vem o preço</h3></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px dashed var(--line)', fontSize: 12.5, fontWeight: 600 }}><span>Custo direto (insumo + mão de obra)</span><b style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{formatBRL(calc.custoDireto)}</b></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px dashed var(--line)', fontSize: 12.5, fontWeight: 600 }}><span>+ Despesas fixas rateadas</span><b style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{formatBRL(parseBRLInput(form.despesas_fixas_rateadas))}</b></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px dashed var(--line)', fontSize: 12.5, fontWeight: 600, color: 'var(--neg)' }}><span>Custo total antes de impostos e margem</span><b style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{formatBRL(calc.custoTotalAntes)}</b></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px dashed var(--line)', fontSize: 12.5, fontWeight: 600 }}><span>+ Impostos ({form.impostos_pct || 0}% sobre o preço final)</span><b style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{formatBRL(calc.impostosValor)}</b></div>
                  {parseFloat(form.comissao_pct || '0') > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px dashed var(--line)', fontSize: 12.5, fontWeight: 600 }}><span>+ Comissão ({form.comissao_pct}% sobre o preço final)</span><b style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{formatBRL(calc.comissaoValor)}</b></div>
                  )}
                  {/* Margem exibida como resíduo (preço - demais linhas já arredondadas) pra soma visual sempre fechar com o total */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px dashed var(--line)', fontSize: 12.5, fontWeight: 600, color: 'var(--acc-ink)' }}><span>+ Margem de lucro ({form.margem_pct || 0}% sobre o preço final)</span><b style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{formatBRL(calc.preco - calc.custoTotalAntes - calc.impostosValor - calc.comissaoValor)}</b></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 12, fontSize: 15, fontWeight: 700 }}><span>Preço final sugerido</span><b style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 19, color: 'var(--acc-ink)' }}>{formatBRL(calc.preco)}</b></div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                  <div style={{ background: 'var(--bg)', borderRadius: 8, padding: 9, textAlign: 'center' }}>
                    <small style={{ fontSize: 10, color: 'var(--mut)', fontWeight: 700, display: 'block' }}>Lucro antes das fixas</small>
                    <b style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, color: 'var(--acc-ink)' }}>{formatBRL(calc.lucroAntesFixas)}</b>
                  </div>
                  <div style={{ background: 'var(--bg)', borderRadius: 8, padding: 9, textAlign: 'center' }}>
                    <small style={{ fontSize: 10, color: 'var(--mut)', fontWeight: 700, display: 'block' }}>Lucro depois das fixas</small>
                    <b style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, color: calc.lucroDepoisFixas < 0 ? 'var(--neg)' : 'var(--acc-ink)' }}>{formatBRL(calc.lucroDepoisFixas)}</b>
                  </div>
                  <div style={{ background: 'var(--bg)', borderRadius: 8, padding: 9, textAlign: 'center' }}>
                    <small style={{ fontSize: 10, color: 'var(--mut)', fontWeight: 700, display: 'block' }}>Ponto de equilíbrio</small>
                    <b style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, color: calc.pontoEquilibrio === Infinity ? 'var(--neg)' : undefined }}>
                      {calc.pontoEquilibrio === Infinity ? 'Nunca (prejuízo)' : calc.pontoEquilibrio === null ? '—' : `${calc.pontoEquilibrio.toFixed(1)} ${form.unidade}/mês`}
                    </b>
                  </div>
                  <div style={{ background: 'var(--bg)', borderRadius: 8, padding: 9, textAlign: 'center' }}>
                    <small style={{ fontSize: 10, color: 'var(--mut)', fontWeight: 700, display: 'block' }}>Markup aplicado</small>
                    <b style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14 }}>{calc.markup.toFixed(0)}%</b>
                  </div>
                </div>
              </>
            )}

            <button className="btn-v2 primary" disabled={salvando || calc.invalido} onClick={() => void salvar()}>
              {salvando ? 'Salvando…' : calc.invalido ? 'Ajuste os percentuais para salvar' : editandoId ? 'Salvar alterações' : '+ Salvar como produto'}
            </button>
          </div>
        </div>
      )}

      {subTab === 'salvos' && (
        <div className="card-v2" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="table-v2">
            <thead>
              <tr>
                <th style={{ padding: '10px 16px' }}>Produto/Serviço</th>
                <th>Unidade</th>
                <th style={{ textAlign: 'right' }}>Preço sugerido</th>
                <th style={{ textAlign: 'right' }}>Margem</th>
                <th style={{ textAlign: 'right', padding: '10px 16px' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--mut)' }}>Carregando…</td></tr>
              ) : produtos.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--mut)' }}>Nenhum cálculo salvo ainda.</td></tr>
              ) : produtos.map(p => (
                <tr key={p.id}>
                  <td style={{ padding: '9px 16px', fontWeight: 700, color: 'var(--ink)', cursor: 'pointer' }} onClick={() => carregarProduto(p)}>{p.nome}</td>
                  <td>{p.unidade}</td>
                  <td className="num" style={{ textAlign: 'right' }}>{formatBRL(p.preco_sugerido)}</td>
                  <td className="num" style={{ textAlign: 'right' }}>{p.margem_pct}%</td>
                  <td style={{ textAlign: 'right', padding: '9px 16px' }}>
                    <button className="btn-v2" style={{ padding: '4px 10px', fontSize: 11.5, marginRight: 6 }} onClick={() => carregarProduto(p)}>Editar</button>
                    <button className="btn-v2" style={{ padding: '4px 10px', fontSize: 11.5 }} onClick={() => void excluir(p.id)}>Excluir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {subTab === 'comparar' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--mut)', fontWeight: 600 }}>Selecione até 3 produtos para comparar lado a lado ({selecionados.length}/3).</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {produtos.map(p => (
              <span
                key={p.id}
                className={`chip-v2 ${selecionados.includes(p.id) ? 'g' : ''}`}
                style={{ cursor: 'pointer', border: '1px solid var(--line)' }}
                onClick={() => toggleSelecionado(p.id)}
              >
                {p.nome}
              </span>
            ))}
          </div>
          {comparando.length === 0 ? (
            <div className="card-v2" style={{ textAlign: 'center', color: 'var(--mut)', padding: 32 }}>Escolha produtos acima para comparar.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${comparando.length}, 1fr)`, gap: 12 }}>
              {comparando.map(p => (
                <div key={p.id} className="card-v2">
                  <div className="card-v2-h"><h3>{p.nome}</h3></div>
                  {[
                    ['Unidade', p.unidade],
                    ['Preço sugerido', formatBRL(p.preco_sugerido)],
                    ['Custo insumo', formatBRL(p.custo_insumo)],
                    ['Mão de obra', formatBRL(p.mao_obra)],
                    ['Despesas fixas', formatBRL(p.despesas_fixas_rateadas)],
                    ['Impostos', `${p.impostos_pct}%`],
                    ['Comissão', `${p.comissao_pct}%`],
                    ['Margem', `${p.margem_pct}%`],
                  ].map(([l, v]) => (
                    <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '5px 0', borderBottom: '1px solid var(--bg)' }}>
                      <span style={{ color: 'var(--mut)' }}>{l}</span><b style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{v}</b>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
