'use client'

// Inbox unificado de atendimento. Hoje só o canal "Site" (widget) tem dados
// de verdade — WhatsApp/Instagram/Telegram/Facebook aparecem como filtros
// prontos pra quando esses canais forem plugados (fase 2, escopo separado).
// Consome os mesmos endpoints já usados em /dashboard/agentes/donna.

import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'

type Conversa = { id: string; visitante_nome: string | null; visitante_email: string | null; status: string; created_at: string; updated_at: string }
type Mensagem = { id: string; autor: 'visitante' | 'donna' | 'humano'; texto: string; pendente_aprovacao: boolean; created_at: string }

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

export default function ConversasPage() {
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(true)
  const [conversas, setConversas] = useState<Conversa[]>([])
  const [conversaAtiva, setConversaAtiva] = useState<Conversa | null>(null)
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [respostaManual, setRespostaManual] = useState('')
  const [canalFiltro, setCanalFiltro] = useState('todos')
  const [busca, setBusca] = useState('')

  const auth = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token])

  useEffect(() => {
    void (async () => {
      const { data: sess } = await supabase.auth.getSession()
      const tk = sess.session?.access_token ?? ''
      setToken(tk)
      try {
        const r = await fetch('/api/donna/atendimento/conversas', { headers: tk ? { Authorization: `Bearer ${tk}` } : {} })
        const j = await r.json()
        if (r.ok) setConversas(j.conversas ?? [])
      } catch { /* ignore */ }
      setLoading(false)
    })()
  }, [])

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

  const filtradas = useMemo(() => {
    let lista = [...conversas].sort((a, b) => (a.status === 'aguardando_humano' ? -1 : 1) - (b.status === 'aguardando_humano' ? -1 : 1))
    if (canalFiltro !== 'todos' && canalFiltro !== 'site') lista = [] // só "site" tem dado de verdade hoje
    if (busca.trim()) {
      const q = busca.trim().toLowerCase()
      lista = lista.filter(c => (c.visitante_nome || '').toLowerCase().includes(q) || (c.visitante_email || '').toLowerCase().includes(q))
    }
    return lista
  }, [conversas, canalFiltro, busca])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr 280px', gap: 0, height: 'calc(100vh - 128px)', margin: '-4px -2px', border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden', background: 'var(--surface)' }}>
      {/* Coluna 1 — lista de conversas */}
      <div style={{ borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line-soft)' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)', marginBottom: 10 }}>Todas as conversas</div>
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
                  background: c.status === 'aguardando_humano' ? 'var(--brick-tint)' : c.status === 'encerrada' ? 'var(--line-soft)' : 'var(--sage-tint)',
                  color: c.status === 'aguardando_humano' ? 'var(--brick)' : c.status === 'encerrada' ? 'var(--ink-mut)' : 'var(--sage-deep)',
                }}>
                  {c.status === 'aguardando_humano' ? 'aguardando você' : c.status === 'encerrada' ? 'encerrada' : 'aberta'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Coluna 2 — thread */}
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {!conversaAtiva ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-mut)', fontSize: 14.5 }}>Selecione uma conversa.</div>
        ) : (
          <>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line-soft)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>{conversaAtiva.visitante_nome || 'Visitante'}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-mut)' }}><i className="fa-solid fa-globe" style={{ marginRight: 5 }} />Site</div>
              </div>
              <button className="btn-action btn-ghost" style={{ fontSize: 12.5 }} onClick={() => void encerrarConversa()}>Encerrar conversa</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {mensagens.map(m => (
                <div key={m.id} style={{
                  alignSelf: m.autor === 'visitante' ? 'flex-start' : 'flex-end',
                  background: m.pendente_aprovacao ? 'var(--gold-tint)' : m.autor === 'visitante' ? 'var(--surface-2)' : 'var(--sage-tint)',
                  border: m.pendente_aprovacao ? '1px dashed var(--gold)' : '1px solid var(--line-soft)',
                  borderRadius: 12, padding: '10px 14px', fontSize: 14, maxWidth: '72%',
                }}>
                  <div style={{ fontSize: 11, color: 'var(--ink-mut)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 700 }}>
                    {m.autor === 'visitante' ? 'Cliente' : m.autor === 'donna' ? 'IA' : 'Você'}{m.pendente_aprovacao ? ' · aguardando aprovação' : ''}
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

      {/* Coluna 3 — dados do contato */}
      <div style={{ borderLeft: '1px solid var(--line)', padding: '16px 18px', overflowY: 'auto' }}>
        {!conversaAtiva ? (
          <div style={{ color: 'var(--ink-mut)', fontSize: 13.5 }}>Nenhum contato selecionado.</div>
        ) : (
          <>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink-mut)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 14 }}>Informações do contato</div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: 18 }}>
              <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--sage-tint)', color: 'var(--sage-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 20, marginBottom: 8 }}>
                {iniciais(conversaAtiva.visitante_nome)}
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>{conversaAtiva.visitante_nome || 'Visitante'}</div>
              {conversaAtiva.visitante_email && <div style={{ fontSize: 12.5, color: 'var(--ink-mut)', marginTop: 2 }}>{conversaAtiva.visitante_email}</div>}
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-mut)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Canal de origem</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: 'var(--ink-soft)', marginBottom: 18 }}>
              <i className="fa-solid fa-globe" style={{ color: 'var(--sage-deep)' }} />Site
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-mut)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Primeiro contato</div>
            <div style={{ fontSize: 13.5, color: 'var(--ink-soft)' }}>{new Date(conversaAtiva.created_at).toLocaleDateString('pt-BR')}</div>
          </>
        )}
      </div>
    </div>
  )
}
