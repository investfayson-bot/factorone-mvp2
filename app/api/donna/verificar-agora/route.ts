import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'
import { processarInboxEmpresa } from '@/lib/donna/processar-email'

export async function POST(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = (u?.empresa_id as string) || user.id
  const resultado = await processarInboxEmpresa(empresaId)
  if (resultado.erro) return NextResponse.json({ error: resultado.erro }, { status: 400 })
  return NextResponse.json(resultado)
}
