'use client'

import { useMemo, useState } from 'react'
import { maskCpfCnpj, onlyDigits } from '@/lib/masks'
import { supabase } from '@/lib/supabase'

const LC116_COMUM = [
  { cod: '1.01', desc: 'Análise e desenvolvimento de sistemas' },
  { cod: '17.01', desc: 'Assessoria/consultoria' },
  { cod: '17.02', desc: 'Planejamento' },
  { cod: '17.06', desc: 'Treinamento' },
  { cod: '17.19', desc: 'Programação' },
]

const ISS_OPTS = [2, 3, 4, 5]

const card: React.CSSProperties = { background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: 16, marginBottom: 14 }
const sectionTitle: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: 'var(--navy)', marginBottom: 12 }

export default function EmitirNFSe() {
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [buscaLc, setBuscaLc] = useState('')

  const [tomador, setTomador] = useState({ cnpjCpf: '', razaoSocial: '', email: '', municipio: '' })
  const [servico, setServico] = useState({ descricao: '', codigoServicoMunicipal: '17.19', valor: 0, issAliquota: 5, irRetido: false, pisCofinsRetido: false })

  const mesAtual = new Date().toISOString().slice(0, 7)
  const [competencia, setCompetencia] = useState(mesAtual)
  const [dataEmissao, setDataEmissao] = useState(new Date().toISOString().slice(0, 10))

  const preview = useMemo(() => {
    const v = servico.valor
    const iss = (v * servico.issAliquota) / 100
    const ir = servico.irRetido ? (v * 1.5) / 100 : 0
    const pc = servico.pisCofinsRetido ? (v * 4.65) / 100 : 0
    return { liquido: v - (iss + ir + pc), iss, ir, pc }
  }, [servico])

  const lcFiltrados = useMemo(() => {
    const q = buscaLc.toLowerCase()
    if (!q) return LC116_COMUM
    return LC116_COMUM.filter((x) => x.cod.includes(q) || x.desc.toLowerCase().includes(q))
  }, [buscaLc])

  async function emitir() {
    setLoading(true); setMsg(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/notas/emitir-nfse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({
          tomador: { cnpjCpf: onlyDigits(tomador.cnpjCpf), razaoSocial: tomador.razaoSocial, email: tomador.email, municipio: tomador.municipio },
          servico: { descricao: servico.descricao, codigoServicoMunicipal: servico.codigoServicoMunicipal, valor: servico.valor, issAliquota: servico.issAliquota, irRetido: servico.irRetido, pisCofinsRetido: servico.pisCofinsRetido },
          competencia,
          dataEmissao,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao emitir')
      setMsg({ type: 'ok', text: `NFS-e enviada. ${data.numero ? `Nº ${data.numero}` : ''}` })
    } catch (e: unknown) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : 'Erro' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 640 }}>
      {/* Tomador */}
      <div style={card}>
        <div style={sectionTitle}>Tomador</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <input className="form-input" placeholder="CNPJ/CPF" value={maskCpfCnpj(tomador.cnpjCpf)} onChange={(e) => setTomador({ ...tomador, cnpjCpf: e.target.value })} />
          <input className="form-input" placeholder="Razão social" value={tomador.razaoSocial} onChange={(e) => setTomador({ ...tomador, razaoSocial: e.target.value })} />
          <input className="form-input" type="email" placeholder="E-mail" value={tomador.email} onChange={(e) => setTomador({ ...tomador, email: e.target.value })} />
          <input className="form-input" placeholder="Município" value={tomador.municipio} onChange={(e) => setTomador({ ...tomador, municipio: e.target.value })} />
        </div>
      </div>

      {/* Serviço */}
      <div style={card}>
        <div style={sectionTitle}>Serviço</div>
        <textarea className="form-input" placeholder="Descrição do serviço" value={servico.descricao} onChange={(e) => setServico({ ...servico, descricao: e.target.value })} style={{ minHeight: 80, resize: 'vertical', marginBottom: 8 }} />
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: 'var(--gray-400)', marginBottom: 6 }}>🔍 LC116 (busca)</div>
          <input className="form-input" placeholder="Filtrar código ou descrição" value={buscaLc} onChange={(e) => setBuscaLc(e.target.value)} style={{ marginBottom: 6 }} />
          <select className="form-input" value={servico.codigoServicoMunicipal} onChange={(e) => setServico({ ...servico, codigoServicoMunicipal: e.target.value })}>
            {lcFiltrados.map((x) => <option key={x.cod} value={x.cod}>{x.cod} — {x.desc}</option>)}
          </select>
        </div>
        <input type="number" min={0} step={0.01} className="form-input" placeholder="Valor do serviço" value={servico.valor || ''} onChange={(e) => setServico({ ...servico, valor: Number(e.target.value) })} style={{ marginBottom: 10 }} />
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 10 }}>
          <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--navy)' }}>
            ISS %
            <select className="form-input" style={{ width: 'auto' }} value={servico.issAliquota} onChange={(e) => setServico({ ...servico, issAliquota: Number(e.target.value) })}>
              {ISS_OPTS.map((i) => <option key={i} value={i}>{i}%</option>)}
            </select>
          </label>
          <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--navy)' }}>
            <input type="checkbox" checked={servico.irRetido} onChange={(e) => setServico({ ...servico, irRetido: e.target.checked })} />
            IR retido (1,5%)
          </label>
          <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--navy)' }}>
            <input type="checkbox" checked={servico.pisCofinsRetido} onChange={(e) => setServico({ ...servico, pisCofinsRetido: e.target.checked })} />
            PIS/COFINS (est. 4,65%)
          </label>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Competência (mês/ano)</label>
            <input type="month" className="form-input" value={competencia} onChange={(e) => setCompetencia(e.target.value)} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Data de emissão</label>
            <input type="date" className="form-input" value={dataEmissao} onChange={(e) => setDataEmissao(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Preview + emit */}
      <div style={{ background: 'var(--navy)', borderRadius: 12, padding: 18, marginBottom: 14 }}>
        <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,.5)', textTransform: 'uppercase', fontFamily: "'DM Mono',monospace", marginBottom: 4 }}>Valor líquido (após retenções)</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 4 }}>{preview.liquido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', marginBottom: 14 }}>ISS {preview.iss.toFixed(2)} | IR {preview.ir.toFixed(2)} | PIS/COFINS {preview.pc.toFixed(2)}</div>
        <button type="button" disabled={loading} onClick={emitir} className="btn-action" style={{ opacity: loading ? .6 : 1 }}>
          {loading ? 'Emitindo...' : '⚡ Emitir NFS-e'}
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
