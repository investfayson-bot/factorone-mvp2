'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'
import toast from 'react-hot-toast'

type ExtratoRow = {
  id: string
  descricao: string
  contraparte_nome?: string | null
  categoria?: string | null
  tipo: 'credito' | 'debito'
  valor: number | string
  saldo_apos?: number | string | null
  data_transacao: string
  conciliado?: boolean
}

export default function ExtratoCompletoPage() {
  const [rows, setRows] = useState<ExtratoRow[]>([])
  const [tipo, setTipo] = useState('todos')
  const [busca, setBusca] = useState('')
  const [periodo, setPeriodo] = useState('30')
  const [categorizando, setCategorizando] = useState(false)

  async function categorizarComIA() {
    setCategorizando(true)
    try {
      const { data: sess } = await supabase.auth.getSession()
      const token = sess.session?.access_token
      const res = await fetch('/api/conta-pj/categorizar-extrato', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Falha ao categorizar')
      toast.success(d.categorizadas > 0 ? `${d.categorizadas} transação(ões) categorizada(s) com IA` : (d.mensagem || 'Nada a categorizar'))
      await carregar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao categorizar')
    } finally { setCategorizando(false) }
  }

  const carregar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const empresaId = (u?.empresa_id as string) || user.id
    const start = new Date(); start.setDate(start.getDate() - Number(periodo))
    let q = supabase.from('extrato_bancario').select('*').eq('empresa_id', empresaId).gte('data_transacao', start.toISOString()).order('data_transacao', { ascending: false })
    if (tipo !== 'todos') q = q.eq('tipo', tipo)
    const { data } = await q
    setRows(data || [])
  }, [periodo, tipo])

  useEffect(() => { void carregar() }, [carregar])

  const filtered = rows.filter(r => `${r.descricao || ''} ${r.contraparte_nome || ''}`.toLowerCase().includes(busca.toLowerCase()))
  const totais = useMemo(() => ({
    c: filtered.filter(r => r.tipo === 'credito').reduce((s, r) => s + Number(r.valor || 0), 0),
    d: filtered.filter(r => r.tipo === 'debito').reduce((s, r) => s + Number(r.valor || 0), 0),
  }), [filtered])

  return (
    <>
      <div className="page-hdr">
        <div>
          <div className="page-title">Extrato Bancário</div>
          <div className="page-sub">Banco PJ · histórico de movimentações</div>
        </div>
        <button className="btn-action btn-ghost" style={{ fontSize: 12 }} onClick={() => void categorizarComIA()} disabled={categorizando} title="Classifica automaticamente as transações sem categoria">
          <i className="fa-solid fa-wand-magic-sparkles" style={{ marginRight: 6, color: '#7A6A9E' }} />{categorizando ? 'Categorizando…' : 'Categorizar com IA'}
        </button>
      </div>

      {/* Totais */}
      <div className="kpis" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 14 }}>
        <div className="kpi">
          <div className="kpi-lbl">Total créditos</div>
          <div className="kpi-val" style={{ color: 'var(--green)' }}>{formatBRL(totais.c)}</div>
          <div className="kpi-delta up">entradas no período</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Total débitos</div>
          <div className="kpi-val" style={{ color: 'var(--red)' }}>{formatBRL(totais.d)}</div>
          <div className="kpi-delta dn">saídas no período</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Saldo período</div>
          <div className="kpi-val" style={{ color: totais.c - totais.d >= 0 ? 'var(--navy)' : 'var(--red)' }}>{formatBRL(totais.c - totais.d)}</div>
          <div className={`kpi-delta ${totais.c - totais.d >= 0 ? 'up' : 'dn'}`}>{totais.c - totais.d >= 0 ? '↑ positivo' : '↓ negativo'}</div>
        </div>
      </div>

      {/* Filtros + tabela */}
      <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--gray-100)', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--gray-400)', letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: "var(--font-sans)", flex: 1 }}>
            Lançamentos ({filtered.length})
          </div>
          <select className="form-input" style={{ width: 'auto', padding: '5px 10px', fontSize: 11 }} value={periodo} onChange={e => setPeriodo(e.target.value)}>
            <option value="1">Hoje</option>
            <option value="7">7 dias</option>
            <option value="15">15 dias</option>
            <option value="30">30 dias</option>
          </select>
          <select className="form-input" style={{ width: 'auto', padding: '5px 10px', fontSize: 11 }} value={tipo} onChange={e => setTipo(e.target.value)}>
            <option value="todos">Todos</option>
            <option value="credito">Crédito</option>
            <option value="debito">Débito</option>
          </select>
          <input className="form-input" style={{ width: 180, padding: '5px 10px', fontSize: 11 }} placeholder="Buscar..." value={busca} onChange={e => setBusca(e.target.value)} />
        </div>

        <div className="expenses-table">
          <table>
            <thead>
              <tr>
                <th>Data / Hora</th>
                <th>Descrição</th>
                <th>Contraparte</th>
                <th>Categoria</th>
                <th style={{ textAlign: 'right' }}>Valor</th>
                <th style={{ textAlign: 'right' }}>Saldo após</th>
                <th style={{ textAlign: 'center' }}>Conciliado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '32px 0' }}>Nenhuma movimentação no período.</td></tr>
              ) : filtered.map(r => (
                <tr key={r.id}>
                  <td style={{ fontFamily: "var(--font-sans)", fontSize: 11 }}>{new Date(r.data_transacao).toLocaleString('pt-BR')}</td>
                  <td style={{ fontWeight: 600 }}>{r.descricao}</td>
                  <td style={{ color: 'var(--gray-500)' }}>{r.contraparte_nome || '—'}</td>
                  <td>{r.categoria ? <span style={{ fontSize: 10.5, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: '#F1ECE1', color: '#3C4A46' }}>{r.categoria}</span> : <span style={{ color: '#C4CFCE' }}>—</span>}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: "var(--font-sans)", color: r.tipo === 'credito' ? 'var(--green)' : 'var(--red)' }}>
                    {r.tipo === 'credito' ? '+' : '-'}{formatBRL(Number(r.valor || 0))}
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: "var(--font-sans)" }}>{formatBRL(Number(r.saldo_apos || 0))}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`tag ${r.conciliado ? 'green' : 'gray'}`}>{r.conciliado ? 'Sim' : 'Não'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
