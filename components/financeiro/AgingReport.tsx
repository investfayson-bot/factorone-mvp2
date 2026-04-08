'use client'

import { useEffect, useState } from 'react'
import { formatBRL } from '@/lib/currency-brl'
import { supabase } from '@/lib/supabase'

type Totais = Record<'atual' | '1-7' | '8-30' | '31-60' | '61-90' | '>90', number>
type Data = { pagar: Totais; receber: Totais }

export default function AgingReport() {
  const [data, setData] = useState<Data | null>(null)
  useEffect(() => {
    void (async () => {
      const { data: sess } = await supabase.auth.getSession()
      const token = sess.session?.access_token
      const res = await fetch('/api/financeiro/aging', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const payload = await res.json().catch(() => null)
      setData(payload)
    })()
  }, [])
  const cols: Array<keyof Totais> = ['atual', '1-7', '8-30', '31-60', '61-90', '>90']
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-white p-4">
        <h3 className="mb-2 font-semibold">Aging A Pagar</h3>
        <div className="grid grid-cols-6 gap-2 text-sm">{cols.map((c) => <div key={c} className="rounded border p-2"><p className="text-xs text-slate-500">{c}</p><p className={`${c === '>90' || c === '61-90' ? 'text-red-600' : ''}`}>{formatBRL(Number(data?.pagar?.[c] || 0))}</p></div>)}</div>
      </div>
      <div className="rounded-2xl border bg-white p-4">
        <h3 className="mb-2 font-semibold">Aging A Receber</h3>
        <div className="grid grid-cols-6 gap-2 text-sm">{cols.map((c) => <div key={c} className="rounded border p-2"><p className="text-xs text-slate-500">{c}</p><p className={`${c === '>90' || c === '61-90' ? 'text-red-600' : ''}`}>{formatBRL(Number(data?.receber?.[c] || 0))}</p></div>)}</div>
      </div>
    </div>
  )
}
