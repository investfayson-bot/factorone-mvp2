import { NextResponse } from 'next/server'
import { nfseStatus } from '@/lib/nfse'

export const runtime = 'nodejs'

/** GET: estado da integração de NFS-e (agregador de prefeituras). */
export async function GET() {
  return NextResponse.json(nfseStatus())
}
