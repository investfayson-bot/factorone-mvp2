'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'
import toast from 'react-hot-toast'

type FornecedorCad = {
  id: string
  razao_social: string
  nome_fantasia: string | null
  cnpj: string | null
  email: string | null
  telefone: string | null
  whatsapp: string | null
  categoria: string
  contato_nome: string | null
  contato_cargo: string | null
  tipo_pagamento_pref: string
  chave_pix: string | null
  prazo_pagamento: number
  status: string
  avaliacao: number | null
  notas: string | null
  cidade: string | null
  estado: string | null
}

type ContaPagar = {
  id: string
  descricao: string
  fornecedor_nome: string
  fornecedor_documento: string | null
  categoria: string
  valor: number
  valor_pago: number
  data_vencimento: string
  data_pagamento: string | null
  tipo_pagamento: string | null
  chave_pix: string | null
  codigo_barras: string | null
  status: 'pendente' | 'vencida' | 'paga' | 'parcialmente_paga' | 'cancelada'
  observacoes: string | null
}

type NovaContaForm = {
  descricao: string
  fornecedor_nome: string
  fornecedor_documento: string
  categoria: string
  valor: string
  data_vencimento: string
  tipo_pagamento: string
  chave_pix: string
  codigo_barras: string
  observacoes: string
}

const STATUS_TAG: Record<string, string> = {
  pendente: 'gray',
  vencida: 'red',
  paga: 'green',
  parcialmente_paga: 'green',
  cancelada: 'gray',
}

const STATUS_LABEL: Record<string, string> = {
  pendente: 'Pendente',
  vencida: 'Vencida',
  paga: 'Paga',
  parcialmente_paga: 'Parcial',
  cancelada: 'Cancelada',
}

const CATS = ['Fornecedores', 'Marketing', 'Tecnologia/Software', 'Folha de Pagamento', 'Aluguel/Infraestrutura', 'Impostos/Taxas', 'Consultoria', 'Transporte', 'Outros']

function isVencida(c: ContaPagar) {
  if (c.status === 'paga' || c.status === 'cancelada') return false
  return new Date(c.data_vencimento) < new Date()
}

