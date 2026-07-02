import { NextResponse } from 'next/server'
import { baasStatus } from '@/lib/baas'

export const runtime = 'nodejs'

/** GET: estado da BaaS (ativo/configurado/provider) — usado pela UI. */
export async function GET() {
  return NextResponse.json(baasStatus())
}
