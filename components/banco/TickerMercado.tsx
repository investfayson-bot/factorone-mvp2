'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Item = { simbolo: string; nome: string; valor: number; variacao_pct: number | null; moeda: string }

function fmt(v: number, moeda: string) {
  if (moeda === 'BRL') return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: v < 10 ? 4 : 2 })
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}

export default function TickerMercado() {
  const [itens, setItens] = useState<Item[]>([])
  const [atualizadoEm, setAtualizadoEm] = useState<string | null>(null)
  const [carregado, setCarregado] = useState(false)

  useEffect(() => {
    let ativo = true
    async function carregar() {
      const { data } = await supabase.auth.getSession()
      const t = data.session?.access_token
      if (!t) return
      const r = await fetch('/api/mercado/ticker', { headers: { Authorization: `Bearer ${t}` } }).then(x => x.json()).catch(() => null)
      if (!ativo || !r) return
      setItens(r.itens ?? [])
      setAtualizadoEm(r.atualizado_em ?? null)
      setCarregado(true)
    }
    void carregar()
    const id = setInterval(carregar, 10 * 60 * 1000)
    return () => { ativo = false; clearInterval(id) }
  }, [])

  if (carregado && itens.length === 0) return null

  return (
    <div className="ticker-v2">
      {itens.length === 0 ? (
        <span style={{ fontSize: 11.5, color: 'var(--mut)' }}>Carregando cotações…</span>
      ) : itens.map(it => (
        <div key={it.simbolo} className="it">
          <span style={{ color: 'var(--mut)', fontWeight: 700 }}>{it.simbolo}</span>
          <b>{fmt(it.valor, it.moeda)}</b>
          {it.variacao_pct != null && (
            <span className={`chg ${it.variacao_pct >= 0 ? 'up' : 'down'}`}>
              {it.variacao_pct >= 0 ? '↑' : '↓'} {Math.abs(it.variacao_pct).toFixed(2)}%
            </span>
          )}
        </div>
      ))}
      {atualizadoEm && (
        <span className="upd">Atualizado {new Date(atualizadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
      )}
    </div>
  )
}
