'use client'

import { useEffect, useRef, useState } from 'react'

type Mensagem = { id: string; autor: 'visitante' | 'donna' | 'humano'; texto: string; created_at: string }

export default function ChatWidget({ slug, cor, nome, embutido }: { slug: string; cor: string; nome: string; embutido?: boolean }) {
  const [aberto, setAberto] = useState(false)
  const [conversaId, setConversaId] = useState<string | null>(null)
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [input, setInput] = useState('')
  const [enviando, setEnviando] = useState(false)
  const chaveStorage = `fo_atendimento_${slug}`
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try { const salvo = localStorage.getItem(chaveStorage); if (salvo) setConversaId(salvo) } catch { /* ignore */ }
  }, [chaveStorage])

  // Modo embutido: roda dentro do iframe de app/widget/[slug] num site externo.
  // O loader (public/donna-embed.js) escuta essa mensagem pra redimensionar o
  // iframe — fechado é só a bolha, aberto é o painel inteiro.
  useEffect(() => {
    if (!embutido) return
    window.parent.postMessage({ tipo: 'donna-widget', aberto }, '*')
  }, [embutido, aberto])

  useEffect(() => {
    if (!aberto || !conversaId) return
    const carregar = () => {
      fetch(`/api/atendimento/${slug}?conversaId=${conversaId}`)
        .then(r => r.json())
        .then(j => { if (j.mensagens) setMensagens(j.mensagens as Mensagem[]) })
        .catch(() => {})
    }
    carregar()
    const t = setInterval(carregar, 4000)
    return () => clearInterval(t)
  }, [aberto, conversaId, slug])

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }) }, [mensagens])

  async function enviar() {
    const texto = input.trim()
    if (!texto || enviando) return
    setInput('')
    setEnviando(true)
    setMensagens(prev => [...prev, { id: `tmp-${Date.now()}`, autor: 'visitante', texto, created_at: new Date().toISOString() }])
    try {
      const r = await fetch(`/api/atendimento/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversaId, mensagem: texto }),
      })
      const j = await r.json() as { conversaId?: string }
      if (j.conversaId && j.conversaId !== conversaId) {
        setConversaId(j.conversaId)
        try { localStorage.setItem(chaveStorage, j.conversaId) } catch { /* ignore */ }
      }
      const r2 = await fetch(`/api/atendimento/${slug}?conversaId=${j.conversaId ?? conversaId}`)
      const j2 = await r2.json()
      if (j2.mensagens) setMensagens(j2.mensagens as Mensagem[])
    } catch { /* ignore */ }
    finally { setEnviando(false) }
  }

  return (
    <div style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 1000, fontFamily: 'Nunito, system-ui, sans-serif' }}>
      {aberto && (
        <div style={{ width: 320, height: 420, background: '#fff', borderRadius: 16, boxShadow: '0 12px 40px rgba(0,0,0,.18)', display: 'flex', flexDirection: 'column', overflow: 'hidden', marginBottom: 12, border: '1px solid #eef2f0' }}>
          <div style={{ background: cor, color: '#fff', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 800 }}>{nome || 'Fale com a gente'}</div>
              <div style={{ fontSize: 10.5, opacity: .85 }}>normalmente responde rápido</div>
            </div>
            <button onClick={() => setAberto(false)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 16 }}>×</button>
          </div>
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 8, background: '#F7FAF8' }}>
            {mensagens.length === 0 && (
              <div style={{ fontSize: 12.5, color: '#64748b', textAlign: 'center', marginTop: 20 }}>Manda sua dúvida que a gente te responde por aqui.</div>
            )}
            {mensagens.map(m => (
              <div key={m.id} style={{
                alignSelf: m.autor === 'visitante' ? 'flex-end' : 'flex-start',
                background: m.autor === 'visitante' ? cor : '#fff',
                color: m.autor === 'visitante' ? '#fff' : '#13201D',
                border: m.autor === 'visitante' ? 'none' : '1px solid #eef2f0',
                borderRadius: 12, padding: '8px 12px', fontSize: 13, maxWidth: '82%', lineHeight: 1.4, whiteSpace: 'pre-wrap',
              }}>{m.texto}</div>
            ))}
            {enviando && <div style={{ fontSize: 11, color: '#94a3b8', alignSelf: 'flex-start' }}>digitando…</div>}
          </div>
          <div style={{ padding: 10, borderTop: '1px solid #eef2f0', display: 'flex', gap: 8 }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void enviar() }}
              placeholder="Escreva sua mensagem…"
              style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: 10, padding: '9px 12px', fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
            />
            <button onClick={() => void enviar()} disabled={enviando || !input.trim()} style={{ background: cor, color: '#fff', border: 'none', borderRadius: 10, padding: '0 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: enviando ? .6 : 1 }}>
              Enviar
            </button>
          </div>
        </div>
      )}
      <button
        onClick={() => setAberto(v => !v)}
        style={{ width: 56, height: 56, borderRadius: '50%', background: cor, border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer', boxShadow: '0 8px 24px rgba(0,0,0,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        aria-label="Abrir chat"
      >
        <i className={`fa-solid ${aberto ? 'fa-xmark' : 'fa-comment-dots'}`} />
      </button>
    </div>
  )
}
