'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Membro = {
  id: string
  email: string
  nome: string | null
  role: string
  status: string
  created_at: string
  user_id: string | null
}

const ROLES: Record<string, { label: string; desc: string; color: string; bg: string }> = {
  admin:       { label: 'Admin',       desc: 'Acesso total à plataforma',            color: 'var(--navy)',  bg: '#e0e7ff' },
  financeiro:  { label: 'Financeiro',  desc: 'Financeiro, DRE, contas, relatórios',  color: 'var(--teal)',  bg: '#e0f2fe' },
  comercial:   { label: 'Comercial',   desc: 'Clientes, CRM, marketing',             color: '#7C3AED',      bg: '#ede9fe' },
  operacional: { label: 'Operacional', desc: 'Despesas, aprovações, patrimônio',     color: 'var(--gold)',  bg: '#fef3c7' },
  logistica:   { label: 'Logística',   desc: 'Rotas, pneus, checklist, manutenção', color: '#0891b2',      bg: '#e0f2fe' },
  viewer:      { label: 'Visualizador',desc: 'Apenas leitura do dashboard',          color: 'var(--gray-400)', bg: '#f1f5f9' },
}

export default function EquipePage() {
  const [empresaId, setEmpresaId] = useState('')
  const [membros, setMembros] = useState<Membro[]>([])
  const [loading, setLoading] = useState(true)
  const [showConvidar, setShowConvidar] = useState(false)
  const [saving, setSaving] = useState(false)
  const [conviteEnviado, setConviteEnviado] = useState('')
  const [form, setForm] = useState({ email: '', nome: '', role: 'viewer' })
  const [currentUserEmail, setCurrentUserEmail] = useState('')

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setCurrentUserEmail(user.email ?? '')
      const { data: ur } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
      const eid = ur?.empresa_id ?? user.id
      setEmpresaId(eid)
      const { data } = await supabase.from('membros_equipe').select('*').eq('empresa_id', eid).order('created_at')
      setMembros((data ?? []) as Membro[])
    } finally {
      setLoading(false)
    }
  }

  async function convidar() {
    if (!form.email) return
    setSaving(true)
    try {
      const { data: sess } = await supabase.auth.getSession()
      const res = await fetch('/api/equipe/convidar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sess.session?.access_token ?? ''}`,
        },
        body: JSON.stringify(form),
      })
      const d = await res.json() as { ok?: boolean; error?: string }
      if (d.ok) {
        setConviteEnviado(form.email)
        setForm({ email: '', nome: '', role: 'viewer' })
        await carregar()
      } else {
        alert(d.error ?? 'Erro ao convidar')
      }
    } finally {
      setSaving(false)
    }
  }

  async function revogar(id: string) {
    if (!confirm('Revogar acesso deste membro?')) return
    await supabase.from('membros_equipe').update({ status: 'revogado' }).eq('id', id)
    await carregar()
  }

  async function alterarRole(id: string, role: string) {
    await supabase.from('membros_equipe').update({ role }).eq('id', id)
    await carregar()
  }

  const ativos = membros.filter(m => m.status === 'ativo').length
  const pendentes = membros.filter(m => m.status === 'pendente').length

  return (
    <div>
      <div className="page-hdr">
        <div>
          <div className="page-title">Equipe</div>
          <div className="page-sub">{ativos} membros ativos · {pendentes} convites pendentes</div>
        </div>
        <button className="btn-action" onClick={() => { setShowConvidar(true); setConviteEnviado('') }}>
          <i className="fa-solid fa-user-plus" /> Convidar membro
        </button>
      </div>

      {/* Roles guide */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 24 }}>
        {Object.entries(ROLES).map(([k, r]) => (
          <div key={k} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: r.bg, color: r.color, whiteSpace: 'nowrap' }}>{r.label}</span>
            <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>{r.desc}</span>
          </div>
        ))}
      </div>

      {/* Members table */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--gray-400)' }}>Carregando...</div>
        ) : (
          <table className="expenses-table" style={{ width: '100%' }}>
            <thead>
              <tr><th>Membro</th><th>Role</th><th>Status</th><th>Desde</th><th>Ações</th></tr>
            </thead>
            <tbody>
              {/* Current user (owner) */}
              <tr style={{ background: 'rgba(0,168,150,.03)' }}>
                <td>
                  <div style={{ fontWeight: 700 }}>{currentUserEmail}</div>
                  <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>Você (proprietário)</div>
                </td>
                <td><span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: ROLES.admin.bg, color: ROLES.admin.color }}>Admin</span></td>
                <td><span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 12, background: '#dcfce7', color: 'var(--green)', fontWeight: 600 }}>Ativo</span></td>
                <td style={{ fontSize: 12 }}>—</td>
                <td style={{ fontSize: 12, color: 'var(--gray-400)' }}>—</td>
              </tr>
              {membros.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '32px 0', fontSize: 13 }}>
                  Nenhum membro convidado ainda. Convide sua equipe!
                </td></tr>
              )}
              {membros.map(m => (
                <tr key={m.id} style={{ opacity: m.status === 'revogado' ? 0.5 : 1 }}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{m.nome ?? m.email}</div>
                    {m.nome && <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{m.email}</div>}
                  </td>
                  <td>
                    {m.status === 'revogado' ? (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: '#f1f5f9', color: 'var(--gray-400)' }}>
                        {ROLES[m.role]?.label ?? m.role}
                      </span>
                    ) : (
                      <select
                        value={m.role}
                        onChange={e => void alterarRole(m.id, e.target.value)}
                        style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: ROLES[m.role]?.bg ?? '#f1f5f9', color: ROLES[m.role]?.color ?? 'var(--gray-400)', border: 'none', cursor: 'pointer' }}
                      >
                        {Object.entries(ROLES).map(([k, r]) => <option key={k} value={k}>{r.label}</option>)}
                      </select>
                    )}
                  </td>
                  <td>
                    <span style={{
                      fontSize: 11, padding: '3px 8px', borderRadius: 12, fontWeight: 600,
                      background: m.status === 'ativo' ? '#dcfce7' : m.status === 'pendente' ? '#fef3c7' : '#f1f5f9',
                      color: m.status === 'ativo' ? 'var(--green)' : m.status === 'pendente' ? 'var(--gold)' : 'var(--gray-400)',
                    }}>
                      {m.status === 'ativo' ? 'Ativo' : m.status === 'pendente' ? 'Pendente' : 'Revogado'}
                    </span>
                  </td>
                  <td style={{ fontSize: 12 }}>{new Date(m.created_at).toLocaleDateString('pt-BR')}</td>
                  <td>
                    {m.status !== 'revogado' && (
                      <button onClick={() => void revogar(m.id)} className="btn-action btn-ghost" style={{ fontSize: 11, padding: '3px 10px', color: 'var(--red)', borderColor: 'rgba(192,80,74,.3)' }}>
                        Revogar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal convidar */}
      {showConvidar && (
        <div className="modal-bg" onClick={() => setShowConvidar(false)}>
          <div className="modal-box" style={{ maxWidth: 480, width: '95%' }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">
              Convidar membro
              <button className="modal-close" onClick={() => setShowConvidar(false)}>×</button>
            </div>

            {conviteEnviado ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <i className="fa-solid fa-circle-check" style={{ fontSize: 48, color: 'var(--green)', marginBottom: 16, display: 'block' }} />
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Convite enviado!</div>
                <div style={{ fontSize: 13, color: 'var(--gray-400)' }}>Um e-mail foi enviado para <strong>{conviteEnviado}</strong> com o link de acesso.</div>
                <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center', gap: 10 }}>
                  <button className="btn-ghost" onClick={() => { setConviteEnviado(''); setShowConvidar(false) }}>Fechar</button>
                  <button className="btn-action" onClick={() => setConviteEnviado('')}>Convidar outro</button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>E-mail *</label>
                    <input className="form-input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="colega@empresa.com" />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Nome (opcional)</label>
                    <input className="form-input" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Nome do membro" />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 8 }}>Role / Permissão</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      {Object.entries(ROLES).map(([k, r]) => (
                        <button key={k} type="button" onClick={() => setForm(f => ({ ...f, role: k }))} style={{
                          padding: '10px 12px', borderRadius: 8, border: form.role === k ? `2px solid ${r.color}` : '1px solid #e2e8f0',
                          background: form.role === k ? r.bg : '#fafafa', cursor: 'pointer', textAlign: 'left',
                        }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: r.color }}>{r.label}</div>
                          <div style={{ fontSize: 10, color: 'var(--gray-400)', marginTop: 2 }}>{r.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="modal-actions">
                  <button className="btn-ghost" onClick={() => setShowConvidar(false)}>Cancelar</button>
                  <button className="btn-action" disabled={saving || !form.email} onClick={convidar}>
                    {saving ? 'Enviando...' : <><i className="fa-solid fa-paper-plane" /> Enviar convite</>}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
