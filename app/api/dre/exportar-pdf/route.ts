import { NextRequest, NextResponse } from 'next/server'
import React from 'react'
import ReactPDF, { renderToBuffer } from '@react-pdf/renderer'
import { erroDesconhecido } from '@/lib/transacao-types'
import { getSupabaseUser } from '@/lib/supabase-route'

const { Document, Page, Text, View, StyleSheet } = ReactPDF

const NAVY = '#1A2B4A'
const TEAL = '#10B981'
const GREEN = '#2D9B6F'
const RED = '#C0504A'
const GOLD = '#B8922A'
const GRAY = '#6B7280'
const GRAY_LIGHT = '#F3F6F9'

const s = StyleSheet.create({
  page: { padding: 0, fontSize: 9, fontFamily: 'Helvetica', backgroundColor: '#FAFAFA' },
  header: { backgroundColor: NAVY, padding: '20 28', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  headerLeft: { flexDirection: 'column' },
  headerLogo: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#FFFFFF', letterSpacing: -0.5 },
  headerLogoAccent: { color: TEAL },
  headerSub: { fontSize: 8, color: 'rgba(255,255,255,.6)', marginTop: 2 },
  headerRight: { alignItems: 'flex-end' },
  headerPeriod: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#FFFFFF' },
  headerCompany: { fontSize: 8, color: 'rgba(255,255,255,.7)', marginTop: 2 },
  body: { padding: '16 28' },
  kpisRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  kpi: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 6, padding: '10 12', border: '1 solid #E8EEF2' },
  kpiLabel: { fontSize: 7, color: GRAY, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  kpiValue: { fontSize: 13, fontFamily: 'Helvetica-Bold' },
  kpiSub: { fontSize: 7, color: GRAY, marginTop: 2 },
  sectionTitle: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: NAVY, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8, marginTop: 14, paddingBottom: 4, borderBottom: `1 solid ${GRAY_LIGHT}` },
  dreTable: { backgroundColor: '#FFFFFF', borderRadius: 6, border: '1 solid #E8EEF2', overflow: 'hidden' },
  dreRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: '7 12', borderBottom: '1 solid #F3F6F9' },
  dreRowTotal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: '8 12', backgroundColor: GRAY_LIGHT, borderBottom: '1 solid #E8EEF2' },
  dreLabel: { fontSize: 8, color: '#374151', flex: 1 },
  dreLabelTotal: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: NAVY, flex: 1 },
  dreValue: { fontSize: 9, fontFamily: 'Helvetica-Bold', textAlign: 'right', minWidth: 80 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metricCard: { width: '48%', backgroundColor: '#FFFFFF', borderRadius: 6, padding: '8 10', border: '1 solid #E8EEF2' },
  metricKey: { fontSize: 7, color: GRAY, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3 },
  metricVal: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: NAVY },
  analysisBg: { backgroundColor: '#EFF6F5', borderRadius: 6, padding: '12 14', border: `1 solid rgba(16,185,129,.2)`, marginTop: 10 },
  analysisTitle: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: TEAL, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  analysisText: { fontSize: 8, color: '#374151', lineHeight: 1.6 },
  footer: { position: 'absolute', bottom: 14, left: 28, right: 28, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerText: { fontSize: 7, color: 'rgba(107,114,128,.7)' },
  pageNum: { fontSize: 7, color: 'rgba(107,114,128,.7)' },
  tagGreen: { backgroundColor: '#DCFCE7', color: GREEN, borderRadius: 3, padding: '1 4', fontSize: 7 },
  tagRed: { backgroundColor: '#FEE2E2', color: RED, borderRadius: 3, padding: '1 4', fontSize: 7 },
})

const fmtBRL = (v: number) =>
  `R$ ${Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${v < 0 ? ' (-)' : ''}`

const fmtPct = (v: number) => `${Number(v).toFixed(1)}%`

function Header(empresaNome: string, periodo: string) {
  return React.createElement(
    View, { style: s.header },
    React.createElement(
      View, { style: s.headerLeft },
      React.createElement(
        View, { style: { flexDirection: 'row' } },
        React.createElement(Text, { style: s.headerLogo }, 'Factor'),
        React.createElement(Text, { style: { ...s.headerLogo, ...s.headerLogoAccent } }, 'One')
      ),
      React.createElement(Text, { style: s.headerSub }, 'Finance OS · Demonstrativo de Resultados')
    ),
    React.createElement(
      View, { style: s.headerRight },
      React.createElement(Text, { style: s.headerPeriod }, periodo),
      React.createElement(Text, { style: s.headerCompany }, empresaNome)
    )
  )
}

