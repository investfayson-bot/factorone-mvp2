'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Send,
  Zap,
  User,
  Bot,
  Loader2,
  AlertTriangle,
  TrendingUp,
  ShieldAlert,
  Activity,
  Target,
} from 'lucide-react'
import { fmtBRLCompact } from '@/lib/dre-calculations'

type Msg = { role: 'user' | 'assistant'; content: string }

const SUGESTOES = [
  'Qual o impacto se reduzirmos 15% de Marketing?',
  'Como está meu fluxo de caixa?',
  'Quais são minhas maiores despesas?',
  'Detecte anomalias nos meus gastos',
]

/** Indicadores ilustrativos — substituir por API / métricas reais quando disponível */
const METRICAS_DEMO = {
  alertas: 3,
  previsao30d: 2_600_000,
  confiancaPct: 94,
  riscoCaixaDias: 67,
  anomalias: 3,
  precisaoIaPct: 94,
}

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
      const { createClient } = await import('@/lib/supabase')
      const {
        data: { session },
      } = await createClient().auth.getSession()

      const res = await fetch('/api/aicfo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ message: texto, context: 'chat_aicfo' }),
      })
      const data = await res.json()
      setMensagens((prev) => [...prev, { role: 'assistant', content: data.response || data.error || 'Sem resposta' }])
    } catch {
      setMensagens((prev) => [...prev, { role: 'assistant', content: 'Erro de conexão.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto flex h-full max-w-5xl flex-col bg-[#F9FAFB] p-6 text-slate-700 md:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">CFO IA — Análise Financeira</h1>
        <p className="mt-1 text-sm text-gray-600">
          Previsões, risco de caixa e chat com contexto do seu negócio.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <div className="rounded-2xl border border-gray-200/90 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-700">
            <AlertTriangle className="h-3.5 w-3.5" />
            Alertas
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900">{METRICAS_DEMO.alertas}</p>
        </div>
        <div className="rounded-2xl border border-gray-200/90 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
            Previsão 30d
          </div>
          <p className="mt-2 text-lg font-bold tabular-nums text-gray-900">{fmtBRLCompact(METRICAS_DEMO.previsao30d)}</p>
          <p className="text-xs text-gray-500">{METRICAS_DEMO.confiancaPct}% confiança</p>
        </div>
        <div className="rounded-2xl border border-gray-200/90 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-800">
            <ShieldAlert className="h-3.5 w-3.5" />
            Risco caixa
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900">{METRICAS_DEMO.riscoCaixaDias} dias</p>
          <p className="text-xs text-amber-700">atenção</p>
        </div>
        <div className="rounded-2xl border border-gray-200/90 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            <Activity className="h-3.5 w-3.5 text-violet-600" />
            Anomalias
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900">{METRICAS_DEMO.anomalias}</p>
          <p className="text-xs text-gray-500">detectadas</p>
        </div>
        <div className="col-span-2 rounded-2xl border border-gray-200/90 bg-white p-4 shadow-sm lg:col-span-1">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            <Target className="h-3.5 w-3.5 text-emerald-600" />
            Precisão IA
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900">{METRICAS_DEMO.precisaoIaPct}%</p>
          <p className="text-xs text-gray-500">classificação</p>
        </div>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/50 p-4 text-sm text-amber-950">
          <p className="font-semibold text-amber-900">CFO IA · Análise automática</p>
          <p className="mt-2 leading-relaxed">
            Alerta de liquidez: a projeção aponta risco de caixa em {METRICAS_DEMO.riscoCaixaDias} dias com o padrão atual de
            gastos. Recomendo revisar despesas de Marketing acima da média e renegociar contratos de fornecedores.
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-4 text-sm text-emerald-950">
          <p className="font-semibold text-emerald-900">CFO IA · Oportunidade detectada</p>
          <p className="mt-2 leading-relaxed">
            Economia detectada: renegociação com fornecedores estratégicos pode gerar economia mensal relevante com base no
            histórico e volume atual.
          </p>
        </div>
      </div>

      <p className="mb-3 text-sm font-medium text-gray-900">Pergunte ao CFO IA</p>

      {mensagens.length === 0 && (
        <div className="mb-4 rounded-2xl border border-gray-200/90 bg-white p-4 shadow-sm">
          <p className="mb-3 text-sm text-gray-500">Sugestões rápidas:</p>
          <div className="grid gap-2 md:grid-cols-2">
            {SUGESTOES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => enviar(s)}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-left text-sm font-medium text-gray-700 transition hover:border-emerald-300 hover:text-emerald-800"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="min-h-[200px] flex-1 space-y-3 overflow-y-auto pr-1">
        {mensagens.map((m, i) => (
          <div key={i} className={`flex items-end gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role === 'assistant' && (
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100">
                <Zap size={16} className="text-emerald-700" />
              </div>
            )}
            <div
              className={
                m.role === 'user'
                  ? 'max-w-[80%] rounded-2xl rounded-tr-sm bg-emerald-700 px-4 py-3 text-sm text-white'
                  : 'max-w-[80%] rounded-2xl rounded-tl-sm border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 shadow-sm'
              }
            >
              {m.content}
            </div>
            {m.role === 'user' && (
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-700">
                <User size={16} className="text-white" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-end gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100">
              <Bot size={16} className="text-emerald-700" />
            </div>
            <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 shadow-sm">
              <Loader2 className="animate-spin" size={14} /> Analisando…
            </div>
          </div>
        )}
        <div ref={refFim} />
      </div>

      <div className="mt-4 flex items-center gap-2 border-t border-gray-200 pt-4">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && enviar()}
          placeholder="Pergunte ao CFO IA..."
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-gray-900 placeholder-gray-400 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        />
        <button
          type="button"
          onClick={() => enviar()}
          className="rounded-xl bg-emerald-700 px-4 py-2.5 text-white transition hover:bg-emerald-800"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  )
}
