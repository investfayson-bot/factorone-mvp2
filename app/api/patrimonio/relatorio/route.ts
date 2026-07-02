import { NextRequest, NextResponse } from 'next/server'
import React from 'react'
import ReactPDF, { renderToBuffer } from '@react-pdf/renderer'
import { getSupabaseUser } from '@/lib/supabase-route'
import {
  PdfHeader, PdfFooter, PdfKpi, PdfSectionTitle,
  PdfTableHead, PdfTableRow,
  fmtBRL, fmtBRLCompact, fmtDate,
  BASE, COLORS,
} from '@/lib/pdf/template'

const { Document, Page, View, Text } = ReactPDF

const STATUS_LABEL: Record<string, string> = {
  ativo: 'Ativo', em_manutencao: 'Em manutenção',
  baixado: 'Baixado', alienado: 'Alienado',
  perdido: 'Perdido', sucateado: 'Sucateado',
}
const ATIVOS_BAIXADOS = ['baixado', 'alienado', 'perdido', 'sucateado']

export async function GET(req: NextRequest) {
  try {
    const { user, supabase } = await getSupabaseUser(req)
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const empresaId = (u?.empresa_id as string) || user.id
    const { data: emp } = await supabase.from('empresas').select('nome_fantasia,razao_social').eq('id', empresaId).maybeSingle()
    const empresaNome = (emp?.nome_fantasia || emp?.razao_social || 'Minha Empresa') as string

    const [ativosRes, deprecRes] = await Promise.all([
      supabase.from('ativos').select('nome,valor_aquisicao,depreciacao_acumulada,valor_contabil,status,data_aquisicao').eq('empresa_id', empresaId).order('nome'),
      supabase.from('depreciacoes').select('competencia,valor_depreciacao').eq('empresa_id', empresaId).order('competencia', { ascending: false }).limit(12),
    ])

    const ativos      = ativosRes.data ?? []
    const depreciacoes = deprecRes.data ?? []
    const periodo     = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

    const totalAquisicao  = ativos.reduce((s, a) => s + Number(a.valor_aquisicao || 0), 0)
    const totalContabil   = ativos.reduce((s, a) => s + Number(a.valor_contabil || 0), 0)
    const totalDep        = ativos.reduce((s, a) => s + Number(a.depreciacao_acumulada || 0), 0)
    const ativosAtivos    = ativos.filter(a => !ATIVOS_BAIXADOS.includes(a.status))

    const doc = React.createElement(
      Document, { title: `Patrimônio ${periodo} - ${empresaNome}` },

      // PÁG 1 — KPIs + Depreciação
      React.createElement(
        Page, { size: 'A4', style: BASE.page },
        PdfHeader('Relatório de Patrimônio', empresaNome, periodo),
        React.createElement(
          View, { style: BASE.body },
          React.createElement(
            View, { style: BASE.kpiRow },
            PdfKpi('Total de Ativos', String(ativos.length), COLORS.navy, `${ativosAtivos.length} ativos em uso`),
            PdfKpi('Valor de Aquisição', fmtBRLCompact(totalAquisicao), COLORS.navy, 'custo histórico'),
            PdfKpi('Depreciação Acum.', fmtBRLCompact(totalDep), COLORS.gold, 'desgaste contábil'),
            PdfKpi('Valor Contábil', fmtBRLCompact(totalContabil), COLORS.teal, 'valor líquido atual')
          ),
          PdfSectionTitle('Depreciação — Últimos 12 meses'),
          React.createElement(
            View, { style: BASE.card },
            PdfTableHead([
              { label: 'Competência', flex: 2 },
              { label: 'Valor depreciado', flex: 1, align: 'right' },
            ]),
            depreciacoes.length === 0
              ? React.createElement(View, { style: BASE.rowLast },
                  React.createElement(Text, { style: { ...BASE.cellLabel, color: COLORS.gray } }, 'Nenhuma depreciação registrada'))
              : depreciacoes.map((d, i) =>
                  PdfTableRow([
                    { value: String(d.competencia), flex: 2 },
                    { value: fmtBRL(Number(d.valor_depreciacao || 0)), flex: 1, align: 'right', bold: true },
                  ], { last: i === depreciacoes.length - 1 })
                )
          )
        ),
        PdfFooter('Página 1 de 2')
      ),

      // PÁG 2 — Listagem de ativos
      React.createElement(
        Page, { size: 'A4', style: BASE.page },
        PdfHeader('Patrimônio — Listagem Completa', empresaNome, periodo),
        React.createElement(
          View, { style: BASE.body },
          PdfSectionTitle(`Listagem de Ativos (${ativos.length})`),
          React.createElement(
            View, { style: BASE.card },
            PdfTableHead([
              { label: 'Ativo', flex: 2.5 },
              { label: 'Aquisição', flex: 1 },
              { label: 'Status', flex: 1 },
              { label: 'Deprec. Acum.', flex: 1, align: 'right' },
              { label: 'Valor contábil', flex: 1, align: 'right' },
            ]),
            ativos.length === 0
              ? React.createElement(View, { style: BASE.rowLast },
                  React.createElement(Text, { style: { ...BASE.cellLabel, color: COLORS.gray } }, 'Nenhum ativo cadastrado'))
              : ativos.map((a, i) =>
                  PdfTableRow([
                    { value: a.nome, flex: 2.5 },
                    { value: a.data_aquisicao ? fmtDate(a.data_aquisicao) : '—', flex: 1 },
                    { value: STATUS_LABEL[a.status] || a.status, flex: 1, color: ATIVOS_BAIXADOS.includes(a.status) ? COLORS.gray : COLORS.green },
                    { value: fmtBRL(Number(a.depreciacao_acumulada || 0)), flex: 1, align: 'right', color: COLORS.gold },
                    { value: fmtBRL(Number(a.valor_contabil || 0)), flex: 1, align: 'right', bold: true, color: COLORS.teal },
                  ], { last: i === ativos.length - 1 })
                ),
            ativos.length > 0 && PdfTableRow([
              { value: 'TOTAL', flex: 4.5, bold: true },
              { value: fmtBRL(totalDep), flex: 1, align: 'right', bold: true, color: COLORS.gold },
              { value: fmtBRL(totalContabil), flex: 1, align: 'right', bold: true, color: COLORS.teal },
            ], { total: true })
          )
        ),
        PdfFooter('Página 2 de 2')
      )
    )

    const pdf = await renderToBuffer(doc)
    const nomeArquivo = `Patrimonio_${periodo.replace(/\s+/g, '_')}_${empresaNome.replace(/\s+/g, '_')}.pdf`

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${nomeArquivo}"`,
      },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro ao gerar PDF'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
