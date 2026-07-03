'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { maskCpfCnpj } from '@/lib/masks'
import { formatBRL } from '@/lib/currency-brl'

type Cliente = {
  id: string; empresa_id: string; nome: string; tipo: 'pj' | 'pf'
  cnpj_cpf: string | null; email: string | null; telefone: string | null
  whatsapp: string | null; website: string | null; segmento: string | null
  responsavel_nome: string | null; status: 'prospect' | 'ativo' | 'inativo' | 'churned'
  origem: string | null; notas: string | null; endereco: string | null
  cidade: string | null; estado: string | null; valor_contrato: number | null; created_at: string
}
type Contato = { id: string; cliente_id: string; nome: string; cargo: string | null; email: string | null; telefone: string | null; whatsapp: string | null; principal: boolean }

const STATUS_COLOR: Record<string, string> = { prospect: '#7A6A9E', ativo: '#3D7A6E', inativo: '#7B8C88', churned: '#B0413E' }
const STATUS_BG: Record<string, string> = { prospect: 'rgba(124,58,237,.1)', ativo: 'rgba(61,122,110,.1)', inativo: '#E4DCCC', churned: 'rgba(176,65,62,.1)' }
const STATUS_LABEL: Record<string, string> = { prospect: 'Prospect', ativo: 'Ativo', inativo: 'Inativo', churned: 'Churn' }
const SEGMENTOS = ['Tecnologia', 'Varejo', 'Saúde', 'Educação', 'Agronegócio', 'Construção', 'Logística', 'Serviços', 'Indústria', 'Financeiro', 'Outros']
const ORIGENS = ['Indicação', 'Google', 'Instagram', 'LinkedIn', 'Site', 'Outbound', 'Evento', 'Parceiro', 'Outro']

const BLANK: Omit<Cliente, 'id' | 'empresa_id' | 'created_at'> = {
  nome: '', tipo: 'pj', cnpj_cpf: '', email: '', telefone: '', whatsapp: '', website: '',
  segmento: '', responsavel_nome: '', status: 'prospect', origem: '', notas: '',
  endereco: '', cidade: '', estado: '', valor_contrato: null,
}

