'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtBRLCompact } from '@/lib/dre-calculations'

type Props = { empresaId: string }
type Row = { mes: string; entradas: number; saidas: number }

function mesKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
function labelMes(key: string) {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
}

export default function EntradasSaidasChart({ empresaId }: Props) {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<Row[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const end = new Date()
        const start = new Date(end.getFullYear(), end.getMonth() - 5, 1)
        const first = await supabase.from('transactions').select('data,tipo,valor').eq('empresa_id', empresaId).gte('data', start.toISOString().slice(0, 10)).order('data', { ascending: true })
        const res = first.error ? await supabase.from('transacoes').select('data,tipo,valor').eq('empresa_id', empresaId).gte('data', start.toISOString().slice(0, 10)).order('data', { ascending: true }) : first
        if (res.error) throw res.error
        const acc = new Map<string, { e: number; s: number }>()
        for (let i = 5; i >= 0; i--) acc.set(mesKey(new Date(end.getFullYear(), end.getMonth() - i, 1)), { e: 0, s: 0 })
        for (const t of res.data || []) {
          const mk = (t.data as string).slice(0, 7)
          if (!acc.has(mk)) continue
          const cur = acc.get(mk)!
          if (t.tipo === 'entrada') cur.e += Number(t.valor) || 0
          else cur.s += Number(t.valor) || 0
        }
        if (!cancelled) setRows(Array.from(acc.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([mes, v]) => ({ mes: labelMes(mes), entradas: v.e, saidas: v.s })))
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Erro')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    if (empresaId) load()
    return () => { cancelled = true }
  }, [empresaId])

  const chartData = useMemo(() => rows, [rows])

  if (loading) return <div style={{ height: 120, background: 'var(--gray-100)', borderRadius: 8 }} />
  if (error || !chartData.some(r => r.entradas + r.saidas > 0)) {
    return <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gray-400)', fontSize: 12 }}>Sem transações no período.</div>
  }

  const maxVal = Math.max(...chartData.flatMap(r => [r.entradas, r.saidas]), 1)

  return (
    <div className="cf-bars" style={{ height: 120, alignItems: 'flex-end' }}>
      {chartData.map(m => (
        <div key={m.mes} className="cf-col">
          <div className="cf-bgrp">
            <div
              className="cf-bar i"
              style={{ height: Math.round((m.entradas / maxVal) * 90) }}
              title={`Entradas: ${fmtBRLCompact(m.entradas)}`}
            />
            <div
              className="cf-bar o"
              style={{ height: Math.round((m.saidas / maxVal) * 90) }}
              title={`Saídas: ${fmtBRLCompact(m.saidas)}`}
            />
          </div>
          <div className="cf-lbl">{m.mes}</div>
        </div>
      ))}
    </div>
  )
}
