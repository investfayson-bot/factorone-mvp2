import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseUser } from '@/lib/supabase-route'
import { calcularDepreciacaoMes } from '@/lib/financeiro/depreciacao'
import { recalcularDREMes } from '@/lib/financeiro/recalcularDRE'

function competenciaToDate(input: string): Date {
  const [y, m] = input.split('-').map(Number)
  return new Date(Date.UTC(y, (m || 1) - 1, 1))
}

export async function POST(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = (await req.json()) as { empresaId?: string; competencia?: string }
  const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = body.empresaId || (u?.empresa_id as string) || user.id
  const competenciaStr = body.competencia || new Date().toISOString().slice(0, 7)
  const competencia = competenciaToDate(competenciaStr)

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data: ativos, error } = await admin
    .from('ativos')
    .select('*')
    .eq('empresa_id', empresaId)
    .eq('status', 'ativo')
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  let processados = 0
  let totalDepreciado = 0
  for (const ativo of ativos || []) {
    const valor = calcularDepreciacaoMes(
      {
        valor_aquisicao: Number(ativo.valor_aquisicao || 0),
        valor_residual: Number(ativo.valor_residual || 0),
        vida_util_anos: Number(ativo.vida_util_anos || 5),
        metodo_depreciacao: ativo.metodo_depreciacao || 'linear',
        data_inicio_depreciacao: ativo.data_inicio_depreciacao,
        depreciacao_acumulada: Number(ativo.depreciacao_acumulada || 0),
        status: ativo.status || 'ativo',
      },
      competencia
    )
    if (valor <= 0) continue
    const compDate = `${competenciaStr}-01`
    const { data: existente } = await admin.from('depreciacoes').select('id').eq('ativo_id', ativo.id).eq('competencia', compDate).maybeSingle()
    if (existente) continue

    const valorAntes = Number(ativo.valor_aquisicao || 0) - Number(ativo.depreciacao_acumulada || 0)
    const acumuladaApos = Number(ativo.depreciacao_acumulada || 0) + valor
    const valorApos = Number(ativo.valor_aquisicao || 0) - acumuladaApos

    const { data: contaDep } = await admin
      .from('plano_contas')
      .select('id')
      .eq('empresa_id', empresaId)
      .ilike('nome', 'Depreciação e Amortização')
      .maybeSingle()

    const lanc = await admin.from('lancamentos').insert({
      empresa_id: empresaId,
      conta_id: contaDep?.id || null,
      descricao: `Depreciação ${ativo.nome} - ${competenciaStr}`,
      valor,
      tipo: 'debito',
      competencia: compDate,
      origem: 'manual',
    }).select('id').maybeSingle()

    await admin.from('depreciacoes').insert({
      ativo_id: ativo.id,
      empresa_id: empresaId,
      competencia: compDate,
      valor_depreciacao: valor,
      valor_contabil_antes: valorAntes,
      valor_contabil_apos: valorApos,
      depreciacao_acumulada_apos: acumuladaApos,
      lancamento_id: lanc.data?.id || null,
    })
    await admin.from('ativos').update({ depreciacao_acumulada: acumuladaApos, updated_at: new Date().toISOString() }).eq('id', ativo.id)
    processados += 1
    totalDepreciado += valor
  }

  await recalcularDREMes(empresaId, competencia)
  return NextResponse.json({ processados, total_depreciado: totalDepreciado, competencia: competenciaStr })
}

export async function GET(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = (u?.empresa_id as string) || user.id
  const [{ count: ativos }, { data: ultima }, { data: agg }] = await Promise.all([
    supabase.from('ativos').select('id', { count: 'exact', head: true }).eq('empresa_id', empresaId).eq('status', 'ativo'),
    supabase.from('depreciacoes').select('competencia, created_at').eq('empresa_id', empresaId).order('competencia', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('depreciacoes').select('valor_depreciacao').eq('empresa_id', empresaId),
  ])
  const total = (agg || []).reduce((s, r) => s + Number(r.valor_depreciacao || 0), 0)
  return NextResponse.json({ ativos: ativos || 0, ultima_depreciacao: ultima || null, total_acumulado: total })
}
