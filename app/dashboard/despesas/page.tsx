'use client'
export const dynamic = 'force-dynamic'
import React, { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

const CATS = ['Marketing','Tecnologia','RH','Software','Jurídico','Viagens','Infraestrutura','Alimentação','Outros']

export default function DespesasPage() {
  const [despesas, setDespesas] = useState<any[]>([])
  const [modal, setModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [empresaId, setEmpresaId] = useState('')
  const [form, setForm] = useState({ descricao:'', valor:'', categoria:'Marketing', data: new Date().toISOString().split('T')[0], status:'pago' })
  const [arquivo, setArquivo] = useState<File|null>(null)
  const [preview, setPreview] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const sb = supabase

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return
    const { data: u } = await sb.from('usuarios').select('empresa_id').eq('id', user.id).single()
    if (!u) return
    setEmpresaId(u.empresa_id)
    const { data } = await sb.from('despesas').select('*').eq('empresa_id', u.empresa_id).order('created_at', { ascending: false })
    if (data) setDespesas(data)
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setArquivo(f)
    setPreview(URL.createObjectURL(f))
  }

  async function salvar() {
    if (!form.descricao || !form.valor) { toast.error('Preencha descrição e valor'); return }
    setLoading(true)
    try {
      let url = ''
      if (arquivo && empresaId) {
        const ext = arquivo.name.split('.').pop()
        const path = `${empresaId}/${Date.now()}.${ext}`
        const { error } = await sb.storage.from('comprovantes').upload(path, arquivo)
        if (!error) {
          const { data: signed } = await sb.storage.from('comprovantes').createSignedUrl(path, 60*60*24*365)
          url = signed?.signedUrl || ''
        }
      }
      await sb.from('despesas').insert({
        empresa_id: empresaId,
        descricao: form.descricao,
        valor: parseFloat(form.valor),
        categoria: form.categoria,
        data: form.data,
        status: form.status,
        comprovante_url: url,
      })
      toast.success('Despesa registrada!')
      setModal(false)
      setForm({ descricao:'', valor:'', categoria:'Marketing', data: new Date().toISOString().split('T')[0], status:'pago' })
      setArquivo(null)
      setPreview('')
      load()
    } catch { toast.error('Erro ao salvar') }
    setLoading(false)
  }

  async function excluir(id: string) {
    await sb.from('despesas').delete().eq('id', id)
    toast.success('Despesa removida')
    load()
  }

  const total = despesas.reduce((a, d) => a + (d.valor || 0), 0)
  const fmt = (n: number) => 'R$' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2 })

  const S = {
    card: { background:'#111A19', border:'1px solid #233130', borderRadius:12, padding:16 } as any,
    btn: { padding:'8px 16px', borderRadius:8, border:'1px solid #2E3D3B', background:'transparent', color:'#E4E8E7', fontSize:12, cursor:'pointer' } as any,
    btnPrimary: { padding:'8px 16px', borderRadius:8, border:'none', background:'#C8F135', color:'#000', fontSize:12, fontWeight:700, cursor:'pointer' } as any,
    input: { width:'100%', background:'#182120', border:'1px solid #2E3D3B', borderRadius:7, padding:'9px 12px', color:'#E4E8E7', fontSize:13, outline:'none', boxSizing:'border-box' as any },
    label: { fontSize:10, color:'#7A9290', fontFamily:'monospace', textTransform:'uppercase' as any, letterSpacing:'.05em', display:'block', marginBottom:4 },
  }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:18, fontWeight:700, fontFamily:'Sora,sans-serif', margin:0 }}>Despesas</h1>
          <p style={{ fontSize:11, color:'#7A9290', fontFamily:'monospace', margin:0 }}>{despesas.length} lançamentos · Total {fmt(total)}</p>
        </div>
        <button style={S.btnPrimary} onClick={() => setModal(true)}>+ Nova Despesa</button>
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:14 }}>
        {[
          { l:'Total mês', v: fmt(total), c:'#E4E8E7' },
          { l:'Pagas', v: despesas.filter(d=>d.status==='pago').length, c:'#22C97A' },
          { l:'Pendentes', v: despesas.filter(d=>d.status==='pendente').length, c:'#F59E0B' },
          { l:'Em aprovação', v: despesas.filter(d=>d.status==='aprovacao').length, c:'#3B8BFF' },
        ].map(({ l, v, c }) => (
          <div key={l} style={S.card}>
            <div style={{ fontSize:10, color:'#7A9290', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'.04em', marginBottom:4 }}>{l}</div>
            <div style={{ fontSize:22, fontWeight:800, fontFamily:'Sora,sans-serif', color:c }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={S.card}>
        {despesas.length === 0 ? (
          <div style={{ textAlign:'center', padding:'40px 0', color:'#4A6260' }}>
            <div style={{ fontSize:32, marginBottom:10 }}>📋</div>
            <div style={{ fontSize:13, marginBottom:6 }}>Nenhuma despesa registrada</div>
            <button style={S.btnPrimary} onClick={() => setModal(true)}>Registrar primeira despesa</button>
          </div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead>
                <tr>{['Descrição','Categoria','Data','Valor','Status','Comprovante',''].map(h=>(
                  <th key={h} style={{ textAlign:'left', padding:'6px 10px', fontSize:9, fontFamily:'monospace', color:'#4A6260', letterSpacing:'.08em', textTransform:'uppercase', borderBottom:'1px solid #1F2A29' }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {despesas.map(d => (
                  <tr key={d.id} style={{ borderBottom:'1px solid #1F2A29' }}>
                    <td style={{ padding:'9px 10px', color:'#E4E8E7' }}>{d.descricao}</td>
                    <td style={{ padding:'9px 10px' }}>
                      <span style={{ fontSize:10, padding:'2px 7px', borderRadius:20, background:'#182120', color:'#7A9290', fontFamily:'monospace' }}>{d.categoria}</span>
                    </td>
                    <td style={{ padding:'9px 10px', fontFamily:'monospace', color:'#4A6260', fontSize:11 }}>{new Date(d.data).toLocaleDateString('pt-BR')}</td>
                    <td style={{ padding:'9px 10px', fontFamily:'monospace', fontWeight:600, color:'#FF4F4F' }}>−{fmt(d.valor)}</td>
                    <td style={{ padding:'9px 10px' }}>
                      <span style={{ fontSize:10, padding:'2px 7px', borderRadius:20, fontFamily:'monospace', background: d.status==='pago'?'rgba(34,201,122,.15)':d.status==='pendente'?'rgba(245,158,11,.15)':'rgba(59,139,255,.15)', color: d.status==='pago'?'#22C97A':d.status==='pendente'?'#F59E0B':'#3B8BFF' }}>{d.status}</span>
                    </td>
                    <td style={{ padding:'9px 10px' }}>
                      {d.comprovante_url ? (
                        <a href={d.comprovante_url} target="_blank" rel="noreferrer" style={{ fontSize:11, color:'#3B8BFF', textDecoration:'none' }}>📎 Ver</a>
                      ) : <span style={{ color:'#4A6260', fontSize:11 }}>—</span>}
                    </td>
                    <td style={{ padding:'9px 10px' }}>
                      <button onClick={() => excluir(d.id)} style={{ background:'none', border:'none', color:'#4A6260', cursor:'pointer', fontSize:14 }}>×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:20 }} onClick={e => e.target===e.currentTarget && setModal(false)}>
          <div style={{ background:'#111A19', border:'1px solid #2E3D3B', borderRadius:14, padding:24, width:460, maxWidth:'95vw', maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <span style={{ fontSize:15, fontWeight:700, fontFamily:'Sora,sans-serif' }}>Nova Despesa</span>
              <button onClick={() => setModal(false)} style={{ background:'none', border:'none', color:'#7A9290', cursor:'pointer', fontSize:20, lineHeight:1 }}>×</button>
            </div>

            <div style={{ marginBottom:12 }}>
              <label style={S.label}>Descrição</label>
              <input style={S.input} placeholder="Ex: AWS — Infraestrutura" value={form.descricao} onChange={e=>setForm({...form,descricao:e.target.value})} />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
              <div>
                <label style={S.label}>Valor (R$)</label>
                <input type="number" style={S.input} placeholder="0,00" value={form.valor} onChange={e=>setForm({...form,valor:e.target.value})} />
              </div>
              <div>
                <label style={S.label}>Data</label>
                <input type="date" style={S.input} value={form.data} onChange={e=>setForm({...form,data:e.target.value})} />
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
              <div>
                <label style={S.label}>Categoria</label>
                <select style={{ ...S.input, cursor:'pointer' }} value={form.categoria} onChange={e=>setForm({...form,categoria:e.target.value})}>
                  {CATS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={S.label}>Status</label>
                <select style={{ ...S.input, cursor:'pointer' }} value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>
                  <option value="pago">Pago</option>
                  <option value="pendente">Pendente</option>
                  <option value="aprovacao">Em aprovação</option>
                </select>
              </div>
            </div>

            {/* Upload comprovante */}
            <div style={{ marginBottom:16 }}>
              <label style={S.label}>Comprovante / Recibo (foto ou PDF)</label>
              <div onClick={() => fileRef.current?.click()}
                style={{ border:'2px dashed #2E3D3B', borderRadius:8, padding:preview?0:'20px 16px', textAlign:'center', cursor:'pointer', transition:'border-color .15s', overflow:'hidden' }}
                onMouseOver={e=>(e.currentTarget.style.borderColor='#C8F135')}
                onMouseOut={e=>(e.currentTarget.style.borderColor='#2E3D3B')}>
                {preview ? (
                  <img src={preview} alt="preview" style={{ width:'100%', maxHeight:180, objectFit:'cover' }} />
                ) : (
                  <div>
                    <div style={{ fontSize:24, marginBottom:6 }}>📷</div>
                    <div style={{ fontSize:12, color:'#7A9290' }}>Clique para fotografar ou selecionar arquivo</div>
                    <div style={{ fontSize:10, color:'#4A6260', marginTop:3 }}>JPG, PNG, PDF — máx 10MB</div>
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*,application/pdf" style={{ display:'none' }} onChange={handleFile} capture="environment" />
              {preview && <button onClick={()=>{setArquivo(null);setPreview('')}} style={{ fontSize:11, color:'#FF4F4F', background:'none', border:'none', cursor:'pointer', marginTop:4 }}>✕ Remover</button>}
            </div>

            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button style={S.btn} onClick={()=>setModal(false)}>Cancelar</button>
              <button style={S.btnPrimary} onClick={salvar} disabled={loading}>{loading?'Salvando...':'Registrar despesa'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
