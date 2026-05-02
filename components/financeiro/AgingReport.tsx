'use client'

import { useEffect, useState } from 'react'
import { formatBRL } from '@/lib/currency-brl'
import { supabase } from '@/lib/supabase'

type Totais = Record<'atual' | '1-7' | '8-30' | '31-60' | '61-90' | '>90', number>
type Data = { pagar: Totais; receber: Totais }

const card: React.CSSProperties = { background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: 16, marginBottom: 12 }

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

  function AgingGrid({ totais, label }: { totais?: Totais; label: string }) {
    return (
      <div style={card}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', marginBottom: 12 }}>{label}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 8 }}>
          {cols.map((c) => {
            const isRisk = c === '>90' || c === '61-90'
            return (
              <div key={c} style={{ background: isRisk ? 'rgba(192,80,74,.06)' : 'var(--gray-50, #fafafa)', border: `1px solid ${isRisk ? 'rgba(192,80,74,.2)' : 'var(--gray-100)'}`, borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ fontSize: 9, color: 'var(--gray-400)', textTransform: 'uppercase', fontFamily: "'DM Mono',monospace", marginBottom: 4 }}>{c}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: isRisk ? 'var(--red)' : 'var(--navy)' }}>{formatBRL(Number(totais?.[c] || 0))}</div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div>
      <AgingGrid totais={data?.pagar} label="Aging A Pagar" />
      <AgingGrid totais={data?.receber} label="Aging A Receber" />
    </div>
  )
}
