'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'
import toast from 'react-hot-toast'

const CATEGORIAS = ['Alimentação','Transporte','Moradia','Saúde','Lazer','Educação','Vestuário','Assinaturas','Outros']

type OrcLine = { categoria: string; limite: number; gasto: number }

export default function OrcamentoPage() {
  const [userId, setUserId] = useState('')
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7))
  const [lines, setLines] = useState<OrcLine[]>([])
  const [editando, setEditando] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const carregar = useCallback(async (uid: string, m: string) => {
    const ini = `${m}-01`
    const fim = `${m}-31`
    const [orc, desp] = await Promise.all([
      supabase.from('orcamento_pessoal').select('categoria,limite').eq('user_id', uid).eq('mes', m),
      supabase.from('despesas_pessoais').select('categoria,valor').eq('user_id', uid).gte('data_despesa', ini).lte('data_despesa', fim),
    ])
    const limites = new Map<string, number>()
    for (const o of orc.data ?? []) limites.set(o.categoria, Number(o.limite))
    const gastos = new Map<string, number>()
    for (const d of desp.data ?? []) gastos.set(d.categoria, (gastos.get(d.categoria) ?? 0) + Number(d.valor))

    const all = new Set([...CATEGORIAS, ...Array.from(gastos.keys())])
    setLines(Array.from(all).map(cat => ({ categoria: cat, limite: limites.get(cat) ?? 0, gasto: gastos.get(cat) ?? 0 })))
    const init: Record<string, string> = {}
    limites.forEach((lim, cat) => { init[cat] = String(lim) })
    setEditando(init)
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) { setUserId(user.id); carregar(user.id, mes) }
    })
  }, [carregar])

  async function salvarLimites() {
    setSaving(true)
    const rows = Object.entries(editando).filter(([, v]) => Number(v) > 0).map(([categoria, limite]) => ({ user_id: userId, mes, categoria, limite: Number(limite) }))
    const { error } = await supabase.from('orcamento_pessoal').upsert(rows, { onConflict: 'user_id,mes,categoria' })
    setSaving(false)
    if (error) return toast.error(error.message)
    toast.success('Orçamento salvo')
    carregar(userId, mes)
  }

  const totalLimite = lines.reduce((s, l) => s + l.limite, 0)
  const totalGasto = lines.reduce((s, l) => s + l.gasto, 0)
  const extrapoladas = lines.filter(l => l.limite > 0 && l.gasto > l.limite).length

  return (
    <>
      <div className="page-hdr">
        <div>
          <div className="page-title">Orçamento Mensal</div>
          <div className="page-sub">Defina limites por categoria e acompanhe em tempo real</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="month" value={mes} onChange={e => { setMes(e.target.value); carregar(userId, e.target.value) }} className="form-input" style={{ width: 'auto', padding: '6px 10px', fontSize: 12 }} />
          <button onClick={salvarLimites} className="btn-action" disabled={saving}>{saving ? 'Salvando...' : 'Salvar limites'}</button>
        </div>
      </div>

      <div className="kpis" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <div className="kpi"><div className="kpi-lbl">Total orçado</div><div className="kpi-val">{formatBRL(totalLimite)}</div></div>
        <div className="kpi"><div className="kpi-lbl">Total gasto</div><div className="kpi-val" style={{ color: totalGasto > totalLimite ? 'var(--red)' : 'var(--navy)' }}>{formatBRL(totalGasto)}</div></div>
        <div className="kpi"><div className="kpi-lbl">Disponível</div><div className="kpi-val" style={{ color: 'var(--teal)' }}>{formatBRL(Math.max(0, totalLimite - totalGasto))}</div></div>
        <div className="kpi"><div className="kpi-lbl">Extrapoladas</div><div className="kpi-val" style={{ color: extrapoladas > 0 ? 'var(--red)' : 'var(--teal)' }}>{extrapoladas}</div><div className={`kpi-delta ${extrapoladas > 0 ? 'dn' : 'up'}`}>{extrapoladas > 0 ? 'categorias no limite' : 'tudo ok'}</div></div>
      </div>

      <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {lines.map(l => {
            const pct = l.limite > 0 ? Math.min(100, (l.gasto / l.limite) * 100) : 0
            const over = l.limite > 0 && l.gasto > l.limite
            const semLimite = l.limite === 0
            return (
              <div key={l.categoria}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--navy)' }}>{l.categoria}</div>
                  <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>
                    Gasto: <span style={{ fontWeight: 700, color: over ? 'var(--red)' : 'var(--navy)' }}>{formatBRL(l.gasto)}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>Limite:</span>
                    <input
                      type="number"
                      value={editando[l.categoria] ?? ''}
                      onChange={e => setEditando(prev => ({ ...prev, [l.categoria]: e.target.value }))}
                      placeholder="0"
                      className="form-input"
                      style={{ width: 90, padding: '4px 8px', fontSize: 12 }}
                    />
                  </div>
                  {!semLimite && <span style={{ fontSize: 11, fontWeight: 700, color: over ? 'var(--red)' : pct > 80 ? 'var(--gold)' : 'var(--teal)', minWidth: 36, textAlign: 'right' }}>{pct.toFixed(0)}%</span>}
                </div>
                {!semLimite && (
                  <div style={{ height: 8, borderRadius: 4, background: 'var(--gray-100)' }}>
                    <div style={{ height: '100%', borderRadius: 4, background: over ? 'var(--red)' : pct > 80 ? 'var(--gold)' : 'var(--teal)', width: `${pct}%`, transition: 'width .3s' }} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
