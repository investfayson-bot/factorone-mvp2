'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'
import toast from 'react-hot-toast'

type Investimento = { id: string; nome: string; tipo: string; instituicao: string | null; valor_aplicado: number; valor_atual: number; data_aplicacao: string; vencimento: string | null; rentabilidade: string | null; liquidez: string }

const TIPOS = ['CDB','Poupança','Ações','FIIs','Tesouro Direto','Cripto','Outros']
const LIQUIDEZ = ['diária','no vencimento','longo prazo']
const TIPO_ICON: Record<string, string> = { 'CDB': '🏦', 'Poupança': '💰', 'Ações': '📈', 'FIIs': '🏢', 'Tesouro Direto': '🇧🇷', 'Cripto': '₿', 'Outros': '💼' }
const EMPTY = { nome: '', tipo: 'CDB', instituicao: '', valor_aplicado: '', valor_atual: '', data_aplicacao: new Date().toISOString().slice(0,10), vencimento: '', rentabilidade: '', liquidez: 'diária' }

export default function InvestimentosPage() {
  const [items, setItems] = useState<Investimento[]>([])
  const [userId, setUserId] = useState('')
  const [form, setForm] = useState(EMPTY)
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) { setUserId(user.id); carregar(user.id) }
    })
  }, [])

  async function carregar(uid: string) {
    const { data } = await supabase.from('investimentos_pf').select('*').eq('user_id', uid).order('tipo').order('valor_atual', { ascending: false })
    setItems((data ?? []) as Investimento[])
  }

  async function salvar() {
    if (!form.nome || !form.valor_aplicado) return toast.error('Preencha nome e valor aplicado')
    setSaving(true)
    const payload = { user_id: userId, nome: form.nome, tipo: form.tipo, instituicao: form.instituicao || null, valor_aplicado: Number(form.valor_aplicado), valor_atual: Number(form.valor_atual) || Number(form.valor_aplicado), data_aplicacao: form.data_aplicacao, vencimento: form.vencimento || null, rentabilidade: form.rentabilidade || null, liquidez: form.liquidez }
    const { error } = editId
      ? await supabase.from('investimentos_pf').update(payload).eq('id', editId)
      : await supabase.from('investimentos_pf').insert(payload)
    setSaving(false)
    if (error) return toast.error(error.message)
    toast.success(editId ? 'Atualizado' : 'Investimento adicionado')
    setForm(EMPTY)
    setEditId(null)
    setModal(false)
    carregar(userId)
  }

  function editar(inv: Investimento) {
    setForm({ nome: inv.nome, tipo: inv.tipo, instituicao: inv.instituicao ?? '', valor_aplicado: String(inv.valor_aplicado), valor_atual: String(inv.valor_atual), data_aplicacao: inv.data_aplicacao, vencimento: inv.vencimento ?? '', rentabilidade: inv.rentabilidade ?? '', liquidez: inv.liquidez })
    setEditId(inv.id)
    setModal(true)
  }

  async function excluir(id: string) {
    await supabase.from('investimentos_pf').delete().eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
    toast.success('Removido')
  }

  const totalAplicado = items.reduce((s, i) => s + Number(i.valor_aplicado), 0)
  const totalAtual = items.reduce((s, i) => s + Number(i.valor_atual), 0)
  const rendimento = totalAtual - totalAplicado
  const rendimentoPct = totalAplicado > 0 ? (rendimento / totalAplicado) * 100 : 0

  // Agrupar por tipo
  const porTipo = TIPOS.map(tipo => {
    const grupo = items.filter(i => i.tipo === tipo)
    if (grupo.length === 0) return null
    return { tipo, items: grupo, total: grupo.reduce((s, i) => s + Number(i.valor_atual), 0) }
  }).filter(Boolean) as { tipo: string; items: Investimento[]; total: number }[]

  return (
    <>
      <div className="page-hdr">
        <div>
          <div className="page-title">Investimentos</div>
          <div className="page-sub">Carteira completa — renda fixa, variável e cripto</div>
        </div>
        <button onClick={() => { setForm(EMPTY); setEditId(null); setModal(true) }} className="btn-action">+ Novo investimento</button>
      </div>

      <div className="kpis" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <div className="kpi">
          <div className="kpi-lbl">Patrimônio total</div>
          <div className="kpi-val" style={{ color: 'var(--teal)' }}>{formatBRL(totalAtual)}</div>
          <div className="kpi-delta up">{items.length} ativos</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Total aplicado</div>
          <div className="kpi-val">{formatBRL(totalAplicado)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Rendimento</div>
          <div className="kpi-val" style={{ color: rendimento >= 0 ? 'var(--teal)' : 'var(--red)' }}>{rendimento >= 0 ? '+' : ''}{formatBRL(rendimento)}</div>
          <div className={`kpi-delta ${rendimento >= 0 ? 'up' : 'dn'}`}>{rendimentoPct >= 0 ? '+' : ''}{rendimentoPct.toFixed(2)}%</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Classes</div>
          <div className="kpi-val">{porTipo.length}</div>
          <div className="kpi-delta">diversificação</div>
        </div>
      </div>

      {/* Distribuição */}
      {porTipo.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)', marginBottom: 14 }}>Distribuição da carteira</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {porTipo.sort((a, b) => b.total - a.total).map(({ tipo, total }) => {
              const pct = totalAtual > 0 ? (total / totalAtual) * 100 : 0
              return (
                <div key={tipo}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600 }}>{TIPO_ICON[tipo]} {tipo}</span>
                    <span style={{ color: 'var(--gray-400)' }}>{formatBRL(total)} · {pct.toFixed(1)}%</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 4, background: 'var(--gray-100)' }}>
                    <div style={{ height: '100%', borderRadius: 4, background: 'var(--teal)', width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Lista por tipo */}
      {porTipo.length === 0 ? (
        <div style={{ background: '#fff', border: '2px dashed var(--gray-100)', borderRadius: 16, padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📈</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--navy)', marginBottom: 8 }}>Nenhum investimento cadastrado</div>
          <button onClick={() => setModal(true)} className="btn-action">Adicionar primeiro investimento</button>
        </div>
      ) : (
        porTipo.map(({ tipo, items: grupo }) => (
          <div key={tipo} style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
            <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--gray-100)', fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>
              {TIPO_ICON[tipo]} {tipo}
            </div>
            <table className="expenses-table">
              <thead><tr><th>Nome</th><th>Instituição</th><th>Rentabilidade</th><th>Liquidez</th><th>Aplicado</th><th>Atual</th><th>Ganho</th><th></th></tr></thead>
              <tbody>
                {grupo.map(inv => {
                  const ganho = Number(inv.valor_atual) - Number(inv.valor_aplicado)
                  const ganhoPct = Number(inv.valor_aplicado) > 0 ? (ganho / Number(inv.valor_aplicado)) * 100 : 0
                  return (
                    <tr key={inv.id}>
                      <td style={{ fontWeight: 600 }}>{inv.nome}</td>
                      <td style={{ color: 'var(--gray-400)', fontSize: 11 }}>{inv.instituicao || '—'}</td>
                      <td style={{ fontSize: 11 }}>{inv.rentabilidade || '—'}</td>
                      <td><span className="tag gray" style={{ fontSize: 9 }}>{inv.liquidez}</span></td>
                      <td style={{ fontFamily: "'DM Mono',monospace" }}>{formatBRL(Number(inv.valor_aplicado))}</td>
                      <td style={{ fontFamily: "'DM Mono',monospace", fontWeight: 700 }}>{formatBRL(Number(inv.valor_atual))}</td>
                      <td style={{ fontFamily: "'DM Mono',monospace", color: ganho >= 0 ? 'var(--teal)' : 'var(--red)', fontSize: 11 }}>
                        {ganho >= 0 ? '+' : ''}{formatBRL(ganho)} ({ganhoPct >= 0 ? '+' : ''}{ganhoPct.toFixed(1)}%)
                      </td>
                      <td style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => editar(inv)} className="btn-ghost" style={{ fontSize: 10, padding: '3px 7px' }}>✎</button>
                        <button onClick={() => excluir(inv.id)} className="btn-ghost" style={{ fontSize: 10, padding: '3px 7px', color: 'var(--red)' }}>✕</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ))
      )}

      {modal && (
        <div className="modal-bg" onClick={() => setModal(false)}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: 460, maxWidth: '95vw' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--navy)', marginBottom: 16 }}>{editId ? 'Editar' : 'Novo'} investimento</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input className="form-input" placeholder="Nome (ex: CDB Nubank 110%)" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} style={{ gridColumn: '1/-1' }} />
                <select className="form-input" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                  {TIPOS.map(t => <option key={t}>{t}</option>)}
                </select>
                <input className="form-input" placeholder="Instituição" value={form.instituicao} onChange={e => setForm(f => ({ ...f, instituicao: e.target.value }))} />
                <input className="form-input" placeholder="Valor aplicado (R$)" type="number" value={form.valor_aplicado} onChange={e => setForm(f => ({ ...f, valor_aplicado: e.target.value }))} />
                <input className="form-input" placeholder="Valor atual (R$)" type="number" value={form.valor_atual} onChange={e => setForm(f => ({ ...f, valor_atual: e.target.value }))} />
                <input className="form-input" placeholder="Rentabilidade (ex: 110% CDI)" value={form.rentabilidade} onChange={e => setForm(f => ({ ...f, rentabilidade: e.target.value }))} />
                <select className="form-input" value={form.liquidez} onChange={e => setForm(f => ({ ...f, liquidez: e.target.value }))}>
                  {LIQUIDEZ.map(l => <option key={l}>{l}</option>)}
                </select>
                <input className="form-input" type="date" value={form.data_aplicacao} onChange={e => setForm(f => ({ ...f, data_aplicacao: e.target.value }))} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <label style={{ fontSize: 10, color: 'var(--gray-400)' }}>Vencimento (opcional)</label>
                  <input className="form-input" type="date" value={form.vencimento} onChange={e => setForm(f => ({ ...f, vencimento: e.target.value }))} />
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(false)} className="btn-ghost">Cancelar</button>
              <button onClick={salvar} className="btn-action" disabled={saving}>{saving ? 'Salvando...' : editId ? 'Atualizar' : 'Adicionar'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
