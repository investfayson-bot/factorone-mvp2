'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'

type Receita = {
  id: string
  empresa_id: string
  descricao: string
  categoria: string
  valor: number
  data: string
  tipo: 'recorrente' | 'pontual' | 'projeto'
  cliente: string | null
  centro_custo: string | null
  nota_fiscal: string | null
  status: 'confirmada' | 'prevista' | 'cancelada'
  created_at: string
}

const CATEGORIAS = ['Produto', 'Serviço', 'Consultoria', 'Projeto', 'Assinatura', 'Comissão', 'Aluguel', 'Royalties', 'Outros']
const TIPOS = { recorrente: 'Recorrente', pontual: 'Pontual', projeto: 'Projeto' }
const STATUS_COLOR: Record<string, string> = { confirmada: 'green', prevista: 'gray', cancelada: 'red' }

function mesLabel(m: string) {
  const [y, mo] = m.split('-')
  return new Date(Number(y), Number(mo) - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

export default function ReceitasPage() {
  const [empresaId, setEmpresaId] = useState('')
  const [receitas, setReceitas] = useState<Receita[]>([])
  const [loading, setLoading] = useState(true)
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7))
  const [fCategoria, setFCategoria] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [fCliente, setFCliente] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<Receita | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    descricao: '', categoria: 'Serviço', valor: '', data: new Date().toISOString().slice(0, 10),
    tipo: 'pontual', cliente: '', centro_custo: '', nota_fiscal: '', status: 'confirmada',
  })

  const carregar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const u = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const eid = (u.data?.empresa_id as string) || user.id
    setEmpresaId(eid)
    const ini = `${mes}-01`
    const fim = new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0).toISOString().slice(0, 10)
    const { data } = await supabase.from('receitas_pj').select('*').eq('empresa_id', eid).gte('data', ini).lte('data', fim).order('data', { ascending: false })
    setReceitas((data || []) as Receita[])
    setLoading(false)
  }, [mes])

  useEffect(() => { void carregar() }, [carregar])

  function abrirForm(r?: Receita) {
    if (r) {
      setEditItem(r)
      setForm({ descricao: r.descricao, categoria: r.categoria, valor: String(r.valor), data: r.data, tipo: r.tipo, cliente: r.cliente || '', centro_custo: r.centro_custo || '', nota_fiscal: r.nota_fiscal || '', status: r.status })
    } else {
      setEditItem(null)
      setForm({ descricao: '', categoria: 'Serviço', valor: '', data: new Date().toISOString().slice(0, 10), tipo: 'pontual', cliente: '', centro_custo: '', nota_fiscal: '', status: 'confirmada' })
    }
    setShowForm(true)
  }

  async function salvar() {
    if (!form.descricao || !form.valor || !form.data) return
    setSaving(true)
    const payload = {
      empresa_id: empresaId,
      descricao: form.descricao, categoria: form.categoria,
      valor: parseFloat(form.valor), data: form.data,
      tipo: form.tipo, cliente: form.cliente || null,
      centro_custo: form.centro_custo || null,
      nota_fiscal: form.nota_fiscal || null,
      status: form.status,
    }
    if (editItem) {
      await supabase.from('receitas_pj').update(payload).eq('id', editItem.id)
    } else {
      await supabase.from('receitas_pj').insert(payload)
    }
    setSaving(false)
    setShowForm(false)
    void carregar()
  }

  async function excluir(id: string) {
    if (!confirm('Excluir esta receita?')) return
    await supabase.from('receitas_pj').delete().eq('id', id)
    void carregar()
  }

  async function alterarStatus(id: string, status: string) {
    await supabase.from('receitas_pj').update({ status }).eq('id', id)
    void carregar()
  }

  const filtradas = useMemo(() => receitas.filter(r =>
    (!fCategoria || r.categoria === fCategoria) &&
    (!fStatus || r.status === fStatus) &&
    (!fCliente || (r.cliente || '').toLowerCase().includes(fCliente.toLowerCase()))
  ), [receitas, fCategoria, fStatus, fCliente])

  const totalConfirmado = filtradas.filter(r => r.status === 'confirmada').reduce((s, r) => s + Number(r.valor), 0)
  const totalPrevisto = filtradas.filter(r => r.status === 'prevista').reduce((s, r) => s + Number(r.valor), 0)
  const totalMes = filtradas.reduce((s, r) => s + (r.status !== 'cancelada' ? Number(r.valor) : 0), 0)

  const porCategoria = useMemo(() => {
    const acc: Record<string, number> = {}
    filtradas.filter(r => r.status !== 'cancelada').forEach(r => { acc[r.categoria] = (acc[r.categoria] || 0) + Number(r.valor) })
    return Object.entries(acc).sort((a, b) => b[1] - a[1])
  }, [filtradas])

  const mesesNav = useMemo(() => {
    const arr = []
    for (let i = -3; i <= 2; i++) {
      const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + i)
      arr.push(d.toISOString().slice(0, 7))
    }
    return arr
  }, [])

  if (loading) return <div style={{ padding: 32, color: 'var(--gray-400)' }}>Carregando…</div>

  return (
    <>
      <div className="page-hdr">
        <div>
          <div className="page-title">Receitas</div>
          <div className="page-sub">{mesLabel(mes)} · entradas confirmadas e previstas</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-ghost" onClick={() => abrirForm()}>+ Nova receita</button>
        </div>
      </div>

      {/* Navegação meses */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {mesesNav.map(m => (
          <button key={m} onClick={() => setMes(m)} style={{
            padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1px solid',
            background: mes === m ? 'var(--navy)' : '#fff', color: mes === m ? '#fff' : 'var(--gray-500)',
            borderColor: mes === m ? 'var(--navy)' : 'var(--gray-100)',
          }}>{m.slice(0, 7)}</button>
        ))}
      </div>

      {/* KPIs */}
      <div className="kpis" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 16 }}>
        <div className="kpi">
          <div className="kpi-lbl">Total do mês</div>
          <div className="kpi-val" style={{ color: 'var(--green)' }}>{formatBRL(totalMes)}</div>
          <div className="kpi-delta up">{filtradas.filter(r => r.status !== 'cancelada').length} lançamentos</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Confirmadas</div>
          <div className="kpi-val">{formatBRL(totalConfirmado)}</div>
          <div className="kpi-delta up">{filtradas.filter(r => r.status === 'confirmada').length} receitas</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Previstas</div>
          <div className="kpi-val" style={{ color: 'var(--gold)' }}>{formatBRL(totalPrevisto)}</div>
          <div className="kpi-delta">{filtradas.filter(r => r.status === 'prevista').length} pendentes</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Categorias</div>
          <div className="kpi-val">{porCategoria.length}</div>
          <div className="kpi-delta">{porCategoria[0]?.[0] || '—'}</div>
        </div>
      </div>

      {/* Por categoria */}
      {porCategoria.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', marginBottom: 10 }}>Por categoria</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {porCategoria.map(([cat, val]) => (
              <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: 12, width: 120, color: 'var(--gray-500)' }}>{cat}</div>
                <div style={{ flex: 1, height: 6, background: 'var(--gray-100)', borderRadius: 3 }}>
                  <div style={{ height: 6, borderRadius: 3, width: `${Math.min((val / totalMes) * 100, 100)}%`, background: 'var(--green)', transition: 'width .3s' }} />
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, fontFamily: "'DM Mono',monospace", minWidth: 90, textAlign: 'right' }}>{formatBRL(val)}</div>
                <div style={{ fontSize: 11, color: 'var(--gray-400)', minWidth: 36, textAlign: 'right' }}>{totalMes > 0 ? ((val / totalMes) * 100).toFixed(0) : 0}%</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 8 }}>
        <select className="form-input" value={fCategoria} onChange={e => setFCategoria(e.target.value)}>
          <option value="">Todas as categorias</option>
          {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="form-input" value={fStatus} onChange={e => setFStatus(e.target.value)}>
          <option value="">Todos os status</option>
          <option value="confirmada">Confirmada</option>
          <option value="prevista">Prevista</option>
          <option value="cancelada">Cancelada</option>
        </select>
        <input className="form-input" placeholder="Buscar cliente…" value={fCliente} onChange={e => setFCliente(e.target.value)} />
      </div>

      {/* Tabela */}
      <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, overflow: 'hidden' }}>
        <div className="expenses-table">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Descrição</th>
                <th>Categoria</th>
                <th>Cliente</th>
                <th>Tipo</th>
                <th style={{ textAlign: 'right' }}>Valor</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'center' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '40px 0', fontSize: 13 }}>
                    Nenhuma receita em {mesLabel(mes)}.{' '}
                    <button onClick={() => abrirForm()} style={{ color: 'var(--teal)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}>
                      Adicionar →
                    </button>
                  </td>
                </tr>
              )}
              {filtradas.map(r => (
                <tr key={r.id} style={{ opacity: r.status === 'cancelada' ? 0.5 : 1 }}>
                  <td style={{ fontFamily: "'DM Mono',monospace", fontSize: 11 }}>
                    {new Date(r.data + 'T12:00:00').toLocaleDateString('pt-BR')}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 12 }}>{r.descricao}</div>
                    {r.nota_fiscal && <div style={{ fontSize: 10, color: 'var(--teal)' }}>NF: {r.nota_fiscal}</div>}
                  </td>
                  <td><span className="tag gray" style={{ fontSize: 9 }}>{r.categoria}</span></td>
                  <td style={{ fontSize: 12, color: 'var(--gray-500)' }}>{r.cliente || '—'}</td>
                  <td style={{ fontSize: 11, color: 'var(--gray-400)' }}>{TIPOS[r.tipo]}</td>
                  <td style={{ textAlign: 'right', fontFamily: "'DM Mono',monospace", color: 'var(--green)', fontWeight: 700, fontSize: 13 }}>
                    +{formatBRL(Number(r.valor))}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <select
                      value={r.status}
                      onChange={e => void alterarStatus(r.id, e.target.value)}
                      style={{
                        fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 20,
                        border: '1px solid',
                        background: r.status === 'confirmada' ? 'rgba(45,155,111,.1)' : r.status === 'prevista' ? 'var(--gray-100)' : 'rgba(239,68,68,.1)',
                        color: r.status === 'confirmada' ? 'var(--green)' : r.status === 'prevista' ? 'var(--gray-500)' : 'var(--red)',
                        borderColor: r.status === 'confirmada' ? 'rgba(45,155,111,.2)' : r.status === 'prevista' ? 'var(--gray-200)' : 'rgba(239,68,68,.2)',
                        cursor: 'pointer',
                      }}
                    >
                      <option value="confirmada">Confirmada</option>
                      <option value="prevista">Prevista</option>
                      <option value="cancelada">Cancelada</option>
                    </select>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
                      <button className="btn-ghost" style={{ padding: '3px 8px', fontSize: 10 }} onClick={() => abrirForm(r)}>Editar</button>
                      <button className="btn-ghost" style={{ padding: '3px 8px', fontSize: 10, color: 'var(--red)' }} onClick={() => void excluir(r.id)}>✕</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showForm && (
        <div className="modal-bg" onClick={() => setShowForm(false)}>
          <div className="modal-box" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">
              {editItem ? 'Editar receita' : 'Nova receita'}
              <button className="modal-close" onClick={() => setShowForm(false)}>×</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ fontSize: 11, color: 'var(--gray-400)' }}>Descrição *</label>
                <input className="form-input" placeholder="Ex: Consultoria cliente ABC" value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--gray-400)' }}>Valor R$ *</label>
                <input className="form-input" type="number" placeholder="0,00" value={form.valor} onChange={e => setForm(p => ({ ...p, valor: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--gray-400)' }}>Data *</label>
                <input className="form-input" type="date" value={form.data} onChange={e => setForm(p => ({ ...p, data: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--gray-400)' }}>Categoria</label>
                <select className="form-input" value={form.categoria} onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))}>
                  {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--gray-400)' }}>Tipo</label>
                <select className="form-input" value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))}>
                  <option value="pontual">Pontual</option>
                  <option value="recorrente">Recorrente</option>
                  <option value="projeto">Projeto</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--gray-400)' }}>Status</label>
                <select className="form-input" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                  <option value="confirmada">Confirmada</option>
                  <option value="prevista">Prevista</option>
                  <option value="cancelada">Cancelada</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--gray-400)' }}>Cliente</label>
                <input className="form-input" placeholder="Nome do cliente" value={form.cliente} onChange={e => setForm(p => ({ ...p, cliente: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--gray-400)' }}>Nota Fiscal nº</label>
                <input className="form-input" placeholder="Número da NF" value={form.nota_fiscal} onChange={e => setForm(p => ({ ...p, nota_fiscal: e.target.value }))} />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setShowForm(false)}>Cancelar</button>
              <button className="btn-action" disabled={saving} onClick={() => void salvar()}>{saving ? 'Salvando…' : editItem ? 'Salvar' : 'Adicionar'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
