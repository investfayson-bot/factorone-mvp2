'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { formatBRL } from '@/lib/currency-brl'
import Modal from '@/components/ui/Modal'
import VoltarSolucao from '@/components/dashboard/VoltarSolucao'

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

type Tab = 'pendentes' | 'aprovados' | 'pagar' | 'todos'

const CATEGORIAS = [
  { label: 'Viagens',               icon: 'fa-plane' },
  { label: 'Alimentação',           icon: 'fa-utensils' },
  { label: 'Material de Escritório',icon: 'fa-box-archive' },
  { label: 'Tecnologia',            icon: 'fa-laptop' },
  { label: 'Hospedagem',            icon: 'fa-bed' },
  { label: 'Transporte',            icon: 'fa-car' },
  { label: 'Outros',                icon: 'fa-cube' },
]

export default function ReembolsosPage() {
  const [empresaId, setEmpresaId] = useState('')
  const [userId, setUserId]       = useState('')
  const [userName, setUserName]   = useState('')
  const [rows, setRows]           = useState<Reembolso[]>([])
  const [loading, setLoading]     = useState(true)
  const [tab, setTab]             = useState<Tab>('pendentes')
  const [modalOpen, setModalOpen] = useState(false)
  const [salvando, setSalvando]   = useState(false)
  const [atualizando, setAtualizando] = useState<string | null>(null)
  const [arquivo, setArquivo]     = useState<File | null>(null)
  const [modalMotivo, setModalMotivo] = useState<{ id: string; descricao: string } | null>(null)
  const [motivo, setMotivo]       = useState('')
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
    const { data: { session } } = await supabase.auth.getSession()
    await fetch('/api/notificacoes/aprovacao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
      body: JSON.stringify({ tipo, item_id, tabela: 'reembolsos' }),
    }).catch(() => {})
  }

  async function criarNotifInApp(titulo: string, mensagem: string) {
    if (!empresaId) return
    await supabase.from('notificacoes').insert({ empresa_id: empresaId, titulo, mensagem, tipo: 'sucesso', modulo: 'reembolsos', link: '/dashboard/reembolsos' })
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
    void criarNotifInApp('Reembolso aprovado', 'Aguardando registro de pagamento.')
    setAtualizando(null)
  }

  function abrirMotivo(id: string, descricao: string) {
    setMotivo('')
    setModalMotivo({ id, descricao })
  }

  async function confirmarRejeicao() {
    if (!modalMotivo) return
    const { id } = modalMotivo
    const m = motivo.trim() || 'Rejeitado pelo gestor'
    setAtualizando(id)
    await supabase.from('reembolsos').update({ status: 'rejeitado', rejeitado_motivo: m }).eq('id', id)
    setRows(prev => prev.map(r => r.id === id ? { ...r, status: 'rejeitado' } : r))
    toast('Reembolso rejeitado')
    void notificar('reembolso_rejeitado', id)
    void criarNotifInApp('Reembolso rejeitado', `Motivo: ${m}`)
    setAtualizando(null)
    setModalMotivo(null)
  }

  async function aprovarLotePendentes() {
    const pend = rows.filter(r => r.status === 'pendente')
    for (const r of pend) await aprovar(r.id)
    toast.success(`${pend.length} reembolsos aprovados`)
  }

  function exportarCSV() {
    const cols = ['Data', 'Solicitante', 'Descricao', 'Categoria', 'Valor', 'Status']
    const csvRows = rows.map(r => [
      r.data_despesa ?? r.created_at.slice(0, 10),
      r.solicitante_nome ?? '',
      `"${r.descricao.replace(/"/g, '""')}"`,
      r.categoria,
      String(r.valor),
      r.status,
    ].join(';'))
    const bom = '﻿'
    const content = bom + [cols.join(';'), ...csvRows].join('\r\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
    a.download = `reembolsos_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
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

  const nPendentes = rows.filter(r => r.status === 'pendente').length
  const nAprovados = rows.filter(r => r.status === 'aprovado').length
  const nPagos     = rows.filter(r => r.status === 'pago').length
  const totalPend  = rows.filter(r => r.status === 'pendente').reduce((s, r) => s + Number(r.valor), 0)

  const rowsFiltrados = tab === 'pendentes' ? rows.filter(r => r.status === 'pendente')
    : tab === 'aprovados' ? rows.filter(r => r.status === 'aprovado')
    : tab === 'pagar'     ? rows.filter(r => r.status === 'aprovado')
    : rows

  function statusTag(s: string) {
    const map: Record<string, [string, string]> = {
      pendente:  ['rgba(176,138,62,.12)',  'var(--gold)'],
      aprovado:  ['rgba(61,122,110,.12)', 'var(--teal2)'],
      pago:      ['rgba(61,122,110,.12)', 'var(--green)'],
      rejeitado: ['rgba(176,65,62,.08)', 'var(--red)'],
    }
    const [bg, color] = map[s] ?? ['#f1f5f9', '#64748b']
    return <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 20, background: bg, color, fontWeight: 600 }}>{s.charAt(0).toUpperCase() + s.slice(1)}</span>
  }

  return (
    <>
      <VoltarSolucao href="/dashboard/financeiro/visao-geral" label="Financeiro" />
      <div className="page-hdr">
        <div>
          <div className="page-title">Reembolsos</div>
          <div className="page-sub">{nPendentes} pendentes · lançamento automático no DRE ao pagar</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-action btn-ghost" onClick={exportarCSV}>
            <i className="fa-solid fa-file-csv" style={{ marginRight: 5 }} />CSV
          </button>
          {nPendentes > 0 && (
            <button className="btn-action btn-ghost" onClick={() => void aprovarLotePendentes()}>
              <i className="fa-solid fa-check-double" style={{ marginRight: 5 }} />Aprovar todos
            </button>
          )}
          <button className="btn-action" onClick={() => setModalOpen(true)}>+ Solicitar reembolso</button>
        </div>
      </div>

      <div className="kpis" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 16 }}>
        <div className="kpi">
          <div className="kpi-lbl">Pendentes</div>
          <div className="kpi-val" style={{ color: nPendentes > 0 ? 'var(--gold)' : 'var(--green)' }}>{nPendentes}</div>
          <div className="kpi-delta">{formatBRL(totalPend)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Aprovados</div>
          <div className="kpi-val" style={{ color: 'var(--teal)' }}>{nAprovados}</div>
          <div className="kpi-delta">aguardando pagamento</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Pagos</div>
          <div className="kpi-val" style={{ color: 'var(--green)' }}>{nPagos}</div>
          <div className="kpi-delta up">lançados no DRE</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Total</div>
          <div className="kpi-val">{rows.length}</div>
          <div className="kpi-delta">solicitações</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {([['pendentes', `Pendentes (${nPendentes})`], ['aprovados', `Aprovados (${nAprovados})`], ['pagar', `A pagar (${nAprovados})`], ['todos', 'Todos']] as [Tab, string][]).map(([k, l]) => (
          <button key={k} className={`btn-action${tab !== k ? ' btn-ghost' : ''}`} style={{ fontSize: 13, padding: '5px 12px' }} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: 16 }}>
        {loading && <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--gray-400)', fontSize: 15 }}>Carregando...</div>}
        {!loading && rowsFiltrados.length === 0 && (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--gray-400)', fontSize: 15 }}>
            <i className="fa-solid fa-inbox" style={{ fontSize: 28, marginBottom: 10, display: 'block' }} />
            Nenhum reembolso nesta categoria
          </div>
        )}
        {rowsFiltrados.map((item, idx) => {
          const bloqueado = atualizando === item.id
          const initials = (item.solicitante_nome || 'U').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
          return (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: idx < rowsFiltrados.length - 1 ? '1px solid var(--gray-100)' : 'none', opacity: bloqueado ? 0.5 : 1 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: 'var(--gray-500)', flexShrink: 0 }}>
                {initials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--navy)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.solicitante_nome ? `${item.solicitante_nome} — ` : ''}{item.descricao}
                </div>
                <div style={{ fontSize: 13, color: 'var(--gray-400)' }}>
                  {item.categoria}{item.data_despesa ? ` · ${new Date(item.data_despesa + 'T12:00:00').toLocaleDateString('pt-BR')}` : ''}
                </div>
              </div>
              <div style={{ textAlign: 'right', marginRight: 8 }}>
                <div style={{ fontWeight: 700, fontFamily: "var(--font-sans)", color: 'var(--navy)', marginBottom: 3 }}>{formatBRL(Number(item.valor))}</div>
                {statusTag(item.status)}
              </div>
              <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexShrink: 0 }}>
                {item.comprovante_url && (
                  <button onClick={() => void abrirComprovante(item.comprovante_url!)} title="Ver comprovante" style={{ background: 'rgba(61,122,110,.1)', color: 'var(--teal)', border: '1px solid rgba(61,122,110,.2)', borderRadius: 7, padding: '4px 8px', fontSize: 12.5, cursor: 'pointer' }}>
                    <i className="fa-solid fa-paperclip" />
                  </button>
                )}
                {item.status === 'pendente' && (
                  <>
                    <button disabled={bloqueado} onClick={() => void aprovar(item.id)} style={{ background: 'rgba(61,122,110,.1)', color: 'var(--green)', border: '1px solid rgba(61,122,110,.25)', borderRadius: 7, padding: '4px 10px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      <i className="fa-solid fa-check" style={{ marginRight: 4 }} />Aprovar
                    </button>
                    <button disabled={bloqueado} onClick={() => abrirMotivo(item.id, item.descricao)} style={{ background: 'rgba(176,65,62,.08)', color: 'var(--red)', border: '1px solid rgba(176,65,62,.2)', borderRadius: 7, padding: '4px 8px', fontSize: 13, cursor: 'pointer' }}>
                      <i className="fa-solid fa-xmark" />
                    </button>
                  </>
                )}
                {item.status === 'aprovado' && (
                  <button disabled={bloqueado} onClick={() => void marcarPago(item)} style={{ background: 'rgba(61,122,110,.1)', color: 'var(--green)', border: '1px solid rgba(61,122,110,.2)', borderRadius: 7, padding: '4px 10px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    <i className="fa-solid fa-money-bill" style={{ marginRight: 4 }} />Pagar
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal motivo rejeição */}
      {modalMotivo && (
        <div className="modal-bg" onClick={() => setModalMotivo(null)}>
          <div className="modal-box" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 className="modal-title">Rejeitar reembolso</h3>
              <button className="modal-close" onClick={() => setModalMotivo(null)}><i className="fa-solid fa-xmark" /></button>
            </div>
            <p style={{ fontSize: 15, color: 'var(--gray-500)', marginBottom: 14 }}><strong>{modalMotivo.descricao}</strong></p>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-500)', display: 'block', marginBottom: 6 }}>Motivo da rejeição</label>
            <textarea style={{ width: '100%', border: '1px solid var(--gray-100)', borderRadius: 8, padding: '8px 12px', fontSize: 15, minHeight: 80, resize: 'vertical', boxSizing: 'border-box' }} placeholder="Descreva o motivo (opcional)" value={motivo} onChange={e => setMotivo(e.target.value)} />
            <div className="modal-actions" style={{ marginTop: 16 }}>
              <button className="btn-ghost" onClick={() => setModalMotivo(null)}>Cancelar</button>
              <button className="btn-action" style={{ background: 'var(--red)', border: 'none' }} onClick={() => void confirmarRejeicao()}>
                <i className="fa-solid fa-xmark" style={{ marginRight: 5 }} />Confirmar rejeição
              </button>
            </div>
          </div>
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Solicitar Reembolso"
        footer={
          <>
            <button className="btn-action btn-ghost" onClick={() => setModalOpen(false)}>Cancelar</button>
            <button className="btn-action" onClick={() => void solicitar()} disabled={salvando}>{salvando ? 'Enviando...' : 'Enviar solicitacao'}</button>
          </>
        }
      >
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 7 }}>
                {CATEGORIAS.map((c) => (
                  <button
                    key={c.label}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, categoria: c.label }))}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                      padding: '9px 6px', borderRadius: 9, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                      border: form.categoria === c.label ? '2px solid var(--teal)' : '1px solid var(--gray-100)',
                      background: form.categoria === c.label ? 'rgba(61,122,110,0.08)' : '#fafafa',
                      color: form.categoria === c.label ? 'var(--teal)' : 'var(--gray-500)',
                      transition: 'all 0.15s',
                    }}
                  >
                    <i className={`fa-solid ${c.icon}`} style={{ fontSize: 16 }} />
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Observacao (opcional)</label>
              <textarea className="form-input" rows={2} placeholder="Detalhes adicionais..." value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Comprovante (opcional)</label>
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{ border: '1.5px dashed var(--gray-200)', borderRadius: 9, padding: '12px 14px', cursor: 'pointer', background: arquivo ? 'rgba(61,122,110,.04)' : '#fafafa', display: 'flex', alignItems: 'center', gap: 10 }}
              >
                <i className={`fa-solid ${arquivo ? 'fa-paperclip' : 'fa-cloud-arrow-up'}`} style={{ fontSize: 16, color: arquivo ? 'var(--green)' : 'var(--gray-400)' }} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: arquivo ? 'var(--green)' : 'var(--navy)' }}>
                    {arquivo ? arquivo.name : 'Anexar recibo ou nota fiscal'}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--gray-400)' }}>
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
      </Modal>
    </>
  )
}
