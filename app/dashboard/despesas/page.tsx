'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import NovaDespesaModal, { type DespesaEdit } from '@/components/despesas/NovaDespesaModal'
import { formatBRL } from '@/lib/currency-brl'
import { CATEGORIAS_PADRAO } from '@/lib/despesas-categorizacao'
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
  fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--navy)',
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
    const hoje = new Date().toISOString().slice(0, 10)
    const { data: tx, error: e1 } = await supabase.from('transacoes').insert({ empresa_id: empresaId, data: hoje, descricao: `Despesa: ${row.descricao}`, categoria: row.categoria, tipo: 'saida', valor: row.valor, status: 'confirmada' }).select('id').single()
    if (e1) { toast.error(e1.message); return }
    const { error: e2 } = await supabase.from('despesas').update({ status: 'pago', data_pagamento: hoje, transaction_id: tx?.id ?? null }).eq('id', id)
    if (!e2) {
      await supabase.from('lancamentos').insert({ empresa_id: empresaId || userId, descricao: `Despesa paga - ${row.descricao}`, valor: row.valor, tipo: 'debito', competencia: hoje, transaction_id: tx?.id ?? null, despesa_id: id, origem: 'despesa' })
      const { data: sess } = await supabase.auth.getSession()
      await fetch('/api/dre/recalcular', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(sess.session?.access_token ? { Authorization: `Bearer ${sess.session.access_token}` } : {}) }, body: JSON.stringify({ empresaId: empresaId || userId, competencia: hoje }) })
      await fetch('/api/orcamento/atualizar-realizado', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(sess.session?.access_token ? { Authorization: `Bearer ${sess.session.access_token}` } : {}) }, body: JSON.stringify({ categoria: row.categoria, mes: Number(hoje.slice(5, 7)), ano: Number(hoje.slice(0, 4)), valor: Number(row.valor || 0) }) })
    }
    if (e2) toast.error(e2.message); else { toast.success('Marcado como pago e lançado no fluxo de caixa'); void load() }
    setMenuAberto(null)
  }

  async function marcarPagoLote() {
    const pendentes = Array.from(selected).filter((id) => { const r = rows.find((x) => x.id === id); return r && (r.status === 'aprovado' || r.status === 'pendente_aprovacao') })
    if (!pendentes.length) { toast.error('Selecione despesas aprovadas ou pendentes para pagar'); return }
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
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`<html><head><title>Despesas ${periodoLabel}</title><style>body{font-family:system-ui,sans-serif;padding:24px;color:#1e293b}h1{font-size:18px}table{width:100%;border-collapse:collapse;font-size:12px;margin-top:16px}th,td{border:1px solid #e2e8f0;padding:8px;text-align:left}th{background:#f8fafc}</style></head><body><h1>Despesas — ${periodoLabel}</h1><p>FactorOne · Total: ${formatBRL(kpis.totalMes)}</p><table><thead><tr><th>Descrição</th><th>Categoria</th><th>Valor</th><th>Status</th><th>Vencimento</th></tr></thead><tbody>${filtradas.map((r) => `<tr><td>${r.descricao}</td><td>${r.categoria}</td><td>${formatBRL(Number(r.valor))}</td><td>${STATUS_LABEL[r.status] || r.status}</td><td>${r.data_vencimento || '—'}</td></tr>`).join('')}</tbody></table><script>window.onload=()=>{window.print()}</script></body></html>`)
    w.document.close()
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
                <div style={{ position: 'absolute', right: 0, zIndex: 20, marginTop: 4, width: 180, background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.12)', padding: '4px 0' }}>
                  <button style={menuItemStyle} onClick={() => { exportarCsv(filtradas); setExportMenuOpen(false) }}>CSV (filtradas)</button>
                  <button style={menuItemStyle} onClick={() => { exportarPdf(); setExportMenuOpen(false) }}>PDF / Imprimir</button>
                </div>
              </>
            )}
          </div>
          <button className="btn-action" onClick={() => { setEditRow(null); setModalOpen(true) }}>+ Nova despesa</button>
          <label className="btn-action btn-ghost" style={{ cursor: 'pointer' }}>
            {importing ? 'Importando…' : 'Importar CSV/Excel'}
            <input type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) void importarLote(f); e.currentTarget.value = '' }} />
          </label>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpis">
        <div className="kpi">
          <div className="kpi-lbl">Total do mês</div>
          <div className="kpi-val" style={{ color: 'var(--red)' }}>{formatBRL(kpis.totalMes)}</div>
          <div className="kpi-delta dn">↓ despesas</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">A aprovar</div>
          <div className="kpi-val" style={{ color: 'var(--gold)' }}>{formatBRL(kpis.aAprovar)}</div>
          <div className="kpi-delta warn">⚠ pendente</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">A pagar</div>
          <div className="kpi-val" style={{ color: 'var(--teal)' }}>{formatBRL(kpis.aPagar)}</div>
          <div className="kpi-delta up">↑ aprovadas</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Vs mês anterior</div>
          <div className="kpi-val" style={{ color: kpis.economia >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {kpis.economia >= 0 ? '+' : ''}{kpis.economia.toFixed(1)}%
          </div>
          <div className={`kpi-delta ${kpis.economia >= 0 ? 'up' : 'dn'}`}>{kpis.economia >= 0 ? '✓ economia' : '↑ mais gastos'}</div>
        </div>
      </div>

      {/* Categorização */}
      <div className="cf-chart-card" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div className="chart-title" style={{ marginBottom: 0 }}>Categorização de Gastos</div>
          <div style={{ fontSize: 10, color: 'var(--gray-400)', fontFamily: "'DM Mono', monospace" }}>
            {categorizacao.pendentesN} pendentes · IA 94% automático
          </div>
        </div>
        {categorizacao.items.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--gray-400)', textAlign: 'center', padding: '16px 0' }}>Sem despesas no mês para exibir distribuição.</p>
        ) : (
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {categorizacao.items.map(it => (
              <li key={it.nome}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, color: 'var(--navy)' }}>{it.nome}</span>
                  <span style={{ fontFamily: "'DM Mono', monospace", color: 'var(--gray-500)' }}>{formatBRL(it.valor)} · {it.pct.toFixed(1)}%</span>
                </div>
                <div style={{ height: 6, background: 'var(--gray-100)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, it.pct)}%`, background: 'var(--teal)', borderRadius: 3 }} />
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(94,140,135,.08)', border: '1px solid rgba(94,140,135,.2)', borderRadius: 10, padding: '8px 14px', fontSize: 12, marginBottom: 10 }}>
          <span style={{ fontWeight: 600, color: 'var(--teal)' }}>{selected.size} selecionada(s)</span>
          <button className="btn-action btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => void aprovarLote()}>Aprovar</button>
          <button className="btn-action btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => void marcarPagoLote()}>Pagar</button>
          <button className="btn-action btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => exportarCsv(rows.filter(r => selected.has(r.id)))}>Exportar</button>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--gray-400)' }} onClick={() => setSelected(new Set())}>Limpar</button>
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
              <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 32 }}>Carregando…</td></tr>
            ) : filtradas.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 32 }}>Nenhuma despesa neste período com os filtros atuais.</td></tr>
            ) : filtradas.map(r => (
              <tr key={r.id}>
                <td><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleOne(r.id)} /></td>
                <td style={{ fontWeight: 600 }}>
                  {r.descricao}
                  {r.recorrente && <span style={{ fontSize: 10, color: 'var(--gray-400)', marginLeft: 6 }}>(recorrente)</span>}
                </td>
                <td>{r.responsavel_nome || '—'}</td>
                <td>{r.categoria}</td>
                <td>{centroNome(r.centro_custo_id)}</td>
                <td style={{ fontWeight: 700, color: 'var(--red)', fontFamily: "'Sora', sans-serif" }}>{formatBRL(Number(r.valor))}</td>
                <td>{r.data_vencimento ? new Date(r.data_vencimento).toLocaleDateString('pt-BR') : '—'}</td>
                <td>
                  <span title={r.status === 'rejeitado' ? r.rejeitado_motivo || '' : undefined}>
                    {statusTag(r.status)}
                  </span>
                </td>
                <td style={{ position: 'relative' }}>
                  <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)', padding: 4, fontSize: 16 }} onClick={() => setMenuAberto(menuAberto === r.id ? null : r.id)}>⋯</button>
                  {menuAberto === r.id && (
                    <>
                      <button type="button" style={{ position: 'fixed', inset: 0, zIndex: 10, cursor: 'default' }} aria-label="fechar" onClick={() => setMenuAberto(null)} />
                      <div style={{ position: 'absolute', right: 0, top: '100%', zIndex: 20, marginTop: 4, width: 200, background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.12)', padding: '4px 0' }}>
                        {r.status === 'pendente_aprovacao' && <button style={menuItemStyle} onClick={() => void aprovar(r.id)}>Aprovar</button>}
                        {r.status === 'pendente_aprovacao' && <button style={menuItemStyle} onClick={() => { setRejeitar({ id: r.id }); setMenuAberto(null) }}>Rejeitar…</button>}
                        {(r.status === 'aprovado' || r.status === 'pendente_aprovacao') && <button style={menuItemStyle} onClick={() => void marcarPago(r.id)}>Marcar como pago</button>}
                        {r.comprovante_url && <button style={menuItemStyle} onClick={() => void abrirComprovante(r.comprovante_url!)}>Ver comprovante</button>}
                        <button style={menuItemStyle} onClick={() => abrirEditar(r)}>Editar</button>
                        <button style={{ ...menuItemStyle, color: 'var(--red)' }} onClick={() => void excluir(r.id)}>Excluir</button>
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

      {rejeitar && (
        <div className="modal-bg" onClick={() => { setRejeitar(null); setMotivoRejeicao('') }}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-title">
              Rejeitar despesa
              <button className="modal-close" onClick={() => { setRejeitar(null); setMotivoRejeicao('') }}>×</button>
            </div>
            <p style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 12 }}>Informe o motivo (visível no histórico).</p>
            <textarea value={motivoRejeicao} onChange={e => setMotivoRejeicao(e.target.value)} rows={3} className="form-input" style={{ resize: 'vertical', height: 80 }} placeholder="Motivo da rejeição" />
            <div className="modal-actions">
              <button className="btn-action btn-ghost" onClick={() => { setRejeitar(null); setMotivoRejeicao('') }}>Cancelar</button>
              <button className="btn-action" style={{ background: 'var(--red)' }} onClick={confirmarRejeitar}>Rejeitar</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
