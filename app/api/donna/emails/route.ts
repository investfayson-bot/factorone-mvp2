import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'

export async function GET(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = (u?.empresa_id as string) || user.id
  const status = req.nextUrl.searchParams.get('status')
  let q = supabase.from('donna_emails_processados').select('id,gmail_message_id,remetente,assunto,snippet,acao,autonomia_aplicada,corpo_resposta,status,created_at').eq('empresa_id', empresaId).order('created_at', { ascending: false }).limit(100)
  if (status) q = q.eq('status', status)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ emails: data ?? [] })
}
