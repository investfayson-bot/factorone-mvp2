'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { calcDREFromTransacoes, fmtBRL, fmtBRLCompact, variacaoPct, type TransacaoDRE } from '@/lib/dre-calculations'
import CentralComando from '@/components/dashboard/CentralComando'
import EntradasSaidasChart from '@/components/dashboard/EntradasSaidasChart'
import { DashboardErrorBoundary } from '@/components/dashboard/DashboardErrorBoundary'
import Modal from '@/components/ui/Modal'
import type { TransacaoLista } from '@/lib/transacao-types'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, AreaChart, Area, CartesianGrid, ComposedChart, Line, Legend, PieChart, Pie } from 'recharts'

const PIE_COLORS = ['#3D7A6E', '#D8C9A0', '#7A6A9E', '#3D6E8E', '#B0413E', '#B08A3E']

function mesKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
function labelMes(key: string) {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'short' })
}

type Kpi = { receita: number; despesas: number; saldo: number; nfs: number }
type Pendencias = { reembolsos: number; valorReembolsos: number; aprovacoes: number; saldoBanco: number; dasDias: number | null; dasValor: number | null }
type ScoreComponente = { nome: string; pontos: number; max: number; descricao: string; detalhe: string }
type ScoreData = { total: number; grade: string; componentes: ScoreComponente[] }
type PatWidget = { total: number; valorContabil: number; depMes: number; frota: number; maquinas: number; imoveis: number; alertas: number }
type CrmWidget = { abertas: number; pipeline: number; ganhaMes: number; ativPendentes: number }
type MktWidget = { campanhasAtivas: number; gasto: number; receita: number; roas: number; leads: number }
type LogWidget = { rotasAtivas: number; receitaFrete: number; pneusAlerta: number; entreguesMes: number }
type ClientesWidget = { total: number; ativos: number; prospects: number; mrr: number }

