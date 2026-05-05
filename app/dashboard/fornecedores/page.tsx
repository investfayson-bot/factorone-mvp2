'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'

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
  const [tab, setTab] = useState<'fornecedores' | 'contas' | 'pagar'>('fornecedores')
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

  const carregar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const eid = (u?.empresa_id as string) || user.id
    setEmpresaId(eid)
    const { data } = await supabase
      .from('contas_pagar')
      .select('id,descricao,fornecedor_nome,fornecedor_documento,categoria,valor,valor_pago,data_vencimento,data_pagamento,tipo_pagamento,chave_pix,codigo_barras,status,observacoes')
      .eq('empresa_id', eid)
      .order('data_vencimento', { ascending: false })
    setContas((data || []) as ContaPagar[])
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
    const valorTotal = Number(modalPagar.valor || 0)
    const novoStatus = v >= valorTotal - Number(modalPagar.valor_pago || 0) ? 'paga' : 'parcialmente_paga'
    await supabase.from('contas_pagar').update({
      valor_pago: Number(modalPagar.valor_pago || 0) + v,
      data_pagamento: dataPagamento,
      status: novoStatus,
    }).eq('id', modalPagar.id)
    setSaving(false)
    setModalPagar(null)
    setValorPagamento('')
    await carregar()
  }

  async function cancelarConta(id: string) {
    await supabase.from('contas_pagar').update({ status: 'cancelada' }).eq('id', id)
    await carregar()
  }

  return (
    <>
      <div className="page-hdr">
        <div>
          <div className="page-title">Fornecedores & Pagamentos</div>
          <div className="page-sub">Gestão de contas a pagar · {fornecedoresAgrupados.length} fornecedores</div>
        </div>
        <button className="btn-action" onClick={() => setModalNova(true)}>+ Nova Conta a Pagar</button>
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
          <div className={`kpi-delta ${totalVencido > 0 ? 'dn' : 'up'}`}>{totalVencido > 0 ? '⚠ atraso' : '✓ ok'}</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Vence este mês</div>
          <div className="kpi-val">{formatBRL(totalMes)}</div>
          <div className="kpi-delta">mês atual</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
        {([['fornecedores', 'Fornecedores'], ['contas', 'Contas a Pagar'], ['pagar', 'Histórico Pagamentos']] as [string, string][]).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k as typeof tab)} style={{
            padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid',
            background: tab === k ? 'var(--navy)' : '#fff',
            color: tab === k ? '#fff' : 'var(--gray-500)',
            borderColor: tab === k ? 'var(--navy)' : 'var(--gray-100)',
          }}>{l}</button>
        ))}
      </div>

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
                    <td style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--gray-400)' }}>{f.doc || '—'}</td>
                    <td style={{ textAlign: 'center' }}>{f.qtd}</td>
                    <td style={{ textAlign: 'right', fontFamily: "'DM Mono',monospace" }}>{formatBRL(f.total)}</td>
                    <td style={{ textAlign: 'right', fontFamily: "'DM Mono',monospace", fontWeight: 700, color: f.pendente > 0 ? 'var(--red)' : 'var(--navy)' }}>{formatBRL(f.pendente)}</td>
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
            <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--gray-400)', letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: "'DM Mono',monospace", flex: 1 }}>
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
                    <td style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: isVencida(c) ? 'var(--red)' : 'inherit' }}>
                      {new Date(c.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: "'DM Mono',monospace", fontWeight: 700 }}>{formatBRL(Number(c.valor || 0))}</td>
                    <td style={{ textAlign: 'right', fontFamily: "'DM Mono',monospace", color: 'var(--teal)' }}>
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
                    <td style={{ fontFamily: "'DM Mono',monospace", fontSize: 11 }}>
                      {c.data_pagamento ? new Date(c.data_pagamento + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td>{c.tipo_pagamento ? <span className="tag gray">{c.tipo_pagamento.toUpperCase()}</span> : '—'}</td>
                    <td style={{ textAlign: 'right', fontFamily: "'DM Mono',monospace", fontWeight: 700, color: 'var(--teal)' }}>
                      {formatBRL(Number(c.valor_pago || 0))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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

      {/* Modal registrar pagamento */}
      {modalPagar && (
        <div className="modal-bg" onClick={() => setModalPagar(null)}>
          <div className="modal-box" style={{ width: 440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">
              Registrar Pagamento
              <button className="modal-close" onClick={() => setModalPagar(null)}>×</button>
            </div>
            <div style={{ marginBottom: 14, padding: '10px 12px', background: 'rgba(94,140,135,.06)', borderRadius: 8, border: '1px solid rgba(94,140,135,.15)' }}>
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
                <div style={{ fontFamily: "'DM Mono',monospace", userSelect: 'all' }}>{modalPagar.chave_pix}</div>
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
