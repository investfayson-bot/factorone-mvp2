import { NextRequest, NextResponse } from 'next/server'
import React from 'react'
import ReactPDF, { renderToBuffer } from '@react-pdf/renderer'
import { getSupabaseUser } from '@/lib/supabase-route'
import {
  PdfHeader, PdfFooter, PdfKpi, PdfSectionTitle,
  PdfTableHead, PdfTableRow,
  fmtBRL, fmtBRLCompact, fmtDate, fmtStatus,
  BASE, COLORS,
} from '@/lib/pdf/template'

const { Document, Page, View, Text } = ReactPDF

export async function GET(req: NextRequest) {
  try {
    const { user, supabase } = await getSupabaseUser(req)
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const empresaId = (u?.empresa_id as string) || user.id
    const { data: emp } = await supabase.from('empresas').select('nome_fantasia,razao_social,cnpj').eq('id', empresaId).maybeSingle()
    const empresaNome = (emp?.nome_fantasia || emp?.razao_social || 'Minha Empresa') as string
    const cnpj = emp?.cnpj as string | undefined

    const mesStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
    const mesEnd   = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10)
    const periodo  = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

    const [txRes, notasRes, despRes] = await Promise.all([
      supabase.from('transacoes').select('id,descricao,valor,tipo,data,status,categoria').eq('empresa_id', empresaId).gte('data', mesStart).lte('data', mesEnd).order('data', { ascending: false }).limit(50),
      supabase.from('notas_fiscais').select('id,numero,fornecedor_nome,valor,tipo,status,data_emissao').eq('empresa_id', empresaId).gte('data_emissao', mesStart).lte('data_emissao', mesEnd).order('data_emissao', { ascending: false }).limit(30),
      supabase.from('despesas').select('id,descricao,valor,data,categoria,status').eq('empresa_id', empresaId).gte('data', mesStart).lte('data', mesEnd).order('data', { ascending: false }).limit(30),
    ])

    const transacoes = txRes.data ?? []
    const notas      = notasRes.data ?? []
    const despesas   = despRes.data ?? []

    const totalEntradas = transacoes.filter(t => t.tipo === 'entrada').reduce((s, t) => s + Number(t.valor), 0)
    const totalSaidas   = transacoes.filter(t => t.tipo === 'saida').reduce((s, t) => s + Number(t.valor), 0)
    const totalNotas    = notas.reduce((s, n) => s + Number(n.valor), 0)
    const totalDesp     = despesas.reduce((s, d) => s + Number(d.valor), 0)

    const doc = React.createElement(
      Document, { title: `Bookkeeping ${periodo} - ${empresaNome}` },

      // PÁG 1 — Resumo + Lançamentos
      React.createElement(
        Page, { size: 'A4', style: BASE.page },
        PdfHeader('Portal do Contador — Bookkeeping', empresaNome, periodo),
        React.createElement(
          View, { style: BASE.body },

          // Info empresa
          React.createElement(
            View, { style: { backgroundColor: COLORS.tealLight, borderRadius: 6, padding: '8 12', marginBottom: 12, border: `1 solid rgba(94,140,135,.25)` } },
            React.createElement(Text, { style: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: COLORS.navy, marginBottom: 2 } }, empresaNome),
            cnpj && React.createElement(Text, { style: { fontSize: 7, color: COLORS.gray } }, `CNPJ: ${cnpj} · Competência: ${periodo}`)
          ),

          // KPIs
          React.createElement(
            View, { style: BASE.kpiRow },
            PdfKpi('Entradas', fmtBRLCompact(totalEntradas), COLORS.teal, `${transacoes.filter(t => t.tipo === 'entrada').length} lançamentos`),
            PdfKpi('Saídas', fmtBRLCompact(totalSaidas), COLORS.red, `${transacoes.filter(t => t.tipo === 'saida').length} lançamentos`),
            PdfKpi('Resultado', fmtBRLCompact(totalEntradas - totalSaidas), totalEntradas >= totalSaidas ? COLORS.green : COLORS.red, 'entradas - saídas'),
            PdfKpi('NF-e emitidas', String(notas.length), COLORS.navy, `Total: ${fmtBRLCompact(totalNotas)}`)
          ),

          // Lançamentos
          PdfSectionTitle(`Lançamentos do período (${transacoes.length})`),
          React.createElement(
            View, { style: BASE.card },
            PdfTableHead([
              { label: 'Data', flex: 0.8 },
              { label: 'Descrição', flex: 2.5 },
              { label: 'Categoria', flex: 1.5 },
              { label: 'Tipo', flex: 0.8 },
              { label: 'Valor', flex: 1, align: 'right' },
            ]),
            transacoes.length === 0
              ? React.createElement(View, { style: BASE.rowLast },
                  React.createElement(Text, { style: { ...BASE.cellLabel, color: COLORS.gray } }, 'Nenhum lançamento no período'))
              : transacoes.slice(0, 25).map((t, i) =>
                  PdfTableRow([
                    { value: fmtDate(t.data), flex: 0.8 },
                    { value: t.descricao || '—', flex: 2.5 },
                    { value: t.categoria || 'Não classificado', flex: 1.5, color: !t.categoria ? COLORS.gold : undefined },
                    { value: t.tipo === 'entrada' ? 'Entrada' : 'Saída', flex: 0.8, color: t.tipo === 'entrada' ? COLORS.green : COLORS.red },
                    { value: fmtBRL(Number(t.valor)), flex: 1, align: 'right', bold: true, color: t.tipo === 'entrada' ? COLORS.green : COLORS.red },
                  ], { last: i === Math.min(transacoes.length, 25) - 1 })
                ),
            transacoes.length > 0 && PdfTableRow([
              { value: 'RESULTADO DO PERÍODO', flex: 4.8, bold: true },
              { value: fmtBRL(totalEntradas - totalSaidas), flex: 1, align: 'right', bold: true, color: totalEntradas >= totalSaidas ? COLORS.green : COLORS.red },
            ], { total: true })
          )
        ),
        PdfFooter('Página 1 de 2')
      ),

      // PÁG 2 — Notas Fiscais + Despesas
      React.createElement(
        Page, { size: 'A4', style: BASE.page },
        PdfHeader('Portal do Contador — Notas & Despesas', empresaNome, periodo),
        React.createElement(
          View, { style: BASE.body },

          // Notas Fiscais
          PdfSectionTitle(`Notas Fiscais emitidas (${notas.length})`),
          React.createElement(
            View, { style: BASE.card },
            PdfTableHead([
              { label: 'Número', flex: 0.8 },
              { label: 'Destinatário', flex: 2 },
              { label: 'Emissão', flex: 1 },
              { label: 'Tipo', flex: 0.8 },
              { label: 'Status', flex: 1 },
              { label: 'Valor', flex: 1, align: 'right' },
            ]),
            notas.length === 0
              ? React.createElement(View, { style: BASE.rowLast },
                  React.createElement(Text, { style: { ...BASE.cellLabel, color: COLORS.gray } }, 'Nenhuma NF emitida no período'))
              : notas.map((n, i) =>
                  PdfTableRow([
                    { value: n.numero || '—', flex: 0.8 },
                    { value: n.fornecedor_nome || '—', flex: 2 },
                    { value: fmtDate(n.data_emissao), flex: 1 },
                    { value: (n.tipo || '').toUpperCase(), flex: 0.8 },
                    { value: fmtStatus(n.status), flex: 1, color: n.status === 'autorizada' ? COLORS.green : COLORS.gold },
                    { value: fmtBRL(Number(n.valor)), flex: 1, align: 'right', bold: true, color: COLORS.teal },
                  ], { last: i === notas.length - 1 })
                ),
            notas.length > 0 && PdfTableRow([
              { value: 'TOTAL NF-e', flex: 5.6, bold: true },
              { value: fmtBRL(totalNotas), flex: 1, align: 'right', bold: true, color: COLORS.teal },
            ], { total: true })
          ),

          // Despesas
          PdfSectionTitle(`Despesas (${despesas.length})`),
          React.createElement(
            View, { style: BASE.card },
            PdfTableHead([
              { label: 'Data', flex: 0.8 },
              { label: 'Descrição', flex: 2.5 },
              { label: 'Categoria', flex: 1.5 },
              { label: 'Status', flex: 1 },
              { label: 'Valor', flex: 1, align: 'right' },
            ]),
            despesas.length === 0
              ? React.createElement(View, { style: BASE.rowLast },
                  React.createElement(Text, { style: { ...BASE.cellLabel, color: COLORS.gray } }, 'Nenhuma despesa no período'))
              : despesas.slice(0, 20).map((d, i) =>
                  PdfTableRow([
                    { value: fmtDate(d.data), flex: 0.8 },
                    { value: d.descricao || '—', flex: 2.5 },
                    { value: d.categoria || '—', flex: 1.5 },
                    { value: fmtStatus(d.status || ''), flex: 1 },
                    { value: fmtBRL(Number(d.valor)), flex: 1, align: 'right', bold: true, color: COLORS.red },
                  ], { last: i === Math.min(despesas.length, 20) - 1 })
                ),
            despesas.length > 0 && PdfTableRow([
              { value: 'TOTAL DESPESAS', flex: 5.8, bold: true },
              { value: fmtBRL(totalDesp), flex: 1, align: 'right', bold: true, color: COLORS.red },
            ], { total: true })
          )
        ),
        PdfFooter('Página 2 de 2')
      )
    )

    const pdf = await renderToBuffer(doc)
    const nomeArquivo = `Bookkeeping_${periodo.replace(/\s+/g, '_')}_${empresaNome.replace(/\s+/g, '_')}.pdf`

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
