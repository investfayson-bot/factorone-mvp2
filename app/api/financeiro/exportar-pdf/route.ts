import { NextRequest, NextResponse } from 'next/server'
import React from 'react'
import ReactPDF from '@react-pdf/renderer'
import { getSupabaseUser } from '@/lib/supabase-route'
import {
  PdfHeader, PdfFooter, PdfKpi, PdfSectionTitle,
  PdfTableHead, PdfTableRow,
  fmtBRL, fmtBRLCompact, fmtDate, fmtStatus,
  BASE, COLORS,
} from '@/lib/pdf/template'

const { Document, Page, View, Text, renderToBuffer } = ReactPDF

type CP = { id: string; fornecedor_nome: string; descricao: string; valor: number; data_vencimento: string; status: string; categoria: string }
type CR = { id: string; cliente_nome: string; descricao: string; valor: number; data_vencimento: string; status: string; dias_atraso: number }

export async function GET(req: NextRequest) {
  try {
    const { user, supabase } = await getSupabaseUser(req)
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const empresaId = (u?.empresa_id as string) || user.id
    const { data: emp } = await supabase.from('empresas').select('nome_fantasia,razao_social').eq('id', empresaId).maybeSingle()
    const empresaNome = (emp?.nome_fantasia || emp?.razao_social || 'Minha Empresa') as string

    const mesStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
    const mesEnd   = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10)
    const periodo  = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

    const [pagarRes, receberRes] = await Promise.all([
      supabase.from('contas_pagar').select('id,fornecedor_nome,descricao,valor,data_vencimento,status,categoria').eq('empresa_id', empresaId).gte('data_vencimento', mesStart).lte('data_vencimento', mesEnd).order('data_vencimento'),
      supabase.from('contas_receber').select('id,cliente_nome,descricao,valor,data_vencimento,status,dias_atraso').eq('empresa_id', empresaId).gte('data_vencimento', mesStart).lte('data_vencimento', mesEnd).order('data_vencimento'),
    ])

    const pagar   = (pagarRes.data ?? [])   as CP[]
    const receber = (receberRes.data ?? []) as CR[]

    const totalPagar    = pagar.reduce((s, r) => s + Number(r.valor), 0)
    const totalReceber  = receber.reduce((s, r) => s + Number(r.valor), 0)
    const vencidasP     = pagar.filter(r => r.status === 'vencida').length
    const vencidasR     = receber.filter(r => r.status === 'vencida').length
    const saldoProjetado = totalReceber - totalPagar

    const doc = React.createElement(
      Document, { title: `Financeiro ${periodo} - ${empresaNome}` },

      React.createElement(
        Page, { size: 'A4', style: BASE.page },
        PdfHeader('Relatório Financeiro', empresaNome, periodo),
        React.createElement(
          View, { style: BASE.body },

          // KPIs
          React.createElement(
            View, { style: BASE.kpiRow },
            PdfKpi('A Pagar', fmtBRLCompact(totalPagar), COLORS.red, `${pagar.length} lançamentos · ${vencidasP} vencidas`),
            PdfKpi('A Receber', fmtBRLCompact(totalReceber), COLORS.teal, `${receber.length} lançamentos · ${vencidasR} vencidas`),
            PdfKpi('Saldo projetado', fmtBRLCompact(saldoProjetado), saldoProjetado >= 0 ? COLORS.green : COLORS.red, saldoProjetado >= 0 ? '↑ favorável' : '↓ atenção'),
            PdfKpi('Período', periodo, COLORS.navy, new Date().toLocaleDateString('pt-BR'))
          ),

          // A Pagar
          PdfSectionTitle(`Contas a Pagar (${pagar.length})`),
          React.createElement(
            View, { style: BASE.card },
            PdfTableHead([
              { label: 'Fornecedor', flex: 2 },
              { label: 'Descrição', flex: 2 },
              { label: 'Vencimento', flex: 1 },
              { label: 'Status', flex: 1 },
              { label: 'Valor', flex: 1, align: 'right' },
            ]),
            pagar.length === 0
              ? React.createElement(View, { style: BASE.rowLast },
                  React.createElement(Text, { style: { ...BASE.cellLabel, color: COLORS.gray } }, 'Nenhuma conta a pagar neste período'))
              : pagar.map((r, i) =>
                  PdfTableRow([
                    { value: r.fornecedor_nome || '—', flex: 2 },
                    { value: r.descricao || '—', flex: 2 },
                    { value: fmtDate(r.data_vencimento), flex: 1, color: r.status === 'vencida' ? COLORS.red : undefined },
                    { value: fmtStatus(r.status), flex: 1, color: r.status === 'vencida' ? COLORS.red : r.status === 'paga' ? COLORS.green : COLORS.gold },
                    { value: fmtBRL(Number(r.valor)), flex: 1, align: 'right', bold: true, color: COLORS.red },
                  ], { last: i === pagar.length - 1 })
                ),
            pagar.length > 0 && PdfTableRow([
              { value: 'TOTAL A PAGAR', flex: 4, bold: true },
              { value: fmtBRL(totalPagar), flex: 1, align: 'right', bold: true, color: COLORS.red },
            ], { total: true })
          ),

          // A Receber
          PdfSectionTitle(`Contas a Receber (${receber.length})`),
          React.createElement(
            View, { style: BASE.card },
            PdfTableHead([
              { label: 'Cliente', flex: 2 },
              { label: 'Descrição', flex: 2 },
              { label: 'Vencimento', flex: 1 },
              { label: 'Atraso', flex: 1 },
              { label: 'Valor', flex: 1, align: 'right' },
            ]),
            receber.length === 0
              ? React.createElement(View, { style: BASE.rowLast },
                  React.createElement(Text, { style: { ...BASE.cellLabel, color: COLORS.gray } }, 'Nenhuma conta a receber neste período'))
              : receber.map((r, i) =>
                  PdfTableRow([
                    { value: r.cliente_nome || '—', flex: 2 },
                    { value: r.descricao || '—', flex: 2 },
                    { value: fmtDate(r.data_vencimento), flex: 1 },
                    { value: r.dias_atraso > 0 ? `${r.dias_atraso}d` : '—', flex: 1, color: r.dias_atraso > 0 ? COLORS.red : COLORS.gray },
                    { value: fmtBRL(Number(r.valor)), flex: 1, align: 'right', bold: true, color: COLORS.teal },
                  ], { last: i === receber.length - 1 })
                ),
            receber.length > 0 && PdfTableRow([
              { value: 'TOTAL A RECEBER', flex: 4, bold: true },
              { value: fmtBRL(totalReceber), flex: 1, align: 'right', bold: true, color: COLORS.teal },
            ], { total: true })
          )
        ),
        PdfFooter('Página 1 de 1')
      )
    )

    const pdf = await renderToBuffer(doc)
    const nomeArquivo = `Financeiro_${periodo.replace(/\s+/g, '_')}_${empresaNome.replace(/\s+/g, '_')}.pdf`

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
