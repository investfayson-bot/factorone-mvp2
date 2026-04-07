'use client'
export const dynamic = 'force-dynamic'
import React, { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import toast from 'react-hot-toast'

const QUICK = [
  'Qual é nosso runway atual?',
  'Como posso reduzir despesas?',
  'Posso contratar mais uma pessoa?',
  'Quais invoices estão em atraso?',
  'Analise nosso MRR deste mês',
  'Faça uma projeção para os próximos 3 meses',
]

export default function AICFOPage() {
  const [msgs, setMsgs] = useState<{role:string;text:string}[]>([
    { role:'ai', text:'Olá! Sou o AI CFO da FactorOne. Analisei os dados da sua empresa e estou pronto para ajudar. Pode me perguntar sobre runway, despesas, receita, fluxo de caixa ou qualquer decisão financeira.' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [historico, setHistorico] = useState<any[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const sb = createClient()

  useEffect(() => {
    loadHistorico()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs])

  async function loadHistorico() {
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return
    const { data: u } = await sb.from('usuarios').select('empresa_id').eq('id', user.id).single()
    if (!u) return
    const { data: h } = await sb.from('aicfo_historico').select('*').eq('empresa_id', u.empresa_id).order('created_at').limit(20)
    if (h && h.length > 0) {
      setHistorico(h)
      setMsgs([
        { role:'ai', text:'Olá! Sou o AI CFO da FactorOne. Analisei os dados da sua empresa e estou pronto para ajudar.' },
        ...h.map(m => ({ role: m.role === 'user' ? 'user' : 'ai', text: m.conteudo }))
      ])
    }
  }

  async function enviar(texto?: string) {
    const msg = texto || input.trim()
    if (!msg || loading) return
    setInput('')
    setMsgs(prev => [...prev, { role:'user', text:msg }])
    setLoading(true)

    try {
      const res = await fetch('/api/aicfo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensagem: msg, historico }),
      })
      const data = await res.json()
      if (data.resposta) {
        setMsgs(prev => [...prev, { role:'ai', text:data.resposta }])
        setHistorico(prev => [...prev, { role:'user', conteudo:msg }, { role:'assistant', conteudo:data.resposta }])
      } else {
        toast.error('Erro ao conectar com o AI CFO')
      }
    } catch {
      toast.error('Erro de conexão')
    }
    setLoading(false)
  }

  const S = {
    card: { background:'#111A19', border:'1px solid #233130', borderRadius:12, padding:16 } as any,
  }

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 280px', gap:14, height:'calc(100vh - 96px)' }}>
      {/* Chat */}
      <div style={{ ...S.card, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12, paddingBottom:12, borderBottom:'1px solid #1F2A29' }}>
          <div style={{ width:36, height:36, background:'#C8F135', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:12, color:'#000', fontFamily:'Sora,sans-serif', flexShrink:0 }}>AI</div>
          <div>
            <div style={{ fontSize:14, fontWeight:600, fontFamily:'Sora,sans-serif' }}>AI CFO — FactorOne</div>
            <div style={{ fontSize:10, color:'#22C97A', fontFamily:'monospace', display:'flex', alignItems:'center', gap:4 }}>
              <span style={{ width:6, height:6, background:'#22C97A', borderRadius:'50%', display:'inline-block' }}></span>
              Online · Analisando dados da sua empresa
            </div>
          </div>
          <div style={{ marginLeft:'auto', fontSize:10, color:'#4A6260', fontFamily:'monospace' }}>Powered by Claude</div>
        </div>

        {/* Quick prompts */}
        <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:10 }}>
          {QUICK.map(q => (
            <button key={q} onClick={() => enviar(q)}
              style={{ fontSize:10, padding:'4px 9px', borderRadius:20, border:'1px solid #2E3D3B', background:'#182120', color:'#7A9290', cursor:'pointer', fontFamily:'sans-serif', transition:'all .15s' }}
              onMouseOver={e=>{(e.target as any).style.borderColor='#C8F135';(e.target as any).style.color='#C8F135'}}
              onMouseOut={e=>{(e.target as any).style.borderColor='#2E3D3B';(e.target as any).style.color='#7A9290'}}>
              {q}
            </button>
          ))}
        </div>

        {/* Messages */}
        <div style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:10, paddingRight:4 }}>
          {msgs.map((m, i) => (
            <div key={i} style={{ display:'flex', gap:9, alignItems:'flex-start', flexDirection: m.role==='user'?'row-reverse':'row' }}>
              <div style={{ width:28, height:28, borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:800, flexShrink:0, background: m.role==='ai'?'#C8F135':'#3B8BFF', color: m.role==='ai'?'#000':'#fff' }}>
                {m.role==='ai'?'AI':'Eu'}
              </div>
              <div style={{ maxWidth:'80%', padding:'10px 13px', borderRadius:12, fontSize:12, lineHeight:1.7, background: m.role==='ai'?'#182120':'#3B8BFF', color: m.role==='ai'?'#E4E8E7':'#fff', whiteSpace:'pre-wrap' }}
                dangerouslySetInnerHTML={{ __html: m.text.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br>') }} />
            </div>
          ))}
          {loading && (
            <div style={{ display:'flex', gap:9, alignItems:'flex-start' }}>
              <div style={{ width:28, height:28, borderRadius:7, background:'#C8F135', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:800, color:'#000', flexShrink:0 }}>AI</div>
              <div style={{ padding:'10px 13px', borderRadius:12, background:'#182120', display:'flex', gap:4, alignItems:'center' }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{ width:6, height:6, background:'#7A9290', borderRadius:'50%', animation:'pulse 1.2s infinite ease-in-out', animationDelay:`${i*0.2}s` }}></div>
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{ display:'flex', gap:7, paddingTop:10, borderTop:'1px solid #1F2A29' }}>
          <textarea value={input} onChange={e=>setInput(e.target.value)}
            onKeyDown={e => { if(e.key==='Enter' && !e.shiftKey) { e.preventDefault(); enviar() }}}
            placeholder="Pergunte sobre as finanças da sua empresa..."
            style={{ flex:1, background:'#182120', border:'1px solid #2E3D3B', borderRadius:8, padding:'9px 12px', color:'#E4E8E7', fontSize:12, fontFamily:'sans-serif', outline:'none', resize:'none', height:40 }} />
          <button onClick={() => enviar()} disabled={loading || !input.trim()}
            style={{ width:40, height:40, background:'#C8F135', border:'none', borderRadius:8, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, opacity: loading||!input.trim()?0.5:1 }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 8L14 2L8 14L7 9L2 8Z" fill="#000"/></svg>
          </button>
        </div>
      </div>

      {/* Sidebar de contexto */}
      <div style={{ display:'flex', flexDirection:'column', gap:10, overflowY:'auto' }}>
        <div style={S.card}>
          <div style={{ fontSize:10, color:'#7A9290', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:10 }}>Dados em contexto</div>
          <div style={{ fontSize:11, color:'#4A6260', lineHeight:1.7 }}>
            O AI CFO analisa em tempo real:<br/>
            • Saldo e runway<br/>
            • MRR e burn rate<br/>
            • Últimas 10 despesas<br/>
            • Invoices ativas<br/>
            • Histórico da conversa
          </div>
        </div>
        <div style={S.card}>
          <div style={{ fontSize:10, color:'#7A9290', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:10 }}>Sugestões de análise</div>
          {[
            '📊 DRE do mês atual',
            '🔮 Previsão de caixa 90 dias',
            '⚠️ Alertas de risco',
            '💡 Oportunidades de economia',
            '📈 Análise de crescimento',
          ].map(s => (
            <div key={s} onClick={() => enviar(s.slice(3))}
              style={{ padding:'7px 0', borderBottom:'1px solid #1F2A29', fontSize:11, color:'#7A9290', cursor:'pointer', transition:'color .15s' }}
              onMouseOver={e=>(e.currentTarget.style.color='#C8F135')}
              onMouseOut={e=>(e.currentTarget.style.color='#7A9290')}>
              {s}
            </div>
          ))}
        </div>
      </div>

      <style>{`@keyframes pulse{0%,80%,100%{transform:scale(.6);opacity:.5}40%{transform:scale(1);opacity:1}}`}</style>
    </div>
  )
}
