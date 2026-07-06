import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Gera um código curto (10 min) para o usuário vincular o chat_id do Telegram
// mandando esse código pro bot. Evita vincular conta só por e-mail "no chute".
export async function POST(req: NextRequest) {
  const { user } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const codigo = String(Math.floor(100000 + Math.random() * 900000))
  const exp = new Date(Date.now() + 10 * 60 * 1000).toISOString()

  const { error } = await db()
    .from('usuarios')
    .update({ telegram_link_code: codigo, telegram_link_code_exp: exp })
    .eq('id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    codigo,
    expira_em: exp,
    bot: process.env.TELEGRAM_BOT_USERNAME || null,
  })
}
