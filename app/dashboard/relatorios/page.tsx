'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, AreaChart, Area } from 'recharts'

type Met = Record<string, number | string>
type Lancamento = { id: string; descricao: string; valor: number; origem: string; competencia: string; created_at: string; conta_id: string | null }

const TABS = ['DRE Completo', 'Comparativo', 'Métricas', 'Histórico 12M'] as const

export default function RelatoriosPage() {
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
    await fetch('/api/dre/recalcular', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(sess.session?.access_token ? { Authorization: `Bearer ${sess.session.access_token}` } : {}) }, body: JSON.stringify({ empresaId: empresa, competencia: compDate.toISOString() }) })
    const { data: met } = await supabase.from('metricas_financeiras').select('*').eq('empresa_id', empresa).eq('competencia', `${competencia}-01`).maybeSingle()
    const { data: hist } = await supabase.from('metricas_financeiras').select('*').eq('empresa_id', empresa).order('competencia', { ascending: false }).limit(12)
    const { data: contas } = await supabase.from('plano_contas').select('id,codigo,nome').eq('empresa_id', empresa).order('codigo')
    setMetricas((met as Met) ?? null)
    setHistorico((hist as Met[]) ?? [])
    setPlano((contas ?? []) as Array<{ id: string; codigo: string; nome: string }>)
  }, [competencia])

  useEffect(() => { void carregar() }, [carregar])

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
    const { data } = await supabase.from('lancamentos').select('id,descricao,valor,origem,competencia,created_at,conta_id').eq('empresa_id', empresaId).gte('competencia', ini).lte('competencia', fim).order('created_at', { ascending: false })
    setDrillConta(contaLabel)
    setDrillRows((data ?? []) as Lancamento[])
    setDrillOpen(true)
  }

  async function analisarIA() {
    const atual = metricas ?? {}
    const prev = historico.slice(1, 4)
    const { data: sess } = await supabase.auth.getSession()
    const res = await fetch('/api/dre/analisar', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(sess.session?.access_token ? { Authorization: `Bearer ${sess.session.access_token}` } : {}) }, body: JSON.stringify({ metricasAtuais: atual, historico3Meses: prev }) })
    const out = (await res.json()) as { analise?: Record<string, unknown>; error?: string }
    if (!res.ok) { alert(out.error || 'Falha na análise'); return }
    setAnalise(out.analise ?? null)
  }

  async function exportarPdf() {
    const res = await fetch('/api/dre/exportar-pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ empresaNome: 'Empresa', periodo: competencia, dre: linhas.map((l) => ({ linha: l.linha, valor: l.atual })), metricas: metricas ?? {}, analise }) })
    const blob = await res.blob()
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `dre_${competencia}.pdf`; a.click(); URL.revokeObjectURL(a.href)
  }

  async function exportarExcel() {
    const res = await fetch('/api/dre/exportar-excel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dre: linhas, comparativo: historico, metricas: metricas ? Object.entries(metricas).map(([k, v]) => ({ metrica: k, valor: v })) : [] }) })
    const blob = await res.blob()
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `dre_${competencia}.xlsx`; a.click(); URL.revokeObjectURL(a.href)
  }

  async function salvarLancamentoManual() {
    const v = Number.parseFloat(manual.valor)
    if (!manual.conta_id || !manual.descricao || !v) return
    await supabase.from('lancamentos').insert({ empresa_id: empresaId, conta_id: manual.conta_id, descricao: manual.descricao, valor: v, tipo: manual.tipo, competencia: manual.competencia, origem: 'manual' })
    const { data: sess } = await supabase.auth.getSession()
    await fetch('/api/dre/recalcular', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(sess.session?.access_token ? { Authorization: `Bearer ${sess.session.access_token}` } : {}) }, body: JSON.stringify({ empresaId, competencia: manual.competencia }) })
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

  const isTotalLine = (linha: string) => linha.startsWith('=')

  return (
    <>
      {/* Header */}
      <div className="page-hdr">
        <div>
          <div className="page-title">DRE & Plano de Contas</div>
          <div className="page-sub">Demonstrativo de Resultados · {competencia}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select className="form-input" style={{ width: 'auto', padding: '6px 10px', fontSize: 12 }} value={periodo} onChange={(e) => setPeriodo(e.target.value as 'mensal' | 'trimestral' | 'anual')}>
            <option value="mensal">Mensal</option><option value="trimestral">Trimestral</option><option value="anual">Anual</option>
          </select>
          <input type="month" className="form-input" style={{ width: 'auto', padding: '6px 10px', fontSize: 12 }} value={competencia} onChange={(e) => setCompetencia(e.target.value)} />
          <button className="btn-action btn-ghost" onClick={() => void analisarIA()}>Analisar com IA</button>
          <button className="btn-action btn-ghost" onClick={() => void exportarPdf()}>PDF</button>
          <button className="btn-action btn-ghost" onClick={() => void exportarExcel()}>Excel</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {TABS.map((t) => (
          <button key={t} className={`btn-action${tab !== t ? ' btn-ghost' : ''}`} style={{ fontSize: 11, padding: '5px 12px' }} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {/* DRE Completo */}
      {tab === 'DRE Completo' && (
        <div className="dre-full">
          {linhas.map((l) => {
            const ant = Number(historico[1]?.[l.chave] || 0)
            const vari = variacao(l.atual, ant)
            return (
              <button key={l.linha} className="dre-section" style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', borderBottom: '1px solid var(--gray-100)', paddingBottom: 7, paddingTop: 7 }} onClick={() => void abrirDrill(l.linha)}>
                <span className={isTotalLine(l.linha) ? 'dre-total' : 'dre-sub'}>{l.linha}</span>
                <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: isTotalLine(l.linha) ? 800 : 600, color: l.atual >= 0 ? 'var(--green)' : 'var(--red)', fontSize: isTotalLine(l.linha) ? 14 : 13 }}>{fmtBRL(l.atual)}</span>
                  <span style={{ fontFamily: "'DM Mono', monospace", color: 'var(--gray-400)', fontSize: 12, minWidth: 80 }}>{fmtBRL(ant)}</span>
                  <span style={{ fontSize: 11, color: vari >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600, minWidth: 50 }}>{vari >= 0 ? '+' : ''}{vari.toFixed(1)}%</span>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Comparativo */}
      {tab === 'Comparativo' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="chart-card" style={{ height: 280 }}>
            <div className="chart-title">Receita vs Despesas vs Lucro</div>
            <ResponsiveContainer width="100%" height="85%">
              <BarChart data={histChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
                <XAxis dataKey="mes" tick={{ fontSize: 9, fill: 'var(--gray-400)' }} />
                <YAxis tick={{ fontSize: 9, fill: 'var(--gray-400)' }} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid var(--gray-100)', fontSize: 11 }} />
                <Bar dataKey="receita" name="Receita" fill="var(--green)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="despesas" name="Despesas" fill="var(--red)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="lucro" name="Lucro" fill="var(--teal)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-card" style={{ height: 280 }}>
            <div className="chart-title">Margem Líquida %</div>
            <ResponsiveContainer width="100%" height="85%">
              <LineChart data={histChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
                <XAxis dataKey="mes" tick={{ fontSize: 9, fill: 'var(--gray-400)' }} />
                <YAxis tick={{ fontSize: 9, fill: 'var(--gray-400)' }} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid var(--gray-100)', fontSize: 11 }} />
                <Line type="monotone" dataKey="margem" name="Margem %" stroke="var(--gold)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Métricas */}
      {tab === 'Métricas' && (
        <>
          <div className="kpis">
            {['roi', 'roic', 'roce', 'margem_liquida'].map((k) => (
              <div key={k} className="kpi">
                <div className="kpi-lbl">{k.toUpperCase()}</div>
                <div className="kpi-val">{Number(metricas?.[k] || 0).toFixed(2)}%</div>
              </div>
            ))}
          </div>
          <div className="expenses-table">
            <table>
              <thead><tr><th>Métrica</th><th>Valor</th></tr></thead>
              <tbody>
                {['ebitda', 'ebit', 'lair', 'capital_investido', 'capital_empregado'].map((k) => (
                  <tr key={k}><td>{k}</td><td style={{ fontFamily: "'DM Mono', monospace" }}>{Number(metricas?.[k] || 0).toLocaleString('pt-BR')}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Histórico 12M */}
      {tab === 'Histórico 12M' && (
        <>
          <div className="cf-chart-card" style={{ height: 280 }}>
            <div className="chart-title">Histórico 12 meses</div>
            <ResponsiveContainer width="100%" height="85%">
              <AreaChart data={histChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
                <XAxis dataKey="mes" tick={{ fontSize: 9, fill: 'var(--gray-400)' }} />
                <YAxis tick={{ fontSize: 9, fill: 'var(--gray-400)' }} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid var(--gray-100)', fontSize: 11 }} />
                <Area type="monotone" dataKey="receita" name="Receita" stroke="var(--green)" fill="rgba(45,155,111,.1)" />
                <Area type="monotone" dataKey="lucro" name="Lucro" stroke="var(--teal)" fill="rgba(94,140,135,.1)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="expenses-table" style={{ marginTop: 12 }}>
            <table>
              <thead><tr><th>Mês</th><th>Receita</th><th>Lucro</th><th>Margem</th></tr></thead>
              <tbody>
                {histChart.map((h) => (
                  <tr key={h.mes}>
                    <td style={{ fontFamily: "'DM Mono', monospace" }}>{h.mes}</td>
                    <td style={{ color: 'var(--green)', fontWeight: 600 }}>{fmtBRL(h.receita)}</td>
                    <td style={{ color: h.lucro >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>{fmtBRL(h.lucro)}</td>
                    <td style={{ fontFamily: "'DM Mono', monospace" }}>{h.margem.toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Análise IA */}
      {analise && (
        <div style={{ marginTop: 14, background: 'rgba(94,140,135,.06)', border: '1px solid rgba(94,140,135,.2)', borderRadius: 12, padding: 16 }}>
          <div className="chart-title" style={{ marginBottom: 8 }}>Análise FactorOne</div>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', marginBottom: 6 }}>Score de saúde: {String(analise.score_saude ?? '—')}</p>
          <p style={{ fontSize: 12, color: 'var(--navy)', lineHeight: 1.65 }}>{String(analise.resumo_executivo ?? '')}</p>
        </div>
      )}

      {/* Modal drill */}
      {drillOpen && (
        <div className="modal-bg" onClick={() => setDrillOpen(false)}>
          <div className="modal-box" style={{ width: 680 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">
              {drillConta} — {competencia}
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-action btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => setManualOpen(true)}>+ Lançamento manual</button>
                <button className="modal-close" onClick={() => setDrillOpen(false)}>×</button>
              </div>
            </div>
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              <div className="expenses-table">
                <table>
                  <thead><tr><th>Data</th><th>Descrição</th><th>Origem</th><th>Valor</th></tr></thead>
                  <tbody>
                    {drillRows.length === 0 ? (
                      <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 24 }}>Sem lançamentos.</td></tr>
                    ) : drillRows.map(r => (
                      <tr key={r.id}>
                        <td>{new Date(r.created_at).toLocaleDateString('pt-BR')}</td>
                        <td>{r.descricao}</td>
                        <td><span className="tag gray">{r.origem}</span></td>
                        <td style={{ fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>{fmtBRL(Number(r.valor || 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal lançamento manual */}
      {manualOpen && (
        <div className="modal-bg" onClick={() => setManualOpen(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-title">
              Novo lançamento manual
              <button className="modal-close" onClick={() => setManualOpen(false)}>×</button>
            </div>
            <div className="form-group">
              <label className="form-label">Conta</label>
              <select className="form-input" value={manual.conta_id} onChange={(e) => setManual((m) => ({ ...m, conta_id: e.target.value }))}>
                <option value="">Selecione a conta</option>
                {plano.map((p) => <option key={p.id} value={p.id}>{p.codigo} - {p.nome}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Descrição</label>
              <input className="form-input" placeholder="Descrição" value={manual.descricao} onChange={(e) => setManual((m) => ({ ...m, descricao: e.target.value }))} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Valor</label>
                <input className="form-input" placeholder="0,00" value={manual.valor} onChange={(e) => setManual((m) => ({ ...m, valor: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Tipo</label>
                <select className="form-input" value={manual.tipo} onChange={(e) => setManual((m) => ({ ...m, tipo: e.target.value }))}>
                  <option value="debito">Débito</option><option value="credito">Crédito</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Competência</label>
              <input type="date" className="form-input" value={manual.competencia} onChange={(e) => setManual((m) => ({ ...m, competencia: e.target.value }))} />
            </div>
            <div className="modal-actions">
              <button className="btn-action btn-ghost" onClick={() => setManualOpen(false)}>Cancelar</button>
              <button className="btn-action" onClick={() => void salvarLancamentoManual()}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
