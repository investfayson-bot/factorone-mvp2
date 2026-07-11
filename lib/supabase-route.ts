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
 * Papel do usuário numa empresa ESPECÍFICA, lido da fonte autoritativa
 * usuario_empresas por (user_id, empresa_id). Sem membership pra essa empresa
 * (login legado dono do próprio workspace, ou dono de Holding acessando uma
 * empresa do grupo sem linha própria em usuario_empresas) → 'admin'.
 */
export async function getPapelParaEmpresa(supabase: SupabaseClient, userId: string, empresaId: string): Promise<string> {
  const { data: m } = await supabase.from('usuario_empresas').select('papel').eq('user_id', userId).eq('empresa_id', empresaId).maybeSingle()
  return (m?.papel as string) || 'admin'
}

/**
 * Papel do usuário na empresa ATIVA dele (usuarios.empresa_id). Um contador
 * que trocou pra uma empresa-cliente retorna 'contador' aqui, mesmo sendo
 * membership legítima. Pra checar papel numa empresa que NÃO é a ativa
 * (ex.: outra empresa do mesmo grupo/Holding), use getPapelParaEmpresa.
 */
export async function getPapelAtivo(supabase: SupabaseClient, userId: string): Promise<string> {
  const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', userId).maybeSingle()
  const eid = (u?.empresa_id as string) ?? userId
  return getPapelParaEmpresa(supabase, userId, eid)
}

/**
 * true se `empresaId` é a própria empresa ativa do usuário OU pertence a um
 * grupo (Holding) do qual ele é dono (`grupos_empresariais.owner_user_id`).
 * Use pra validar uma empresa ALVO explícita (ex.: vinda do body de uma rota)
 * antes de gravar algo nela — sem isso, rotas que assumem "empresa ativa ==
 * empresa alvo" gravam no tenant errado quando chamadas a partir de uma
 * visão consolidada/multi-empresa (Fase 5, achado do rls-tenant-guardian).
 */
export async function empresaPertenceAoUsuario(supabase: SupabaseClient, userId: string, empresaId: string): Promise<boolean> {
  const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', userId).maybeSingle()
  const propria = (u?.empresa_id as string) ?? userId
  if (empresaId === propria) return true
  const { data: grupos } = await supabase.from('grupos_empresariais').select('id').eq('owner_user_id', userId)
  const grupoIds = (grupos ?? []).map(g => g.id as string)
  if (grupoIds.length === 0) return false
  const { data: membro } = await supabase.from('grupo_membros').select('empresa_id').in('grupo_id', grupoIds).eq('empresa_id', empresaId).maybeSingle()
  return !!membro
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
