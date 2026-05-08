import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

// Webhook público: GPS device/app envia lat/lng para atualizar rota em tempo real
// Header: x-api-key = LOGISTICA_GPS_SECRET (env var)
// Body: { rota_id, lat, lng, status? }
export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key')
  if (apiKey !== process.env.LOGISTICA_GPS_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json() as { rota_id?: string; lat?: number; lng?: number; status?: string }
  const { rota_id, lat, lng, status } = body

  if (!rota_id || lat == null || lng == null) {
    return NextResponse.json({ error: 'rota_id, lat e lng são obrigatórios' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const update: Record<string, unknown> = { lat_atual: lat, lng_atual: lng }
  if (status) update.status = status

  const { error } = await supabase
    .from('logistica_rotas')
    .update(update)
    .eq('id', rota_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
