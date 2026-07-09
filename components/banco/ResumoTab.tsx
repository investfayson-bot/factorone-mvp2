'use client'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'

type Periodo = 'semana' | 'mes' | 'ano'
type Tx = { valor: number; tipo: 'entrada' | 'saida'; categoria: string | null; fornecedor_id: string | null; cliente_id: string | null }
type Props = { empresaId: string; refreshKey: number }

function inicioPeriodo(p: Periodo): string {
  const d = new Date()
  if (p === 'semana') d.setDate(d.getDate() - 7)
  else if (p === 'mes') d.setDate(1)
  else { d.setMonth(0); d.setDate(1) }
  return d.toISOString().slice(0, 10)
}

export default function ResumoTab({ empresaId, refreshKey }: Props) {
  const [periodo, setPeriodo] = useState<Periodo>('mes')
  const [txs, setTxs] = useState<Tx[]>([])
  const [nomes, setNomes] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  const carregar = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('transacoes')
      .select('valor,tipo,categoria,fornecedor_id,cliente_id')
      .eq('empresa_id', empresaId).gte('data', inicioPeriodo(periodo)).limit(1000)
    const rows = (data ?? []) as Tx[]
    setTxs(rows)
    const fIds = Array.from(new Set(rows.map(t => t.fornecedor_id).filter(Boolean))) as string[]
    const cIds = Array.from(new Set(rows.map(t => t.cliente_id).filter(Boolean))) as string[]
    const [fR, cR] = await Promise.all([
      fIds.length ? supabase.from('fornecedores').select('id,razao_social,nome_fantasia').in('id', fIds) : Promise.resolve({ data: [] }),
      cIds.length ? supabase.from('clientes').select('id,nome').in('id', cIds) : Promise.resolve({ data: [] }),
    ])
    const n: Record<string, string> = {}
    for (const f of (fR.data ?? []) as { id: string; razao_social: string; nome_fantasia: string | null }[]) n[f.id] = f.nome_fantasia || f.razao_social
    for (const c of (cR.data ?? []) as { id: string; nome: string }[]) n[c.id] = c.nome
    setNomes(n)
    setLoading(false)
  }, [empresaId, periodo])

  useEffect(() => { void carregar() }, [carregar, refreshKey])

  const saiu = txs.filter(t => t.tipo === 'saida').reduce((s, t) => s + Number(t.valor), 0)
  const entrou = txs.filter(t => t.tipo === 'entrada').reduce((s, t) => s + Number(t.valor), 0)

  function agrupa(chaveFn: (t: Tx) => string | null, tipo: 'entrada' | 'saida'): [string, number][] {
    const m = new Map<string, number>()
    for (const t of txs) {
      if (t.tipo !== tipo) continue
      const k = chaveFn(t); if (!k) continue
      m.set(k, (m.get(k) || 0) + Number(t.valor))
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8)
  }

  const porCategoria = agrupa(t => t.categoria?.trim() || null, 'saida')
  const porFornecedor = agrupa(t => t.fornecedor_id ? (nomes[t.fornecedor_id] ?? '…') : null, 'saida')
  const porCliente = agrupa(t => t.cliente_id ? (nomes[t.cliente_id] ?? '…') : null, 'entrada')

  function Bloco({ titulo, dados, total, cor }: { titulo: string; dados: [string, number][]; total: number; cor: string }) {
    return (
      <div className="txs-card" style={{ padding: '18px 20px' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 14 }}>{titulo}</div>
        {dados.length === 0 ? <div style={{ color: 'var(--ink-mut)', fontSize: 14.5 }}>Sem dados no período — confirme transações na Fila.</div>
          : dados.map(([k, v]) => {
            const pct = total > 0 ? (v / total) * 100 : 0
            return (
              <div key={k} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 5 }}>
                  <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{k}</span>
                  <span style={{ color: 'var(--ink)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatBRL(v)} <span style={{ color: 'var(--ink-mut)', fontWeight: 500 }}>· {pct.toFixed(0)}%</span></span>
                </div>
                <div style={{ height: 8, background: 'var(--paper-2, #F1ECE1)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: cor, borderRadius: 99 }} />
                </div>
              </div>
            )
          })}
      </div>
    )
  }

  if (loading) return <div style={{ padding: 44, textAlign: 'center', color: 'var(--ink-mut)', fontSize: 15 }}>Carregando…</div>

  return (
    <>
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {([['semana', 'Semana'], ['mes', 'Mês'], ['ano', 'Ano']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setPeriodo(k)} className="btn-ghost" style={{ fontSize: 14, padding: '6px 16px', borderRadius: 20, background: periodo === k ? 'var(--sage-tint)' : undefined, borderColor: periodo === k ? 'var(--sage)' : undefined, color: periodo === k ? 'var(--sage-deep)' : undefined, fontWeight: periodo === k ? 700 : 500 }}>{l}</button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
        <Bloco titulo="Onde você gastou (por categoria)" dados={porCategoria} total={saiu} cor="var(--sage)" />
        <Bloco titulo="Gasto por fornecedor" dados={porFornecedor} total={saiu} cor="#B08A3E" />
        <Bloco titulo="Recebido por cliente" dados={porCliente} total={entrou} cor="#3D7A6E" />
      </div>
    </>
  )
}
