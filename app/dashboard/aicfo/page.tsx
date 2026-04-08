'use client'
import { useEffect, useRef, useState } from 'react'
import { Send, Zap, User, Bot, Loader2 } from 'lucide-react'

type Msg = { role: 'user' | 'assistant'; content: string }

const SUGESTOES = [
  'Como está meu fluxo de caixa?',
  'Quais são minhas maiores despesas?',
  'Faça uma projeção para o próximo mês',
  'Detecte anomalias nos meus gastos'
]

export default function AICFOPage() {
  const [mensagens, setMensagens] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const refFim = useRef<HTMLDivElement>(null)

  useEffect(() => {
    refFim.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens, loading])

  async function enviar(m?: string) {
    const texto = (m || input).trim()
    if (!texto || loading) return
    setInput('')
    const novo = [...mensagens, { role: 'user', content: texto } as Msg]
    setMensagens(novo)
    setLoading(true)

    try {
      const res = await fetch('/api/aicfo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: texto, context: 'chat_aicfo' })
      })
      const data = await res.json()
      setMensagens(prev => [...prev, { role: 'assistant', content: data.response || data.error || 'Sem resposta' }])
    } catch {
      setMensagens(prev => [...prev, { role: 'assistant', content: 'Erro de conexão.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-full flex flex-col bg-slate-50 text-slate-700 p-6">
      <h1 className="text-2xl font-bold text-slate-800 mb-1">AI CFO</h1>
      <p className="text-sm text-slate-500 mb-4">Converse com seu analista financeiro inteligente.</p>

      {mensagens.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-4 shadow-sm">
          <p className="text-sm text-slate-500 mb-3">Sugestões rápidas:</p>
          <div className="grid md:grid-cols-2 gap-2">
            {SUGESTOES.map((s) => (
              <button key={s} onClick={() => enviar(s)} className="bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 hover:border-blue-300 hover:text-blue-700 font-medium px-4 py-2 rounded-lg transition-all text-left">
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {mensagens.map((m, i) => (
          <div key={i} className={`flex items-end gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role === 'assistant' && (
              <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center"><Zap size={16} className="text-blue-700" /></div>
            )}
            <div className={m.role === 'user'
              ? 'max-w-[80%] bg-blue-700 text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm'
              : 'max-w-[80%] bg-slate-50 border border-slate-200 text-slate-700 rounded-2xl rounded-tl-sm px-4 py-3 text-sm'}>
              {m.content}
            </div>
            {m.role === 'user' && (
              <div className="w-8 h-8 rounded-xl bg-blue-700 flex items-center justify-center"><User size={16} className="text-white" /></div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-end gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center"><Bot size={16} className="text-blue-700" /></div>
            <div className="bg-slate-50 border border-slate-200 text-slate-700 rounded-2xl rounded-tl-sm px-4 py-3 text-sm flex items-center gap-2">
              <Loader2 className="animate-spin" size={14} /> ...
            </div>
          </div>
        )}
        <div ref={refFim} />
      </div>

      <div className="mt-4 pt-4 border-t border-slate-200 flex items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && enviar()}
          placeholder="Digite sua pergunta financeira..."
          className="w-full bg-white border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 rounded-xl px-4 py-2.5 text-slate-800 placeholder-slate-400 outline-none transition-all"
        />
        <button onClick={() => enviar()} className="bg-blue-700 hover:bg-blue-800 text-white rounded-xl px-4 py-2.5 transition-all">
          <Send size={16} />
        </button>
      </div>
    </div>
  )
}
