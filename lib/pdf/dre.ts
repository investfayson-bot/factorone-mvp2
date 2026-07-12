import React from 'react'
import ReactPDF, { renderToBuffer } from '@react-pdf/renderer'
import type { SupabaseClient } from '@supabase/supabase-js'
import { PdfHeader, PdfFooter, PdfKpi, PdfSectionTitle, BASE, COLORS, fmtBRL } from '@/lib/pdf/template'

const { Document, Page, View, Text } = ReactPDF

// Extraído de app/api/dre/exportar-pdf pra ser chamável de qualquer lugar
// que já tenha um client autorizado (a rota HTTP e o bot do Telegram usam
// o mesmo gerador — quem chama é responsável por já ter validado o acesso
// à empresa).

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

export type DreGerado = {
  buffer: Buffer
  filename: string
  empresaNome: string
  periodo: string
  resumo: { receita: number; ebitda: number; lucro: number; margem: number }
}

export async function gerarDrePdf(db: SupabaseClient, empresaId: string, competencia: string): Promise<DreGerado> {
  const { data: emp } = await db.from('empresas').select('nome_fantasia,razao_social').eq('id', empresaId).maybeSingle()
  const empresaNome = (emp?.nome_fantasia || emp?.razao_social || 'Minha Empresa') as string

  const { data: met } = await db.from('metricas_financeiras').select('*').eq('empresa_id', empresaId).eq('competencia', `${competencia}-01`).maybeSingle()
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
  return {
    buffer: Buffer.from(pdf),
    filename: `DRE_${competencia}_${empresaNome.replace(/\s+/g, '_')}.pdf`,
    empresaNome,
    periodo,
    resumo: { receita, ebitda, lucro, margem },
  }
}
