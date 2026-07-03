'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import NovaDespesaModal, { type DespesaEdit } from '@/components/despesas/NovaDespesaModal'
import { formatBRL } from '@/lib/currency-brl'
import { CATEGORIAS_PADRAO } from '@/lib/despesas-categorizacao'
import Modal from '@/components/ui/Modal'
import * as XLSX from 'xlsx'

type DespesaRow = {
  id: string
  descricao: string
  valor: number
  categoria: string
  centro_custo_id: string | null
  responsavel_id: string | null
  responsavel_nome: string | null
  status: string
  tipo_pagamento: string | null
  data_despesa: string | null
  data: string | null
  data_vencimento: string | null
  data_pagamento: string | null
  comprovante_url: string | null
  observacao: string | null
  rejeitado_motivo: string | null
  transaction_id: string | null
  recorrente: boolean
  recorrencia_tipo: string | null
  created_at: string
}

const STATUS_ORDER = ['pendente_aprovacao', 'aprovado', 'rejeitado', 'pago', 'cancelado'] as const
const STATUS_LABEL: Record<string, string> = {
  pendente_aprovacao: 'Pendente aprovação',
  aprovado: 'Aprovado',
  rejeitado: 'Rejeitado',
  pago: 'Pago',
  cancelado: 'Cancelado',
}

function statusTag(status: string) {
  switch (status) {
    case 'pendente_aprovacao': return <span className="tag amber">Pendente</span>
    case 'aprovado': return <span className="tag blue">Aprovado</span>
    case 'pago': return <span className="tag green">Pago</span>
    case 'rejeitado': return <span className="tag red">Rejeitado</span>
    case 'cancelado': return <span className="tag gray">Cancelado</span>
    default: return <span className="tag gray">{status}</span>
  }
}

const menuItemStyle: React.CSSProperties = {
  display: 'block', width: '100%', padding: '8px 12px', textAlign: 'left',
  fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', color: '#13201D',
}

function lastDayOfMonth(y: number, m: number): string {
  return new Date(y, m, 0).toISOString().slice(0, 10)
}

async function abrirComprovante(pathOrUrl: string) {
  if (pathOrUrl.startsWith('http')) { window.open(pathOrUrl, '_blank'); return }
  const { data, error } = await supabase.storage.from('comprovantes').createSignedUrl(pathOrUrl, 3600)
  if (error || !data?.signedUrl) { toast.error('Não foi possível abrir o comprovante'); return }
  window.open(data.signedUrl, '_blank')
}

