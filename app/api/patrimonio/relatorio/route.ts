import { NextRequest, NextResponse } from 'next/server'
import React from 'react'
import ReactPDF from '@react-pdf/renderer'
import { getSupabaseUser } from '@/lib/supabase-route'

const { Document, Page, Text, View, StyleSheet, renderToBuffer } = ReactPDF
const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 10 },
  h1: { fontSize: 16, marginBottom: 8 },
  h2: { fontSize: 12, marginTop: 10, marginBottom: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
})

export async function GET(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = (u?.empresa_id as string) || user.id
  const [ativos, categorias, depreciacoes] = await Promise.all([
    supabase.from('ativos').select('nome,valor_aquisicao,depreciacao_acumulada,valor_contabil,status').eq('empresa_id', empresaId).order('nome'),
    supabase.from('categorias_ativo').select('id,nome').eq('empresa_id', empresaId),
    supabase.from('depreciacoes').select('competencia,valor_depreciacao').eq('empresa_id', empresaId).order('competencia', { ascending: false }).limit(24),
  ])
  const totalAquisicao = (ativos.data || []).reduce((s, a) => s + Number(a.valor_aquisicao || 0), 0)
  const totalContabil = (ativos.data || []).reduce((s, a) => s + Number(a.valor_contabil || 0), 0)
  const totalDep = (ativos.data || []).reduce((s, a) => s + Number(a.depreciacao_acumulada || 0), 0)

  const doc = React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: 'A4', style: styles.page },
      React.createElement(Text, { style: styles.h1 }, 'FactorOne - Relatorio Patrimonio'),
      React.createElement(Text, null, `Gerado em ${new Date().toLocaleString('pt-BR')}`),
      React.createElement(Text, { style: styles.h2 }, 'Resumo'),
      React.createElement(View, { style: styles.row }, React.createElement(Text, null, 'Total ativos'), React.createElement(Text, null, String((ativos.data || []).length))),
      React.createElement(View, { style: styles.row }, React.createElement(Text, null, 'Valor aquisicao'), React.createElement(Text, null, `R$ ${totalAquisicao.toFixed(2)}`)),
      React.createElement(View, { style: styles.row }, React.createElement(Text, null, 'Depreciacao acumulada'), React.createElement(Text, null, `R$ ${totalDep.toFixed(2)}`)),
      React.createElement(View, { style: styles.row }, React.createElement(Text, null, 'Valor contabil'), React.createElement(Text, null, `R$ ${totalContabil.toFixed(2)}`)),
      React.createElement(Text, { style: styles.h2 }, 'Categorias'),
      ...(categorias.data || []).map((c) => React.createElement(View, { key: c.id, style: styles.row }, React.createElement(Text, null, c.nome), React.createElement(Text, null, '')))
    ),
    React.createElement(
      Page,
      { size: 'A4', style: styles.page },
      React.createElement(Text, { style: styles.h2 }, 'Listagem de ativos'),
      ...(ativos.data || []).map((a, i) =>
        React.createElement(
          View,
          { key: String(i), style: styles.row },
          React.createElement(Text, null, `${a.nome} (${a.status})`),
          React.createElement(Text, null, `R$ ${Number(a.valor_contabil || 0).toFixed(2)}`)
        )
      )
    ),
    React.createElement(
      Page,
      { size: 'A4', style: styles.page },
      React.createElement(Text, { style: styles.h2 }, 'Depreciacoes do periodo'),
      ...(depreciacoes.data || []).map((d, i) =>
        React.createElement(
          View,
          { key: String(i), style: styles.row },
          React.createElement(Text, null, String(d.competencia)),
          React.createElement(Text, null, `R$ ${Number(d.valor_depreciacao || 0).toFixed(2)}`)
        )
      )
    )
  )
  const pdf = await renderToBuffer(doc)
  return new NextResponse(new Uint8Array(pdf), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="patrimonio.pdf"' },
  })
}
