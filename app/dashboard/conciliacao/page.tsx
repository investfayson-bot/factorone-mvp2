'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

type Transacao = { id: string; data: string; descricao: string; tipo: 'entrada' | 'saida'; valor: number; categoria: string }
type ContaPagar = { id: string; descricao: string; fornecedor: string | null; data_vencimento: string; valor: number; status: string }
type ContaReceber = { id: string; descricao: string; cliente: string | null; data_vencimento: string; valor: number; valor_recebido: number; status: string }

type ItemConc = {
  id: string
  descBanco: string
  descSistema: string
  data: string
  valor: number
  tipo: 'entrada' | 'saida'
  status: 'conciliado' | 'pendente' | 'divergencia'
  matchId: string | null
  matchTipo: 'pagar' | 'receber' | null
  diffPct: number
}

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)

function matchScore(tx: Transacao, ref: { valor: number; data_vencimento: string }): number {
  const diff = Math.abs(tx.valor - ref.valor) / Math.max(ref.valor, 1)
  const daysDiff = Math.abs(new Date(tx.data).getTime() - new Date(ref.data_vencimento).getTime()) / 86400000
  if (diff > 0.15 || daysDiff > 10) return 0
  return (1 - diff) * 0.7 + (1 - daysDiff / 10) * 0.3
}

function buildItems(
  transacoes: Transacao[],
  pagar: ContaPagar[],
  receber: ContaReceber[],
  manual: Record<string, { matchId: string; matchTipo: 'pagar' | 'receber' }>,
): ItemConc[] {
  const usedPagar = new Set<string>()
  const usedReceber = new Set<string>()

  return transacoes.map(tx => {
    // Manual override
    const man = manual[tx.id]
    if (man) {
      const ref = man.matchTipo === 'pagar'
        ? pagar.find(p => p.id === man.matchId)
        : receber.find(r => r.id === man.matchId)
      if (ref) {
        const diff = Math.abs(tx.valor - ref.valor) / Math.max(ref.valor, 1)
        const status = diff > 0.05 ? 'divergencia' : 'conciliado'
        if (man.matchTipo === 'pagar') usedPagar.add(man.matchId)
        else usedReceber.add(man.matchId)
        return {
          id: tx.id, descBanco: tx.descricao, descSistema: 'descricao' in ref ? ref.descricao : '—',
          data: tx.data, valor: tx.valor, tipo: tx.tipo, status, matchId: man.matchId,
          matchTipo: man.matchTipo, diffPct: Math.round(diff * 100),
        }
      }
    }

    // Auto-match saidas → contas_pagar
    if (tx.tipo === 'saida') {
      let bestScore = 0; let bestP: ContaPagar | null = null
      for (const p of pagar) {
        if (usedPagar.has(p.id)) continue
        const s = matchScore(tx, { valor: p.valor, data_vencimento: p.data_vencimento })
        if (s > bestScore) { bestScore = s; bestP = p }
      }
      if (bestP && bestScore > 0.5) {
        usedPagar.add(bestP.id)
        const diff = Math.abs(tx.valor - bestP.valor) / Math.max(bestP.valor, 1)
        return {
          id: tx.id, descBanco: tx.descricao, descSistema: bestP.descricao,
          data: tx.data, valor: tx.valor, tipo: tx.tipo,
          status: diff > 0.05 ? 'divergencia' : 'conciliado',
          matchId: bestP.id, matchTipo: 'pagar', diffPct: Math.round(diff * 100),
        }
      }
    }

    // Auto-match entradas → contas_receber
    if (tx.tipo === 'entrada') {
      let bestScore = 0; let bestR: ContaReceber | null = null
      for (const r of receber) {
        if (usedReceber.has(r.id)) continue
        const s = matchScore(tx, { valor: r.valor, data_vencimento: r.data_vencimento })
        if (s > bestScore) { bestScore = s; bestR = r }
      }
      if (bestR && bestScore > 0.5) {
        usedReceber.add(bestR.id)
        const diff = Math.abs(tx.valor - bestR.valor) / Math.max(bestR.valor, 1)
        return {
          id: tx.id, descBanco: tx.descricao, descSistema: bestR.descricao,
          data: tx.data, valor: tx.valor, tipo: tx.tipo,
          status: diff > 0.05 ? 'divergencia' : 'conciliado',
          matchId: bestR.id, matchTipo: 'receber', diffPct: Math.round(diff * 100),
        }
      }
    }

    return {
      id: tx.id, descBanco: tx.descricao, descSistema: '—',
      data: tx.data, valor: tx.valor, tipo: tx.tipo,
      status: 'pendente', matchId: null, matchTipo: null, diffPct: 0,
    }
  })
}

