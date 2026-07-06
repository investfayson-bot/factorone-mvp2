'use client'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'

type Produto = { id: string; nome: string; unidade: string; custo: number; preco: number; vendidos: number; ativo: boolean }

const margem = (p: { preco: number; custo: number }) => p.preco - p.custo
const margemPct = (p: { preco: number; custo: number }) => (p.preco > 0 ? (margem(p) / p.preco) * 100 : 0)
const corMargem = (pct: number) => (pct >= 50 ? 'var(--sage)' : pct >= 25 ? 'var(--gold)' : '#B0413E')

export default function ProdutosPage() {
  const [empresaId, setEmpresaId] = useState('')
  const [usaDB, setUsaDB] = useState(false)
  const [itens, setItens] = useState<Produto[]>([])
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState<Produto | null>(null)
  const [vendendo, setVendendo] = useState<Produto | null>(null)
  const [qtd, setQtd] = useState('1')

  useEffect(() => { void load() }, [])
  async function load() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: ur } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
      const eid = ur?.empresa_id ?? user.id; setEmpresaId(eid)
      const { data: sess } = await supabase.auth.getSession()
      const r = await fetch('/api/produtos', { headers: sess.session ? { Authorization: `Bearer ${sess.session.access_token}` } : {} })
      const j = await r.json()
      if (j.ok) { setUsaDB(true); setItens((j.produtos ?? []) as Produto[]) }
      else { const raw = localStorage.getItem(`fo_produtos_${eid}`); setItens(raw ? JSON.parse(raw) : []) }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  async function persistir(next: Produto[]) {
    setItens(next)
    if (usaDB) {
      const { data: sess } = await supabase.auth.getSession()
      try { await fetch('/api/produtos', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(sess.session ? { Authorization: `Bearer ${sess.session.access_token}` } : {}) }, body: JSON.stringify({ produtos: next }) }) }
      catch { toast.error('Falha ao salvar') }
    } else { localStorage.setItem(`fo_produtos_${empresaId}`, JSON.stringify(next)) }
  }

  function salvar(p: Produto) {
    if (!p.nome.trim()) { toast.error('Informe o nome'); return }
    const existe = itens.some(x => x.id === p.id)
    void persistir(existe ? itens.map(x => x.id === p.id ? p : x) : [...itens, p])
    setEdit(null)
  }
  function excluir(id: string) { void persistir(itens.filter(p => p.id !== id)) }

  async function registrarVenda() {
    if (!vendendo) return
    const q = Math.max(1, Math.floor(Number(qtd) || 1))
    const p = vendendo
    const { data: sess } = await supabase.auth.getSession()
    const auth = { 'Content-Type': 'application/json', ...(sess.session ? { Authorization: `Bearer ${sess.session.access_token}` } : {}) }
    try {
      await fetch('/api/transacoes/criar', { method: 'POST', headers: auth, body: JSON.stringify({ tipo: 'entrada', descricao: `Venda: ${p.nome} x${q}`, valor: p.preco * q, categoria: 'Receita de vendas' }) })
      if (p.custo > 0) await fetch('/api/transacoes/criar', { method: 'POST', headers: auth, body: JSON.stringify({ tipo: 'saida', descricao: `CMV: ${p.nome} x${q}`, valor: p.custo * q, categoria: 'CMV' }) })
      await persistir(itens.map(x => x.id === p.id ? { ...x, vendidos: x.vendidos + q } : x))
      toast.success(`Venda registrada — ${formatBRL(margem(p) * q)} de margem foi pro DRE`)
    } catch { toast.error('Falha ao registrar venda') }
    setVendendo(null); setQtd('1')
  }

  const kpi = useMemo(() => {
    const ativos = itens.filter(p => p.ativo)
    const pctMed = ativos.length ? ativos.reduce((s, p) => s + margemPct(p), 0) / ativos.length : 0
    const fat = itens.reduce((s, p) => s + p.preco * p.vendidos, 0)
    const lucro = itens.reduce((s, p) => s + margem(p) * p.vendidos, 0)
    return { ativos: ativos.length, pctMed, fat, lucro }
  }, [itens])

  return (
    <>
      <div className="page-hdr">
        <div>
          <div className="page-title">Produtos & Margem</div>
          <div className="page-sub">Custo, preço e exatamente quanto sobra em cada venda.</div>
        </div>
        <button className="btn-action" onClick={() => setEdit({ id: crypto.randomUUID(), nome: '', unidade: 'un', custo: 0, preco: 0, vendidos: 0, ativo: true })}><i className="fa-solid fa-plus" style={{ marginRight: 6 }} />Novo produto</button>
      </div>

      <div className="kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { l: 'Produtos ativos', v: String(kpi.ativos), c: 'var(--ink)' },
          { l: 'Margem média', v: `${kpi.pctMed.toFixed(0)}%`, c: corMargem(kpi.pctMed) },
          { l: 'Faturamento', v: formatBRL(kpi.fat), c: 'var(--sage-deep)' },
          { l: 'Lucro realizado', v: formatBRL(kpi.lucro), c: kpi.lucro >= 0 ? 'var(--sage)' : '#B0413E' },
        ].map(k => (
          <div key={k.l} className="kpi txs-card" style={{ padding: '13px 16px' }}>
            <div style={{ fontSize: 10.5, color: 'var(--ink-mut)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{k.l}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.c, fontVariantNumeric: 'tabular-nums' }}>{k.v}</div>
          </div>
        ))}
      </div>

      {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-mut)' }}>Carregando…</div>
        : itens.length === 0 ? (
          <div className="txs-card" style={{ padding: '44px 30px', textAlign: 'center' }}>
            <div style={{ width: 54, height: 54, borderRadius: '50%', background: 'var(--sage-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}><i className="fa-solid fa-tags" style={{ fontSize: 22, color: 'var(--sage-deep)' }} /></div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>Saiba quanto sobra em cada venda</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-mut)', maxWidth: 380, margin: '0 auto 18px', lineHeight: 1.6 }}>Cadastre o custo da matéria-prima e o preço. O sistema mostra sua margem e, a cada venda, joga receita e custo direto no seu DRE.</div>
            <button className="btn-action" onClick={() => setEdit({ id: crypto.randomUUID(), nome: '', unidade: 'un', custo: 0, preco: 0, vendidos: 0, ativo: true })}><i className="fa-solid fa-plus" style={{ marginRight: 6 }} />Cadastrar primeiro produto</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 12 }}>
            {itens.map(p => {
              const m = margem(p); const pct = margemPct(p)
              return (
                <div key={p.id} className="txs-card" style={{ padding: '15px 16px', opacity: p.ativo ? 1 : .6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nome || 'Sem nome'}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-mut)' }}>por {p.unidade} · {p.vendidos} vendidos</div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 800, color: corMargem(pct), background: 'color-mix(in srgb, currentColor 12%, #fff)', padding: '3px 9px', borderRadius: 100, whiteSpace: 'nowrap' }}>{pct.toFixed(0)}%</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: 'var(--ink-mut)' }}>Custo</span><span style={{ fontWeight: 600 }}>{formatBRL(p.custo)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: 'var(--ink-mut)' }}>Preço</span><span style={{ fontWeight: 600 }}>{formatBRL(p.preco)}</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--paper-2)', borderRadius: 3, overflow: 'hidden', margin: '8px 0' }}>
                    <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, pct))}%`, background: corMargem(pct), borderRadius: 3 }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 12 }}>
                    <span style={{ color: 'var(--ink-mut)' }}>Sobra por {p.unidade}</span><span style={{ fontWeight: 800, color: corMargem(pct), fontVariantNumeric: 'tabular-nums' }}>{formatBRL(m)}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn-action" style={{ fontSize: 11.5, padding: '6px 12px', flex: 1 }} onClick={() => { setVendendo(p); setQtd('1') }}><i className="fa-solid fa-cart-shopping" style={{ marginRight: 5 }} />Registrar venda</button>
                    <button className="btn-ghost" style={{ fontSize: 11.5, padding: '6px 10px' }} onClick={() => setEdit(p)} title="Editar"><i className="fa-solid fa-pen" /></button>
                    <button className="btn-ghost" style={{ fontSize: 11.5, padding: '6px 9px', color: '#B0413E' }} onClick={() => excluir(p.id)} title="Excluir"><i className="fa-solid fa-trash" /></button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

      {/* Modal editar/criar */}
      {edit && <EditModal p={edit} onClose={() => setEdit(null)} onSave={salvar} />}

      {/* Modal registrar venda */}
      {vendendo && (
        <div onClick={() => setVendendo(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(19,32,29,.45)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} className="txs-card" style={{ width: '100%', maxWidth: 380, padding: 22 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>Registrar venda</div>
            <div style={{ fontSize: 12, color: 'var(--ink-mut)', marginBottom: 16 }}>{vendendo.nome} · {formatBRL(vendendo.preco)}/{vendendo.unidade}</div>
            <label className="form-label">Quantidade</label>
            <input className="form-input" type="number" min={1} value={qtd} onChange={e => setQtd(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Enter') void registrarVenda() }} />
            {(() => { const q = Math.max(1, Math.floor(Number(qtd) || 1)); return (
              <div style={{ background: 'var(--sage-tint)', borderRadius: 9, padding: '12px 14px', margin: '14px 0', fontSize: 12.5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}><span style={{ color: 'var(--ink-mut)' }}>Receita</span><b>{formatBRL(vendendo.preco * q)}</b></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}><span style={{ color: 'var(--ink-mut)' }}>Custo (CMV)</span><b>{formatBRL(vendendo.custo * q)}</b></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 5, borderTop: '1px solid var(--line)' }}><span style={{ color: 'var(--sage-deep)', fontWeight: 700 }}>Sobra</span><b style={{ color: 'var(--sage-deep)' }}>{formatBRL(margem(vendendo) * q)}</b></div>
              </div>
            ) })()}
            <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginBottom: 14, lineHeight: 1.5 }}><i className="fa-solid fa-arrow-trend-up" style={{ marginRight: 5 }} />Receita e custo vão direto pro seu DRE.</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setVendendo(null)}>Cancelar</button>
              <button className="btn-action" style={{ flex: 2 }} onClick={() => void registrarVenda()}>Confirmar venda</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function EditModal({ p, onClose, onSave }: { p: Produto; onClose: () => void; onSave: (p: Produto) => void }) {
  const [f, setF] = useState<Produto>(p)
  const m = margem(f); const pct = margemPct(f)
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(19,32,29,.45)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} className="txs-card" style={{ width: '100%', maxWidth: 420, padding: 22 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 16 }}>{p.nome ? 'Editar produto' : 'Novo produto'}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label className="form-label">Nome *</label>
            <input className="form-input" placeholder="Ex: Colar Pérola" value={f.nome} onChange={e => setF(p => ({ ...p, nome: e.target.value }))} autoFocus />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
            <div>
              <label className="form-label">Custo matéria-prima</label>
              <input className="form-input" type="number" step="0.01" placeholder="0,00" value={f.custo || ''} onChange={e => setF(p => ({ ...p, custo: Number(e.target.value) || 0 }))} />
            </div>
            <div>
              <label className="form-label">Unidade</label>
              <input className="form-input" placeholder="un" value={f.unidade} onChange={e => setF(p => ({ ...p, unidade: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="form-label">Preço de venda</label>
            <input className="form-input" type="number" step="0.01" placeholder="0,00" value={f.preco || ''} onChange={e => setF(p => ({ ...p, preco: Number(e.target.value) || 0 }))} />
          </div>
          <div style={{ background: 'var(--sage-tint)', borderRadius: 9, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12.5, color: 'var(--ink-mut)' }}>Sobra por venda</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: corMargem(pct), fontVariantNumeric: 'tabular-nums' }}>{formatBRL(m)} <span style={{ fontSize: 12 }}>({pct.toFixed(0)}%)</span></span>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--ink)', cursor: 'pointer' }}>
            <input type="checkbox" checked={f.ativo} onChange={e => setF(p => ({ ...p, ativo: e.target.checked }))} /> Produto ativo
          </label>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button className="btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
          <button className="btn-action" style={{ flex: 2 }} onClick={() => onSave(f)}>Salvar</button>
        </div>
      </div>
    </div>
  )
}