export default function DespesasPage() {
  const [empresaId, setEmpresaId] = useState('')
  const [userId, setUserId] = useState('')
  const [userName, setUserName] = useState<string | null>(null)
  const [rows, setRows] = useState<DespesaRow[]>([])
  const [centros, setCentros] = useState<{ id: string; nome: string }[]>([])
  const [categorias, setCategorias] = useState<string[]>([])
  const [membros, setMembros] = useState<{ id: string; nome: string | null }[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editRow, setEditRow] = useState<DespesaEdit | null>(null)
  const [tab, setTab] = useState<'todas' | 'pendente' | 'aprovadas' | 'pagas'>('todas')
  const [filtroStatus, setFiltroStatus] = useState<string>('')
  const [filtroCategoria, setFiltroCategoria] = useState<string>('')
  const [filtroCentro, setFiltroCentro] = useState<string>('')
  const [ano, setAno] = useState(new Date().getFullYear())
  const [mes, setMes] = useState(new Date().getMonth() + 1)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [menuAberto, setMenuAberto] = useState<string | null>(null)
  const [rejeitar, setRejeitar] = useState<{ id: string } | null>(null)
  const [motivoRejeicao, setMotivoRejeicao] = useState('')
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const [categorizando, setCategorizando] = useState(false)

  async function categorizarComIA() {
    setCategorizando(true)
    try {
      const { data: sess } = await supabase.auth.getSession()
      const token = sess.session?.access_token
      const res = await fetch('/api/despesas/categorizar-lote', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Falha ao categorizar')
      toast.success(d.categorizadas > 0 ? `${d.categorizadas} despesa(s) categorizada(s) com IA` : (d.mensagem || 'Nada a categorizar'))
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao categorizar')
    } finally { setCategorizando(false) }
  }

  const periodoLabel = useMemo(
    () => new Date(ano, mes - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
    [ano, mes]
  )

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser()
    const user = auth.user
    if (!user) return
    setUserId(user.id)
    const { data: u } = await supabase.from('usuarios').select('empresa_id, nome').eq('id', user.id).maybeSingle()
    const empresaFromUsuarios = u?.empresa_id ?? null
    let empresaFromEmpresas: string | null = null
    if (!empresaFromUsuarios) {
      const { data: emp } = await supabase.from('empresas').select('id').eq('user_id', user.id).maybeSingle()
      empresaFromEmpresas = emp?.id ?? null
    }
    const empresa = empresaFromUsuarios ?? empresaFromEmpresas ?? user.id
    setEmpresaId(empresa)
    setUserName(u?.nome ?? user.email ?? null)
    const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`
    const fim = lastDayOfMonth(ano, mes)
    const [dRes, cRes, catRes, teamRes] = await Promise.all([
      supabase.from('despesas').select('*').eq('empresa_id', empresa).gte('data', inicio).lte('data', fim).order('data', { ascending: false }),
      supabase.from('centros_custo').select('id, nome').eq('empresa_id', empresa).order('nome'),
      supabase.from('categorias_despesa').select('nome').eq('empresa_id', empresa).order('nome'),
      supabase.from('usuarios').select('id, nome').eq('empresa_id', empresa),
    ])
    if (dRes.error) toast.error(dRes.error.message)
    setRows((dRes.data ?? []) as DespesaRow[])
    setCentros(cRes.error ? [] : (cRes.data ?? []) as { id: string; nome: string }[])
    if (catRes.error) {
      const fromRows = Array.from(new Set((dRes.data ?? []).map((r: { categoria?: string }) => r.categoria).filter(Boolean)))
      setCategorias(fromRows.length ? fromRows : CATEGORIAS_PADRAO)
    } else {
      const nomes = (catRes.data ?? []).map((x: { nome: string }) => x.nome)
      setCategorias(nomes.length ? nomes : CATEGORIAS_PADRAO)
    }
    const membrosBase = (teamRes.data ?? []) as { id: string; nome: string | null }[]
    setMembros(membrosBase.length ? membrosBase : [{ id: user.id, nome: u?.nome ?? user.email ?? 'Usuário' }])
    setLoading(false)
  }, [ano, mes])

  useEffect(() => { void load() }, [load])

  const centroNome = useMemo(() => {
    const m = new Map(centros.map((c) => [c.id, c.nome]))
    return (id: string | null) => (id ? m.get(id) ?? '—' : '—')
  }, [centros])

  const filtradas = useMemo(() => {
    let list = rows
    if (tab === 'pendente') list = list.filter((r) => r.status === 'pendente_aprovacao')
    else if (tab === 'aprovadas') list = list.filter((r) => r.status === 'aprovado')
    else if (tab === 'pagas') list = list.filter((r) => r.status === 'pago')
    if (filtroStatus) list = list.filter((r) => r.status === filtroStatus)
    if (filtroCategoria) list = list.filter((r) => r.categoria === filtroCategoria)
    if (filtroCentro) list = list.filter((r) => r.centro_custo_id === filtroCentro)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((r) => r.descricao.toLowerCase().includes(q) || (r.responsavel_nome && r.responsavel_nome.toLowerCase().includes(q)))
    }
    return list
  }, [rows, tab, filtroStatus, filtroCategoria, filtroCentro, search])

  const inicioMes = `${ano}-${String(mes).padStart(2, '0')}-01`
  const fimMes = lastDayOfMonth(ano, mes)
  const prev = new Date(ano, mes - 2, 1)
  const prevInicio = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-01`
  const prevFim = lastDayOfMonth(prev.getFullYear(), prev.getMonth() + 1)

  const kpis = useMemo(() => {
    const noMes = (r: DespesaRow) => { const d = r.data_despesa || r.data; return d ? d >= inicioMes && d <= fimMes : false }
    const noMesAnt = (r: DespesaRow) => { const d = r.data_despesa || r.data; return d ? d >= prevInicio && d <= prevFim : false }
    const totalMes = rows.filter(noMes).reduce((s, r) => s + Number(r.valor || 0), 0)
    const aAprovar = rows.filter(noMes).filter((r) => r.status === 'pendente_aprovacao').reduce((s, r) => s + Number(r.valor || 0), 0)
    const aPagar = rows.filter(noMes).filter((r) => r.status === 'aprovado').reduce((s, r) => s + Number(r.valor || 0), 0)
    const totalAnt = rows.filter(noMesAnt).reduce((s, r) => s + Number(r.valor || 0), 0)
    const economia = totalAnt > 0 ? ((totalAnt - totalMes) / totalAnt) * 100 : totalMes === 0 ? 0 : -100
    return { totalMes, aAprovar, aPagar, economia, totalAnt }
  }, [rows, inicioMes, fimMes, prevInicio, prevFim])

  const categorizacao = useMemo(() => {
    const noMes = (r: DespesaRow) => { const d = r.data_despesa || r.data; return d ? d >= inicioMes && d <= fimMes : false }
    const noMesRows = rows.filter(noMes)
    const total = noMesRows.reduce((s, r) => s + Number(r.valor || 0), 0)
    const map = new Map<string, number>()
    for (const r of noMesRows) { const c = r.categoria || 'Outros'; map.set(c, (map.get(c) || 0) + Number(r.valor || 0)) }
    const items = Array.from(map.entries()).map(([nome, valor]) => ({ nome, valor, pct: total > 0 ? (valor / total) * 100 : 0 })).sort((a, b) => b.valor - a.valor)
    const pendentes = noMesRows.filter((r) => r.status === 'pendente_aprovacao')
    return { items, total, pendentesN: pendentes.length, pendentesValor: pendentes.reduce((s, r) => s + Number(r.valor || 0), 0) }
  }, [rows, inicioMes, fimMes])

  function toggleAll() {
    if (selected.size === filtradas.length) setSelected(new Set())
    else setSelected(new Set(filtradas.map((r) => r.id)))
  }
  function toggleOne(id: string) {
    const n = new Set(selected)
    if (n.has(id)) n.delete(id); else n.add(id)
    setSelected(n)
  }

  async function aprovar(id: string) {
    const { error } = await supabase.from('despesas').update({ status: 'aprovado', aprovado_por: userId, aprovado_em: new Date().toISOString() }).eq('id', id)
    if (error) toast.error(error.message); else { toast.success('Despesa aprovada'); void load() }
    setMenuAberto(null)
  }

  async function aprovarLote() {
    const ids = Array.from(selected).filter((id) => rows.find((r) => r.id === id)?.status === 'pendente_aprovacao')
    if (!ids.length) { toast.error('Nenhuma despesa pendente selecionada'); return }
    const { error } = await supabase.from('despesas').update({ status: 'aprovado', aprovado_por: userId, aprovado_em: new Date().toISOString() }).in('id', ids)
    if (error) toast.error(error.message); else { toast.success(`${ids.length} despesa(s) aprovada(s)`); setSelected(new Set()); void load() }
  }

  async function marcarPago(id: string) {
    const row = rows.find((r) => r.id === id)
    if (!row) return
    if (!empresaId) { toast.error('Empresa não identificada. Recarregue a página antes de pagar.'); return }
    const hoje = new Date().toISOString().slice(0, 10)
    const { data: tx, error: e1 } = await supabase.from('transacoes').insert({ empresa_id: empresaId, data: hoje, descricao: `Despesa: ${row.descricao}`, categoria: row.categoria, tipo: 'saida', valor: row.valor, status: 'confirmada' }).select('id').single()
    if (e1) { toast.error(e1.message); return }
    const { error: e2 } = await supabase.from('despesas').update({ status: 'pago', data_pagamento: hoje, transaction_id: tx?.id ?? null }).eq('id', id)
    if (!e2) {
      await supabase.from('lancamentos').insert({ empresa_id: empresaId, descricao: `Despesa paga - ${row.descricao}`, valor: row.valor, tipo: 'debito', competencia: hoje, transaction_id: tx?.id ?? null, despesa_id: id, origem: 'despesa' })
      const { data: sess } = await supabase.auth.getSession()
      await fetch('/api/dre/recalcular', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(sess.session?.access_token ? { Authorization: `Bearer ${sess.session.access_token}` } : {}) }, body: JSON.stringify({ empresaId: empresaId, competencia: hoje }) })
      await fetch('/api/orcamento/atualizar-realizado', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(sess.session?.access_token ? { Authorization: `Bearer ${sess.session.access_token}` } : {}) }, body: JSON.stringify({ categoria: row.categoria, mes: Number(hoje.slice(5, 7)), ano: Number(hoje.slice(0, 4)), valor: Number(row.valor || 0) }) })
    }
    if (e2) toast.error(e2.message); else { toast.success('Marcado como pago e lançado no fluxo de caixa'); void load() }
    setMenuAberto(null)
  }

  async function marcarPagoLote() {
    const pendentes = Array.from(selected).filter((id) => { const r = rows.find((x) => x.id === id); return r && (r.status === 'aprovado' || r.status === 'pendente_aprovacao') })
    if (!pendentes.length) { toast.error('Selecione despesas aprovadas ou pendentes para pagar'); return }
    if (!empresaId) { toast.error('Empresa não identificada. Recarregue a página antes de pagar.'); return }
    const hoje = new Date().toISOString().slice(0, 10)
    for (const id of pendentes) {
      const row = rows.find((r) => r.id === id)
      if (!row) continue
      const { data: tx } = await supabase.from('transacoes').insert({ empresa_id: empresaId, data: hoje, descricao: `Despesa: ${row.descricao}`, categoria: row.categoria, tipo: 'saida', valor: row.valor, status: 'confirmada' }).select('id').single()
      await supabase.from('despesas').update({ status: 'pago', data_pagamento: hoje, transaction_id: tx?.id ?? null }).eq('id', id)
      const { data: sess } = await supabase.auth.getSession()
      await fetch('/api/orcamento/atualizar-realizado', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(sess.session?.access_token ? { Authorization: `Bearer ${sess.session.access_token}` } : {}) }, body: JSON.stringify({ categoria: row.categoria, mes: Number(hoje.slice(5, 7)), ano: Number(hoje.slice(0, 4)), valor: Number(row.valor || 0) }) })
    }
    toast.success('Pagamentos registrados')
    setSelected(new Set())
    void load()
  }

  function confirmarRejeitar() {
    if (!rejeitar) return
    if (motivoRejeicao.trim().length < 5) { toast.error('Informe o motivo (mín. 5 caracteres)'); return }
    void (async () => {
      const { error } = await supabase.from('despesas').update({ status: 'rejeitado', rejeitado_motivo: motivoRejeicao.trim() }).eq('id', rejeitar.id)
      if (error) toast.error(error.message)
      else { toast.success('Despesa rejeitada'); setRejeitar(null); setMotivoRejeicao(''); void load() }
    })()
  }

  async function excluir(id: string) {
    if (!confirm('Excluir esta despesa permanentemente?')) return
    const { error } = await supabase.from('despesas').delete().eq('id', id)
    if (error) toast.error(error.message); else { toast.success('Removida'); void load() }
    setMenuAberto(null)
  }

  function exportarCsv(lista: DespesaRow[]) {
    const header = ['Descrição', 'Responsável', 'Categoria', 'Centro', 'Valor', 'Vencimento', 'Status', 'Data despesa']
    const lines = lista.map((r) => [`"${(r.descricao || '').replace(/"/g, '""')}"`, `"${(r.responsavel_nome || '').replace(/"/g, '""')}"`, `"${r.categoria}"`, `"${centroNome(r.centro_custo_id)}"`, Number(r.valor).toFixed(2), r.data_vencimento || '', STATUS_LABEL[r.status] || r.status, r.data_despesa || r.data || ''].join(','))
    const csv = [header.join(','), ...lines].join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `despesas_${ano}_${mes}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
    toast.success('CSV gerado')
  }

  function exportarPdf() {
    try {
      const html = `<html>
<head>
  <meta charset="utf-8">
  <title>Despesas — ${periodoLabel}</title>
  <style>
    body { font-family: 'Segoe UI', sans-serif; padding: 32px; color: #13201D; }
    h1 { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
    .sub { font-size: 12px; color: #7B8C88; margin-bottom: 24px; }
    .header-bar { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
    .logo { font-size: 18px; font-weight: 800; color: #13201D; }
    .logo span { color: #3D7A6E; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
    th { text-align: left; padding: 8px 10px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; background: #F7F4EE; color: #7B8C88; border-bottom: 1px solid #E4DCCC; }
    td { padding: 9px 10px; border-bottom: 1px solid #EFE9DC; color: #13201D; }
    tr:last-child td { border: none; }
    .val { font-weight: 700; color: #B0413E; }
    .total-row { background: #F7F4EE; font-weight: 700; }
    .footer { margin-top: 32px; font-size: 10px; color: #A6B0AC; }
    @media print { body { padding: 16px; } }
  </style>
</head>
<body>
  <div class="header-bar">
    <div>
      <div class="logo">Factor<span>One</span> <span style="font-size:11px;font-weight:400;color:#7B8C88">Finance OS</span></div>
      <h1>Relatório de Despesas</h1>
      <div class="sub">${periodoLabel} · Gerado em ${new Date().toLocaleDateString('pt-BR')}</div>
    </div>
    <div style="text-align:right;font-size:13px">
      <div style="font-size:10px;color:#7B8C88;margin-bottom:2px">Total do período</div>
      <div style="font-size:20px;font-weight:800;color:#B0413E">${formatBRL(kpis.totalMes)}</div>
    </div>
  </div>
  <table>
    <thead><tr><th>Descrição</th><th>Categoria</th><th>Vencimento</th><th>Status</th><th style="text-align:right">Valor</th></tr></thead>
    <tbody>
      ${filtradas.map(r => `<tr><td>${r.descricao || '—'}</td><td>${r.categoria || '—'}</td><td>${r.data_vencimento ? new Date(r.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</td><td>${STATUS_LABEL[r.status] || r.status}</td><td style="text-align:right" class="val">${formatBRL(Number(r.valor))}</td></tr>`).join('')}
      <tr class="total-row"><td colspan="4">Total</td><td style="text-align:right;color:#B0413E">${formatBRL(kpis.totalMes)}</td></tr>
    </tbody>
  </table>
  <div class="footer">FactorOne Finance OS · ${new Date().toLocaleString('pt-BR')}</div>
  <script>window.onload = () => { window.print() }</script>
</body>
</html>`
      const blob = new Blob([html], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `despesas_${periodoLabel.replace(/\s+/g, '_')}.html`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success('Relatório baixado — abra o arquivo e use Ctrl+P para imprimir/salvar como PDF')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao gerar relatório')
    }
  }

  async function importarLote(file: File) {
    setImporting(true)
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rowsCsv = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
      if (!rowsCsv.length) throw new Error('Arquivo vazio')
      const payload = rowsCsv.map((r) => ({ empresa_id: empresaId, descricao: String(r.descricao || r.Descricao || r.DESCRICAO || '').trim(), categoria: String(r.categoria || r.Categoria || r.CATEGORIA || 'Outros').trim() || 'Outros', valor: Number(String(r.valor || r.Valor || r.VALOR || '0').replace(',', '.')), data: String(r.data || r.Data || r.DATA || new Date().toISOString().slice(0, 10)).slice(0, 10), data_despesa: String(r.data || r.Data || r.DATA || new Date().toISOString().slice(0, 10)).slice(0, 10), status: 'pendente_aprovacao' })).filter((r) => r.descricao && Number.isFinite(r.valor) && r.valor > 0)
      if (!payload.length) throw new Error('Sem linhas válidas. Use colunas: descricao, valor, categoria, data')
      const { error } = await supabase.from('despesas').insert(payload)
      if (error) throw error
      toast.success(`${payload.length} despesas importadas`)
      void load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Falha na importação')
    } finally {
      setImporting(false)
    }
  }

  function abrirEditar(r: DespesaRow) {
    setEditRow({ id: r.id, descricao: r.descricao, valor: Number(r.valor), categoria: r.categoria, centro_custo_id: r.centro_custo_id, responsavel_id: r.responsavel_id, tipo_pagamento: r.tipo_pagamento, data_despesa: r.data_despesa || r.data || inicioMes, data_vencimento: r.data_vencimento, observacao: r.observacao, recorrente: r.recorrente, recorrencia_tipo: r.recorrencia_tipo, comprovante_url: r.comprovante_url })
    setModalOpen(true)
    setMenuAberto(null)
  }

  const membrosOpts = membros.length > 0 ? membros : [{ id: userId, nome: userName }]

  return (
    <>
      {/* Header */}
      <div className="page-hdr">
        <div>
          <div className="page-title">Despesas & Recibos</div>
          <div className="page-sub">{periodoLabel}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <button className="btn-action btn-ghost" onClick={() => setExportMenuOpen(o => !o)}>Exportar ▾</button>
            {exportMenuOpen && (
              <>
                <button type="button" style={{ position: 'fixed', inset: 0, zIndex: 10, cursor: 'default' }} aria-label="fechar" onClick={() => setExportMenuOpen(false)} />
                <div style={{ position: 'absolute', right: 0, zIndex: 20, marginTop: 4, width: 180, background: '#fff', border: '0.5px solid #E4DCCC', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.12)', padding: '4px 0' }}>
                  <button style={menuItemStyle} onClick={() => { exportarCsv(filtradas); setExportMenuOpen(false) }}>CSV (filtradas)</button>
                  <button style={menuItemStyle} onClick={() => { exportarPdf(); setExportMenuOpen(false) }}>PDF / Imprimir</button>
                </div>
              </>
            )}
          </div>
          <button className="btn-action btn-ghost" onClick={() => void categorizarComIA()} disabled={categorizando} title="Classifica automaticamente as despesas sem categoria">
            <i className="fa-solid fa-wand-magic-sparkles" style={{ marginRight: 6, color: '#7A6A9E' }} />{categorizando ? 'Categorizando…' : 'Categorizar com IA'}
          </button>
          <button className="btn-action" onClick={() => { setEditRow(null); setModalOpen(true) }}>+ Nova despesa</button>
          <label className="btn-action btn-ghost" style={{ cursor: 'pointer' }}>
            {importing ? 'Importando…' : 'Importar CSV/Excel'}
            <input type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) void importarLote(f); e.currentTarget.value = '' }} />
          </label>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpis">
        <div className="kpi" style={{ borderTop: '3px solid #B0413E' }}>
          <div className="kpi-lbl">Total do mês
            <div style={{ width: 28, height: 28, borderRadius: 8, background: '#F4E4E1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa-solid fa-receipt" style={{ fontSize: 12, color: '#B0413E' }} />
            </div>
          </div>
          <div className="kpi-val">{formatBRL(kpis.totalMes)}</div>
          <div className="kpi-delta dn">↓ despesas registradas</div>
        </div>
        <div className="kpi" style={{ borderTop: '3px solid #B08A3E' }}>
          <div className="kpi-lbl">A aprovar
            <div style={{ width: 28, height: 28, borderRadius: 8, background: '#F3ECDA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa-solid fa-clock" style={{ fontSize: 12, color: '#B08A3E' }} />
            </div>
          </div>
          <div className="kpi-val">{formatBRL(kpis.aAprovar)}</div>
          <div className="kpi-delta warn">aguardando aprovação</div>
        </div>
        <div className="kpi" style={{ borderTop: '3px solid #3D7A6E' }}>
          <div className="kpi-lbl">A pagar
            <div style={{ width: 28, height: 28, borderRadius: 8, background: '#E9F0ED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa-solid fa-check-circle" style={{ fontSize: 12, color: '#3D7A6E' }} />
            </div>
          </div>
          <div className="kpi-val">{formatBRL(kpis.aPagar)}</div>
          <div className="kpi-delta up">↑ já aprovadas</div>
        </div>
        <div className="kpi" style={{ borderTop: `3px solid ${kpis.economia >= 0 ? '#3D7A6E' : '#B0413E'}` }}>
          <div className="kpi-lbl">Vs mês anterior
            <div style={{ width: 28, height: 28, borderRadius: 8, background: kpis.economia >= 0 ? '#E9F0ED' : '#F4E4E1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className={`fa-solid ${kpis.economia >= 0 ? 'fa-arrow-trend-down' : 'fa-arrow-trend-up'}`} style={{ fontSize: 12, color: kpis.economia >= 0 ? '#3D7A6E' : '#B0413E' }} />
            </div>
          </div>
          <div className="kpi-val">{kpis.economia >= 0 ? '+' : ''}{kpis.economia.toFixed(1)}%</div>
          <div className={`kpi-delta ${kpis.economia >= 0 ? 'up' : 'dn'}`}>{kpis.economia >= 0 ? '✓ economia' : '⚠ mais gastos'}</div>
        </div>
      </div>

      {/* Categorização */}
      <div className="cf-chart-card" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div className="chart-title" style={{ marginBottom: 0 }}>Categorização de Gastos</div>
          <div style={{ fontSize: 10, color: '#7B8C88', fontFamily: "'Inter', sans-serif" }}>
            {categorizacao.pendentesN} pendentes · IA 94% automático
          </div>
        </div>
        {categorizacao.items.length === 0 ? (
          <p style={{ fontSize: 12, color: '#7B8C88', textAlign: 'center', padding: '16px 0' }}>Sem despesas no mês para exibir distribuição.</p>
        ) : (
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {categorizacao.items.map(it => (
              <li key={it.nome}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, color: '#13201D' }}>{it.nome}</span>
                  <span style={{ fontFamily: "'Inter', sans-serif", color: '#7B8C88' }}>{formatBRL(it.valor)} · {it.pct.toFixed(1)}%</span>
                </div>
                <div style={{ height: 6, background: '#F1ECE1', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, it.pct)}%`, background: '#3D7A6E', borderRadius: 3 }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar…" className="form-input" style={{ width: 200, padding: '6px 10px', fontSize: 12 }} />
        <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} className="form-input" style={{ width: 'auto', padding: '6px 10px', fontSize: 12 }}>
          <option value="">Status (todos)</option>
          {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)} className="form-input" style={{ width: 'auto', padding: '6px 10px', fontSize: 12 }}>
          <option value="">Categoria</option>
          {categorias.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filtroCentro} onChange={e => setFiltroCentro(e.target.value)} className="form-input" style={{ width: 'auto', padding: '6px 10px', fontSize: 12 }}>
          <option value="">Centro de custo</option>
          {centros.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <select value={mes} onChange={e => setMes(Number(e.target.value))} className="form-input" style={{ width: 'auto', padding: '6px 10px', fontSize: 12 }}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{new Date(2000, m - 1).toLocaleString('pt-BR', { month: 'short' })}</option>)}
        </select>
        <select value={ano} onChange={e => setAno(Number(e.target.value))} className="form-input" style={{ width: 'auto', padding: '6px 10px', fontSize: 12 }}>
          {[ano - 1, ano, ano + 1].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {([['todas', 'Todas'], ['pendente', 'Pendente'], ['aprovadas', 'Aprovadas'], ['pagas', 'Pagas']] as const).map(([k, label]) => (
          <button key={k} className={`btn-action${tab !== k ? ' btn-ghost' : ''}`} style={{ fontSize: 11, padding: '5px 12px' }} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>

      {/* Lote */}
      {selected.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(61,122,110,.08)', border: '1px solid rgba(61,122,110,.2)', borderRadius: 10, padding: '8px 14px', fontSize: 12, marginBottom: 10 }}>
          <span style={{ fontWeight: 600, color: '#3D7A6E' }}>{selected.size} selecionada(s)</span>
          <button className="btn-action btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => void aprovarLote()}>Aprovar</button>
          <button className="btn-action btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => void marcarPagoLote()}>Pagar</button>
          <button className="btn-action btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => exportarCsv(rows.filter(r => selected.has(r.id)))}>Exportar</button>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#7B8C88' }} onClick={() => setSelected(new Set())}>Limpar</button>
        </div>
      )}

      {/* Tabela */}
      <div className="expenses-table">
        <table>
          <thead>
            <tr>
              <th style={{ width: 36 }}><input type="checkbox" checked={filtradas.length > 0 && selected.size === filtradas.length} onChange={toggleAll} /></th>
              <th>Descrição</th><th>Responsável</th><th>Categoria</th><th>Centro</th>
              <th>Valor</th><th>Vencimento</th><th>Status</th><th style={{ width: 44 }} />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', color: '#7B8C88', padding: 32 }}>Carregando…</td></tr>
            ) : filtradas.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', color: '#7B8C88', padding: 32 }}>Nenhuma despesa neste período com os filtros atuais.</td></tr>
            ) : filtradas.map(r => (
              <tr key={r.id}>
                <td><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleOne(r.id)} /></td>
                <td style={{ fontWeight: 600 }}>
                  {r.descricao}
                  {r.recorrente && <span style={{ fontSize: 10, color: '#7B8C88', marginLeft: 6 }}>(recorrente)</span>}
                </td>
                <td>{r.responsavel_nome || '—'}</td>
                <td>{r.categoria}</td>
                <td>{centroNome(r.centro_custo_id)}</td>
                <td style={{ fontWeight: 700, color: '#B0413E', fontFamily: "'Inter', sans-serif" }}>{formatBRL(Number(r.valor))}</td>
                <td>{r.data_vencimento ? new Date(r.data_vencimento).toLocaleDateString('pt-BR') : '—'}</td>
                <td>
                  <span title={r.status === 'rejeitado' ? r.rejeitado_motivo || '' : undefined}>
                    {statusTag(r.status)}
                  </span>
                </td>
                <td style={{ position: 'relative' }}>
                  <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7B8C88', padding: 4, fontSize: 16 }} onClick={() => setMenuAberto(menuAberto === r.id ? null : r.id)}>⋯</button>
                  {menuAberto === r.id && (
                    <>
                      <button type="button" style={{ position: 'fixed', inset: 0, zIndex: 10, cursor: 'default' }} aria-label="fechar" onClick={() => setMenuAberto(null)} />
                      <div style={{ position: 'absolute', right: 0, top: '100%', zIndex: 20, marginTop: 4, width: 200, background: '#fff', border: '0.5px solid #E4DCCC', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.12)', padding: '4px 0' }}>
                        {r.status === 'pendente_aprovacao' && <button style={menuItemStyle} onClick={() => void aprovar(r.id)}>Aprovar</button>}
                        {r.status === 'pendente_aprovacao' && <button style={menuItemStyle} onClick={() => { setRejeitar({ id: r.id }); setMenuAberto(null) }}>Rejeitar…</button>}
                        {(r.status === 'aprovado' || r.status === 'pendente_aprovacao') && <button style={menuItemStyle} onClick={() => void marcarPago(r.id)}>Marcar como pago</button>}
                        {r.comprovante_url && <button style={menuItemStyle} onClick={() => void abrirComprovante(r.comprovante_url!)}>Ver comprovante</button>}
                        <button style={menuItemStyle} onClick={() => abrirEditar(r)}>Editar</button>
                        <button style={{ ...menuItemStyle, color: '#B0413E' }} onClick={() => void excluir(r.id)}>Excluir</button>
                      </div>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <NovaDespesaModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditRow(null) }}
        empresaId={empresaId}
        userId={userId}
        userName={userName}
        categorias={categorias}
        centros={centros}
        membros={membrosOpts}
        edit={editRow}
        onSaved={() => void load()}
        onCentroCriado={(c) => setCentros((prev) => [...prev, c])}
      />

      <Modal
        open={!!rejeitar}
        onClose={() => { setRejeitar(null); setMotivoRejeicao('') }}
        title="Rejeitar despesa"
        footer={
          <>
            <button className="btn-action btn-ghost" onClick={() => { setRejeitar(null); setMotivoRejeicao('') }}>Cancelar</button>
            <button className="btn-action" style={{ background: '#B0413E' }} onClick={confirmarRejeitar}>Rejeitar</button>
          </>
        }
      >
            <p style={{ fontSize: 12, color: '#7B8C88', marginBottom: 12 }}>Informe o motivo (visível no histórico).</p>
            <textarea value={motivoRejeicao} onChange={e => setMotivoRejeicao(e.target.value)} rows={3} className="form-input" style={{ resize: 'vertical', height: 80 }} placeholder="Motivo da rejeição" />
      </Modal>
    </>
  )
}
