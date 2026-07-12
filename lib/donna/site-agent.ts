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

type CanalAtendimento = 'site' | 'telegram'

const ORIGEM_LABEL: Record<CanalAtendimento, string> = { site: 'do seu site', telegram: 'do Telegram' }

// Fase 6 — preenchimento automático do Pipeline: sinal de intenção de
// compra na conversa cria o card em Prospect (temperatura sugerida pela
// heurística; "quente" quando há urgência). Fire-and-forget: qualquer erro
// aqui não pode derrubar o atendimento.
const INTENCAO_COMPRA = /\b(or[çc]amento|proposta|pre[çc]o|quanto custa|valor d[oa]|contratar|comprar|fechar neg[óo]cio|desconto|plano|assinar)\b/i
const URGENCIA = /\b(urgente|hoje|agora|amanh[ãa]|essa semana|o quanto antes|r[áa]pido)\b/i

async function detectarIntencaoCompra(
  supabase: SupabaseClient, empresaId: string, conversaId: string, mensagem: string, canal: CanalAtendimento,
): Promise<void> {
  try {
    if (!INTENCAO_COMPRA.test(mensagem)) return
    const { data: conversa } = await supabase.from('atendimento_conversas').select('visitante_nome, visitante_email').eq('id', conversaId).maybeSingle()
    const nome = (conversa?.visitante_nome as string | null)?.trim()
    if (!nome) return // sem nome não dá pra criar card útil
    const { garantirCardPipeline } = await import('@/lib/crm/pipeline-auto')
    const { criado } = await garantirCardPipeline(supabase, {
      empresaId,
      titulo: nome,
      contato: nome,
      temperatura: URGENCIA.test(mensagem) ? 'quente' : 'morno',
      origem: 'ia',
      detalheOrigem: `IA detectou intenção de compra numa conversa ${ORIGEM_LABEL[canal]}: "${mensagem.slice(0, 100)}"`,
    })
    if (criado) {
      await registrarAcaoAgente(supabase, empresaId, 'donna', 'Criou um card no Pipeline a partir de uma conversa', { detalhe: `${nome} — intenção de compra detectada` })
    }
  } catch { /* nunca derruba o atendimento */ }
}

export async function processarMensagemVisitante(
  supabase: SupabaseClient,
  empresaId: string,
  conversaId: string,
  mensagemVisitante: string,
  regras: Regra[],
  canal: CanalAtendimento = 'site',
  entregar?: (texto: string) => Promise<void>
): Promise<void> {
  const regra = encontrarRegra(regras, canal === 'telegram' ? 'telegram' : 'site', mensagemVisitante)
  const autonomia = regra?.autonomia ?? 'rascunho'
  const { contexto, agendaToken } = await montarContextoNegocio(supabase, empresaId)

  // não-bloqueante: alimenta o Pipeline se houver sinal de compra
  void detectarIntencaoCompra(supabase, empresaId, conversaId, mensagemVisitante, canal)

  const system = `Você é a Donna, atendente virtual deste negócio, respondendo contatos ${ORIGEM_LABEL[canal]}.
CONTEXTO DO NEGÓCIO:
${contexto}
Responda em português, de forma simpática, curta e direta. Se não souber responder com confiança, ou o pedido for sensível/complexo (reclamação, cancelamento, negociação), use transferir_humano em vez de inventar uma resposta.`

  const decisao = await decidirAcao({ system, mensagem: mensagemVisitante, tools: TOOLS_SITE })

  if (!decisao || decisao.tool === 'transferir_humano') {
    const motivo = String(decisao?.input.motivo ?? '').trim() || 'Pedido sensível ou fora do escopo automático — a IA preferiu não arriscar uma resposta'
    const aviso = 'Já chamei alguém do time pra te ajudar com isso — só um instante!'
    await supabase.from('atendimento_conversas').update({ status: 'aguardando_humano', motivo, updated_at: new Date().toISOString() }).eq('id', conversaId).eq('empresa_id', empresaId)
    await supabase.from('atendimento_mensagens').insert({ conversa_id: conversaId, empresa_id: empresaId, autor: 'donna', texto: aviso, pendente_aprovacao: false })
    await supabase.from('notificacoes').insert({ empresa_id: empresaId, titulo: 'Atendimento aguardando você', mensagem: `Um contato ${ORIGEM_LABEL[canal]} precisa de uma resposta que a Donna não conseguiu dar sozinha.`, tipo: 'aviso', modulo: 'donna', link: '/dashboard/agentes/conversas', lida: false })
    await registrarAcaoAgente(supabase, empresaId, 'donna', `Transferiu uma conversa ${ORIGEM_LABEL[canal]} pra você`, { detalhe: motivo })
    if (entregar) await entregar(aviso)
    return
  }

  let texto = String(decisao.input.texto ?? '').trim()
  if (decisao.input.incluir_link_agendamento && agendaToken) texto += `\n\n${appUrl()}/agendar/${agendaToken}`
  if (!texto) return

  if (autonomia === 'automatico') {
    await supabase.from('atendimento_mensagens').insert({ conversa_id: conversaId, empresa_id: empresaId, autor: 'donna', texto, pendente_aprovacao: false })
    await registrarAcaoAgente(supabase, empresaId, 'donna', `Respondeu um contato ${ORIGEM_LABEL[canal]}`, { detalhe: texto.slice(0, 140) })
    if (entregar) await entregar(texto)
  } else {
    const motivo = regra
      ? `Regra "${regra.nome ?? regra.criterio}" está em modo rascunho — aguardando sua aprovação`
      : 'Sem regra automática pra esse assunto — resposta preparada aguardando sua aprovação'
    const aviso = 'Só um momento, já te retorno!'
    await supabase.from('atendimento_mensagens').insert({ conversa_id: conversaId, empresa_id: empresaId, autor: 'donna', texto, pendente_aprovacao: true })
    await supabase.from('atendimento_mensagens').insert({ conversa_id: conversaId, empresa_id: empresaId, autor: 'donna', texto: aviso, pendente_aprovacao: false })
    await supabase.from('atendimento_conversas').update({ status: 'aguardando_humano', motivo, updated_at: new Date().toISOString() }).eq('id', conversaId).eq('empresa_id', empresaId)
    await supabase.from('notificacoes').insert({ empresa_id: empresaId, titulo: 'Donna preparou uma resposta de atendimento', mensagem: texto.slice(0, 140), tipo: 'info', modulo: 'donna', link: '/dashboard/agentes/conversas', lida: false })
    await registrarAcaoAgente(supabase, empresaId, 'donna', 'Preparou uma resposta de atendimento pra sua aprovação', { detalhe: texto.slice(0, 140) })
    if (entregar) await entregar(aviso)
  }
}
