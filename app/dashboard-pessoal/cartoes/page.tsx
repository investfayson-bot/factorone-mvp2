'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'
import toast from 'react-hot-toast'

type Cartao = { id: string; nome: string; bandeira: string; limite: number; dia_fechamento: number; dia_vencimento: number; cor: string }
type Gasto = { id: string; descricao: string; valor: number; categoria: string; data_despesa: string; parcela_atual: number | null; total_parcelas: number | null }

const BANDEIRAS = ['Visa','Mastercard','Elo','American Express','Hipercard']
const CORES = ['#1B2E4B','#0F766E','#7A6A9E','#DC2626','#B08A3E','#0369A1']
const EMPTY = { nome: '', bandeira: 'Visa', limite: '', dia_fechamento: '1', dia_vencimento: '10', cor: '#1B2E4B' }

export default function CartoesPage() {
  const [cartoes, setCartoes] = useState<Cartao[]>([])
  const [selecionado, setSelecionado] = useState<string | null>(null)
  const [gastos, setGastos] = useState<Gasto[]>([])
  const [userId, setUserId] = useState('')
  const [form, setForm] = useState(EMPTY)
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7))

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) { setUserId(user.id); carregarCartoes(user.id) }
    })
  }, [])

  async function carregarCartoes(uid: string) {
    const { data } = await supabase.from('cartoes_pessoais').select('*').eq('user_id', uid).order('created_at', { ascending: true })
    setCartoes((data ?? []) as Cartao[])
    if (data && data.length > 0 && !selecionado) { setSelecionado(data[0].id); carregarGastos(uid, data[0].id, mes) }
  }

  async function carregarGastos(uid: string, cartaoId: string, m: string) {
    const { data } = await supabase.from('despesas_pessoais').select('id,descricao,valor,categoria,data_despesa,parcela_atual,total_parcelas').eq('user_id', uid).eq('cartao_id', cartaoId).gte('data_despesa', `${m}-01`).lte('data_despesa', `${m}-31`).order('data_despesa', { ascending: false })
    setGastos((data ?? []) as Gasto[])
  }

  function selecionarCartao(id: string) {
    setSelecionado(id)
    carregarGastos(userId, id, mes)
  }

  async function salvar() {
    if (!form.nome) return toast.error('Preencha o nome do cartão')
    setSaving(true)
    const { error } = await supabase.from('cartoes_pessoais').insert({ user_id: userId, nome: form.nome, bandeira: form.bandeira, limite: Number(form.limite) || 0, dia_fechamento: parseInt(form.dia_fechamento), dia_vencimento: parseInt(form.dia_vencimento), cor: form.cor })
    setSaving(false)
    if (error) return toast.error(error.message)
    toast.success('Cartão adicionado')
    setForm(EMPTY)
    setModal(false)
    carregarCartoes(userId)
  }

  async function excluirCartao(id: string) {
    await supabase.from('cartoes_pessoais').delete().eq('id', id)
    setCartoes(prev => prev.filter(c => c.id !== id))
    if (selecionado === id) { setSelecionado(null); setGastos([]) }
    toast.success('Cartão removido')
  }

  const cartaoAtual = cartoes.find(c => c.id === selecionado)
  const totalFatura = gastos.reduce((s, g) => s + Number(g.valor), 0)
  const limiteUsadoPct = cartaoAtual && cartaoAtual.limite > 0 ? Math.min(100, (totalFatura / cartaoAtual.limite) * 100) : 0

  return (
    <>
      <div className="page-hdr">
        <div>
          <div className="page-title">Cartões</div>
          <div className="page-sub">Faturas, limites e gastos por cartão</div>
        </div>
        <button onClick={() => setModal(true)} className="btn-action">+ Novo cartão</button>
      </div>

      {cartoes.length === 0 ? (
        <div style={{ background: '#fff', border: '2px dashed var(--gray-100)', borderRadius: 16, padding: 48, textAlign: 'center' }}>
          <i className="fa-solid fa-credit-card" style={{ fontSize: 32, color: "var(--gray-300)", marginBottom: 12, display: "block" }} />
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--navy)', marginBottom: 8 }}>Nenhum cartão cadastrado</div>
          <button onClick={() => setModal(true)} className="btn-action">Adicionar cartão</button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
          {cartoes.map(c => (
            <div
              key={c.id}
              onClick={() => selecionarCartao(c.id)}
              style={{ width: 220, height: 130, borderRadius: 16, background: c.cor, padding: 16, cursor: 'pointer', border: `3px solid ${selecionado === c.id ? '#fff' : 'transparent'}`, boxShadow: selecionado === c.id ? `0 0 0 2px ${c.cor}` : '0 2px 8px rgba(0,0,0,.15)', transition: 'all .2s', position: 'relative' }}
            >
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.7)', marginBottom: 8 }}>{c.bandeira}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{c.nome}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.7)' }}>Limite: {c.limite > 0 ? formatBRL(c.limite) : 'sem limite'}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,.6)', marginTop: 4 }}>Fecha dia {c.dia_fechamento} · Vence dia {c.dia_vencimento}</div>
              <button onClick={e => { e.stopPropagation(); excluirCartao(c.id) }} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(255,255,255,.2)', border: 'none', borderRadius: 4, color: '#fff', fontSize: 10, cursor: 'pointer', padding: '2px 6px' }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {cartaoAtual && (
        <>
          <div className="kpis" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
            <div className="kpi"><div className="kpi-lbl">Fatura do mês</div><div className="kpi-val" style={{ color: 'var(--red)' }}>{formatBRL(totalFatura)}</div></div>
            <div className="kpi"><div className="kpi-lbl">Limite disponível</div><div className="kpi-val" style={{ color: 'var(--teal)' }}>{cartaoAtual.limite > 0 ? formatBRL(cartaoAtual.limite - totalFatura) : '—'}</div></div>
            <div className="kpi"><div className="kpi-lbl">Uso do limite</div><div className="kpi-val">{cartaoAtual.limite > 0 ? `${limiteUsadoPct.toFixed(0)}%` : '—'}</div></div>
            <div className="kpi"><div className="kpi-lbl">Lançamentos</div><div className="kpi-val">{gastos.length}</div></div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>Lançamentos — {cartaoAtual.nome}</div>
            <input type="month" value={mes} onChange={e => { setMes(e.target.value); carregarGastos(userId, selecionado!, e.target.value) }} className="form-input" style={{ width: 'auto', padding: '5px 10px', fontSize: 12 }} />
          </div>

          <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, overflow: 'hidden' }}>
            <table className="expenses-table">
              <thead><tr><th>Descrição</th><th>Categoria</th><th>Data</th><th>Parcela</th><th>Valor</th></tr></thead>
              <tbody>
                {gastos.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 24 }}>Nenhum gasto neste cartão no período</td></tr>}
                {gastos.map(g => (
                  <tr key={g.id}>
                    <td style={{ fontWeight: 600 }}>{g.descricao}</td>
                    <td><span className="tag gray">{g.categoria}</span></td>
                    <td style={{ color: 'var(--gray-400)' }}>{g.data_despesa?.split('-').reverse().join('/')}</td>
                    <td style={{ color: 'var(--gray-400)', fontSize: 11 }}>{g.parcela_atual ? `${g.parcela_atual}/${g.total_parcelas}x` : '—'}</td>
                    <td style={{ fontFamily: "var(--font-sans)", fontWeight: 700 }}>{formatBRL(Number(g.valor))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {modal && (
        <div className="modal-bg" onClick={() => setModal(false)}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: 400, maxWidth: '95vw' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--navy)', marginBottom: 16 }}>Novo cartão</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input className="form-input" placeholder="Nome (ex: Nubank, Inter)" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <select className="form-input" value={form.bandeira} onChange={e => setForm(f => ({ ...f, bandeira: e.target.value }))}>
                  {BANDEIRAS.map(b => <option key={b}>{b}</option>)}
                </select>
                <input className="form-input" placeholder="Limite (R$)" type="number" value={form.limite} onChange={e => setForm(f => ({ ...f, limite: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input className="form-input" placeholder="Dia fechamento" type="number" min="1" max="31" value={form.dia_fechamento} onChange={e => setForm(f => ({ ...f, dia_fechamento: e.target.value }))} />
                <input className="form-input" placeholder="Dia vencimento" type="number" min="1" max="31" value={form.dia_vencimento} onChange={e => setForm(f => ({ ...f, dia_vencimento: e.target.value }))} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--gray-400)', marginBottom: 6 }}>Cor do cartão</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {CORES.map(c => (
                    <div key={c} onClick={() => setForm(f => ({ ...f, cor: c }))} style={{ width: 28, height: 28, borderRadius: 6, background: c, cursor: 'pointer', border: `3px solid ${form.cor === c ? '#000' : 'transparent'}` }} />
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(false)} className="btn-ghost">Cancelar</button>
              <button onClick={salvar} className="btn-action" disabled={saving}>{saving ? 'Salvando...' : 'Adicionar'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
