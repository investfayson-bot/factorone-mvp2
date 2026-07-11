import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

// Exibição do convite na página de aceite (antes do login). Substitui a
// policy membros_equipe_token_read (USING true) que deixava enumerar a
// equipe de qualquer tenant — aqui é service role com busca por token
// exato, devolvendo só os campos de exibição (nunca o token de outros).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!token || token.length < 10) return NextResponse.json({ error: 'invalid_token' }, { status: 400 })

  const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data } = await svc
    .from('membros_equipe')
    .select('email, role, nome, status, expires_at')
    .eq('token', token)
    .maybeSingle()

  if (!data) return NextResponse.json({ error: 'invalid_token' }, { status: 404 })
  return NextResponse.json({ convite: data })
}
