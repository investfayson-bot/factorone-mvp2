'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fmtBRLCompact } from '@/lib/dre-calculations'

type Props = { empresaId: string }

type Row = { mes: string; entradas: number; saidas: number }

function mesKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function labelMes(key: string) {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
}

export default function EntradasSaidasChart({ empresaId }: Props) {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<Row[]>([])
  const [ready, setReady] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const end = new Date()
        const start = new Date(end.getFullYear(), end.getMonth() - 5, 1)
        const { data: txs } = await supabase
          .from('transacoes')
          .select('data,tipo,valor')
          .eq('empresa_id', empresaId)
          .gte('data', start.toISOString().slice(0, 10))
          .order('data', { ascending: true })

        const acc = new Map<string, { e: number; s: number }>()
        for (let i = 5; i >= 0; i--) {
          const d = new Date(end.getFullYear(), end.getMonth() - i, 1)
          acc.set(mesKey(d), { e: 0, s: 0 })
        }
        for (const t of txs || []) {
          const mk = (t.data as string).slice(0, 7)
          if (!acc.has(mk)) continue
          const cur = acc.get(mk) || { e: 0, s: 0 }
          const v = Number(t.valor) || 0
          if (t.tipo === 'entrada') cur.e += v
          else cur.s += v
          acc.set(mk, cur)
        }
        const ordered = Array.from(acc.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([mes, v]) => ({ mes: labelMes(mes), entradas: v.e, saidas: v.s }))
        if (!cancelled) setRows(ordered)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    if (empresaId) load()
    return () => {
      cancelled = true
    }
  }, [empresaId])

  const chartData = useMemo(() => rows, [rows])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const sync = () => setReady(el.clientWidth > 0 && el.clientHeight > 0)
    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm h-[320px] animate-pulse">
        <div className="h-4 w-48 bg-slate-200 rounded mb-4" />
        <div className="h-[240px] bg-slate-100 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="min-w-0 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
      <h2 className="font-semibold text-slate-800 text-sm mb-1">Entradas vs Saídas</h2>
      <p className="text-xs text-slate-500 mb-4">Últimos 6 meses · valores no período</p>
      <div ref={containerRef} className="h-[260px] w-full min-w-0">
        {chartData.length === 0 || !chartData.some((r) => r.entradas + r.saidas > 0) ? (
          <p className="text-sm text-slate-500 py-12 text-center">Sem transações no período.</p>
        ) : !ready ? (
          <div className="h-full w-full animate-pulse rounded-xl bg-slate-100" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#64748b' }} />
              <YAxis
                tick={{ fontSize: 10, fill: '#64748b' }}
                tickFormatter={(v) => fmtBRLCompact(Number(v))}
              />
              <Tooltip
                formatter={(value: number) => fmtBRLCompact(value)}
                contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0' }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="entradas" name="Entradas" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="saidas" name="Saídas" fill="#f87171" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
