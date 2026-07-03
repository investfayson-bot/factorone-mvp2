'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatBRL, maskBRLInput, parseBRLInput } from '@/lib/currency-brl'
import toast from 'react-hot-toast'

type Receita = {
  id: string; empresa_id: string; descricao: string; categoria: string
  valor: number; data: string; tipo: 'recorrente' | 'pontual' | 'projeto'
  cliente: string | null; centro_custo: string | null; nota_fiscal: string | null
  status: 'confirmada' | 'prevista' | 'cancelada'; created_at: string
}

type NFeResult = {
  tipo: 'nfe' | 'nfse'; emitente: string; cnpj: string
  valor: number; data: string; numero_nf: string; descricao: string; categoria: string
}

const CATEGORIAS = ['Produto', 'Serviço', 'Consultoria', 'Projeto', 'Assinatura', 'Comissão', 'Aluguel', 'Royalties', 'Outros']
const TIPOS = { recorrente: 'Recorrente', pontual: 'Pontual', projeto: 'Projeto' }

function mesLabel(m: string) {
  const [y, mo] = m.split('-')
  return new Date(Number(y), Number(mo) - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

const BLANK_FORM = { descricao: '', categoria: 'Serviço', valor: '', data: new Date().toISOString().slice(0, 10), tipo: 'pontual', cliente: '', centro_custo: '', nota_fiscal: '', status: 'confirmada' }

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
  const [form, setForm] = useState({ ...BLANK_FORM })
  const [valorMask, setValorMask] = useState('')
  // XML NF-e
  const [xmlFile, setXmlFile] = useState<File | null>(null)
  const [xmlLoading, setXmlLoading] = useState(false)
  const [nfeResult, setNfeResult] = useState<NFeResult | null>(null)
  const xmlRef = useRef<HTMLInputElement>(null)

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
    setNfeResult(null)
    setXmlFile(null)
    if (r) {
      setEditItem(r)
      setForm({ descricao: r.descricao, categoria: r.categoria, valor: String(r.valor), data: r.data, tipo: r.tipo, cliente: r.cliente || '', centro_custo: r.centro_custo || '', nota_fiscal: r.nota_fiscal || '', status: r.status })
      setValorMask(r.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 }))
    } else {
      setEditItem(null)
      setForm({ ...BLANK_FORM })
      setValorMask('')
    }
    setShowForm(true)
  }

  async function importarNFe() {
    if (!xmlFile) { toast.error('Selecione um arquivo XML'); return }
    setXmlLoading(true)
    try {
      const { data: sess } = await supabase.auth.getSession()
      const fd = new FormData(); fd.append('file', xmlFile)
      const res = await fetch('/api/receitas/importar-nfe', {
        method: 'POST',
        headers: sess.session?.access_token ? { Authorization: `Bearer ${sess.session.access_token}` } : undefined,
        body: fd,
      })
      const out = await res.json() as NFeResult & { error?: string }
      if (!res.ok) throw new Error(out.error || 'Falha ao processar XML')
      setNfeResult(out)
      setForm(f => ({
        ...f,
        descricao: out.descricao || f.descricao,
        categoria: CATEGORIAS.includes(out.categoria) ? out.categoria : f.categoria,
        data: out.data || f.data,
        nota_fiscal: out.numero_nf || f.nota_fiscal,
        cliente: out.emitente || f.cliente,
      }))
      setValorMask(out.valor > 0 ? maskBRLInput(String(Math.round(out.valor * 100))) : '')
      toast.success('NF-e lida com sucesso. Confira os dados.')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao ler XML')
    } finally {
      setXmlLoading(false)
    }
  }

  async function salvar() {
    const valor = parseBRLInput(valorMask)
    if (!form.descricao || valor <= 0 || !form.data) { toast.error('Preencha descrição, valor e data'); return }
    setSaving(true)
    const payload = {
      empresa_id: empresaId, descricao: form.descricao, categoria: form.categoria,
      valor, data: form.data, tipo: form.tipo,
      cliente: form.cliente || null, centro_custo: form.centro_custo || null,
      nota_fiscal: form.nota_fiscal || null, status: form.status,
    }
    if (editItem) {
      const { error } = await supabase.from('receitas_pj').update(payload).eq('id', editItem.id)
      if (error) toast.error(error.message)
      else { toast.success('Receita atualizada'); setShowForm(false); void carregar() }
    } else {
      const { error } = await supabase.from('receitas_pj').insert(payload)
      if (error) toast.error(error.message)
      else { toast.success('Receita registrada'); setShowForm(false); void carregar() }
    }
    setSaving(false)
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

  const inp: React.CSSProperties = {
    width: '100%', border: '1px solid var(--gray-100)', borderRadius: 8,
    padding: '8px 12px', fontSize: 13, color: 'var(--navy)',
    background: '#fff', boxSizing: 'border-box', outline: 'none',
  }
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 4, display: 'block' }

  if (loading) return <div style={{ padding: 32, color: 'var(--gray-400)' }}>Carregando…</div>

  return (
    <>
      <div className="page-hdr">
        <div>
          <div className="page-title">Receitas</div>
          <div className="page-sub">{mesLabel(mes)} · entradas confirmadas e previstas</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-action btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => { abrirForm(); setTimeout(() => xmlRef.current?.click(), 200) }}>
            <i className="fa-solid fa-file-code" style={{ fontSize: 12 }} />
            Importar XML NF-e
          </button>
          <button className="btn-action" onClick={() => abrirForm()}>+ Nova receita</button>
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
                <div style={{ fontSize: 12, fontWeight: 700, fontFamily: "var(--font-sans)", minWidth: 90, textAlign: 'right' }}>{formatBRL(val)}</div>
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
                  <td style={{ fontFamily: "var(--font-sans)", fontSize: 11 }}>
                    {new Date(r.data + 'T12:00:00').toLocaleDateString('pt-BR')}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 12 }}>{r.descricao}</div>
                    {r.nota_fiscal && <div style={{ fontSize: 10, color: 'var(--teal)' }}>{r.nota_fiscal}</div>}
                  </td>
                  <td><span className="tag gray" style={{ fontSize: 9 }}>{r.categoria}</span></td>
                  <td style={{ fontSize: 12, color: 'var(--gray-500)' }}>{r.cliente || '—'}</td>
                  <td style={{ fontSize: 11, color: 'var(--gray-400)' }}>{TIPOS[r.tipo]}</td>
                  <td style={{ textAlign: 'right', fontFamily: "var(--font-sans)", color: 'var(--green)', fontWeight: 700, fontSize: 13 }}>
                    +{formatBRL(Number(r.valor))}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <select
                      value={r.status}
                      onChange={e => void alterarStatus(r.id, e.target.value)}
                      style={{
                        fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 20, border: '1px solid',
                        background: r.status === 'confirmada' ? 'rgba(61,122,110,.1)' : r.status === 'prevista' ? 'var(--gray-100)' : 'rgba(239,68,68,.1)',
                        color: r.status === 'confirmada' ? 'var(--green)' : r.status === 'prevista' ? 'var(--gray-500)' : 'var(--red)',
                        borderColor: r.status === 'confirmada' ? 'rgba(61,122,110,.2)' : r.status === 'prevista' ? 'var(--gray-200)' : 'rgba(239,68,68,.2)',
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
          <div className="modal-box" style={{ maxWidth: 560, maxHeight: '92vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 className="modal-title">{editItem ? 'Editar receita' : 'Nova receita'}</h3>
              <button className="modal-close" onClick={() => setShowForm(false)}><i className="fa-solid fa-xmark" /></button>
            </div>

            {/* XML NF-e Zone */}
            <div
              style={{
                border: xmlFile ? '2px solid var(--green)' : '2px dashed var(--gray-100)',
                borderRadius: 12, padding: 16, marginBottom: 20, textAlign: 'center',
                background: xmlFile ? 'rgba(61,122,110,0.04)' : '#fafafa', cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onClick={() => xmlRef.current?.click()}
            >
              <input ref={xmlRef} type="file" accept=".xml,text/xml,application/xml" style={{ display: 'none' }}
                onChange={e => { setXmlFile(e.target.files?.[0] ?? null); setNfeResult(null) }} />
              {xmlFile ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <i className="fa-solid fa-file-code" style={{ fontSize: 22, color: 'var(--green)' }} />
                    <div style={{ textAlign: 'left' }}>
                      <p style={{ fontWeight: 600, fontSize: 13, color: 'var(--navy)', margin: 0 }}>{xmlFile.name}</p>
                      <p style={{ fontSize: 11, color: 'var(--gray-400)', margin: 0 }}>
                        {nfeResult ? `${nfeResult.tipo === 'nfse' ? 'NFS-e' : 'NF-e'} · ${nfeResult.emitente}` : 'Clique para outro arquivo'}
                      </p>
                    </div>
                  </div>
                  {!nfeResult && (
                    <button type="button" onClick={e => { e.stopPropagation(); void importarNFe() }} disabled={xmlLoading}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12, background: 'var(--green)', color: '#fff', opacity: xmlLoading ? 0.7 : 1 }}>
                      <i className="fa-solid fa-wand-magic-sparkles" />
                      {xmlLoading ? 'Lendo…' : 'Processar NF-e'}
                    </button>
                  )}
                  {nfeResult && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--green)', fontSize: 12, fontWeight: 700 }}>
                      <i className="fa-solid fa-circle-check" /> Dados preenchidos
                    </span>
                  )}
                </div>
              ) : (
                <>
                  <i className="fa-solid fa-file-import" style={{ fontSize: 28, color: 'var(--gray-400)', marginBottom: 8 }} />
                  <p style={{ fontWeight: 600, fontSize: 13, color: 'var(--navy)', margin: '0 0 2px' }}>Importar XML de NF-e ou NFS-e</p>
                  <p style={{ fontSize: 11, color: 'var(--gray-400)', margin: 0 }}>Clique para selecionar · preenche automaticamente emitente, valor e data</p>
                </>
              )}
            </div>

            {/* Dados extraídos */}
            {nfeResult && (
              <div style={{ margin: '0 0 16px', padding: '12px 14px', borderRadius: 10, background: '#f0fdf4', border: '1px solid #86efac' }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
                  <i className="fa-solid fa-circle-check" style={{ marginRight: 4 }} />
                  {nfeResult.tipo === 'nfse' ? 'NFS-e' : 'NF-e'} processada
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 12px', fontSize: 12 }}>
                  {[['Emitente', nfeResult.emitente], ['CNPJ', nfeResult.cnpj || '—'], ['Valor', formatBRL(nfeResult.valor)], ['Data', nfeResult.data], ['Número', nfeResult.numero_nf || '—']].map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', gap: 6 }}>
                      <span style={{ color: '#166534', minWidth: 60 }}>{k}:</span>
                      <span style={{ color: '#14532d', fontWeight: 600 }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={lbl}>Descrição *</label>
                <input style={inp} placeholder="Ex: Consultoria cliente ABC" value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} />
              </div>
              <div>
                <label style={lbl}>Valor R$ *</label>
                <input style={inp} placeholder="0,00" inputMode="decimal" value={valorMask} onChange={e => setValorMask(maskBRLInput(e.target.value))} />
              </div>
              <div>
                <label style={lbl}>Data *</label>
                <input style={inp} type="date" value={form.data} onChange={e => setForm(p => ({ ...p, data: e.target.value }))} />
              </div>
              <div>
                <label style={lbl}>Categoria</label>
                <select style={inp} value={form.categoria} onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))}>
                  {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Tipo</label>
                <select style={inp} value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))}>
                  <option value="pontual">Pontual</option>
                  <option value="recorrente">Recorrente</option>
                  <option value="projeto">Projeto</option>
                </select>
              </div>
              <div>
                <label style={lbl}>Status</label>
                <select style={inp} value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                  <option value="confirmada">Confirmada</option>
                  <option value="prevista">Prevista</option>
                  <option value="cancelada">Cancelada</option>
                </select>
              </div>
              <div>
                <label style={lbl}>Cliente / Emitente</label>
                <input style={inp} placeholder="Nome do cliente" value={form.cliente} onChange={e => setForm(p => ({ ...p, cliente: e.target.value }))} />
              </div>
              <div>
                <label style={lbl}>Nota Fiscal nº</label>
                <input style={inp} placeholder="NF-e 12345 ou NFS-e 678" value={form.nota_fiscal} onChange={e => setForm(p => ({ ...p, nota_fiscal: e.target.value }))} />
              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: 20 }}>
              <button className="btn-ghost" onClick={() => setShowForm(false)}>Cancelar</button>
              <button className="btn-action" disabled={saving} onClick={() => void salvar()}>
                {saving ? 'Salvando…' : editItem ? 'Salvar' : 'Adicionar receita'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
