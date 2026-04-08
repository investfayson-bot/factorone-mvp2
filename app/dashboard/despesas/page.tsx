'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import {
  ChevronDown,
  Download,
  FileDown,
  MoreHorizontal,
  Printer,
  Search,
  Check,
  X,
  Wallet,
  Clock,
  TrendingDown,
  PiggyBank,
} from 'lucide-react'
import NovaDespesaModal, { type DespesaEdit } from '@/components/despesas/NovaDespesaModal'
import { formatBRL } from '@/lib/currency-brl'

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

const STATUS_ORDER = [
  'pendente_aprovacao',
  'aprovado',
  'rejeitado',
  'pago',
  'cancelado',
] as const

const STATUS_LABEL: Record<string, string> = {
  pendente_aprovacao: 'Pendente aprovação',
  aprovado: 'Aprovado',
  rejeitado: 'Rejeitado',
  pago: 'Pago',
  cancelado: 'Cancelado',
}

function statusBadge(status: string) {
  const base = 'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium'
  switch (status) {
    case 'pendente_aprovacao':
      return (
        <span className={`${base} bg-amber-100 text-amber-800`}>
          <Clock size={12} /> Pendente
        </span>
      )
    case 'aprovado':
      return <span className={`${base} bg-blue-100 text-blue-800`}>Aprovado</span>
    case 'pago':
      return (
        <span className={`${base} bg-emerald-100 text-emerald-800`}>
          <Check size={12} /> Pago
        </span>
      )
    case 'rejeitado':
      return (
        <span className={`${base} bg-red-100 text-red-800`} title="Rejeitado">
          <X size={12} /> Rejeitado
        </span>
      )
    case 'cancelado':
      return <span className={`${base} bg-slate-200 text-slate-600 line-through`}>Cancelado</span>
    default:
      return <span className={base}>{status}</span>
  }
}

function lastDayOfMonth(y: number, m: number): string {
  const d = new Date(y, m, 0)
  return d.toISOString().slice(0, 10)
}

