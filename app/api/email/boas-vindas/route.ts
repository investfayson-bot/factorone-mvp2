import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'
import { createClient } from '@supabase/supabase-js'
import { emailBoasVindas } from '@/lib/email/notificacoes'

export const runtime = 'nodejs'

function svc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function POST(req: NextRequest) {
  const { user } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = svc()
  const { data: u } = await db.from('usuarios').select('empresa_id,email').eq('id', user.id).maybeSingle()
  const empresaId = u?.empresa_id ?? user.id
  const { data: emp } = await db.from('empresas').select('nome').eq('id', empresaId).maybeSingle()

  const para = user.email ?? u?.email
  if (!para) return NextResponse.json({ sent: false })

  const sent = await emailBoasVindas(para, emp?.nome ?? 'sua empresa')
  return NextResponse.json({ sent })
}
