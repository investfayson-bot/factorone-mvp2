import type { SupabaseClient } from '@supabase/supabase-js'

// Unifica `investimentos` (PJ, schema fechado com enum de tipo) e
// `investimentos_pf` (PF, texto livre) numa única lista normalizada — a UI
// (Banco › Investimentos) nunca lê essas tabelas diretamente, só isto.
// TODO(dívida técnica): migrar pra uma tabela única `investimentos` com
// `titularidade` (pj/pf) quando o schema de PF estabilizar; hoje os dois
// schemas divergem demais (nomes de campo e vocabulário de `tipo`) pra valer
// a pena migrar dado real agora.

export type ClassePosicao = 'renda_fixa' | 'acoes_fiis' | 'fundos' | 'outros'

export type Posicao = {
  id: string
  nome: string
  classe: ClassePosicao
  origem: 'pj' | 'pf'
  origem_label: string // "Open Finance · Banco X" ou "Manual"
  instituicao: string | null
  titularidade_label: string // "Conta PJ · Nome da empresa" ou "Conta PF"
  valor_aplicado: number
  valor_atual: number
  rentabilidade_pct: number
  data_vencimento: string | null
}

const CLASSE_LABEL: Record<ClassePosicao, string> = {
  renda_fixa: 'Renda Fixa',
  acoes_fiis: 'Ações & FIIs',
  fundos: 'Fundos multimercado',
  outros: 'Outros',
}
export { CLASSE_LABEL }

function classificarPj(tipo: string): ClassePosicao {
  if (['cdi', 'cdb', 'lci', 'lca', 'tesouro_direto'].includes(tipo)) return 'renda_fixa'
  if (tipo === 'acoes') return 'acoes_fiis'
  if (tipo === 'fundos') return 'fundos'
  return 'outros'
}

function classificarPf(tipo: string): ClassePosicao {
  const t = (tipo || '').toLowerCase()
  if (['cdb', 'poupança', 'poupanca', 'tesouro direto'].includes(t)) return 'renda_fixa'
  if (['ações', 'acoes', 'fiis'].includes(t)) return 'acoes_fiis'
  return 'outros'
}

function rentabilidadePct(aplicado: number, atual: number): number {
  if (!aplicado) return 0
  return ((atual - aplicado) / aplicado) * 100
}

export async function buscarPosicoesConsolidadas(
  db: SupabaseClient,
  opts: { empresaIds: string[]; empresaNomes: Map<string, string>; incluiPf: boolean; userId: string }
): Promise<Posicao[]> {
  const { empresaIds, empresaNomes, incluiPf, userId } = opts
  const posicoes: Posicao[] = []

  if (empresaIds.length) {
    const { data } = await db
      .from('investimentos')
      .select('id, nome, tipo, valor_aplicado, valor_atual, empresa_id, data_vencimento, conta_id, contas_bancarias(banco_nome)')
      .in('empresa_id', empresaIds)
      .eq('status', 'ativo')
    for (const row of (data ?? []) as Record<string, unknown>[]) {
      const contaRel = row.contas_bancarias as { banco_nome?: string } | { banco_nome?: string }[] | null
      const banco = Array.isArray(contaRel) ? contaRel[0]?.banco_nome : contaRel?.banco_nome
      const aplicado = Number(row.valor_aplicado || 0)
      const atual = Number(row.valor_atual || 0)
      posicoes.push({
        id: row.id as string,
        nome: row.nome as string,
        classe: classificarPj(row.tipo as string),
        origem: 'pj',
        // `investimentos`/`investimentos_pf` só são preenchidas por cadastro manual hoje
        // (nenhum sync da Belvo escreve nelas) — rotular como "Open Finance" seria
        // inventar proveniência que não existe, mesmo quando dá pra achar o banco via join.
        origem_label: banco ? `Manual · ${banco}` : 'Manual',
        instituicao: banco ?? null,
        titularidade_label: `Conta PJ · ${empresaNomes.get(row.empresa_id as string) ?? ''}`,
        valor_aplicado: aplicado,
        valor_atual: atual,
        rentabilidade_pct: rentabilidadePct(aplicado, atual),
        data_vencimento: (row.data_vencimento as string) ?? null,
      })
    }
  }

  if (incluiPf) {
    const { data } = await db
      .from('investimentos_pf')
      .select('id, nome, tipo, instituicao, valor_aplicado, valor_atual, vencimento')
      .eq('user_id', userId)
    for (const row of (data ?? []) as Record<string, unknown>[]) {
      const aplicado = Number(row.valor_aplicado || 0)
      const atual = Number(row.valor_atual || 0)
      posicoes.push({
        id: row.id as string,
        nome: row.nome as string,
        classe: classificarPf(row.tipo as string),
        origem: 'pf',
        origem_label: row.instituicao ? `Manual · ${row.instituicao}` : 'Manual',
        instituicao: (row.instituicao as string) ?? null,
        titularidade_label: 'Conta PF',
        valor_aplicado: aplicado,
        valor_atual: atual,
        rentabilidade_pct: rentabilidadePct(aplicado, atual),
        data_vencimento: (row.vencimento as string) ?? null,
      })
    }
  }

  return posicoes.sort((a, b) => b.valor_atual - a.valor_atual)
}
