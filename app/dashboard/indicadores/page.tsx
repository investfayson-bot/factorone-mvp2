'use client'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'

type Metricas = { receita_bruta: number; receita_liquida: number; lucro_bruto: number; ebitda: number; lucro_liquido: number; margem_liquida: number; despesas_operacionais: number; cmv: number } | null
type Taxas = { selic: number | null; cdi: number | null; ipca: number | null }

const fmtC = (v: number) => {
  const a = Math.abs(v)
  if (a >= 1e6) return `R$ ${(v / 1e6).toFixed(1)}M`
  if (a >= 1e3) return `R$ ${(v / 1e3).toFixed(1)}K`
  return formatBRL(v)
}
const pct = (v: number, d = 1) => `${v >= 0 ? '' : ''}${v.toFixed(d)}%`

function Card({ label, value, sub, cor, tip }: { label: string; value: string; sub?: string; cor: string; tip?: string }) {
  return (
    <div className="kpi" style={{ borderTop: `3px solid ${cor}` }} title={tip}>
      <div className="kpi-lbl">{label}{tip && <i className="fa-solid fa-circle-info" style={{ fontSize: 10, color: '#C4CFCE' }} />}</div>
      <div className="kpi-val" style={{ color: cor === '#E2E8E7' ? '#1C2B2A' : cor }}>{value}</div>
      {sub && <div className="kpi-delta" style={{ color: '#7A8F8E' }}>{sub}</div>}
    </div>
  )
}

