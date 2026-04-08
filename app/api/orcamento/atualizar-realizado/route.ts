import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'
import { verificarAlertas } from '@/lib/orcamento/engine'

export async function POST(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = (await req.json()) as {
    orcamentoId?: string
    categoria: string
    mes: number
    ano: number
    valor: number
  }
  const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = (u?.empresa_id as string) || user.id

  let orcamentoId = body.orcamentoId
  if (!orcamentoId) {
    const { data: orc } = await supabase
      .from('orcamentos')
      .select('id')
      .eq('empresa_id', empresaId)
      .eq('ano_fiscal', body.ano)
      .in('status', ['ativo', 'aprovado'])
      .order('versao', { ascending: false })
      .limit(1)
      .maybeSingle()
    orcamentoId = orc?.id
  }
  if (!orcamentoId) return NextResponse.json({ error: 'Orçamento não encontrado para competência' }, { status: 404 })
  const { data: linha } = await supabase
    .from('orcamento_linhas')
    .select('*')
    .eq('orcamento_id', orcamentoId)
    .eq('categoria', body.categoria)
    .eq('mes', body.mes)
    .eq('ano', body.ano)
    .is('centro_custo_id', null)
    .maybeSingle()
  if (!linha) return NextResponse.json({ error: 'Linha não encontrada' }, { status: 404 })
  const realizado = Number(linha.valor_realizado || 0) + Number(body.valor || 0)
  const upd = await supabase.from('orcamento_linhas').update({ valor_realizado: realizado }).eq('id', linha.id).select('*').single()
  if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 400 })
  const alertas = await verificarAlertas(empresaId, new Date(body.ano, body.mes - 1, 1))
  return NextResponse.json({ linha: upd.data, alertas })
}