async function abrirComprovante(pathOrUrl: string) {
  if (pathOrUrl.startsWith('http')) {
    window.open(pathOrUrl, '_blank')
    return
  }
  const { data, error } = await supabase.storage.from('comprovantes').createSignedUrl(pathOrUrl, 3600)
  if (error || !data?.signedUrl) {
    toast.error('Não foi possível abrir o comprovante')
    return
  }
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

  const periodoLabel = useMemo(
    () =>
      new Date(ano, mes - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
    [ano, mes]
  )

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser()
    const user = auth.user
    if (!user) return
    setUserId(user.id)
    const { data: u } = await supabase.from('usuarios').select('empresa_id, nome').eq('id', user.id).single()
    if (!u?.empresa_id) return
    setEmpresaId(u.empresa_id)
    setUserName(u.nome ?? user.email ?? null)

    const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`
    const fim = lastDayOfMonth(ano, mes)

    const [dRes, cRes, catRes, teamRes] = await Promise.all([
      supabase
        .from('despesas')
        .select('*')
        .eq('empresa_id', u.empresa_id)
        .gte('data_despesa', inicio)
        .lte('data_despesa', fim)
        .order('data_despesa', { ascending: false }),
      supabase.from('centros_custo').select('id, nome').eq('empresa_id', u.empresa_id).eq('ativo', true),
      supabase.from('categorias_despesa').select('nome').eq('empresa_id', u.empresa_id).order('nome'),
      supabase.from('usuarios').select('id, nome').eq('empresa_id', u.empresa_id),
    ])

    if (dRes.error) toast.error(dRes.error.message)
    setRows((dRes.data ?? []) as DespesaRow[])
    setCentros((cRes.data ?? []) as { id: string; nome: string }[])
    const nomes = (catRes.data ?? []).map((x: { nome: string }) => x.nome)
    setCategorias(nomes.length ? nomes : ['Outros'])
    setMembros((teamRes.data ?? []) as { id: string; nome: string | null }[])
    setLoading(false)
  }, [ano, mes])

  useEffect(() => {
    void load()
  }, [load])

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
      list = list.filter(
        (r) =>
          r.descricao.toLowerCase().includes(q) ||
          (r.responsavel_nome && r.responsavel_nome.toLowerCase().includes(q))
      )
    }
    return list
  }, [rows, tab, filtroStatus, filtroCategoria, filtroCentro, search])

  const inicioMes = `${ano}-${String(mes).padStart(2, '0')}-01`
  const fimMes = lastDayOfMonth(ano, mes)
  const prev = new Date(ano, mes - 2, 1)
  const prevInicio = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-01`
  const prevFim = lastDayOfMonth(prev.getFullYear(), prev.getMonth() + 1)

  const kpis = useMemo(() => {
    const noMes = (r: DespesaRow) => {
      const d = r.data_despesa || r.data
      if (!d) return false
      return d >= inicioMes && d <= fimMes
    }
    const noMesAnt = (r: DespesaRow) => {
      const d = r.data_despesa || r.data
      if (!d) return false
      return d >= prevInicio && d <= prevFim
    }
    const totalMes = rows.filter(noMes).reduce((s, r) => s + Number(r.valor || 0), 0)
    const aAprovar = rows
      .filter(noMes)
      .filter((r) => r.status === 'pendente_aprovacao')
      .reduce((s, r) => s + Number(r.valor || 0), 0)
    const aPagar = rows
      .filter(noMes)
      .filter((r) => r.status === 'aprovado')
      .reduce((s, r) => s + Number(r.valor || 0), 0)
    const totalAnt = rows.filter(noMesAnt).reduce((s, r) => s + Number(r.valor || 0), 0)
    const economia = totalAnt > 0 ? ((totalAnt - totalMes) / totalAnt) * 100 : totalMes === 0 ? 0 : -100
    return { totalMes, aAprovar, aPagar, economia, totalAnt }
  }, [rows, inicioMes, fimMes, prevInicio, prevFim])

  function toggleAll() {
    if (selected.size === filtradas.length) setSelected(new Set())
    else setSelected(new Set(filtradas.map((r) => r.id)))
  }

  function toggleOne(id: string) {
    const n = new Set(selected)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    setSelected(n)
  }

  async function aprovar(id: string) {
    const { error } = await supabase
      .from('despesas')
      .update({
        status: 'aprovado',
        aprovado_por: userId,
        aprovado_em: new Date().toISOString(),
      })
      .eq('id', id)
    if (error) toast.error(error.message)
    else {
      toast.success('Despesa aprovada')
      void load()
    }
    setMenuAberto(null)
  }

  async function aprovarLote() {
    const ids = Array.from(selected).filter((id) => rows.find((r) => r.id === id)?.status === 'pendente_aprovacao')
    if (!ids.length) {
      toast.error('Nenhuma despesa pendente selecionada')
      return
    }
    const { error } = await supabase
      .from('despesas')
      .update({
        status: 'aprovado',
        aprovado_por: userId,
        aprovado_em: new Date().toISOString(),
      })
      .in('id', ids)
    if (error) toast.error(error.message)
    else {
      toast.success(`${ids.length} despesa(s) aprovada(s)`)
      setSelected(new Set())
      void load()
    }
  }

  async function marcarPago(id: string) {
    const row = rows.find((r) => r.id === id)
    if (!row) return
    const hoje = new Date().toISOString().slice(0, 10)
    const { data: tx, error: e1 } = await supabase
      .from('transacoes')
      .insert({
        empresa_id: userId,
        data: hoje,
        descricao: `Despesa: ${row.descricao}`,
        categoria: row.categoria,
        tipo: 'saida',
        valor: row.valor,
        status: 'confirmada',
      })
      .select('id')
      .single()
    if (e1) {
      toast.error(e1.message)
      return
    }
    const { error: e2 } = await supabase
      .from('despesas')
      .update({
        status: 'pago',
        data_pagamento: hoje,
        transaction_id: tx?.id ?? null,
      })
      .eq('id', id)
    if (e2) toast.error(e2.message)
    else {
      toast.success('Marcado como pago e lançado no fluxo de caixa')
      void load()
    }
    setMenuAberto(null)
  }

  async function marcarPagoLote() {
    const pendentes = Array.from(selected).filter((id) => {
      const r = rows.find((x) => x.id === id)
      return r && (r.status === 'aprovado' || r.status === 'pendente_aprovacao')
    })
    if (!pendentes.length) {
      toast.error('Selecione despesas aprovadas ou pendentes para pagar')
      return
    }
    const hoje = new Date().toISOString().slice(0, 10)
    for (const id of pendentes) {
      const row = rows.find((r) => r.id === id)
      if (!row) continue
      const { data: tx } = await supabase
        .from('transacoes')
        .insert({
          empresa_id: userId,
          data: hoje,
          descricao: `Despesa: ${row.descricao}`,
          categoria: row.categoria,
          tipo: 'saida',
          valor: row.valor,
          status: 'confirmada',
        })
        .select('id')
        .single()
      await supabase
        .from('despesas')
        .update({
          status: 'pago',
          data_pagamento: hoje,
          transaction_id: tx?.id ?? null,
        })
        .eq('id', id)
    }
    toast.success('Pagamentos registrados')
    setSelected(new Set())
    void load()
  }

  function confirmarRejeitar() {
    if (!rejeitar) return
    if (motivoRejeicao.trim().length < 5) {
      toast.error('Informe o motivo (mín. 5 caracteres)')
      return
    }
    void (async () => {
      const { error } = await supabase
        .from('despesas')
        .update({ status: 'rejeitado', rejeitado_motivo: motivoRejeicao.trim() })
        .eq('id', rejeitar.id)
      if (error) toast.error(error.message)
      else {
        toast.success('Despesa rejeitada')
        setRejeitar(null)
        setMotivoRejeicao('')
        void load()
      }
    })()
  }

  async function excluir(id: string) {
    if (!confirm('Excluir esta despesa permanentemente?')) return
    const { error } = await supabase.from('despesas').delete().eq('id', id)
    if (error) toast.error(error.message)
    else {
      toast.success('Removida')
      void load()
    }
    setMenuAberto(null)
  }

  function exportarCsv(lista: DespesaRow[]) {
    const header = [
      'Descrição',
      'Responsável',
      'Categoria',
      'Centro',
      'Valor',
      'Vencimento',
      'Status',
      'Data despesa',
    ]
    const lines = lista.map((r) =>
      [
        `"${(r.descricao || '').replace(/"/g, '""')}"`,
        `"${(r.responsavel_nome || '').replace(/"/g, '""')}"`,
        `"${r.categoria}"`,
        `"${centroNome(r.centro_custo_id)}"`,
        Number(r.valor).toFixed(2),
        r.data_vencimento || '',
        STATUS_LABEL[r.status] || r.status,
        r.data_despesa || r.data || '',
      ].join(',')
    )
    const csv = [header.join(','), ...lines].join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
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
    w.document.write(`
      <html><head><title>Despesas ${periodoLabel}</title>
      <style>
        body { font-family: system-ui, sans-serif; padding: 24px; color: #1e293b; }
        h1 { font-size: 18px; }
        table { width:100%; border-collapse: collapse; font-size: 12px; margin-top: 16px; }
        th, td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; }
        th { background: #f8fafc; }
      </style></head><body>
      <h1>Despesas — ${periodoLabel}</h1>
      <p>FactorOne · Total: ${formatBRL(kpis.totalMes)}</p>
      <table><thead><tr>
        <th>Descrição</th><th>Categoria</th><th>Valor</th><th>Status</th><th>Vencimento</th>
      </tr></thead><tbody>
      ${filtradas
        .map(
          (r) => `<tr>
        <td>${escapeHtml(r.descricao)}</td>
        <td>${escapeHtml(r.categoria)}</td>
        <td>${formatBRL(Number(r.valor))}</td>
        <td>${escapeHtml(STATUS_LABEL[r.status] || r.status)}</td>
        <td>${r.data_vencimento || '—'}</td>
      </tr>`
        )
        .join('')}
      </tbody></table>
      <script>window.onload = () => { window.print(); }</script>
      </body></html>`)
    w.document.close()
  }

  function escapeHtml(s: string) {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  function abrirEditar(r: DespesaRow) {
    setEditRow({
      id: r.id,
      descricao: r.descricao,
      valor: Number(r.valor),
      categoria: r.categoria,
      centro_custo_id: r.centro_custo_id,
      responsavel_id: r.responsavel_id,
      tipo_pagamento: r.tipo_pagamento,
      data_despesa: r.data_despesa || r.data || inicioMes,
      data_vencimento: r.data_vencimento,
      observacao: r.observacao,
      recorrente: r.recorrente,
      recorrencia_tipo: r.recorrencia_tipo,
      comprovante_url: r.comprovante_url,
    })
    setModalOpen(true)
    setMenuAberto(null)
  }

  const membrosOpts =
    membros.length > 0 ? membros : [{ id: userId, nome: userName }]

  return (
    <div className="min-h-full bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Despesas</h1>
            <p className="mt-1 text-sm capitalize text-slate-500">{periodoLabel}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                onClick={() => setExportMenuOpen((o) => !o)}
              >
                <Download size={16} /> Exportar <ChevronDown size={14} />
              </button>
              {exportMenuOpen && (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-10 cursor-default"
                    aria-label="Fechar menu exportar"
                    onClick={() => setExportMenuOpen(false)}
                  />
                  <div className="absolute right-0 z-20 mt-1 w-48 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
                      onClick={() => {
                        exportarCsv(filtradas)
                        setExportMenuOpen(false)
                      }}
                    >
                      <FileDown size={14} /> CSV (filtradas)
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
                      onClick={() => {
                        exportarPdf()
                        setExportMenuOpen(false)
                      }}
                    >
                      <Printer size={14} /> PDF / Imprimir
                    </button>
                  </div>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setEditRow(null)
                setModalOpen(true)
              }}
              className="rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800"
            >
              + Nova despesa
            </button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-slate-500">
              <Wallet size={18} />
              <span className="text-xs font-medium uppercase tracking-wide">Total do mês</span>
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900">{formatBRL(kpis.totalMes)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-amber-600">
              <Clock size={18} />
              <span className="text-xs font-medium uppercase tracking-wide">A aprovar</span>
            </div>
            <p className="mt-2 text-2xl font-bold text-amber-700">{formatBRL(kpis.aAprovar)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-blue-600">
              <TrendingDown size={18} />
              <span className="text-xs font-medium uppercase tracking-wide">A pagar</span>
            </div>
            <p className="mt-2 text-2xl font-bold text-blue-800">{formatBRL(kpis.aPagar)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-emerald-600">
              <PiggyBank size={18} />
              <span className="text-xs font-medium uppercase tracking-wide">Vs mês anterior</span>
            </div>
            <p className="mt-2 text-2xl font-bold text-emerald-800">
              {kpis.economia >= 0 ? '+' : ''}
              {kpis.economia.toFixed(1)}%
            </p>
            <p className="text-xs text-slate-400">Menos gasto = economia positiva</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500">
            <Search size={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar descrição ou responsável…"
              className="min-w-[200px] rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
            />
          </div>
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">Status (todos)</option>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <select
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">Categoria</option>
            {categorias.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={filtroCentro}
            onChange={(e) => setFiltroCentro(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">Centro de custo</option>
            {centros.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500">Mês</label>
            <select
              value={mes}
              onChange={(e) => setMes(Number(e.target.value))}
              className="rounded-lg border border-slate-200 px-2 py-2 text-sm"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {new Date(2000, m - 1).toLocaleString('pt-BR', { month: 'short' })}
                </option>
              ))}
            </select>
            <select
              value={ano}
              onChange={(e) => setAno(Number(e.target.value))}
              className="rounded-lg border border-slate-200 px-2 py-2 text-sm"
            >
              {[ano - 1, ano, ano + 1].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
          {(
            [
              ['todas', 'Todas'],
              ['pendente', 'Aguardando aprovação'],
              ['aprovadas', 'Aprovadas'],
              ['pagas', 'Pagas'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                tab === k
                  ? 'bg-blue-700 text-white'
                  : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm">
            <span className="font-medium text-blue-900">{selected.size} selecionada(s)</span>
            <button
              type="button"
              onClick={() => void aprovarLote()}
              className="rounded-lg bg-white px-3 py-1.5 font-medium text-blue-800 ring-1 ring-blue-200 hover:bg-blue-100"
            >
              Aprovar selecionadas
            </button>
            <button
              type="button"
              onClick={() => void marcarPagoLote()}
              className="rounded-lg bg-white px-3 py-1.5 font-medium text-blue-800 ring-1 ring-blue-200 hover:bg-blue-100"
            >
              Marcar como pagas
            </button>
            <button
              type="button"
              onClick={() => exportarCsv(rows.filter((r) => selected.has(r.id)))}
              className="rounded-lg bg-white px-3 py-1.5 font-medium text-blue-800 ring-1 ring-blue-200 hover:bg-blue-100"
            >
              Exportar selecionadas
            </button>
            <button type="button" onClick={() => setSelected(new Set())} className="text-blue-600 underline">
              Limpar
            </button>
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="w-10 p-3">
                    <input
                      type="checkbox"
                      checked={filtradas.length > 0 && selected.size === filtradas.length}
                      onChange={toggleAll}
                      className="rounded border-slate-300"
                    />
                  </th>
                  <th className="p-3">Descrição</th>
                  <th className="p-3">Responsável</th>
                  <th className="p-3">Categoria</th>
                  <th className="p-3">Centro</th>
                  <th className="p-3">Valor</th>
                  <th className="p-3">Vencimento</th>
                  <th className="p-3">Status</th>
                  <th className="w-12 p-3" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-500">
                      Carregando…
                    </td>
                  </tr>
                ) : filtradas.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-500">
                      Nenhuma despesa neste período com os filtros atuais.
                    </td>
                  </tr>
                ) : (
                  filtradas.map((r) => (
                    <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/80">
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={selected.has(r.id)}
                          onChange={() => toggleOne(r.id)}
                          className="rounded border-slate-300"
                        />
                      </td>
                      <td className="max-w-[220px] p-3 font-medium text-slate-800">
                        {r.descricao}
                        {r.recorrente && (
                          <span className="ml-2 text-[10px] font-normal text-slate-400">(recorrente)</span>
                        )}
                      </td>
                      <td className="p-3 text-slate-600">{r.responsavel_nome || '—'}</td>
                      <td className="p-3 text-slate-600">{r.categoria}</td>
                      <td className="p-3 text-slate-600">{centroNome(r.centro_custo_id)}</td>
                      <td className="p-3 font-semibold text-red-600">{formatBRL(Number(r.valor))}</td>
                      <td className="p-3 text-slate-600">
                        {r.data_vencimento
                          ? new Date(r.data_vencimento).toLocaleDateString('pt-BR')
                          : '—'}
                      </td>
                      <td className="p-3">
                        <span title={r.status === 'rejeitado' ? r.rejeitado_motivo || '' : undefined}>
                          {statusBadge(r.status)}
                        </span>
                      </td>
                      <td className="relative p-3">
                        <button
                          type="button"
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                          onClick={() => setMenuAberto(menuAberto === r.id ? null : r.id)}
                        >
                          <MoreHorizontal size={18} />
                        </button>
                        {menuAberto === r.id && (
                          <>
                            <button
                              type="button"
                              className="fixed inset-0 z-10 cursor-default"
                              aria-label="Fechar menu"
                              onClick={() => setMenuAberto(null)}
                            />
                            <div className="absolute right-0 top-full z-20 mt-1 w-52 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                              {r.status === 'pendente_aprovacao' && (
                                <button
                                  type="button"
                                  className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                                  onClick={() => void aprovar(r.id)}
                                >
                                  Aprovar
                                </button>
                              )}
                              {r.status === 'pendente_aprovacao' && (
                                <button
                                  type="button"
                                  className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                                  onClick={() => {
                                    setRejeitar({ id: r.id })
                                    setMenuAberto(null)
                                  }}
                                >
                                  Rejeitar…
                                </button>
                              )}
                              {(r.status === 'aprovado' || r.status === 'pendente_aprovacao') && (
                                <button
                                  type="button"
                                  className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                                  onClick={() => void marcarPago(r.id)}
                                >
                                  Marcar como pago
                                </button>
                              )}
                              {r.comprovante_url && (
                                <button
                                  type="button"
                                  className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                                  onClick={() => void abrirComprovante(r.comprovante_url!)}
                                >
                                  Ver comprovante
                                </button>
                              )}
                              <button
                                type="button"
                                className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                                onClick={() => abrirEditar(r)}
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                                onClick={() => void excluir(r.id)}
                              >
                                Excluir
                              </button>
                            </div>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <NovaDespesaModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setEditRow(null)
        }}
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-800">Rejeitar despesa</h3>
            <p className="mt-1 text-sm text-slate-500">Informe o motivo (visível no histórico).</p>
            <textarea
              value={motivoRejeicao}
              onChange={(e) => setMotivoRejeicao(e.target.value)}
              rows={3}
              className="mt-4 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              placeholder="Motivo da rejeição"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setRejeitar(null)
                  setMotivoRejeicao('')
                }}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarRejeitar}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Rejeitar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
