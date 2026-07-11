'use client'

// Inbox unificado de atendimento (Fase 4). Hoje só o canal "Site" (widget)
// tem dados de verdade — WhatsApp/Instagram/Telegram/Facebook aparecem como
// filtros prontos pra quando esses canais forem plugados (escopo separado).
// Bloco "Precisamos de você" é alimentado por /api/donna/atendimento/pendentes
// (conversas aguardando_humano + e-mails pendente_aprovacao).

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'

type Conversa = { id: string; visitante_nome: string | null; visitante_email: string | null; status: string; motivo: string | null; created_at: string; updated_at: string }
type Mensagem = { id: string; autor: 'visitante' | 'donna' | 'humano'; texto: string; pendente_aprovacao: boolean; created_at: string }
type Pendente = { id: string; canal: 'site' | 'email'; contato: string; trecho: string; motivo: string; created_at: string; link: string }
type Regra = { id: string; nome: string | null; canal: 'email' | 'site' | 'telegram'; criterio: string; autonomia: 'rascunho' | 'automatico'; ativa: boolean }

const CANAIS = [
  { id: 'todos', label: 'Todos', icone: 'fa-inbox' },
  { id: 'site', label: 'Site', icone: 'fa-globe' },
  { id: 'whatsapp', label: 'WhatsApp', icone: 'fa-brands fa-whatsapp' },
  { id: 'instagram', label: 'Instagram', icone: 'fa-brands fa-instagram' },
  { id: 'telegram', label: 'Telegram', icone: 'fa-brands fa-telegram' },
]

function iniciais(nome: string | null): string {
  const s = (nome || 'Visitante').trim()
  const partes = s.split(/\s+/).filter(Boolean)
  return ((partes[0]?.[0] ?? '?') + (partes[1]?.[0] ?? '')).toUpperCase()
}

