'use client'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'

type Props = { empresaId: string; pendentesFila: number; onIrParaFila: () => void; refreshKey: number }
type Previsto = { id: string; descricao: string; valor: number; data_vencimento: string; origem: 'pagar' | 'receber' }

export default function VisaoGeralTab({ empresaId, pendentesFila, onIrParaFila, refreshKey }: Props) {
  const [entrou, setEntrou] = useState(0)
  const [saiu, setSaiu] = useState(0)
  const [semTransacao, setSemTransacao] = useState<Previsto[]>([])
  const [loading, setLoading] = useState(true)

  const carregar = useCallback(async () => {
    setLoading(true)
    const mes0 = new Date(); mes0.setDate(1)
    const d0 = mes0.toISOString().slice(0, 10)
    const hoje = new Date().toISOString().slice(0, 10)
    const [txR, pgR, rcR] = await Promise.all([
      supabase.from('transacoes').select('valor,tipo').eq('empresa_id', empresaId).gte('data', d0).limit(1000),
      supabase.from('contas_pagar').select('id,descricao,valor,data_vencimento').eq('empresa_id', empresaId).in('status', ['pendente', 'vencida']).lte('data_vencimento', hoje).limit(10),
      supabase.from('contas_receber').select('id,descricao,valor,data_vencimento').eq('empresa_id', empresaId).in('status', ['pendente', 'vencida']).lte('data_vencimento', hoje).limit(10),
    ])
    const txs = (txR.data ?? []) as { valor: number; tipo: string }[]
    setEntrou(txs.filter(t => t.tipo === 'entrada').reduce((s, t) => s + Number(t.valor), 0))
    setSaiu(txs.filter(t => t.tipo === 'saida').reduce((s, t) => s + Number(t.valor), 0))
    setSemTransacao([
      ...((pgR.data ?? []) as Omit<Previsto, 'origem'>[]).map(p => ({ ...p, valor: Number(p.valor), origem: 'pagar' as const })),
      ...((rcR.data ?? []) as Omit<Previsto, 'origem'>[]).map(r => ({ ...r, valor: Number(r.valor), origem: 'receber' as const })),
    ].sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento)).slice(0, 6))
    setLoading(false)
  }, [empresaId])

  useEffect(() => { void carregar() }, [carregar, refreshKey])

  if (loading) return <div style={{ padding: 44, textAlign: 'center', color: 'var(--ink-mut)', fontSize: 15 }}>Carregando…</div>

  return (
    <>
      <div className="kpis" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="kpi"><div className="kpi-lbl">Entrou (mês)</div><div className="kpi-val" style={{ color: '#3D7A6E' }}>{formatBRL(entrou)}</div></div>
        <div className="kpi"><div className="kpi-lbl">Saiu (mês)</div><div className="kpi-val" style={{ color: '#B0413E' }}>{formatBRL(saiu)}</div></div>
        <div className="kpi"><div className="kpi-lbl">Resultado</div><div className="kpi-val" style={{ color: entrou - saiu >= 0 ? '#3D7A6E' : '#B0413E' }}>{formatBRL(entrou - saiu)}</div></div>
      </div>

      {pendentesFila > 0 && (
        <button onClick={onIrParaFila} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', padding: '14px 18px', background: 'var(--sage-tint)', border: '1px solid var(--sage)', borderRadius: 14, cursor: 'pointer', marginTop: 12 }}>
          <i className="fa-solid fa-inbox" style={{ color: 'var(--sage-deep)', fontSize: 18 }} />
          <span style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--sage-deep)', flex: 1 }}>
            {pendentesFila} transaç{pendentesFila === 1 ? 'ão' : 'ões'} esperando sua confirmação na Fila
          </span>
          <i className="fa-solid fa-arrow-right" style={{ color: 'var(--sage-deep)' }} />
        </button>
      )}

      {semTransacao.length > 0 && (
        <div style={{ background: '#F3ECDA', border: '0.5px solid #F59E0B', borderRadius: 14, padding: '12px 16px', fontSize: 14, color: '#13201D', lineHeight: 1.7, marginTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <i className="fa-solid fa-triangle-exclamation" style={{ color: '#B08A3E' }} />
            <strong>{semTransacao.length} lançamento{semTransacao.length > 1 ? 's' : ''} vencido{semTransacao.length > 1 ? 's' : ''}</strong> sem transação bancária correspondente
          </div>
          {semTransacao.map(p => (
            <div key={`${p.origem}-${p.id}`} style={{ fontSize: 13, color: '#7B8C88', paddingLeft: 20 }}>
              · {p.descricao} — {formatBRL(p.valor)} ({p.origem === 'pagar' ? 'a pagar' : 'a receber'}, venc. {new Date(p.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR')})
            </div>
          ))}
        </div>
      )}
    </>
  )
}
