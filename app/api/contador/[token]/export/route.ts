import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Mapeia tipo de export -> permissao de leitura da secao correspondente
const PERM_BY_TIPO: Record<string, string> = {
  lancamentos: 'ver_lancamentos',
  despesas: 'ver_despesas',
  dre: 'ver_dre',
}

// CSV pt-BR: delimitador ';', quebra CRLF, BOM e decimal com virgula (abre direto no Excel)
function brNum(v: number | string | null | undefined): string {
  return Number(v ?? 0).toFixed(2).replace('.', ',')
}
function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v)
  return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}
function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  const lines = [headers.map(csvCell).join(';')]
  for (const r of rows) lines.push(r.map(csvCell).join(';'))
  return '﻿' + lines.join('\r\n')
}

// 'YYYY-MM' -> intervalo [primeiro dia, primeiro dia do mes seguinte)
function competenciaRange(competencia: string | null): { ini: string; fim: string } | null {
  if (!competencia || !/^\d{4}-\d{2}$/.test(competencia)) return null
  const [y, m] = competencia.split('-').map(Number)
  const p2 = (n: number) => String(n).padStart(2, '0')
  const ini = `${y}-${p2(m)}-01`
  const fim = m === 12 ? `${y + 1}-01-01` : `${y}-${p2(m + 1)}-01`
  return { ini, fim }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const { searchParams } = new URL(req.url)
  const tipo = searchParams.get('tipo') ?? ''
  const competencia = searchParams.get('competencia') // YYYY-MM (opcional)
  const range = competenciaRange(competencia)

  const supabase = db()

  const { data: cont } = await supabase
    .from('contadores')
    .select('status, empresa_id, permissoes')
    .eq('token_acesso', token)
    .maybeSingle()

  if (!cont) return NextResponse.json({ error: 'invalid_token' }, { status: 401 })
  if (cont.status === 'revogado') return NextResponse.json({ error: 'revoked' }, { status: 403 })

  const eid = cont.empresa_id as string
  const perm = (cont.permissoes ?? {}) as Record<string, boolean>

  if (perm.exportar === false) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const needed = PERM_BY_TIPO[tipo]
  if (!needed) return NextResponse.json({ error: 'unknown_tipo' }, { status: 400 })
  if (perm[needed] === false) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const sufixo = competencia ? `-${competencia}` : ''
  let csv = ''
  let filename = ''

  if (tipo === 'lancamentos') {
    let q = supabase
      .from('lancamentos')
      .select('competencia, descricao, tipo, valor, origem')
      .eq('empresa_id', eid)
      .order('competencia', { ascending: false })
    if (range) q = q.gte('competencia', range.ini).lt('competencia', range.fim)
    const { data } = await q.limit(5000)
    const rows = (data ?? []).map(l => [
      String(l.competencia ?? '').slice(0, 10),
      l.descricao ?? '',
      l.tipo === 'credito' ? 'Crédito' : 'Débito',
      brNum(l.valor as number),
      l.origem ?? '',
    ])
    csv = toCsv(['Competência', 'Descrição', 'Tipo', 'Valor', 'Origem'], rows)
    filename = `lancamentos${sufixo}.csv`
  } else if (tipo === 'despesas') {
    let q = supabase
      .from('despesas')
      .select('data_despesa, descricao, categoria, valor, status')
      .eq('empresa_id', eid)
      .order('data_despesa', { ascending: false })
    if (range) q = q.gte('data_despesa', range.ini).lt('data_despesa', range.fim)
    const { data } = await q.limit(5000)
    const rows = (data ?? []).map(d => [
      String(d.data_despesa ?? '').slice(0, 10),
      d.descricao ?? '',
      d.categoria ?? '',
      brNum(d.valor as number),
      d.status ?? '',
    ])
    csv = toCsv(['Data', 'Descrição', 'Categoria', 'Valor', 'Status'], rows)
    filename = `despesas${sufixo}.csv`
  } else if (tipo === 'dre') {
    let q = supabase
      .from('metricas_financeiras')
      .select('competencia, receita_bruta, deducoes, receita_liquida, cmv, lucro_bruto, despesas_operacionais, ebitda, lucro_liquido, margem_liquida')
      .eq('empresa_id', eid)
      .order('competencia', { ascending: false })
    if (range) q = q.gte('competencia', range.ini).lt('competencia', range.fim)
    const { data } = await q.limit(60)
    const rows = (data ?? []).map(m => [
      String(m.competencia ?? '').slice(0, 7),
      brNum(m.receita_bruta as number),
      brNum(m.deducoes as number),
      brNum(m.receita_liquida as number),
      brNum(m.cmv as number),
      brNum(m.lucro_bruto as number),
      brNum(m.despesas_operacionais as number),
      brNum(m.ebitda as number),
      brNum(m.lucro_liquido as number),
      (Number(m.margem_liquida ?? 0) * 100).toFixed(1).replace('.', ',') + '%',
    ])
    csv = toCsv(
      ['Competência', 'Receita Bruta', 'Deduções', 'Receita Líquida', 'CMV', 'Lucro Bruto', 'Despesas Operacionais', 'EBITDA', 'Lucro Líquido', 'Margem Líquida'],
      rows
    )
    filename = `dre${sufixo}.csv`
  }

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
