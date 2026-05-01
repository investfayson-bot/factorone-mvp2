'use client'

import { useMemo, useState } from 'react'
import { buscarCep } from '@/lib/viacep'
import { maskCep, maskCpfCnpj, onlyDigits } from '@/lib/masks'
import { supabase } from '@/lib/supabase'

const CFOPS = ['5102', '5405', '6102', '6404']
const UNIDADES = ['UN', 'KG', 'M', 'L', 'CX']
const ICMS = [0, 4, 7, 12, 17, 25]

type Produto = {
  id: string
  descricao: string
  ncm: string
  cfop: string
  quantidade: number
  unidade: string
  valorUnitario: number
  icmsAliquota: number
}

const produtoVazio = (): Produto => ({
  id: crypto.randomUUID(),
  descricao: '',
  ncm: '',
  cfop: '5102',
  quantidade: 1,
  unidade: 'UN',
  valorUnitario: 0,
  icmsAliquota: 17,
})

const card: React.CSSProperties = { background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: 16, marginBottom: 14 }
const sectionTitle: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: 'var(--navy)', marginBottom: 12 }

export default function EmitirNFe() {
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const [dest, setDest] = useState({
    cnpjCpf: '', razaoSocial: '', email: '', cep: '',
    logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '',
  })

  const [produtos, setProdutos] = useState<Produto[]>([produtoVazio()])
  const [transportadora, setTransportadora] = useState({ nome: '', cnpj: '', modalidadeFrete: '' })
  const [infoAdic, setInfoAdic] = useState('')
  const [natureza, setNatureza] = useState('Venda de mercadoria')

  const totais = useMemo(() => {
    let bruto = 0; let icms = 0
    for (const p of produtos) {
      const t = p.quantidade * p.valorUnitario
      bruto += t; icms += (t * p.icmsAliquota) / 100
    }
    return { bruto, icms, total: bruto }
  }, [produtos])

  async function onCepBlur() {
    const c = onlyDigits(dest.cep)
    if (c.length !== 8) return
    const r = await buscarCep(c)
    if (!r) return
    setDest((d) => ({ ...d, logradouro: r.logradouro || d.logradouro, bairro: r.bairro || d.bairro, cidade: r.localidade || d.cidade, uf: r.uf || d.uf }))
  }

  async function emitir() {
    setLoading(true); setMsg(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/notas/emitir-nfe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({
          destinatario: { cnpjCpf: onlyDigits(dest.cnpjCpf), razaoSocial: dest.razaoSocial, email: dest.email, cep: onlyDigits(dest.cep), logradouro: dest.logradouro, numero: dest.numero, complemento: dest.complemento, bairro: dest.bairro, cidade: dest.cidade, uf: dest.uf },
          produtos: produtos.map((p) => ({ descricao: p.descricao, ncm: onlyDigits(p.ncm), cfop: p.cfop, quantidade: p.quantidade, unidade: p.unidade, valorUnitario: p.valorUnitario, icmsAliquota: p.icmsAliquota })),
          transportadora: transportadora.nome ? { nome: transportadora.nome, cnpj: transportadora.cnpj, modalidadeFrete: transportadora.modalidadeFrete } : undefined,
          informacoesAdicionais: infoAdic || undefined,
          naturezaOperacao: natureza,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao emitir')
      setMsg({ type: 'ok', text: `NF-e enviada. Status: ${data.status || 'ok'}. Número: ${data.numero || '—'}` })
    } catch (e: unknown) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : 'Erro' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 720 }}>
      {/* Destinatário */}
      <div style={card}>
        <div style={sectionTitle}>Destinatário</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <input className="form-input" placeholder="CNPJ/CPF" value={maskCpfCnpj(dest.cnpjCpf)} onChange={(e) => setDest({ ...dest, cnpjCpf: e.target.value })} />
          <input className="form-input" placeholder="Razão social" value={dest.razaoSocial} onChange={(e) => setDest({ ...dest, razaoSocial: e.target.value })} />
          <input className="form-input" placeholder="E-mail" type="email" value={dest.email} onChange={(e) => setDest({ ...dest, email: e.target.value })} />
          <input className="form-input" placeholder="CEP" value={maskCep(dest.cep)} onChange={(e) => setDest({ ...dest, cep: e.target.value })} onBlur={onCepBlur} />
          <input className="form-input" placeholder="Logradouro" value={dest.logradouro} onChange={(e) => setDest({ ...dest, logradouro: e.target.value })} style={{ gridColumn: 'span 2' }} />
          <input className="form-input" placeholder="Número" value={dest.numero} onChange={(e) => setDest({ ...dest, numero: e.target.value })} />
          <input className="form-input" placeholder="Complemento" value={dest.complemento} onChange={(e) => setDest({ ...dest, complemento: e.target.value })} />
          <input className="form-input" placeholder="Bairro" value={dest.bairro} onChange={(e) => setDest({ ...dest, bairro: e.target.value })} />
          <input className="form-input" placeholder="Cidade" value={dest.cidade} onChange={(e) => setDest({ ...dest, cidade: e.target.value })} />
          <input className="form-input" placeholder="UF" maxLength={2} value={dest.uf} onChange={(e) => setDest({ ...dest, uf: e.target.value.toUpperCase() })} />
        </div>
      </div>

      {/* Produtos */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={sectionTitle}>Produtos</div>
          <button type="button" onClick={() => setProdutos((p) => [...p, produtoVazio()])} className="btn-action" style={{ fontSize: 10, padding: '3px 10px' }}>+ Adicionar</button>
        </div>
        {produtos.map((p, idx) => (
          <div key={p.id} style={{ border: '1px solid var(--gray-100)', borderRadius: 8, padding: 12, marginBottom: 8, position: 'relative' }}>
            {produtos.length > 1 && (
              <button type="button" onClick={() => setProdutos((rows) => rows.filter((x) => x.id !== p.id))} style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 14 }}>✕</button>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <input className="form-input" placeholder="Descrição" value={p.descricao} style={{ gridColumn: 'span 2' }} onChange={(e) => { const v = e.target.value; setProdutos((rows) => rows.map((x) => (x.id === p.id ? { ...x, descricao: v } : x))) }} />
              <input className="form-input" placeholder="NCM (8 dígitos)" value={p.ncm} onChange={(e) => { const v = onlyDigits(e.target.value).slice(0, 8); setProdutos((rows) => rows.map((x) => (x.id === p.id ? { ...x, ncm: v } : x))) }} />
              <select className="form-input" value={p.cfop} onChange={(e) => { const v = e.target.value; setProdutos((rows) => rows.map((x) => (x.id === p.id ? { ...x, cfop: v } : x))) }}>
                {CFOPS.map((c) => <option key={c} value={c}>CFOP {c}</option>)}
              </select>
              <input type="number" min={0} step={0.01} className="form-input" placeholder="Qtd" value={p.quantidade || ''} onChange={(e) => { const v = Number(e.target.value); setProdutos((rows) => rows.map((x) => (x.id === p.id ? { ...x, quantidade: v } : x))) }} />
              <select className="form-input" value={p.unidade} onChange={(e) => { const v = e.target.value; setProdutos((rows) => rows.map((x) => (x.id === p.id ? { ...x, unidade: v } : x))) }}>
                {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
              <input type="number" min={0} step={0.01} className="form-input" placeholder="Valor unitário" value={p.valorUnitario || ''} onChange={(e) => { const v = Number(e.target.value); setProdutos((rows) => rows.map((x) => (x.id === p.id ? { ...x, valorUnitario: v } : x))) }} />
              <select className="form-input" value={p.icmsAliquota} onChange={(e) => { const v = Number(e.target.value); setProdutos((rows) => rows.map((x) => (x.id === p.id ? { ...x, icmsAliquota: v } : x))) }}>
                {ICMS.map((i) => <option key={i} value={i}>ICMS {i}%</option>)}
              </select>
            </div>
            <div style={{ fontSize: 10, color: 'var(--gray-400)', marginTop: 6 }}>Item {idx + 1}: {(p.quantidade * p.valorUnitario).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
          </div>
        ))}
      </div>

      {/* Transportadora */}
      <div style={card}>
        <div style={sectionTitle}>Transportadora (opcional)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
          <input className="form-input" placeholder="Nome" value={transportadora.nome} onChange={(e) => setTransportadora({ ...transportadora, nome: e.target.value })} />
          <input className="form-input" placeholder="CNPJ" value={transportadora.cnpj} onChange={(e) => setTransportadora({ ...transportadora, cnpj: e.target.value })} />
          <input className="form-input" placeholder="Modalidade frete" value={transportadora.modalidadeFrete} onChange={(e) => setTransportadora({ ...transportadora, modalidadeFrete: e.target.value })} />
        </div>
      </div>

      {/* Natureza + Info */}
      <div style={card}>
        <div style={sectionTitle}>Natureza da operação</div>
        <input className="form-input" value={natureza} onChange={(e) => setNatureza(e.target.value)} style={{ marginBottom: 8 }} />
        <textarea className="form-input" placeholder="Informações adicionais" value={infoAdic} onChange={(e) => setInfoAdic(e.target.value)} style={{ minHeight: 70, resize: 'vertical' }} />
      </div>

      {/* Preview + emit */}
      <div style={{ background: 'var(--navy)', borderRadius: 12, padding: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,.5)', textTransform: 'uppercase', fontFamily: "'DM Mono',monospace", marginBottom: 4 }}>Preview</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>Total: {totais.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.6)' }}>ICMS estimado: {totais.icms.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
        </div>
        <button type="button" disabled={loading} onClick={emitir} className="btn-action" style={{ opacity: loading ? .6 : 1, flexShrink: 0 }}>
          {loading ? 'Emitindo...' : '⚡ Emitir NF-e'}
        </button>
      </div>

      {msg && (
        <div style={{ borderRadius: 8, padding: '10px 14px', fontSize: 12, background: msg.type === 'ok' ? 'rgba(45,155,111,.1)' : 'rgba(192,80,74,.1)', color: msg.type === 'ok' ? 'var(--green)' : 'var(--red)', border: `1px solid ${msg.type === 'ok' ? 'rgba(45,155,111,.25)' : 'rgba(192,80,74,.2)'}` }}>
          {msg.text}
        </div>
      )}
    </div>
  )
}
