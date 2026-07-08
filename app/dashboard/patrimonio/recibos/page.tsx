'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'
import toast from 'react-hot-toast'

/**
 * Patrimônio → Recibos de Locação (modelo do Excel).
 * Bruto = aluguel + juros/multa + água + outros. Líquido = bruto − comissão − desconto.
 * Marcar como pago lança a receita (líquido) no Fluxo/DRE ('Receita de aluguel').
 */

type Recibo = {
  id: string; numero: string; locatario: string; endereco: string; periodo: string
  aluguel: number; juros: number; comissao: number; agua: number; outros: number; desconto: number
  vencimento: string; pagamento: string // '' = pendente
}
type ImovelLite = { unidade?: string; endereco?: string; cidade?: string; aluguel?: number; locatario?: string }

const mesAtual = () => { const d = new Date(); return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}` }
const VAZIO: Omit<Recibo, 'id'> = { numero: '', locatario: '', endereco: '', periodo: mesAtual(), aluguel: 0, juros: 0, comissao: 0, agua: 0, outros: 0, desconto: 0, vencimento: new Date().toISOString().slice(0, 10), pagamento: '' }
const bruto = (r: Pick<Recibo, 'aluguel' | 'juros' | 'agua' | 'outros'>) => Number(r.aluguel) + Number(r.juros) + Number(r.agua) + Number(r.outros)
const liquido = (r: Recibo | Omit<Recibo, 'id'>) => bruto(r) - Number(r.comissao) - Number(r.desconto)

export default function RecibosPage() {
  const [empresaId, setEmpresaId] = useState('')
  const [token, setToken] = useState('')
  const [dbOk, setDbOk] = useState(false)
  const [recibos, setRecibos] = useState<Recibo[]>([])
  const [imoveis, setImoveis] = useState<ImovelLite[]>([])
  const [show, setShow] = useState(false)
  const [form, setForm] = useState<Omit<Recibo, 'id'>>({ ...VAZIO })
  const [editId, setEditId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const chave = useCallback((eid: string) => `fo_recibos_${eid}`, [])
  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser(); if (!user) return
      const { data: sess } = await supabase.auth.getSession(); const tk = sess.session?.access_token ?? ''; setToken(tk)
      const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
      const eid = (u?.empresa_id as string) ?? user.id; setEmpresaId(eid)
      const auth = tk ? { Authorization: `Bearer ${tk}` } : {}
      // imóveis p/ o prefill
      try { const ri = await fetch('/api/patrimonio/imoveis', { headers: auth }); const ji = await ri.json(); if (ji.ok) setImoveis((ji.imoveis ?? []) as ImovelLite[]) } catch { /* ignore */ }
      // recibos DB-first
      try { const r = await fetch('/api/patrimonio/recibos', { headers: auth }); const j = await r.json(); if (j.ok) { setDbOk(true); setRecibos((j.recibos ?? []) as Recibo[]); return } } catch { /* fallback */ }
      try { const raw = localStorage.getItem(chave(eid)); if (raw) setRecibos(JSON.parse(raw) as Recibo[]) } catch { /* ignore */ }
    })()
  }, [chave])

  function persistir(next: Recibo[]) {
    setRecibos(next)
    if (dbOk) void fetch('/api/patrimonio/recibos', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ recibos: next }) }).then(r => { if (!r.ok) toast.error('Falha ao salvar no banco') })
    else try { localStorage.setItem(chave(empresaId), JSON.stringify(next)) } catch { /* ignore */ }
  }

  function abrirNovo() { setForm({ ...VAZIO, numero: String(recibos.length + 1) }); setEditId(null); setShow(true) }
  function abrirEdit(r: Recibo) { const { id, ...rest } = r; void id; setForm(rest); setEditId(r.id); setShow(true) }
  function usarImovel(idx: number) {
    const im = imoveis[idx]; if (!im) return
    setForm(f => ({ ...f, locatario: im.locatario ?? f.locatario, endereco: [im.unidade, im.endereco, im.cidade].filter(Boolean).join(' · ') || f.endereco, aluguel: Number(im.aluguel ?? f.aluguel) }))
  }
  function salvar() {
    if (!form.locatario.trim()) { toast.error('Informe o locatário'); return }
    if (editId) persistir(recibos.map(r => r.id === editId ? { ...form, id: editId } : r))
    else persistir([...recibos, { ...form, id: crypto.randomUUID() }])
    setShow(false); toast.success(editId ? 'Recibo atualizado' : 'Recibo emitido')
  }
  function excluir(id: string) { if (window.confirm('Excluir recibo?')) persistir(recibos.filter(r => r.id !== id)) }

  async function marcarPago(r: Recibo) {
    setBusy(true)
    const hoje = new Date().toISOString().slice(0, 10)
    try {
      await fetch('/api/transacoes/criar', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ descricao: `Aluguel — ${r.locatario} (${r.periodo})`, valor: liquido(r), tipo: 'entrada', categoria: 'Receita de aluguel', data: hoje }) })
      persistir(recibos.map(x => x.id === r.id ? { ...x, pagamento: hoje } : x))
      toast.success('Recebido — lançado no Fluxo/DRE ✓')
    } catch { toast.error('Falha ao lançar') }
    finally { setBusy(false) }
  }

  const totalRecebido = useMemo(() => recibos.filter(r => r.pagamento).reduce((s, r) => s + liquido(r), 0), [recibos])
  const totalReceber = useMemo(() => recibos.filter(r => !r.pagamento).reduce((s, r) => s + liquido(r), 0), [recibos])

  return (
    <>
      <div className="page-hdr">
        <div>
          <div className="page-title">Recibos de Locação</div>
          <div className="page-sub">Emita o recibo com o detalhe. Ao marcar como pago, o líquido entra no Fluxo/DRE.</div>
        </div>
        <button className="btn-action" style={{ fontSize: 14 }} onClick={abrirNovo}><i className="fa-solid fa-plus" style={{ marginRight: 6 }} />Novo recibo</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 18 }}>
        {[
          { lbl: 'Recibos', val: String(recibos.length), cor: 'var(--navy)', ic: 'fa-receipt' },
          { lbl: 'Recebido', val: formatBRL(totalRecebido), cor: 'var(--sage)', ic: 'fa-circle-check' },
          { lbl: 'A receber', val: formatBRL(totalReceber), cor: 'var(--gold)', ic: 'fa-hourglass-half' },
        ].map(k => (
          <div key={k.lbl} className="kpi" style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-mut)', textTransform: 'uppercase', letterSpacing: '.08em' }}>{k.lbl}</span>
              <i className={`fa-solid ${k.ic}`} style={{ fontSize: 14, color: k.cor }} />
            </div>
            <div style={{ fontSize: 21, fontWeight: 700, color: k.cor, marginTop: 8, fontVariantNumeric: 'tabular-nums' }}>{k.val}</div>
          </div>
        ))}
      </div>

      {recibos.length === 0 ? (
        <div className="txs-card" style={{ padding: 44, textAlign: 'center' }}>
          <i className="fa-solid fa-receipt" style={{ fontSize: 28, color: 'var(--sage)', marginBottom: 12 }} />
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>Emita seu primeiro recibo</div>
          <div style={{ fontSize: 14.5, color: 'var(--ink-mut)', maxWidth: 440, margin: '0 auto 14px' }}>Puxe os dados de um imóvel, detalhe os valores e receba — o líquido cai na DRE.</div>
          <button className="btn-action" style={{ fontSize: 14 }} onClick={abrirNovo}><i className="fa-solid fa-plus" style={{ marginRight: 6 }} />Novo recibo</button>
        </div>
      ) : (
        <div className="txs-card">
          <div style={{ display: 'grid', gridTemplateColumns: '48px 1fr 90px 120px 110px 130px', gap: 12, padding: '11px 18px', borderBottom: '1px solid var(--line)', background: 'var(--surface-2)', fontSize: 12, fontWeight: 600, color: 'var(--ink-mut)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
            <span>Nº</span><span>Locatário / imóvel</span><span>Período</span><span style={{ textAlign: 'right' }}>Líquido</span><span>Status</span><span />
          </div>
          {recibos.map((r, i) => (
            <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '48px 1fr 90px 120px 110px 130px', gap: 12, alignItems: 'center', padding: '12px 18px', borderBottom: i < recibos.length - 1 ? '1px solid var(--line-soft)' : 'none' }}>
              <span style={{ fontSize: 14, color: 'var(--ink-mut)', fontFamily: 'var(--font-mono)' }}>#{r.numero || i + 1}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink)' }}>{r.locatario}</div>
                <div style={{ fontSize: 13, color: 'var(--ink-mut)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.endereco || '—'}</div>
              </div>
              <span style={{ fontSize: 14, color: 'var(--ink-soft)' }}>{r.periodo}</span>
              <span style={{ textAlign: 'right', fontSize: 15, fontWeight: 700, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{formatBRL(liquido(r))}</span>
              <span style={{ justifySelf: 'start', fontSize: 11.5, fontWeight: 600, padding: '3px 9px', borderRadius: 100, textTransform: 'uppercase', letterSpacing: '.05em', color: r.pagamento ? 'var(--sage-deep)' : 'var(--gold)', background: r.pagamento ? 'var(--sage-tint)' : 'var(--gold-tint)' }}>{r.pagamento ? 'Pago' : 'Pendente'}</span>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                {!r.pagamento && <button className="btn-action" title="Marcar pago (lança no fluxo)" style={{ fontSize: 13, padding: '6px 10px' }} disabled={busy} onClick={() => void marcarPago(r)}><i className="fa-solid fa-check" /></button>}
                <button className="btn-ghost" title="Editar" style={{ fontSize: 13, padding: '6px 10px' }} onClick={() => abrirEdit(r)}><i className="fa-solid fa-pen" /></button>
                <button className="btn-ghost" title="Excluir" style={{ fontSize: 13, padding: '6px 10px', color: '#B0413E', borderColor: '#B0413E' }} onClick={() => excluir(r.id)}><i className="fa-solid fa-trash-can" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {show && (
        <div className="modal-bg" onClick={() => setShow(false)}>
          <div className="modal-box" style={{ width: 580 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div className="modal-title">{editId ? 'Editar recibo' : 'Novo recibo'}</div>
              <button className="modal-close" onClick={() => setShow(false)}><i className="fa-solid fa-xmark" /></button>
            </div>
            {imoveis.length > 0 && (
              <div className="form-group">
                <label className="form-label">Puxar de um imóvel</label>
                <select className="form-input" defaultValue="" onChange={e => { if (e.target.value !== '') usarImovel(Number(e.target.value)) }}>
                  <option value="">— selecione (opcional) —</option>
                  {imoveis.map((im, idx) => <option key={idx} value={idx}>{[im.unidade, im.locatario].filter(Boolean).join(' · ')}</option>)}
                </select>
              </div>
            )}
            <div className="form-row">
              <div className="form-group"><label className="form-label">Locatário</label><input className="form-input" value={form.locatario} onChange={e => setForm(f => ({ ...f, locatario: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">Período</label><input className="form-input" placeholder="07/2026" value={form.periodo} onChange={e => setForm(f => ({ ...f, periodo: e.target.value }))} /></div>
            </div>
            <div className="form-group"><label className="form-label">Imóvel / endereço</label><input className="form-input" value={form.endereco} onChange={e => setForm(f => ({ ...f, endereco: e.target.value }))} /></div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Aluguel (R$)</label><input className="form-input" type="number" step="0.01" value={form.aluguel || ''} onChange={e => setForm(f => ({ ...f, aluguel: Number(e.target.value) }))} /></div>
              <div className="form-group"><label className="form-label">Juros / multa (R$)</label><input className="form-input" type="number" step="0.01" value={form.juros || ''} onChange={e => setForm(f => ({ ...f, juros: Number(e.target.value) }))} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Água (R$)</label><input className="form-input" type="number" step="0.01" value={form.agua || ''} onChange={e => setForm(f => ({ ...f, agua: Number(e.target.value) }))} /></div>
              <div className="form-group"><label className="form-label">Outros (R$)</label><input className="form-input" type="number" step="0.01" value={form.outros || ''} onChange={e => setForm(f => ({ ...f, outros: Number(e.target.value) }))} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Comissão (R$)</label><input className="form-input" type="number" step="0.01" value={form.comissao || ''} onChange={e => setForm(f => ({ ...f, comissao: Number(e.target.value) }))} /></div>
              <div className="form-group"><label className="form-label">Desconto (R$)</label><input className="form-input" type="number" step="0.01" value={form.desconto || ''} onChange={e => setForm(f => ({ ...f, desconto: Number(e.target.value) }))} /></div>
            </div>
            <div className="form-group"><label className="form-label">Vencimento</label><input className="form-input" type="date" value={form.vencimento} onChange={e => setForm(f => ({ ...f, vencimento: e.target.value }))} /></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 14, color: 'var(--ink-mut)' }}>Bruto {formatBRL(bruto(form))} − comissão − desconto</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--sage-deep)' }}>Líquido {formatBRL(liquido(form))}</span>
            </div>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setShow(false)}>Cancelar</button>
              <button className="btn-action" onClick={salvar}>{editId ? 'Salvar' : 'Emitir recibo'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
