'use client'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { formatBRL } from '@/lib/currency-brl'

type Despesa = {
  id: string
  descricao: string
  valor: number
  categoria: string
  status: string
  data_despesa: string | null
  responsavel_nome: string | null
  comprovante_url: string | null
  observacao: string | null
  aprovado_em: string | null
  rejeitado_motivo: string | null
}

type Tab = 'pendentes' | 'historico'

function nivel(valor: number) {
  if (valor <= 500)  return { label: 'Auto',    color: 'var(--green)',  bg: 'rgba(45,155,111,.1)' }
  if (valor <= 5000) return { label: 'Nível 1', color: 'var(--teal)',   bg: 'rgba(16,185,129,.12)' }
  return               { label: 'Nível 2',       color: '#7C3AED',       bg: 'rgba(124,58,237,.12)' }
}

export default function AprovacoesPage() {
  const [empresaId, setEmpresaId] = useState('')
  const [userId, setUserId]       = useState('')
  const [pendentes, setPendentes] = useState<Despesa[]>([])
  const [historico, setHistorico] = useState<Despesa[]>([])
  const [tab, setTab]             = useState<Tab>('pendentes')
  const [loading, setLoading]     = useState(true)
  const [atualizando, setAtualizando] = useState<string | null>(null)
  const [modalMotivo, setModalMotivo] = useState<{ id: string; descricao: string } | null>(null)
  const [motivo, setMotivo]       = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) return
    setUserId(auth.user.id)
    const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', auth.user.id).maybeSingle()
    const eid = (u?.empresa_id as string) || auth.user.id
    setEmpresaId(eid)
    const [pend, hist] = await Promise.all([
      supabase.from('despesas').select('id,descricao,valor,categoria,status,data_despesa,responsavel_nome,comprovante_url,observacao,aprovado_em,rejeitado_motivo').eq('empresa_id', eid).eq('status', 'pendente_aprovacao').order('data_despesa', { ascending: false }),
      supabase.from('despesas').select('id,descricao,valor,categoria,status,data_despesa,responsavel_nome,comprovante_url,observacao,aprovado_em,rejeitado_motivo').eq('empresa_id', eid).in('status', ['aprovado','rejeitado']).order('aprovado_em', { ascending: false }).limit(50),
    ])
    setPendentes((pend.data ?? []) as Despesa[])
    setHistorico((hist.data ?? []) as Despesa[])
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  async function notificar(tipo: string, item_id: string) {
    const { data: { session } } = await supabase.auth.getSession()
    await fetch('/api/notificacoes/aprovacao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
      body: JSON.stringify({ tipo, item_id, tabela: 'despesas' }),
    }).catch(() => {})
  }

  async function criarNotifInApp(titulo: string, mensagem: string, link: string) {
    if (!empresaId) return
    await supabase.from('notificacoes').insert({ empresa_id: empresaId, titulo, mensagem, tipo: 'sucesso', modulo: 'aprovacoes', link })
  }

  async function aprovar(id: string) {
    setAtualizando(id)
    const { error } = await supabase.from('despesas').update({ status: 'aprovado', aprovado_por: userId, aprovado_em: new Date().toISOString() }).eq('id', id)
    if (error) { toast.error(error.message) }
    else {
      toast.success('Despesa aprovada')
      setPendentes(prev => prev.filter(r => r.id !== id))
      void notificar('despesa_aprovada', id)
      void criarNotifInApp('Despesa aprovada', 'Uma despesa pendente foi aprovada.', '/dashboard/aprovacoes')
      void load()
    }
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
    const { error } = await supabase.from('despesas').update({ status: 'rejeitado', rejeitado_motivo: m }).eq('id', id)
    if (error) { toast.error(error.message) }
    else {
      toast('Despesa rejeitada')
      setPendentes(prev => prev.filter(r => r.id !== id))
      void notificar('despesa_rejeitada', id)
      void criarNotifInApp('Despesa rejeitada', `Motivo: ${m}`, '/dashboard/aprovacoes')
      void load()
    }
    setAtualizando(null)
    setModalMotivo(null)
  }

  async function aprovarLote() {
    const dentro = pendentes.filter(r => r.valor <= 5000)
    for (const d of dentro) await aprovar(d.id)
    toast.success(`${dentro.length} despesas aprovadas em lote`)
  }

  const totalPendente = pendentes.reduce((s, r) => s + Number(r.valor), 0)
  const aprovadas = historico.filter(h => h.status === 'aprovado').length
  const rejeitadas = historico.filter(h => h.status === 'rejeitado').length

  const inp: React.CSSProperties = { width: '100%', border: '1px solid var(--gray-100)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: 'var(--navy)', background: '#fff', boxSizing: 'border-box', outline: 'none' }

  return (
    <>
      <div className="page-hdr">
        <div>
          <div className="page-title">Central de Aprovações</div>
          <div className="page-sub">Política multi-nível · {pendentes.length} pendentes · {formatBRL(totalPendente)}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {pendentes.length > 0 && (
            <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => void aprovarLote()}>
              <i className="fa-solid fa-check-double" style={{ marginRight: 5 }} />Aprovar Nível 1 + Auto
            </button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="kpis" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 16 }}>
        <div className="kpi">
          <div className="kpi-lbl">Pendentes</div>
          <div className="kpi-val" style={{ color: pendentes.length > 0 ? 'var(--gold)' : 'var(--green)' }}>{pendentes.length}</div>
          <div className="kpi-delta">{formatBRL(totalPendente)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Auto (≤ R$ 500)</div>
          <div className="kpi-val">{pendentes.filter(r => r.valor <= 500).length}</div>
          <div className="kpi-delta">aprovação imediata</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Aprovadas</div>
          <div className="kpi-val" style={{ color: 'var(--green)' }}>{aprovadas}</div>
          <div className="kpi-delta">no histórico</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Rejeitadas</div>
          <div className="kpi-val" style={{ color: 'var(--red)' }}>{rejeitadas}</div>
          <div className="kpi-delta">no histórico</div>
        </div>
      </div>

      {/* Política */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Aprovação automática', desc: 'Despesas até R$ 500 com recibo', color: 'var(--green)', bg: 'rgba(45,155,111,.04)', border: 'rgba(45,155,111,.2)' },
          { label: 'Nível 1', desc: 'R$ 500 – R$ 5.000 → gestor direto', color: 'var(--gold)', bg: 'rgba(184,146,42,.04)', border: 'rgba(184,146,42,.2)' },
          { label: 'Nível 2', desc: 'Acima de R$ 5.000 → CFO obrigatório', color: '#7C3AED', bg: 'rgba(124,58,237,.04)', border: 'rgba(124,58,237,.2)' },
        ].map(p => (
          <div key={p.label} style={{ background: p.bg, border: `1px solid ${p.border}`, borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: p.color, marginBottom: 4 }}>{p.label}</div>
            <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{p.desc}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {([['pendentes', 'Pendentes'], ['historico', 'Histórico']] as [Tab, string][]).map(([k, l]) => (
          <button key={k} className={`btn-action${tab !== k ? ' btn-ghost' : ''}`} style={{ fontSize: 11, padding: '5px 12px' }} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {/* Lista pendentes */}
      {tab === 'pendentes' && (
        <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: 16 }}>
          {loading && <div style={{ padding: '32px 0', textAlign: 'center', fontSize: 12, color: 'var(--gray-400)' }}>Carregando...</div>}
          {!loading && pendentes.length === 0 && (
            <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--gray-400)', fontSize: 13 }}>
              <i className="fa-solid fa-circle-check" style={{ fontSize: 32, marginBottom: 12, display: 'block', color: 'var(--green)' }} />
              Nenhuma despesa pendente de aprovação
            </div>
          )}
          {pendentes.map((item, idx) => {
            const n = nivel(Number(item.valor))
            const bloqueado = atualizando === item.id
            return (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: idx < pendentes.length - 1 ? '1px solid var(--gray-100)' : 'none', opacity: bloqueado ? 0.5 : 1, transition: 'opacity .2s' }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, background: n.bg, color: n.color, fontWeight: 700 }}>
                  {n.label === 'Auto' ? 'A' : n.label.replace('Nível ', 'N')}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.descricao}</div>
                  <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>
                    {item.categoria}{item.responsavel_nome ? ` · ${item.responsavel_nome}` : ''}{item.data_despesa ? ` · ${new Date(item.data_despesa + 'T12:00:00').toLocaleDateString('pt-BR')}` : ''}
                  </div>
                  {item.observacao && <div style={{ fontSize: 11, color: 'var(--gray-400)', fontStyle: 'italic', marginTop: 2 }}>{item.observacao}</div>}
                  {item.comprovante_url && (
                    <a href={item.comprovante_url} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: 'var(--teal)', textDecoration: 'none' }}>
                      <i className="fa-solid fa-paperclip" style={{ marginRight: 3 }} />Comprovante
                    </a>
                  )}
                </div>
                <div style={{ textAlign: 'right', marginRight: 8 }}>
                  <div style={{ fontWeight: 700, fontFamily: "'Inter', system-ui, sans-serif", fontSize: 14, color: 'var(--navy)' }}>{formatBRL(Number(item.valor))}</div>
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: n.bg, color: n.color, fontWeight: 600 }}>{n.label}</span>
                </div>
                <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                  <button onClick={() => void aprovar(item.id)} disabled={bloqueado} style={{ background: 'rgba(45,155,111,.1)', color: 'var(--green)', border: '1px solid rgba(45,155,111,.25)', borderRadius: 7, padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                    <i className="fa-solid fa-check" style={{ marginRight: 4 }} />Aprovar
                  </button>
                  <button onClick={() => abrirMotivo(item.id, item.descricao)} disabled={bloqueado} style={{ background: 'rgba(192,80,74,.08)', color: 'var(--red)', border: '1px solid rgba(192,80,74,.2)', borderRadius: 7, padding: '5px 10px', fontSize: 11, cursor: 'pointer' }}>
                    <i className="fa-solid fa-xmark" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Histórico */}
      {tab === 'historico' && (
        <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, overflow: 'hidden' }}>
          <div className="expenses-table">
            <table>
              <thead>
                <tr>
                  <th>Despesa</th>
                  <th>Responsável</th>
                  <th style={{ textAlign: 'right' }}>Valor</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                  <th>Motivo / Data</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--gray-400)' }}>Carregando…</td></tr>}
                {!loading && historico.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--gray-400)' }}>Nenhum histórico ainda</td></tr>}
                {historico.map(h => (
                  <tr key={h.id}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 12 }}>{h.descricao}</div>
                      <div style={{ fontSize: 10, color: 'var(--gray-400)' }}>{h.categoria}</div>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--gray-500)' }}>{h.responsavel_nome || '—'}</td>
                    <td style={{ textAlign: 'right', fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 700, fontSize: 12 }}>{formatBRL(Number(h.valor))}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: h.status === 'aprovado' ? 'rgba(45,155,111,.1)' : 'rgba(192,80,74,.1)', color: h.status === 'aprovado' ? 'var(--green)' : 'var(--red)' }}>
                        {h.status === 'aprovado' ? 'Aprovado' : 'Rejeitado'}
                      </span>
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--gray-400)' }}>
                      {h.rejeitado_motivo ? <span title={h.rejeitado_motivo} style={{ color: 'var(--red)' }}>{h.rejeitado_motivo.slice(0, 40)}{h.rejeitado_motivo.length > 40 ? '…' : ''}</span>
                        : h.aprovado_em ? new Date(h.aprovado_em).toLocaleDateString('pt-BR') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal motivo rejeição */}
      {modalMotivo && (
        <div className="modal-bg" onClick={() => setModalMotivo(null)}>
          <div className="modal-box" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 className="modal-title">Rejeitar despesa</h3>
              <button className="modal-close" onClick={() => setModalMotivo(null)}><i className="fa-solid fa-xmark" /></button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 14 }}>
              <strong>{modalMotivo.descricao}</strong>
            </p>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-500)', display: 'block', marginBottom: 6 }}>Motivo da rejeição</label>
            <textarea style={{ ...inp, minHeight: 80, resize: 'vertical' }} placeholder="Descreva o motivo (opcional)" value={motivo} onChange={e => setMotivo(e.target.value)} />
            <div className="modal-actions" style={{ marginTop: 16 }}>
              <button className="btn-ghost" onClick={() => setModalMotivo(null)}>Cancelar</button>
              <button className="btn-action" style={{ background: 'var(--red)', border: 'none' }} onClick={() => void confirmarRejeicao()}>
                <i className="fa-solid fa-xmark" style={{ marginRight: 5 }} />Confirmar rejeição
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
