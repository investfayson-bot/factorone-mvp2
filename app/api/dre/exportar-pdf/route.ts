import { NextRequest, NextResponse } from 'next/server'
import React from 'react'
import ReactPDF from '@react-pdf/renderer'
import { erroDesconhecido } from '@/lib/transacao-types'

const { Document, Page, Text, View, StyleSheet, renderToBuffer } = ReactPDF

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 10 },
  h1: { fontSize: 16, marginBottom: 10 },
  h2: { fontSize: 12, marginTop: 10, marginBottom: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  foot: { position: 'absolute', bottom: 14, left: 24, right: 24, textAlign: 'center', color: '#666' },
})

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      empresaNome: string
      periodo: string
      dre: Array<{ linha: string; valor: number }>
      metricas: Record<string, unknown>
      analise?: Record<string, unknown>
    }
    const doc = React.createElement(
      Document,
      null,
      React.createElement(
        Page,
        { size: 'A4', style: styles.page },
        React.createElement(Text, { style: styles.h1 }, 'FactorOne - DRE'),
        React.createElement(Text, null, `${body.empresaNome} - ${body.periodo}`),
        React.createElement(Text, { style: styles.h2 }, 'DRE completo'),
        ...(body.dre || []).map((r, i) =>
          React.createElement(
            View,
            { style: styles.row, key: String(i) },
            React.createElement(Text, null, String(r.linha)),
            React.createElement(Text, null, `R$ ${Number(r.valor || 0).toFixed(2)}`)
          )
        ),
        React.createElement(Text, { style: styles.foot }, 'Gerado por FactorOne')
      ),
      React.createElement(
        Page,
        { size: 'A4', style: styles.page },
        React.createElement(Text, { style: styles.h1 }, 'Metricas avancadas'),
        ...Object.entries(body.metricas || {}).map(([k, v]) =>
          React.createElement(
            View,
            { style: styles.row, key: k },
            React.createElement(Text, null, k),
            React.createElement(Text, null, String(v))
          )
        ),
        React.createElement(Text, { style: styles.foot }, new Date().toLocaleString('pt-BR'))
      ),
      React.createElement(
        Page,
        { size: 'A4', style: styles.page },
        React.createElement(Text, { style: styles.h1 }, 'Analise IA'),
        React.createElement(Text, null, JSON.stringify(body.analise || {}, null, 2)),
        React.createElement(Text, { style: styles.foot }, 'Gerado por FactorOne')
      )
    )
    const pdf = await renderToBuffer(doc)
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="dre.pdf"',
      },
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: erroDesconhecido(e) }, { status: 500 })
  }
}
