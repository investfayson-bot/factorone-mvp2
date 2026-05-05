import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    resend: Boolean(process.env.RESEND_API_KEY),
    stripe: Boolean(process.env.STRIPE_SECRET_KEY),
    nfeio: Boolean(process.env.NFEIO_API_KEY),
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    supabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    openrouter: Boolean(process.env.OPENROUTER_API_KEY),
  })
}