export default function ClientesPage() {
  const [empresaId, setEmpresaId] = useState('')
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [fSegmento, setFSegmento] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<Cliente | null>(null)
  const [form, setForm] = useState({ ...BLANK })
  const [saving, setSaving] = useState(false)
  const [detalhe, setDetalhe] = useState<Cliente | null>(null)
  const [contatos, setContatos] = useState<Contato[]>([])
  const [novoContato, setNovoContato] = useState({ nome: '', cargo: '', email: '', telefone: '', whatsapp: '', principal: false })
  const [savingContato, setSavingContato] = useState(false)
  const [view, setView] = useState<'lista' | 'kanban'>('lista')
  const [modalPortal, setModalPortal] = useState(false)
  const [portalClienteId, setPortalClienteId] = useState('')
  const [portalUrl, setPortalUrl] = useState('')
  const [portalLoading, setPortalLoading] = useState(false)
  const [portalCopiado, setPortalCopiado] = useState(false)

  const carregar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const u = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const eid = (u.data?.empresa_id as string) || user.id
    setEmpresaId(eid)
    const { data } = await supabase.from('clientes').select('*').eq('empresa_id', eid).order('created_at', { ascending: false })
    setClientes((data || []) as Cliente[])
    setLoading(false)
  }, [])

  useEffect(() => { void carregar() }, [carregar])

  async function carregarContatos(clienteId: string) {
    const { data } = await supabase.from('clientes_contatos').select('*').eq('cliente_id', clienteId).order('principal', { ascending: false })
    setContatos((data || []) as Contato[])
  }

  function abrirForm(c?: Cliente) {
    setEditItem(c || null)
    setForm(c ? { nome: c.nome, tipo: c.tipo, cnpj_cpf: c.cnpj_cpf || '', email: c.email || '', telefone: c.telefone || '', whatsapp: c.whatsapp || '', website: c.website || '', segmento: c.segmento || '', responsavel_nome: c.responsavel_nome || '', status: c.status, origem: c.origem || '', notas: c.notas || '', endereco: c.endereco || '', cidade: c.cidade || '', estado: c.estado || '', valor_contrato: c.valor_contrato } : { ...BLANK })
    setShowForm(true)
  }

  async function salvar() {
    if (!form.nome.trim()) return
    setSaving(true)
    const payload = { empresa_id: empresaId, ...form, cnpj_cpf: form.cnpj_cpf || null, email: form.email || null, telefone: form.telefone || null, whatsapp: form.whatsapp || null, website: form.website || null, segmento: form.segmento || null, responsavel_nome: form.responsavel_nome || null, origem: form.origem || null, notas: form.notas || null, endereco: form.endereco || null, cidade: form.cidade || null, estado: form.estado || null }
    if (editItem) await supabase.from('clientes').update(payload).eq('id', editItem.id)
    else await supabase.from('clientes').insert(payload)
    setSaving(false); setShowForm(false); void carregar()
  }

  async function excluir(id: string) {
    if (!confirm('Excluir este cliente?')) return
    await supabase.from('clientes').delete().eq('id', id); void carregar()
  }

  async function gerarPortal(clienteId: string) {
    setPortalClienteId(clienteId)
    setPortalUrl('')
    setPortalCopiado(false)
    setModalPortal(true)
    setPortalLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/clientes/gerar-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ cliente_id: clienteId }),
    })
    const json = await res.json() as { url?: string; error?: string }
    setPortalUrl(json.url ?? '')
    setPortalLoading(false)
  }

  async function salvarContato() {
    if (!novoContato.nome || !detalhe) return
    setSavingContato(true)
    await supabase.from('clientes_contatos').insert({ empresa_id: empresaId, cliente_id: detalhe.id, ...novoContato })
    setNovoContato({ nome: '', cargo: '', email: '', telefone: '', whatsapp: '', principal: false })
    await carregarContatos(detalhe.id)
    setSavingContato(false)
  }

  const filtrados = useMemo(() => clientes.filter(c =>
    (!fStatus || c.status === fStatus) &&
    (!fSegmento || c.segmento === fSegmento) &&
    (!busca || `${c.nome} ${c.email || ''} ${c.cnpj_cpf || ''}`.toLowerCase().includes(busca.toLowerCase()))
  ), [clientes, fStatus, fSegmento, busca])

  const kpis = useMemo(() => ({
    total: clientes.length,
    ativos: clientes.filter(c => c.status === 'ativo').length,
    prospects: clientes.filter(c => c.status === 'prospect').length,
    mrr: clientes.filter(c => c.status === 'ativo').reduce((s, c) => s + Number(c.valor_contrato || 0), 0),
  }), [clientes])

  const porStatus = useMemo(() => {
    const statuses = ['prospect', 'qualificado', 'ativo', 'inativo', 'churned']
    return statuses.map(s => ({ status: s, items: filtrados.filter(c => c.status === s) })).filter(g => g.items.length > 0 || g.status === 'prospect')
  }, [filtrados])

  const inp: React.CSSProperties = { width: '100%', border: '0.5px solid #E4DCCC', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#13201D', background: '#fff', boxSizing: 'border-box', outline: 'none' }
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#7B8C88', marginBottom: 4, display: 'block' }

  if (loading) return <div style={{ padding: 32, color: '#7B8C88' }}>Carregando…</div>

  return (
    <>
      <div className="page-hdr">
        <div>
          <div className="page-title">Clientes</div>
          <div className="page-sub">{kpis.total} clientes · {kpis.ativos} ativos · MRR {formatBRL(kpis.mrr)}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setView(v => v === 'lista' ? 'kanban' : 'lista')} className="btn-action btn-ghost">
            <i className={`fa-solid ${view === 'lista' ? 'fa-table-columns' : 'fa-list'}`} style={{ marginRight: 5 }} />{view === 'lista' ? 'Kanban' : 'Lista'}
          </button>
          <button className="btn-action" onClick={() => abrirForm()}>+ Novo cliente</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpis" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 16 }}>
        {[
          { l: 'Total', v: kpis.total, s: 'clientes', c: '#13201D' },
          { l: 'Ativos', v: kpis.ativos, s: 'com contrato', c: '#3D7A6E' },
          { l: 'Prospects', v: kpis.prospects, s: 'em pipeline', c: '#7A6A9E' },
          { l: 'MRR estimado', v: formatBRL(kpis.mrr), s: 'contratos ativos', c: '#3D7A6E' },
        ].map(k => (
          <div key={k.l} className="kpi">
            <div className="kpi-lbl">{k.l}</div>
            <div className="kpi-val" style={{ color: k.c }}>{k.v}</div>
            <div className="kpi-delta">{k.s}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
        <input className="form-input" placeholder="Buscar por nome, email, CNPJ…" value={busca} onChange={e => setBusca(e.target.value)} />
        <select className="form-input" value={fStatus} onChange={e => setFStatus(e.target.value)}>
          <option value="">Todos os status</option>
          {['prospect','ativo','inativo','churned'].map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <select className="form-input" value={fSegmento} onChange={e => setFSegmento(e.target.value)}>
          <option value="">Todos segmentos</option>
          {SEGMENTOS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Kanban view */}
      {view === 'kanban' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
          {['prospect','ativo','inativo','churned'].map(st => (
            <div key={st} style={{ background: '#fafafa', border: '0.5px solid #E4DCCC', borderRadius: 12, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: STATUS_COLOR[st], textTransform: 'uppercase', letterSpacing: '.06em' }}>{STATUS_LABEL[st]}</span>
                <span style={{ fontSize: 11, background: STATUS_BG[st], color: STATUS_COLOR[st], padding: '2px 7px', borderRadius: 20, fontWeight: 700 }}>{filtrados.filter(c => c.status === st).length}</span>
              </div>
              {filtrados.filter(c => c.status === st).map(c => (
                <div key={c.id} onClick={() => { setDetalhe(c); void carregarContatos(c.id) }} style={{ background: '#fff', border: '0.5px solid #E4DCCC', borderRadius: 8, padding: '10px 12px', marginBottom: 8, cursor: 'pointer' }}>
                  <p style={{ fontWeight: 700, fontSize: 12, color: '#13201D', margin: '0 0 2px' }}>{c.nome}</p>
                  {c.segmento && <p style={{ fontSize: 10, color: '#7B8C88', margin: 0 }}>{c.segmento}</p>}
                  {c.valor_contrato && <p style={{ fontSize: 11, color: '#3D7A6E', fontWeight: 700, margin: '4px 0 0' }}>{formatBRL(Number(c.valor_contrato))}</p>}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Lista view */}
      {view === 'lista' && (
        <div style={{ background: '#fff', border: '0.5px solid #E4DCCC', borderRadius: 12, overflow: 'hidden' }}>
          <div className="expenses-table">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>CNPJ/CPF</th>
                  <th>Segmento</th>
                  <th>Contato</th>
                  <th style={{ textAlign: 'right' }}>Contrato</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                  <th style={{ textAlign: 'center' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px 0', color: '#7B8C88', fontSize: 13 }}>
                    Nenhum cliente. <button onClick={() => abrirForm()} style={{ color: '#3D7A6E', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}>Adicionar →</button>
                  </td></tr>
                )}
                {filtrados.map(c => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ fontWeight: 700, fontSize: 12 }}>{c.nome}</div>
                      {c.email && <div style={{ fontSize: 10, color: '#7B8C88' }}>{c.email}</div>}
                    </td>
                    <td style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: '#7B8C88' }}>{c.cnpj_cpf || '—'}</td>
                    <td><span className="tag gray" style={{ fontSize: 9 }}>{c.segmento || '—'}</span></td>
                    <td style={{ fontSize: 12 }}>{c.telefone || c.whatsapp || '—'}</td>
                    <td style={{ textAlign: 'right', fontFamily: "'Inter', sans-serif", color: '#3D7A6E', fontWeight: 700, fontSize: 12 }}>
                      {c.valor_contrato ? formatBRL(Number(c.valor_contrato)) : '—'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: STATUS_BG[c.status], color: STATUS_COLOR[c.status] }}>
                        {STATUS_LABEL[c.status]}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                        <button className="btn-ghost" style={{ fontSize: 10, padding: '3px 8px' }} onClick={() => { setDetalhe(c); void carregarContatos(c.id) }}>Ver</button>
                        <button className="btn-ghost" style={{ fontSize: 10, padding: '3px 8px' }} onClick={() => abrirForm(c)}>Editar</button>
                        <button className="btn-ghost" style={{ fontSize: 10, padding: '3px 8px', color: '#3D7A6E' }} onClick={() => void gerarPortal(c.id)} title="Portal do cliente"><i className="fa-solid fa-link" /></button>
                        <button className="btn-ghost" style={{ fontSize: 10, padding: '3px 8px', color: '#B0413E' }} onClick={() => void excluir(c.id)}><i className="fa-solid fa-trash" style={{ fontSize: 9 }} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="modal-bg" onClick={() => setShowForm(false)}>
          <div className="modal-box" style={{ maxWidth: 620, maxHeight: '92vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 className="modal-title">{editItem ? 'Editar cliente' : 'Novo cliente'}</h3>
              <button className="modal-close" onClick={() => setShowForm(false)}><i className="fa-solid fa-xmark" /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={lbl}>Nome / Razão social *</label>
                <input style={inp} placeholder="Nome do cliente" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
              </div>
              <div>
                <label style={lbl}>Tipo</label>
                <select style={inp} value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value as 'pj' | 'pf' }))}>
                  <option value="pj">Pessoa Jurídica</option>
                  <option value="pf">Pessoa Física</option>
                </select>
              </div>
              <div>
                <label style={lbl}>CNPJ / CPF</label>
                <input style={inp} placeholder="00.000.000/0001-00" value={form.cnpj_cpf} onChange={e => setForm(f => ({ ...f, cnpj_cpf: maskCpfCnpj(e.target.value) }))} />
              </div>
              <div>
                <label style={lbl}>E-mail</label>
                <input style={inp} type="email" placeholder="email@empresa.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label style={lbl}>Telefone</label>
                <input style={inp} placeholder="(11) 9999-9999" value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} />
              </div>
              <div>
                <label style={lbl}>WhatsApp</label>
                <input style={inp} placeholder="(11) 99999-9999" value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} />
              </div>
              <div>
                <label style={lbl}>Website</label>
                <input style={inp} placeholder="https://empresa.com" value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} />
              </div>
              <div>
                <label style={lbl}>Segmento</label>
                <select style={inp} value={form.segmento} onChange={e => setForm(f => ({ ...f, segmento: e.target.value }))}>
                  <option value="">— Selecionar —</option>
                  {SEGMENTOS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Origem</label>
                <select style={inp} value={form.origem} onChange={e => setForm(f => ({ ...f, origem: e.target.value }))}>
                  <option value="">— Selecionar —</option>
                  {ORIGENS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Status</label>
                <select style={inp} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as Cliente['status'] }))}>
                  {['prospect','ativo','inativo','churned'].map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Responsável</label>
                <input style={inp} placeholder="Nome do responsável" value={form.responsavel_nome} onChange={e => setForm(f => ({ ...f, responsavel_nome: e.target.value }))} />
              </div>
              <div>
                <label style={lbl}>Valor contrato/mês (R$)</label>
                <input style={inp} type="number" min={0} step={0.01} placeholder="0,00" value={form.valor_contrato || ''} onChange={e => setForm(f => ({ ...f, valor_contrato: e.target.value ? Number(e.target.value) : null }))} />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={lbl}>Endereço</label>
                <input style={inp} placeholder="Rua, nº, bairro" value={form.endereco} onChange={e => setForm(f => ({ ...f, endereco: e.target.value }))} />
              </div>
              <div>
                <label style={lbl}>Cidade</label>
                <input style={inp} placeholder="São Paulo" value={form.cidade} onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))} />
              </div>
              <div>
                <label style={lbl}>Estado</label>
                <input style={inp} placeholder="SP" maxLength={2} value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value.toUpperCase() }))} />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={lbl}>Notas internas</label>
                <textarea style={{ ...inp, minHeight: 60, resize: 'vertical' }} placeholder="Observações, contexto, histórico" value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />
              </div>
            </div>
            <div className="modal-actions" style={{ marginTop: 20 }}>
              <button className="btn-ghost" onClick={() => setShowForm(false)}>Cancelar</button>
              <button className="btn-action" disabled={saving} onClick={() => void salvar()}>{saving ? 'Salvando…' : editItem ? 'Salvar' : 'Criar cliente'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal portal do cliente */}
      {modalPortal && (
        <div className="modal-bg" onClick={() => setModalPortal(false)}>
          <div className="modal-box" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 className="modal-title">Portal do Cliente</h3>
              <button className="modal-close" onClick={() => setModalPortal(false)}><i className="fa-solid fa-xmark" /></button>
            </div>
            {portalLoading ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: '#7B8C88' }}>
                <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 24, marginBottom: 10, display: 'block' }} />
                Gerando link seguro…
              </div>
            ) : portalUrl ? (
              <>
                <p style={{ fontSize: 13, color: '#7B8C88', marginBottom: 16 }}>
                  Compartilhe este link com o cliente. Ele terá acesso somente leitura às faturas, entregas e contratos. O link expira em 90 dias.
                </p>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: '#f8fafc', border: '0.5px solid #E4DCCC', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
                  <span style={{ flex: 1, fontSize: 12, fontFamily: 'monospace', color: '#13201D', wordBreak: 'break-all' }}>{portalUrl}</span>
                  <button
                    className="btn-ghost"
                    style={{ fontSize: 11, flexShrink: 0 }}
                    onClick={() => { void navigator.clipboard.writeText(portalUrl); setPortalCopiado(true) }}
                  >
                    {portalCopiado ? <><i className="fa-solid fa-check" style={{ marginRight: 4, color: '#3D7A6E' }} />Copiado</> : <><i className="fa-regular fa-copy" style={{ marginRight: 4 }} />Copiar</>}
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <a href={portalUrl} target="_blank" rel="noreferrer" className="btn-ghost" style={{ fontSize: 12, textDecoration: 'none' }}>
                    <i className="fa-solid fa-arrow-up-right-from-square" style={{ marginRight: 5 }} />Abrir portal
                  </a>
                  <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => void gerarPortal(portalClienteId)}>
                    <i className="fa-solid fa-rotate" style={{ marginRight: 5 }} />Novo link
                  </button>
                </div>
              </>
            ) : (
              <p style={{ textAlign: 'center', color: '#B0413E', fontSize: 13 }}>Erro ao gerar link. Tente novamente.</p>
            )}
          </div>
        </div>
      )}

      {/* Detalhe / ficha do cliente */}
      {detalhe && (
        <div className="modal-bg" onClick={() => setDetalhe(null)}>
          <div className="modal-box" style={{ maxWidth: 620, maxHeight: '92vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: '#13201D', fontFamily: "'Inter', sans-serif", margin: 0 }}>{detalhe.nome}</h3>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: STATUS_BG[detalhe.status], color: STATUS_COLOR[detalhe.status] }}>{STATUS_LABEL[detalhe.status]}</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => { setDetalhe(null); abrirForm(detalhe) }}>Editar</button>
                <button className="modal-close" onClick={() => setDetalhe(null)}><i className="fa-solid fa-xmark" /></button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 20px', marginBottom: 20 }}>
              {[
                ['CNPJ/CPF', detalhe.cnpj_cpf], ['E-mail', detalhe.email], ['Telefone', detalhe.telefone],
                ['WhatsApp', detalhe.whatsapp], ['Segmento', detalhe.segmento], ['Origem', detalhe.origem],
                ['Responsável', detalhe.responsavel_nome], ['Contrato/mês', detalhe.valor_contrato ? formatBRL(Number(detalhe.valor_contrato)) : null],
                ['Cidade', detalhe.cidade ? `${detalhe.cidade}/${detalhe.estado}` : null],
              ].filter(([, v]) => v).map(([k, v]) => (
                <div key={String(k)}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#7B8C88', textTransform: 'uppercase', letterSpacing: '.06em' }}>{k}</span>
                  <p style={{ fontSize: 13, color: '#13201D', margin: '2px 0 0', fontWeight: 500 }}>{String(v)}</p>
                </div>
              ))}
            </div>
            {detalhe.notas && (
              <div style={{ padding: '10px 14px', background: '#fafafa', borderRadius: 8, border: '0.5px solid #E4DCCC', fontSize: 12, color: '#7B8C88', marginBottom: 16 }}>
                {detalhe.notas}
              </div>
            )}

            {/* Contatos */}
            <div style={{ borderTop: '0.5px solid #E4DCCC', paddingTop: 16 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#13201D', marginBottom: 10 }}>Contatos</p>
              {contatos.map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '0.5px solid #E4DCCC' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#F1ECE1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 13, fontWeight: 700, color: '#13201D' }}>
                    {c.nome[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#13201D', margin: 0 }}>{c.nome} {c.principal && <span style={{ fontSize: 9, color: '#3D7A6E', fontWeight: 700 }}>● Principal</span>}</p>
                    <p style={{ fontSize: 11, color: '#7B8C88', margin: 0 }}>{[c.cargo, c.email, c.telefone].filter(Boolean).join(' · ')}</p>
                  </div>
                </div>
              ))}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8, marginTop: 12 }}>
                <input style={{ border: '0.5px solid #E4DCCC', borderRadius: 7, padding: '6px 10px', fontSize: 12 }} placeholder="Nome do contato" value={novoContato.nome} onChange={e => setNovoContato(f => ({ ...f, nome: e.target.value }))} />
                <input style={{ border: '0.5px solid #E4DCCC', borderRadius: 7, padding: '6px 10px', fontSize: 12 }} placeholder="Cargo" value={novoContato.cargo} onChange={e => setNovoContato(f => ({ ...f, cargo: e.target.value }))} />
                <input style={{ border: '0.5px solid #E4DCCC', borderRadius: 7, padding: '6px 10px', fontSize: 12 }} placeholder="E-mail" value={novoContato.email} onChange={e => setNovoContato(f => ({ ...f, email: e.target.value }))} />
              </div>
              <button className="btn-ghost" style={{ marginTop: 8, fontSize: 12 }} disabled={savingContato} onClick={() => void salvarContato()}>
                {savingContato ? 'Salvando…' : '+ Adicionar contato'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
