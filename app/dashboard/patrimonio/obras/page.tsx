'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'
import toast from 'react-hot-toast'

/**
 * Patrimônio → Obras e Reformas (modelo do Excel).
 * Orçamento × Pago × A pagar × Desvio. Cada pagamento vira SAÍDA classificada
 * ('Obras e reformas') em `transacoes` → aparece no Fluxo/DRE.
 * v1: obras em localStorage (por empresa); pagamentos gravam transação real.
 */

type Pagamento = { id: string; data: string; descricao: string; valor: number }
type Obra = { id: string; nome: string; local: string; responsavel: string; inicio: string; previsao: string; orcamento: number; status: 'planejada' | 'andamento' | 'concluida'; pagamentos: Pagamento[] }

const VAZIA: Omit<Obra, 'id' | 'pagamentos'> = { nome: '', local: '', responsavel: '', inicio: new Date().toISOString().slice(0, 10), previsao: '', orcamento: 0, status: 'andamento' }
const STATUS: Record<Obra['status'], { label: string; cor: string; bg: string }> = {
  planejada: { label: 'Planejada', cor: 'var(--gold)', bg: 'var(--gold-tint)' },
  andamento: { label: 'Em andamento', cor: 'var(--sage-deep)', bg: 'var(--sage-tint)' },
  concluida: { label: 'Concluída', cor: '#3D6E8E', bg: '#E4EDEF' },
}

