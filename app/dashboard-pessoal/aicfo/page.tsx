'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Msg = { role: 'user' | 'assistant'; content: string }

const SUGESTOES = [
  'Como estou financeiramente este mês?',
  'Quais assinaturas posso cancelar?',
  'Quanto posso guardar esse mês?',
  'Estou no caminho das minhas metas?',
  'Onde estou gastando mais?',
  'Como montar uma reserva de emergência?',
]

export default function AICFOPessoalPage() {
  const [userId, setUserId] = useState('')
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => { if (user) setUserId(user.id) })
  }, [])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  async function enviar(texto?: string) {
    const msg = (texto ?? input).trim()
    if (!msg || !userId) return
    setInput('')
    setMsgs(prev => [...prev, { role: 'user', content: msg }])
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/pf/aicfo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({ mensagem: msg, historico: msgs.slice(-8) }),
      })
      const data = await res.json() as { resposta?: string; error?: string }
      setMsgs(prev => [...prev, { role: 'assistant', content: data.resposta ?? data.error ?? 'Erro ao processar' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 110px)' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(90deg, var(--navy) 0%, #1e3a5f 100%)', borderRadius: 12, padding: '16px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}></div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>AI CFO Pessoal</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,.6)' }}>Seu consultor financeiro pessoal — pergunte qualquer coisa sobre seu dinheiro</div>
        </div>
      </div>

      {/* Chat */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 8 }}>
        {msgs.length === 0 && (
          <div>
            <div style={{ fontSize: 15, color: 'var(--gray-400)', marginBottom: 12, textAlign: 'center' }}>Olá! Como posso ajudar com suas finanças hoje?</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
              {SUGESTOES.map(s => (
                <button key={s} onClick={() => enviar(s)} style={{ fontSize: 13, padding: '6px 12px', borderRadius: 20, border: '1px solid var(--gray-100)', background: '#fff', color: 'var(--gray-500)', cursor: 'pointer', fontWeight: 500 }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {msgs.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '75%', padding: '12px 16px', borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              background: m.role === 'user' ? 'var(--navy)' : '#fff',
              color: m.role === 'user' ? '#fff' : 'var(--navy)',
              border: m.role === 'assistant' ? '1px solid var(--gray-100)' : 'none',
              fontSize: 15, lineHeight: 1.6, whiteSpace: 'pre-wrap',
            }}>
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: '16px 16px 16px 4px', padding: '12px 16px', fontSize: 15, color: 'var(--gray-400)' }}>
              <span style={{ animation: 'pulse 1s infinite' }}>Analisando seus dados...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ display: 'flex', gap: 8, paddingTop: 12, borderTop: '1px solid var(--gray-100)' }}>
        <input
          className="form-input"
          style={{ flex: 1, borderRadius: 24, padding: '10px 16px' }}
          placeholder="Pergunte sobre suas finanças..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void enviar() } }}
          disabled={loading}
        />
        <button
          onClick={() => enviar()}
          disabled={loading || !input.trim()}
          className="btn-action"
          style={{ borderRadius: 24, padding: '10px 20px' }}
        >
          Enviar
        </button>
      </div>
    </div>
  )
}
