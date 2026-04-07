import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' })

// Service role para webhook (bypassa RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook error: ${err.message}` }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const empresa_id = session.metadata?.empresa_id
    const plano = session.metadata?.plano

    if (empresa_id && plano) {
      await supabase.from('empresas').update({
        plano,
        plano_ativo: true,
        stripe_subscription_id: session.subscription as string,
      }).eq('id', empresa_id)
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription
    const empresa_id = sub.metadata?.empresa_id
    if (empresa_id) {
      await supabase.from('empresas').update({ plano_ativo: false }).eq('id', empresa_id)
    }
  }

  return NextResponse.json({ received: true })
}
