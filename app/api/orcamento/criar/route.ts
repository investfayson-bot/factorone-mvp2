import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'

export async function POST(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = (await req.json()) as {
    nome: string
    ano_fiscal: number
    categorias: Array<{ categoria: string; previstoAnual: number }>
    enviar_aprovacao?: boolean
  }
  const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = (u?.empresa_id as string) || user.id
  const { data: existente } = await supabase.from('orcamentos').select('id').eq('empresa_id', empresaId).eq('ano_fiscal', body.ano_fiscal).eq('status', 'ativo').maybeSingle()
  if (existente) return NextResponse.json({ error: 'Já existe orçamento ativo para este ano' }, { status: 400 })

  const { data: novo, error } = await supabase.from('orcamentos').insert({
    empresa_id: empresaId,
    nome: body.nome,
    ano_fiscal: body.ano_fiscal,
    status: body.enviar_aprovacao ? 'em_aprovacao' : 'rascunho',
    criado_por: user.id,
    versao: 1,
  }).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const linhas: Array<{ orcamento_id: string; empresa_id: string; categoria: string; mes: number; ano: number; valor_previsto: number; valor_realizado: number }> = []
  for (const c of body.categorias || []) {
    const mensal = Number(c.previstoAnual || 0) / 12
    for (let mes = 1; mes <= 12; mes += 1) {
      linhas.push({
        orcamento_id: novo.id,
        empresa_id: empresaId,
        categoria: c.categoria,
        mes,
        ano: body.ano_fiscal,
        valor_previsto: mensal,
        valor_realizado: 0,
      })
    }
  }
  if (linhas.length) {
    const ins = await supabase.from('orcamento_linhas').insert(linhas)
    if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 400 })
  }
  return NextResponse.json({ orcamento: novo, linhas_count: linhas.length })
}
