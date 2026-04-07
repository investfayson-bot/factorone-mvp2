import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServerSupabase } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: 'STRIPE_SECRET_KEY não configurada no servidor' }, { status: 500 })
    }
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-03-25.dahlia' })

    const { priceId, plano } = await req.json()
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    // Busca ou cria customer no Stripe
    const { data: usuario } = await supabase
      .from('usuarios').select('empresa_id').eq('id', user.id).single()

    const { data: empresa } = await supabase
      .from('empresas').select('*').eq('id', usuario?.empresa_id).single()

    let customerId = empresa?.stripe_customer_id
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: empresa?.nome,
        metadata: { empresa_id: empresa?.id, supabase_user_id: user.id },
      })
      customerId = customer.id
      await supabase.from('empresas')
        .update({ stripe_customer_id: customerId })
        .eq('id', empresa?.id)
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?sucesso=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/onboarding`,
      metadata: { empresa_id: empresa?.id, plano },
      subscription_data: { metadata: { empresa_id: empresa?.id, plano } },
      locale: 'pt-BR',
      allow_promotion_codes: true,
    })

    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    console.error('Stripe error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
