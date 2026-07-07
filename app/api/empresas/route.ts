import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseUser } from '@/lib/supabase-route'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// Lista as empresas que este login pode acessar (dono ou convidado), marcando
// qual é a ativa agora (usuarios.empresa_id).
export async function GET(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const [{ data: memberships, error }, { data: usuarioRow }] = await Promise.all([
    supabase.from('usuario_empresas').select('empresa_id,papel,empresas(id,nome,cnpj,plano)').eq('user_id', user.id),
    supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle(),
  ])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const ativaId = usuarioRow?.empresa_id as string | null
  const empresas = (memberships ?? []).map((m) => {
    const emp = m.empresas as unknown as { id: string; nome: string | null; cnpj: string | null; plano: string | null } | null
    return { id: emp?.id ?? m.empresa_id, nome: emp?.nome ?? null, cnpj: emp?.cnpj ?? null, plano: emp?.plano ?? null, papel: m.papel, ativa: (emp?.id ?? m.empresa_id) === ativaId }
  })

  return NextResponse.json({ empresas })
}

// Cria uma nova PJ pro mesmo login — dono. Categorias de despesa, plano de
// contas e orçamento são semeados automaticamente por triggers já existentes
// em `empresas` (on_empresa_created_ativo/orcamento/plano, trg_seed_categorias_despesa)
// pra QUALQUER insert nessa tabela — não precisa (nem deve) repetir aqui.
export async function POST(req: NextRequest) {
  const { user } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const nome = String(body.nome || '').trim()
  if (!nome) return NextResponse.json({ error: 'Informe o nome da empresa' }, { status: 400 })

  const svc = db()

  const { data: empresa, error: eEmp } = await svc.from('empresas').insert({ nome, user_id: user.id }).select('id,nome,cnpj,plano').single()
  if (eEmp || !empresa) return NextResponse.json({ error: eEmp?.message || 'Falha ao criar empresa' }, { status: 500 })

  const { error: eMemb } = await svc.from('usuario_empresas').insert({ user_id: user.id, empresa_id: empresa.id, papel: 'admin' })
  if (eMemb) return NextResponse.json({ error: eMemb.message }, { status: 500 })

  return NextResponse.json({ empresa })
}
