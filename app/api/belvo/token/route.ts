import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'
import { belvoFetch } from '@/lib/belvo'

/**
 * Gera o access token do Belvo Connect Widget.
 * Auth-gated: só usuário logado pode pedir (evita abuso/custo).
 */
export async function POST(req: NextRequest) {
  try {
    const { user } = await getSupabaseUser(req)
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const data = await belvoFetch<{ access: string; refresh: string }>('/api/token/', {
      method: 'POST',
      body: JSON.stringify({
        id: process.env.BELVO_SECRET_ID,
        password: process.env.BELVO_SECRET_PASSWORD,
        scopes: 'read_institutions,write_links,read_links',
      }),
    })

    return NextResponse.json({ access: data.access })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro Belvo' }, { status: 500 })
  }
}
