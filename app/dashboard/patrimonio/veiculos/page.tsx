'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'
import toast from 'react-hot-toast'

/**
 * Patrimônio → Veículos (modelo do Excel). Frota com valor, IPVA e seguro.
 * "Lançar despesa" (IPVA/seguro/manutenção…) vira saída no Fluxo/DRE ('Veículos').
 * Alertas de vencimento de IPVA/seguro.
 */

type Veiculo = {
  id: string; placa: string; modelo: string; marca: string; ano: string; renavam: string; cor: string
  km: number; valor: number; ipva: number; ipva_venc: string; seguro: number; seguro_venc: string; status: string
}
const VAZIO: Omit<Veiculo, 'id'> = { placa: '', modelo: '', marca: '', ano: '', renavam: '', cor: '', km: 0, valor: 0, ipva: 0, ipva_venc: '', seguro: 0, seguro_venc: '', status: 'ativo' }
const diasAte = (d: string) => (d ? Math.ceil((new Date(d + 'T12:00:00').getTime() - Date.now()) / 86400000) : null)
const TIPOS_DESP = ['IPVA', 'Seguro', 'Manutenção', 'Combustível', 'Licenciamento', 'Multa', 'Outros']

export default function VeiculosPage() {
  const [empresaId, setEmpresaId] = useState('')
  const [token, setToken] = useState('')
  const [dbOk, setDbOk] = useState(false)
  const [veiculos, setVeiculos] = useState<Veiculo[]>([])
  const [show, setShow] = useState(false)
  const [form, setForm] = useState<Omit<Veiculo, 'id'>>({ ...VAZIO })
  const [editId, setEditId] = useState<string | null>(null)
  const [despFor, setDespFor] = useState<Veiculo | null>(null)
  const [desp, setDesp] = useState({ tipo: 'IPVA', valor: '' })
  const [busy, setBusy] = useState(false)

  const chave = useCallback((eid: string) => `fo_veiculos_${eid}`, [])
  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser(); if (!user) return
      const { data: sess } = await supabase.auth.getSession(); const tk = sess.session?.access_token ?? ''; setToken(tk)
      const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
      const eid = (u?.empresa_id as string) ?? user.id; setEmpresaId(eid)
      try { const r = await fetch('/api/patrimonio/veiculos', { headers: tk ? { Authorization: `Bearer ${tk}` } : {} }); const j = await r.json(); if (j.ok) { setDbOk(true); setVeiculos((j.veiculos ?? []) as Veiculo[]); return } } catch { /* fallback */ }
      try { const raw = localStorage.getItem(chave(eid)); if (raw) setVeiculos(JSON.parse(raw) as Veiculo[]) } catch { /* ignore */ }
    })()
  }, [chave])

  function persistir(next: Veiculo[]) {
    setVeiculos(next)
    if (dbOk) void fetch('/api/patrimonio/veiculos', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ veiculos: next }) }).then(r => { if (!r.ok) toast.error('Falha ao salvar no banco') })
    else try { localStorage.setItem(chave(empresaId), JSON.stringify(next)) } catch { /* ignore */ }
  }
  function abrirNovo() { setForm({ ...VAZIO }); setEditId(null); setShow(true) }
  function abrirEdit(v: Veiculo) { const { id, ...rest } = v; void id; setForm(rest); setEditId(v.id); setShow(true) }
  function salvar() {
    if (!form.placa.trim() && !form.modelo.trim()) { toast.error('Informe placa ou modelo'); return }
    if (editId) persistir(veiculos.map(v => v.id === editId ? { ...form, id: editId } : v))
    else persistir([...veiculos, { ...form, id: crypto.randomUUID() }])
    setShow(false); toast.success(editId ? 'Veículo atualizado' : 'Veículo cadastrado')
  }
  function excluir(id: string) { if (window.confirm('Excluir veículo?')) persistir(veiculos.filter(v => v.id !== id)) }

  async function lancarDespesa() {
    if (!despFor) return
    const valor = Number(desp.valor)
    if (!valor) { toast.error('Informe o valor'); return }
    setBusy(true)
    try {
      await fetch('/api/transacoes/criar', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ descricao: `${desp.tipo} — ${despFor.placa || despFor.modelo}`, valor, tipo: 'saida', categoria: 'Veículos' }) })
      toast.success('Despesa lançada no Fluxo/DRE ✓')
      setDespFor(null); setDesp({ tipo: 'IPVA', valor: '' })
    } catch { toast.error('Falha ao lançar') }
    finally { setBusy(false) }
  }

  const totalFrota = veiculos.reduce((s, v) => s + Number(v.valor), 0)
  const alertas = useMemo(() => veiculos.filter(v => { const a = diasAte(v.ipva_venc); const b = diasAte(v.seguro_venc); return (a !== null && a <= 30) || (b !== null && b <= 30) }).length, [veiculos])

  return (
    <>
      <div className="page-hdr">
        <div>
          <div className="page-title">Veículos</div>
          <div className="page-sub">Sua frota: valor, IPVA e seguro. Despesas viram saída no Fluxo/DRE.</div>
        </div>
        <button className="btn-action" style={{ fontSize: 12 }} onClick={abrirNovo}><i className="fa-solid fa-plus" style={{ marginRight: 6 }} />Novo veículo</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 18 }}>
        {[
          { lbl: 'Veículos', val: String(veiculos.length), cor: 'var(--navy)', ic: 'fa-car' },
          { lbl: 'Valor da frota', val: formatBRL(totalFrota), cor: 'var(--sage)', ic: 'fa-sack-dollar' },
          { lbl: 'Alertas (IPVA/seguro)', val: String(alertas), cor: alertas > 0 ? '#B0413E' : 'var(--sage)', ic: 'fa-triangle-exclamation' },
        ].map(k => (
          <div key={k.lbl} className="kpi" style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink-mut)', textTransform: 'uppercase', letterSpacing: '.08em' }}>{k.lbl}</span>
              <i className={`fa-solid ${k.ic}`} style={{ fontSize: 12, color: k.cor }} />
            </div>
            <div style={{ fontSize: 21, fontWeight: 700, color: k.cor, marginTop: 8, fontVariantNumeric: 'tabular-nums' }}>{k.val}</div>
          </div>
        ))}
      </div>

      {veiculos.length === 0 ? (
        <div className="txs-card" style={{ padding: 44, textAlign: 'center' }}>
          <i className="fa-solid fa-car-side" style={{ fontSize: 28, color: 'var(--sage)', marginBottom: 12 }} />
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>Cadastre sua frota</div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-mut)', maxWidth: 420, margin: '0 auto 14px' }}>Registre os veículos com valor, IPVA e seguro — e lance as despesas direto na DRE.</div>
          <button className="btn-action" style={{ fontSize: 12 }} onClick={abrirNovo}><i className="fa-solid fa-plus" style={{ marginRight: 6 }} />Novo veículo</button>
        </div>
      ) : (
        <div className="txs-card">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 140px 140px 150px', gap: 12, padding: '11px 18px', borderBottom: '1px solid var(--line)', background: 'var(--surface-2)', fontSize: 10, fontWeight: 600, color: 'var(--ink-mut)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
            <span>Veículo</span><span style={{ textAlign: 'right' }}>Valor</span><span>IPVA vence</span><span>Seguro vence</span><span />
          </div>
          {veiculos.map((v, i) => {
            const dIpva = diasAte(v.ipva_venc); const dSeg = diasAte(v.seguro_venc)
            const vencCor = (d: number | null) => d === null ? 'var(--ink-mut)' : d < 0 ? '#B0413E' : d <= 30 ? 'var(--gold)' : 'var(--ink-soft)'
            const fmtVenc = (dt: string, d: number | null) => !dt ? '—' : `${dt.split('-').reverse().join('/')}${d !== null && d <= 30 ? (d < 0 ? ' (vencido)' : ` (${d}d)`) : ''}`
            return (
              <div key={v.id} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 140px 140px 150px', gap: 12, alignItems: 'center', padding: '12px 18px', borderBottom: i < veiculos.length - 1 ? '1px solid var(--line-soft)' : 'none' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>{v.modelo || 'Veículo'} {v.placa && <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--sage-deep)', background: 'var(--sage-tint)', padding: '1px 7px', borderRadius: 5, marginLeft: 6 }}>{v.placa}</span>}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-mut)' }}>{[v.marca, v.ano, v.cor].filter(Boolean).join(' · ') || '—'}</div>
                </div>
                <span style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{formatBRL(v.valor)}</span>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: vencCor(dIpva) }}>{fmtVenc(v.ipva_venc, dIpva)}</span>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: vencCor(dSeg) }}>{fmtVenc(v.seguro_venc, dSeg)}</span>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <button className="btn-action" title="Lançar despesa" style={{ fontSize: 11, padding: '6px 10px' }} onClick={() => setDespFor(v)}><i className="fa-solid fa-money-bill-wave" /></button>
                  <button className="btn-ghost" title="Editar" style={{ fontSize: 11, padding: '6px 10px' }} onClick={() => abrirEdit(v)}><i className="fa-solid fa-pen" /></button>
                  <button className="btn-ghost" title="Excluir" style={{ fontSize: 11, padding: '6px 10px', color: '#B0413E', borderColor: '#B0413E' }} onClick={() => excluir(v.id)}><i className="fa-solid fa-trash-can" /></button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal despesa */}
      {despFor && (
        <div className="modal-bg" onClick={() => setDespFor(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div className="modal-title">Lançar despesa do veículo</div>
              <button className="modal-close" onClick={() => setDespFor(null)}><i className="fa-solid fa-xmark" /></button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-mut)', marginBottom: 16 }}>{despFor.modelo} {despFor.placa}. Entra como saída na DRE (categoria &quot;Veículos&quot;).</div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Tipo</label><select className="form-input" value={desp.tipo} onChange={e => setDesp(d => ({ ...d, tipo: e.target.value }))}>{TIPOS_DESP.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
              <div className="form-group"><label className="form-label">Valor (R$)</label><input className="form-input" type="number" step="0.01" value={desp.valor} onChange={e => setDesp(d => ({ ...d, valor: e.target.value }))} /></div>
            </div>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setDespFor(null)}>Cancelar</button>
              <button className="btn-action" disabled={busy} onClick={() => void lancarDespesa()}>Lançar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal cadastro */}
      {show && (
        <div className="modal-bg" onClick={() => setShow(false)}>
          <div className="modal-box" style={{ width: 580 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div className="modal-title">{editId ? 'Editar veículo' : 'Novo veículo'}</div>
              <button className="modal-close" onClick={() => setShow(false)}><i className="fa-solid fa-xmark" /></button>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Modelo</label><input className="form-input" placeholder="Ex: Hilux SW4" value={form.modelo} onChange={e => setForm(f => ({ ...f, modelo: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">Placa</label><input className="form-input" value={form.placa} onChange={e => setForm(f => ({ ...f, placa: e.target.value.toUpperCase() }))} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Marca</label><input className="form-input" value={form.marca} onChange={e => setForm(f => ({ ...f, marca: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">Ano</label><input className="form-input" value={form.ano} onChange={e => setForm(f => ({ ...f, ano: e.target.value }))} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Cor</label><input className="form-input" value={form.cor} onChange={e => setForm(f => ({ ...f, cor: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">Renavam</label><input className="form-input" value={form.renavam} onChange={e => setForm(f => ({ ...f, renavam: e.target.value }))} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Valor (FIPE/aquisição)</label><input className="form-input" type="number" step="0.01" value={form.valor || ''} onChange={e => setForm(f => ({ ...f, valor: Number(e.target.value) }))} /></div>
              <div className="form-group"><label className="form-label">KM atual</label><input className="form-input" type="number" value={form.km || ''} onChange={e => setForm(f => ({ ...f, km: Number(e.target.value) }))} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">IPVA (R$)</label><input className="form-input" type="number" step="0.01" value={form.ipva || ''} onChange={e => setForm(f => ({ ...f, ipva: Number(e.target.value) }))} /></div>
              <div className="form-group"><label className="form-label">IPVA vence</label><input className="form-input" type="date" value={form.ipva_venc} onChange={e => setForm(f => ({ ...f, ipva_venc: e.target.value }))} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Seguro (R$)</label><input className="form-input" type="number" step="0.01" value={form.seguro || ''} onChange={e => setForm(f => ({ ...f, seguro: Number(e.target.value) }))} /></div>
              <div className="form-group"><label className="form-label">Seguro vence</label><input className="form-input" type="date" value={form.seguro_venc} onChange={e => setForm(f => ({ ...f, seguro_venc: e.target.value }))} /></div>
            </div>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setShow(false)}>Cancelar</button>
              <button className="btn-action" onClick={salvar}>{editId ? 'Salvar' : 'Cadastrar'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
