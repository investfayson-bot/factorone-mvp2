import { NextResponse } from 'next/server'
import { marketingStatus } from '@/lib/marketing'

export const runtime = 'nodejs'

/** GET: quais canais de ads/ecommerce estão conectados. */
export async function GET() {
  return NextResponse.json(marketingStatus())
}