function Footer(pageText: string) {
  return React.createElement(
    View, { style: s.footer },
    React.createElement(Text, { style: s.footerText }, `Gerado em ${new Date().toLocaleDateString('pt-BR')} · FactorOne Finance OS`),
    React.createElement(Text, { style: s.pageNum }, pageText)
  )
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await getSupabaseUser(req)
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const body = (await req.json()) as {
      empresaNome: string
      periodo: string
      dre: Array<{ linha: string; valor: number }>
      metricas: Record<string, unknown>
      analise?: Record<string, unknown>
    }

    const m = body.metricas ?? {}
    const receita = Number(m.receita_bruta ?? 0)
    const ebitda = Number(m.ebitda ?? 0)
    const lucro = Number(m.lucro_liquido ?? 0)
    const margem = Number(m.margem_liquida ?? 0)

    // KPIs principais
    const kpis = [
      { label: 'Receita Bruta', value: fmtBRL(receita), color: TEAL, sub: body.periodo },
      { label: 'EBITDA', value: fmtBRL(ebitda), color: ebitda >= 0 ? NAVY : RED, sub: `${fmtPct(Number(m.margem_ebitda ?? 0))} margem` },
      { label: 'Lucro Líquido', value: fmtBRL(lucro), color: lucro >= 0 ? GREEN : RED, sub: `${fmtPct(margem)} margem` },
      { label: 'ROI', value: fmtPct(Number(m.roi ?? 0)), color: GOLD, sub: 'retorno sobre invest.' },
    ]

    // Métricas avançadas
    const metricasLabels: Record<string, string> = {
      receita_bruta: 'Receita Bruta', deducoes: 'Deduções', receita_liquida: 'Receita Líquida',
      cmv: 'CMV / CSP', lucro_bruto: 'Lucro Bruto', despesas_operacionais: 'Despesas Operacionais',
      ebitda: 'EBITDA', depreciacao: 'Depreciação', ebit: 'EBIT',
      resultado_financeiro: 'Resultado Financeiro', lair: 'LAIR', impostos: 'Impostos',
      lucro_liquido: 'Lucro Líquido', margem_bruta: 'Margem Bruta %',
      margem_ebitda: 'Margem EBITDA %', margem_liquida: 'Margem Líquida %',
      roi: 'ROI %', roic: 'ROIC %', roce: 'ROCE %',
    }

    const doc = React.createElement(
      Document, { title: `DRE ${body.periodo} - ${body.empresaNome}` },

      // Página 1 — DRE
      React.createElement(
        Page, { size: 'A4', style: s.page },
        Header(body.empresaNome, body.periodo),
        React.createElement(
          View, { style: s.body },
          // KPIs
          React.createElement(
            View, { style: s.kpisRow },
            ...kpis.map((k, i) =>
              React.createElement(
                View, { style: s.kpi, key: String(i) },
                React.createElement(Text, { style: s.kpiLabel }, k.label),
                React.createElement(Text, { style: { ...s.kpiValue, color: k.color } }, k.value),
                React.createElement(Text, { style: s.kpiSub }, k.sub)
              )
            )
          ),
          // Tabela DRE
          React.createElement(Text, { style: s.sectionTitle }, 'Demonstrativo de Resultados do Exercício'),
          React.createElement(
            View, { style: s.dreTable },
            ...(body.dre ?? []).map((r, i) => {
              const isTotal = r.linha.startsWith('=')
              const valueColor = r.valor >= 0 ? (isTotal ? (r.valor > 0 ? GREEN : RED) : '#374151') : RED
              return React.createElement(
                View, { style: isTotal ? s.dreRowTotal : s.dreRow, key: String(i) },
                React.createElement(Text, { style: isTotal ? s.dreLabelTotal : s.dreLabel }, r.linha),
                React.createElement(Text, { style: { ...s.dreValue, color: valueColor } }, fmtBRL(r.valor))
              )
            })
          )
        ),
        Footer('Página 1 de 2')
      ),

      // Página 2 — Métricas + Análise
      React.createElement(
        Page, { size: 'A4', style: s.page },
        Header(body.empresaNome, body.periodo),
        React.createElement(
          View, { style: s.body },
          React.createElement(Text, { style: s.sectionTitle }, 'Métricas Avançadas'),
          React.createElement(
            View, { style: s.metricsGrid },
            ...Object.entries(body.metricas ?? {})
              .filter(([k]) => metricasLabels[k])
              .map(([k, v]) => {
                const numVal = Number(v ?? 0)
                const isPct = ['margem_bruta', 'margem_ebitda', 'margem_liquida', 'roi', 'roic', 'roce'].includes(k)
                const displayVal = isPct ? fmtPct(numVal) : fmtBRL(numVal)
                const color = numVal >= 0 ? NAVY : RED
                return React.createElement(
                  View, { style: s.metricCard, key: k },
                  React.createElement(Text, { style: s.metricKey }, metricasLabels[k]),
                  React.createElement(Text, { style: { ...s.metricVal, color } }, displayVal)
                )
              })
          ),
          body.analise ? React.createElement(
            View, { style: s.analysisBg },
            React.createElement(Text, { style: s.analysisTitle }, 'Análise FactorOne IA'),
            React.createElement(Text, { style: { ...s.analysisText, fontFamily: 'Helvetica-Bold', marginBottom: 6 } }, `Score de saúde: ${String(body.analise.score_saude ?? '—')}`),
            React.createElement(Text, { style: s.analysisText }, String(body.analise.resumo_executivo ?? 'Sem análise disponível.')),
            ...(Array.isArray(body.analise.alertas) ? (body.analise.alertas as string[]).slice(0, 5).map((a, i) =>
              React.createElement(
                View, { key: String(i), style: { flexDirection: 'row', gap: 4, marginTop: 4, alignItems: 'flex-start' } },
                React.createElement(Text, { style: { color: GOLD, fontSize: 8, marginTop: 1 } }, '•'),
                React.createElement(Text, { style: s.analysisText }, a)
              )
            ) : [])
          ) : React.createElement(
            View, { style: s.analysisBg },
            React.createElement(Text, { style: s.analysisTitle }, 'Análise FactorOne IA'),
            React.createElement(Text, { style: s.analysisText }, 'Use o botão "Analisar com IA" para gerar uma análise executiva antes de exportar o PDF.')
          )
        ),
        Footer('Página 2 de 2')
      )
    )

    const pdf = await renderToBuffer(doc)
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="DRE_${body.periodo}_${body.empresaNome.replace(/\s+/g, '_')}.pdf"`,
      },
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: erroDesconhecido(e) }, { status: 500 })
  }
}
