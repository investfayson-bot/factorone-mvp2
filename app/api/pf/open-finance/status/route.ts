import { NextResponse } from 'next/server'

export async function GET() {
  const configurado = !!(process.env.PLUGGY_CLIENT_ID && process.env.PLUGGY_CLIENT_SECRET)
  return NextResponse.json({ configurado })
}
