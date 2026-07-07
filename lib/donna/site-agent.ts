import type { SupabaseClient } from '@supabase/supabase-js'
import { registrarAcaoAgente } from '@/lib/agentes-log'
import { decidirAcao, type ToolDef } from './agente-core'
import { encontrarRegra, type Regra } from './regras'

const TOOLS_SITE: ToolDef[] = [
  { name: 'responder_visitante', description: 'Responde a pergunta do visitante agora.', input_schema: { type: 'object', properties: { texto: { type: 'string' }, incluir_link_agendamento: { type: 'boolean', description: 'true se fizer sentido oferecer o link de agendamento' } }, required: ['texto'] } },
  { name: 'transferir_humano', description: 'Transfere pra um humano do time responder — use quando não souber responder com confiança ou o pedido for sensível/complexo.', input_schema: { type: 'object', properties: { motivo: { type: 'string' } } } },
]

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://factorone-mvp2.vercel.app'
}

async function montarContextoNegocio(supabase: SupabaseClient, empresaId: string): Promise<{ contexto: string; agendaToken: string | null }> {
  const [siteRes, produtosRes, agendaRes] = await Promise.all([
    supabase.from('sites').select('nome,sobre,servicos,ramo').eq('empresa_id', empresaId).maybeSingle(),
    supabase.from('produtos').select('nome,preco,unidade').eq('empresa_id', empresaId).eq('ativo', true).limit(20),
    supabase.from('agenda_config').select('token').eq('empresa_id', empresaId).maybeSingle(),
  ])
  const site = siteRes.data as { nome: string | null; sobre: string | null; servicos: string[] | null; ramo: string | null } | null
  const produtos = (produtosRes.data ?? []) as { nome: string; preco: number; unidade: string }[]
  const partes = [
    site?.nome ? `Negócio: ${site.nome}${site.ramo ? ` (${site.ramo})` : ''}.` : null,
    site?.sobre ? `Sobre: ${site.sobre}` : null,
    site?.servicos?.length ? `Serviços: ${site.servicos.join(', ')}.` : null,
    produtos.length ? `Produtos/preços: ${produtos.map(p => `${p.nome} — R$ ${Number(p.preco).toFixed(2)}/${p.unidade}`).join('; ')}.` : null,
  ].filter(Boolean)
  return { contexto: partes.join('\n') || 'Sem informações detalhadas cadastradas ainda.', agendaToken: (agendaRes.data?.token as string) ?? null }
}

export async function processarMensagemVisitante(
  supabase: SupabaseClient,
  empresaId: string,
  conversaId: string,
  mensagemVisitante: string,
  regras: Regra[]
): Promise<void> {
  const regra = encontrarRegra(regras, 'site', mensagemVisitante)
  const autonomia = regra?.autonomia ?? 'rascunho'
  const { contexto, agendaToken } = await montarContextoNegocio(supabase, empresaId)

  const system = `Você é a Donna, atendente virtual deste negócio, respondendo visitantes do site.
CONTEXTO DO NEGÓCIO:
${contexto}
Responda em português, de forma simpática, curta e direta. Se não souber responder com confiança, ou o pedido for sensível/complexo (reclamação, cancelamento, negociação), use transferir_humano em vez de inventar uma resposta.`

  const decisao = await decidirAcao({ system, mensagem: mensagemVisitante, tools: TOOLS_SITE })

  if (!decisao || decisao.tool === 'transferir_humano') {
    await supabase.from('atendimento_conversas').update({ status: 'aguardando_humano', updated_at: new Date().toISOString() }).eq('id', conversaId)
    await supabase.from('atendimento_mensagens').insert({ conversa_id: conversaId, empresa_id: empresaId, autor: 'donna', texto: 'Já chamei alguém do time pra te ajudar com isso — só um instante!', pendente_aprovacao: false })
    await supabase.from('notificacoes').insert({ empresa_id: empresaId, titulo: 'Atendimento aguardando você', mensagem: 'Um visitante do seu site precisa de uma resposta que a Donna não conseguiu dar sozinha.', tipo: 'aviso', modulo: 'donna', link: '/dashboard/agentes/donna', lida: false })
    await registrarAcaoAgente(supabase, empresaId, 'donna', 'Transferiu uma conversa do site pra você', { detalhe: String(decisao?.input.motivo ?? '') })
    return
  }

  let texto = String(decisao.input.texto ?? '').trim()
  if (decisao.input.incluir_link_agendamento && agendaToken) texto += `\n\n${appUrl()}/agendar/${agendaToken}`
  if (!texto) return

  if (autonomia === 'automatico') {
    await supabase.from('atendimento_mensagens').insert({ conversa_id: conversaId, empresa_id: empresaId, autor: 'donna', texto, pendente_aprovacao: false })
    await registrarAcaoAgente(supabase, empresaId, 'donna', 'Respondeu um visitante no chat do site', { detalhe: texto.slice(0, 140) })
  } else {
    await supabase.from('atendimento_mensagens').insert({ conversa_id: conversaId, empresa_id: empresaId, autor: 'donna', texto, pendente_aprovacao: true })
    await supabase.from('atendimento_mensagens').insert({ conversa_id: conversaId, empresa_id: empresaId, autor: 'donna', texto: 'Só um momento, já te retorno!', pendente_aprovacao: false })
    await supabase.from('atendimento_conversas').update({ status: 'aguardando_humano', updated_at: new Date().toISOString() }).eq('id', conversaId)
    await supabase.from('notificacoes').insert({ empresa_id: empresaId, titulo: 'Donna preparou uma resposta de atendimento', mensagem: texto.slice(0, 140), tipo: 'info', modulo: 'donna', link: '/dashboard/agentes/donna', lida: false })
    await registrarAcaoAgente(supabase, empresaId, 'donna', 'Preparou uma resposta de atendimento pra sua aprovação', { detalhe: texto.slice(0, 140) })
  }
}
