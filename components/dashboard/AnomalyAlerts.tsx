'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { AlertTriangle, TrendingDown, X, Zap } from 'lucide-react'

type AlertItem = { id: string; tone: 'red' | 'orange' | 'yellow'; title: string; detail: string }

const STORAGE_KEY = 'factorone-dismissed-alerts'

type Props = { empresaId: string }

export default function AnomalyAlerts({ empresaId }: Props) {
  const [items, setItems] = useState<AlertItem[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setDismissed(new Set(JSON.parse(raw) as string[]))
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function detect() {
      const list: AlertItem[] = []
      try {
        const now = new Date()
        const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1)
        const fimMes = new Date(now.getFullYear(), now.getMonth() + 1, 0)

        const inicioM1 = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        const fimM1 = new Date(now.getFullYear(), now.getMonth(), 0)
        const historicoInicio = new Date(now.getFullYear() - 2, now.getMonth(), 1)

        const { data: txs, error } = await supabase
          .from('transacoes')
          .select('tipo,valor,data')
          .eq('empresa_id', empresaId)
          .gte('data', historicoInicio.toISOString().slice(0, 10))
          .order('data', { ascending: true })

        if (error) throw error
        const t = txs || []

        const saidaM1 = t
          .filter((row) => {
            const dt = new Date(row.data + 'T12:00:00')
            return row.tipo === 'saida' && dt >= inicioM1 && dt <= fimM1
          })
          .reduce((s, row) => s + Number(row.valor || 0), 0)
        const saidaM2 = t
          .filter((row) => {
            const dt = new Date(row.data + 'T12:00:00')
            const i2 = new Date(now.getFullYear(), now.getMonth() - 2, 1)
            const f2 = new Date(now.getFullYear(), now.getMonth() - 1, 0)
            return row.tipo === 'saida' && dt >= i2 && dt <= f2
          })
          .reduce((s, row) => s + Number(row.valor || 0), 0)
        const saidaM3 = t
          .filter((row) => {
            const dt = new Date(row.data + 'T12:00:00')
            const i3 = new Date(now.getFullYear(), now.getMonth() - 3, 1)
            const f3 = new Date(now.getFullYear(), now.getMonth() - 2, 0)
            return row.tipo === 'saida' && dt >= i3 && dt <= f3
          })
          .reduce((s, row) => s + Number(row.valor || 0), 0)

        const média = (saidaM1 + saidaM2 + saidaM3) / 3

        const saidaMesAtual = t
          .filter((row) => {
            const dt = new Date(row.data + 'T12:00:00')
            return row.tipo === 'saida' && dt >= inicioMes && dt <= fimMes
          })
          .reduce((s, row) => s + Number(row.valor || 0), 0)

        if (média > 0 && saidaMesAtual > média * 1.3) {
          list.push({
            id: 'despesa-acima-media',
            tone: 'orange',
            title: 'Despesas acima do padrão',
            detail: `Despesas do mês ~${((saidaMesAtual / média - 1) * 100).toFixed(0)}% acima da média dos últimos 3 meses.`,
          })
        }

        const sorted = [...t].sort((a, b) => a.data.localeCompare(b.data))
        let acc = 0
        const pontos: { data: string; saldo: number }[] = []
        sorted.forEach((row) => {
          acc += row.tipo === 'entrada' ? Number(row.valor || 0) : -Number(row.valor || 0)
          pontos.push({ data: row.data, saldo: acc })
        })

        const hojeStr = now.toISOString().slice(0, 10)
        const sete = new Date(now)
        sete.setDate(sete.getDate() - 7)
        const seteStr = sete.toISOString().slice(0, 10)

        let saldoHoje = 0
        let saldo7 = 0
        for (const p of pontos) {
          if (p.data <= hojeStr) saldoHoje = p.saldo
          if (p.data <= seteStr) saldo7 = p.saldo
        }

        if (saldo7 > 0 && saldoHoje < saldo7 * 0.8) {
          list.push({
            id: 'saldo-caindo',
            tone: 'red',
            title: 'Saldo acumulado em queda',
            detail: 'O saldo acumulado caiu mais de 20% em relação ao patamar de 7 dias atrás.',
          })
        }

        const quinze = new Date(now)
        quinze.setDate(quinze.getDate() - 15)
        const quinzeStr = quinze.toISOString().slice(0, 10)
        const receita15 = t
          .filter((row) => row.tipo === 'entrada' && row.data >= quinzeStr)
          .reduce((s, row) => s + Number(row.valor || 0), 0)

        if (receita15 === 0) {
          list.push({
            id: 'sem-receita-15',
            tone: 'yellow',
            title: 'Sem receitas recentes',
            detail: 'Nenhuma receita registrada nos últimos 15 dias.',
          })
        }
      } catch {
        /* silencioso */
      }
      if (!cancelled) setItems(list)
    }
    if (empresaId) detect()
    return () => {
      cancelled = true
    }
  }, [empresaId])

  const visible = useMemo(() => items.filter((i) => !dismissed.has(i.id)), [items, dismissed])

  function dismiss(id: string) {
    const next = new Set(dismissed)
    next.add(id)
    setDismissed(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(next)))
    } catch {
      /* ignore */
    }
  }

  if (visible.length === 0) return null

  const toneMap = {
    red: 'border-red-200 bg-red-50 text-red-900',
    orange: 'border-orange-200 bg-orange-50 text-orange-950',
    yellow: 'border-amber-200 bg-amber-50 text-amber-950',
  }

  return (
    <div className="space-y-2">
      {visible.map((a) => (
        <div
          key={a.id}
          className={`flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-sm ${toneMap[a.tone]}`}
        >
          <div className="mt-0.5 shrink-0">
            {a.tone === 'red' ? (
              <TrendingDown className="w-5 h-5" />
            ) : a.tone === 'orange' ? (
              <AlertTriangle className="w-5 h-5" />
            ) : (
              <Zap className="w-5 h-5" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">{a.title}</p>
            <p className="text-sm opacity-90 mt-0.5">{a.detail}</p>
          </div>
          <button
            type="button"
            onClick={() => dismiss(a.id)}
            className="shrink-0 rounded-lg p-1 hover:bg-black/5 transition-colors"
            aria-label="Dispensar alerta"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
