'use client'

import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import toast from 'react-hot-toast'

type Contador = {
  id: string
  nome: string
  email: string | null
  token_acesso: string
  status: 'ativo' | 'revogado'
  permissoes: Record<string, boolean>
  created_at: string
}

const PERM_LABELS: Record<string, string> = {
  ver_dre: 'DRE',
  ver_lancamentos: 'Lançamentos',
  ver_notas: 'Notas Fiscais',
  ver_despesas: 'Despesas',
  exportar: 'Exportar',
}

const DEFAULT_PERMS = {
  ver_dre: true,
  ver_lancamentos: true,
  ver_notas: true,
  ver_despesas: true,
  exportar: true,
}

export default function ContadoresPage() {
  const supabase = createClientComponentClient()
  const [loading, setLoading] = useState(true)
  const [contadores, setContadores] = useState<Contador[]>([])
  const [empresaId, setEmpresaId] = useState<string>('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ nome: '', email: '' })
  const [perms, setPerms] = useState<Record<string, boolean>>(DEFAULT_PERMS)
  const [saving, setSaving] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [portalUrl, setPortalUrl] = useState('')

  useEffect(() => {
    setPortalUrl(window.location.origin)
    load()
  }, [])

  async function load() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
      const eid = u?.empresa_id || user.id
      setEmpresaId(eid)
      const { data } = await supabase
        .from('contadores')
        .select('*')
        .eq('empresa_id', eid)
        .order('created_at', { ascending: false })
      setContadores((data as Contador[]) ?? [])
    } finally {
      setLoading(false)
    }
  }

  async function criarAcesso() {
    if (!form.nome.trim()) { toast.error('Nome obrigatório'); return }
    setSaving(true)
    try {
      const { error } = await supabase.from('contadores').insert({
        empresa_id: empresaId,
        nome: form.nome.trim(),
        email: form.email.trim() || null,
        permissoes: perms,
      })
      if (error) throw error
      toast.success('Acesso criado com sucesso')
      setModal(false)
      setForm({ nome: '', email: '' })
      setPerms(DEFAULT_PERMS)
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao criar acesso')
    } finally {
      setSaving(false)
    }
  }

  async function revogarAcesso(id: string) {
    if (!confirm('Revogar acesso deste contador? Ele não poderá mais visualizar os dados.')) return
    const { error } = await supabase.from('contadores').update({ status: 'revogado' }).eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Acesso revogado')
    load()
  }

  async function reativarAcesso(id: string) {
    const { error } = await supabase.from('contadores').update({ status: 'ativo' }).eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Acesso reativado')
    load()
  }

  async function excluirAcesso(id: string) {
    if (!confirm('Excluir permanentemente este acesso?')) return
    const { error } = await supabase.from('contadores').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Acesso excluído')
    load()
  }

  function copiarLink(token: string, id: string) {
    const link = `${portalUrl}/contador/${token}`
    navigator.clipboard.writeText(link).then(() => {
      setCopiedId(id)
      toast.success('Link copiado!')
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  const ativos = contadores.filter(c => c.status === 'ativo')
  const revogados = contadores.filter(c => c.status === 'revogado')

  if (loading) return <div className="page-hdr"><p style={{ color: 'var(--gray-400)' }}>Carregando...</p></div>

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 1rem' }}>
      <div className="page-hdr">
        <div>
          <h1 className="page-title">Portal Contador</h1>
          <p style={{ color: 'var(--gray-400)', fontSize: 14, marginTop: 4 }}>
            Compartilhe acesso somente-leitura com seu contador externo
          </p>
        </div>
        <button className="btn-action" onClick={() => setModal(true)}>+ Novo Acesso</button>
      </div>

      {contadores.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--gray-400)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔑</div>
          <p style={{ fontWeight: 600, color: 'var(--gray-500)', marginBottom: 8 }}>Nenhum acesso criado</p>
          <p style={{ fontSize: 14 }}>Crie um link seguro para que seu contador visualize DRE, lançamentos e despesas.</p>
        </div>
      )}

      {ativos.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
            Acessos Ativos ({ativos.length})
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {ativos.map(c => (
              <ContadorCard
                key={c.id}
                contador={c}
                portalUrl={portalUrl}
                copied={copiedId === c.id}
                onCopy={() => copiarLink(c.token_acesso, c.id)}
                onRevogar={() => revogarAcesso(c.id)}
                onExcluir={() => excluirAcesso(c.id)}
              />
            ))}
          </div>
        </section>
      )}

      {revogados.length > 0 && (
        <section>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
            Acessos Revogados ({revogados.length})
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {revogados.map(c => (
              <ContadorCard
                key={c.id}
                contador={c}
                portalUrl={portalUrl}
                copied={false}
                onCopy={() => {}}
                onRevogar={() => {}}
                onReativar={() => reativarAcesso(c.id)}
                onExcluir={() => excluirAcesso(c.id)}
              />
            ))}
          </div>
        </section>
      )}

      {modal && (
        <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) setModal(false) }}>
          <div style={{ background: 'var(--navy)', border: '1px solid var(--gray-100)', borderRadius: 12, padding: 28, width: '100%', maxWidth: 480 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Novo Acesso para Contador</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, color: 'var(--gray-400)', display: 'block', marginBottom: 6 }}>Nome do contador *</label>
                <input
                  className="form-input"
                  placeholder="Ex: João Silva Contabilidade"
                  value={form.nome}
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--gray-100)', borderRadius: 8, padding: '10px 12px', color: '#fff', fontSize: 14 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 13, color: 'var(--gray-400)', display: 'block', marginBottom: 6 }}>E-mail (opcional)</label>
                <input
                  className="form-input"
                  placeholder="contador@escritorio.com.br"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--gray-100)', borderRadius: 8, padding: '10px 12px', color: '#fff', fontSize: 14 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 13, color: 'var(--gray-400)', display: 'block', marginBottom: 10 }}>Permissões de acesso</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {Object.entries(PERM_LABELS).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setPerms(p => ({ ...p, [key]: !p[key] }))}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 20,
                        border: '1px solid',
                        borderColor: perms[key] ? 'var(--teal)' : 'var(--gray-100)',
                        background: perms[key] ? 'rgba(0,201,167,0.15)' : 'transparent',
                        color: perms[key] ? 'var(--teal)' : 'var(--gray-400)',
                        fontSize: 13,
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                    >
                      {perms[key] ? '✓ ' : ''}{label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
              <button className="btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn-action" onClick={criarAcesso} disabled={saving}>
                {saving ? 'Criando...' : 'Criar Acesso'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ContadorCard({
  contador, portalUrl, copied,
  onCopy, onRevogar, onReativar, onExcluir,
}: {
  contador: Contador
  portalUrl: string
  copied: boolean
  onCopy: () => void
  onRevogar: () => void
  onReativar?: () => void
  onExcluir: () => void
}) {
  const link = `${portalUrl}/contador/${contador.token_acesso}`
  const ativo = contador.status === 'ativo'
  const perms = contador.permissoes ?? {}

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: `1px solid ${ativo ? 'var(--gray-100)' : 'rgba(255,255,255,0.06)'}`,
      borderRadius: 10,
      padding: '16px 20px',
      opacity: ativo ? 1 : 0.6,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>{contador.nome}</span>
            <span className={`tag ${ativo ? 'green' : 'red'}`}>{ativo ? 'Ativo' : 'Revogado'}</span>
          </div>
          {contador.email && (
            <div style={{ fontSize: 13, color: 'var(--gray-400)', marginBottom: 8 }}>{contador.email}</div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {Object.entries(PERM_LABELS).map(([key, label]) => (
              perms[key] !== false && (
                <span key={key} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'rgba(0,201,167,0.1)', color: 'var(--teal)', fontWeight: 600 }}>
                  {label}
                </span>
              )
            ))}
          </div>
          {ativo && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                background: 'rgba(255,255,255,0.05)',
                borderRadius: 6,
                padding: '6px 10px',
                fontSize: 12,
                color: 'var(--gray-400)',
                fontFamily: 'monospace',
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {link}
              </div>
              <button
                onClick={onCopy}
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  border: '1px solid var(--gray-100)',
                  background: copied ? 'rgba(0,201,167,0.15)' : 'transparent',
                  color: copied ? 'var(--teal)' : 'var(--gray-400)',
                  fontSize: 12,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  fontWeight: 600,
                }}
              >
                {copied ? '✓ Copiado' : 'Copiar link'}
              </button>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {ativo ? (
            <button
              onClick={onRevogar}
              style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)', background: 'transparent', color: 'var(--red)', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
            >
              Revogar
            </button>
          ) : (
            <button
              onClick={onReativar}
              style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(0,201,167,0.3)', background: 'transparent', color: 'var(--teal)', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
            >
              Reativar
            </button>
          )}
          <button
            onClick={onExcluir}
            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--gray-100)', background: 'transparent', color: 'var(--gray-400)', fontSize: 12, cursor: 'pointer' }}
          >
            Excluir
          </button>
        </div>
      </div>
    </div>
  )
}
