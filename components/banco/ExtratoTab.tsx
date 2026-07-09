'use client'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'

type Item = {
  id: string; descricao: string; valor: number; tipo: 'credito' | 'debito'
  data_transacao: string; contraparte_nome: string | null; conciliado: boolean
  tipo_operacao: string | null
}
type Props = { empresaId: string }

export default function ExtratoTab({ empresaId }: Props) {
  const [itens, setItens] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<'todos' | 'pendentes' | 'conciliadas'>('todos')
  const [dias, setDias] = useState(30)

  const carregar = useCallback(async () => {
    setLoading(true)
    const desde = new Date(); desde.setDate(desde.getDate() - dias)
    let q = supabase.from('extrato_bancario')
      .select('id,descricao,valor,tipo,data_transacao,contraparte_nome,conciliado,tipo_operacao')
      .eq('empresa_id', empresaId).gte('data_transacao', desde.toISOString().slice(0, 10))
      .order('data_transacao', { ascending: false }).limit(300)
    if (filtro === 'pendentes') q = q.eq('conciliado', false)
    if (filtro === 'conciliadas') q = q.eq('conciliado', true)
    const { data } = await q
    setItens((data ?? []) as Item[])
    setLoading(false)
  }, [empresaId, filtro, dias])

  useEffect(() => { void carregar() }, [carregar])

  return (
    <div className="txs-card">
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', flex: 1 }}>Extrato ({itens.length})</div>
        {([['todos', 'Todos'], ['pendentes', 'A revisar'], ['conciliadas', 'No caixa']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setFiltro(k)} className="btn-ghost" style={{ fontSize: 13, padding: '4px 12px', borderRadius: 20, background: filtro === k ? 'var(--ink)' : undefined, color: filtro === k ? '#fff' : undefined }}>{l}</button>
        ))}
        <select className="form-input" style={{ width: 'auto', fontSize: 13, padding: '4px 10px' }} value={dias} onChange={e => setDias(Number(e.target.value))}>
          <option value={7}>7 dias</option><option value={30}>30 dias</option><option value={90}>90 dias</option><option value={365}>1 ano</option>
        </select>
      </div>
      {loading ? <div style={{ padding: 36, textAlign: 'center', color: 'var(--ink-mut)' }}>Carregando…</div>
        : itens.length === 0 ? <div style={{ padding: 36, textAlign: 'center', color: 'var(--ink-mut)', fontSize: 15 }}>Nenhuma movimentação no período.</div>
        : itens.map(e => (
          <div key={e.id} className="tx-item">
            <div className="tx-left">
              <div className="tx-name">{e.descricao}</div>
              <div className="tx-sub">
                {e.contraparte_nome || '—'} · {new Date(e.data_transacao).toLocaleDateString('pt-BR')}
                {e.conciliado
                  ? <span className="tag green" style={{ marginLeft: 8, fontSize: 11 }}>no caixa</span>
                  : <span className="tag gray" style={{ marginLeft: 8, fontSize: 11 }}>a revisar</span>}
              </div>
            </div>
            <div className={`tx-amount ${e.tipo === 'credito' ? 'pos' : 'neg'}`}>
              {e.tipo === 'credito' ? '+' : '-'}{formatBRL(Number(e.valor || 0))}
            </div>
          </div>
        ))}
    </div>
  )
}
