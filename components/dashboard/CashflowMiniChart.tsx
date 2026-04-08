'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

type Props = { empresaId: string }

export default function CashflowMiniChart({ empresaId }: Props) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<{ data: string; saldo: number }[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const dt = new Date()
        dt.setDate(dt.getDate() - 30)
        const { data: txs } = await supabase
          .from('transacoes')
          .select('data,tipo,valor')
          .eq('empresa_id', empresaId)
          .gte('data', dt.toISOString().slice(0, 10))
          .order('data', { ascending: true })

        const rows = txs || []
        let acc = 0
        const serie = rows.map((t) => {
          acc += t.tipo === 'entrada' ? Number(t.valor) : -Number(t.valor)
          return { data: t.data, saldo: acc }
        })
        if (!cancelled) setData(serie)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    if (empresaId) load()
    return () => {
      cancelled = true
    }
  }, [empresaId])

  const chartData = useMemo(() => data, [data])

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm h-[320px] animate-pulse">
        <div className="h-4 w-48 bg-slate-200 rounded mb-4" />
        <div className="h-[240px] bg-slate-100 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
      <h2 className="font-semibold text-slate-800 text-sm mb-1">Fluxo de caixa (30 dias)</h2>
      <p className="text-xs text-slate-500 mb-4">Saldo acumulado no período</p>
      <div className="h-[260px] w-full">
        {chartData.length === 0 ? (
          <p className="text-sm text-slate-500 py-12 text-center">Sem transações nos últimos 30 dias.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="data" tick={{ fontSize: 10, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
              <Tooltip
                formatter={(v: number) =>
                  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
                }
              />
              <Area type="monotone" dataKey="saldo" stroke="#1d4ed8" fill="#3b82f633" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
