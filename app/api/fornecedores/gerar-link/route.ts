import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: usr } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = (usr?.empresa_id as string) || user.id

  const body = await req.json() as { descricao?: string; valor?: number; data_vencimento?: string; categoria?: string }

  const token = crypto.randomUUID()
  const expiresAt = new Date(); expiresAt.setDate(expiresAt.getDate() + 30)

  const { error } = await supabase.from('fornecedor_links').insert({
    empresa_id: empresaId,
    token,
    descricao: body.descricao || null,
    valor_sugerido: body.valor || null,
    data_vencimento_sugerida: body.data_vencimento || null,
    categoria: body.categoria || null,
    expires_at: expiresAt.toISOString(),
    status: 'ativo',
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const baseUrl = req.headers.get('origin') || process.env.NEXTAUTH_URL || 'https://factorone-mvp2.vercel.app'
  return NextResponse.json({ token, url: `${baseUrl}/fornecedor/${token}` })
}
