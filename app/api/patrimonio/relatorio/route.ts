import { NextRequest, NextResponse } from 'next/server'
import React from 'react'
import ReactPDF from '@react-pdf/renderer'
import { getSupabaseUser } from '@/lib/supabase-route'

const { Document, Page, Text, View, StyleSheet, renderToBuffer } = ReactPDF

const NAVY = '#1C2B2A'
const TEAL = '#5E8C87'
const GOLD = '#D97706'
const RED = '#C0504A'
const GRAY = '#7A8F8E'
const GRAY_LIGHT = '#F4F6F5'

const s = StyleSheet.create({
  page: { padding: 0, fontSize: 9, fontFamily: 'Helvetica', backgroundColor: '#FAFAFA' },
  header: { backgroundColor: NAVY, padding: '20 28', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  headerLeft: { flexDirection: 'column' },
  headerLogo: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#FFFFFF', letterSpacing: -0.5 },
  headerLogoAccent: { color: TEAL },
  headerSub: { fontSize: 8, color: 'rgba(255,255,255,.6)', marginTop: 2 },
  headerRight: { alignItems: 'flex-end' },
  headerTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#FFFFFF' },
  headerCompany: { fontSize: 8, color: 'rgba(255,255,255,.7)', marginTop: 2 },
  body: { padding: '16 28' },
  kpisRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  kpi: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 6, padding: '10 12', border: '1 solid #E8EEF2' },
  kpiLabel: { fontSize: 7, color: GRAY, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  kpiValue: { fontSize: 13, fontFamily: 'Helvetica-Bold' },
  kpiSub: { fontSize: 7, color: GRAY, marginTop: 2 },
  sectionTitle: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: NAVY, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8, marginTop: 14, paddingBottom: 4, borderBottom: `1 solid ${GRAY_LIGHT}` },
  table: { backgroundColor: '#FFFFFF', borderRadius: 6, border: '1 solid #E8EEF2', overflow: 'hidden' },
  tableHeadRow: { flexDirection: 'row', backgroundColor: GRAY_LIGHT, padding: '7 12', borderBottom: '1 solid #E8EEF2' },
  tableHeadCell: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: GRAY, textTransform: 'uppercase', letterSpacing: 0.3 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: '7 12', borderBottom: '1 solid #F3F6F9' },
  cellName: { fontSize: 8, color: '#374151', flex: 2 },
  cellStatus: { fontSize: 7, flex: 1, textAlign: 'center' },
  cellVal: { fontSize: 8, fontFamily: 'Helvetica-Bold', textAlign: 'right', flex: 1, color: NAVY },
  footer: { position: 'absolute', bottom: 14, left: 28, right: 28, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerText: { fontSize: 7, color: 'rgba(107,114,128,.7)' },
  pageNum: { fontSize: 7, color: 'rgba(107,114,128,.7)' },
})

