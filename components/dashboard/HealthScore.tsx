'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Activity } from 'lucide-react'
import { erroDesconhecido } from '@/lib/transacao-types'

type Props = { empresaId: string }

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

export function computeHealthScore(input: {
  margemLiquidaPct: number
  fluxoPositivo: boolean
  despesaSobreReceitaPct: number
  nfsPendentes: number
}) {
  let m = 0
  if (input.margemLiquidaPct < 5) m = 0
  else if (input.margemLiquidaPct <= 10) m = 15
  else m = 30

  const f = input.fluxoPositivo ? 25 : 0

  let d = 0
  if (input.despesaSobreReceitaPct > 90) d = 0
  else if (input.despesaSobreReceitaPct >= 70) d = 15
  else d = 25

  let n = 0
  if (input.nfsPendentes > 5) n = 0
  else if (input.nfsPendentes >= 1) n = 10
  else n = 20

  const total = clamp(m + f + d + n, 0, 100)
  return { total, parts: { m, f, d, n } }
}

export default function HealthScore({ empresaId }: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [score, setScore] = useState(0)
  const [label, setLabel] = useState<'Crítico' | 'Atenção' | 'Saudável'>('Crítico')

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      setError(null)
      try {
        const now = new Date()
        const inicio = new Date(now.getFullYear(), now.getMonth(), 1)
        const fim = new Date(now.getFullYear(), now.getMonth() + 1, 0)

        const { data: txs, error: e1 } = await supabase
          .from('transacoes')
          .select('tipo,valor')
          .eq('empresa_id', empresaId)
          .gte('data', inicio.toISOString().slice(0, 10))
          .lte('data', fim.toISOString().slice(0, 10))

        if (e1) throw e1

        const receita = (txs || []).filter((t) => t.tipo === 'entrada').reduce((s, t) => s + Number(t.valor || 0), 0)
        const despesas = (txs || []).filter((t) => t.tipo === 'saida').reduce((s, t) => s + Number(t.valor || 0), 0)
        const saldo = receita - despesas
        const margemLiquidaPct = receita > 0 ? (saldo / receita) * 100 : 0
        const despesaSobreReceitaPct = receita > 0 ? (despesas / receita) * 100 : 100

        const { count, error: e2 } = await supabase
          .from('notas_fiscais')
          .select('*', { count: 'exact', head: true })
          .eq('empresa_id', empresaId)
          .eq('status', 'pendente')

        if (e2) throw e2

        const { total } = computeHealthScore({
          margemLiquidaPct,
          fluxoPositivo: saldo > 0,
          despesaSobreReceitaPct,
          nfsPendentes: count ?? 0,
        })

        if (!cancelled) {
          setScore(Math.round(total))
          setLabel(total <= 40 ? 'Crítico' : total <= 70 ? 'Atenção' : 'Saudável')
        }
      } catch (err: unknown) {
        if (!cancelled) setError(erroDesconhecido(err) || 'Erro ao calcular score')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    if (empresaId) run()
    return () => {
      cancelled = true
    }
  }, [empresaId])

  const ring = useMemo(() => {
    if (score <= 40) return { stroke: 'stroke-red-500', text: 'text-red-600' }
    if (score <= 70) return { stroke: 'stroke-amber-500', text: 'text-amber-700' }
    return { stroke: 'stroke-emerald-500', text: 'text-emerald-700' }
  }, [score])

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm animate-pulse">
        <div className="h-4 w-40 bg-slate-200 rounded mb-4" />
        <div className="flex justify-center py-6">
          <div className="h-36 w-36 rounded-full bg-slate-200" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-sm text-red-800">
        <p className="font-medium">Score de saúde</p>
        <p className="mt-1">{error}</p>
      </div>
    )
  }

  const circumference = 2 * Math.PI * 44
  const offset = circumference - (score / 100) * circumference

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm h-full">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
          <Activity className="w-4 h-4 text-blue-700" />
        </div>
        <div>
          <h2 className="font-semibold text-slate-800 text-sm">Saúde financeira</h2>
          <p className="text-xs text-slate-500">Indicadores do mês atual</p>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center py-2">
        <div className="relative w-36 h-36">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="44" fill="none" className="stroke-slate-100" strokeWidth="10" />
            <circle
              cx="50"
              cy="50"
              r="44"
              fill="none"
              className={ring.stroke}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              style={{ transition: 'stroke-dashoffset 0.6s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center rotate-0">
            <span className={`text-3xl font-bold ${ring.text}`}>{score}</span>
            <span className="text-[10px] uppercase tracking-wide text-slate-400">/ 100</span>
          </div>
        </div>
        <p className={`mt-3 text-sm font-semibold ${ring.text}`}>
          {label}
        </p>
      </div>
    </div>
  )
}
