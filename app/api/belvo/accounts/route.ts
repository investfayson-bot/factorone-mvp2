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
  credit_data?: { credit_limit?: number } & Record<string, unknown>
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
    limite_credito: a.credit_data?.credit_limit ?? null,
    moeda: a.currency ?? null,
    instituicao: a.institution?.name ?? null,
  }
}

/**
 * POST: dado um `link`, busca contas na Belvo, salva o link + as contas
 * (belvo_links / belvo_contas, RLS empresa/usuário) e devolve normalizadas.
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

    if (accounts.length) {
      await supabase.from('belvo_contas').upsert(
        accounts.map(a => ({
          belvo_id: a.id,
          link_id: link,
          empresa_id: empresaId,
          user_id: user.id,
          nome: a.name ?? null,
          numero: a.number ?? null,
          categoria: a.category ?? null,
          tipo: a.type ?? null,
          instituicao: a.institution?.name ?? inst,
          saldo: a.balance?.current ?? null,
          disponivel: a.balance?.available ?? null,
          limite_credito: a.credit_data?.credit_limit ?? null,
          credit_data: a.credit_data ?? null,
          moeda: a.currency ?? null,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: 'belvo_id' }
      )
    }

    return NextResponse.json({ contas: accounts.map(mapConta) })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro Belvo' }, { status: 500 })
  }
}

/** GET: links bancários + contas já importadas (RLS aplica o escopo). */
export async function GET(req: NextRequest) {
  try {
    const { user, supabase } = await getSupabaseUser(req)
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const [{ data: links }, { data: contas }] = await Promise.all([
      supabase.from('belvo_links').select('id, link_id, institution, created_at').order('created_at', { ascending: false }),
      supabase.from('belvo_contas').select('belvo_id, nome, numero, categoria, tipo, saldo, disponivel, limite_credito, moeda, instituicao').order('created_at', { ascending: false }),
    ])

    const contasOut = (contas ?? []).map(c => ({
      id: c.belvo_id, nome: c.nome, numero: c.numero, categoria: c.categoria, tipo: c.tipo,
      saldo: c.saldo, disponivel: c.disponivel, limite_credito: c.limite_credito, moeda: c.moeda, instituicao: c.instituicao,
    }))

    return NextResponse.json({ links: links ?? [], contas: contasOut })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}
