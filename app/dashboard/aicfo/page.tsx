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

type Msg = { role: 'user' | 'assistant'; content: string; structured?: unknown }

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

type RespostaData = {
  resumo: string
  status: string
  cards: { titulo: string; emoji: string; linhas: { label: string; valor: string; destaque: string }[] }[]
  alertas: string[]
  proxima_pergunta: string
}

function RespostaIA({ data }: { data: RespostaData }) {
  const statusColor = {
    positivo: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    atencao: 'bg-amber-50 border-amber-200 text-amber-700',
    critico: 'bg-red-50 border-red-200 text-red-700',
  }[data.status] || 'bg-slate-50 border-slate-200 text-slate-700'

  const destaqueColor = (d: string) =>
    ({
      positivo: 'text-emerald-600 font-semibold',
      negativo: 'text-red-500 font-semibold',
      neutro: 'text-slate-600 font-medium',
    }[d] || 'text-slate-600')

  return (
    <div className="space-y-3 w-full max-w-[85%]">
      <div className={`rounded-xl border px-3 py-2 text-xs font-medium ${statusColor}`}>
        {data.status === 'positivo' ? '✅' : data.status === 'critico' ? '🔴' : '⚠️'} {data.resumo}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {data.cards?.map((card, i) => (
          <div key={i} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
            <div className="mb-2 flex items-center gap-1.5">
              <span className="text-base">{card.emoji}</span>
              <span className="text-xs font-semibold text-slate-800">{card.titulo}</span>
            </div>
            <div className="space-y-1.5">
              {card.linhas?.map((linha, j) => (
                <div
                  key={j}
                  className="flex items-center justify-between border-b border-slate-100 pb-1 last:border-0 last:pb-0"
                >
                  <span className="text-[11px] text-slate-500">{linha.label}</span>
                  <span className={`text-[11px] ${destaqueColor(linha.destaque)}`}>{linha.valor}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {data.alertas?.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-1">
          {data.alertas.map((a, i) => (
            <p key={i} className="text-[11px] text-amber-700">
              ⚠️ {a}
            </p>
          ))}
        </div>
      )}
      {data.proxima_pergunta && <p className="text-[11px] text-slate-400 italic">💬 {data.proxima_pergunta}</p>}
    </div>
  )
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
      setMensagens((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.response || data.error || 'Sem resposta',
          structured: data.structured || null,
        },
      ])
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
              {m.role === 'assistant' && (m as any).structured ? <RespostaIA data={(m as any).structured} /> : m.content}
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
