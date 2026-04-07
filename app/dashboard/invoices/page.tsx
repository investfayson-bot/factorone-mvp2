'use client'
export const dynamic = 'force-dynamic'
import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<any[]>([])
  const [modal, setModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [empresaId, setEmpresaId] = useState('')
  const [form, setForm] = useState({ cliente_nome:'', valor:'', vencimento:'', descricao:'', status:'rascunho' })
  const sb = supabase

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return
    const { data: u } = await sb.from('usuarios').select('empresa_id').eq('id', user.id).single()
    if (!u) return
    setEmpresaId(u.empresa_id)
    const { data } = await sb.from('invoices').select('*').eq('empresa_id', u.empresa_id).order('created_at', { ascending:false })
    if (data) setInvoices(data)
  }

  async function salvar() {
    if (!form.cliente_nome || !form.valor) { toast.error('Preencha cliente e valor'); return }
    setLoading(true)
    const num = `INV-${Date.now().toString().slice(-4)}`
    await sb.from('invoices').insert({ ...form, numero: num, valor: parseFloat(form.valor), empresa_id: empresaId })
    toast.success('Invoice criada!')
    setModal(false)
    setForm({ cliente_nome:'', valor:'', vencimento:'', descricao:'', status:'rascunho' })
    load()
    setLoading(false)
  }

  async function atualizar(id: string, status: string) {
    await sb.from('invoices').update({ status }).eq('id', id)
    toast.success('Status atualizado!')
    load()
  }

  const fmt = (n: number) => 'R$' + n.toLocaleString('pt-BR', { minimumFractionDigits:2 })
  const statusColor: any = { rascunho:'#7A9290', enviada:'#3B8BFF', pendente:'#F59E0B', paga:'#22C97A', vencida:'#FF4F4F' }
  const S = {
    card: { background:'#111A19', border:'1px solid #233130', borderRadius:12, padding:16 } as any,
    btn: { padding:'8px 16px', borderRadius:8, border:'1px solid #2E3D3B', background:'transparent', color:'#E4E8E7', fontSize:12, cursor:'pointer' } as any,
    btnPrimary: { padding:'8px 16px', borderRadius:8, border:'none', background:'#C8F135', color:'#000', fontSize:12, fontWeight:700, cursor:'pointer' } as any,
    input: { width:'100%', background:'#182120', border:'1px solid #2E3D3B', borderRadius:7, padding:'9px 12px', color:'#E4E8E7', fontSize:13, outline:'none', boxSizing:'border-box' as any },
    label: { fontSize:10, color:'#7A9290', fontFamily:'monospace', textTransform:'uppercase' as any, letterSpacing:'.05em', display:'block', marginBottom:4 },
  }

  const totalAberto = invoices.filter(i=>['enviada','pendente'].includes(i.status)).reduce((a,i)=>a+i.valor,0)
  const totalPago = invoices.filter(i=>i.status==='paga').reduce((a,i)=>a+i.valor,0)

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:18, fontWeight:700, fontFamily:'Sora,sans-serif', margin:0 }}>Invoices & Billing</h1>
          <p style={{ fontSize:11, color:'#7A9290', fontFamily:'monospace', margin:0 }}>{invoices.length} documentos</p>
        </div>
        <button style={S.btnPrimary} onClick={() => setModal(true)}>+ Nova Invoice</button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:14 }}>
        {[
          { l:'A Receber', v:fmt(totalAberto), c:'#22C97A' },
          { l:'Recebido', v:fmt(totalPago), c:'#C8F135' },
          { l:'Vencidas', v:invoices.filter(i=>i.status==='vencida').length, c:'#FF4F4F' },
          { l:'Total emitido', v:fmt(invoices.reduce((a,i)=>a+i.valor,0)), c:'#E4E8E7' },
        ].map(({ l, v, c }) => (
          <div key={l} style={S.card}>
            <div style={{ fontSize:10, color:'#7A9290', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'.04em', marginBottom:4 }}>{l}</div>
            <div style={{ fontSize:22, fontWeight:800, fontFamily:'Sora,sans-serif', color:c }}>{v}</div>
          </div>
        ))}
      </div>

      <div style={S.card}>
        {invoices.length === 0 ? (
          <div style={{ textAlign:'center', padding:'40px 0', color:'#4A6260' }}>
            <div style={{ fontSize:32, marginBottom:10 }}>📄</div>
            <div style={{ fontSize:13, marginBottom:6 }}>Nenhuma invoice criada ainda</div>
            <button style={S.btnPrimary} onClick={() => setModal(true)}>Criar primeira invoice</button>
          </div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead>
              <tr>{['Número','Cliente','Vencimento','Valor','Status','Ações'].map(h=>(
                <th key={h} style={{ textAlign:'left', padding:'6px 10px', fontSize:9, fontFamily:'monospace', color:'#4A6260', letterSpacing:'.08em', textTransform:'uppercase', borderBottom:'1px solid #1F2A29' }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {invoices.map(inv => (
                <tr key={inv.id} style={{ borderBottom:'1px solid #1F2A29' }}>
                  <td style={{ padding:'9px 10px', fontFamily:'monospace', color:'#4A6260', fontSize:11 }}>{inv.numero}</td>
                  <td style={{ padding:'9px 10px', fontWeight:600, color:'#E4E8E7' }}>{inv.cliente_nome}</td>
                  <td style={{ padding:'9px 10px', fontFamily:'monospace', color:'#4A6260', fontSize:11 }}>
                    {inv.vencimento ? new Date(inv.vencimento).toLocaleDateString('pt-BR') : '—'}
                  </td>
                  <td style={{ padding:'9px 10px', fontFamily:'monospace', fontWeight:700, color:'#E4E8E7' }}>{fmt(inv.valor)}</td>
                  <td style={{ padding:'9px 10px' }}>
                    <span style={{ fontSize:10, padding:'2px 7px', borderRadius:20, fontFamily:'monospace', background:`${statusColor[inv.status]}22`, color:statusColor[inv.status] }}>{inv.status}</span>
                  </td>
                  <td style={{ padding:'9px 10px' }}>
                    <div style={{ display:'flex', gap:4 }}>
                      {inv.status !== 'paga' && (
                        <button onClick={() => atualizar(inv.id,'paga')}
                          style={{ fontSize:10, padding:'2px 8px', borderRadius:6, border:'1px solid #22C97A', background:'transparent', color:'#22C97A', cursor:'pointer' }}>
                          Marcar paga
                        </button>
                      )}
                      {inv.status === 'rascunho' && (
                        <button onClick={() => atualizar(inv.id,'enviada')}
                          style={{ fontSize:10, padding:'2px 8px', borderRadius:6, border:'1px solid #3B8BFF', background:'transparent', color:'#3B8BFF', cursor:'pointer' }}>
                          Enviar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:20 }} onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div style={{ background:'#111A19', border:'1px solid #2E3D3B', borderRadius:14, padding:24, width:460, maxWidth:'95vw' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <span style={{ fontSize:15, fontWeight:700, fontFamily:'Sora,sans-serif' }}>Nova Invoice</span>
              <button onClick={()=>setModal(false)} style={{ background:'none', border:'none', color:'#7A9290', cursor:'pointer', fontSize:20 }}>×</button>
            </div>
            <div style={{ marginBottom:12 }}>
              <label style={S.label}>Nome do cliente</label>
              <input style={S.input} placeholder="Empresa Cliente Ltda" value={form.cliente_nome} onChange={e=>setForm({...form,cliente_nome:e.target.value})} />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
              <div>
                <label style={S.label}>Valor (R$)</label>
                <input type="number" style={S.input} placeholder="0,00" value={form.valor} onChange={e=>setForm({...form,valor:e.target.value})} />
              </div>
              <div>
                <label style={S.label}>Vencimento</label>
                <input type="date" style={S.input} value={form.vencimento} onChange={e=>setForm({...form,vencimento:e.target.value})} />
              </div>
            </div>
            <div style={{ marginBottom:12 }}>
              <label style={S.label}>Descrição do serviço</label>
              <textarea style={{ ...S.input, height:80, resize:'none' }} placeholder="Descreva o serviço prestado..." value={form.descricao} onChange={e=>setForm({...form,descricao:e.target.value})} />
            </div>
            <div style={{ marginBottom:16 }}>
              <label style={S.label}>Status inicial</label>
              <select style={{ ...S.input, cursor:'pointer' }} value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>
                <option value="rascunho">Rascunho</option>
                <option value="enviada">Enviada</option>
                <option value="pendente">Pendente</option>
              </select>
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button style={S.btn} onClick={()=>setModal(false)}>Cancelar</button>
              <button style={S.btnPrimary} onClick={salvar} disabled={loading}>{loading?'Criando...':'Criar Invoice'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
