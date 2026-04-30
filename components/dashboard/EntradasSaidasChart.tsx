'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
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
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const end = new Date()
        const start = new Date(end.getFullYear(), end.getMonth() - 5, 1)
        const fromDate = start.toISOString().slice(0, 10)

        const fetchTx = async (table: 'transactions' | 'transacoes') =>
          supabase.from(table).select('data,tipo,valor').eq('empresa_id', empresaId).gte('data', fromDate).order('data', { ascending: true })

        const first = await fetchTx('transactions')
        const second = first.error ? await fetchTx('transacoes') : first
        if (second.error) throw second.error
        const txs = second.data || []

        const acc = new Map<string, { e: number; s: number }>()
        for (let i = 5; i >= 0; i--) {
          const d = new Date(end.getFullYear(), end.getMonth() - i, 1)
          acc.set(mesKey(d), { e: 0, s: 0 })
        }
        for (const t of txs) {
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
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Falha ao carregar gráfico')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    if (empresaId) load()
    return () => { cancelled = true }
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
      <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: 20, height: 280 }} className="animate-pulse">
        <div style={{ height: 12, width: 160, background: 'var(--gray-100)', borderRadius: 6, marginBottom: 14 }} />
        <div style={{ height: 220, background: 'var(--gray-100)', borderRadius: 8 }} />
      </div>
    )
  }

  return (
    <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: 20, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--gray-400)', letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: "'DM Mono', monospace" }}>
          Entradas vs Saídas — 6 meses
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          {[{ color: '#5E8C87', label: 'Entradas' }, { color: 'rgba(184,146,42,.5)', label: 'Saídas' }].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--gray-400)' }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: l.color, display: 'inline-block' }} />
              {l.label}
            </div>
          ))}
        </div>
      </div>
      <div ref={containerRef} style={{ height: 220, width: '100%', minWidth: 0 }}>
        {error ? (
          <p style={{ fontSize: 12, color: 'var(--fo-red)', textAlign: 'center', paddingTop: 48 }}>Erro ao carregar dados do gráfico.</p>
        ) : chartData.length === 0 || !chartData.some((r) => r.entradas + r.saidas > 0) ? (
          <p style={{ fontSize: 12, color: 'var(--gray-400)', textAlign: 'center', paddingTop: 48 }}>Sem transações no período.</p>
        ) : !ready ? (
          <div style={{ height: '100%', background: 'var(--gray-100)', borderRadius: 8 }} className="animate-pulse" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 10, fill: 'var(--gray-400)', fontFamily: "'DM Mono', monospace" }} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--gray-400)', fontFamily: "'DM Mono', monospace" }} tickFormatter={(v) => fmtBRLCompact(Number(v))} />
              <Tooltip
                formatter={(value: number) => fmtBRLCompact(value)}
                contentStyle={{ borderRadius: 8, border: '1px solid var(--gray-100)', fontFamily: "'Inter', sans-serif", fontSize: 12 }}
              />
              <Bar dataKey="entradas" name="Entradas" fill="#5E8C87" radius={[3, 3, 0, 0]} />
              <Bar dataKey="saidas" name="Saídas" fill="rgba(184,146,42,.45)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
