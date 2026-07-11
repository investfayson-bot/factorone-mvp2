import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'

export async function GET(req: NextRequest) {
  const status: Record<string, boolean> = {
    resend: Boolean(process.env.RESEND_API_KEY),
    stripe: Boolean(process.env.STRIPE_SECRET_KEY),
    nfeio: Boolean(process.env.NFEIO_API_KEY),
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    supabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    openrouter: Boolean(process.env.OPENROUTER_API_KEY),
    whatsapp: Boolean(process.env.WHATSAPP_TOKEN),
    telegram: Boolean(process.env.TELEGRAM_BOT_TOKEN),
  }

  // google_donna é estado por empresa (não env var) — só dá pra saber com usuário autenticado.
  const { user, supabase } = await getSupabaseUser(req)
  if (user) {
    const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const empresaId = (u?.empresa_id as string) || user.id
    const { data: conta } = await supabase.from('google_contas').select('empresa_id').eq('empresa_id', empresaId).maybeSingle()
    status.google_donna = Boolean(conta)
  }

  return NextResponse.json({ ...status, telegramBotUsername: process.env.TELEGRAM_BOT_USERNAME || null })
}