function ConversasContent() {
  const params = useSearchParams()
  const conversaParam = params.get('conversa')

  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(true)
  const [conversas, setConversas] = useState<Conversa[]>([])
  const [conversaAtiva, setConversaAtiva] = useState<Conversa | null>(null)
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [respostaManual, setRespostaManual] = useState('')
  const [canalFiltro, setCanalFiltro] = useState('todos')
  const [busca, setBusca] = useState('')
  const [pendentes, setPendentes] = useState<Pendente[]>([])
  const [regras, setRegras] = useState<Regra[]>([])

  const auth = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token])

  useEffect(() => {
    void (async () => {
      const { data: sess } = await supabase.auth.getSession()
      const tk = sess.session?.access_token ?? ''
      setToken(tk)
      const a = tk ? { Authorization: `Bearer ${tk}` } : {}
      try {
        const [cRes, pRes, rRes] = await Promise.all([
          fetch('/api/donna/atendimento/conversas', { headers: a }),
          fetch('/api/donna/atendimento/pendentes', { headers: a }),
          fetch('/api/donna/regras', { headers: a }),
        ])
        const cj = await cRes.json(); if (cRes.ok) setConversas(cj.conversas ?? [])
        const pj = await pRes.json(); if (pRes.ok) setPendentes(pj.pendentes ?? [])
        const rj = await rRes.json(); if (rRes.ok) setRegras(rj.regras ?? [])
      } catch { /* ignore */ }
      setLoading(false)
    })()
  }, [])

  useEffect(() => {
    if (!conversaParam || conversas.length === 0 || conversaAtiva) return
    const c = conversas.find(x => x.id === conversaParam)
    if (c) void abrirConversa(c)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversaParam, conversas])

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
    const texto = respostaManual
    setRespostaManual('')
    try {
      const r = await fetch(`/api/donna/atendimento/conversas/${conversaAtiva.id}/mensagens`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...auth }, body: JSON.stringify({ texto }) })
      if (!r.ok) throw new Error()
      setMensagens(prev => [...prev, { id: `tmp-${Date.now()}`, autor: 'humano', texto, pendente_aprovacao: false, created_at: new Date().toISOString() }])
    } catch { toast.error('Falha ao responder') }
  }

  async function encerrarConversa() {
    if (!conversaAtiva) return
    try {
      await fetch(`/api/donna/atendimento/conversas/${conversaAtiva.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...auth }, body: JSON.stringify({ status: 'encerrada' }) })
      setConversas(prev => prev.map(c => c.id === conversaAtiva.id ? { ...c, status: 'encerrada' } : c))
      setConversaAtiva(prev => prev ? { ...prev, status: 'encerrada' } : prev)
      toast.success('Conversa encerrada')
    } catch { toast.error('Falha ao encerrar') }
  }

  async function alternarAutonomia(r: Regra) {
    const nova = r.autonomia === 'automatico' ? 'rascunho' : 'automatico'
    setRegras(prev => prev.map(x => x.id === r.id ? { ...x, autonomia: nova } : x))
    try { await fetch(`/api/donna/regras/${r.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...auth }, body: JSON.stringify({ autonomia: nova }) }) } catch { /* ignore */ }
  }

  async function alternarRegraAtiva(r: Regra) {
    setRegras(prev => prev.map(x => x.id === r.id ? { ...x, ativa: !x.ativa } : x))
    try { await fetch(`/api/donna/regras/${r.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...auth }, body: JSON.stringify({ ativa: !r.ativa }) }) } catch { /* ignore */ }
  }

  async function verEResponder(p: Pendente) {
    if (p.canal === 'site') {
      const c = conversas.find(x => x.id === p.id)
      if (c) { await abrirConversa(c); return }
    }
    window.location.href = p.link
  }

  const filtradas = useMemo(() => {
    let lista = [...conversas].sort((a, b) => (a.status === 'aguardando_humano' ? -1 : 1) - (b.status === 'aguardando_humano' ? -1 : 1))
    if (canalFiltro !== 'todos' && canalFiltro !== 'site') lista = [] // só "site" tem dado de verdade hoje
    if (busca.trim()) {
      const q = busca.trim().toLowerCase()
      lista = lista.filter(c => (c.visitante_nome || '').toLowerCase().includes(q) || (c.visitante_email || '').toLowerCase().includes(q))
    }
    return lista
  }, [conversas, canalFiltro, busca])

  const regrasSite = useMemo(() => regras.filter(r => r.canal === 'site'), [regras])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 128px)' }}>
      {pendentes.length > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, var(--warn-soft), var(--card))',
          border: '1.5px solid rgba(217,119,6,.3)', borderRadius: 14, padding: '14px 16px', marginBottom: 16, flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14.5, fontWeight: 800, color: 'var(--warn)' }}>
              <i className="fa-solid fa-bell" />Precisamos de você — a IA não decide sozinha aqui
            </div>
            <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--warn)' }}>{pendentes.length} pendente{pendentes.length === 1 ? '' : 's'}</span>
          </div>
          {pendentes.map((p, i) => (
            <div key={`${p.canal}-${p.id}`} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 0', borderTop: i > 0 ? '1px solid rgba(217,119,6,.22)' : 'none' }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: p.canal === 'site' ? 'var(--sage-deep)' : '#5CA9DB', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 11, flexShrink: 0 }}>
                {p.contato.slice(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b style={{ fontSize: 12.5, display: 'block', color: 'var(--ink)' }}>{p.contato}</b>
                {p.trecho && <small style={{ fontSize: 11.5, color: 'var(--ink-mut)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>&quot;{p.trecho}&quot;</small>}
                <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--warn)', background: 'var(--warn-soft)', padding: '2px 8px', borderRadius: 20, marginTop: 3, display: 'inline-block' }}>{p.motivo}</span>
              </div>
              <button className="btn-action" style={{ fontSize: 11.5, padding: '5px 11px', flexShrink: 0 }} onClick={() => void verEResponder(p)}>Ver e responder</button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '22fr 56fr 22fr', gap: 0, flex: 1, minHeight: 0, margin: '-4px -2px', border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden', background: 'var(--surface)' }}>
        {/* Coluna 1 — lista de conversas (~22%) */}
        <div style={{ borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line-soft)' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)', marginBottom: 10 }}>Caixa de entrada <span style={{ color: 'var(--ink-mut)', fontWeight: 600 }}>{conversas.length}</span></div>
            <input
              className="form-input"
              placeholder="Buscar conversas…"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              style={{ fontSize: 13.5, height: 34 }}
            />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
              {CANAIS.map(c => (
                <button
                  key={c.id}
                  onClick={() => setCanalFiltro(c.id)}
                  style={{
                    fontSize: 12, padding: '4px 10px', borderRadius: 20, border: '1px solid var(--line)', cursor: 'pointer',
                    background: canalFiltro === c.id ? 'var(--sage-deep)' : 'var(--surface-2)',
                    color: canalFiltro === c.id ? '#fff' : 'var(--ink-mut)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >
                  <i className={c.icone.includes('fa-') && !c.icone.startsWith('fa-brands') ? `fa-solid ${c.icone}` : c.icone} style={{ fontSize: 11 }} />
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: 30, textAlign: 'center', color: 'var(--ink-mut)', fontSize: 14 }}>Carregando…</div>
            ) : filtradas.length === 0 ? (
              <div style={{ padding: 30, textAlign: 'center', color: 'var(--ink-mut)', fontSize: 14 }}>
                {canalFiltro !== 'todos' && canalFiltro !== 'site' ? 'Esse canal ainda não está conectado.' : 'Nenhuma conversa ainda.'}
              </div>
            ) : filtradas.map(c => (
              <div
                key={c.id}
                onClick={() => void abrirConversa(c)}
                style={{
                  display: 'flex', gap: 10, padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid var(--line-soft)',
                  background: conversaAtiva?.id === c.id ? 'var(--sage-tint)' : 'transparent',
                }}
              >
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--sage-tint)', color: 'var(--sage-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
                  {iniciais(c.visitante_nome)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.visitante_nome || 'Visitante'}</span>
                    <span style={{ fontSize: 11, color: 'var(--ink-faint)', flexShrink: 0 }}>{new Date(c.updated_at).toLocaleDateString('pt-BR')}</span>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 100, display: 'inline-block', marginTop: 4,
                    background: c.status === 'aguardando_humano' ? 'var(--warn-soft)' : c.status === 'encerrada' ? 'var(--line-soft)' : 'var(--sage-tint)',
                    color: c.status === 'aguardando_humano' ? 'var(--warn)' : c.status === 'encerrada' ? 'var(--ink-mut)' : 'var(--sage-deep)',
                  }}>
                    {c.status === 'aguardando_humano' ? 'aguardando você' : c.status === 'encerrada' ? 'encerrada' : 'aberta'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Coluna 2 — thread (~56%, aumentada) */}
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, borderRight: '1px solid var(--line)' }}>
          {!conversaAtiva ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-mut)', fontSize: 14.5 }}>Selecione uma conversa.</div>
          ) : (
            <>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line-soft)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>{conversaAtiva.visitante_nome || 'Visitante'}</span>
                    {conversaAtiva.status === 'aguardando_humano' && (
                      <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--warn)', background: 'var(--warn-soft)', padding: '2px 8px', borderRadius: 20 }}>Aguardando você</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-mut)' }}><i className="fa-solid fa-globe" style={{ marginRight: 5 }} />Site</div>
                </div>
                <button className="btn-action btn-ghost" style={{ fontSize: 12.5 }} onClick={() => void encerrarConversa()}>Encerrar conversa</button>
              </div>
              {conversaAtiva.status === 'aguardando_humano' && conversaAtiva.motivo && (
                <div style={{ padding: '8px 18px', fontSize: 12.5, color: 'var(--warn)', background: 'var(--warn-soft)', borderBottom: '1px solid rgba(217,119,6,.2)' }}>
                  <i className="fa-solid fa-circle-info" style={{ marginRight: 6 }} />{conversaAtiva.motivo}
                </div>
              )}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {mensagens.map(m => (
                  <div key={m.id} style={{
                    alignSelf: m.autor === 'visitante' ? 'flex-start' : 'flex-end',
                    background: m.pendente_aprovacao ? 'var(--warn-soft)' : m.autor === 'visitante' ? 'var(--surface-2)' : 'var(--sage-tint)',
                    border: m.pendente_aprovacao ? '1px dashed var(--warn)' : '1px solid var(--line-soft)',
                    borderRadius: 12, padding: '10px 14px', fontSize: 14, maxWidth: '72%',
                  }}>
                    <div style={{ fontSize: 11, color: m.pendente_aprovacao ? 'var(--warn)' : 'var(--ink-mut)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 700 }}>
                      {m.autor === 'visitante' ? 'Cliente' : m.autor === 'humano' ? 'Você' : m.pendente_aprovacao ? 'IA · pausada, aguardando você' : 'IA · automático'}
                    </div>
                    <div>{m.texto}</div>
                    {m.pendente_aprovacao && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                        <button className="btn-action" style={{ fontSize: 12, padding: '3px 9px' }} onClick={() => void aprovarMensagem(m.id)}>Aprovar</button>
                        <button className="btn-action btn-ghost" style={{ fontSize: 12, padding: '3px 9px' }} onClick={() => void descartarMensagem(m.id)}>Descartar</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ padding: '12px 18px', borderTop: '1px solid var(--line-soft)', display: 'flex', gap: 8 }}>
                <input
                  className="form-input"
                  placeholder="Digite uma mensagem…"
                  value={respostaManual}
                  onChange={e => setRespostaManual(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') void responderManual() }}
                  style={{ flex: 1 }}
                />
                <button className="btn-action" onClick={() => void responderManual()}><i className="fa-solid fa-paper-plane" /></button>
              </div>
            </>
          )}
        </div>

        {/* Coluna 3 — painel de automação da conversa (~22%) */}
        <div style={{ overflowY: 'auto' }}>
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--line-soft)', fontSize: 12.5, fontWeight: 800, color: 'var(--ink)' }}>
            Automação · Site
          </div>
          {regrasSite.length === 0 ? (
            <div style={{ padding: '18px 16px', fontSize: 12.5, color: 'var(--ink-mut)' }}>Sem regras cadastradas pro canal Site ainda.</div>
          ) : regrasSite.map(r => (
            <div key={r.id} style={{ padding: '10px 16px', borderBottom: '1px solid var(--line-soft)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                <b style={{ fontSize: 12.5, color: 'var(--ink)' }}>{r.nome || r.criterio}</b>
                <button
                  onClick={() => void alternarRegraAtiva(r)}
                  title={r.ativa ? 'Desligar regra' : 'Ligar regra'}
                  style={{ width: 30, height: 17, borderRadius: 10, border: 'none', cursor: 'pointer', background: r.ativa ? 'var(--sage-deep)' : 'var(--line)', position: 'relative', flexShrink: 0 }}
                >
                  <span style={{ position: 'absolute', top: 2, left: r.ativa ? 15 : 2, width: 13, height: 13, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
                </button>
              </div>
              <small style={{ fontSize: 10.5, color: 'var(--ink-mut)', lineHeight: 1.4, display: 'block' }}>Palavras-chave: {r.criterio}</small>
              <button
                onClick={() => void alternarAutonomia(r)}
                title="Clique pra alternar entre automático e rascunho"
                style={{
                  fontSize: 9.5, fontWeight: 800, padding: '2px 8px', borderRadius: 20, marginTop: 5, border: 'none', cursor: 'pointer', display: 'inline-block',
                  background: r.autonomia === 'automatico' ? 'var(--sage-tint)' : 'var(--warn-soft)',
                  color: r.autonomia === 'automatico' ? 'var(--sage-deep)' : 'var(--warn)',
                }}
              >
                {r.autonomia === 'automatico' ? 'Automático' : 'Rascunho / aprovação'}
              </button>
            </div>
          ))}
          <div style={{ padding: '10px 16px' }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, marginBottom: 3, color: 'var(--ink)' }}>Pedidos sensíveis</div>
            <small style={{ fontSize: 10.5, color: 'var(--ink-mut)', lineHeight: 1.4, display: 'block' }}>Cancelamento, reclamação e negociação — a IA sempre transfere pra você, nunca decide sozinha</small>
            <span style={{ fontSize: 9.5, fontWeight: 800, padding: '2px 8px', borderRadius: 20, marginTop: 5, display: 'inline-block', background: 'var(--warn-soft)', color: 'var(--warn)' }}>
              Sempre manual
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ConversasPage() {
  return (
    <Suspense fallback={null}>
      <ConversasContent />
    </Suspense>
  )
}
