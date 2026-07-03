'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'

type Linha = {
  data_transacao: string | null
  valor: number
  tipo: 'credito' | 'debito'
  conciliado: boolean
  origem: string | null
}

const ORIGEM_LABEL: Record<string, string> = {
  belvo: 'Open Finance (Belvo)', importacao_ofx: 'Importação OFX/CSV', tax: 'Impostos', manual: 'Manual',
}

export default function RelatorioConciliacaoPage() {
  const hoje = new Date()
  const seisMeses = new Date(hoje.getFullYear(), hoje.getMonth() - 5, 1)
  const [de, setDe] = useState(seisMeses.toISOString().slice(0, 10))
  const [ate, setAte] = useState(hoje.toISOString().slice(0, 10))
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [loading, setLoading] = useState(true)

  const carregar = useCallback(async () => {
    setLoading(true)
    const { data: auth } = await supabase.auth.getUser()
    const user = auth.user
    if (!user) return
    const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const empresa = (u?.empresa_id as string) ?? user.id
    const { data } = await supabase
      .from('extrato_bancario')
      .select('data_transacao, valor, tipo, conciliado, origem')
      .eq('empresa_id', empresa)
      .gte('data_transacao', de).lte('data_transacao', ate + 'T23:59:59')
      .order('data_transacao', { ascending: false })
      .limit(5000)
    setLinhas((data ?? []) as Linha[])
    setLoading(false)
  }, [de, ate])

  useEffect(() => { void carregar() }, [carregar])

  const r = useMemo(() => {
    const total = linhas.length
    const conc = linhas.filter(l => l.conciliado)
    const pend = linhas.filter(l => !l.conciliado)
    const pct = total > 0 ? (conc.length / total) * 100 : 0
    const sum = (arr: Linha[], tipo: 'credito' | 'debito') => arr.filter(l => l.tipo === tipo).reduce((s, l) => s + Number(l.valor || 0), 0)

    // por mês
    const mesMap = new Map<string, { total: number; conc: number; valorConc: number; valorPend: number }>()
    for (const l of linhas) {
      const m = (l.data_transacao ?? '').slice(0, 7) || '—'
      const g = mesMap.get(m) ?? { total: 0, conc: 0, valorConc: 0, valorPend: 0 }
      g.total++; if (l.conciliado) { g.conc++; g.valorConc += Number(l.valor || 0) } else { g.valorPend += Number(l.valor || 0) }
      mesMap.set(m, g)
    }
    const porMes = Array.from(mesMap.entries()).sort((a, b) => b[0].localeCompare(a[0]))

    // por origem
    const origMap = new Map<string, { total: number; conc: number }>()
    for (const l of linhas) {
      const o = l.origem || 'manual'
      const g = origMap.get(o) ?? { total: 0, conc: 0 }
      g.total++; if (l.conciliado) g.conc++
      origMap.set(o, g)
    }
    const porOrigem = Array.from(origMap.entries()).sort((a, b) => b[1].total - a[1].total)

    return { total, conc: conc.length, pend: pend.length, pct, credConc: sum(conc, 'credito'), debConc: sum(conc, 'debito'), credPend: sum(pend, 'credito'), debPend: sum(pend, 'debito'), porMes, porOrigem }
  }, [linhas])

  function exportarCSV() {
    const rows = [['Mês', 'Total', 'Conciliados', 'Pendentes', '% conciliado', 'Valor conciliado', 'Valor pendente']]
    for (const [m, g] of r.porMes) {
      rows.push([m, String(g.total), String(g.conc), String(g.total - g.conc), `${g.total ? ((g.conc / g.total) * 100).toFixed(1) : '0'}%`, g.valorConc.toFixed(2), g.valorPend.toFixed(2)])
    }
    const csv = rows.map(r => r.join(';')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `conciliacao_${de}_${ate}.csv`; a.click(); URL.revokeObjectURL(a.href)
  }

  const kpis = [
    { label: '% conciliado', valor: `${r.pct.toFixed(1)}%`, cor: r.pct >= 80 ? 'var(--green)' : r.pct >= 50 ? 'var(--gold)' : '#B0413E' },
    { label: 'Lançamentos', valor: String(r.total), cor: 'var(--navy)' },
    { label: 'Conciliados', valor: String(r.conc), cor: 'var(--teal)' },
    { label: 'Pendentes', valor: String(r.pend), cor: r.pend ? '#B0413E' : 'var(--green)' },
  ]

  return (
    <div style={{ maxWidth: 960 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-sans)", fontSize: 18, fontWeight: 700, color: 'var(--navy)', margin: 0 }}>Relatório de Conciliação</h1>
          <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 3 }}>Status de conciliação do extrato bancário por período.</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label style={{ fontSize: 11, color: 'var(--gray-500)' }}>De<br /><input type="date" className="form-input" value={de} onChange={e => setDe(e.target.value)} style={{ padding: '6px 8px' }} /></label>
          <label style={{ fontSize: 11, color: 'var(--gray-500)' }}>Até<br /><input type="date" className="form-input" value={ate} onChange={e => setAte(e.target.value)} style={{ padding: '6px 8px' }} /></label>
          <button className="btn-action btn-ghost" style={{ borderRadius: 8 }} onClick={exportarCSV} disabled={!r.total}>Exportar CSV</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 16 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: .4 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.cor, marginTop: 4 }}>{k.valor}</div>
          </div>
        ))}
      </div>

      {/* barra de progresso */}
      <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
          <span style={{ color: 'var(--gray-500)' }}>Conciliado: {formatBRL(r.credConc + r.debConc)} ({r.conc})</span>
          <span style={{ color: 'var(--gray-500)' }}>Pendente: {formatBRL(r.credPend + r.debPend)} ({r.pend})</span>
        </div>
        <div style={{ height: 10, borderRadius: 5, background: 'var(--gray-100)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${r.pct}%`, background: 'var(--teal)' }} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        {/* por mês */}
        <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', marginBottom: 10 }}>Por mês</div>
          {loading ? <div style={{ color: 'var(--gray-400)', fontSize: 13 }}>Carregando…</div> : r.porMes.length === 0 ? (
            <div style={{ color: 'var(--gray-400)', fontSize: 13 }}>Sem lançamentos no período.</div>
          ) : (
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
              <thead><tr style={{ color: 'var(--gray-400)', fontSize: 11 }}>
                <th style={{ textAlign: 'left', padding: '6px 4px' }}>Mês</th>
                <th style={{ textAlign: 'right', padding: '6px 4px' }}>Conc/Total</th>
                <th style={{ textAlign: 'right', padding: '6px 4px' }}>%</th>
                <th style={{ textAlign: 'right', padding: '6px 4px' }}>Pendente</th>
              </tr></thead>
              <tbody>
                {r.porMes.map(([m, g]) => {
                  const pct = g.total ? (g.conc / g.total) * 100 : 0
                  return (
                    <tr key={m} style={{ borderTop: '1px solid var(--gray-50,#f3f4f6)' }}>
                      <td style={{ padding: '6px 4px', color: 'var(--navy)' }}>{m}</td>
                      <td style={{ textAlign: 'right', padding: '6px 4px' }}>{g.conc}/{g.total}</td>
                      <td style={{ textAlign: 'right', padding: '6px 4px', color: pct >= 80 ? 'var(--green)' : pct >= 50 ? 'var(--gold)' : '#B0413E', fontWeight: 600 }}>{pct.toFixed(0)}%</td>
                      <td style={{ textAlign: 'right', padding: '6px 4px', color: 'var(--gray-500)' }}>{formatBRL(g.valorPend)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* por origem */}
        <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', marginBottom: 10 }}>Por origem</div>
          {r.porOrigem.length === 0 ? (
            <div style={{ color: 'var(--gray-400)', fontSize: 13 }}>—</div>
          ) : r.porOrigem.map(([o, g]) => {
            const pct = g.total ? (g.conc / g.total) * 100 : 0
            return (
              <div key={o} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                  <span style={{ color: 'var(--navy)', fontWeight: 600 }}>{ORIGEM_LABEL[o] ?? o}</span>
                  <span style={{ color: 'var(--gray-400)' }}>{g.conc}/{g.total}</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: 'var(--gray-100)' }}>
                  <div style={{ height: '100%', width: `${pct}%`, borderRadius: 3, background: 'var(--teal)' }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