export default function ObrasPage() {
  const [empresaId, setEmpresaId] = useState('')
  const [token, setToken] = useState('')
  const [obras, setObras] = useState<Obra[]>([])
  const [showObra, setShowObra] = useState(false)
  const [form, setForm] = useState<Omit<Obra, 'id' | 'pagamentos'>>({ ...VAZIA })
  const [editId, setEditId] = useState<string | null>(null)
  const [pagFor, setPagFor] = useState<Obra | null>(null)
  const [pag, setPag] = useState({ data: new Date().toISOString().slice(0, 10), descricao: '', valor: '' })
  const [busy, setBusy] = useState(false)

  const [dbOk, setDbOk] = useState(false)
  const chave = useCallback((eid: string) => `fo_obras_${eid}`, [])
  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser(); if (!user) return
      const { data: sess } = await supabase.auth.getSession(); const tk = sess.session?.access_token ?? ''; setToken(tk)
      const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
      const eid = (u?.empresa_id as string) ?? user.id; setEmpresaId(eid)
      try {
        const r = await fetch('/api/patrimonio/obras', { headers: tk ? { Authorization: `Bearer ${tk}` } : {} })
        const j = await r.json()
        if (j.ok) { setDbOk(true); setObras((j.obras ?? []) as Obra[]); return }
      } catch { /* fallback */ }
      try { const raw = localStorage.getItem(chave(eid)); if (raw) setObras(JSON.parse(raw) as Obra[]) } catch { /* ignore */ }
    })()
  }, [chave])
  function persistir(next: Obra[]) {
    setObras(next)
    if (dbOk) {
      void fetch('/api/patrimonio/obras', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ obras: next }) })
        .then(r => { if (!r.ok) toast.error('Falha ao salvar no banco') })
    } else {
      try { localStorage.setItem(chave(empresaId), JSON.stringify(next)) } catch { /* ignore */ }
    }
  }

  function abrirNova() { setForm({ ...VAZIA }); setEditId(null); setShowObra(true) }
  function abrirEdit(o: Obra) { const { id, pagamentos, ...rest } = o; void id; void pagamentos; setForm(rest); setEditId(o.id); setShowObra(true) }
  function salvarObra() {
    if (!form.nome.trim()) { toast.error('Dê um nome à obra'); return }
    if (editId) persistir(obras.map(o => o.id === editId ? { ...o, ...form } : o))
    else persistir([...obras, { ...form, id: crypto.randomUUID(), pagamentos: [] }])
    setShowObra(false); toast.success(editId ? 'Obra atualizada' : 'Obra criada')
  }
  function excluir(id: string) { if (window.confirm('Excluir esta obra e seus pagamentos?')) persistir(obras.filter(o => o.id !== id)) }

  async function lancarPagamento() {
    if (!pagFor) return
    const valor = Number(pag.valor)
    if (!pag.descricao.trim() || !valor) { toast.error('Preencha descrição e valor'); return }
    setBusy(true)
    try {
      // grava a SAÍDA real (Fluxo/DRE), já classificada
      await fetch('/api/transacoes/criar', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ descricao: `Obra: ${pagFor.nome} — ${pag.descricao}`, valor, tipo: 'saida', categoria: 'Obras e reformas', data: pag.data }) })
      const novo: Pagamento = { id: crypto.randomUUID(), data: pag.data, descricao: pag.descricao.trim(), valor }
      persistir(obras.map(o => o.id === pagFor.id ? { ...o, pagamentos: [...o.pagamentos, novo] } : o))
      toast.success('Pagamento lançado no Fluxo/DRE ✓')
      setPagFor(null); setPag({ data: new Date().toISOString().slice(0, 10), descricao: '', valor: '' })
    } catch { toast.error('Falha ao lançar') }
    finally { setBusy(false) }
  }

  const tot = useMemo(() => {
    let orc = 0, pago = 0
    for (const o of obras) { orc += Number(o.orcamento); pago += o.pagamentos.reduce((s, p) => s + Number(p.valor), 0) }
    return { orc, pago, aPagar: Math.max(0, orc - pago), desvio: pago - orc }
  }, [obras])

  return (
    <>
      <div className="page-hdr">
        <div>
          <div className="page-title">Obras e Reformas</div>
          <div className="page-sub">Orçamento × pago × desvio. Cada pagamento vira saída no Fluxo de Caixa e na DRE.</div>
        </div>
        <button className="btn-action" style={{ fontSize: 14 }} onClick={abrirNova}><i className="fa-solid fa-plus" style={{ marginRight: 6 }} />Nova obra</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 18 }}>
        {[
          { lbl: 'Orçamento total', val: formatBRL(tot.orc), cor: 'var(--navy)', ic: 'fa-clipboard-list' },
          { lbl: 'Total pago', val: formatBRL(tot.pago), cor: 'var(--sage)', ic: 'fa-circle-check' },
          { lbl: 'A pagar', val: formatBRL(tot.aPagar), cor: 'var(--gold)', ic: 'fa-hourglass-half' },
          { lbl: 'Desvio', val: `${tot.desvio > 0 ? '+' : ''}${formatBRL(tot.desvio)}`, cor: tot.desvio > 0 ? '#B0413E' : 'var(--sage)', ic: 'fa-triangle-exclamation' },
        ].map(k => (
          <div key={k.lbl} className="kpi" style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-mut)', textTransform: 'uppercase', letterSpacing: '.08em' }}>{k.lbl}</span>
              <i className={`fa-solid ${k.ic}`} style={{ fontSize: 14, color: k.cor }} />
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: k.cor, marginTop: 8, fontVariantNumeric: 'tabular-nums' }}>{k.val}</div>
          </div>
        ))}
      </div>

      {obras.length === 0 ? (
        <div className="txs-card" style={{ padding: 44, textAlign: 'center' }}>
          <i className="fa-solid fa-helmet-safety" style={{ fontSize: 28, color: 'var(--sage)', marginBottom: 12 }} />
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>Controle suas obras e reformas</div>
          <div style={{ fontSize: 14.5, color: 'var(--ink-mut)', maxWidth: 440, margin: '0 auto 14px' }}>Crie uma obra com o orçamento e registre os pagamentos — o desvio aparece sozinho e cada pagamento entra na DRE.</div>
          <button className="btn-action" style={{ fontSize: 14 }} onClick={abrirNova}><i className="fa-solid fa-plus" style={{ marginRight: 6 }} />Nova obra</button>
        </div>
      ) : obras.map(o => {
        const pago = o.pagamentos.reduce((s, p) => s + Number(p.valor), 0)
        const pct = o.orcamento > 0 ? Math.min(100, (pago / o.orcamento) * 100) : 0
        const estourou = pago > o.orcamento && o.orcamento > 0
        const st = STATUS[o.status]
        return (
          <div key={o.id} className="txs-card" style={{ marginBottom: 14, padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  {o.nome}
                  <span style={{ fontSize: 11.5, fontWeight: 600, padding: '3px 9px', borderRadius: 100, textTransform: 'uppercase', letterSpacing: '.05em', color: st.cor, background: st.bg }}>{st.label}</span>
                </div>
                <div style={{ fontSize: 13.5, color: 'var(--ink-mut)', marginTop: 3 }}>{[o.local, o.responsavel].filter(Boolean).join(' · ') || 'Sem detalhes'}{o.previsao ? ` · previsão ${o.previsao.split('-').reverse().join('/')}` : ''}</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn-action" style={{ fontSize: 13, padding: '6px 12px' }} disabled={busy} onClick={() => setPagFor(o)}><i className="fa-solid fa-plus" style={{ marginRight: 5 }} />Pagamento</button>
                <button className="btn-ghost" style={{ fontSize: 13, padding: '6px 10px' }} onClick={() => abrirEdit(o)}><i className="fa-solid fa-pen" /></button>
                <button className="btn-ghost" style={{ fontSize: 13, padding: '6px 10px', color: '#B0413E', borderColor: '#B0413E' }} onClick={() => excluir(o.id)}><i className="fa-solid fa-trash-can" /></button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 24, marginBottom: 10, flexWrap: 'wrap' }}>
              {[['Orçamento', formatBRL(o.orcamento), 'var(--ink)'], ['Pago', formatBRL(pago), 'var(--sage-deep)'], ['A pagar', formatBRL(Math.max(0, o.orcamento - pago)), 'var(--gold)'], ['Desvio', `${pago - o.orcamento > 0 ? '+' : ''}${formatBRL(pago - o.orcamento)}`, estourou ? '#B0413E' : 'var(--sage)']].map(([l, v, c]) => (
                <div key={l}><div style={{ fontSize: 12, color: 'var(--ink-mut)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{l}</div><div style={{ fontSize: 14, fontWeight: 700, color: c as string, fontVariantNumeric: 'tabular-nums' }}>{v}</div></div>
              ))}
            </div>
            <div style={{ height: 7, background: 'var(--paper-2)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: estourou ? '#B0413E' : 'var(--sage)', borderRadius: 4 }} />
            </div>
            {o.pagamentos.length > 0 && (
              <div style={{ marginTop: 12, borderTop: '1px solid var(--line-soft)', paddingTop: 10 }}>
                {o.pagamentos.slice().reverse().map(p => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, padding: '4px 0', color: 'var(--ink-soft)' }}>
                    <span>{p.data.slice(8, 10)}/{p.data.slice(5, 7)} · {p.descricao}</span>
                    <span style={{ fontWeight: 600, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{formatBRL(p.valor)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {/* Modal obra */}
      {showObra && (
        <div className="modal-bg" onClick={() => setShowObra(false)}>
          <div className="modal-box" style={{ width: 540 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div className="modal-title">{editId ? 'Editar obra' : 'Nova obra'}</div>
              <button className="modal-close" onClick={() => setShowObra(false)}><i className="fa-solid fa-xmark" /></button>
            </div>
            <div className="form-group"><label className="form-label">Nome da obra/projeto</label><input className="form-input" placeholder="Ex: Reforma Loja 01" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} /></div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Local</label><input className="form-input" value={form.local} onChange={e => setForm(f => ({ ...f, local: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">Responsável</label><input className="form-input" value={form.responsavel} onChange={e => setForm(f => ({ ...f, responsavel: e.target.value }))} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Início</label><input className="form-input" type="date" value={form.inicio} onChange={e => setForm(f => ({ ...f, inicio: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">Previsão de término</label><input className="form-input" type="date" value={form.previsao} onChange={e => setForm(f => ({ ...f, previsao: e.target.value }))} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Orçamento (R$)</label><input className="form-input" type="number" step="0.01" value={form.orcamento || ''} onChange={e => setForm(f => ({ ...f, orcamento: Number(e.target.value) }))} /></div>
              <div className="form-group"><label className="form-label">Status</label><select className="form-input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as Obra['status'] }))}><option value="planejada">Planejada</option><option value="andamento">Em andamento</option><option value="concluida">Concluída</option></select></div>
            </div>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setShowObra(false)}>Cancelar</button>
              <button className="btn-action" onClick={salvarObra}>{editId ? 'Salvar' : 'Criar obra'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal pagamento */}
      {pagFor && (
        <div className="modal-bg" onClick={() => setPagFor(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div className="modal-title">Lançar pagamento</div>
              <button className="modal-close" onClick={() => setPagFor(null)}><i className="fa-solid fa-xmark" /></button>
            </div>
            <div style={{ fontSize: 14, color: 'var(--ink-mut)', marginBottom: 16 }}>Obra: <b>{pagFor.nome}</b>. Entra como saída na DRE (categoria &quot;Obras e reformas&quot;).</div>
            <div className="form-group"><label className="form-label">Descrição</label><input className="form-input" placeholder="Ex: Material elétrico" value={pag.descricao} onChange={e => setPag(p => ({ ...p, descricao: e.target.value }))} /></div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Valor (R$)</label><input className="form-input" type="number" step="0.01" value={pag.valor} onChange={e => setPag(p => ({ ...p, valor: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">Data</label><input className="form-input" type="date" value={pag.data} onChange={e => setPag(p => ({ ...p, data: e.target.value }))} /></div>
            </div>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setPagFor(null)}>Cancelar</button>
              <button className="btn-action" disabled={busy} onClick={() => void lancarPagamento()}>Lançar</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
