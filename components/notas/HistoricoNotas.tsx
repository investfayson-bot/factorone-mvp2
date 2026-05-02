'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

export type NotaEmitidaRow = {
  id: string
  tipo: 'nfe' | 'nfse'
  numero: string | null
  destinatario_nome: string
  valor_total: number
  status: 'processando' | 'autorizada' | 'rejeitada' | 'cancelada'
  created_at: string
  xml_url: string | null
  pdf_url: string | null
  sefaz_motivo: string | null
}

const card: React.CSSProperties = { background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: 16, marginBottom: 14 }

function BadgeStatus({ r }: { r: NotaEmitidaRow }) {
  if (r.status === 'processando') return <span className="tag" style={{ background: 'rgba(184,146,42,.12)', color: 'var(--gold)' }}>⟳ Processando</span>
  if (r.status === 'autorizada') return <span className="tag" style={{ background: 'rgba(45,155,111,.12)', color: 'var(--green)' }}>✓ Autorizada</span>
  if (r.status === 'rejeitada') return <span className="tag" style={{ background: 'rgba(192,80,74,.1)', color: 'var(--red)' }} title={r.sefaz_motivo || ''}>✕ Rejeitada</span>
  return <span className="tag" style={{ background: 'var(--gray-100)', color: 'var(--gray-400)', textDecoration: 'line-through' }}>Cancelada</span>
}

