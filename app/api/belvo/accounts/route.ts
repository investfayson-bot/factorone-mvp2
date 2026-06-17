import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'
import { belvoFetch } from '@/lib/belvo'

type BelvoAccount = {
  id: string
  name?: string
  number?: string
  category?: string
  type?: string
  currency?: string
  institution?: { name?: string; type?: string }
  balance?: { current?: number; available?: number }
}

function mapConta(a: BelvoAccount) {
  return {
    id: a.id,
    nome: a.name ?? null,
    numero: a.number ?? null,
    categoria: a.category ?? null,
    tipo: a.type ?? null,
    saldo: a.balance?.current ?? null,
    disponivel: a.balance?.available ?? null,
    moeda: a.currency ?? null,
    instituicao: a.institution?.name ?? null,
  }
}

/**
 * POST: dado um `link` do widget, busca as contas na Belvo, salva o link
 * (belvo_links, RLS por empresa/usuário) e devolve as contas normalizadas.
 */
export async function POST(req: NextRequest) {
  try {
    const { user, supabase } = await getSupabaseUser(req)
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { link, institution } = (await req.json()) as { link?: string; institution?: string }
    if (!link) return NextResponse.json({ error: 'link obrigatório' }, { status: 400 })

    const accounts = await belvoFetch<BelvoAccount[]>('/api/accounts/', {
      method: 'POST',
      body: JSON.stringify({ link }),
    })

    const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const empresaId = (u?.empresa_id as string) || null
    const inst = accounts[0]?.institution?.name || institution || null

    await supabase.from('belvo_links').upsert(
      { link_id: link, empresa_id: empresaId, user_id: user.id, institution: inst },
      { onConflict: 'link_id' }
    )

    return NextResponse.json({ contas: accounts.map(mapConta) })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro Belvo' }, { status: 500 })
  }
}

/** GET: lista os links bancários salvos do usuário/empresa (RLS aplica o escopo). */
export async function GET(req: NextRequest) {
  try {
    const { user, supabase } = await getSupabaseUser(req)
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data } = await supabase
      .from('belvo_links')
      .select('id, link_id, institution, created_at')
      .order('created_at', { ascending: false })

    return NextResponse.json({ links: data ?? [] })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}
