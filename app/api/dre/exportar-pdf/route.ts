import { NextRequest, NextResponse } from 'next/server'
import React from 'react'
import ReactPDF, { renderToBuffer } from '@react-pdf/renderer'
import { erroDesconhecido } from '@/lib/transacao-types'
import { getSupabaseUser } from '@/lib/supabase-route'
import {
  PdfHeader, PdfFooter, PdfKpi, PdfSectionTitle,
  BASE, COLORS, fmtBRL,
} from '@/lib/pdf/template'

const { Document, Page, View, Text } = ReactPDF

const LINHAS: { label: string; chave: string }[] = [
  { label: 'Receita Bruta', chave: 'receita_bruta' },
  { label: '(-) Deduções e Impostos', chave: 'deducoes' },
  { label: '= Receita Líquida', chave: 'receita_liquida' },
  { label: '(-) CMV/CSP', chave: 'cmv' },
  { label: '= Lucro Bruto', chave: 'lucro_bruto' },
  { label: '(-) Despesas Operacionais', chave: 'despesas_operacionais' },
  { label: '= EBITDA', chave: 'ebitda' },
  { label: '(-) Depreciação e Amortização', chave: 'depreciacao' },
  { label: '= EBIT', chave: 'ebit' },
  { label: '(+/-) Resultado Financeiro', chave: 'resultado_financeiro' },
  { label: '= Lucro Antes do IR (LAIR)', chave: 'lair' },
  { label: '(-) IR/CSLL', chave: 'impostos' },
  { label: '= Lucro Líquido', chave: 'lucro_liquido' },
]

export async function GET(req: NextRequest) {
  try {
    const { user, supabase } = await getSupabaseUser(req)
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const competencia = searchParams.get('competencia') || new Date().toISOString().slice(0, 7)

    const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const empresaId = (u?.empresa_id as string) || user.id
    const { data: emp } = await supabase.from('empresas').select('nome_fantasia,razao_social').eq('id', empresaId).maybeSingle()
    const empresaNome = (emp?.nome_fantasia || emp?.razao_social || 'Minha Empresa') as string

    const { data: met } = await supabase.from('metricas_financeiras').select('*').eq('empresa_id', empresaId).eq('competencia', `${competencia}-01`).maybeSingle()
    const m = (met ?? {}) as Record<string, number | string>

    const periodo = new Date(`${competencia}-01T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    const receita = Number(m.receita_bruta ?? 0)
    const ebitda = Number(m.ebitda ?? 0)
    const lucro = Number(m.lucro_liquido ?? 0)
    const margem = Number(m.margem_liquida ?? 0)

    const doc = React.createElement(
      Document, { title: `DRE ${competencia} - ${empresaNome}` },
      React.createElement(
        Page, { size: 'A4', style: BASE.page },
        PdfHeader('Demonstrativo de Resultados (DRE)', empresaNome, periodo),
        React.createElement(
          View, { style: BASE.body },
          React.createElement(
            View, { style: BASE.kpiRow },
            PdfKpi('Receita Bruta', fmtBRL(receita), COLORS.teal),
            PdfKpi('EBITDA', fmtBRL(ebitda), ebitda >= 0 ? COLORS.navy : COLORS.red, `${Number(m.margem_ebitda ?? 0).toFixed(1)}% margem`),
            PdfKpi('Lucro Líquido', fmtBRL(lucro), lucro >= 0 ? COLORS.green : COLORS.red, `${margem.toFixed(1)}% margem`),
          ),
          PdfSectionTitle('Demonstrativo de Resultado do Exercício'),
          React.createElement(
            View, { style: BASE.card },
            ...LINHAS.map((l, i) => {
              const valor = Number(m[l.chave] ?? 0)
              const isTotal = l.label.startsWith('=')
              const last = i === LINHAS.length - 1
              const rowStyle = isTotal ? BASE.rowTotal : last ? BASE.rowLast : BASE.row
              const color = isTotal ? (valor >= 0 ? COLORS.navy : COLORS.red) : (valor >= 0 ? '#374151' : COLORS.red)
              return React.createElement(
                View, { style: rowStyle, key: l.chave },
                React.createElement(Text, { style: isTotal ? { ...BASE.cellLabel, fontFamily: 'Helvetica-Bold', color: COLORS.navy } : BASE.cellLabel }, l.label),
                React.createElement(Text, { style: { ...BASE.cellVal, color } }, fmtBRL(valor)),
              )
            })
          ),
        ),
        PdfFooter('Página 1 de 1'),
      )
    )

    const pdf = await renderToBuffer(doc)
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="DRE_${competencia}_${empresaNome.replace(/\s+/g, '_')}.pdf"`,
      },
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: erroDesconhecido(e) }, { status: 500 })
  }
}
