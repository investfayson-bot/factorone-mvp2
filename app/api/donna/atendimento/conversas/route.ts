import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'

export async function GET(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = (u?.empresa_id as string) || user.id
  const { data, error } = await supabase
    .from('atendimento_conversas')
    .select('id,visitante_nome,visitante_email,status,motivo,canal,canal_identificador,created_at,updated_at')
    .eq('empresa_id', empresaId)
    .order('updated_at', { ascending: false })
    .limit(100)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ conversas: data ?? [] })
}
