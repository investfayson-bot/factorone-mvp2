import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { getSupabaseUser } from '@/lib/supabase-route'

export async function GET(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const ano = Number(searchParams.get('ano') || new Date().getFullYear())
  const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = (u?.empresa_id as string) || user.id
  const { data: orc } = await supabase.from('orcamentos').select('id').eq('empresa_id', empresaId).eq('ano_fiscal', ano).order('versao', { ascending: false }).limit(1).maybeSingle()
  if (!orc) return NextResponse.json({ error: 'Orçamento não encontrado' }, { status: 404 })
  const { data: linhas } = await supabase.from('orcamento_linhas').select('*').eq('orcamento_id', orc.id)
  const wb = XLSX.utils.book_new()
  const resumo = (linhas || []).map((l) => ({ categoria: l.categoria, mes: l.mes, previsto: Number(l.valor_previsto || 0), realizado: Number(l.valor_realizado || 0), variacao: Number(l.variacao || 0), variacao_pct: Number(l.variacao_pct || 0) }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumo), 'Resumo')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumo), 'Mensal')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumo), 'Centro de Custo')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="orcamento-${ano}.xlsx"`,
    },
  })
}