export default function HistoricoNotas() {
  const [rows, setRows] = useState<NotaEmitidaRow[]>([])
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'nfe' | 'nfse'>('todos')
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7))
  const [emailModal, setEmailModal] = useState<{ id: string; email: string } | null>(null)
  const [cancelModal, setCancelModal] = useState<{ id: string; j: string } | null>(null)
  const [loadingEmail, setLoadingEmail] = useState(false)

  const carregar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: usrRow } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const empresaId = usrRow?.empresa_id ?? user.id
    const inicio = `${mes}-01`
    const [y, m] = mes.split('-').map(Number)
    const fimStr = new Date(y, m, 0).toISOString().slice(0, 10)
    let q = supabase
      .from('notas_emitidas')
      .select('id,tipo,numero,destinatario_nome,valor_total,status,created_at,xml_url,pdf_url,sefaz_motivo')
      .eq('empresa_id', empresaId)
      .gte('created_at', `${inicio}T00:00:00`)
      .lte('created_at', `${fimStr}T23:59:59`)
      .order('created_at', { ascending: false })
    if (filtroTipo !== 'todos') q = q.eq('tipo', filtroTipo)
    if (filtroStatus !== 'todos') q = q.eq('status', filtroStatus)
    const { data } = await q
    setRows((data ?? []) as NotaEmitidaRow[])
  }, [mes, filtroTipo, filtroStatus])

  useEffect(() => { void carregar() }, [carregar])

  const temProcessando = useMemo(() => rows.some((r) => r.status === 'processando'), [rows])
  useEffect(() => {
    if (!temProcessando) return
    const t = setInterval(() => { void carregar() }, 10000)
    return () => clearInterval(t)
  }, [temProcessando, carregar])

  async function enviarEmail() {
    if (!emailModal) return
    setLoadingEmail(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      await fetch('/api/notas/enviar-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({ nota_emitida_id: emailModal.id, email: emailModal.email }),
      })
      setEmailModal(null)
    } finally {
      setLoadingEmail(false)
    }
  }

  async function cancelar() {
    if (!cancelModal || cancelModal.j.trim().length < 15) return
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`/api/notas/cancelar/${cancelModal.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
      body: JSON.stringify({ justificativa: cancelModal.j }),
    })
    if (res.ok) { setCancelModal(null); void carregar() }
  }

  return (
    <div>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14, alignItems: 'flex-end' }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Tipo</label>
          <select className="form-input" style={{ width: 'auto' }} value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value as 'todos' | 'nfe' | 'nfse')}>
            <option value="todos">Todos</option>
            <option value="nfe">NF-e</option>
            <option value="nfse">NFS-e</option>
          </select>
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Status</label>
          <select className="form-input" style={{ width: 'auto' }} value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
            <option value="todos">Todos</option>
            <option value="processando">Processando</option>
            <option value="autorizada">Autorizada</option>
            <option value="rejeitada">Rejeitada</option>
            <option value="cancelada">Cancelada</option>
          </select>
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Mês</label>
          <input type="month" className="form-input" style={{ width: 'auto' }} value={mes} onChange={(e) => setMes(e.target.value)} />
        </div>
      </div>

      {/* Table */}
      <div style={{ ...card, overflow: 'hidden', padding: 0 }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--gray-50, #f8f9fa)' }}>
                {['Número', 'Tipo', 'Destinatário', 'Valor', 'Status', 'Data', 'Ações'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontSize: 10, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', fontFamily: "'DM Mono',monospace", borderBottom: '1px solid var(--gray-100)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--gray-400)', fontSize: 12 }}>Nenhuma nota emitida no período.</td></tr>
              ) : rows.map((r) => (
                <tr key={r.id} style={{ borderTop: '1px solid var(--gray-100)' }}>
                  <td style={{ padding: '10px 12px', color: 'var(--navy)', fontFamily: "'DM Mono',monospace" }}>{r.numero || '—'}</td>
                  <td style={{ padding: '10px 12px' }}><span className="tag" style={{ background: 'var(--gray-100)', color: 'var(--gray-400)' }}>{r.tipo === 'nfe' ? 'NF-e' : 'NFS-e'}</span></td>
                  <td style={{ padding: '10px 12px', color: 'var(--navy)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.destinatario_nome}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--navy)', fontFamily: "'DM Mono',monospace", fontWeight: 600 }}>
                    {Number(r.valor_total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                  <td style={{ padding: '10px 12px' }}><BadgeStatus r={r} /></td>
                  <td style={{ padding: '10px 12px', color: 'var(--gray-400)', whiteSpace: 'nowrap' }}>{new Date(r.created_at).toLocaleString('pt-BR')}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {r.xml_url && (
                        <a href={r.xml_url} target="_blank" rel="noreferrer" title="XML" style={{ padding: '4px 7px', borderRadius: 6, border: '1px solid var(--gray-100)', background: '#fff', color: 'var(--navy)', fontSize: 11, textDecoration: 'none' }}>XML</a>
                      )}
                      {r.pdf_url && (
                        <a href={r.pdf_url} target="_blank" rel="noreferrer" title="PDF" style={{ padding: '4px 7px', borderRadius: 6, border: '1px solid var(--gray-100)', background: '#fff', color: 'var(--navy)', fontSize: 11, textDecoration: 'none' }}>PDF</a>
                      )}
                      <button type="button" title="E-mail" onClick={() => setEmailModal({ id: r.id, email: '' })} style={{ padding: '4px 7px', borderRadius: 6, border: '1px solid var(--gray-100)', background: '#fff', color: 'var(--navy)', fontSize: 11, cursor: 'pointer' }}>✉</button>
                      {r.status !== 'cancelada' && r.status !== 'rejeitada' && (
                        <button type="button" title="Cancelar" onClick={() => setCancelModal({ id: r.id, j: '' })} style={{ padding: '4px 7px', borderRadius: 6, border: '1px solid rgba(192,80,74,.2)', background: '#fff', color: 'var(--red)', fontSize: 11, cursor: 'pointer' }}>✕</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Email modal */}
      {emailModal && (
        <div className="modal-bg" onClick={() => setEmailModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-title">
              Enviar por e-mail
              <button className="modal-close" onClick={() => setEmailModal(null)}>×</button>
            </div>
            <input type="email" className="form-input" placeholder="email@empresa.com" value={emailModal.email} onChange={(e) => setEmailModal({ ...emailModal, email: e.target.value })} style={{ marginBottom: 12 }} />
            <div className="modal-actions">
              <button type="button" className="btn-action btn-ghost" onClick={() => setEmailModal(null)}>Fechar</button>
              <button type="button" disabled={loadingEmail} className="btn-action" onClick={enviarEmail} style={{ opacity: loadingEmail ? .6 : 1 }}>Enviar</button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel modal */}
      {cancelModal && (
        <div className="modal-bg" onClick={() => setCancelModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-title">
              Cancelar nota
              <button className="modal-close" onClick={() => setCancelModal(null)}>×</button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 8 }}>Justificativa (mín. 15 caracteres)</div>
            <textarea className="form-input" value={cancelModal.j} onChange={(e) => setCancelModal({ ...cancelModal, j: e.target.value })} style={{ minHeight: 80, resize: 'vertical', marginBottom: 12 }} />
            <div className="modal-actions">
              <button type="button" className="btn-action btn-ghost" onClick={() => setCancelModal(null)}>Voltar</button>
              <button type="button" disabled={cancelModal.j.trim().length < 15} onClick={cancelar} style={{ background: 'var(--red)', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: cancelModal.j.trim().length < 15 ? .5 : 1 }}>Confirmar cancelamento</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
