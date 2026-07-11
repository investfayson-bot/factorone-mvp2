'use client'

// Controle de autonomia da IA por canal: cada regra decide se a ação
// acontece sozinha ("automático") ou espera sua aprovação ("rascunho").
// É o mesmo motor donna_regras que já existia em /dashboard/agentes/donna
// (aba Regras) — só reorganizado pra viver junto com E-mails, que é a
// fila de rascunhos que essas regras geram.

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'

type Canal = 'email' | 'site' | 'telegram'
type Autonomia = 'rascunho' | 'automatico'
type Regra = { id: string; nome: string | null; canal: Canal; criterio: string; autonomia: Autonomia; ativa: boolean; created_at: string }
type EmailItem = { id: string; remetente: string; assunto: string; snippet: string; corpo_resposta: string | null; status: string; created_at: string }

const CANAL_LABEL: Record<Canal, string> = { email: 'E-mail', site: 'Atendimento (site)', telegram: 'Telegram' }
const VAZIO_REGRA = { nome: '', canal: 'email' as Canal, criterio: '', autonomia: 'rascunho' as Autonomia, ativa: true }

function AutomacoesContent() {
  const params = useSearchParams()
  const [token, setToken] = useState('')
  const [tab, setTab] = useState<'regras' | 'emails'>(params.get('tab') === 'emails' ? 'emails' : 'regras')
  const [loading, setLoading] = useState(true)

  const [googleEmail, setGoogleEmail] = useState<string | null>(null)
  const [conectando, setConectando] = useState(false)
  const [empresaId, setEmpresaId] = useState('')
  const [telegramBotUsername, setTelegramBotUsername] = useState<string | null>(null)

  const [regras, setRegras] = useState<Regra[]>([])
  const [showRegraModal, setShowRegraModal] = useState(false)
  const [regraForm, setRegraForm] = useState({ ...VAZIO_REGRA })

  const [emails, setEmails] = useState<EmailItem[]>([])
  const [edicaoEmail, setEdicaoEmail] = useState<Record<string, string>>({})

  const auth = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token])

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

      const a = tk ? { Authorization: `Bearer ${tk}` } : {}
      const [contaRes, regrasRes, emailsRes, statusRes] = await Promise.all([
        supabase.from('google_contas').select('email').eq('empresa_id', eid).maybeSingle(),
        fetch('/api/donna/regras', { headers: a }),
        fetch('/api/donna/emails?status=pendente_aprovacao', { headers: a }),
        fetch('/api/integracoes/status', { headers: a }),
      ])
      setGoogleEmail((contaRes.data?.email as string) ?? null)
      const jr = await regrasRes.json(); if (regrasRes.ok) setRegras(jr.regras ?? [])
      const je = await emailsRes.json(); if (emailsRes.ok) setEmails(je.emails ?? [])
      const js = await statusRes.json(); if (statusRes.ok) setTelegramBotUsername(js.telegramBotUsername ?? null)
      setLoading(false)
    })()
  }, [])

  async function conectarGoogle() {
    setConectando(true)
    try {
      const r = await fetch('/api/google/oauth/start', { headers: auth })
      const j = await r.json()
      if (!r.ok || !j.url) throw new Error(j.error || 'Falha ao iniciar conexão')
      window.location.href = j.url
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro'); setConectando(false) }
  }

  async function desconectarGoogle() {
    if (!window.confirm('Desconectar o Google? A IA para de ler/responder e-mails.')) return
    try {
      const r = await fetch('/api/google/desconectar', { method: 'POST', headers: auth })
      if (!r.ok) throw new Error()
      setGoogleEmail(null)
      toast.success('Google desconectado')
    } catch { toast.error('Falha ao desconectar') }
  }

  async function criarRegra() {
    if (!regraForm.criterio.trim()) { toast.error('Informe ao menos uma palavra-chave'); return }
    try {
      const r = await fetch('/api/donna/regras', { method: 'POST', headers: { 'Content-Type': 'application/json', ...auth }, body: JSON.stringify(regraForm) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Falha')
      setRegras(prev => [j.regra, ...prev])
      setShowRegraModal(false); setRegraForm({ ...VAZIO_REGRA })
      toast.success('Regra criada')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro') }
  }

  async function alternarRegra(r: Regra) {
    setRegras(prev => prev.map(x => x.id === r.id ? { ...x, ativa: !x.ativa } : x))
    try { await fetch(`/api/donna/regras/${r.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...auth }, body: JSON.stringify({ ativa: !r.ativa }) }) } catch { /* ignore */ }
  }

  async function alternarAutonomia(r: Regra) {
    const nova: Autonomia = r.autonomia === 'automatico' ? 'rascunho' : 'automatico'
    setRegras(prev => prev.map(x => x.id === r.id ? { ...x, autonomia: nova } : x))
    try { await fetch(`/api/donna/regras/${r.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...auth }, body: JSON.stringify({ autonomia: nova }) }) } catch { /* ignore */ }
  }

  async function excluirRegra(id: string) {
    if (!window.confirm('Excluir esta regra?')) return
    setRegras(prev => prev.filter(x => x.id !== id))
    try { await fetch(`/api/donna/regras/${id}`, { method: 'DELETE', headers: auth }) } catch { /* ignore */ }
  }

  async function aprovarEmail(id: string) {
    try {
      const corpo = edicaoEmail[id]
      const r = await fetch(`/api/donna/emails/${id}/aprovar`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...auth }, body: JSON.stringify(corpo ? { corpo } : {}) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Falha ao enviar')
      setEmails(prev => prev.filter(e => e.id !== id))
      toast.success('Resposta enviada')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro') }
  }

  async function descartarEmail(id: string) {
    try {
      await fetch(`/api/donna/emails/${id}/descartar`, { method: 'POST', headers: auth })
      setEmails(prev => prev.filter(e => e.id !== id))
    } catch { toast.error('Falha ao descartar') }
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontSize: 13.5, color: 'var(--ink-mut)' }}>Todas as regras de todos os canais — você decide o que a IA faz sozinha e o que espera sua aprovação. <Link href="/dashboard/agentes/atividade" className="link-v2">Ver atividade e custos por agente →</Link></div>
        <button className="btn-action" onClick={() => { setRegraForm({ ...VAZIO_REGRA }); setShowRegraModal(true) }}>
          <i className="fa-solid fa-plus" style={{ marginRight: 6 }} />Nova regra
        </button>
      </div>

      {/* Conexão Google */}
      <div className="txs-card" style={{ padding: '14px 18px', marginBottom: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(219,68,55,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="fa-brands fa-google" style={{ color: '#DB4437', fontSize: 15 }} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Google (Gmail)</div>
            <div style={{ fontSize: 13, color: 'var(--ink-mut)' }}>{loading ? '—' : googleEmail ? `Conectado · ${googleEmail}` : 'Não conectado'}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-action" style={{ fontSize: 13 }} disabled={conectando} onClick={() => void conectarGoogle()}>{googleEmail ? 'Trocar conta' : 'Conectar com Google'}</button>
          {googleEmail && <button className="btn-action btn-ghost" style={{ fontSize: 13, color: '#B0413E', borderColor: '#B0413E' }} onClick={() => void desconectarGoogle()}>Remover</button>}
        </div>
      </div>

      {/* Bot de atendimento a cliente via Telegram */}
      <div className="txs-card" style={{ padding: '14px 18px', marginBottom: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(34,158,217,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="fa-brands fa-telegram" style={{ color: '#229ED9', fontSize: 15 }} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Telegram — atendimento a clientes</div>
            <div style={{ fontSize: 13, color: 'var(--ink-mut)' }}>
              {loading ? '—' : telegramBotUsername ? 'Divulgue esse link — quem clicar vira uma conversa aqui em Conversas' : 'Bot não configurado ainda (falta TELEGRAM_BOT_TOKEN/USERNAME no ambiente)'}
            </div>
          </div>
        </div>
        {telegramBotUsername && empresaId && (
          <button
            className="btn-action"
            style={{ fontSize: 13 }}
            onClick={() => {
              void navigator.clipboard.writeText(`https://t.me/${telegramBotUsername}?start=${empresaId}`)
              toast.success('Link copiado!')
            }}
          >
            <i className="fa-solid fa-link" style={{ marginRight: 6 }} />Copiar link do bot
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {([['regras', `Regras (${regras.length})`], ['emails', `E-mails pendentes (${emails.length})`]] as [typeof tab, string][]).map(([k, l]) => (
          <button key={k} className={`btn-action${tab !== k ? ' btn-ghost' : ''}`} style={{ fontSize: 13, padding: '5px 12px' }} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {/* ── Regras ── */}
      {tab === 'regras' && (
        regras.length === 0 ? (
          <div className="txs-card" style={{ padding: 36, textAlign: 'center', color: 'var(--ink-mut)', fontSize: 15 }}>
            Sem regras ainda — por padrão a IA sempre pede aprovação antes de agir.
          </div>
        ) : (
          <div className="txs-card">
            {regras.map((r, i) => (
              <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '120px 1fr auto auto auto', gap: 12, alignItems: 'center', padding: '12px 16px', borderBottom: i < regras.length - 1 ? '1px solid var(--line-soft)' : 'none' }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, padding: '3px 9px', borderRadius: 100, background: 'var(--line-soft)', color: 'var(--ink-soft)', justifySelf: 'start' }}>{CANAL_LABEL[r.canal]}</span>
                <div style={{ fontSize: 14, color: 'var(--ink)' }}>{r.nome && <b>{r.nome}: </b>}{r.criterio}</div>
                <button
                  onClick={() => void alternarAutonomia(r)}
                  title="Clique pra alternar entre automático e rascunho"
                  style={{
                    fontSize: 11.5, fontWeight: 700, padding: '4px 10px', borderRadius: 100, border: 'none', cursor: 'pointer',
                    background: r.autonomia === 'automatico' ? 'var(--sage-tint)' : 'var(--gold-tint)',
                    color: r.autonomia === 'automatico' ? 'var(--sage-deep)' : 'var(--gold)',
                  }}
                >
                  <i className={`fa-solid ${r.autonomia === 'automatico' ? 'fa-bolt' : 'fa-pen'}`} style={{ marginRight: 5 }} />
                  {r.autonomia === 'automatico' ? 'Automático' : 'Rascunho'}
                </button>
                <button className={`btn-action${!r.ativa ? ' btn-ghost' : ''}`} style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => void alternarRegra(r)}>{r.ativa ? 'Ligada' : 'Desligada'}</button>
                <button className="btn-action btn-ghost" style={{ fontSize: 12, padding: '4px 8px', color: '#B0413E', borderColor: '#B0413E' }} onClick={() => void excluirRegra(r.id)}><i className="fa-solid fa-trash-can" /></button>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── E-mails ── */}
      {tab === 'emails' && (
        emails.length === 0 ? (
          <div className="txs-card" style={{ padding: 36, textAlign: 'center', color: 'var(--ink-mut)', fontSize: 15 }}>Nenhum rascunho aguardando aprovação.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {emails.map(e => (
              <div key={e.id} className="txs-card" style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--ink)' }}>{e.assunto || '(sem assunto)'}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-faint)' }}>{new Date(e.created_at).toLocaleString('pt-BR')}</div>
                </div>
                <div style={{ fontSize: 13, color: 'var(--ink-mut)', marginBottom: 8 }}>De: {e.remetente}</div>
                <textarea
                  className="form-input"
                  style={{ minHeight: 90, resize: 'vertical', marginBottom: 8 }}
                  value={edicaoEmail[e.id] ?? e.corpo_resposta ?? ''}
                  onChange={ev => setEdicaoEmail(prev => ({ ...prev, [e.id]: ev.target.value }))}
                />
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button className="btn-action btn-ghost" style={{ fontSize: 13, color: '#B0413E', borderColor: '#B0413E' }} onClick={() => void descartarEmail(e.id)}>Descartar</button>
                  <button className="btn-action" style={{ fontSize: 13 }} onClick={() => void aprovarEmail(e.id)}>Aprovar e enviar</button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Modal nova regra */}
      {showRegraModal && (
        <div className="modal-bg" onClick={() => setShowRegraModal(false)}>
          <div className="modal-box" style={{ width: 460 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div className="modal-title">Nova regra de automação</div>
              <button className="modal-close" onClick={() => setShowRegraModal(false)}><i className="fa-solid fa-xmark" /></button>
            </div>
            <div className="form-group"><label className="form-label">Nome (opcional)</label><input className="form-input" placeholder="Ex: Dúvidas de preço" value={regraForm.nome} onChange={e => setRegraForm(f => ({ ...f, nome: e.target.value }))} /></div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Canal</label>
                <select className="form-input" value={regraForm.canal} onChange={e => setRegraForm(f => ({ ...f, canal: e.target.value as Canal }))}>
                  <option value="email">E-mail</option>
                  <option value="site">Atendimento (site)</option>
                  <option value="telegram">Telegram</option>
                </select>
              </div>
              <div className="form-group"><label className="form-label">Autonomia</label>
                <select className="form-input" value={regraForm.autonomia} onChange={e => setRegraForm(f => ({ ...f, autonomia: e.target.value as Autonomia }))}>
                  <option value="rascunho">Rascunho (pede aprovação)</option>
                  <option value="automatico">Automático (age sozinha)</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Palavras-chave</label>
              <input className="form-input" placeholder="Ex: preço, orçamento, valor" value={regraForm.criterio} onChange={e => setRegraForm(f => ({ ...f, criterio: e.target.value }))} />
              <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginTop: 4 }}>Separe por vírgula. Basta uma delas aparecer na mensagem/e-mail pra regra valer.</div>
            </div>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setShowRegraModal(false)}>Cancelar</button>
              <button className="btn-action" onClick={() => void criarRegra()}>Criar regra</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default function AutomacoesPage() {
  return (
    <Suspense fallback={null}>
      <AutomacoesContent />
    </Suspense>
  )
}
