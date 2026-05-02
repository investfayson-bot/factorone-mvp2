'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { fmtBRL } from '@/lib/dre-calculations'
import { erroDesconhecido } from '@/lib/transacao-types'

type Row = {
  id: string
  descricao: string | null
  valor: number
  due_date: string | null
  tipo: 'entrada' | 'saida'
}

type Props = { empresaId: string }

function diasRestantes(due: string) {
  const d = new Date(due + 'T12:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function badgeStyle(dias: number): React.CSSProperties {
  if (dias <= 1) return { background: 'rgba(192,80,74,.12)', color: 'var(--fo-red)' }
  if (dias <= 5) return { background: 'rgba(184,146,42,.12)', color: 'var(--fo-gold)' }
  return { background: 'rgba(45,155,111,.12)', color: 'var(--fo-green)' }
}

export default function UpcomingPayments({ empresaId }: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<Row[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const end = new Date(today)
        end.setDate(end.getDate() + 7)
        const a = today.toISOString().slice(0, 10)
        const b = end.toISOString().slice(0, 10)

        const fallback = await supabase
          .from('transacoes')
          .select('id,descricao,valor,data,tipo')
          .eq('empresa_id', empresaId)
          .gte('data', a)
          .lte('data', b)
          .order('data', { ascending: true })

        if (fallback.error) throw fallback.error
        const mapped = ((fallback.data as Array<Row & { data?: string | null }>) || []).map((r) => ({
          id: r.id,
          descricao: r.descricao,
          valor: Number(r.valor || 0),
          due_date: r.data ?? null,
          tipo: r.tipo,
        }))
        if (!cancelled) setRows(mapped)
      } catch (err: unknown) {
        if (!cancelled) setError(erroDesconhecido(err) || 'Erro ao carregar vencimentos')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    if (empresaId) load()
    return () => { cancelled = true }
  }, [empresaId])

  if (loading) {
    return (
      <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: 20, height: '100%' }} className="animate-pulse">
        <div style={{ height: 12, width: 160, background: 'var(--gray-100)', borderRadius: 6, marginBottom: 14 }} />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} style={{ height: 44, background: 'var(--gray-100)', borderRadius: 8 }} />)}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ background: 'rgba(192,80,74,.06)', border: '1px solid rgba(192,80,74,.2)', borderRadius: 12, padding: 20, fontSize: 12, color: 'var(--fo-red)' }}>
        <p style={{ fontWeight: 700 }}>Vencimentos</p>
        <p style={{ marginTop: 4 }}>{error}</p>
      </div>
    )
  }

  return (
    <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: 20, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--gray-400)', letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: "'DM Mono', monospace" }}>
          Próximos Vencimentos · 7 dias
        </div>
        <Link href="/dashboard/despesas" style={{ fontSize: 11, color: 'var(--teal)', textDecoration: 'none' }}>Ver todos →</Link>
      </div>

      {rows.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--gray-400)', textAlign: 'center', paddingBlock: 24 }}>
          Nenhuma transação prevista para os próximos 7 dias.
        </p>
      ) : (
        <div style={{ flex: 1, overflow: 'auto', maxHeight: 280 }} className="space-y-2">
          {rows.map((r) => {
            const due = r.due_date!
            const dias = diasRestantes(due)
            return (
              <div
                key={r.id}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '9px 12px', background: 'var(--cream)', borderRadius: 8, border: '1px solid var(--gray-100)' }}
              >
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--navy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.descricao || 'Sem descrição'}
                  </p>
                  <p style={{ fontSize: 10.5, color: 'var(--gray-400)', marginTop: 1 }}>
                    {r.tipo === 'entrada' ? 'Receber' : 'Pagar'} · {new Date(due + 'T12:00:00').toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--navy)', fontFamily: "'DM Mono', monospace" }}>
                    {fmtBRL(r.valor)}
                  </span>
                  <span style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 7px', borderRadius: 20, fontFamily: "'DM Mono', monospace", ...badgeStyle(dias) }}>
                    {dias === 0 ? 'Hoje' : dias === 1 ? 'Amanhã' : `${dias}d`}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
