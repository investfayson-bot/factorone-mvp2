'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
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
    return () => { cancelled = true }
  }, [empresaId])

  const ring = useMemo(() => {
    if (score <= 40) return { color: 'var(--fo-red)', stroke: '#C0504A' }
    if (score <= 70) return { color: 'var(--fo-gold)', stroke: '#B8922A' }
    return { color: 'var(--fo-green)', stroke: '#2D9B6F' }
  }, [score])

  if (loading) {
    return (
      <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: 20, height: '100%' }} className="animate-pulse">
        <div style={{ height: 12, width: 120, background: 'var(--gray-100)', borderRadius: 6, marginBottom: 16 }} />
        <div style={{ display: 'flex', justifyContent: 'center', paddingBlock: 24 }}>
          <div style={{ width: 120, height: 120, borderRadius: '50%', background: 'var(--gray-100)' }} />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ background: 'rgba(192,80,74,.06)', border: '1px solid rgba(192,80,74,.2)', borderRadius: 12, padding: 20, fontSize: 12, color: 'var(--fo-red)' }}>
        <p style={{ fontWeight: 700 }}>Score de saúde</p>
        <p style={{ marginTop: 4 }}>{error}</p>
      </div>
    )
  }

  const circumference = 2 * Math.PI * 44
  const offset = circumference - (score / 100) * circumference

  return (
    <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: 20, height: '100%' }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--gray-400)', letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: "'DM Mono', monospace", marginBottom: 14 }}>
        Saúde Financeira
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBlock: 8 }}>
        <div style={{ position: 'relative', width: 130, height: 130 }}>
          <svg style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }} viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="44" fill="none" stroke="var(--gray-100)" strokeWidth="10" />
            <circle
              cx="50" cy="50" r="44" fill="none"
              stroke={ring.stroke}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              style={{ transition: 'stroke-dashoffset 0.6s ease' }}
            />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: "'Sora', sans-serif", fontSize: 30, fontWeight: 800, color: ring.color, lineHeight: 1 }}>{score}</span>
            <span style={{ fontSize: 9, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: "'DM Mono', monospace" }}>/ 100</span>
          </div>
        </div>
        <p style={{ marginTop: 10, fontSize: 12, fontWeight: 700, color: ring.color, fontFamily: "'DM Mono', monospace", letterSpacing: '.04em' }}>{label}</p>
      </div>
    </div>
  )
}