export default function IndicadoresPage() {
  const [loading, setLoading] = useState(true)
  const [m, setM] = useState<Metricas>(null)
  const [clientesAtivos, setClientesAtivos] = useState(0)
  const [mrr, setMrr] = useState(0)
  const [novosMes, setNovosMes] = useState(0)
  const [mktGasto, setMktGasto] = useState(0)
  const [mktReceita, setMktReceita] = useState(0)
  const [saldo, setSaldo] = useState(0)
  const [taxas, setTaxas] = useState<Taxas>({ selic: null, cdi: null, ipca: null })
  const [vidaMeses, setVidaMeses] = useState(24)

  const carregar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const eid = (u?.empresa_id as string) || user.id
    const mes0 = new Date(); mes0.setDate(1)
    const [mR, cliR, mktR, contasR, tR] = await Promise.all([
      supabase.from('metricas_financeiras').select('receita_bruta,receita_liquida,lucro_bruto,ebitda,lucro_liquido,margem_liquida,despesas_operacionais,cmv').eq('empresa_id', eid).order('competencia', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('clientes').select('status,valor_contrato,created_at').eq('empresa_id', eid),
      supabase.from('marketing_campanhas').select('gasto,receita_gerada').eq('empresa_id', eid),
      supabase.from('contas_bancarias').select('saldo_disponivel,saldo').eq('empresa_id', eid),
      fetch('/api/taxas').then(r => r.json()).catch(() => ({ selic: null, cdi: null, ipca: null })),
    ])
    setM((mR.data as Metricas) ?? null)
    const clts = (cliR.data ?? []) as Array<{ status: string; valor_contrato: number | null; created_at: string }>
    const ativos = clts.filter(c => c.status === 'ativo')
    setClientesAtivos(ativos.length)
    setMrr(ativos.reduce((s, c) => s + Number(c.valor_contrato ?? 0), 0))
    setNovosMes(clts.filter(c => c.created_at >= mes0.toISOString()).length)
    const camps = (mktR.data ?? []) as Array<{ gasto: number | null; receita_gerada: number | null }>
    setMktGasto(camps.reduce((s, c) => s + Number(c.gasto ?? 0), 0))
    setMktReceita(camps.reduce((s, c) => s + Number(c.receita_gerada ?? 0), 0))
    setSaldo(((contasR.data ?? []) as Array<{ saldo_disponivel: number | null; saldo: number | null }>).reduce((s, c) => s + Number(c.saldo_disponivel ?? c.saldo ?? 0), 0))
    setTaxas(tR as Taxas)
    setLoading(false)
  }, [])
  useEffect(() => { void carregar() }, [carregar])

  // ── Cálculos ──────────────────────────────────────────────
  const arr = mrr * 12
  const arpa = clientesAtivos > 0 ? mrr / clientesAtivos : 0
  const margemBruta = m && m.receita_liquida > 0 ? m.lucro_bruto / m.receita_liquida : 0.7
  const cac = novosMes > 0 ? mktGasto / novosMes : null
  const ltv = arpa * (margemBruta || 0.7) * vidaMeses
  const ltvCac = cac && cac > 0 ? ltv / cac : null
  const roas = mktGasto > 0 ? mktReceita / mktGasto : null
  const roiMkt = mktGasto > 0 ? ((mktReceita - mktGasto) / mktGasto) * 100 : null
  const margemLiq = m ? (m.margem_liquida > 1 ? m.margem_liquida : m.margem_liquida * 100) : null
  const ebitda = m?.ebitda ?? null
  const lucroMes = m?.lucro_liquido ?? 0
  const burn = lucroMes < 0 ? -lucroMes : 0
  const runwayMeses = burn > 0 ? saldo / burn : Infinity
  const capital = saldo + (m?.receita_bruta ?? 0) // aprox. simples
  const roic = capital > 0 && m ? ((m.lucro_liquido * 12) / capital) * 100 : null

  const corLtvCac = ltvCac == null ? '#E2E8E7' : ltvCac >= 3 ? '#16A085' : ltvCac >= 1 ? '#D97706' : '#E74C3C'
  const corRunway = burn === 0 ? '#16A085' : runwayMeses < 6 ? '#E74C3C' : runwayMeses < 12 ? '#D97706' : '#16A085'

  if (loading) return <div style={{ padding: 32, color: 'var(--gray-400)', fontSize: 13 }}>Carregando indicadores…</div>

  return (
    <>
      <div className="page-hdr">
        <div>
          <div className="page-title">Indicadores</div>
          <div className="page-sub">Métricas de investidor · unit economics · rentabilidade · caixa</div>
        </div>
      </div>

      {/* Taxas de mercado */}
      <div style={{ background: '#1C2B2A', borderRadius: 14, padding: '14px 20px', marginBottom: 18, display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#7EBDB8', textTransform: 'uppercase', letterSpacing: '.08em' }}>Taxas de mercado (BACEN)</div>
        {[
          { l: 'SELIC', v: taxas.selic, s: '% a.a.' },
          { l: 'CDI', v: taxas.cdi, s: '% a.a.' },
          { l: 'IPCA 12m', v: taxas.ipca, s: '%' },
        ].map(t => (
          <div key={t.l}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.5)' }}>{t.l}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', fontFamily: "'Inter', system-ui, sans-serif" }}>{t.v != null ? `${t.v.toFixed(2)}${t.s === '%' ? '%' : ' ' + t.s}` : '—'}</div>
          </div>
        ))}
      </div>

      {/* Unit economics */}
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '.04em', margin: '0 0 10px' }}>Unit economics (SaaS)</div>
      <div className="kpis" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 8 }}>
        <Card label="MRR" value={fmtC(mrr)} sub={`ARR ${fmtC(arr)}`} cor="#5E8C87" tip="Receita recorrente mensal (contratos ativos)" />
        <Card label="Ticket médio (ARPA)" value={fmtC(arpa)} sub={`${clientesAtivos} clientes ativos`} cor="#1C2B2A" tip="MRR ÷ clientes ativos" />
        <Card label="CAC" value={cac != null ? fmtC(cac) : '—'} sub={cac != null ? `${novosMes} novos no mês` : 'sem novos clientes no mês'} cor="#D97706" tip="Gasto de marketing ÷ novos clientes no mês" />
        <Card label="LTV" value={fmtC(ltv)} sub={`vida ${vidaMeses}m · margem ${(margemBruta * 100).toFixed(0)}%`} cor="#7C3AED" tip="ARPA × margem bruta × vida média" />
      </div>
      <div className="kpis" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 18 }}>
        <Card label="LTV / CAC" value={ltvCac != null ? `${ltvCac.toFixed(1)}x` : '—'} sub={ltvCac == null ? 'precisa de CAC' : ltvCac >= 3 ? 'saudável (≥3x)' : ltvCac >= 1 ? 'atenção (1–3x)' : 'ruim (<1x)'} cor={corLtvCac} tip="LTV ÷ CAC — ideal ≥ 3x" />
        <Card label="ROAS" value={roas != null ? `${roas.toFixed(1)}x` : '—'} sub="retorno sobre anúncio" cor="#2563eb" tip="Receita de marketing ÷ gasto" />
        <Card label="ROI marketing" value={roiMkt != null ? pct(roiMkt, 0) : '—'} sub="(receita − gasto) ÷ gasto" cor={roiMkt != null && roiMkt >= 0 ? '#16A085' : '#E74C3C'} />
        <div className="kpi" style={{ borderTop: '3px solid #E2E8E7', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div className="kpi-lbl">Vida média (meses)</div>
          <input type="number" min={1} max={120} value={vidaMeses} onChange={e => setVidaMeses(Math.max(1, Number(e.target.value) || 1))} className="form-input" style={{ width: 90, fontSize: 16, fontWeight: 700, padding: '4px 8px' }} />
          <div className="kpi-delta" style={{ color: '#7A8F8E' }}>ajusta o LTV</div>
        </div>
      </div>

      {/* Rentabilidade */}
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '.04em', margin: '0 0 10px' }}>Rentabilidade</div>
      <div className="kpis" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 18 }}>
        <Card label="Margem líquida" value={margemLiq != null ? pct(margemLiq) : '—'} sub={m ? 'último mês' : 'sem DRE'} cor={margemLiq != null && margemLiq >= 0 ? '#16A085' : '#E74C3C'} />
        <Card label="EBITDA" value={ebitda != null ? fmtC(ebitda) : '—'} sub="geração operacional" cor="#5E8C87" />
        <Card label="Margem bruta" value={pct(margemBruta * 100)} sub="lucro bruto ÷ receita líq." cor="#1C2B2A" />
        <Card label="ROIC (aprox.)" value={roic != null ? pct(roic) : '—'} sub="retorno s/ capital · estimado" cor="#7C3AED" tip="Lucro líquido anualizado ÷ capital (aprox.). Refine com capital investido real." />
      </div>

      {/* Caixa */}
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '.04em', margin: '0 0 10px' }}>Caixa & sobrevivência</div>
      <div className="kpis" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 8 }}>
        <Card label="Saldo em caixa" value={fmtC(saldo)} sub="todas as contas" cor="#1C2B2A" />
        <Card label="Burn mensal" value={burn > 0 ? fmtC(burn) : 'R$ 0'} sub={burn > 0 ? 'queima de caixa/mês' : 'operação lucrativa'} cor={burn > 0 ? '#E74C3C' : '#16A085'} tip="Prejuízo líquido mensal (0 se lucrativo)" />
        <Card label="Runway" value={burn === 0 ? '∞' : runwayMeses > 24 ? '24m+' : `${runwayMeses.toFixed(0)}m`} sub={burn === 0 ? 'lucrativo, sem queima' : runwayMeses < 6 ? '⚠ menos de 6 meses' : 'meses de caixa'} cor={corRunway} tip="Saldo ÷ burn mensal" />
      </div>

      <div style={{ fontSize: 11, color: '#AAB8B7', marginTop: 14, lineHeight: 1.6 }}>
        <i className="fa-solid fa-circle-info" style={{ color: '#5E8C87', marginRight: 6 }} />
        LTV/CAC assume vida média editável e margem bruta do DRE. CAC usa gasto de marketing ÷ novos clientes do mês. ROIC é aproximado — para due diligence/M&A, refine com capital investido real. Passe o mouse nos cards para ver as fórmulas.
      </div>
    </>
  )
}
