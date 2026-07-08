'use client'

import { useRef, useState } from 'react'
import { AGENTES, type Agente } from '@/lib/hub-agentes'
import { supabase } from '@/lib/supabase'

type Msg = { role: 'user' | 'assistant'; content: string }

export default function AgentesPage() {
  const [ativo, setAtivo] = useState<Agente>(AGENTES[0])
  const [threads, setThreads] = useState<Record<string, Msg[]>>({})
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const mensagens = threads[ativo.id] ?? []

  function trocar(a: Agente) {
    setAtivo(a)
    setInput('')
  }

  async function enviar(texto?: string) {
    const conteudo = (texto ?? input).trim()
    if (!conteudo || loading) return
    const novas: Msg[] = [...mensagens, { role: 'user', content: conteudo }]
    setThreads((t) => ({ ...t, [ativo.id]: novas }))
    setInput('')
    setLoading(true)
    try {
      const { data: sess } = await supabase.auth.getSession()
      const token = sess.session?.access_token
      const res = await fetch('/api/hub/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ agentId: ativo.id, messages: novas }),
      })
      const payload = await res.json().catch(() => ({}))
      const reply = res.ok ? (payload.reply || '') : `Erro: ${payload.error || 'falha ao responder'}`
      setThreads((t) => ({ ...t, [ativo.id]: [...novas, { role: 'assistant', content: reply }] }))
    } catch {
      setThreads((t) => ({ ...t, [ativo.id]: [...novas, { role: 'assistant', content: 'Erro de conexão. Tente novamente.' }] }))
    } finally {
      setLoading(false)
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }))
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16, height: '100%', minHeight: 0 }}>
      {/* Lista de agentes */}
      <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: 10, overflowY: 'auto' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '.06em', padding: '6px 8px' }}>
          Squad FactorOne AI
        </div>
        {AGENTES.map((a) => {
          const sel = a.id === ativo.id
          return (
            <button
              key={a.id}
              onClick={() => trocar(a)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
                padding: '9px 8px', borderRadius: 9, cursor: 'pointer', marginBottom: 2,
                border: '1px solid', borderColor: sel ? a.cor : 'transparent',
                background: sel ? `${a.cor}10` : 'transparent',
              }}
            >
              <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: a.cor, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800 }}>
                {a.inicial}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--navy)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.nome}</div>
                <div style={{ fontSize: 12.5, color: 'var(--gray-400)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.especialidade}</div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Chat */}
      <div style={{ display: 'flex', flexDirection: 'column', background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--gray-100)' }}>
          <div style={{ width: 38, height: 38, borderRadius: 9, background: ativo.cor, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800 }}>{ativo.inicial}</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)' }}>{ativo.nome}</div>
            <div style={{ fontSize: 13, color: 'var(--gray-400)' }}>{ativo.especialidade}</div>
          </div>
          <div style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: 'rgba(124,58,237,.1)', color: '#7A6A9E' }}>FactorOne AI</div>
        </div>

        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
          {mensagens.length === 0 && (
            <div style={{ margin: 'auto', textAlign: 'center', maxWidth: 420 }}>
              <div style={{ width: 56, height: 56, borderRadius: 14, background: ativo.cor, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, margin: '0 auto 14px' }}>{ativo.inicial}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>Converse com {ativo.nome}</div>
              <div style={{ fontSize: 14, color: 'var(--gray-400)', marginBottom: 16 }}>{ativo.especialidade}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {ativo.sugestoes.map((s) => (
                  <button key={s} onClick={() => void enviar(s)} style={{ fontSize: 14, color: 'var(--navy)', background: '#fafafa', border: '1px solid var(--gray-100)', borderRadius: 9, padding: '9px 12px', cursor: 'pointer', textAlign: 'left' }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {mensagens.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '80%', padding: '10px 14px', borderRadius: 12, fontSize: 15, lineHeight: 1.6, whiteSpace: 'pre-wrap',
                background: m.role === 'user' ? ativo.cor : '#f4f5f7',
                color: m.role === 'user' ? '#fff' : 'var(--navy)',
              }}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{ padding: '10px 14px', borderRadius: 12, fontSize: 15, background: '#f4f5f7', color: 'var(--gray-400)' }}>Pensando…</div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid var(--gray-100)' }}>
          <input
            className="form-input"
            placeholder={`Pergunte ao ${ativo.nome}…`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void enviar() } }}
            style={{ flex: 1 }}
          />
          <button className="btn-action" disabled={loading || !input.trim()} onClick={() => void enviar()} style={{ opacity: loading || !input.trim() ? 0.6 : 1 }}>
            Enviar
          </button>
        </div>
      </div>
    </div>
  )
}
