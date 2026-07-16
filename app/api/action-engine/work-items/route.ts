import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseUser } from '@/lib/supabase-route'

export const runtime = 'nodejs'

function svc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// Lista work_items da empresa ativa do login, ordenados por score desc.
// ?origem=documento|open_finance|obrigacao_fiscal filtra por origem.
// ?status=todos inclui resolvido/ignorado (default: só aberto/em_analise).
export async function GET(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = (u?.empresa_id as string) ?? user.id

  const { searchParams } = new URL(req.url)
  const origem = searchParams.get('origem')
  const incluirResolvidos = searchParams.get('status') === 'todos'

  const service = svc()
  let query = service
    .from('work_items')
    .select('id, tipo, origem, origem_ref, responsavel_papel, status, prazo, impacto_valor, score, sugestao_ia, historico, arquivo_path, created_at, resolved_at')
    .eq('empresa_id', empresaId)
    .order('score', { ascending: false })
    .limit(100)

  if (origem) query = query.eq('origem', origem)
  if (!incluirResolvidos) query = query.in('status', ['aberto', 'em_analise'])

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ work_items: data ?? [] })
}
