import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'
import type { User } from '@supabase/supabase-js'

export async function getSupabaseUser(
  req: NextRequest
): Promise<{ user: User | null; supabase: SupabaseClient }> {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')?.trim()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabase = createClient(url, anon, {
    global: { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  })
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { user, supabase }
}

// Papéis que são LEITURA-APENAS: não podem mutar dados sensíveis da empresa.
// 'contador' e 'viewer' entram pra ver/exportar, nunca pra escrever.
const PAPEIS_SO_LEITURA = new Set(['contador', 'viewer'])

/**
 * Papel do usuário na empresa ATIVA dele (usuarios.empresa_id), lido da fonte
 * autoritativa usuario_empresas por user_id. Sem membership (login legado, dono
 * do próprio workspace) → 'admin'. Um contador que trocou pra uma empresa-cliente
 * retorna 'contador' aqui, mesmo sendo membership legítima.
 */
export async function getPapelAtivo(supabase: SupabaseClient, userId: string): Promise<string> {
  const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', userId).maybeSingle()
  const eid = (u?.empresa_id as string) ?? userId
  const { data: m } = await supabase.from('usuario_empresas').select('papel').eq('user_id', userId).eq('empresa_id', eid).maybeSingle()
  return (m?.papel as string) || 'admin'
}

/** true se o papel pode ESCREVER (mutar) dados sensíveis da empresa. */
export function papelPodeEscrever(papel: string): boolean {
  return !PAPEIS_SO_LEITURA.has(papel)
}

/**
 * Guard pra rotas de ESCRITA: retorna null se pode escrever, ou o papel bloqueado
 * (string) se for leitura-apenas. Uso:
 *   const bloqueio = await bloquearSeLeitura(supabase, user.id)
 *   if (bloqueio) return NextResponse.json({ error: `Papel ${bloqueio} é somente leitura` }, { status: 403 })
 */
export async function bloquearSeLeitura(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const papel = await getPapelAtivo(supabase, userId)
  return papelPodeEscrever(papel) ? null : papel
}
