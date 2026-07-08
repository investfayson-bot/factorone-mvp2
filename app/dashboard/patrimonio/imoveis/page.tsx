'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'
import toast from 'react-hot-toast'

/**
 * Patrimônio → Imóveis (modelo do Excel do Fayson).
 * Imóveis agrupados por empreendimento. O aluguel dos ocupados vira RECEITA
 * no Fluxo de Caixa / DRE (grava em `transacoes` via /api/transacoes/criar).
 * v1: imóveis persistem em localStorage (por empresa) até criarmos a tabela.
 */

type Imovel = {
  id: string
  empreendimento: string
  unidade: string
  tipo: string
  finalidade: 'Comercial' | 'Residencial'
  endereco: string
  cidade: string
  area: number
  aluguel: number
  iptu: number
  condominio: number
  locatario: string
  ocupada: boolean
  vgv: number
  reajustes?: { data: string; de: number; para: number }[]
}

const TIPOS = ['Loja', 'Sala', 'Apartamento', 'Casa', 'Galpão', 'Terreno', 'Kitnet', 'Outro']
const VAZIO: Omit<Imovel, 'id'> = { empreendimento: '', unidade: '', tipo: 'Loja', finalidade: 'Comercial', endereco: '', cidade: '', area: 0, aluguel: 0, iptu: 0, condominio: 0, locatario: '', ocupada: true, vgv: 0 }