export default function ConciliacaoPage() {
  const [empresaId, setEmpresaId] = useState('')
  const [transacoes, setTransacoes] = useState<Transacao[]>([])
  const [pagar, setPagar] = useState<ContaPagar[]>([])
  const [receber, setReceber] = useState<ContaReceber[]>([])
  const [loading, setLoading] = useState(true)
  const [mes, setMes] = useState(() => {
    const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
  })
  const [manual, setManual] = useState<Record<string, { matchId: string; matchTipo: 'pagar' | 'receber' }>>({})
  const [modalTxId, setModalTxId] = useState<string | null>(null)
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'conciliado' | 'pendente' | 'divergencia'>('todos')

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
      const eid = (u?.empresa_id as string) || user.id
      setEmpresaId(eid)

      const [ano, m] = mes.split('-')
      const d0 = `${ano}-${m}-01`
      const d1 = new Date(Number(ano), Number(m), 0).toISOString().slice(0, 10)

      const [txRes, pgRes, rcRes] = await Promise.all([
        supabase.from('transacoes').select('id,data,descricao,tipo,valor,categoria').eq('empresa_id', eid).gte('data', d0).lte('data', d1).order('data', { ascending: false }),
        supabase.from('contas_pagar').select('id,descricao,fornecedor,data_vencimento,valor,status').eq('empresa_id', eid).gte('data_vencimento', d0).lte('data_vencimento', d1),
        supabase.from('contas_receber').select('id,descricao,cliente,data_vencimento,valor,valor_recebido,status').eq('empresa_id', eid).gte('data_vencimento', d0).lte('data_vencimento', d1),
      ])

      setTransacoes((txRes.data ?? []) as Transacao[])
      setPagar((pgRes.data ?? []) as ContaPagar[])
      setReceber((rcRes.data ?? []) as ContaReceber[])
    } catch (err) {
      console.error(err)
      toast.error('Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }, [mes])

  useEffect(() => { void carregar() }, [carregar])

  const items = useMemo(() => buildItems(transacoes, pagar, receber, manual), [transacoes, pagar, receber, manual])
  const filtrados = useMemo(() => filtroStatus === 'todos' ? items : items.filter(i => i.status === filtroStatus), [items, filtroStatus])

  const conciliadas = items.filter(i => i.status === 'conciliado').length
  const pendentes = items.filter(i => i.status === 'pendente').length
  const divergencias = items.filter(i => i.status === 'divergencia').length
  const pctAuto = items.length > 0 ? Math.round((conciliadas / items.length) * 100) : 0

  // Sem lançamento no sistema mas com transação bancária
  const semLancamento = pagar.filter(p =>
    !items.some(i => i.matchId === p.id && i.matchTipo === 'pagar')
  )
  const semEntrada = receber.filter(r =>
    !items.some(i => i.matchId === r.id && i.matchTipo === 'receber')
  )

  function conciliarManual(txId: string, matchId: string, matchTipo: 'pagar' | 'receber') {
    setManual(prev => ({ ...prev, [txId]: { matchId, matchTipo } }))
    setModalTxId(null)
    toast.success('Conciliação manual registrada')
  }

  function desconciliar(txId: string) {
    setManual(prev => { const n = { ...prev }; delete n[txId]; return n })
    toast('Conciliação removida')
  }

  const txModal = modalTxId ? transacoes.find(t => t.id === modalTxId) : null
  const opcoes = txModal
    ? (txModal.tipo === 'saida'
        ? pagar.filter(p => !items.some(i => i.matchId === p.id && i.id !== modalTxId))
        : receber.filter(r => !items.some(i => i.matchId === r.id && i.id !== modalTxId)))
    : []

  const mesesDisponiveis = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - i)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  return (
    <>
      <div className="page-hdr">
        <div>
          <div className="page-title">Conciliação Bancária</div>
          <div className="page-sub">Matching automático · transações vs lançamentos</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select className="form-input" style={{ width: 'auto', padding: '6px 12px', fontSize: 12 }} value={mes} onChange={e => setMes(e.target.value)}>
            {mesesDisponiveis.map(m => {
              const [y, mo] = m.split('-')
              return <option key={m} value={m}>{new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</option>
            })}
          </select>
          <button className="btn-action btn-ghost" onClick={() => void carregar()}>↺ Atualizar</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpis" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="kpi">
          <div className="kpi-lbl">Transações bancárias</div>
          <div className="kpi-val">{loading ? '—' : items.length}</div>
          <div className="kpi-delta">no período</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Conciliadas</div>
          <div className="kpi-val" style={{ color: 'var(--green)' }}>{loading ? '—' : conciliadas}</div>
          <div className={`kpi-delta ${pctAuto >= 80 ? 'up' : pctAuto >= 50 ? 'warn' : 'dn'}`}>{loading ? '—' : `${pctAuto}% auto`}</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Pendentes</div>
          <div className="kpi-val" style={{ color: pendentes > 0 ? 'var(--gold)' : 'var(--navy)' }}>{loading ? '—' : pendentes}</div>
          <div className={`kpi-delta ${pendentes > 0 ? 'warn' : 'up'}`}>{pendentes > 0 ? 'revisão manual' : '✓ ok'}</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Divergências</div>
          <div className="kpi-val" style={{ color: divergencias > 0 ? 'var(--red)' : 'var(--navy)' }}>{loading ? '—' : divergencias}</div>
          <div className={`kpi-delta ${divergencias > 0 ? 'dn' : 'up'}`}>{divergencias > 0 ? 'verificar valor' : '✓ nenhuma'}</div>
        </div>
      </div>

      {/* Alertas de sem lançamento */}
      {(semLancamento.length > 0 || semEntrada.length > 0) && !loading && (
        <div style={{ background: 'rgba(184,146,42,.06)', border: '1px solid rgba(184,146,42,.25)', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: 'var(--navy)', lineHeight: 1.7 }}>
          ⚠ <strong>{semLancamento.length + semEntrada.length} lançamento(s)</strong> no sistema sem transação bancária correspondente:
          {semLancamento.slice(0, 3).map(p => (
            <div key={p.id} style={{ fontSize: 11, color: 'var(--gray-400)', paddingLeft: 16 }}>
              · {p.descricao} — {fmt(p.valor)} (venc. {new Date(p.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR')})
            </div>
          ))}
          {semEntrada.slice(0, 2).map(r => (
            <div key={r.id} style={{ fontSize: 11, color: 'var(--gray-400)', paddingLeft: 16 }}>
              · {r.descricao} — {fmt(r.valor)} (venc. {new Date(r.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR')})
            </div>
          ))}
        </div>
      )}

      {/* Barra progresso */}
      {!loading && items.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 10, padding: '10px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--gray-400)', marginBottom: 6 }}>
            <span>Progresso da conciliação</span>
            <span>{conciliadas} / {items.length}</span>
          </div>
          <div style={{ height: 6, background: 'var(--gray-100)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ display: 'flex', height: '100%' }}>
              <div style={{ width: `${pctAuto}%`, background: 'var(--green)', transition: 'width .4s' }} />
              <div style={{ width: `${Math.round((divergencias / items.length) * 100)}%`, background: 'var(--red)', transition: 'width .4s' }} />
            </div>
          </div>
        </div>
      )}

      {/* Tabela principal */}
      <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--gray-100)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--gray-400)', letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: "'DM Mono',monospace", flex: 1 }}>
            Transações ({filtrados.length})
          </div>
          {(['todos', 'conciliado', 'pendente', 'divergencia'] as const).map(s => (
            <button key={s} onClick={() => setFiltroStatus(s)} style={{
              fontSize: 11, padding: '3px 10px', borderRadius: 20, border: '1px solid',
              borderColor: filtroStatus === s ? 'var(--navy)' : 'var(--gray-100)',
              background: filtroStatus === s ? 'var(--navy)' : 'transparent',
              color: filtroStatus === s ? '#fff' : 'var(--gray-400)',
              cursor: 'pointer', fontWeight: filtroStatus === s ? 700 : 400,
            }}>
              {s === 'todos' ? 'Todos' : s}
            </button>
          ))}
        </div>

        <div className="expenses-table">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Transação bancária</th>
                <th>Lançamento sistema</th>
                <th style={{ textAlign: 'right' }}>Valor banco</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 6 }).map((__, j) => (
                    <td key={j}><div style={{ height: 12, background: 'var(--gray-100)', borderRadius: 4, animation: 'pulse 1.5s infinite' }} /></td>
                  ))}</tr>
                ))
              ) : filtrados.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '40px 0', fontSize: 13 }}>
                  {items.length === 0 ? 'Nenhuma transação neste período. Registre transações no Cash Flow.' : 'Nenhum item com este filtro.'}
                </td></tr>
              ) : filtrados.map(item => (
                <tr key={item.id}>
                  <td style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--gray-400)' }}>
                    {new Date(item.data + 'T12:00:00').toLocaleDateString('pt-BR')}
                  </td>
                  <td style={{ fontWeight: 600, fontSize: 12 }}>{item.descBanco}</td>
                  <td style={{ fontSize: 11, color: item.descSistema === '—' ? 'var(--gray-400)' : 'var(--navy)' }}>
                    {item.descSistema}
                    {item.diffPct > 0 && item.diffPct <= 15 && (
                      <span style={{ marginLeft: 6, fontSize: 9, color: 'var(--gold)', fontWeight: 700 }}>Δ{item.diffPct}%</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: "'DM Mono',monospace", fontWeight: 700, color: item.tipo === 'entrada' ? 'var(--green)' : 'var(--red)' }}>
                    {item.tipo === 'entrada' ? '+' : '-'}{fmt(item.valor)}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {item.status === 'conciliado' && <span className="tag green">conciliado</span>}
                    {item.status === 'pendente' && <span className="tag gray">pendente</span>}
                    {item.status === 'divergencia' && <span className="tag red">divergência</span>}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      {item.status !== 'conciliado' && (
                        <button onClick={() => setModalTxId(item.id)} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, border: '1px solid var(--gray-100)', background: 'transparent', color: 'var(--teal)', cursor: 'pointer', fontWeight: 600 }}>
                          Vincular
                        </button>
                      )}
                      {manual[item.id] && (
                        <button onClick={() => desconciliar(item.id)} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, border: '1px solid rgba(192,80,74,.2)', background: 'transparent', color: 'var(--red)', cursor: 'pointer' }}>
                          Remover
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal vincular manualmente */}
      {modalTxId && txModal && (
        <div className="modal-bg" onClick={() => setModalTxId(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-title">
              Vincular manualmente
              <button className="modal-close" onClick={() => setModalTxId(null)}>×</button>
            </div>
            <div style={{ background: 'var(--cream)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12 }}>
              <div style={{ fontWeight: 700, color: 'var(--navy)' }}>{txModal.descricao}</div>
              <div style={{ color: 'var(--gray-400)', fontSize: 11, marginTop: 2 }}>
                {new Date(txModal.data + 'T12:00:00').toLocaleDateString('pt-BR')} · {fmt(txModal.valor)}
              </div>
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
              {txModal.tipo === 'saida' ? 'Contas a pagar disponíveis' : 'Contas a receber disponíveis'}
            </div>
            {opcoes.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '20px 0', fontSize: 13 }}>
                Nenhum lançamento disponível para vincular neste período.
              </div>
            ) : (
              <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(opcoes as (ContaPagar | ContaReceber)[]).map(op => {
                  const isRec = 'valor_recebido' in op
                  const diff = Math.abs(txModal.valor - op.valor) / Math.max(op.valor, 1)
                  return (
                    <div key={op.id} onClick={() => conciliarManual(txModal.id, op.id, isRec ? 'receber' : 'pagar')}
                      style={{ padding: '10px 12px', border: '1px solid var(--gray-100)', borderRadius: 8, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--teal)')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--gray-100)')}
                    >
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{op.descricao}</div>
                        <div style={{ fontSize: 10, color: 'var(--gray-400)', marginTop: 2 }}>
                          Venc. {new Date(op.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR')} · {fmt(op.valor)}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        {diff < 0.01 && <span className="tag green" style={{ fontSize: 9 }}>✓ exato</span>}
                        {diff >= 0.01 && diff <= 0.1 && <span className="tag gray" style={{ fontSize: 9 }}>Δ{Math.round(diff * 100)}%</span>}
                        {diff > 0.1 && <span className="tag red" style={{ fontSize: 9 }}>Δ{Math.round(diff * 100)}%</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setModalTxId(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
