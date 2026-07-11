import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser, bloquearSeLeitura } from '@/lib/supabase-route'

export async function GET(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = (u?.empresa_id as string) || user.id
  const { data, error } = await supabase.from('precificacao_produtos').select('*').eq('empresa_id', empresaId).order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: 'Erro ao processar solicitação' }, { status: 400 })
  return NextResponse.json({ data: data || [] })
}

export async function POST(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const bloqueio = await bloquearSeLeitura(supabase, user.id)
  if (bloqueio) return NextResponse.json({ error: `Papel ${bloqueio} é somente leitura` }, { status: 403 })
  const body = await req.json()
  const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = (u?.empresa_id as string) || user.id
  const registro = {
    empresa_id: empresaId,
    nome: body.nome || 'Sem nome',
    unidade: body.unidade || 'item',
    custo_insumo: Number(body.custo_insumo || 0),
    mao_obra: Number(body.mao_obra || 0),
    despesas_fixas_rateadas: Number(body.despesas_fixas_rateadas || 0),
    producao_mensal_estimada: Number(body.producao_mensal_estimada || 1),
    impostos_pct: Number(body.impostos_pct || 0),
    comissao_pct: Number(body.comissao_pct || 0),
    margem_pct: Number(body.margem_pct || 0),
    preco_sugerido: Number(body.preco_sugerido || 0),
  }
  const { data, error } = await supabase.from('precificacao_produtos').insert(registro).select('*').single()
  if (error) return NextResponse.json({ error: 'Erro ao processar solicitação' }, { status: 400 })
  return NextResponse.json({ data })
}
