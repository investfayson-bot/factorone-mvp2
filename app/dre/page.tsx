'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, AreaChart, Area } from 'recharts'

type Met = Record<string, number | string>
type Lancamento = { id: string; descricao: string; valor: number; origem: string; competencia: string; created_at: string; conta_id: string | null }

const TABS = ['DRE Completo', 'Comparativo', 'Métricas', 'Histórico 12M'] as const

export default function DrePage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('DRE Completo')
  const [periodo, setPeriodo] = useState<'mensal' | 'trimestral' | 'anual'>('mensal')
  const [competencia, setCompetencia] = useState(new Date().toISOString().slice(0, 7))
  const [empresaId, setEmpresaId] = useState('')
  const [metricas, setMetricas] = useState<Met | null>(null)
  const [historico, setHistorico] = useState<Met[]>([])
  const [analise, setAnalise] = useState<Record<string, unknown> | null>(null)
  const [drillOpen, setDrillOpen] = useState(false)
  const [drillConta, setDrillConta] = useState('RECEITA BRUTA')
  const [drillRows, setDrillRows] = useState<Lancamento[]>([])
  const [manualOpen, setManualOpen] = useState(false)
  const [plano, setPlano] = useState<Array<{ id: string; codigo: string; nome: string }>>([])
  const [manual, setManual] = useState({ conta_id: '', descricao: '', valor: '', tipo: 'credito', competencia: new Date().toISOString().slice(0, 10) })

  const carregar = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser()
    const user = auth.user
    if (!user) return
    const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const empresa = u?.empresa_id ?? user.id
    setEmpresaId(empresa)
    const compDate = new Date(`${competencia}-01T00:00:00`)
    const { data: sess } = await supabase.auth.getSession()
    await fetch('/api/dre/recalcular', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(sess.session?.access_token ? { Authorization: `Bearer ${sess.session.access_token}` } : {}) },
      body: JSON.stringify({ empresaId: empresa, competencia: compDate.toISOString() }),
    })
    const { data: met } = await supabase.from('metricas_financeiras').select('*').eq('empresa_id', empresa).eq('competencia', `${competencia}-01`).maybeSingle()
    const { data: hist } = await supabase.from('metricas_financeiras').select('*').eq('empresa_id', empresa).order('competencia', { ascending: false }).limit(12)
    const { data: contas } = await supabase.from('plano_contas').select('id,codigo,nome').eq('empresa_id', empresa).order('codigo')
    setMetricas((met as Met) ?? null)
    setHistorico((hist as Met[]) ?? [])
    setPlano((contas ?? []) as Array<{ id: string; codigo: string; nome: string }>)
  }, [competencia])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const linhas = useMemo(() => {
    const m = metricas ?? {}
    return [
      { linha: 'RECEITA BRUTA', atual: Number(m.receita_bruta || 0), chave: 'receita_bruta' },
      { linha: '(-) DEDUÇÕES', atual: Number(m.deducoes || 0), chave: 'deducoes' },
      { linha: '= RECEITA LÍQUIDA', atual: Number(m.receita_liquida || 0), chave: 'receita_liquida' },
      { linha: '(-) CMV/CSP', atual: Number(m.cmv || 0), chave: 'cmv' },
      { linha: '= LUCRO BRUTO', atual: Number(m.lucro_bruto || 0), chave: 'lucro_bruto' },
      { linha: '(-) DESPESAS OPERACIONAIS', atual: Number(m.despesas_operacionais || 0), chave: 'despesas_operacionais' },
      { linha: '= EBITDA', atual: Number(m.ebitda || 0), chave: 'ebitda' },
      { linha: '(-) Depreciação e Amortização', atual: Number(m.depreciacao || 0), chave: 'depreciacao' },
      { linha: '= EBIT', atual: Number(m.ebit || 0), chave: 'ebit' },
      { linha: '(+/-) RESULTADO FINANCEIRO', atual: Number(m.resultado_financeiro || 0), chave: 'resultado_financeiro' },
      { linha: '= LAIR', atual: Number(m.lair || 0), chave: 'lair' },
      { linha: '(-) Impostos', atual: Number(m.impostos || 0), chave: 'impostos' },
      { linha: '= LUCRO LÍQUIDO', atual: Number(m.lucro_liquido || 0), chave: 'lucro_liquido' },
    ]
  }, [metricas])

  const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const variacao = (atual: number, ant: number) => (ant ? ((atual - ant) / Math.abs(ant)) * 100 : 0)

  async function abrirDrill(contaLabel: string) {
    const ini = `${competencia}-01`
    const fim = new Date(new Date(`${competencia}-01`).getFullYear(), new Date(`${competencia}-01`).getMonth() + 1, 0).toISOString().slice(0, 10)
    const { data } = await supabase
      .from('lancamentos')
      .select('id,descricao,valor,origem,competencia,created_at,conta_id')
      .eq('empresa_id', empresaId)
      .gte('competencia', ini)
      .lte('competencia', fim)
      .order('created_at', { ascending: false })
    setDrillConta(contaLabel)
    setDrillRows((data ?? []) as Lancamento[])
    setDrillOpen(true)
  }

  async function analisarIA() {
    const atual = metricas ?? {}
    const prev = historico.slice(1, 4)
    const { data: sess } = await supabase.auth.getSession()
    const res = await fetch('/api/dre/analisar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(sess.session?.access_token ? { Authorization: `Bearer ${sess.session.access_token}` } : {}) },
      body: JSON.stringify({ metricasAtuais: atual, historico3Meses: prev }),
    })
    const out = (await res.json()) as { analise?: Record<string, unknown>; error?: string }
    if (!res.ok) return alert(out.error || 'Falha na análise')
    setAnalise(out.analise ?? null)
  }

  async function exportarPdf() {
    const res = await fetch('/api/dre/exportar-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ empresaNome: 'Empresa', periodo: competencia, dre: linhas.map((l) => ({ linha: l.linha, valor: l.atual })), metricas: metricas ?? {}, analise }),
    })
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `dre_${competencia}.pdf`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function exportarExcel() {
    const res = await fetch('/api/dre/exportar-excel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dre: linhas,
        comparativo: historico,
        metricas: metricas ? Object.entries(metricas).map(([k, v]) => ({ metrica: k, valor: v })) : [],
      }),
    })
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `dre_${competencia}.xlsx`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function salvarLancamentoManual() {
    const v = Number.parseFloat(manual.valor)
    if (!manual.conta_id || !manual.descricao || !v) return
    await supabase.from('lancamentos').insert({
      empresa_id: empresaId,
      conta_id: manual.conta_id,
      descricao: manual.descricao,
      valor: v,
      tipo: manual.tipo,
      competencia: manual.competencia,
      origem: 'manual',
    })
    const { data: sess } = await supabase.auth.getSession()
    await fetch('/api/dre/recalcular', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(sess.session?.access_token ? { Authorization: `Bearer ${sess.session.access_token}` } : {}) },
      body: JSON.stringify({ empresaId, competencia: manual.competencia }),
    })
    setManualOpen(false)
    void carregar()
  }

  const histChart = [...historico].reverse().map((h) => ({
    mes: format(new Date(String(h.competencia)), 'MM/yy', { locale: ptBR }),
    receita: Number(h.receita_bruta || 0),
    despesas: Number(h.despesas_operacionais || 0),
    lucro: Number(h.lucro_liquido || 0),
    margem: Number(h.margem_liquida || 0),
  }))

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold text-slate-900">DRE — Demonstrativo de Resultados</h1>
          <div className="flex flex-wrap gap-2">
            <select className="rounded-lg border px-3 py-2 text-sm" value={periodo} onChange={(e) => setPeriodo(e.target.value as 'mensal' | 'trimestral' | 'anual')}>
              <option value="mensal">Mensal</option><option value="trimestral">Trimestral</option><option value="anual">Anual</option>
            </select>
            <input type="month" className="rounded-lg border px-3 py-2 text-sm" value={competencia} onChange={(e) => setCompetencia(e.target.value)} />
            <button onClick={() => void analisarIA()} className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white">Analisar com IA</button>
            <button onClick={() => void exportarPdf()} className="rounded-lg border bg-white px-3 py-2 text-sm">Exportar PDF</button>
            <button onClick={() => void exportarExcel()} className="rounded-lg border bg-white px-3 py-2 text-sm">Exportar Excel</button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-3 py-2 text-sm ${tab === t ? 'bg-blue-700 text-white' : 'bg-white border'}`}>{t}</button>
          ))}
        </div>

        {tab === 'DRE Completo' && (
          <div className="rounded-2xl border bg-white p-4">
            {linhas.map((l) => {
              const ant = Number(historico[1]?.[l.chave] || 0)
              return (
                <button key={l.linha} onClick={() => void abrirDrill(l.linha)} className="grid w-full grid-cols-4 border-b py-2 text-left last:border-none">
                  <span className="font-medium text-slate-800">{l.linha}</span>
                  <span>{fmtBRL(l.atual)}</span>
                  <span>{fmtBRL(ant)}</span>
                  <span className={variacao(l.atual, ant) >= 0 ? 'text-emerald-600' : 'text-red-600'}>{variacao(l.atual, ant).toFixed(1)}%</span>
                </button>
              )
            })}
          </div>
        )}

        {tab === 'Comparativo' && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="h-72 rounded-2xl border bg-white p-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={histChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="receita" fill="#16a34a" />
                  <Bar dataKey="despesas" fill="#ef4444" />
                  <Bar dataKey="lucro" fill="#2563eb" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="h-72 rounded-2xl border bg-white p-3">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={histChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="margem" stroke="#7c3aed" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {tab === 'Métricas' && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {['roi', 'roic', 'roce', 'margem_liquida'].map((k) => (
                <div key={k} className="rounded-2xl border bg-white p-4">
                  <p className="text-xs uppercase text-slate-500">{k.toUpperCase()}</p>
                  <p className="mt-1 text-2xl font-bold text-slate-800">{Number(metricas?.[k] || 0).toFixed(2)}%</p>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border bg-white p-4 text-sm">
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                {['ebitda', 'ebit', 'lair', 'capital_investido', 'capital_empregado'].map((k) => (
                  <div key={k} className="rounded-lg border p-2">
                    <p className="text-xs text-slate-500">{k}</p>
                    <p className="font-semibold">{Number(metricas?.[k] || 0).toLocaleString('pt-BR')}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'Histórico 12M' && (
          <div className="space-y-4">
            <div className="h-72 rounded-2xl border bg-white p-3">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={histChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" />
                  <YAxis />
                  <Tooltip />
                  <Area type="monotone" dataKey="receita" stroke="#16a34a" fill="#16a34a33" />
                  <Area type="monotone" dataKey="lucro" stroke="#2563eb" fill="#2563eb33" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="rounded-2xl border bg-white p-4">
              {histChart.map((h) => (
                <div key={h.mes} className="grid grid-cols-4 border-b py-2 text-sm last:border-none">
                  <span>{h.mes}</span><span>{fmtBRL(h.receita)}</span><span>{fmtBRL(h.lucro)}</span><span>{h.margem.toFixed(2)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {analise && (
          <div className="rounded-2xl border bg-white p-4">
            <p className="text-sm font-semibold">Score de saúde: {String(analise.score_saude ?? '—')}</p>
            <p className="mt-2 text-sm">{String(analise.resumo_executivo ?? '')}</p>
          </div>
        )}
      </div>

      {drillOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-3xl rounded-2xl border bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-bold">Detalhes — {drillConta} — {competencia}</h3>
              <div className="flex gap-2">
                <button className="rounded-lg border px-2 py-1 text-xs" onClick={() => setManualOpen(true)}>Adicionar lançamento manual</button>
                <button className="rounded-lg border px-2 py-1 text-xs" onClick={() => setDrillOpen(false)}>Fechar</button>
              </div>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {drillRows.map((r) => (
                <div key={r.id} className="grid grid-cols-4 border-b py-2 text-sm">
                  <span>{new Date(r.created_at).toLocaleDateString('pt-BR')}</span>
                  <span>{r.descricao}</span>
                  <span>{r.origem}</span>
                  <span>{fmtBRL(Number(r.valor || 0))}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {manualOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-2xl border bg-white p-4">
            <h3 className="font-bold">Novo lançamento manual</h3>
            <select className="mt-2 w-full rounded border px-3 py-2" value={manual.conta_id} onChange={(e) => setManual((m) => ({ ...m, conta_id: e.target.value }))}>
              <option value="">Conta</option>
              {plano.map((p) => <option key={p.id} value={p.id}>{p.codigo} - {p.nome}</option>)}
            </select>
            <input className="mt-2 w-full rounded border px-3 py-2" placeholder="Descrição" value={manual.descricao} onChange={(e) => setManual((m) => ({ ...m, descricao: e.target.value }))} />
            <input className="mt-2 w-full rounded border px-3 py-2" placeholder="Valor" value={manual.valor} onChange={(e) => setManual((m) => ({ ...m, valor: e.target.value }))} />
            <select className="mt-2 w-full rounded border px-3 py-2" value={manual.tipo} onChange={(e) => setManual((m) => ({ ...m, tipo: e.target.value }))}>
              <option value="debito">Débito</option><option value="credito">Crédito</option>
            </select>
            <input type="date" className="mt-2 w-full rounded border px-3 py-2" value={manual.competencia} onChange={(e) => setManual((m) => ({ ...m, competencia: e.target.value }))} />
            <div className="mt-3 flex justify-end gap-2">
              <button className="rounded border px-3 py-2 text-sm" onClick={() => setManualOpen(false)}>Cancelar</button>
              <button className="rounded bg-blue-700 px-3 py-2 text-sm text-white" onClick={() => void salvarLancamentoManual()}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
