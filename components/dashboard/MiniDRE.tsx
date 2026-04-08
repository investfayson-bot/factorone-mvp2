'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { calcDREFromTransacoes, fmtBRL, fmtBRLCompact, variacaoPct, type TransacaoDRE } from '@/lib/dre-calculations'
import { FileSpreadsheet } from 'lucide-react'
import { erroDesconhecido } from '@/lib/transacao-types'

type Props = { empresaId: string }

const linhasConfig: {
  key: keyof ReturnType<typeof calcDREFromTransacoes>
  label: string
  /** Exibir valor como despesa (sinal negativo no mockup) */
  negateDisplay?: boolean
}[] = [
  { key: 'receitaBruta', label: 'Receita' },
  { key: 'cmv', label: '(-) CMV', negateDisplay: true },
  { key: 'lucroBruto', label: 'Lucro Bruto' },
  { key: 'ebitda', label: 'EBITDA' },
  { key: 'lucroLiquido', label: 'Líquido' },
]

export default function MiniDRE({ empresaId }: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [atual, setAtual] = useState<ReturnType<typeof calcDREFromTransacoes> | null>(null)
  const [anterior, setAnterior] = useState<ReturnType<typeof calcDREFromTransacoes> | null>(null)

  const prevDre = anterior ?? calcDREFromTransacoes([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const now = new Date()
      const inicioAtual = new Date(now.getFullYear(), now.getMonth(), 1)
      const inicioAnterior = new Date(now.getFullYear(), now.getMonth() - 1, 1)

      const { data: dAtual, error: e1 } = await supabase
        .from('transacoes')
        .select('tipo,valor,categoria,data')
        .eq('empresa_id', empresaId)
        .gte('data', inicioAtual.toISOString())

      const { data: dAnt, error: e2 } = await supabase
        .from('transacoes')
        .select('tipo,valor,categoria,data')
        .eq('empresa_id', empresaId)
        .gte('data', inicioAnterior.toISOString())
        .lt('data', inicioAtual.toISOString())

      if (e1 || e2) throw e1 || e2

      setAtual(calcDREFromTransacoes((dAtual || []) as TransacaoDRE[]))
      setAnterior(calcDREFromTransacoes((dAnt || []) as TransacaoDRE[]))
    } catch (err: unknown) {
      setError(erroDesconhecido(err) || 'Erro ao carregar DRE')
    } finally {
      setLoading(false)
    }
  }, [empresaId])

  useEffect(() => {
    if (!empresaId) return
    load()
    const channel = supabase
      .channel(`mini-dre-${empresaId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transacoes', filter: `empresa_id=eq.${empresaId}` },
        () => {
          load()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [empresaId, load])

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm animate-pulse">
        <div className="h-4 w-32 bg-slate-200 rounded mb-4" />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-8 bg-slate-100 rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (error || !atual) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-sm text-red-800">
        <p className="font-medium">DRE resumido</p>
        <p className="mt-1">{error || 'Dados indisponíveis'}</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
          <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
        </div>
        <div className="flex-1">
          <h2 className="font-semibold text-slate-800 text-sm">DRE Resumo</h2>
          <p className="text-xs text-slate-500">Mês atual vs anterior</p>
        </div>
        <Link href="/dashboard/relatorios" className="text-xs font-medium text-emerald-700 hover:text-emerald-800 whitespace-nowrap">
          Ver DRE completo
        </Link>
      </div>

      <div className="space-y-2 text-sm flex-1">
        {linhasConfig.map(({ key, label, negateDisplay }) => {
          const v = atual[key] as number
          const p = prevDre[key] as number
          const displayVal = negateDisplay ? -Math.abs(v) : v
          const fmt = (n: number) => (Math.abs(n) >= 1000 ? fmtBRLCompact(n) : fmtBRL(n))
          const varPct = variacaoPct(v, p)
          return (
            <div
              key={String(key)}
              className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2"
            >
              <span className="text-slate-600 truncate">{label}</span>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={`font-semibold tabular-nums ${
                    negateDisplay && v > 0 ? 'text-red-700' : 'text-slate-800'
                  }`}
                >
                  {fmt(displayVal)}
                </span>
                {varPct === null ? (
                  <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">1º mês</span>
                ) : (
                  <span
                    className={`text-[10px] font-semibold tabular-nums ${
                      negateDisplay
                        ? varPct <= 0
                          ? 'text-emerald-600'
                          : 'text-red-600'
                        : varPct >= 0
                          ? 'text-emerald-600'
                          : 'text-red-600'
                    }`}
                  >
                    {negateDisplay ? (varPct >= 0 ? '+' : '') : varPct >= 0 ? '+' : ''}
                    {varPct.toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
