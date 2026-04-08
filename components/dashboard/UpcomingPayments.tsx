'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { CalendarClock, ChevronRight } from 'lucide-react'
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

function badgeClass(dias: number) {
  if (dias <= 1) return 'bg-red-100 text-red-800 border-red-200'
  if (dias <= 5) return 'bg-amber-100 text-amber-800 border-amber-200'
  return 'bg-emerald-100 text-emerald-800 border-emerald-200'
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

        const { data, error: e } = await supabase
          .from('transacoes')
          .select('id,descricao,valor,due_date,tipo')
          .eq('empresa_id', empresaId)
          .eq('status', 'pendente')
          .not('due_date', 'is', null)
          .gte('due_date', a)
          .lte('due_date', b)
          .order('due_date', { ascending: true })

        if (e) throw e
        if (!cancelled) setRows((data as Row[]) || [])
      } catch (err: unknown) {
        if (!cancelled) setError(erroDesconhecido(err) || 'Erro ao carregar vencimentos')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    if (empresaId) load()
    return () => {
      cancelled = true
    }
  }, [empresaId])

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm animate-pulse">
        <div className="h-4 w-48 bg-slate-200 rounded mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-slate-100 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-sm text-red-800">
        <p className="font-medium">Vencimentos</p>
        <p className="mt-1">{error}</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center">
            <CalendarClock className="w-4 h-4 text-slate-600" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-800 text-sm">Próximos vencimentos</h2>
            <p className="text-xs text-slate-500">7 dias • status pendente</p>
          </div>
        </div>
        <Link
          href="/dashboard/despesas"
          className="text-sm font-medium text-blue-700 hover:text-blue-800 flex items-center gap-0.5"
        >
          Ver todos <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-slate-500 py-6 text-center">
          Nenhum vencimento com <code className="text-xs bg-slate-100 px-1 rounded">due_date</code> nos próximos 7 dias.
          Preencha a data de vencimento nas transações pendentes.
        </p>
      ) : (
        <ul className="space-y-2 flex-1 overflow-auto max-h-[280px]">
          {rows.map((r) => {
            const due = r.due_date!
            const dias = diasRestantes(due)
            const tipoLabel = r.tipo === 'entrada' ? 'Receber' : 'Pagar'
            return (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{r.descricao || 'Sem descrição'}</p>
                  <p className="text-xs text-slate-500">
                    {tipoLabel} • {new Date(due + 'T12:00:00').toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="text-sm font-semibold text-slate-800">{fmtBRL(Number(r.valor))}</span>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${badgeClass(dias)}`}>
                    {dias === 0 ? 'Hoje' : dias === 1 ? 'Amanhã' : `${dias} dias`}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
