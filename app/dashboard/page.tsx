'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { calcDREFromTransacoes, fmtBRL, fmtBRLCompact, variacaoPct, type TransacaoDRE } from '@/lib/dre-calculations'
import AnomalyAlerts from '@/components/dashboard/AnomalyAlerts'
import EntradasSaidasChart from '@/components/dashboard/EntradasSaidasChart'
import { DashboardErrorBoundary } from '@/components/dashboard/DashboardErrorBoundary'
import type { TransacaoLista } from '@/lib/transacao-types'

type Kpi = { receita: number; despesas: number; saldo: number; nfs: number }
type Pendencias = { reembolsos: number; valorReembolsos: number; aprovacoes: number; saldoBanco: number; dasDias: number | null; dasValor: number | null }
type ScoreComponente = { nome: string; pontos: number; max: number; descricao: string; detalhe: string }
type ScoreData = { total: number; grade: string; componentes: ScoreComponente[] }
type PatWidget = { total: number; valorContabil: number; depMes: number; frota: number; maquinas: number; imoveis: number; alertas: number }
type CrmWidget = { abertas: number; pipeline: number; ganhaMes: number; ativPendentes: number }
type MktWidget = { campanhasAtivas: number; gasto: number; receita: number; roas: number; leads: number }
type LogWidget = { rotasAtivas: number; receitaFrete: number; pneusAlerta: number; entreguesMes: number }

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
  const router = useRouter()

  function irParaAlerta(alertId: string) {
    if (alertId === 'despesa-acima-media') router.push('/dashboard/despesas')
    else if (alertId === 'saldo-caindo') router.push('/dashboard/cashflow')
    else if (alertId === 'sem-receita-15') router.push('/dashboard/financeiro/receber')
    else router.push('/dashboard/aicfo')
  }

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
      const [crmOpR, crmAtvR, mktCampR, mktLeadsR, logRotasR, logPneusR] = await Promise.all([
        supabase.from('crm_oportunidades').select('valor,etapa').eq('empresa_id', eid),
        supabase.from('crm_atividades').select('id').eq('empresa_id', eid).eq('status', 'pendente'),
        supabase.from('marketing_campanhas').select('status,gasto,receita_gerada').eq('empresa_id', eid),
        supabase.from('marketing_leads').select('id').eq('empresa_id', eid),
        supabase.from('logistica_rotas').select('status,valor_frete,created_at').eq('empresa_id', eid),
        supabase.from('logistica_pneus').select('km_rodado,km_limite').eq('empresa_id', eid).eq('status', 'ativo'),
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
  const dreLinhas = [
    { l: 'Receita', v: fmtBRLCompact(dreMes.receitaBruta), cls: 'g' },
    { l: '(-) CMV', v: dreMes.cmv > 0 ? `-${fmtBRLCompact(dreMes.cmv)}` : '—', cls: 'r' },
    { l: 'Lucro Bruto', v: fmtBRLCompact(dreMes.lucroBruto), cls: 'g' },
    { l: 'EBITDA', v: fmtBRLCompact(dreMes.ebitda), cls: 'am' },
    { l: 'Líquido', v: fmtBRLCompact(dreMes.liquido), cls: dreMes.liquido >= 0 ? 'g' : 'r' },
  ]

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
      </div>

      {/* Alertas IA */}
      <DashboardErrorBoundary title="Alertas">
        <AnomalyAlerts empresaId={empresaId} onAlertClick={irParaAlerta} />
      </DashboardErrorBoundary>

      {/* KPIs */}
      <div className="kpis">
        <div className="kpi">
          <div className="kpi-lbl">Receita Mensal</div>
          <div className="kpi-val">{fmtBRLCompact(kpiAtual.receita)}</div>
          <div className={`kpi-delta ${receitaVar === null ? '' : receitaVar >= 0 ? 'up' : 'dn'}`}>
            {receitaVar === null ? '1º mês' : `${receitaVar >= 0 ? '↑' : '↓'} ${receitaVar >= 0 ? '+' : ''}${receitaVar.toFixed(1)}%`}
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Lucro Líquido</div>
          <div className="kpi-val">{fmtBRLCompact(dreMes.liquido)}</div>
          <div className={`kpi-delta ${dreMes.liquido >= 0 ? 'up' : 'dn'}`}>
            {(() => { const v = variacaoPct(dreMes.liquido, dreMes.liquidoAnt); return v === null ? '1º mês' : `${v >= 0 ? '↑ +' : '↓ '}${v.toFixed(1)}%` })()}
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Fluxo 30 dias</div>
          <div className="kpi-val">{fmtBRLCompact(fluxo30)}</div>
          <div className={`kpi-delta ${fluxo30 >= 0 ? 'up' : 'dn'}`}>{fluxo30 >= 0 ? '↑ positivo' : '↓ negativo'}</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Runway</div>
          <div className="kpi-val">{runway != null ? `${runway > 30 ? Math.round(runway / 30) + 'm' : runway + 'd'}` : '—'}</div>
          <div className={`kpi-delta ${runway == null ? '' : runway < 90 ? 'warn' : 'up'}`}>
            {runway == null ? 'sem saldo cadastrado' : runway < 90 ? '⚠ atenção' : '✓ ok'}
          </div>
        </div>
      </div>

      {/* Pendências */}
      {(pendencias.reembolsos > 0 || pendencias.aprovacoes > 0 || (pendencias.dasDias !== null && pendencias.dasDias <= 10)) && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          {pendencias.aprovacoes > 0 && (
            <Link href="/dashboard/aprovacoes" style={{ textDecoration: 'none', flex: 1, minWidth: 180 }}>
              <div style={{ background: 'rgba(184,146,42,.06)', border: '1px solid rgba(184,146,42,.25)', borderRadius: 12, padding: '12px 16px', cursor: 'pointer' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gold)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 4 }}>Aprovações pendentes</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--navy)' }}>{pendencias.aprovacoes}</div>
                <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>despesas aguardando → aprovar</div>
              </div>
            </Link>
          )}
          {pendencias.reembolsos > 0 && (
            <Link href="/dashboard/reembolsos" style={{ textDecoration: 'none', flex: 1, minWidth: 180 }}>
              <div style={{ background: 'rgba(94,140,135,.06)', border: '1px solid rgba(94,140,135,.25)', borderRadius: 12, padding: '12px 16px', cursor: 'pointer' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--teal2)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 4 }}>Reembolsos pendentes</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--navy)' }}>{pendencias.reembolsos}</div>
                <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>{fmtBRLCompact(pendencias.valorReembolsos)} a aprovar</div>
              </div>
            </Link>
          )}
          {pendencias.dasDias !== null && pendencias.dasDias <= 10 && (
            <Link href="/contabilidade" style={{ textDecoration: 'none', flex: 1, minWidth: 180 }}>
              <div style={{ background: pendencias.dasDias <= 3 ? 'rgba(192,80,74,.06)' : 'rgba(184,146,42,.06)', border: `1px solid ${pendencias.dasDias <= 3 ? 'rgba(192,80,74,.25)' : 'rgba(184,146,42,.25)'}`, borderRadius: 12, padding: '12px 16px', cursor: 'pointer' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: pendencias.dasDias <= 3 ? 'var(--red)' : 'var(--gold)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 4 }}>DAS vence em {pendencias.dasDias}d</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--navy)' }}>{pendencias.dasValor ? fmtBRLCompact(pendencias.dasValor) : '—'}</div>
                <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>Simples Nacional · ver detalhes</div>
              </div>
            </Link>
          )}
          {pendencias.saldoBanco > 0 && (
            <Link href="/dashboard/cashflow" style={{ textDecoration: 'none', flex: 1, minWidth: 180 }}>
              <div style={{ background: 'rgba(45,155,111,.06)', border: '1px solid rgba(45,155,111,.2)', borderRadius: 12, padding: '12px 16px', cursor: 'pointer' }}>
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

      {/* Setores — CRM, Marketing, Logística */}
      {(crmWidget || mktWidget || logWidget) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
          {/* CRM */}
          {crmWidget && (
            <Link href="/dashboard/crm" style={{ textDecoration: 'none' }}>
              <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: '14px 16px', cursor: 'pointer', height: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className="fa-solid fa-handshake" style={{ color: '#7C3AED', fontSize: 12 }} />
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '.07em' }}>CRM</div>
                  <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 10, background: '#ede9fe', color: '#7C3AED', marginLeft: 'auto' }}>PLUS</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--gray-400)', marginBottom: 2 }}>Pipeline</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--navy)', fontFamily: "'DM Mono',monospace" }}>{fmtBRLCompact(crmWidget.pipeline)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--gray-400)', marginBottom: 2 }}>Ganho</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--green)', fontFamily: "'DM Mono',monospace" }}>{fmtBRLCompact(crmWidget.ganhaMes)}</div>
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
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: '#dcfce7', color: 'var(--green)', marginLeft: 'auto' }}>
                      {mktWidget.campanhasAtivas} ativa{mktWidget.campanhasAtivas > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--gray-400)', marginBottom: 2 }}>Investido</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--red)', fontFamily: "'DM Mono',monospace" }}>{fmtBRLCompact(mktWidget.gasto)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--gray-400)', marginBottom: 2 }}>Receita</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--green)', fontFamily: "'DM Mono',monospace" }}>{fmtBRLCompact(mktWidget.receita)}</div>
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
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className="fa-solid fa-truck-fast" style={{ color: 'var(--teal)', fontSize: 12 }} />
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '.07em' }}>Logística</div>
                  {logWidget.rotasAtivas > 0 && (
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: '#e0f2fe', color: 'var(--teal)', marginLeft: 'auto' }}>
                      {logWidget.rotasAtivas} em trânsito
                    </span>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--gray-400)', marginBottom: 2 }}>Rec. Frete</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--teal)', fontFamily: "'DM Mono',monospace" }}>{fmtBRLCompact(logWidget.receitaFrete)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--gray-400)', marginBottom: 2 }}>Entregues/mês</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--green)', fontFamily: "'DM Mono',monospace" }}>{logWidget.entreguesMes}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--gray-400)', marginBottom: 2 }}>Em trânsito</div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{logWidget.rotasAtivas}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--gray-400)', marginBottom: 2 }}>Pneus alerta</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: logWidget.pneusAlerta > 0 ? 'var(--red)' : 'var(--gray-400)' }}>
                      {logWidget.pneusAlerta > 0 ? `${logWidget.pneusAlerta} ⚠` : '—'}
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
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gray-400)', letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: "'DM Mono',monospace", marginBottom: 4 }}>
                Score Financeiro FactorOne
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: score.total >= 700 ? 'var(--green)' : score.total >= 500 ? 'var(--gold)' : 'var(--red)', fontFamily: "'DM Mono',monospace" }}>
                  {score.total}
                </div>
                <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>/ 1000</div>
                <div style={{ fontSize: 13, fontWeight: 700, padding: '2px 10px', borderRadius: 20, background: score.total >= 700 ? 'rgba(45,155,111,.12)' : score.total >= 500 ? 'rgba(184,146,42,.12)' : 'rgba(192,80,74,.12)', color: score.total >= 700 ? 'var(--green)' : score.total >= 500 ? 'var(--gold)' : 'var(--red)' }}>
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
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: 'var(--navy)', fontFamily: "'DM Mono',monospace" }}>{c.pontos}</div>
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
          <div className="chart-title">Entradas vs Saídas — 6 meses</div>
          <DashboardErrorBoundary title="Gráfico">
            <EntradasSaidasChart empresaId={empresaId} />
          </DashboardErrorBoundary>
        </div>
        <div className="chart-card">
          <div className="chart-title">DRE Resumo</div>
          <div className="dre-rows">
            {dreLinhas.map(r => (
              <div key={r.l} className="dre-row">
                <span className="dre-l">{r.l}</span>
                <span className={`dre-v ${r.cls}`}>{r.v}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--gray-100)' }}>
            <Link href="/dashboard/relatorios" style={{ fontSize: 11, color: 'var(--teal)', textDecoration: 'none' }}>
              Ver DRE completo →
            </Link>
          </div>
        </div>
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
                {t.tipo === 'entrada' ? '✓ +' : '-'}{fmtBRL(Number(t.valor))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal detalhe transação */}
      {selectedTx && (
        <div className="modal-bg" onClick={() => setSelectedTx(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-title">
              Detalhe da transação
              <button className="modal-close" onClick={() => setSelectedTx(null)}>×</button>
            </div>
            {[
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
            <div className="modal-actions">
              <button className="btn-action btn-ghost" onClick={() => setSelectedTx(null)}>Fechar</button>
              <button className="btn-action" onClick={() => { setSelectedTx(null); router.push('/dashboard/cashflow') }}>Abrir Cash Flow</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
