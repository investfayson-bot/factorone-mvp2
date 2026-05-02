import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'

export async function POST(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json()
  const nome = String(body.nome || '').trim()
  const email = String(body.email || '').trim().toLowerCase()
  const crc = String(body.crc || '').trim() || null
  const telefone = String(body.telefone || '').trim() || null

  if (!nome) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
  if (!email) return NextResponse.json({ error: 'Email é obrigatório' }, { status: 400 })

  const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = (u?.empresa_id as string) || user.id

  const { data, error } = await supabase
    .from('contadores')
    .insert({
      empresa_id: empresaId,
      nome,
      email,
      crc,
      telefone,
      status: 'convidado',
    })
    .select('id,token_acesso')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const accessUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/contador/${data.token_acesso}`
  return NextResponse.json({ success: true, contador_id: data.id, access_url: accessUrl })
}