export default function FornecedoresPage() {
  const [empresaId, setEmpresaId] = useState('')
  const [contas, setContas] = useState<ContaPagar[]>([])
  const [tab, setTab] = useState<'fornecedores' | 'contas' | 'pagar' | 'cadastro'>('fornecedores')
  const [fornecedoresCad, setFornecedoresCad] = useState<FornecedorCad[]>([])
  const [modalForn, setModalForn] = useState(false)
  const [fornForm, setFornForm] = useState({
    razao_social: '', nome_fantasia: '', cnpj: '', email: '', telefone: '', whatsapp: '',
    categoria: 'Fornecedores', contato_nome: '', contato_cargo: '', cidade: '', estado: '',
    tipo_pagamento_pref: 'pix', chave_pix: '', prazo_pagamento: '30', avaliacao: '0', notas: '',
  })
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [busca, setBusca] = useState('')
  const [modalNova, setModalNova] = useState(false)
  const [modalPagar, setModalPagar] = useState<ContaPagar | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<NovaContaForm>({
    descricao: '', fornecedor_nome: '', fornecedor_documento: '', categoria: 'Fornecedores',
    valor: '', data_vencimento: '', tipo_pagamento: 'pix', chave_pix: '', codigo_barras: '', observacoes: '',
  })
  const [valorPagamento, setValorPagamento] = useState('')
  const [dataPagamento, setDataPagamento] = useState(new Date().toISOString().slice(0, 10))
  const [modalLink, setModalLink] = useState(false)
  const [linkGerado, setLinkGerado] = useState('')
  const [linkForm, setLinkForm] = useState({ descricao: '', valor: '', data_vencimento: '', categoria: 'Fornecedores' })
  const [linkSaving, setLinkSaving] = useState(false)

  const carregar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const eid = (u?.empresa_id as string) || user.id
    setEmpresaId(eid)
    const [{ data: contasData }, { data: fornsData }] = await Promise.all([
      supabase
        .from('contas_pagar')
        .select('id,descricao,fornecedor_nome,fornecedor_documento,categoria,valor,valor_pago,data_vencimento,data_pagamento,tipo_pagamento,chave_pix,codigo_barras,status,observacoes')
        .eq('empresa_id', eid)
        .order('data_vencimento', { ascending: false }),
      supabase
        .from('fornecedores')
        .select('*')
        .eq('empresa_id', eid)
        .order('razao_social'),
    ])
    setContas((contasData || []) as ContaPagar[])
    setFornecedoresCad((fornsData || []) as FornecedorCad[])
  }, [])

  useEffect(() => { void carregar() }, [carregar])

  const contasFiltradas = useMemo(() => contas.filter(c => {
    const matchStatus = filtroStatus === 'todos' || c.status === filtroStatus
    const matchBusca = !busca || `${c.fornecedor_nome} ${c.descricao} ${c.categoria}`.toLowerCase().includes(busca.toLowerCase())
    return matchStatus && matchBusca
  }), [contas, filtroStatus, busca])

  const fornecedoresAgrupados = useMemo(() => {
    const map = new Map<string, { nome: string; doc: string | null; total: number; pendente: number; qtd: number; vencidas: number }>()
    for (const c of contas) {
      const f = map.get(c.fornecedor_nome) || { nome: c.fornecedor_nome, doc: c.fornecedor_documento, total: 0, pendente: 0, qtd: 0, vencidas: 0 }
      f.total += Number(c.valor || 0)
      f.qtd++
      if (c.status === 'pendente' || c.status === 'vencida' || c.status === 'parcialmente_paga') {
        f.pendente += Number(c.valor || 0) - Number(c.valor_pago || 0)
      }
      if (isVencida(c)) f.vencidas++
      map.set(c.fornecedor_nome, f)
    }
    return Array.from(map.values()).sort((a, b) => b.pendente - a.pendente)
  }, [contas])

  const totalPendente = contas.filter(c => c.status === 'pendente' || c.status === 'vencida').reduce((s, c) => s + Number(c.valor || 0) - Number(c.valor_pago || 0), 0)
  const totalVencido = contas.filter(c => isVencida(c)).reduce((s, c) => s + Number(c.valor || 0) - Number(c.valor_pago || 0), 0)
  const totalMes = contas.filter(c => c.data_vencimento?.startsWith(new Date().toISOString().slice(0, 7))).reduce((s, c) => s + Number(c.valor || 0), 0)

  async function salvarNova() {
    if (!form.descricao || !form.fornecedor_nome || !form.valor || !form.data_vencimento) return
    setSaving(true)
    await supabase.from('contas_pagar').insert({
      empresa_id: empresaId,
      descricao: form.descricao,
      fornecedor_nome: form.fornecedor_nome,
      fornecedor_documento: form.fornecedor_documento || null,
      categoria: form.categoria,
      valor: Number(form.valor.replace(',', '.')),
      data_vencimento: form.data_vencimento,
      tipo_pagamento: form.tipo_pagamento || null,
      chave_pix: form.chave_pix || null,
      codigo_barras: form.codigo_barras || null,
      observacoes: form.observacoes || null,
      status: 'pendente',
    })
    setSaving(false)
    setModalNova(false)
    setForm({ descricao: '', fornecedor_nome: '', fornecedor_documento: '', categoria: 'Fornecedores', valor: '', data_vencimento: '', tipo_pagamento: 'pix', chave_pix: '', codigo_barras: '', observacoes: '' })
    await carregar()
  }

  async function registrarPagamento() {
    if (!modalPagar) return
    const v = Number(valorPagamento.replace(',', '.'))
    if (!v || !dataPagamento) return
    setSaving(true)
    try {
      // usa o endpoint oficial: marca a conta, lança a saída no caixa (transacoes) e recalcula o DRE
      const { data: sess } = await supabase.auth.getSession()
      const res = await fetch(`/api/financeiro/pagar/${modalPagar.id}/pagar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(sess.session?.access_token ? { Authorization: `Bearer ${sess.session.access_token}` } : {}) },
        body: JSON.stringify({ valor_pago: v, data_pagamento: dataPagamento, tipo_pagamento: modalPagar.tipo_pagamento }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Falha ao registrar pagamento') }
      toast.success(`Pagamento de ${formatBRL(v)} lançado no caixa.`)
      setModalPagar(null)
      setValorPagamento('')
      await carregar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao registrar pagamento')
    } finally {
      setSaving(false)
    }
  }

  async function cancelarConta(id: string) {
    await supabase.from('contas_pagar').update({ status: 'cancelada' }).eq('id', id)
    await carregar()
  }

  async function salvarFornecedor() {
    if (!fornForm.razao_social) return
    setSaving(true)
    await supabase.from('fornecedores').insert({
      empresa_id: empresaId,
      razao_social: fornForm.razao_social,
      nome_fantasia: fornForm.nome_fantasia || null,
      cnpj: fornForm.cnpj || null,
      email: fornForm.email || null,
      telefone: fornForm.telefone || null,
      whatsapp: fornForm.whatsapp || null,
      categoria: fornForm.categoria,
      contato_nome: fornForm.contato_nome || null,
      contato_cargo: fornForm.contato_cargo || null,
      cidade: fornForm.cidade || null,
      estado: fornForm.estado || null,
      tipo_pagamento_pref: fornForm.tipo_pagamento_pref,
      chave_pix: fornForm.chave_pix || null,
      prazo_pagamento: parseInt(fornForm.prazo_pagamento) || 30,
      avaliacao: parseInt(fornForm.avaliacao) || null,
      notas: fornForm.notas || null,
    })
    setSaving(false)
    setModalForn(false)
    setFornForm({ razao_social: '', nome_fantasia: '', cnpj: '', email: '', telefone: '', whatsapp: '', categoria: 'Fornecedores', contato_nome: '', contato_cargo: '', cidade: '', estado: '', tipo_pagamento_pref: 'pix', chave_pix: '', prazo_pagamento: '30', avaliacao: '0', notas: '' })
    await carregar()
  }

  async function gerarLink() {
    setLinkSaving(true)
    try {
      const { data: sess } = await supabase.auth.getSession()
      const res = await fetch('/api/fornecedores/gerar-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(sess.session?.access_token ? { Authorization: `Bearer ${sess.session.access_token}` } : {}) },
        body: JSON.stringify({ descricao: linkForm.descricao || undefined, valor: linkForm.valor ? Number(linkForm.valor.replace(',', '.')) : undefined, data_vencimento: linkForm.data_vencimento || undefined, categoria: linkForm.categoria }),
      })
      const out = await res.json() as { url?: string; error?: string }
      if (out.url) setLinkGerado(out.url)
      else alert(out.error || 'Erro ao gerar link')
    } finally {
      setLinkSaving(false)
    }
  }

  return (
    <>
      <div className="page-hdr">
        <div>
          <div className="page-title">Fornecedores & Pagamentos</div>
          <div className="page-sub">Gestão de contas a pagar · {fornecedoresAgrupados.length} fornecedores</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }} onClick={() => { setModalLink(true); setLinkGerado(''); setLinkForm({ descricao: '', valor: '', data_vencimento: '', categoria: 'Fornecedores' }) }}>
            <i className="fa-solid fa-link" style={{ fontSize: 11 }} />
            Link de cobrança
          </button>
          <button className="btn-ghost" onClick={() => { setModalForn(true) }}>
            <i className="fa-solid fa-user-plus" style={{ fontSize: 11 }} /> Cadastrar Fornecedor
          </button>
          <button className="btn-action" onClick={() => setModalNova(true)}>+ Nova Conta a Pagar</button>
        </div>
      </div>

      <div className="kpis" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="kpi">
          <div className="kpi-lbl">Fornecedores</div>
          <div className="kpi-val">{fornecedoresAgrupados.length}</div>
          <div className="kpi-delta">cadastrados</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">A pagar total</div>
          <div className="kpi-val" style={{ color: 'var(--navy)' }}>{formatBRL(totalPendente)}</div>
          <div className="kpi-delta dn">em aberto</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Vencido</div>
          <div className="kpi-val" style={{ color: totalVencido > 0 ? 'var(--red)' : 'var(--navy)' }}>{formatBRL(totalVencido)}</div>
          <div className={`kpi-delta ${totalVencido > 0 ? 'dn' : 'up'}`}>{totalVencido > 0 ? 'atraso' : 'saudável'}</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Vence este mês</div>
          <div className="kpi-val">{formatBRL(totalMes)}</div>
          <div className="kpi-delta">mês atual</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
        {([['cadastro', 'Cadastro'], ['fornecedores', 'Por Fornecedor'], ['contas', 'Contas a Pagar'], ['pagar', 'Histórico Pagamentos']] as [string, string][]).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k as typeof tab)} style={{
            padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid',
            background: tab === k ? 'var(--navy)' : '#fff',
            color: tab === k ? '#fff' : 'var(--gray-500)',
            borderColor: tab === k ? 'var(--navy)' : 'var(--gray-100)',
          }}>{l}</button>
        ))}
      </div>

      {/* Tab: Cadastro de fornecedores (standalone) */}
      {tab === 'cadastro' && (
        <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, overflow: 'hidden' }}>
          <div className="expenses-table">
            <table>
              <thead>
                <tr>
                  <th>Razão Social</th><th>CNPJ</th><th>Categoria</th><th>Contato</th>
                  <th>Cidade/UF</th><th>Pagamento</th><th>Avaliação</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {fornecedoresCad.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '32px 0' }}>
                    Nenhum fornecedor cadastrado. Use o botão &quot;Cadastrar Fornecedor&quot; acima.
                  </td></tr>
                )}
                {fornecedoresCad.map(f => (
                  <tr key={f.id}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{f.razao_social}</div>
                      {f.nome_fantasia && <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{f.nome_fantasia}</div>}
                    </td>
                    <td style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: 11 }}>{f.cnpj || '—'}</td>
                    <td><span className="tag gray" style={{ fontSize: 10 }}>{f.categoria}</span></td>
                    <td>
                      <div style={{ fontSize: 12 }}>{f.contato_nome || '—'}</div>
                      {f.contato_cargo && <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{f.contato_cargo}</div>}
                    </td>
                    <td style={{ fontSize: 12 }}>{f.cidade ? `${f.cidade}/${f.estado}` : '—'}</td>
                    <td>
                      <div style={{ fontSize: 11 }}>{f.tipo_pagamento_pref?.toUpperCase()}</div>
                      {f.prazo_pagamento && <div style={{ fontSize: 10, color: 'var(--gray-400)' }}>{f.prazo_pagamento}d prazo</div>}
                    </td>
                    <td>
                      {f.avaliacao ? (
                        <span style={{ color: 'var(--gold)', fontSize: 13, letterSpacing: -1 }}>
                          {'★'.repeat(f.avaliacao)}{'☆'.repeat(5 - f.avaliacao)}
                        </span>
                      ) : '—'}
                    </td>
                    <td>
                      <span className={`tag ${f.status === 'ativo' ? 'green' : f.status === 'bloqueado' ? 'red' : 'gray'}`} style={{ fontSize: 10 }}>
                        {f.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Fornecedores agrupados */}
      {tab === 'fornecedores' && (
        <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, overflow: 'hidden' }}>
          <div className="expenses-table">
            <table>
              <thead>
                <tr>
                  <th>Fornecedor</th>
                  <th>CNPJ/CPF</th>
                  <th style={{ textAlign: 'center' }}>Contas</th>
                  <th style={{ textAlign: 'right' }}>Total contratado</th>
                  <th style={{ textAlign: 'right' }}>A pagar</th>
                  <th style={{ textAlign: 'center' }}>Vencidas</th>
                  <th style={{ textAlign: 'center' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {fornecedoresAgrupados.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '32px 0' }}>Nenhum fornecedor cadastrado.</td></tr>
                )}
                {fornecedoresAgrupados.map(f => (
                  <tr key={f.nome}>
                    <td style={{ fontWeight: 700 }}>{f.nome}</td>
                    <td style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: 11, color: 'var(--gray-400)' }}>{f.doc || '—'}</td>
                    <td style={{ textAlign: 'center' }}>{f.qtd}</td>
                    <td style={{ textAlign: 'right', fontFamily: "'Inter', system-ui, sans-serif" }}>{formatBRL(f.total)}</td>
                    <td style={{ textAlign: 'right', fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 700, color: f.pendente > 0 ? 'var(--red)' : 'var(--navy)' }}>{formatBRL(f.pendente)}</td>
                    <td style={{ textAlign: 'center' }}>
                      {f.vencidas > 0 ? <span className="tag red">{f.vencidas}</span> : <span style={{ color: 'var(--gray-400)', fontSize: 11 }}>—</span>}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button className="btn-ghost" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => { setBusca(f.nome); setTab('contas') }}>
                        Ver contas
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Contas a Pagar */}
      {tab === 'contas' && (
        <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--gray-100)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--gray-400)', letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: "'Inter', system-ui, sans-serif", flex: 1 }}>
              Contas ({contasFiltradas.length})
            </div>
            <select className="form-input" style={{ width: 'auto', padding: '5px 10px', fontSize: 11 }} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
              <option value="todos">Todos status</option>
              <option value="pendente">Pendente</option>
              <option value="vencida">Vencida</option>
              <option value="paga">Paga</option>
              <option value="cancelada">Cancelada</option>
            </select>
            <input className="form-input" style={{ width: 180, padding: '5px 10px', fontSize: 11 }} placeholder="Buscar fornecedor..." value={busca} onChange={e => setBusca(e.target.value)} />
          </div>
          <div className="expenses-table">
            <table>
              <thead>
                <tr>
                  <th>Fornecedor</th>
                  <th>Descrição</th>
                  <th>Categoria</th>
                  <th>Vencimento</th>
                  <th style={{ textAlign: 'right' }}>Valor</th>
                  <th style={{ textAlign: 'right' }}>Pago</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                  <th style={{ textAlign: 'center' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {contasFiltradas.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '32px 0' }}>Nenhuma conta encontrada.</td></tr>
                )}
                {contasFiltradas.map(c => (
                  <tr key={c.id} style={{ opacity: c.status === 'cancelada' ? 0.5 : 1 }}>
                    <td style={{ fontWeight: 600, fontSize: 12 }}>{c.fornecedor_nome}</td>
                    <td style={{ fontSize: 12, color: 'var(--gray-500)' }}>{c.descricao}</td>
                    <td><span className="tag gray" style={{ fontSize: 10 }}>{c.categoria}</span></td>
                    <td style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: 11, color: isVencida(c) ? 'var(--red)' : 'inherit' }}>
                      {new Date(c.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 700 }}>{formatBRL(Number(c.valor || 0))}</td>
                    <td style={{ textAlign: 'right', fontFamily: "'Inter', system-ui, sans-serif", color: 'var(--teal)' }}>
                      {Number(c.valor_pago || 0) > 0 ? formatBRL(Number(c.valor_pago)) : '—'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`tag ${STATUS_TAG[c.status] || 'gray'}`}>{STATUS_LABEL[c.status] || c.status}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
                        {(c.status === 'pendente' || c.status === 'vencida' || c.status === 'parcialmente_paga') && (
                          <button className="btn-action" style={{ fontSize: 10, padding: '3px 8px' }} onClick={() => { setModalPagar(c); setValorPagamento(String(Number(c.valor || 0) - Number(c.valor_pago || 0))) }}>
                            Pagar
                          </button>
                        )}
                        {c.status !== 'cancelada' && c.status !== 'paga' && (
                          <button className="btn-ghost" style={{ fontSize: 10, padding: '3px 8px', color: 'var(--red)', borderColor: 'rgba(192,80,74,.2)' }} onClick={() => void cancelarConta(c.id)}>
                            Cancelar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Histórico Pagamentos */}
      {tab === 'pagar' && (
        <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, overflow: 'hidden' }}>
          <div className="expenses-table">
            <table>
              <thead>
                <tr>
                  <th>Fornecedor</th>
                  <th>Descrição</th>
                  <th>Data Pagamento</th>
                  <th>Forma</th>
                  <th style={{ textAlign: 'right' }}>Valor Pago</th>
                </tr>
              </thead>
              <tbody>
                {contas.filter(c => c.status === 'paga' || c.status === 'parcialmente_paga').length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '32px 0' }}>Nenhum pagamento registrado.</td></tr>
                )}
                {contas.filter(c => c.status === 'paga' || c.status === 'parcialmente_paga').map(c => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.fornecedor_nome}</td>
                    <td style={{ color: 'var(--gray-500)', fontSize: 12 }}>{c.descricao}</td>
                    <td style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: 11 }}>
                      {c.data_pagamento ? new Date(c.data_pagamento + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td>{c.tipo_pagamento ? <span className="tag gray">{c.tipo_pagamento.toUpperCase()}</span> : '—'}</td>
                    <td style={{ textAlign: 'right', fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 700, color: 'var(--teal)' }}>
                      {formatBRL(Number(c.valor_pago || 0))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal cadastrar fornecedor */}
      {modalForn && (
        <div className="modal-bg" onClick={() => setModalForn(false)}>
          <div className="modal-box" style={{ width: 600, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">
              Cadastrar Fornecedor
              <button className="modal-close" onClick={() => setModalForn(false)}>×</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Razão Social *</label>
                <input className="form-input" value={fornForm.razao_social} onChange={e => setFornForm(f => ({ ...f, razao_social: e.target.value }))} placeholder="Nome completo da empresa" />
              </div>
              <div>
                <label className="form-label">Nome Fantasia</label>
                <input className="form-input" value={fornForm.nome_fantasia} onChange={e => setFornForm(f => ({ ...f, nome_fantasia: e.target.value }))} placeholder="Como é conhecido" />
              </div>
              <div>
                <label className="form-label">CNPJ</label>
                <input className="form-input" value={fornForm.cnpj} onChange={e => setFornForm(f => ({ ...f, cnpj: e.target.value }))} placeholder="00.000.000/0001-00" />
              </div>
              <div>
                <label className="form-label">E-mail</label>
                <input className="form-input" type="email" value={fornForm.email} onChange={e => setFornForm(f => ({ ...f, email: e.target.value }))} placeholder="contato@fornecedor.com" />
              </div>
              <div>
                <label className="form-label">Telefone</label>
                <input className="form-input" value={fornForm.telefone} onChange={e => setFornForm(f => ({ ...f, telefone: e.target.value }))} placeholder="(11) 99999-9999" />
              </div>
              <div>
                <label className="form-label">WhatsApp</label>
                <input className="form-input" value={fornForm.whatsapp} onChange={e => setFornForm(f => ({ ...f, whatsapp: e.target.value }))} placeholder="(11) 99999-9999" />
              </div>
              <div>
                <label className="form-label">Categoria</label>
                <select className="form-input" value={fornForm.categoria} onChange={e => setFornForm(f => ({ ...f, categoria: e.target.value }))}>
                  {CATS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Contato Principal</label>
                <input className="form-input" value={fornForm.contato_nome} onChange={e => setFornForm(f => ({ ...f, contato_nome: e.target.value }))} placeholder="Nome do contato" />
              </div>
              <div>
                <label className="form-label">Cargo do Contato</label>
                <input className="form-input" value={fornForm.contato_cargo} onChange={e => setFornForm(f => ({ ...f, contato_cargo: e.target.value }))} placeholder="Diretor comercial..." />
              </div>
              <div>
                <label className="form-label">Cidade</label>
                <input className="form-input" value={fornForm.cidade} onChange={e => setFornForm(f => ({ ...f, cidade: e.target.value }))} placeholder="São Paulo" />
              </div>
              <div>
                <label className="form-label">Estado (UF)</label>
                <input className="form-input" value={fornForm.estado} onChange={e => setFornForm(f => ({ ...f, estado: e.target.value }))} placeholder="SP" maxLength={2} />
              </div>
              <div>
                <label className="form-label">Forma de Pagamento Preferida</label>
                <select className="form-input" value={fornForm.tipo_pagamento_pref} onChange={e => setFornForm(f => ({ ...f, tipo_pagamento_pref: e.target.value }))}>
                  <option value="pix">PIX</option>
                  <option value="ted">TED</option>
                  <option value="boleto">Boleto</option>
                  <option value="cartao">Cartão</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>
              <div>
                <label className="form-label">Prazo de Pagamento (dias)</label>
                <input className="form-input" type="number" value={fornForm.prazo_pagamento} onChange={e => setFornForm(f => ({ ...f, prazo_pagamento: e.target.value }))} placeholder="30" />
              </div>
              {fornForm.tipo_pagamento_pref === 'pix' && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Chave PIX</label>
                  <input className="form-input" value={fornForm.chave_pix} onChange={e => setFornForm(f => ({ ...f, chave_pix: e.target.value }))} placeholder="CNPJ, CPF, e-mail ou chave aleatória" />
                </div>
              )}
              <div>
                <label className="form-label">Avaliação (1-5)</label>
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} type="button" onClick={() => setFornForm(f => ({ ...f, avaliacao: String(n) }))} style={{
                      fontSize: 20, background: 'none', border: 'none', cursor: 'pointer',
                      color: parseInt(fornForm.avaliacao) >= n ? 'var(--gold)' : '#d1d5db',
                    }}>★</button>
                  ))}
                </div>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Notas</label>
                <textarea className="form-input" rows={2} value={fornForm.notas} onChange={e => setFornForm(f => ({ ...f, notas: e.target.value }))} placeholder="Observações sobre o fornecedor..." style={{ resize: 'vertical' }} />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setModalForn(false)}>Cancelar</button>
              <button className="btn-action" style={{ opacity: saving ? 0.6 : 1 }} disabled={saving} onClick={() => void salvarFornecedor()}>
                {saving ? 'Salvando…' : 'Cadastrar Fornecedor'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal nova conta */}
      {modalNova && (
        <div className="modal-bg" onClick={() => setModalNova(false)}>
          <div className="modal-box" style={{ width: 560 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">
              Nova Conta a Pagar
              <button className="modal-close" onClick={() => setModalNova(false)}>×</button>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Fornecedor *</label>
                <input className="form-input" placeholder="Nome do fornecedor" value={form.fornecedor_nome} onChange={e => setForm(f => ({ ...f, fornecedor_nome: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">CNPJ/CPF</label>
                <input className="form-input" placeholder="00.000.000/0001-00" value={form.fornecedor_documento} onChange={e => setForm(f => ({ ...f, fornecedor_documento: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Descrição *</label>
              <input className="form-input" placeholder="Descrição do pagamento" value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Categoria</label>
                <select className="form-input" value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
                  {CATS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Valor (R$) *</label>
                <input className="form-input" placeholder="0,00" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Vencimento *</label>
                <input type="date" className="form-input" value={form.data_vencimento} onChange={e => setForm(f => ({ ...f, data_vencimento: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Forma de pagamento</label>
                <select className="form-input" value={form.tipo_pagamento} onChange={e => setForm(f => ({ ...f, tipo_pagamento: e.target.value }))}>
                  <option value="pix">PIX</option>
                  <option value="ted">TED</option>
                  <option value="boleto">Boleto</option>
                  <option value="cartao">Cartão</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
            </div>
            {form.tipo_pagamento === 'pix' && (
              <div className="form-group">
                <label className="form-label">Chave PIX</label>
                <input className="form-input" placeholder="CNPJ, CPF, email ou chave aleatória" value={form.chave_pix} onChange={e => setForm(f => ({ ...f, chave_pix: e.target.value }))} />
              </div>
            )}
            {form.tipo_pagamento === 'boleto' && (
              <div className="form-group">
                <label className="form-label">Código de barras</label>
                <input className="form-input" placeholder="Linha digitável" value={form.codigo_barras} onChange={e => setForm(f => ({ ...f, codigo_barras: e.target.value }))} />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Observações</label>
              <input className="form-input" placeholder="Observações opcionais" value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} />
            </div>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setModalNova(false)}>Cancelar</button>
              <button className="btn-action" style={{ opacity: saving ? 0.6 : 1 }} disabled={saving} onClick={() => void salvarNova()}>
                {saving ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal gerar link de cobrança */}
      {modalLink && (
        <div className="modal-bg" onClick={() => setModalLink(false)}>
          <div className="modal-box" style={{ width: 480 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 className="modal-title">Link de cobrança para fornecedor</h3>
              <button className="modal-close" onClick={() => setModalLink(false)}><i className="fa-solid fa-xmark" /></button>
            </div>
            {!linkGerado ? (
              <>
                <p style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 16, lineHeight: 1.6 }}>
                  Gere um link único e envie para o fornecedor. Ele preenche os dados e a cobrança cai automaticamente no sistema.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 4, display: 'block' }}>Referência / Serviço (opcional)</label>
                    <input className="form-input" placeholder="Ex.: Manutenção de equipamentos maio" value={linkForm.descricao} onChange={e => setLinkForm(f => ({ ...f, descricao: e.target.value }))} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 4, display: 'block' }}>Valor sugerido (R$)</label>
                      <input className="form-input" placeholder="0,00" value={linkForm.valor} onChange={e => setLinkForm(f => ({ ...f, valor: e.target.value }))} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 4, display: 'block' }}>Vencimento sugerido</label>
                      <input type="date" className="form-input" value={linkForm.data_vencimento} onChange={e => setLinkForm(f => ({ ...f, data_vencimento: e.target.value }))} />
                    </div>
                    <div style={{ gridColumn: '1/-1' }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 4, display: 'block' }}>Categoria</label>
                      <select className="form-input" value={linkForm.categoria} onChange={e => setLinkForm(f => ({ ...f, categoria: e.target.value }))}>
                        {CATS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
                <div className="modal-actions" style={{ marginTop: 20 }}>
                  <button className="btn-ghost" onClick={() => setModalLink(false)}>Cancelar</button>
                  <button className="btn-action" disabled={linkSaving} onClick={() => void gerarLink()}>
                    {linkSaving ? 'Gerando…' : 'Gerar link'}
                  </button>
                </div>
              </>
            ) : (
              <div>
                <div style={{ padding: '16px 18px', borderRadius: 12, border: '1px solid var(--teal)', background: 'rgba(16,185,129,0.04)', marginBottom: 16 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--teal)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
                    <i className="fa-solid fa-circle-check" style={{ marginRight: 5 }} />Link gerado com sucesso
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--navy)', wordBreak: 'break-all', fontFamily: "'Inter', system-ui, sans-serif", margin: 0 }}>{linkGerado}</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-action" style={{ flex: 1 }} onClick={() => { void navigator.clipboard.writeText(linkGerado).then(() => alert('Link copiado!')) }}>
                    <i className="fa-solid fa-copy" style={{ marginRight: 6 }} />Copiar link
                  </button>
                  <button className="btn-ghost" onClick={() => setModalLink(false)}>Fechar</button>
                </div>
                <p style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 12 }}>
                  <i className="fa-solid fa-clock" style={{ marginRight: 5 }} />Link válido por 30 dias. Após uso único, expira automaticamente.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal registrar pagamento */}
      {modalPagar && (
        <div className="modal-bg" onClick={() => setModalPagar(null)}>
          <div className="modal-box" style={{ width: 440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">
              Registrar Pagamento
              <button className="modal-close" onClick={() => setModalPagar(null)}>×</button>
            </div>
            <div style={{ marginBottom: 14, padding: '10px 12px', background: 'rgba(16,185,129,.06)', borderRadius: 8, border: '1px solid rgba(16,185,129,.15)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>{modalPagar.fornecedor_nome}</div>
              <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>{modalPagar.descricao}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--red)', marginTop: 6 }}>
                Saldo: {formatBRL(Number(modalPagar.valor || 0) - Number(modalPagar.valor_pago || 0))}
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Valor pago (R$) *</label>
                <input className="form-input" placeholder="0,00" value={valorPagamento} onChange={e => setValorPagamento(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Data do pagamento *</label>
                <input type="date" className="form-input" value={dataPagamento} onChange={e => setDataPagamento(e.target.value)} />
              </div>
            </div>
            {modalPagar.chave_pix && (
              <div style={{ marginBottom: 14, padding: '8px 12px', background: '#fafafa', borderRadius: 8, border: '1px solid var(--gray-100)', fontSize: 12 }}>
                <div style={{ color: 'var(--gray-400)', marginBottom: 2, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>Chave PIX</div>
                <div style={{ fontFamily: "'Inter', system-ui, sans-serif", userSelect: 'all' }}>{modalPagar.chave_pix}</div>
              </div>
            )}
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setModalPagar(null)}>Cancelar</button>
              <button className="btn-action" style={{ opacity: saving ? 0.6 : 1 }} disabled={saving} onClick={() => void registrarPagamento()}>
                {saving ? 'Salvando…' : 'Confirmar Pagamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
