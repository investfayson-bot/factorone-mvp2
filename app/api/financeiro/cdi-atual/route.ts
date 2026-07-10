import { NextResponse } from 'next/server'
export async function GET() {
  return NextResponse.json({ cdi: 10.5, data: '2026-04-08' })
}