function tituloTx(t: TransacaoLista) {
  const d = (t.descricao || '').trim()
  if (!d) return t.tipo === 'entrada' ? 'Entrada' : 'Saída'
  if (/pix/i.test(d)) return d.toLowerCase().includes('receb') ? 'Pix Recebido' : 'Pix Saída'
  if (/ted|transfer/i.test(d)) return 'Transferência / TED'
  return d.length > 48 ? d.slice(0, 45) + '…' : d
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [kpiAtual, setKpiAtual] = useState<Kpi>({ receita: 0, despesas: 0, saldo: 0, nfs: 0 })
  const [kpiAnt, setKpiAnt] = useState<Kpi>({ receita: 0, despesas: 0, saldo: 0, nfs: 0 })
  const [transacoes, setTransacoes] = useState<TransacaoLista[]>([])
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [empresaNome, setEmpresaNome] = useState('')
  const [dreMes, setDreMes] = useState({ liquido: 0, liquidoAnt: 0, receitaBruta: 0, cmv: 0, lucroBruto: 0, ebitda: 0 })
  const [fluxo30, setFluxo30] = useState(0)
  const [runway, setRunway] = useState<number | null>(null)
  const [selectedTx, setSelectedTx] = useState<TransacaoLista | null>(null)
  const [pendencias, setPendencias] = useState<Pendencias>({ reembolsos: 0, valorReembolsos: 0, aprovacoes: 0, saldoBanco: 0, dasDias: null, dasValor: null })
  const [score, setScore] = useState<ScoreData | null>(null)
  const [scoreExpanded, setScoreExpanded] = useState(false)
  const [patWidget, setPatWidget] = useState<PatWidget | null>(null)
  const [crmWidget, setCrmWidget] = useState<CrmWidget | null>(null)
  const [mktWidget, setMktWidget] = useState<MktWidget | null>(null)
  const [logWidget, setLogWidget] = useState<LogWidget | null>(null)
  const [clientesWidget, setClientesWidget] = useState<ClientesWidget | null>(null)
  const [trend12, setTrend12] = useState<{ mes: string; receita: number; despesas: number }[]>([])
  const [topCats, setTopCats] = useState<{ cat: string; val: number }[]>([])
  const [periodo, setPeriodo] = useState<'mes' | 'trimestre' | 'ano'>('mes')
  const [showExportMenu, setShowExportMenu] = useState(false)
  const router = useRouter()

  useEffect(() => {
    async function load() {
      try {
      const { data: { user: u } } = await supabase.auth.getUser()
      if (!u) { router.push('/auth'); return }
      setUser(u)

      const { data: usrRow } = await supabase.from('usuarios').select('empresa_id').eq('id', u.id).maybeSingle()
      const eid = (usrRow?.empresa_id as string | null) ?? u.id
      setEmpresaId(eid)

      if (usrRow?.empresa_id) {
        const { data: emp } = await supabase.from('empresas').select('nome').eq('id', usrRow.empresa_id).maybeSingle()
        setEmpresaNome((emp?.nome as string) || '')
      }

      const now = new Date()
      const a0 = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
      const a1 = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)
      const b0 = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10)
      const b1 = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10)
      const d30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)

      const [{ data: tAtual }, { data: tAnt }, { data: t30 }, { data: contaPri }] = await Promise.all([
        supabase.from('transacoes').select('*').eq('empresa_id', eid).gte('data', a0).lte('data', a1).order('data', { ascending: false }),
        supabase.from('transacoes').select('*').eq('empresa_id', eid).gte('data', b0).lte('data', b1),
        supabase.from('transacoes').select('tipo,valor').eq('empresa_id', eid).gte('data', d30),
        supabase.from('contas_bancarias').select('saldo_disponivel,saldo').eq('empresa_id', eid).eq('is_principal', true).maybeSingle(),
      ])

      const fold = (rows: TransacaoLista[]) => {
        const rec = rows.filter(x => x.tipo === 'entrada').reduce((s, x) => s + Number(x.valor), 0)
        const desp = rows.filter(x => x.tipo === 'saida').reduce((s, x) => s + Number(x.valor), 0)
        return { receita: rec, despesas: desp, saldo: rec - desp, nfs: 0 }
      }

      const ka = fold((tAtual ?? []) as TransacaoLista[])
      const kb = fold((tAnt ?? []) as TransacaoLista[])
      setKpiAtual(ka)
      setKpiAnt(kb)
      setTransacoes(((tAtual || []) as TransacaoLista[]).slice(0, 5))

      const dreA = calcDREFromTransacoes((tAtual || []) as TransacaoDRE[])
      const dreB = calcDREFromTransacoes((tAnt || []) as TransacaoDRE[])
      setDreMes({ liquido: dreA.lucroLiquido, liquidoAnt: dreB.lucroLiquido, receitaBruta: dreA.receitaBruta, cmv: dreA.cmv, lucroBruto: dreA.lucroBruto, ebitda: dreA.ebitda })

      const f30 = (t30 || []).reduce((s, x) => s + (x.tipo === 'entrada' ? Number(x.valor) : -Number(x.valor)), 0)
      setFluxo30(f30)

      const saldoBanco = Number(contaPri?.saldo_disponivel ?? contaPri?.saldo ?? 0)
      const despDia = ka.despesas / 30
      setRunway(saldoBanco > 0 && despDia > 0 ? Math.min(999, Math.floor(saldoBanco / despDia)) : null)

      // 12-month trend + category breakdown
      const start12 = new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString().slice(0, 10)
      const { data: t12 } = await supabase.from('transacoes').select('data,tipo,valor,categoria').eq('empresa_id', eid).gte('data', start12)
      const monthMap = new Map<string, { r: number; d: number }>()
      for (let i = 11; i >= 0; i--) monthMap.set(mesKey(new Date(now.getFullYear(), now.getMonth() - i, 1)), { r: 0, d: 0 })
      for (const t of t12 || []) {
        const key = (t.data as string).slice(0, 7)
        if (!monthMap.has(key)) continue
        const cur = monthMap.get(key)!
        if (t.tipo === 'entrada') cur.r += Number(t.valor) || 0
        else cur.d += Number(t.valor) || 0
      }
      setTrend12(Array.from(monthMap.entries()).map(([k, v]) => ({ mes: labelMes(k), receita: v.r, despesas: v.d })))
      const catMap = new Map<string, number>()
      for (const t of tAtual || []) {
        if (t.tipo !== 'saida') continue
        const cat = (t.categoria as string) || 'Outros'
        catMap.set(cat, (catMap.get(cat) || 0) + Number(t.valor) || 0)
      }
      setTopCats(Array.from(catMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([cat, val]) => ({ cat, val })))

      // Pendências: reembolsos, aprovações, DAS
      const [rPendRes, aPendRes, dasRaw] = await Promise.all([
        supabase.from('reembolsos').select('valor').eq('empresa_id', eid).eq('status', 'pendente'),
        supabase.from('despesas').select('id').eq('empresa_id', eid).eq('status', 'pendente_aprovacao'),
        fetch('/api/fiscal/das').then(r => r.ok ? r.json() : null).catch(() => null) as Promise<{ vencimento?: string; das?: number } | null>,
      ])
      const rPend = rPendRes.data ?? []
      const aPend = aPendRes.data ?? []
      const valorReemb = rPend.reduce((s: number, r: { valor: number }) => s + Number(r.valor), 0)
      const dasVenc = dasRaw?.vencimento ? Math.ceil((new Date(dasRaw.vencimento).getTime() - Date.now()) / 86400000) : null
      setPendencias({
        reembolsos: rPend.length,
        valorReembolsos: valorReemb,
        aprovacoes: (aPend ?? []).length,
        saldoBanco,
        dasDias: dasVenc,
        dasValor: dasRaw?.das ?? null,
      })

      // Patrimônio widget
      const mesAtual = now.toISOString().slice(0, 7)
      const em30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
      const [{ data: ativosData }, { data: depData }] = await Promise.all([
        supabase.from('ativos').select('tipo_ativo,valor_contabil,status,seguro_vencimento,ipva_vencimento').eq('empresa_id', eid),
        supabase.from('depreciacoes').select('valor_depreciacao').eq('empresa_id', eid).gte('competencia', mesAtual),
      ])
      if (ativosData) {
        const atAtivos = (ativosData as Array<{ tipo_ativo: string; valor_contabil: number; status: string; seguro_vencimento: string | null; ipva_vencimento: string | null }>)
          .filter(a => !['baixado', 'alienado', 'perdido', 'sucateado'].includes(a.status))
        setPatWidget({
          total: atAtivos.length,
          valorContabil: atAtivos.reduce((s, a) => s + Number(a.valor_contabil || 0), 0),
          depMes: ((depData ?? []) as Array<{ valor_depreciacao: number }>).reduce((s, d) => s + Number(d.valor_depreciacao || 0), 0),
          frota: atAtivos.filter(a => a.tipo_ativo === 'veiculo_leve' || a.tipo_ativo === 'veiculo_pesado').length,
          maquinas: atAtivos.filter(a => a.tipo_ativo === 'maquina').length,
          imoveis: atAtivos.filter(a => a.tipo_ativo === 'imovel').length,
          alertas: atAtivos.filter(a =>
            (a.seguro_vencimento && a.seguro_vencimento <= em30) ||
            (a.ipva_vencimento && a.ipva_vencimento <= em30)
          ).length,
        })
      }

      // Widgets de setores: CRM, Marketing, Logística
      const mesIso = now.toISOString().slice(0, 7)
      const [crmOpR, crmAtvR, mktCampR, mktLeadsR, logRotasR, logPneusR, clientesR] = await Promise.all([
        supabase.from('crm_oportunidades').select('valor,etapa').eq('empresa_id', eid),
        supabase.from('crm_atividades').select('id').eq('empresa_id', eid).eq('status', 'pendente'),
        supabase.from('marketing_campanhas').select('status,gasto,receita_gerada').eq('empresa_id', eid),
        supabase.from('marketing_leads').select('id').eq('empresa_id', eid),
        supabase.from('logistica_rotas').select('status,valor_frete,created_at').eq('empresa_id', eid),
        supabase.from('logistica_pneus').select('km_rodado,km_limite').eq('empresa_id', eid).eq('status', 'ativo'),
        supabase.from('clientes').select('status,valor_contrato').eq('empresa_id', eid),
      ])

      const ops = (crmOpR.data ?? []) as Array<{ valor: number | null; etapa: string }>
      setCrmWidget({
        abertas: ops.filter(o => !['fechado_ganho', 'fechado_perdido'].includes(o.etapa)).length,
        pipeline: ops.filter(o => !['fechado_ganho', 'fechado_perdido'].includes(o.etapa)).reduce((s, o) => s + Number(o.valor ?? 0), 0),
        ganhaMes: ops.filter(o => o.etapa === 'fechado_ganho').reduce((s, o) => s + Number(o.valor ?? 0), 0),
        ativPendentes: (crmAtvR.data ?? []).length,
      })

      const camps = (mktCampR.data ?? []) as Array<{ status: string; gasto: number; receita_gerada: number }>
      const mktGasto = camps.reduce((s, c) => s + Number(c.gasto ?? 0), 0)
      const mktReceita = camps.reduce((s, c) => s + Number(c.receita_gerada ?? 0), 0)
      setMktWidget({
        campanhasAtivas: camps.filter(c => c.status === 'ativa').length,
        gasto: mktGasto,
        receita: mktReceita,
        roas: mktGasto > 0 ? mktReceita / mktGasto : 0,
        leads: (mktLeadsR.data ?? []).length,
      })

      const rotas = (logRotasR.data ?? []) as Array<{ status: string; valor_frete: number | null; created_at: string }>
      const logPneus = (logPneusR.data ?? []) as Array<{ km_rodado: number; km_limite: number }>
      const clts = (clientesR.data ?? []) as Array<{ status: string; valor_contrato: number | null }>
      if (clts.length > 0) {
        setClientesWidget({
          total: clts.length,
          ativos: clts.filter(c => c.status === 'ativo').length,
          prospects: clts.filter(c => c.status === 'prospect').length,
          mrr: clts.filter(c => c.status === 'ativo').reduce((s, c) => s + Number(c.valor_contrato ?? 0), 0),
        })
      }
      setLogWidget({
        rotasAtivas: rotas.filter(r => r.status === 'em_transito').length,
        receitaFrete: rotas.reduce((s, r) => s + Number(r.valor_frete ?? 0), 0),
        pneusAlerta: logPneus.filter(p => p.km_rodado >= p.km_limite * 0.9).length,
        entreguesMes: rotas.filter(r => r.status === 'entregue' && r.created_at.startsWith(mesIso)).length,
      })

      // Score Financeiro
      const { data: sessData } = await supabase.auth.getSession()
      const scoreRes = await fetch('/api/score/calcular', {
        headers: sessData.session?.access_token ? { Authorization: `Bearer ${sessData.session.access_token}` } : {},
      }).catch(() => null)
      if (scoreRes?.ok) {
        const scoreJson = await scoreRes.json().catch(() => null) as ScoreData | null
        if (scoreJson) setScore(scoreJson)
      }

      } catch (err) {
        console.error('[dashboard] load error', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router])

  const hora = new Date().getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'
  const nome = user?.email?.split('@')[0] ?? '—'
  const mesAno = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  const receitaVar = variacaoPct(kpiAtual.receita, kpiAnt.receita)

  if (loading || !user || !empresaId) {
    return (
      <div style={{ padding: 0 }}>
        <div className="kpis" style={{ marginBottom: 16 }}>
          {[1, 2, 3, 4].map(i => <div key={i} className="kpi" style={{ height: 88, background: 'var(--gray-100)', animation: 'pulse 1.5s infinite' }} />)}
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Page Header */}
      <div className="page-hdr">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-sub">{empresaNome || nome} · {mesAno} · {saudacao}!</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Filtro de período */}
          <div style={{ display: 'flex', background: '#F1ECE1', padding: 3, borderRadius: 8, gap: 2 }}>
            {([
              { key: 'mes', label: 'Mês' },
              { key: 'trimestre', label: 'Trimestre' },
              { key: 'ano', label: 'Ano' },
            ] as { key: typeof periodo; label: string }[]).map(p => (
              <button key={p.key} onClick={() => setPeriodo(p.key)} style={{
                fontSize: 11, fontWeight: periodo === p.key ? 700 : 500,
                padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                background: periodo === p.key ? '#fff' : 'transparent',
                color: periodo === p.key ? '#13201D' : '#7B8C88',
                transition: 'all 0.15s',
              }}>{p.label}</button>
            ))}
          </div>

          {/* Exportar PDF */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowExportMenu(m => !m)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: '0.5px solid #E4DCCC', background: '#fff', color: '#3C4A46', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
            >
              <i className="fa-solid fa-file-export" style={{ fontSize: 11 }} />Exportar
              <i className="fa-solid fa-chevron-down" style={{ fontSize: 8, color: '#A6B0AC' }} />
            </button>
            {showExportMenu && (
              <div style={{ position: 'absolute', top: 38, right: 0, background: '#fff', border: '0.5px solid #E4DCCC', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', zIndex: 100, minWidth: 180, overflow: 'hidden' }}>
                {[
                  { label: 'DRE em PDF', icon: 'fa-file-pdf', color: '#B0413E', url: '/api/dre/exportar-pdf', method: 'POST' },
                  { label: 'Financeiro PDF', icon: 'fa-file-pdf', color: '#B0413E', url: '/api/financeiro/exportar-pdf', method: 'GET' },
                  { label: 'Patrimônio PDF', icon: 'fa-file-pdf', color: '#B0413E', url: '/api/patrimonio/relatorio', method: 'GET' },
                ].map(item => (
                  <button key={item.label} onClick={async () => {
                    setShowExportMenu(false)
                    const { baixarArquivo } = await import('@/lib/download-arquivo')
                    const r = await baixarArquivo(item.url, `${item.label.toLowerCase().replace(/ /g, '_')}.pdf`)
                    if ('erro' in r) { const { default: toast } = await import('react-hot-toast'); toast.error(r.erro) }
                  }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, color: '#13201D', textAlign: 'left', borderBottom: '0.5px solid #EFE9DC' }}
                    onMouseOver={e => (e.currentTarget.style.background = '#FBF8F1')}
                    onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <i className={`fa-solid ${item.icon}`} style={{ color: item.color, fontSize: 12, width: 14 }} />
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Link AI */}
          <Link href="/dashboard/aicfo" style={{ textDecoration: 'none' }}>
            <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: 'none', background: '#13201D', color: '#6FA595', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
              <i className="fa-solid fa-robot" style={{ fontSize: 11 }} />FactorOne AI
            </button>
          </Link>
        </div>
      </div>

      {/* Central de comando — números cruciais do negócio */}
      <CentralComando empresaId={empresaId} />

      {/* KPIs */}
      <div className="kpis">
        {/* Receita */}
        <div className="kpi" style={{ borderTop: '3px solid #3D7A6E' }}>
          <div className="kpi-lbl">
            Receita Mensal
            <div style={{ width: 28, height: 28, borderRadius: 8, background: '#E9F0ED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa-solid fa-arrow-trend-up" style={{ fontSize: 12, color: '#3D7A6E' }} />
            </div>
          </div>
          <div className="kpi-val">{fmtBRLCompact(kpiAtual.receita)}</div>
          <div className={`kpi-delta ${receitaVar === null ? '' : receitaVar >= 0 ? 'up' : 'dn'}`}>
            {receitaVar === null ? '1º mês' : `${receitaVar >= 0 ? '↑' : '↓'} ${receitaVar >= 0 ? '+' : ''}${receitaVar.toFixed(1)}% vs mês anterior`}
          </div>
        </div>
        {/* Lucro */}
        <div className="kpi" style={{ borderTop: `3px solid ${dreMes.liquido >= 0 ? '#3D7A6E' : '#B0413E'}` }}>
          <div className="kpi-lbl">
            Lucro Líquido
            <div style={{ width: 28, height: 28, borderRadius: 8, background: dreMes.liquido >= 0 ? '#E9F0ED' : '#F4E4E1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa-solid fa-chart-line" style={{ fontSize: 12, color: dreMes.liquido >= 0 ? '#3D7A6E' : '#B0413E' }} />
            </div>
          </div>
          <div className="kpi-val">{fmtBRLCompact(dreMes.liquido)}</div>
          <div className={`kpi-delta ${dreMes.liquido >= 0 ? 'up' : 'dn'}`}>
            {dreMes.receitaBruta > 0 ? `Margem ${((dreMes.liquido / dreMes.receitaBruta) * 100).toFixed(1)}%` : '—'}
            {(() => { const v = variacaoPct(dreMes.liquido, dreMes.liquidoAnt); return v === null ? '' : ` · ${v >= 0 ? '↑ +' : '↓ '}${v.toFixed(1)}%` })()}
          </div>
        </div>
        {/* Fluxo */}
        <div className="kpi" style={{ borderTop: `3px solid ${fluxo30 >= 0 ? '#3D7A6E' : '#B08A3E'}` }}>
          <div className="kpi-lbl">
            Fluxo 30 dias
            <div style={{ width: 28, height: 28, borderRadius: 8, background: fluxo30 >= 0 ? '#E9F0ED' : '#F3ECDA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa-solid fa-water" style={{ fontSize: 12, color: fluxo30 >= 0 ? '#3D7A6E' : '#B08A3E' }} />
            </div>
          </div>
          <div className="kpi-val">{fmtBRLCompact(fluxo30)}</div>
          <div className={`kpi-delta ${fluxo30 >= 0 ? 'up' : 'warn'}`}>{fluxo30 >= 0 ? '↑ caixa positivo' : '↓ atenção ao caixa'}</div>
        </div>
        {/* Runway */}
        <div className="kpi" style={{ borderTop: `3px solid ${runway == null ? '#E4DCCC' : runway < 90 ? '#B08A3E' : '#3D7A6E'}` }}>
          <div className="kpi-lbl">
            Runway
            <div style={{ width: 28, height: 28, borderRadius: 8, background: runway != null && runway < 90 ? '#F3ECDA' : '#E9F0ED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa-solid fa-gauge-high" style={{ fontSize: 12, color: runway != null && runway < 90 ? '#B08A3E' : '#3D7A6E' }} />
            </div>
          </div>
          <div className="kpi-val">{runway != null ? `${runway > 30 ? Math.round(runway / 30) + ' meses' : runway + ' dias'}` : '—'}</div>
          <div className={`kpi-delta ${runway == null ? '' : runway < 90 ? 'warn' : 'up'}`}>
            {runway == null ? 'cadastre saldo bancário' : runway < 90 ? '⚠ menos de 3 meses' : '✓ situação saudável'}
          </div>
        </div>
      </div>

      {/* Pendências */}
      {(pendencias.reembolsos > 0 || pendencias.aprovacoes > 0 || (pendencias.dasDias !== null && pendencias.dasDias <= 10)) && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          {pendencias.aprovacoes > 0 && (
            <Link href="/dashboard/aprovacoes" style={{ textDecoration: 'none', flex: 1, minWidth: 180 }}>
              <div style={{ background: 'rgba(176,138,62,.06)', border: '1px solid rgba(176,138,62,.25)', borderRadius: 12, padding: '12px 16px', cursor: 'pointer' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gold)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 4 }}>Aprovações pendentes</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--navy)' }}>{pendencias.aprovacoes}</div>
                <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>despesas aguardando → aprovar</div>
              </div>
            </Link>
          )}
          {pendencias.reembolsos > 0 && (
            <Link href="/dashboard/reembolsos" style={{ textDecoration: 'none', flex: 1, minWidth: 180 }}>
              <div style={{ background: 'rgba(61,122,110,.06)', border: '1px solid rgba(61,122,110,.25)', borderRadius: 12, padding: '12px 16px', cursor: 'pointer' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--teal2)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 4 }}>Reembolsos pendentes</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--navy)' }}>{pendencias.reembolsos}</div>
                <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>{fmtBRLCompact(pendencias.valorReembolsos)} a aprovar</div>
              </div>
            </Link>
          )}
          {pendencias.dasDias !== null && pendencias.dasDias <= 10 && (
            <Link href="/contabilidade" style={{ textDecoration: 'none', flex: 1, minWidth: 180 }}>
              <div style={{ background: pendencias.dasDias <= 3 ? 'rgba(176,65,62,.06)' : 'rgba(176,138,62,.06)', border: `1px solid ${pendencias.dasDias <= 3 ? 'rgba(176,65,62,.25)' : 'rgba(176,138,62,.25)'}`, borderRadius: 12, padding: '12px 16px', cursor: 'pointer' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: pendencias.dasDias <= 3 ? 'var(--red)' : 'var(--gold)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 4 }}>DAS vence em {pendencias.dasDias}d</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--navy)' }}>{pendencias.dasValor ? fmtBRLCompact(pendencias.dasValor) : '—'}</div>
                <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>Simples Nacional · ver detalhes</div>
              </div>
            </Link>
          )}
          {pendencias.saldoBanco > 0 && (
            <Link href="/dashboard/cashflow" style={{ textDecoration: 'none', flex: 1, minWidth: 180 }}>
              <div style={{ background: 'rgba(61,122,110,.06)', border: '1px solid rgba(61,122,110,.2)', borderRadius: 12, padding: '12px 16px', cursor: 'pointer' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--green)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 4 }}>Saldo bancário</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--navy)' }}>{fmtBRLCompact(pendencias.saldoBanco)}</div>
                <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>conta principal</div>
              </div>
            </Link>
          )}
        </div>
      )}

      {/* Patrimônio Widget */}
      {patWidget && patWidget.total > 0 && (
        <Link href="/dashboard/patrimonio" style={{ textDecoration: 'none', display: 'block', marginBottom: 16 }}>
          <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 20, cursor: 'pointer' }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <i className="fa-solid fa-landmark" style={{ color: '#fff', fontSize: 15 }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gray-400)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 3 }}>Patrimônio & Ativos</div>
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ fontSize: 12 }}><span style={{ color: 'var(--gray-400)' }}>Total: </span><span style={{ fontWeight: 700 }}>{patWidget.total} ativos</span></div>
                <div style={{ fontSize: 12 }}><span style={{ color: 'var(--gray-400)' }}>Contábil: </span><span style={{ fontWeight: 700, color: 'var(--teal)' }}>{fmtBRLCompact(patWidget.valorContabil)}</span></div>
                <div style={{ fontSize: 12 }}><span style={{ color: 'var(--gray-400)' }}>Deprec./mês: </span><span style={{ fontWeight: 700, color: 'var(--red)' }}>{fmtBRLCompact(patWidget.depMes)}</span></div>
                {patWidget.frota > 0 && <div style={{ fontSize: 12 }}><i className="fa-solid fa-truck" style={{ color: 'var(--gray-400)', marginRight: 4, fontSize: 10 }} /><span style={{ fontWeight: 700 }}>{patWidget.frota}</span></div>}
                {patWidget.maquinas > 0 && <div style={{ fontSize: 12 }}><i className="fa-solid fa-gear" style={{ color: 'var(--gray-400)', marginRight: 4, fontSize: 10 }} /><span style={{ fontWeight: 700 }}>{patWidget.maquinas}</span></div>}
                {patWidget.imoveis > 0 && <div style={{ fontSize: 12 }}><i className="fa-solid fa-building" style={{ color: 'var(--gray-400)', marginRight: 4, fontSize: 10 }} /><span style={{ fontWeight: 700 }}>{patWidget.imoveis}</span></div>}
              </div>
            </div>
            {patWidget.alertas > 0 && (
              <div style={{ background: 'rgba(239,68,68,.1)', color: 'var(--red)', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 4 }} />{patWidget.alertas} alerta{patWidget.alertas > 1 ? 's' : ''}
              </div>
            )}
            <div style={{ color: 'var(--teal)', fontSize: 13, fontWeight: 600, flexShrink: 0 }}>→</div>
          </div>
        </Link>
      )}

      {/* Clientes widget */}
      {clientesWidget && clientesWidget.total > 0 && (
        <Link href="/dashboard/clientes" style={{ textDecoration: 'none', display: 'block', marginBottom: 12 }}>
          <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 20, cursor: 'pointer' }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: '#E4EDEF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <i className="fa-solid fa-users" style={{ color: '#3D6E8E', fontSize: 15 }} />
            </div>
            <div style={{ flex: 1, display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '.07em' }}>Clientes</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--navy)' }}>{clientesWidget.total}</div>
              </div>
              <div><div style={{ fontSize: 10, color: 'var(--gray-400)' }}>Ativos</div><div style={{ fontWeight: 700, color: 'var(--green)' }}>{clientesWidget.ativos}</div></div>
              <div><div style={{ fontSize: 10, color: 'var(--gray-400)' }}>Prospects</div><div style={{ fontWeight: 700, color: 'var(--gold)' }}>{clientesWidget.prospects}</div></div>
              <div><div style={{ fontSize: 10, color: 'var(--gray-400)' }}>MRR Contratos</div><div style={{ fontWeight: 700, color: 'var(--teal)', fontFamily: "var(--font-sans)" }}>{fmtBRLCompact(clientesWidget.mrr)}</div></div>
            </div>
            <div style={{ color: 'var(--teal)', fontSize: 13, fontWeight: 600 }}>→</div>
          </div>
        </Link>
      )}

      {/* Setores — CRM, Marketing, Logística */}
      {(crmWidget || mktWidget || logWidget) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
          {/* CRM */}
          {crmWidget && (
            <Link href="/dashboard/crm" style={{ textDecoration: 'none' }}>
              <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: '14px 16px', cursor: 'pointer', height: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: '#ECE7F2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className="fa-solid fa-handshake" style={{ color: '#7A6A9E', fontSize: 12 }} />
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '.07em' }}>CRM</div>
                  <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 10, background: '#ECE7F2', color: '#7A6A9E', marginLeft: 'auto' }}>PLUS</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--gray-400)', marginBottom: 2 }}>Pipeline</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--navy)', fontFamily: "var(--font-sans)" }}>{fmtBRLCompact(crmWidget.pipeline)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--gray-400)', marginBottom: 2 }}>Ganho</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--green)', fontFamily: "var(--font-sans)" }}>{fmtBRLCompact(crmWidget.ganhaMes)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--gray-400)', marginBottom: 2 }}>Oportunidades</div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{crmWidget.abertas} abertas</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--gray-400)', marginBottom: 2 }}>Atividades</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: crmWidget.ativPendentes > 0 ? 'var(--gold)' : 'var(--navy)' }}>
                      {crmWidget.ativPendentes} pend.
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          )}

          {/* Marketing */}
          {mktWidget && (
            <Link href="/dashboard/marketing" style={{ textDecoration: 'none' }}>
              <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: '14px 16px', cursor: 'pointer', height: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className="fa-solid fa-bullhorn" style={{ color: 'var(--gold)', fontSize: 12 }} />
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '.07em' }}>Marketing</div>
                  {mktWidget.campanhasAtivas > 0 && (
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: '#E9F0ED', color: 'var(--green)', marginLeft: 'auto' }}>
                      {mktWidget.campanhasAtivas} ativa{mktWidget.campanhasAtivas > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--gray-400)', marginBottom: 2 }}>Investido</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--red)', fontFamily: "var(--font-sans)" }}>{fmtBRLCompact(mktWidget.gasto)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--gray-400)', marginBottom: 2 }}>Receita</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--green)', fontFamily: "var(--font-sans)" }}>{fmtBRLCompact(mktWidget.receita)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--gray-400)', marginBottom: 2 }}>ROAS</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: mktWidget.roas >= 3 ? 'var(--green)' : mktWidget.roas >= 1 ? 'var(--gold)' : 'var(--red)' }}>
                      {mktWidget.roas > 0 ? mktWidget.roas.toFixed(1) + 'x' : '—'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--gray-400)', marginBottom: 2 }}>Leads</div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{mktWidget.leads}</div>
                  </div>
                </div>
              </div>
            </Link>
          )}

          {/* Logística */}
          {logWidget && (
            <Link href="/dashboard/logistica" style={{ textDecoration: 'none' }}>
              <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: '14px 16px', cursor: 'pointer', height: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: '#E4EDEF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className="fa-solid fa-truck-fast" style={{ color: 'var(--teal)', fontSize: 12 }} />
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '.07em' }}>Logística</div>
                  {logWidget.rotasAtivas > 0 && (
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: '#E4EDEF', color: 'var(--teal)', marginLeft: 'auto' }}>
                      {logWidget.rotasAtivas} em trânsito
                    </span>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--gray-400)', marginBottom: 2 }}>Rec. Frete</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--teal)', fontFamily: "var(--font-sans)" }}>{fmtBRLCompact(logWidget.receitaFrete)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--gray-400)', marginBottom: 2 }}>Entregues/mês</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--green)', fontFamily: "var(--font-sans)" }}>{logWidget.entreguesMes}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--gray-400)', marginBottom: 2 }}>Em trânsito</div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{logWidget.rotasAtivas}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--gray-400)', marginBottom: 2 }}>Pneus alerta</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: logWidget.pneusAlerta > 0 ? 'var(--red)' : 'var(--gray-400)' }}>
                      {logWidget.pneusAlerta > 0 ? logWidget.pneusAlerta : '—'}{logWidget.pneusAlerta > 0 && <i className="fa-solid fa-triangle-exclamation" style={{ marginLeft: 4, fontSize: 10 }} />}
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          )}
        </div>
      )}

      {/* Score Financeiro */}
      {score && (
        <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: '14px 18px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer' }} onClick={() => setScoreExpanded(v => !v)}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gray-400)', letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: "var(--font-sans)", marginBottom: 4 }}>
                Score Financeiro FactorOne
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: score.total >= 700 ? 'var(--green)' : score.total >= 500 ? 'var(--gold)' : 'var(--red)', fontFamily: "var(--font-sans)" }}>
                  {score.total}
                </div>
                <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>/ 1000</div>
                <div style={{ fontSize: 13, fontWeight: 700, padding: '2px 10px', borderRadius: 20, background: score.total >= 700 ? 'rgba(61,122,110,.12)' : score.total >= 500 ? 'rgba(176,138,62,.12)' : 'rgba(176,65,62,.12)', color: score.total >= 700 ? 'var(--green)' : score.total >= 500 ? 'var(--gold)' : 'var(--red)' }}>
                  {score.grade}
                </div>
                {/* Mini bar */}
                <div style={{ flex: 1, height: 6, background: 'var(--gray-100)', borderRadius: 3, overflow: 'hidden', maxWidth: 200 }}>
                  <div style={{ height: '100%', width: `${score.total / 10}%`, background: score.total >= 700 ? 'var(--green)' : score.total >= 500 ? 'var(--gold)' : 'var(--red)', borderRadius: 3, transition: 'width .4s' }} />
                </div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--teal)', fontWeight: 600 }}>
              {scoreExpanded ? '▲ ocultar' : '▼ ver detalhes'}
            </div>
          </div>

          {scoreExpanded && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--gray-100)', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
              {score.componentes.map(c => (
                <div key={c.nome} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>{c.nome}</div>
                  <div style={{ position: 'relative', width: 52, height: 52, margin: '0 auto 6px' }}>
                    <svg viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)', width: 52, height: 52 }}>
                      <circle cx="18" cy="18" r="15.9155" fill="none" stroke="var(--gray-100)" strokeWidth="3" />
                      <circle cx="18" cy="18" r="15.9155" fill="none"
                        stroke={c.pontos >= 160 ? 'var(--green)' : c.pontos >= 100 ? 'var(--gold)' : 'var(--red)'}
                        strokeWidth="3" strokeDasharray={`${(c.pontos / c.max) * 100} 100`} strokeLinecap="round" />
                    </svg>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: 'var(--navy)', fontFamily: "var(--font-sans)" }}>{c.pontos}</div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--navy)', fontWeight: 600, marginBottom: 2 }}>{c.descricao}</div>
                  <div style={{ fontSize: 10, color: c.detalhe === 'Atenção' || c.detalhe === 'Queda' || c.detalhe === 'Baixo' || c.detalhe === 'Negativa' ? 'var(--red)' : 'var(--gray-400)' }}>
                    {c.detalhe}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Charts row */}
      <div className="charts-row">
        <div className="chart-card" style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div className="chart-title">Entradas vs Saídas</div>
              <div style={{ fontSize: 10, color: '#7B8C88', marginTop: 2 }}>Últimos 6 meses</div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: '#3C4A46' }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#3D7A6E', display: 'inline-block' }} />Entradas</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: '#3C4A46' }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#B0413E', display: 'inline-block' }} />Saídas</span>
            </div>
          </div>
          <DashboardErrorBoundary title="Gráfico">
            <EntradasSaidasChart empresaId={empresaId} />
          </DashboardErrorBoundary>
        </div>
        <div className="chart-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div className="chart-title">Receita vs Despesas</div>
              <div style={{ fontSize: 10, color: '#7B8C88', marginTop: 2 }}>Atual vs mês anterior</div>
            </div>
            <Link href="/dashboard/relatorios" style={{ fontSize: 10, color: '#3D7A6E', textDecoration: 'none', fontWeight: 600 }}>DRE →</Link>
          </div>
          {(() => {
            const dreChartData = [
              { name: 'Receita', atual: kpiAtual.receita, anterior: kpiAnt.receita },
              { name: 'Despesas', atual: kpiAtual.despesas, anterior: kpiAnt.despesas },
              { name: 'Lucro', atual: dreMes.liquido, anterior: dreMes.liquidoAnt },
            ]
            const colors = ['#3D7A6E', '#B0413E', dreMes.liquido >= 0 ? '#3D7A6E' : '#B0413E']
            return (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={dreChartData} barGap={4} barCategoryGap="30%" margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#7B8C88' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#A6B0AC' }} axisLine={false} tickLine={false} tickFormatter={v => fmtBRLCompact(v)} width={52} />
                  <Tooltip
                    formatter={(v: number, name: string) => [fmtBRLCompact(v), name === 'atual' ? 'Mês atual' : 'Mês anterior']}
                    contentStyle={{ fontSize: 11, borderRadius: 10, border: '0.5px solid #E4DCCC', background: '#fff', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
                    labelStyle={{ fontWeight: 700, color: '#13201D', fontSize: 11 }}
                  />
                  <Bar dataKey="anterior" fill="#F1ECE1" radius={[4, 4, 0, 0]} maxBarSize={18} />
                  <Bar dataKey="atual" radius={[4, 4, 0, 0]} maxBarSize={18}>
                    {dreChartData.map((_, i) => <Cell key={i} fill={colors[i]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )
          })()}
          <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: '#7B8C88' }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#F1ECE1', border: '0.5px solid #E4DCCC', display: 'inline-block' }} />Mês anterior</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: '#7B8C88' }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#3D7A6E', display: 'inline-block' }} />Mês atual</span>
          </div>
        </div>
      </div>

      {/* Segunda linha de gráficos */}
      <div className="charts-row" style={{ gridTemplateColumns: '2fr 1fr' }}>
        <div className="chart-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div>
              <div className="chart-title">Tendência 12 meses</div>
              <div style={{ fontSize: 10, color: '#7B8C88', marginTop: 2 }}>Receita vs Despesas</div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: '#3C4A46' }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#3D7A6E', display: 'inline-block' }} />Receita</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: '#3C4A46' }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#B0413E', display: 'inline-block' }} />Despesas</span>
            </div>
          </div>
          {trend12.every(d => d.receita === 0 && d.despesas === 0) ? (
            <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A6B0AC', fontSize: 12 }}>Sem dados no período.</div>
          ) : (
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={trend12} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="gradR12" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3D7A6E" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3D7A6E" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradD12" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#B0413E" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#B0413E" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#EFE9DC" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 9, fill: '#7B8C88' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#A6B0AC' }} axisLine={false} tickLine={false} tickFormatter={v => fmtBRLCompact(v)} width={52} />
                <Tooltip
                  formatter={(v: number, name: string) => [fmtBRLCompact(v), name === 'receita' ? 'Receita' : 'Despesas']}
                  contentStyle={{ fontSize: 11, borderRadius: 10, border: '0.5px solid #E4DCCC', background: '#fff', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
                  labelStyle={{ fontWeight: 700, color: '#13201D', fontSize: 11 }}
                />
                <Area type="monotone" dataKey="receita" stroke="#3D7A6E" strokeWidth={2} fill="url(#gradR12)" dot={false} activeDot={{ r: 4, fill: '#3D7A6E', stroke: '#fff', strokeWidth: 2 }} />
                <Area type="monotone" dataKey="despesas" stroke="#B0413E" strokeWidth={2} fill="url(#gradD12)" dot={false} activeDot={{ r: 4, fill: '#B0413E', stroke: '#fff', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="chart-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div>
              <div className="chart-title">Top categorias</div>
              <div style={{ fontSize: 10, color: '#7B8C88', marginTop: 2 }}>Despesas do mês</div>
            </div>
            <Link href="/dashboard/despesas" style={{ fontSize: 10, color: '#3D7A6E', textDecoration: 'none', fontWeight: 600 }}>Ver →</Link>
          </div>
          {topCats.length === 0 ? (
            <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A6B0AC', fontSize: 12 }}>Sem despesas categorizadas.</div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ResponsiveContainer width="55%" height={150}>
                <PieChart>
                  <Pie data={topCats} dataKey="val" nameKey="cat" cx="50%" cy="50%" innerRadius={38} outerRadius={62} paddingAngle={2} stroke="none">
                    {topCats.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => [fmtBRLCompact(v), 'Despesa']}
                    contentStyle={{ fontSize: 11, borderRadius: 12, border: '1px solid #E4DCCC', background: '#fff', boxShadow: '0 8px 24px rgba(19,32,29,0.10)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7, minWidth: 0 }}>
                {topCats.map((c, i) => (
                  <div key={c.cat} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 3, background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                    <span style={{ color: '#3C4A46', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.cat}</span>
                    <span style={{ color: '#13201D', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtBRLCompact(c.val)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Painel consolidado — estilo Power BI */}
      <div className="chart-card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div className="chart-title">Resultado consolidado — 12 meses</div>
            <div style={{ fontSize: 10, color: '#7B8C88', marginTop: 2 }}>Receita e despesas (barras) + lucro líquido (linha)</div>
          </div>
          <Link href="/dashboard/relatorios" style={{ fontSize: 10, color: '#3D7A6E', textDecoration: 'none', fontWeight: 600 }}>Ver DRE completo →</Link>
        </div>
        {(() => {
          const dataComp = trend12.map(d => ({ ...d, lucro: Number(d.receita) - Number(d.despesas) }))
          if (dataComp.every(d => d.receita === 0 && d.despesas === 0)) {
            return <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A6B0AC', fontSize: 12 }}>Sem dados no período.</div>
          }
          return (
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={dataComp} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EFE9DC" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#7B8C88' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#A6B0AC' }} axisLine={false} tickLine={false} tickFormatter={v => fmtBRLCompact(v)} width={54} />
                <Tooltip
                  formatter={(v: number, name: string) => [fmtBRLCompact(v), name === 'receita' ? 'Receita' : name === 'despesas' ? 'Despesas' : 'Lucro']}
                  contentStyle={{ fontSize: 11, borderRadius: 10, border: '0.5px solid #E4DCCC', background: '#fff', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
                  labelStyle={{ fontWeight: 700, color: '#13201D', fontSize: 11 }}
                  cursor={{ fill: 'rgba(61,122,110,0.05)' }}
                />
                <Legend wrapperStyle={{ fontSize: 10 }} iconType="circle" iconSize={8} formatter={(value) => <span style={{ color: '#3C4A46' }}>{value === 'receita' ? 'Receita' : value === 'despesas' ? 'Despesas' : 'Lucro'}</span>} />
                <Bar dataKey="receita" fill="#3D7A6E" radius={[3, 3, 0, 0]} maxBarSize={18} />
                <Bar dataKey="despesas" fill="#B0413E" radius={[3, 3, 0, 0]} maxBarSize={18} fillOpacity={0.85} />
                <Line type="monotone" dataKey="lucro" stroke="#13201D" strokeWidth={2.5} dot={{ r: 3, fill: '#13201D' }} activeDot={{ r: 5, fill: '#B08A3E', stroke: '#fff', strokeWidth: 2 }} />
              </ComposedChart>
            </ResponsiveContainer>
          )
        })()}
      </div>

      {/* Últimas transações */}
      <div className="txs-card">
        <div className="txs-header">
          <div className="txs-title">Últimas transações</div>
          <Link href="/dashboard/cashflow" style={{ fontSize: 11, color: 'var(--teal)', textDecoration: 'none' }}>Ver todas →</Link>
        </div>
        {transacoes.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--gray-400)', fontSize: 13 }}>
            Nenhuma transação este mês.{' '}
            <button onClick={() => router.push('/dashboard/cashflow')} style={{ color: 'var(--teal)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}>
              Adicionar →
            </button>
          </div>
        ) : (
          transacoes.map(t => (
            <div key={t.id} className="tx-item" onClick={() => setSelectedTx(t)}>
              <div className="tx-left">
                <div className="tx-name">{tituloTx(t)}</div>
                <div className="tx-sub">{t.categoria || '—'} · {new Date(t.data + 'T12:00:00').toLocaleDateString('pt-BR')}</div>
              </div>
              <div className={`tx-amount ${t.tipo === 'entrada' ? 'pos' : 'neg'}`}>
                {t.tipo === 'entrada' ? '+' : '-'}{fmtBRL(Number(t.valor))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Atalhos rápidos + AI insight */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div style={{ background: '#fff', border: '0.5px solid #E4DCCC', borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--navy)', marginBottom: 12, fontFamily: "var(--font-sans)" }}>Atalhos rápidos</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { href: '/dashboard/despesas', icon: 'fa-file-invoice', label: 'Nova despesa', bg: '#E9F0ED', color: 'var(--teal)' },
              { href: '/dashboard/financeiro/receber', icon: 'fa-arrow-down-circle', label: 'Registrar recebimento', bg: '#E9F0ED', color: 'var(--teal)' },
              { href: '/dashboard/relatorios', icon: 'fa-chart-bar', label: 'Ver DRE', bg: '#E6F1FB', color: '#3D6E8E' },
              { href: '/dashboard/conciliacao', icon: 'fa-building-columns', label: 'Conciliar', bg: '#E9F0ED', color: 'var(--teal)' },
              { href: '/dashboard/contadores', icon: 'fa-calculator', label: 'Portal Contador', bg: '#F3F0FF', color: '#7A6A9E' },
              { href: '/dashboard/aicfo', icon: 'fa-robot', label: 'Perguntar ao AI', bg: '#13201D', color: '#6FA595' },
            ].map(item => (
              <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
                <div style={{ padding: '8px 10px', background: '#FBF8F1', borderRadius: 8, border: '0.5px solid #E4DCCC', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', transition: 'background 0.15s' }}>
                  <div style={{ width: 26, height: 26, borderRadius: 6, background: item.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <i className={`fa-solid ${item.icon}`} style={{ fontSize: 11, color: item.color }} />
                  </div>
                  <span style={{ fontSize: 11, color: '#3C4A46', fontWeight: 500 }}>{item.label}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <Link href="/dashboard/aicfo" style={{ textDecoration: 'none' }}>
          <div style={{ background: 'var(--navy)', borderRadius: 12, padding: '14px 16px', height: '100%', display: 'flex', flexDirection: 'column', gap: 10, cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(61,122,110,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fa-solid fa-robot" style={{ fontSize: 13, color: '#6FA595' }} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', fontFamily: "var(--font-sans)" }}>FactorOne AI</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>CFO digital · análise em tempo real</div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6, flex: 1 }}>
              {dreMes.liquido < 0
                ? `Resultado líquido negativo em ${fmtBRLCompact(Math.abs(dreMes.liquido))} este mês. Recomendo revisar as principais categorias de despesa.`
                : `Receita ${fmtBRLCompact(kpiAtual.receita)} com margem líquida de ${dreMes.receitaBruta > 0 ? ((dreMes.liquido / dreMes.receitaBruta) * 100).toFixed(1) : '0'}%. ${runway != null && runway < 6 ? `Atenção: runway de ${runway} meses.` : 'Saúde financeira dentro do esperado.'}`
              }
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#6FA595', fontWeight: 600 }}>
              <i className="fa-solid fa-arrow-right" style={{ fontSize: 10 }} /> Analisar com IA
            </div>
          </div>
        </Link>
      </div>

      {/* Modal detalhe transação */}
      <Modal
        open={!!selectedTx}
        onClose={() => setSelectedTx(null)}
        title="Detalhe da transação"
        footer={
          <>
            <button className="btn-action btn-ghost" onClick={() => setSelectedTx(null)}>Fechar</button>
            <button className="btn-action" onClick={() => { setSelectedTx(null); router.push('/dashboard/cashflow') }}>Abrir Cash Flow</button>
          </>
        }
      >
            {selectedTx && [
              { l: 'Descrição', v: selectedTx.descricao || '—' },
              { l: 'Categoria', v: selectedTx.categoria || '—' },
              { l: 'Tipo', v: selectedTx.tipo === 'entrada' ? 'Entrada' : 'Saída' },
              { l: 'Data', v: new Date(selectedTx.data + 'T12:00:00').toLocaleDateString('pt-BR') },
              { l: 'Valor', v: `${selectedTx.tipo === 'entrada' ? '+' : '-'}${fmtBRL(Number(selectedTx.valor || 0))}` },
            ].map(({ l, v }) => (
              <div key={l} className="form-group" style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--cream)', borderRadius: 8, padding: '8px 12px' }}>
                <span style={{ color: 'var(--gray-500)', fontSize: 12 }}>{l}</span>
                <span style={{ fontWeight: 600, color: 'var(--navy)', fontSize: 12 }}>{v}</span>
              </div>
            ))}
      </Modal>
    </>
  )
}
