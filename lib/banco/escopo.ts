import type { SupabaseClient } from '@supabase/supabase-js'

export type EscopoBanco = 'consolidado' | 'empresas' | 'pf'

export type EscopoResolvido = {
  empresaIds: string[]
  empresaNomes: Map<string, string>
  incluiPf: boolean
}

/**
 * Resolve o escopo PJ/PF do seletor Holding (Fase 0) pro módulo Banco.
 * Com `grupoId`: soma os membros do grupo (empresas + PF, se houver).
 * Sem grupo (a maioria dos usuários ainda não criou uma Holding): cai pro
 * padrão de empresa única (usuarios.empresa_id ?? auth.uid(), mesmo padrão
 * usado no resto do produto) + PF do próprio usuário, sempre que o escopo
 * pedido permitir.
 */
export async function resolverEscopoBanco(
  db: SupabaseClient,
  userId: string,
  escopo: EscopoBanco,
  grupoId: string | null
): Promise<EscopoResolvido | { erro: string }> {
  const incluiEmpresas = escopo !== 'pf'
  let incluiPf = escopo !== 'empresas'
  const empresaIds: string[] = []
  const empresaNomes = new Map<string, string>()

  if (grupoId) {
    const { data: grupo } = await db.from('grupos_empresariais').select('id').eq('id', grupoId).eq('owner_user_id', userId).maybeSingle()
    if (!grupo) return { erro: 'Grupo não encontrado' }
    const { data: membros } = await db.from('grupo_membros').select('empresa_id, pessoa_fisica_user_id').eq('grupo_id', grupoId)
    if (incluiEmpresas) empresaIds.push(...(membros ?? []).map(m => m.empresa_id).filter((v): v is string => !!v))
    incluiPf = incluiPf && (membros ?? []).some(m => m.pessoa_fisica_user_id)
    if (empresaIds.length) {
      const { data: empresas } = await db.from('empresas').select('id, nome').in('id', empresaIds)
      for (const e of empresas ?? []) empresaNomes.set(e.id as string, e.nome as string)
    }
  } else if (incluiEmpresas) {
    const { data: u } = await db.from('usuarios').select('empresa_id').eq('id', userId).maybeSingle()
    const eid = (u?.empresa_id as string) ?? userId
    empresaIds.push(eid)
    const { data: empresa } = await db.from('empresas').select('id, nome').eq('id', eid).maybeSingle()
    empresaNomes.set(eid, (empresa?.nome as string) ?? 'Minha empresa')
  }

  return { empresaIds, empresaNomes, incluiPf }
}
