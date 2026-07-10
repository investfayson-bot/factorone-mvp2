import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { erroDesconhecido } from '@/lib/transacao-types'
import { bloquearSeLeitura } from '@/lib/supabase-route'

export async function POST(req: NextRequest) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: 'STRIPE_SECRET_KEY não configurada' }, { status: 500 })
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-03-25.dahlia' })
    const { priceId, plano, email } = await req.json()

    if (!priceId) return NextResponse.json({ error: 'priceId obrigatório' }, { status: 400 })

    // Autenticar via Authorization header (funciona no server com anon key)
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}
    )

    const { data: { user } } = await supabase.auth.getUser()

    // Supabase admin para operações privilegiadas
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    let customerId: string | undefined
    let empresaId: string | undefined
    let customerEmail = email || user?.email || ''

    if (user) {
      const bloqueio = await bloquearSeLeitura(supabase, user.id)
      if (bloqueio) return NextResponse.json({ error: `Papel ${bloqueio} é somente leitura` }, { status: 403 })

      const { data: usuario } = await admin.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
      empresaId = usuario?.empresa_id || user.id

      const { data: empresa } = await admin.from('empresas').select('stripe_customer_id,nome').eq('id', empresaId).maybeSingle()
      customerId = empresa?.stripe_customer_id

      if (!customerId) {
        const customer = await stripe.customers.create({
          email: customerEmail,
          name: empresa?.nome || customerEmail,
          metadata: { empresa_id: empresaId, supabase_user_id: user.id },
        })
        customerId = customer.id
        await admin.from('empresas').update({ stripe_customer_id: customerId }).eq('id', empresaId)
      }
    }

    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'https://factorone-mvp2.vercel.app'

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${origin}/dashboard?sucesso=true&plano=${encodeURIComponent(plano || '')}`,
      cancel_url: `${origin}/precos`,
      locale: 'pt-BR',
      allow_promotion_codes: true,
    }

    if (customerId) {
      sessionParams.customer = customerId
    } else {
      sessionParams.customer_email = customerEmail || undefined
    }

    if (empresaId || plano) {
      sessionParams.metadata = { empresa_id: empresaId || '', plano: plano || '' }
      sessionParams.subscription_data = { metadata: { empresa_id: empresaId || '', plano: plano || '' } }
    }

    const session = await stripe.checkout.sessions.create(sessionParams)
    return NextResponse.json({ url: session.url })

  } catch (err: unknown) {
    console.error('Stripe checkout error:', err)
    return NextResponse.json({ error: erroDesconhecido(err) }, { status: 500 })
  }
}
