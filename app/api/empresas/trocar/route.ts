import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseUser } from '@/lib/supabase-route'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// Troca a empresa ativa do login — valida que ele realmente tem acesso a ela
// (usuario_empresas) antes de escrever. É a única forma de mudar
// usuarios.empresa_id agora (o client perdeu UPDATE direto nessa coluna).
export async function POST(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const empresaId = String(body.empresa_id || '')
  if (!empresaId) return NextResponse.json({ error: 'Informe empresa_id' }, { status: 400 })

  const { data: membership } = await supabase.from('usuario_empresas').select('empresa_id').eq('user_id', user.id).eq('empresa_id', empresaId).maybeSingle()
  if (!membership) return NextResponse.json({ error: 'Você não tem acesso a essa empresa' }, { status: 403 })

  const { error } = await db().from('usuarios').update({ empresa_id: empresaId }).eq('id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
