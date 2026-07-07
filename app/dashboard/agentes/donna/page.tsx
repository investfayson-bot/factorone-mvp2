'use client'

import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'

type Canal = 'email' | 'site' | 'telegram'
type Autonomia = 'rascunho' | 'automatico'
type Regra = { id: string; nome: string | null; canal: Canal; criterio: string; autonomia: Autonomia; ativa: boolean; created_at: string }
type EmailItem = { id: string; remetente: string; assunto: string; snippet: string; corpo_resposta: string | null; status: string; created_at: string }
type Conversa = { id: string; visitante_nome: string | null; visitante_email: string | null; status: string; created_at: string; updated_at: string }
type Mensagem = { id: string; autor: 'visitante' | 'donna' | 'humano'; texto: string; pendente_aprovacao: boolean; created_at: string }
type Acao = { agente_id: string; custo_usd: number }

const CANAL_LABEL: Record<Canal, string> = { email: 'E-mail', site: 'Site', telegram: 'Telegram' }
const VAZIO_REGRA = { nome: '', canal: 'email' as Canal, criterio: '', autonomia: 'rascunho' as Autonomia, ativa: true }

export default function DonnaPage() {
  const [token, setToken] = useState('')
  const [tab, setTab] = useState<'regras' | 'emails' | 'atendimento'>('emails')
  const [loading, setLoading] = useState(true)

  const [googleEmail, setGoogleEmail] = useState<string | null>(null)
  const [conectando, setConectando] = useState(false)

  const [site, setSite] = useState<{ slug: string; nome: string; cor: string } | null>(null)

  const [regras, setRegras] = useState<Regra[]>([])
  const [showRegraModal, setShowRegraModal] = useState(false)
  const [regraForm, setRegraForm] = useState({ ...VAZIO_REGRA })

  const [emails, setEmails] = useState<EmailItem[]>([])
  const [historico, setHistorico] = useState<EmailItem[]>([])
  const [edicaoEmail, setEdicaoEmail] = useState<Record<string, string>>({})
  const [mostrarHistorico, setMostrarHistorico] = useState(false)

  const [conversas, setConversas] = useState<Conversa[]>([])
  const [conversaAtiva, setConversaAtiva] = useState<Conversa | null>(null)
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [respostaManual, setRespostaManual] = useState('')

  const [custoTotal, setCustoTotal] = useState(0)

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

      const a = tk ? { Authorization: `Bearer ${tk}` } : {}
      const [contaRes, siteRes, regrasRes, emailsRes, histRes, conversasRes, acoesRes] = await Promise.all([
        supabase.from('google_contas').select('email').eq('empresa_id', eid).maybeSingle(),
        supabase.from('sites').select('slug,nome,cor').eq('empresa_id', eid).maybeSingle(),
        fetch('/api/donna/regras', { headers: a }),
        fetch('/api/donna/emails?status=pendente_aprovacao', { headers: a }),
        fetch('/api/donna/emails', { headers: a }),
        fetch('/api/donna/atendimento/conversas', { headers: a }),
        fetch('/api/agentes/acoes', { headers: a }),
      ])
      setGoogleEmail((contaRes.data?.email as string) ?? null)
      if (siteRes.data) setSite({ slug: siteRes.data.slug as string, nome: (siteRes.data.nome as string) ?? '', cor: (siteRes.data.cor as string) ?? '#3D7A6E' })
      const jr = await regrasRes.json(); if (regrasRes.ok) setRegras(jr.regras ?? [])
      const je = await emailsRes.json(); if (emailsRes.ok) setEmails(je.emails ?? [])
      const jh = await histRes.json(); if (histRes.ok) setHistorico(jh.emails ?? [])
      const jc = await conversasRes.json(); if (conversasRes.ok) setConversas(jc.conversas ?? [])
      const ja = await acoesRes.json()
      if (acoesRes.ok) setCustoTotal((ja.acoes ?? []).filter((a2: Acao) => a2.agente_id === 'donna').reduce((s: number, a2: Acao) => s + Number(a2.custo_usd || 0), 0))

      const params = new URLSearchParams(window.location.search)
      if (params.get('conectado')) toast.success('Google conectado! Já pode configurar as regras.')
      if (params.get('erro')) toast.error(params.get('erro') || 'Falha ao conectar')

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
    if (!window.confirm('Desconectar o Google? A Donna para de ler/responder e-mails.')) return
    try {
      const r = await fetch('/api/google/desconectar', { method: 'POST', headers: auth })
      if (!r.ok) throw new Error()
      setGoogleEmail(null)
      toast.success('Google desconectado')
    } catch { toast.error('Falha ao desconectar') }
  }

  async function verificarAgora() {
    setConectando(true)
    try {
      const r = await fetch('/api/donna/verificar-agora', { method: 'POST', headers: auth })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Falha')
      toast.success(`${j.processados} e-mail(s) processado(s)`)
      const re = await fetch('/api/donna/emails?status=pendente_aprovacao', { headers: auth })
      const je = await re.json(); if (re.ok) setEmails(je.emails ?? [])
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro') }
    finally { setConectando(false) }
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

  async function abrirConversa(c: Conversa) {
    setConversaAtiva(c)
    setMensagens([])
    try {
      const r = await fetch(`/api/donna/atendimento/conversas/${c.id}/mensagens`, { headers: auth })
      const j = await r.json()
      if (r.ok) setMensagens(j.mensagens ?? [])
    } catch { /* ignore */ }
  }

  async function aprovarMensagem(id: string) {
    try {
      await fetch(`/api/donna/atendimento/mensagens/${id}/aprovar`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...auth }, body: JSON.stringify({}) })
      setMensagens(prev => prev.map(m => m.id === id ? { ...m, pendente_aprovacao: false } : m))
    } catch { toast.error('Falha ao aprovar') }
  }

  async function descartarMensagem(id: string) {
    try {
      await fetch(`/api/donna/atendimento/mensagens/${id}/descartar`, { method: 'POST', headers: auth })
      setMensagens(prev => prev.filter(m => m.id !== id))
    } catch { toast.error('Falha ao descartar') }
  }

  async function responderManual() {
    if (!conversaAtiva || !respostaManual.trim()) return
    try {
      const r = await fetch(`/api/donna/atendimento/conversas/${conversaAtiva.id}/mensagens`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...auth }, body: JSON.stringify({ texto: respostaManual }) })
      if (!r.ok) throw new Error()
      setMensagens(prev => [...prev, { id: `tmp-${Date.now()}`, autor: 'humano', texto: respostaManual, pendente_aprovacao: false, created_at: new Date().toISOString() }])
      setRespostaManual('')
    } catch { toast.error('Falha ao responder') }
  }

  async function encerrarConversa() {
    if (!conversaAtiva) return
    try {
      await fetch(`/api/donna/atendimento/conversas/${conversaAtiva.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...auth }, body: JSON.stringify({ status: 'encerrada' }) })
      setConversas(prev => prev.map(c => c.id === conversaAtiva.id ? { ...c, status: 'encerrada' } : c))
      setConversaAtiva(null)
      toast.success('Conversa encerrada')
    } catch { toast.error('Falha ao encerrar') }
  }

  const processados7d = useMemo(() => {
    const corte = Date.now() - 7 * 86400000
    return historico.filter(e => new Date(e.created_at).getTime() >= corte).length
  }, [historico])
  const aguardandoHumano = conversas.filter(c => c.status === 'aguardando_humano').length
  const conversasOrdenadas = useMemo(() => [...conversas].sort((a, b) => (a.status === 'aguardando_humano' ? -1 : 1) - (b.status === 'aguardando_humano' ? -1 : 1)), [conversas])

  return (
    <>
      <div className="page-hdr">
        <div>
          <div className="page-title">Donna</div>
          <div className="page-sub">E-mail, atendimento do site e Telegram — regras de autonomia e filas de aprovação.</div>
        </div>
      </div>

      <div className="kpis" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="kpi"><div className="kpi-lbl">E-mails (7d)</div><div className="kpi-val">{loading ? '—' : processados7d}</div></div>
        <div className="kpi"><div className="kpi-lbl">Pendentes de aprovação</div><div className="kpi-val" style={{ color: 'var(--gold)' }}>{loading ? '—' : emails.length}</div></div>
        <div className="kpi"><div className="kpi-lbl">Atendimento aguardando você</div><div className="kpi-val" style={{ color: aguardandoHumano ? 'var(--brick)' : 'var(--ink)' }}>{loading ? '—' : aguardandoHumano}</div></div>
        <div className="kpi"><div className="kpi-lbl">Custo de IA</div><div className="kpi-val" style={{ fontSize: 20 }}>{loading ? '—' : `$${custoTotal.toFixed(4)}`}</div></div>
      </div>

      {/* Widget embed pra qualquer site externo */}
      <div className="txs-card" style={{ padding: '14px 18px', marginBottom: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>Widget pra outros sites</div>
        {!site ? (
          <div style={{ fontSize: 12, color: 'var(--ink-mut)' }}>
            Você ainda não tem um site no FactorOne — crie um em <a href="/dashboard/marketing/site" style={{ color: 'var(--sage-deep)', fontWeight: 600 }}>Marketing → Gere seu site</a> pra liberar o link/slug que o widget usa.
          </div>
        ) : (
          <>
            <div style={{ fontSize: 11.5, color: 'var(--ink-mut)', marginBottom: 8 }}>Cole esse código antes do <code>&lt;/body&gt;</code> de qualquer site seu (Wordpress, domínio próprio, o que for) — a bolha de chat aparece conectada às suas regras, CRM e agenda.</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <code style={{ flex: 1, fontSize: 11, background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 8, padding: '10px 12px', overflowX: 'auto', whiteSpace: 'pre', fontFamily: 'var(--font-mono)' }}>
                {`<script src="${typeof window !== 'undefined' ? window.location.origin : ''}/donna-embed.js" data-slug="${site.slug}" data-cor="${site.cor}" data-nome="${site.nome}" defer></script>`}
              </code>
              <button className="btn-action" style={{ fontSize: 11, flexShrink: 0 }} onClick={() => {
                const snippet = `<script src="${window.location.origin}/donna-embed.js" data-slug="${site.slug}" data-cor="${site.cor}" data-nome="${site.nome}" defer></script>`
                void navigator.clipboard.writeText(snippet); toast.success('Código copiado')
              }}>Copiar</button>
            </div>
          </>
        )}
      </div>

      {/* Conexão Google */}
      <div className="txs-card" style={{ padding: '14px 18px', marginBottom: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(219,68,55,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="fa-brands fa-google" style={{ color: '#DB4437', fontSize: 15 }} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Google (Gmail)</div>
            <div style={{ fontSize: 11, color: 'var(--ink-mut)' }}>{loading ? '—' : googleEmail ? `Conectado · ${googleEmail}` : 'Não conectado'}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {googleEmail && <button className="btn-ghost" style={{ fontSize: 11 }} disabled={conectando} onClick={() => void verificarAgora()}>Verificar agora</button>}
          <button className="btn-action" style={{ fontSize: 11 }} disabled={conectando} onClick={() => void conectarGoogle()}>{googleEmail ? 'Trocar conta' : 'Conectar com Google'}</button>
          {googleEmail && <button className="btn-ghost" style={{ fontSize: 11, color: '#B0413E', borderColor: '#B0413E' }} onClick={() => void desconectarGoogle()}>Remover</button>}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {([['emails', 'E-mails'], ['atendimento', 'Atendimento'], ['regras', 'Regras']] as [typeof tab, string][]).map(([k, l]) => (
          <button key={k} className={`btn-action${tab !== k ? ' btn-ghost' : ''}`} style={{ fontSize: 11, padding: '5px 12px' }} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {/* ── E-mails ── */}
      {tab === 'emails' && (
        <>
          {emails.length === 0 ? (
            <div className="txs-card" style={{ padding: 36, textAlign: 'center', color: 'var(--ink-mut)', fontSize: 13 }}>Nenhum rascunho aguardando aprovação.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {emails.map(e => (
                <div key={e.id} className="txs-card" style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>{e.assunto || '(sem assunto)'}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--ink-faint)' }}>{new Date(e.created_at).toLocaleString('pt-BR')}</div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ink-mut)', marginBottom: 8 }}>De: {e.remetente}</div>
                  <textarea
                    className="form-input"
                    style={{ minHeight: 90, resize: 'vertical', marginBottom: 8 }}
                    value={edicaoEmail[e.id] ?? e.corpo_resposta ?? ''}
                    onChange={ev => setEdicaoEmail(prev => ({ ...prev, [e.id]: ev.target.value }))}
                  />
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button className="btn-ghost" style={{ fontSize: 11, color: '#B0413E', borderColor: '#B0413E' }} onClick={() => void descartarEmail(e.id)}>Descartar</button>
                    <button className="btn-action" style={{ fontSize: 11 }} onClick={() => void aprovarEmail(e.id)}>Aprovar e enviar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => setMostrarHistorico(v => !v)}>{mostrarHistorico ? 'Ocultar histórico' : 'Ver histórico'}</button>
          {mostrarHistorico && (
            <div className="txs-card" style={{ marginTop: 10 }}>
              {historico.filter(e => e.status !== 'pendente_aprovacao').slice(0, 30).map((e, i, arr) => (
                <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 16px', borderBottom: i < arr.length - 1 ? '1px solid var(--line-soft)' : 'none', fontSize: 11.5 }}>
                  <span style={{ color: 'var(--ink)' }}>{e.assunto || '(sem assunto)'} <span style={{ color: 'var(--ink-mut)' }}>· {e.remetente}</span></span>
                  <span style={{ color: 'var(--ink-faint)', textTransform: 'capitalize' }}>{e.status}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Atendimento ── */}
      {tab === 'atendimento' && (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 14 }}>
          <div className="txs-card" style={{ maxHeight: 560, overflowY: 'auto' }}>
            {conversasOrdenadas.length === 0 ? (
              <div style={{ padding: 30, textAlign: 'center', color: 'var(--ink-mut)', fontSize: 12.5 }}>Nenhuma conversa ainda.</div>
            ) : conversasOrdenadas.map((c, i) => (
              <div key={c.id} onClick={() => void abrirConversa(c)} style={{
                padding: '11px 14px', cursor: 'pointer', borderBottom: i < conversasOrdenadas.length - 1 ? '1px solid var(--line-soft)' : 'none',
                background: conversaAtiva?.id === c.id ? 'var(--sage-tint)' : 'transparent',
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>{c.visitante_nome || 'Visitante'}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                  <span style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 7px', borderRadius: 100, background: c.status === 'aguardando_humano' ? 'var(--brick-tint)' : c.status === 'encerrada' ? 'var(--line-soft)' : 'var(--sage-tint)', color: c.status === 'aguardando_humano' ? 'var(--brick)' : c.status === 'encerrada' ? 'var(--ink-mut)' : 'var(--sage-deep)' }}>
                    {c.status === 'aguardando_humano' ? 'aguardando você' : c.status === 'encerrada' ? 'encerrada' : 'aberta'}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--ink-faint)' }}>{new Date(c.updated_at).toLocaleDateString('pt-BR')}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="txs-card" style={{ padding: 16, minHeight: 400 }}>
            {!conversaAtiva ? (
              <div style={{ textAlign: 'center', color: 'var(--ink-mut)', fontSize: 12.5, marginTop: 60 }}>Selecione uma conversa.</div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{conversaAtiva.visitante_nome || 'Visitante'}</div>
                  <button className="btn-ghost" style={{ fontSize: 10.5 }} onClick={() => void encerrarConversa()}>Encerrar conversa</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 340, overflowY: 'auto', marginBottom: 12 }}>
                  {mensagens.map(m => (
                    <div key={m.id} style={{
                      alignSelf: m.autor === 'visitante' ? 'flex-start' : 'flex-end',
                      background: m.pendente_aprovacao ? 'var(--gold-tint)' : m.autor === 'visitante' ? 'var(--surface-2)' : 'var(--sage-tint)',
                      border: m.pendente_aprovacao ? '1px dashed var(--gold)' : 'none',
                      borderRadius: 10, padding: '8px 12px', fontSize: 12.5, maxWidth: '80%',
                    }}>
                      <div style={{ fontSize: 9.5, color: 'var(--ink-mut)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '.05em' }}>{m.autor}{m.pendente_aprovacao ? ' · aguardando aprovação' : ''}</div>
                      <div>{m.texto}</div>
                      {m.pendente_aprovacao && (
                        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                          <button className="btn-action" style={{ fontSize: 10, padding: '3px 9px' }} onClick={() => void aprovarMensagem(m.id)}>Aprovar</button>
                          <button className="btn-ghost" style={{ fontSize: 10, padding: '3px 9px' }} onClick={() => void descartarMensagem(m.id)}>Descartar</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="form-input" placeholder="Responder manualmente…" value={respostaManual} onChange={e => setRespostaManual(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void responderManual() }} />
                  <button className="btn-action" style={{ fontSize: 11 }} onClick={() => void responderManual()}>Enviar</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Regras ── */}
      {tab === 'regras' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
            <button className="btn-action" style={{ fontSize: 12 }} onClick={() => { setRegraForm({ ...VAZIO_REGRA }); setShowRegraModal(true) }}><i className="fa-solid fa-plus" style={{ marginRight: 6 }} />Nova regra</button>
          </div>
          {regras.length === 0 ? (
            <div className="txs-card" style={{ padding: 36, textAlign: 'center', color: 'var(--ink-mut)', fontSize: 13 }}>
              Sem regras ainda — por padrão a Donna sempre pede aprovação antes de agir.
            </div>
          ) : (
            <div className="txs-card">
              {regras.map((r, i) => (
                <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 110px auto auto', gap: 12, alignItems: 'center', padding: '11px 16px', borderBottom: i < regras.length - 1 ? '1px solid var(--line-soft)' : 'none' }}>
                  <span style={{ fontSize: 9.5, fontWeight: 700, padding: '3px 9px', borderRadius: 100, background: 'var(--line-soft)', color: 'var(--ink-soft)', justifySelf: 'start' }}>{CANAL_LABEL[r.canal]}</span>
                  <div style={{ fontSize: 12, color: 'var(--ink)' }}>{r.nome && <b>{r.nome}: </b>}{r.criterio}</div>
                  <span style={{ fontSize: 9.5, fontWeight: 700, padding: '3px 9px', borderRadius: 100, justifySelf: 'start', background: r.autonomia === 'automatico' ? 'var(--sage-tint)' : 'var(--gold-tint)', color: r.autonomia === 'automatico' ? 'var(--sage-deep)' : 'var(--gold)' }}>
                    {r.autonomia === 'automatico' ? 'Automático' : 'Rascunho'}
                  </span>
                  <button className={`btn-action${!r.ativa ? ' btn-ghost' : ''}`} style={{ fontSize: 10, padding: '4px 10px' }} onClick={() => void alternarRegra(r)}>{r.ativa ? 'Ativa' : 'Inativa'}</button>
                  <button className="btn-ghost" style={{ fontSize: 10, padding: '4px 8px', color: '#B0413E', borderColor: '#B0413E' }} onClick={() => void excluirRegra(r.id)}><i className="fa-solid fa-trash-can" /></button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modal nova regra */}
      {showRegraModal && (
        <div className="modal-bg" onClick={() => setShowRegraModal(false)}>
          <div className="modal-box" style={{ width: 460 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div className="modal-title">Nova regra</div>
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
              <div style={{ fontSize: 10.5, color: 'var(--ink-faint)', marginTop: 4 }}>Separe por vírgula. Basta uma delas aparecer na mensagem/e-mail pra regra valer.</div>
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
