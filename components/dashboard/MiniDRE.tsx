'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { calcDREFromTransacoes, fmtBRL, fmtBRLCompact, variacaoPct, type TransacaoDRE } from '@/lib/dre-calculations'
import { erroDesconhecido } from '@/lib/transacao-types'

type Props = { empresaId: string }

const linhasConfig: {
  key: keyof ReturnType<typeof calcDREFromTransacoes>
  label: string
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transacoes', filter: `empresa_id=eq.${empresaId}` }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [empresaId, load])

  if (loading) {
    return (
      <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: 20 }} className="animate-pulse">
        <div style={{ height: 12, width: 100, background: 'var(--gray-100)', borderRadius: 6, marginBottom: 14 }} />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => <div key={i} style={{ height: 32, background: 'var(--gray-100)', borderRadius: 8 }} />)}
        </div>
      </div>
    )
  }

  if (error || !atual) {
    return (
      <div style={{ background: 'rgba(192,80,74,.06)', border: '1px solid rgba(192,80,74,.2)', borderRadius: 12, padding: 20, fontSize: 12, color: 'var(--fo-red)' }}>
        <p style={{ fontWeight: 700 }}>DRE resumido</p>
        <p style={{ marginTop: 4 }}>{error || 'Dados indisponíveis'}</p>
      </div>
    )
  }

  return (
    <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: 20, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--gray-400)', letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: "'DM Mono', monospace" }}>
          DRE Resumo
        </div>
        <Link href="/dashboard/relatorios" style={{ fontSize: 11, color: 'var(--teal)', textDecoration: 'none' }}>
          Ver completo →
        </Link>
      </div>

      <div style={{ flex: 1 }}>
        {linhasConfig.map(({ key, label, negateDisplay }) => {
          const v = atual[key] as number
          const p = prevDre[key] as number
          const displayVal = negateDisplay ? -Math.abs(v) : v
          const fmt = (n: number) => (Math.abs(n) >= 1000 ? fmtBRLCompact(n) : fmtBRL(n))
          const varPct = variacaoPct(v, p)
          const isLast = key === 'lucroLiquido'

          return (
            <div
              key={String(key)}
              style={{
                display: 'flex', justifyContent: 'space-between', padding: '6px 0',
                borderBottom: isLast ? 'none' : '1px solid var(--gray-100)',
                fontSize: isLast ? 13 : 11.5,
                fontWeight: isLast ? 800 : 400,
              }}
            >
              <span style={{ color: isLast ? 'var(--navy)' : 'var(--gray-500)' }}>{label}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  fontWeight: 700, fontFamily: "'DM Mono', monospace",
                  color: negateDisplay && v > 0 ? 'var(--fo-red)' : displayVal >= 0 ? 'var(--fo-green)' : 'var(--fo-red)',
                }}>
                  {fmt(displayVal)}
                </span>
                {varPct === null ? (
                  <span style={{ fontSize: 9, background: 'rgba(94,140,135,.1)', color: 'var(--teal2)', padding: '1px 5px', borderRadius: 20, fontFamily: "'DM Mono', monospace" }}>1º mês</span>
                ) : (
                  <span style={{
                    fontSize: 9, fontFamily: "'DM Mono', monospace",
                    color: (negateDisplay ? varPct <= 0 : varPct >= 0) ? 'var(--fo-green)' : 'var(--fo-red)',
                  }}>
                    {varPct >= 0 ? '+' : ''}{varPct.toFixed(1)}%
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