const fmtBRL = (v: number) =>
  `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

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
      React.createElement(Text, { style: s.headerSub }, 'Finance OS · Relatório de Patrimônio')
    ),
    React.createElement(
      View, { style: s.headerRight },
      React.createElement(Text, { style: s.headerTitle }, periodo),
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

const STATUS_LABEL: Record<string, string> = {
  ativo: 'Ativo', em_manutencao: 'Manutenção', baixado: 'Baixado', alienado: 'Alienado', perdido: 'Perdido', sucateado: 'Sucateado',
}

export async function GET(req: NextRequest) {
  try {
    const { user, supabase } = await getSupabaseUser(req)
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const empresaId = (u?.empresa_id as string) || user.id

    const { data: empresa } = await supabase.from('empresas').select('nome_fantasia,razao_social').eq('id', empresaId).maybeSingle()
    const empresaNome = (empresa?.nome_fantasia || empresa?.razao_social || 'Minha Empresa') as string

    const [ativosRes, depreciacoesRes] = await Promise.all([
      supabase.from('ativos').select('nome,categoria_id,valor_aquisicao,depreciacao_acumulada,valor_contabil,status,data_aquisicao').eq('empresa_id', empresaId).order('nome'),
      supabase.from('depreciacoes').select('competencia,valor_depreciacao').eq('empresa_id', empresaId).order('competencia', { ascending: false }).limit(12),
    ])

    const ativos = ativosRes.data ?? []
    const depreciacoes = depreciacoesRes.data ?? []

    const totalAquisicao = ativos.reduce((sum, a) => sum + Number(a.valor_aquisicao || 0), 0)
    const totalContabil = ativos.reduce((sum, a) => sum + Number(a.valor_contabil || 0), 0)
    const totalDep = ativos.reduce((sum, a) => sum + Number(a.depreciacao_acumulada || 0), 0)
    const ativosAtivos = ativos.filter(a => !['baixado', 'alienado', 'perdido', 'sucateado'].includes(a.status))

    const periodo = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

    const kpis = [
      { label: 'Total de Ativos', value: String(ativos.length), color: NAVY, sub: `${ativosAtivos.length} ativos hoje` },
      { label: 'Valor de Aquisição', value: fmtBRL(totalAquisicao), color: NAVY, sub: 'custo original' },
      { label: 'Depreciação Acum.', value: fmtBRL(totalDep), color: GOLD, sub: 'desgaste contábil' },
      { label: 'Valor Contábil', value: fmtBRL(totalContabil), color: TEAL, sub: 'valor líquido atual' },
    ]

    const doc = React.createElement(
      Document, { title: `Patrimônio ${periodo} - ${empresaNome}` },

      // Página 1 — Resumo
      React.createElement(
        Page, { size: 'A4', style: s.page },
        Header(empresaNome, periodo),
        React.createElement(
          View, { style: s.body },
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
          React.createElement(Text, { style: s.sectionTitle }, 'Depreciação — Últimos 12 meses'),
          React.createElement(
            View, { style: s.table },
            React.createElement(
              View, { style: s.tableHeadRow },
              React.createElement(Text, { style: { ...s.tableHeadCell, flex: 2 } }, 'Competência'),
              React.createElement(Text, { style: { ...s.tableHeadCell, flex: 1, textAlign: 'right' } }, 'Valor depreciado')
            ),
            ...(depreciacoes.length === 0
              ? [React.createElement(View, { style: s.row, key: 'empty' }, React.createElement(Text, { style: s.cellName }, 'Nenhuma depreciação registrada'))]
              : depreciacoes.map((d, i) =>
                  React.createElement(
                    View, { style: s.row, key: String(i) },
                    React.createElement(Text, { style: { ...s.cellName, flex: 2 } }, String(d.competencia)),
                    React.createElement(Text, { style: { ...s.cellVal, flex: 1 } }, fmtBRL(Number(d.valor_depreciacao || 0)))
                  )
                ))
          )
        ),
        Footer('Página 1 de 2')
      ),

      // Página 2 — Listagem completa de ativos
      React.createElement(
        Page, { size: 'A4', style: s.page },
        Header(empresaNome, periodo),
        React.createElement(
          View, { style: s.body },
          React.createElement(Text, { style: s.sectionTitle }, `Listagem de Ativos (${ativos.length})`),
          React.createElement(
            View, { style: s.table },
            React.createElement(
              View, { style: s.tableHeadRow },
              React.createElement(Text, { style: { ...s.tableHeadCell, flex: 2 } }, 'Ativo'),
              React.createElement(Text, { style: { ...s.tableHeadCell, flex: 1, textAlign: 'center' } }, 'Status'),
              React.createElement(Text, { style: { ...s.tableHeadCell, flex: 1, textAlign: 'right' } }, 'Valor contábil')
            ),
            ...(ativos.length === 0
              ? [React.createElement(View, { style: s.row, key: 'empty' }, React.createElement(Text, { style: s.cellName }, 'Nenhum ativo cadastrado'))]
              : ativos.map((a, i) =>
                  React.createElement(
                    View, { style: s.row, key: String(i) },
                    React.createElement(Text, { style: s.cellName }, a.nome),
                    React.createElement(Text, { style: s.cellStatus }, STATUS_LABEL[a.status] || a.status),
                    React.createElement(Text, { style: s.cellVal }, fmtBRL(Number(a.valor_contabil || 0)))
                  )
                ))
          )
        ),
        Footer('Página 2 de 2')
      )
    )

    const pdf = await renderToBuffer(doc)
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Patrimonio_${periodo.replace(/\s+/g, '_')}_${empresaNome.replace(/\s+/g, '_')}.pdf"`,
      },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido ao gerar PDF'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
