'use client'

import { useEffect, useMemo, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import { supabase } from '@/lib/supabase'
import { fmtBRLCompact } from '@/lib/dre-calculations'

type Props = { empresaId: string }
type Row = { mes: string; entradas: number; saidas: number }

function mesKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
function labelMes(key: string) {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'short' })
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
        if (!cancelled) setRows(
          Array.from(acc.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([mes, v]) => ({ mes: labelMes(mes), entradas: v.e, saidas: v.s }))
        )
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

  if (loading) return <div style={{ height: 160, background: 'var(--gray-100)', borderRadius: 8, animation: 'pulse 1.5s infinite' }} />
  if (error || !chartData.some(r => r.entradas + r.saidas > 0)) {
    return <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gray-400)', fontSize: 12 }}>Sem transações no período.</div>
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--gray-500)' }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--green)' }} /> Entradas
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--gray-500)' }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--red)' }} /> Saídas
        </div>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="gradEntradas" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3D7A6E" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#3D7A6E" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradSaidas" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#B0413E" stopOpacity={0.18} />
              <stop offset="95%" stopColor="#B0413E" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" vertical={false} />
          <XAxis dataKey="mes" tick={{ fontSize: 10, fill: 'var(--gray-400)' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 9, fill: 'var(--gray-300)' }} axisLine={false} tickLine={false} tickFormatter={v => fmtBRLCompact(v)} width={52} />
          <Tooltip
            formatter={(v: number, name: string) => [fmtBRLCompact(v), name === 'entradas' ? 'Entradas' : 'Saídas']}
            contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid var(--gray-100)', background: '#fff' }}
            labelStyle={{ fontWeight: 700, color: 'var(--navy)', fontSize: 11 }}
          />
          <Area type="monotone" dataKey="entradas" stroke="#3D7A6E" strokeWidth={2} fill="url(#gradEntradas)" dot={false} activeDot={{ r: 4 }} />
          <Area type="monotone" dataKey="saidas" stroke="#B0413E" strokeWidth={2} fill="url(#gradSaidas)" dot={false} activeDot={{ r: 4 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
