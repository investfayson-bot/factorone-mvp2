'use client'

// Portal do Contador (Fase 5, Bloco 1) — junta os dois lados numa aba só:
// 1. "Seus clientes": cockpit do escritório contábil (papel 'contador' em
//    usuario_empresas) — portado de /dashboard/escritorio. Só aparece se o
//    login tiver pelo menos um vínculo como contador.
// 2. "Seu contador": o dono do negócio convida o contador com LOGIN COMPLETO
//    (/api/equipe/convidar role:'contador') — MFA + audit log de verdade.
//    A geração de link só-leitura por token foi descontinuada (decisão do
//    Fayson: token não passa por MFA nem gera audit log — Resolução BCB 85 /
//    LGPD). Links antigos continuam funcionando (/contador/[token]); aqui só
//    dá pra revogar/excluir os existentes, nunca criar novos.

import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'

type Empresa = { id: string; nome: string | null; cnpj: string | null; plano: string | null; papel: string; ativa: boolean }
type ContadorToken = {
  id: string; nome: string; email: string | null
  token_acesso: string; status: 'ativo' | 'revogado'; created_at: string
}

function iniciais(nome: string | null): string {
  const s = (nome || '?').trim()
  const partes = s.split(/\s+/).filter(Boolean)
  return ((partes[0]?.[0] ?? '?') + (partes[1]?.[0] ?? '')).toUpperCase()
}

