import type { SupabaseClient } from '@supabase/supabase-js'

// Squad de agentes nomeados do FactorOne (visível em /dashboard/agentes).
// Cada agente tem um pedaço real do produto — o log em `agentes_acoes` é
// alimentado pelos próprios endpoints de IA quando eles agem de verdade.
export type AgenteInfo = { id: string; nome: string; papel: string; cor: string; inicial: string; modulo: string; href: string }

export const AGENTES_DASHBOARD: AgenteInfo[] = [
  { id: 'donna', nome: 'Donna', papel: 'E-mail, atendimento do site e Telegram', cor: '#DB2777', inicial: 'DO', modulo: 'Donna', href: '/dashboard/agentes/donna' },
  { id: 'louis', nome: 'Louis', papel: 'Classificação financeira e conciliação', cor: '#2563EB', inicial: 'LO', modulo: 'Financeiro', href: '/dashboard/classificar' },
  { id: 'rachel', nome: 'Rachel', papel: 'Marketing, conteúdo e campanhas', cor: '#D97706', inicial: 'RA', modulo: 'Marketing', href: '/dashboard/marketing' },
  { id: 'samantha', nome: 'Samantha', papel: 'Qualificação de leads e CRM', cor: '#0D9488', inicial: 'SA', modulo: 'CRM', href: '/dashboard/crm' },
  { id: 'mike', nome: 'Mike', papel: 'Contratos e jurídico', cor: '#7C3AED', inicial: 'MI', modulo: 'Jurídico', href: '/dashboard/juridico' },
]

export async function registrarAcaoAgente(
  supabase: SupabaseClient,
  empresaId: string,
  agenteId: string,
  acao: string,
  opts?: { detalhe?: string; custoUsd?: number }
) {
  const agente = AGENTES_DASHBOARD.find((a) => a.id === agenteId)
  try {
    await supabase.from('agentes_acoes').insert({
      empresa_id: empresaId,
      agente_id: agenteId,
      agente_nome: agente?.nome ?? agenteId,
      acao,
      detalhe: opts?.detalhe ?? null,
      custo_usd: opts?.custoUsd ?? 0,
    })
  } catch {
    // log é best-effort — nunca deve quebrar o fluxo principal
  }
}