export default function ImoveisPage() {
  const [empresaId, setEmpresaId] = useState('')
  const [token, setToken] = useState('')
  const [imoveis, setImoveis] = useState<Imovel[]>([])
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<Omit<Imovel, 'id'>>({ ...VAZIO })
  const [editId, setEditId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [reajusteFor, setReajusteFor] = useState<Imovel | null>(null)
  const [reajPct, setReajPct] = useState('')

  const [dbOk, setDbOk] = useState(false)
  const chave = useCallback((eid: string) => `fo_imoveis_${eid}`, [])

  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: sess } = await supabase.auth.getSession()
      const tk = sess.session?.access_token ?? ''
      setToken(tk)
      const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
      const eid = (u?.empresa_id as string) ?? user.id
      setEmpresaId(eid)
      // DB-first; se a tabela ainda não existe, cai pro localStorage.
      try {
        const r = await fetch('/api/patrimonio/imoveis', { headers: tk ? { Authorization: `Bearer ${tk}` } : {} })
        const j = await r.json()
        if (j.ok) { setDbOk(true); setImoveis((j.imoveis ?? []) as Imovel[]); return }
      } catch { /* fallback abaixo */ }
      try { const raw = localStorage.getItem(chave(eid)); if (raw) setImoveis(JSON.parse(raw) as Imovel[]) } catch { /* ignore */ }
    })()
  }, [chave])

  function persistir(next: Imovel[]) {
    setImoveis(next)
    if (dbOk) {
      void fetch('/api/patrimonio/imoveis', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ imoveis: next }) })
        .then(r => { if (!r.ok) toast.error('Falha ao salvar no banco') })
    } else {
      try { localStorage.setItem(chave(empresaId), JSON.stringify(next)) } catch { /* ignore */ }
    }
  }

  function abrirNovo() { setForm({ ...VAZIO }); setEditId(null); setShowModal(true) }
  function abrirEdit(im: Imovel) { const { id, ...rest } = im; void id; setForm(rest); setEditId(im.id); setShowModal(true) }
  function salvar() {
    if (!form.empreendimento.trim() || !form.unidade.trim()) { toast.error('Informe empreendimento e unidade'); return }
    if (editId) persistir(imoveis.map(i => i.id === editId ? { ...form, id: editId } : i))
    else persistir([...imoveis, { ...form, id: crypto.randomUUID() }])
    setShowModal(false); toast.success(editId ? 'Imóvel atualizado' : 'Imóvel cadastrado')
  }
  function excluir(id: string) { if (window.confirm('Excluir este imóvel?')) persistir(imoveis.filter(i => i.id !== id)) }

  function aplicarReajuste() {
    if (!reajusteFor) return
    const pct = Number(reajPct)
    if (!pct) { toast.error('Informe o percentual'); return }
    const de = reajusteFor.aluguel
    const para = Math.round(de * (1 + pct / 100) * 100) / 100
    persistir(imoveis.map(i => i.id === reajusteFor.id
      ? { ...i, aluguel: para, reajustes: [...(i.reajustes ?? []), { data: new Date().toISOString().slice(0, 10), de, para }] }
      : i))
    toast.success(`Aluguel reajustado: ${formatBRL(de)} → ${formatBRL(para)}`)
    setReajusteFor(null); setReajPct('')
  }

  // Lança o aluguel do imóvel como RECEITA no fluxo (transacoes → DRE/Fluxo)
  async function lancarAluguel(im: Imovel) {
    if (im.aluguel <= 0) { toast.error('Defina o valor do aluguel'); return }
    setBusy(true)
    try {
      const r = await fetch('/api/transacoes/criar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ descricao: `Aluguel — ${im.unidade}${im.locatario ? ' · ' + im.locatario : ''}`, valor: im.aluguel, tipo: 'entrada', categoria: 'Receita de aluguel' }),
      })
      if (!r.ok) throw new Error((await r.json()).error || 'Falha')
      toast.success('Aluguel lançado no Fluxo/DRE ✓')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro') }
    finally { setBusy(false) }
  }
  async function lancarTodos() {
    const ocupados = imoveis.filter(i => i.ocupada && i.aluguel > 0)
    if (ocupados.length === 0) { toast.error('Nenhum imóvel ocupado com aluguel'); return }
    if (!window.confirm(`Lançar o aluguel de ${ocupados.length} imóveis ocupados como receita do mês?`)) return
    setBusy(true)
    let n = 0
    for (const im of ocupados) {
      try {
        const r = await fetch('/api/transacoes/criar', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ descricao: `Aluguel — ${im.unidade}${im.locatario ? ' · ' + im.locatario : ''}`, valor: im.aluguel, tipo: 'entrada', categoria: 'Receita de aluguel' }) })
        if (r.ok) n++
      } catch { /* ignore */ }
    }
    setBusy(false); toast.success(`${n} aluguéis lançados no Fluxo/DRE`)
  }

  const grupos = useMemo(() => {
    const m = new Map<string, Imovel[]>()
    for (const im of imoveis) { const k = im.empreendimento || 'Sem empreendimento'; if (!m.has(k)) m.set(k, []); m.get(k)!.push(im) }
    return Array.from(m.entries())
  }, [imoveis])

  const totalAluguel = imoveis.filter(i => i.ocupada).reduce((s, i) => s + Number(i.aluguel), 0)
  const ocupacao = imoveis.length ? Math.round((imoveis.filter(i => i.ocupada).length / imoveis.length) * 100) : 0
  const vgv = imoveis.reduce((s, i) => s + Number(i.vgv || 0), 0)

  const inp: React.CSSProperties = { }

  return (
    <>
      <div className="page-hdr">
        <div>
          <div className="page-title">Imóveis</div>
          <div className="page-sub">Sua carteira por empreendimento. O aluguel vira receita no Fluxo de Caixa e na DRE.</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-ghost" style={{ fontSize: 14 }} disabled={busy} onClick={() => void lancarTodos()}>
            <i className="fa-solid fa-money-bill-trend-up" style={{ marginRight: 6, color: 'var(--sage)' }} />Lançar aluguéis do mês
          </button>
          <button className="btn-action" style={{ fontSize: 14 }} onClick={abrirNovo}>
            <i className="fa-solid fa-plus" style={{ marginRight: 6 }} />Novo imóvel
          </button>
        </div>
      </div>

      {/* Resumo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 18 }}>
        {[
          { lbl: 'Imóveis', val: String(imoveis.length), cor: 'var(--navy)', ic: 'fa-building' },
          { lbl: 'Aluguel / mês', val: formatBRL(totalAluguel), cor: 'var(--sage)', ic: 'fa-money-bill-wave' },
          { lbl: 'Ocupação', val: `${ocupacao}%`, cor: ocupacao >= 80 ? 'var(--sage)' : 'var(--gold)', ic: 'fa-house-circle-check' },
          { lbl: 'VGV estimado', val: formatBRL(vgv), cor: 'var(--navy)', ic: 'fa-chart-line' },
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

      {imoveis.length === 0 ? (
        <div className="txs-card" style={{ padding: 44, textAlign: 'center' }}>
          <i className="fa-solid fa-building" style={{ fontSize: 28, color: 'var(--sage)', marginBottom: 12 }} />
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>Sua carteira de imóveis começa aqui</div>
          <div style={{ fontSize: 14.5, color: 'var(--ink-mut)', maxWidth: 420, margin: '0 auto 14px' }}>Cadastre o primeiro imóvel — agrupe por empreendimento e deixe o aluguel alimentar seus números automaticamente.</div>
          <button className="btn-action" style={{ fontSize: 14 }} onClick={abrirNovo}><i className="fa-solid fa-plus" style={{ marginRight: 6 }} />Novo imóvel</button>
        </div>
      ) : grupos.map(([emp, lista]) => {
        const sub = lista.filter(i => i.ocupada).reduce((s, i) => s + Number(i.aluguel), 0)
        return (
          <div key={emp} className="txs-card" style={{ marginBottom: 14, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', background: 'var(--surface-2)', borderBottom: '1px solid var(--line)' }}>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--ink)' }}><i className="fa-solid fa-city" style={{ marginRight: 8, color: 'var(--sage-deep)' }} />{emp}</div>
              <div style={{ fontSize: 13.5, color: 'var(--ink-mut)' }}>{lista.length} un. · <b style={{ color: 'var(--sage-deep)' }}>{formatBRL(sub)}/mês</b></div>
            </div>
            {lista.map((im, i) => (
              <div key={im.id} style={{ display: 'grid', gridTemplateColumns: '1fr 130px 120px 150px', gap: 12, alignItems: 'center', padding: '12px 18px', borderBottom: i < lista.length - 1 ? '1px solid var(--line-soft)' : 'none' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink)' }}>{im.unidade} <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink-mut)' }}>· {im.tipo}</span></div>
                  <div style={{ fontSize: 13, color: 'var(--ink-mut)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{im.locatario || 'Sem locatário'}{im.cidade ? ` · ${im.cidade}` : ''}</div>
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{formatBRL(im.aluguel)}</div>
                <span style={{ justifySelf: 'start', fontSize: 11.5, fontWeight: 600, padding: '3px 9px', borderRadius: 100, textTransform: 'uppercase', letterSpacing: '.05em', color: im.ocupada ? 'var(--sage-deep)' : 'var(--gold)', background: im.ocupada ? 'var(--sage-tint)' : 'var(--gold-tint)' }}>{im.ocupada ? 'Ocupada' : 'Vaga'}</span>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <button className="btn-ghost" title="Lançar aluguel no fluxo" style={{ fontSize: 13, padding: '6px 10px' }} disabled={busy || !im.ocupada} onClick={() => void lancarAluguel(im)}><i className="fa-solid fa-money-bill-trend-up" /></button>
                  <button className="btn-ghost" title="Reajustar aluguel" style={{ fontSize: 13, padding: '6px 10px' }} onClick={() => { setReajusteFor(im); setReajPct('') }}><i className="fa-solid fa-arrow-trend-up" /></button>
                  <button className="btn-ghost" title="Editar" style={{ fontSize: 13, padding: '6px 10px' }} onClick={() => abrirEdit(im)}><i className="fa-solid fa-pen" /></button>
                  <button className="btn-ghost" title="Excluir" style={{ fontSize: 13, padding: '6px 10px', color: '#B0413E', borderColor: '#B0413E' }} onClick={() => excluir(im.id)}><i className="fa-solid fa-trash-can" /></button>
                </div>
              </div>
            ))}
          </div>
        )
      })}

      <div style={{ fontSize: 13, color: 'var(--ink-faint)', marginTop: 8, lineHeight: 1.6 }}>
        <i className="fa-solid fa-circle-info" style={{ color: 'var(--sage)', marginRight: 6 }} />
        &quot;Lançar aluguel&quot; cria uma receita no Fluxo de Caixa e na DRE, já classificada como <b>Receita de aluguel</b>. (v1: imóveis salvos neste navegador; migração pro banco em seguida.)
      </div>

      {/* Modal reajuste */}
      {reajusteFor && (
        <div className="modal-bg" onClick={() => setReajusteFor(null)}>
          <div className="modal-box" style={{ width: 420 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div className="modal-title">Reajustar aluguel</div>
              <button className="modal-close" onClick={() => setReajusteFor(null)}><i className="fa-solid fa-xmark" /></button>
            </div>
            <div style={{ fontSize: 14, color: 'var(--ink-mut)', marginBottom: 16 }}>{reajusteFor.unidade} · aluguel atual <b style={{ color: 'var(--ink)' }}>{formatBRL(reajusteFor.aluguel)}</b></div>
            <div className="form-group"><label className="form-label">Reajuste (%)</label><input className="form-input" type="number" step="0.01" placeholder="Ex: 4.5 (IGP-M/IPCA)" value={reajPct} onChange={e => setReajPct(e.target.value)} autoFocus /></div>
            {Number(reajPct) ? (
              <div style={{ fontSize: 14.5, color: 'var(--sage-deep)', fontWeight: 600, marginBottom: 8 }}>Novo aluguel: {formatBRL(Math.round(reajusteFor.aluguel * (1 + Number(reajPct) / 100) * 100) / 100)}</div>
            ) : null}
            {reajusteFor.reajustes && reajusteFor.reajustes.length > 0 && (
              <div style={{ fontSize: 13, color: 'var(--ink-mut)', marginBottom: 8 }}>Último: {reajusteFor.reajustes[reajusteFor.reajustes.length - 1].data.split('-').reverse().join('/')} · {formatBRL(reajusteFor.reajustes[reajusteFor.reajustes.length - 1].de)} → {formatBRL(reajusteFor.reajustes[reajusteFor.reajustes.length - 1].para)}</div>
            )}
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setReajusteFor(null)}>Cancelar</button>
              <button className="btn-action" onClick={aplicarReajuste}>Aplicar reajuste</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal cadastro/edição */}
      {showModal && (
        <div className="modal-bg" onClick={() => setShowModal(false)}>
          <div className="modal-box" style={{ width: 560 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div className="modal-title">{editId ? 'Editar imóvel' : 'Novo imóvel'}</div>
              <button className="modal-close" onClick={() => setShowModal(false)}><i className="fa-solid fa-xmark" /></button>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Empreendimento</label><input className="form-input" style={inp} placeholder="Ex: Ed. Centro / Av. Valadares" value={form.empreendimento} onChange={e => setForm(f => ({ ...f, empreendimento: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">Unidade / descrição</label><input className="form-input" placeholder="Ex: Loja 01" value={form.unidade} onChange={e => setForm(f => ({ ...f, unidade: e.target.value }))} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Tipo</label><select className="form-input" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>{TIPOS.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
              <div className="form-group"><label className="form-label">Finalidade</label><select className="form-input" value={form.finalidade} onChange={e => setForm(f => ({ ...f, finalidade: e.target.value as 'Comercial' | 'Residencial' }))}><option>Comercial</option><option>Residencial</option></select></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Endereço</label><input className="form-input" value={form.endereco} onChange={e => setForm(f => ({ ...f, endereco: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">Cidade/UF</label><input className="form-input" placeholder="Betim/MG" value={form.cidade} onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Aluguel (R$/mês)</label><input className="form-input" type="number" step="0.01" value={form.aluguel || ''} onChange={e => setForm(f => ({ ...f, aluguel: Number(e.target.value) }))} /></div>
              <div className="form-group"><label className="form-label">Locatário</label><input className="form-input" value={form.locatario} onChange={e => setForm(f => ({ ...f, locatario: e.target.value }))} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">IPTU anual (R$)</label><input className="form-input" type="number" step="0.01" value={form.iptu || ''} onChange={e => setForm(f => ({ ...f, iptu: Number(e.target.value) }))} /></div>
              <div className="form-group"><label className="form-label">Condomínio (R$)</label><input className="form-input" type="number" step="0.01" value={form.condominio || ''} onChange={e => setForm(f => ({ ...f, condominio: Number(e.target.value) }))} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Área (m²)</label><input className="form-input" type="number" step="0.01" value={form.area || ''} onChange={e => setForm(f => ({ ...f, area: Number(e.target.value) }))} /></div>
              <div className="form-group"><label className="form-label">VGV estimado (R$)</label><input className="form-input" type="number" step="0.01" value={form.vgv || ''} onChange={e => setForm(f => ({ ...f, vgv: Number(e.target.value) }))} /></div>
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14.5, color: 'var(--ink)', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.ocupada} onChange={e => setForm(f => ({ ...f, ocupada: e.target.checked }))} style={{ accentColor: 'var(--sage)' }} />
                Imóvel ocupado (gera receita de aluguel)
              </label>
            </div>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn-action" onClick={salvar}>{editId ? 'Salvar' : 'Cadastrar'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
