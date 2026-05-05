'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { formatBRL } from '@/lib/currency-brl'

type Reembolso = {
  id: string
  descricao: string
  valor: number
  categoria: string
  status: 'pendente' | 'aprovado' | 'rejeitado' | 'pago'
  data_despesa: string | null
  solicitante_nome: string | null
  observacao: string | null
  comprovante_url: string | null
  created_at: string
}

type NovoForm = {
  descricao: string
  valor: string
  categoria: string
  data_despesa: string
  observacao: string
}

const CATEGORIAS = ['Viagens', 'Alimentacao', 'Material de Escritorio', 'Tecnologia', 'Hospedagem', 'Transporte', 'Outros']

export default function ReembolsosPage() {
  const [empresaId, setEmpresaId] = useState('')
  const [userId, setUserId]       = useState('')
  const [userName, setUserName]   = useState('')
  const [rows, setRows]           = useState<Reembolso[]>([])
  const [loading, setLoading]     = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [salvando, setSalvando]   = useState(false)
  const [atualizando, setAtualizando] = useState<string | null>(null)
  const [arquivo, setArquivo]     = useState<File | null>(null)
  const fileInputRef              = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState<NovoForm>({
    descricao: '', valor: '', categoria: 'Viagens',
    data_despesa: new Date().toISOString().slice(0, 10), observacao: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) return
    setUserId(auth.user.id)
    const { data: u } = await supabase.from('usuarios').select('empresa_id,nome').eq('id', auth.user.id).maybeSingle()
    const eid = (u?.empresa_id as string) || auth.user.id
    setEmpresaId(eid)
    setUserName((u as { nome?: string })?.nome || auth.user.email?.split('@')[0] || '')
    const { data } = await supabase
      .from('reembolsos')
      .select('id,descricao,valor,categoria,status,data_despesa,solicitante_nome,observacao,comprovante_url,created_at')
      .eq('empresa_id', eid)
      .order('created_at', { ascending: false })
    setRows((data ?? []) as Reembolso[])
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  async function notificar(tipo: string, item_id: string) {
    await fetch('/api/notificacoes/aprovacao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, item_id, tabela: 'reembolsos' }),
    }).catch(() => {})
  }

  async function uploadComprovante(): Promise<string | null> {
    if (!arquivo) return null
    const path = `${empresaId}/${Date.now()}_${arquivo.name.replace(/[^\w.-]/g, '_')}`
    const { error } = await supabase.storage.from('comprovantes').upload(path, arquivo, { upsert: false })
    if (error) { toast.error(`Erro no upload: ${error.message}`); return null }
    return path
  }

  async function abrirComprovante(pathOrUrl: string) {
    if (pathOrUrl.startsWith('http')) { window.open(pathOrUrl, '_blank'); return }
    const { data, error } = await supabase.storage.from('comprovantes').createSignedUrl(pathOrUrl, 3600)
    if (error || !data?.signedUrl) { toast.error('Nao foi possivel abrir o comprovante'); return }
    window.open(data.signedUrl, '_blank')
  }

  async function solicitar() {
    const v = Number(form.valor.replace(',', '.'))
    if (!form.descricao.trim()) { toast.error('Descricao obrigatoria'); return }
    if (!v || v <= 0)           { toast.error('Valor invalido'); return }
    setSalvando(true)
    const comprovante_url = await uploadComprovante()
    const { data: inserted, error } = await supabase.from('reembolsos').insert({
      empresa_id: empresaId,
      solicitante_id: userId,
      solicitante_nome: userName,
      descricao: form.descricao.trim(),
      valor: v,
      categoria: form.categoria,
      data_despesa: form.data_despesa || null,
      observacao: form.observacao.trim() || null,
      comprovante_url: comprovante_url ?? null,
      status: 'pendente',
    }).select('id').single()
    if (error) { toast.error(error.message) }
    else {
      toast.success('Solicitacao enviada!')
      setModalOpen(false)
      setArquivo(null)
      setForm({ descricao: '', valor: '', categoria: 'Viagens', data_despesa: new Date().toISOString().slice(0, 10), observacao: '' })
      void load()
      if (inserted?.id) void notificar('reembolso_solicitado', inserted.id)
    }
    setSalvando(false)
  }

  async function aprovar(id: string) {
    setAtualizando(id)
    await supabase.from('reembolsos').update({ status: 'aprovado', aprovado_por: userId, aprovado_em: new Date().toISOString() }).eq('id', id)
    setRows(prev => prev.map(r => r.id === id ? { ...r, status: 'aprovado' } : r))
    toast.success('Reembolso aprovado')
    void notificar('reembolso_aprovado', id)
    setAtualizando(null)
  }

  async function rejeitar(id: string) {
    setAtualizando(id)
    await supabase.from('reembolsos').update({ status: 'rejeitado', rejeitado_motivo: 'Rejeitado pelo gestor' }).eq('id', id)
    setRows(prev => prev.map(r => r.id === id ? { ...r, status: 'rejeitado' } : r))
    toast('Reembolso rejeitado')
    void notificar('reembolso_rejeitado', id)
    setAtualizando(null)
  }

  async function marcarPago(item: Reembolso) {
    setAtualizando(item.id)
    const hoje = new Date().toISOString().slice(0, 10)
    const { data: tx } = await supabase.from('transacoes').insert({
      empresa_id: empresaId,
      data: hoje,
      descricao: `Reembolso: ${item.descricao}`,
      categoria: item.categoria,
      tipo: 'saida',
      valor: item.valor,
      status: 'confirmada',
    }).select('id').single()
    await supabase.from('reembolsos').update({ status: 'pago', pago_em: new Date().toISOString(), transaction_id: tx?.id ?? null }).eq('id', item.id)
    setRows(prev => prev.map(r => r.id === item.id ? { ...r, status: 'pago' } : r))
    toast.success(`Pagamento registrado para ${item.solicitante_nome || 'solicitante'}`)
    void notificar('reembolso_pago', item.id)
    setAtualizando(null)
  }

  const pendentes  = rows.filter(r => r.status === 'pendente').length
  const aprovados  = rows.filter(r => r.status === 'aprovado').length
  const pagos      = rows.filter(r => r.status === 'pago').length
  const totalPend  = rows.filter(r => r.status === 'pendente').reduce((s, r) => s + Number(r.valor), 0)

  function statusTag(s: string) {
    const map: Record<string, [string, string]> = {
      pendente:  ['rgba(184,146,42,.12)',  'var(--gold)'],
      aprovado:  ['rgba(94,140,135,.12)', 'var(--teal2)'],
      pago:      ['rgba(45,155,111,.12)', 'var(--green)'],
      rejeitado: ['rgba(192,80,74,.08)', 'var(--red)'],
    }
    const [bg, color] = map[s] ?? ['#f1f5f9', '#64748b']
    return <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: bg, color, fontWeight: 600 }}>{s.charAt(0).toUpperCase() + s.slice(1)}</span>
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 17, fontWeight: 700, color: 'var(--navy)' }}>Reembolsos</div>
          <div style={{ fontSize: 11, color: 'var(--gray-400)', fontFamily: "'DM Mono',monospace" }}>
            {pendentes} pendentes · registro automatico de transacao ao pagar
          </div>
        </div>
        <button className="btn-action" onClick={() => setModalOpen(true)}>+ Solicitar reembolso</button>
      </div>

      <div className="kpis">
        <div className="kpi">
          <div className="kpi-lbl">Pendentes</div>
          <div className="kpi-val" style={{ color: 'var(--gold)' }}>{pendentes}</div>
          <div className="kpi-delta warn">{formatBRL(totalPend)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Aprovados</div>
          <div className="kpi-val" style={{ color: 'var(--teal)' }}>{aprovados}</div>
          <div className="kpi-delta up">aguardando pagamento</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Pagos</div>
          <div className="kpi-val" style={{ color: 'var(--green)' }}>{pagos}</div>
          <div className="kpi-delta up">lancados no DRE</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Total</div>
          <div className="kpi-val">{rows.length}</div>
          <div className="kpi-delta">solicitacoes</div>
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--gray-400)', letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: "'DM Mono',monospace", marginBottom: 14 }}>
          Solicitacoes
        </div>

        {loading && <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--gray-400)', fontSize: 13 }}>Carregando...</div>}

        {!loading && rows.length === 0 && (
          <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--gray-400)', fontSize: 13 }}>
            Nenhuma solicitacao ainda. Clique em "+ Solicitar reembolso" para comecar.
          </div>
        )}

        {rows.map((item, idx) => {
          const bloqueado = atualizando === item.id
          const initials = (item.solicitante_nome || 'U').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
          return (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: idx < rows.length - 1 ? '1px solid var(--gray-100)' : 'none', opacity: bloqueado ? 0.5 : 1 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: 'var(--gray-500)', flexShrink: 0 }}>
                {initials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--navy)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.solicitante_nome ? `${item.solicitante_nome} — ` : ''}{item.descricao}
                </div>
                <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>
                  {item.categoria}{item.data_despesa ? ` · ${item.data_despesa.split('-').reverse().join('/')}` : ''}
                </div>
              </div>
              <div style={{ textAlign: 'right', marginRight: 12 }}>
                <div style={{ fontWeight: 700, fontFamily: "'DM Mono',monospace", color: 'var(--navy)', marginBottom: 3 }}>{formatBRL(Number(item.valor))}</div>
                {statusTag(item.status)}
              </div>
              <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                {item.comprovante_url && (
                  <button onClick={() => void abrirComprovante(item.comprovante_url!)} title="Ver comprovante" style={{ background: 'rgba(94,140,135,.1)', color: 'var(--teal2)', border: '1px solid rgba(94,140,135,.2)', borderRadius: 7, padding: '4px 8px', fontSize: 10.5, cursor: 'pointer' }}>
                    Comprovante
                  </button>
                )}
                {item.status === 'pendente' && (
                  <>
                    <button disabled={bloqueado} onClick={() => void aprovar(item.id)} style={{ background: 'rgba(45,155,111,.1)', color: 'var(--green)', border: '1px solid rgba(45,155,111,.25)', borderRadius: 7, padding: '4px 10px', fontSize: 10.5, fontWeight: 600, cursor: 'pointer' }}>Aprovar</button>
                    <button disabled={bloqueado} onClick={() => void rejeitar(item.id)} style={{ background: 'rgba(192,80,74,.08)', color: 'var(--red)', border: '1px solid rgba(192,80,74,.2)', borderRadius: 7, padding: '4px 8px', fontSize: 10.5, cursor: 'pointer' }}>Rejeitar</button>
                  </>
                )}
                {item.status === 'aprovado' && (
                  <button disabled={bloqueado} onClick={() => void marcarPago(item)} style={{ background: 'rgba(45,155,111,.1)', color: 'var(--green)', border: '1px solid rgba(45,155,111,.2)', borderRadius: 7, padding: '4px 10px', fontSize: 10.5, fontWeight: 600, cursor: 'pointer' }}>Registrar pagamento</button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {modalOpen && (
        <div className="modal-bg" onClick={() => setModalOpen(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-title">
              Solicitar Reembolso
              <button className="modal-close" onClick={() => setModalOpen(false)}>x</button>
            </div>
            <div className="form-group">
              <label className="form-label">Descricao</label>
              <input className="form-input" placeholder="Ex: Hotel Sao Paulo · 2 noites" value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Valor (R$)</label>
                <input className="form-input" type="number" placeholder="0.00" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Data da despesa</label>
                <input className="form-input" type="date" value={form.data_despesa} onChange={e => setForm(f => ({ ...f, data_despesa: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Categoria</label>
              <select className="form-input" value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
                {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Observacao (opcional)</label>
              <textarea className="form-input" rows={2} placeholder="Detalhes adicionais..." value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Comprovante (opcional)</label>
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{ border: '1.5px dashed var(--gray-200)', borderRadius: 9, padding: '12px 14px', cursor: 'pointer', background: arquivo ? 'rgba(45,155,111,.04)' : '#fafafa', display: 'flex', alignItems: 'center', gap: 10 }}
              >
                <span style={{ fontSize: 18 }}>{arquivo ? '📎' : '⬆️'}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: arquivo ? 'var(--green)' : 'var(--navy)' }}>
                    {arquivo ? arquivo.name : 'Anexar recibo ou nota fiscal'}
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--gray-400)' }}>
                    {arquivo ? `${(arquivo.size / 1024).toFixed(0)} KB` : 'JPG, PNG ou PDF · max 10 MB'}
                  </div>
                </div>
                {arquivo && (
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); setArquivo(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                    style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)', fontSize: 16, lineHeight: 1 }}
                  >×</button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                style={{ display: 'none' }}
                onChange={e => setArquivo(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="modal-actions">
              <button className="btn-action btn-ghost" onClick={() => setModalOpen(false)}>Cancelar</button>
              <button className="btn-action" onClick={() => void solicitar()} disabled={salvando}>{salvando ? 'Enviando...' : 'Enviar solicitacao'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