function fmtCnpj(cnpj: string | null): string {
  const d = (cnpj || '').replace(/\D/g, '')
  if (d.length !== 14) return cnpj || 'Sem CNPJ'
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

export default function PortalContadorPage() {
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [entrando, setEntrando] = useState<string | null>(null)

  // Lado "dono do negócio": contadores convidados via equipe + tokens legados
  const [contadoresEquipe, setContadoresEquipe] = useState<{ id: string; email: string; nome: string | null; status: string }[]>([])
  const [tokensLegados, setTokensLegados] = useState<ContadorToken[]>([])
  const [modalConvite, setModalConvite] = useState(false)
  const [conviteForm, setConviteForm] = useState({ email: '', nome: '' })
  const [convidando, setConvidando] = useState(false)

  async function auth() {
    const { data: sess } = await supabase.auth.getSession()
    const tk = sess.session?.access_token ?? ''
    return tk ? { Authorization: `Bearer ${tk}` } : {}
  }

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const h = await auth()
      const { data: { user } } = await supabase.auth.getUser()
      const [empRes, u] = await Promise.all([
        fetch('/api/empresas', { headers: h }).then(r => r.json().then(j => ({ ok: r.ok, j }))),
        user ? supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle() : Promise.resolve({ data: null }),
      ])
      if (empRes.ok) setEmpresas(empRes.j.empresas ?? [])
      const eid = (u.data?.empresa_id as string) ?? user?.id
      if (eid) {
        // membros_equipe é a fonte legível do client (mesma da tela Equipe) —
        // usuario_empresas só deixa cada login ver os próprios vínculos (RLS).
        const [membRes, tokRes] = await Promise.all([
          supabase.from('membros_equipe').select('id, nome, email, role, status').eq('empresa_id', eid).eq('role', 'contador').neq('status', 'revogado').order('created_at', { ascending: false }),
          supabase.from('contadores').select('id, nome, email, token_acesso, status, created_at').eq('empresa_id', eid).order('created_at', { ascending: false }),
        ])
        setContadoresEquipe(((membRes.data ?? []) as { id: string; nome: string | null; email: string; status: string }[]).map(m => ({ id: m.id, email: m.email, nome: m.nome, status: m.status })))
        setTokensLegados((tokRes.data as ContadorToken[]) ?? [])
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void carregar() }, [carregar])

  async function entrar(id: string, destino: string) {
    if (entrando) return
    setEntrando(id)
    try {
      const r = await fetch('/api/empresas/trocar', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(await auth()) }, body: JSON.stringify({ empresa_id: id }) })
      if (!r.ok) throw new Error((await r.json()).error || 'Falha ao entrar na empresa')
      window.location.href = destino
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro'); setEntrando(null) }
  }

  async function convidarContador() {
    if (!conviteForm.email.trim()) { toast.error('E-mail obrigatório'); return }
    setConvidando(true)
    try {
      const res = await fetch('/api/equipe/convidar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await auth()) },
        body: JSON.stringify({ email: conviteForm.email.trim(), nome: conviteForm.nome.trim(), role: 'contador' }),
      })
      const d = await res.json() as { ok?: boolean; email_enviado?: boolean; email_erro?: string | null; error?: string }
      if (d.ok) {
        if (d.email_enviado) {
          toast.success('Convite enviado! Seu contador recebe o link por e-mail e cria o próprio login.')
        } else {
          toast.error(`Convite registrado, mas o e-mail NÃO foi enviado${d.email_erro ? ` (${d.email_erro})` : ''}. Reenvie ou compartilhe o link manualmente.`, { duration: 8000 })
        }
        setModalConvite(false)
        setConviteForm({ email: '', nome: '' })
        void carregar()
      } else {
        toast.error(d.error ?? 'Erro ao convidar')
      }
    } finally {
      setConvidando(false)
    }
  }

  async function desconectarContador(id: string, email: string) {
    if (!confirm(`Desconectar ${email}? Ele perderá acesso à empresa.`)) return
    try {
      const res = await fetch('/api/equipe/remover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await auth()) },
        body: JSON.stringify({ membroId: id }),
      })
      const d = await res.json() as { ok?: boolean; error?: string }
      if (d.ok) {
        toast.success('Contador desconectado. E-mail de aviso foi enviado.')
        void carregar()
      } else {
        toast.error(d.error ?? 'Falha ao desconectar')
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro')
    }
  }

  // via API (gate de papel: o próprio contador convidado não pode mexer nos acessos)
  async function gerenciarToken(id: string, acao: 'revogar' | 'excluir') {
    const msg = acao === 'revogar' ? 'Revogar este link de acesso?' : 'Excluir permanentemente este acesso?'
    if (!confirm(msg)) return
    const res = await fetch('/api/contadores/gerenciar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await auth()) },
      body: JSON.stringify({ id, acao }),
    })
    const d = await res.json() as { ok?: boolean; error?: string }
    if (!res.ok || !d.ok) { toast.error(d.error || 'Falha na operação'); return }
    toast.success(acao === 'revogar' ? 'Link revogado' : 'Excluído'); void carregar()
  }

  const clientes = useMemo(() => empresas.filter(e => e.papel === 'contador'), [empresas])
  const clientesFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return clientes
    return clientes.filter(e => (e.nome || '').toLowerCase().includes(q) || (e.cnpj || '').replace(/\D/g, '').includes(q.replace(/\D/g, '')))
  }, [clientes, busca])

  const souContador = clientes.length > 0
  const tokensAtivos = tokensLegados.filter(t => t.status === 'ativo')

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--mut)', fontSize: 13.5 }}>Carregando…</div>

  return (
    <div style={{ paddingBottom: 30, maxWidth: 1080 }}>
      {/* ===== Seção "Seus clientes" — só pra quem é contador de alguém ===== */}
      {souContador && (
        <div style={{ marginBottom: 28 }}>
          <div style={{
            background: 'linear-gradient(135deg, #1C2E29 0%, #13201D 55%, #0F1918 100%)',
            borderRadius: 14, padding: '18px 22px', color: '#EAF5F3', marginBottom: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 11, background: 'rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fa-solid fa-calculator" style={{ fontSize: 18, color: '#7FD1BE' }} />
              </div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-.01em' }}>Seus clientes</div>
                <div style={{ fontSize: 13, color: '#9FC3BB', marginTop: 2 }}>Entre na contabilidade de cada empresa com um clique — sem logout.</div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 26, fontWeight: 800, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{clientes.length}</div>
              <div style={{ fontSize: 11.5, color: '#9FC3BB', marginTop: 3 }}>cliente{clientes.length === 1 ? '' : 's'}</div>
            </div>
          </div>

          <div style={{ position: 'relative', marginBottom: 14 }}>
            <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--mut)', fontSize: 13 }} />
            <input
              className="form-input"
              style={{ paddingLeft: 38, height: 40, width: '100%' }}
              placeholder="Buscar cliente por nome ou CNPJ…"
              value={busca}
              onChange={e => setBusca(e.target.value)}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 12 }}>
            {clientesFiltrados.map(e => (
              <div key={e.id} className="card-v2" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--acc-soft)', color: 'var(--acc-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, flexShrink: 0 }}>{iniciais(e.nome)}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.nome || 'Sem nome'}</div>
                    <div style={{ fontSize: 12, color: 'var(--mut)', fontVariantNumeric: 'tabular-nums' }}>{fmtCnpj(e.cnpj)}</div>
                  </div>
                  {e.ativa && <span className="chip-v2 g" style={{ marginLeft: 'auto', flexShrink: 0 }}>ativa</span>}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn-v2 primary"
                    style={{ flex: 1, opacity: entrando === e.id ? 0.6 : 1 }}
                    disabled={!!entrando}
                    onClick={() => void entrar(e.id, '/dashboard/contabil-fiscal/visao-geral')}
                  >
                    {entrando === e.id ? 'Entrando…' : <><i className="fa-solid fa-arrow-right-to-bracket" style={{ marginRight: 6 }} />Abrir contabilidade</>}
                  </button>
                  <button
                    className="btn-v2"
                    title="Ver DRE / exportar"
                    disabled={!!entrando}
                    onClick={() => void entrar(e.id, '/dashboard/relatorios')}
                  >
                    <i className="fa-solid fa-chart-bar" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== Seção "Seu contador" — o dono do negócio convida/gerencia ===== */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--ink)' }}>Seu contador</div>
            <div style={{ fontSize: 12.5, color: 'var(--mut)', marginTop: 2 }}>Convide com login próprio — ele acessa sua empresa em modo leitura, com MFA e registro de auditoria.</div>
          </div>
          <button className="btn-v2 primary" onClick={() => setModalConvite(true)}>
            <i className="fa-solid fa-user-plus" style={{ marginRight: 6 }} />Convidar meu contador
          </button>
        </div>

        {contadoresEquipe.length === 0 ? (
          <div className="card-v2" style={{ padding: '26px 20px', textAlign: 'center' }}>
            <i className="fa-solid fa-user-tie" style={{ fontSize: 26, color: 'var(--acc)', marginBottom: 10, display: 'block' }} />
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>Nenhum contador vinculado ainda</div>
            <div style={{ fontSize: 13, color: 'var(--mut)', maxWidth: 440, margin: '0 auto' }}>
              Quando você convidar, ele recebe um e-mail, cria o próprio login e vê sua empresa no painel dele — sem senha compartilhada, sem link solto.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {contadoresEquipe.map(c => (
              <div key={c.id} className="card-v2" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--acc-soft)', color: 'var(--acc-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12.5, flexShrink: 0 }}>{iniciais(c.nome || c.email)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{c.nome || c.email}</div>
                  {c.nome && <div style={{ fontSize: 12, color: 'var(--mut)' }}>{c.email}</div>}
                </div>
                <span className={`chip-v2 ${c.status === 'ativo' ? 'g' : 'y'}`}>{c.status === 'ativo' ? 'Contador · leitura' : 'Convite pendente'}</span>
                <button onClick={() => void desconectarContador(c.id, c.email)} className="btn-action btn-ghost" style={{ fontSize: 12, padding: '4px 12px', color: '#B0413E', borderColor: 'rgba(176,65,62,.3)' }} title="Desconectar este contador">✕</button>
              </div>
            ))}
          </div>
        )}

        {/* Links por token legados — só gestão do que já existe, sem criar novo */}
        {tokensLegados.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--mut)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
              Links de acesso antigos (descontinuados)
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--mut)', marginBottom: 10, lineHeight: 1.5 }}>
              O acesso por link sem login foi descontinuado por não passar por MFA nem gerar registro de auditoria.
              Os links abaixo continuam funcionando até você revogar — pra acesso novo, use o convite com login acima.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {tokensLegados.map(t => {
                const ativo = t.status === 'ativo'
                return (
                  <div key={t.id} className="card-v2" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, opacity: ativo ? 1 : 0.55 }}>
                    <i className="fa-solid fa-key" style={{ fontSize: 14, color: ativo ? '#B08A3E' : 'var(--mut)', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{t.nome}</div>
                      <div style={{ fontSize: 12, color: 'var(--mut)' }}>{t.email || 'Sem e-mail'} · criado em {new Date(t.created_at).toLocaleDateString('pt-BR')}</div>
                    </div>
                    <span className={`chip-v2 ${ativo ? 'y' : 'r'}`}>{ativo ? 'Ativo' : 'Revogado'}</span>
                    {ativo && <button className="btn-v2" onClick={() => void gerenciarToken(t.id, 'revogar')}>Revogar</button>}
                    <button className="btn-v2" onClick={() => void gerenciarToken(t.id, 'excluir')}>Excluir</button>
                  </div>
                )
              })}
            </div>
            {tokensAtivos.length > 0 && (
              <div style={{ fontSize: 12, color: '#B45309', marginTop: 8 }}>
                <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 5 }} />
                {tokensAtivos.length} link{tokensAtivos.length === 1 ? '' : 's'} sem login ainda ativo{tokensAtivos.length === 1 ? '' : 's'} — recomendamos migrar pro convite com login e revogar.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de convite (login completo) */}
      {modalConvite && (
        <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) setModalConvite(false) }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 26, width: '100%', maxWidth: 460 }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)', marginBottom: 6 }}>Convidar meu contador</h2>
            <p style={{ fontSize: 13, color: 'var(--mut)', marginBottom: 18, lineHeight: 1.5 }}>
              Ele recebe um convite por e-mail, cria login próprio e acessa sua empresa em modo leitura direto do painel dele — com MFA e auditoria.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--mut)', display: 'block', marginBottom: 5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>E-mail do contador *</label>
                <input className="form-input" type="email" placeholder="contador@escritorio.com.br" value={conviteForm.email} onChange={e => setConviteForm(f => ({ ...f, email: e.target.value }))} style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--mut)', display: 'block', marginBottom: 5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>Nome (opcional)</label>
                <input className="form-input" placeholder="Ex: João Silva Contabilidade" value={conviteForm.nome} onChange={e => setConviteForm(f => ({ ...f, nome: e.target.value }))} style={{ width: '100%' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
              <button className="btn-v2" onClick={() => setModalConvite(false)}>Cancelar</button>
              <button className="btn-v2 primary" onClick={() => void convidarContador()} disabled={convidando || !conviteForm.email.trim()}>
                {convidando ? 'Enviando…' : 'Enviar convite'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
