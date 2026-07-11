import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { decifrar } from '@/lib/cofre-crypto'
import { renovarAccessToken } from '@/lib/google-oauth'
import { listarNaoLidas, obterMensagem, enviarResposta, marcarComoLida, arquivar, type MensagemCompleta } from '@/lib/gmail-client'
import { registrarAcaoAgente } from '@/lib/agentes-log'
import { decidirAcao, type ToolDef } from './agente-core'
import { encontrarRegra, type Regra } from './regras'

function db(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

const TOOLS_EMAIL: ToolDef[] = [
  { name: 'responder_email', description: 'Envia uma resposta direta pro remetente agora.', input_schema: { type: 'object', properties: { corpo: { type: 'string' } }, required: ['corpo'] } },
  { name: 'criar_rascunho', description: 'Prepara uma resposta mas não envia — aguarda aprovação humana antes de sair.', input_schema: { type: 'object', properties: { corpo: { type: 'string' } }, required: ['corpo'] } },
  { name: 'arquivar', description: 'Arquiva o e-mail sem responder (spam, promoção, newsletter, notificação automática).', input_schema: { type: 'object', properties: { motivo: { type: 'string' } } } },
  { name: 'ignorar', description: 'Não faz nada com este e-mail agora.', input_schema: { type: 'object', properties: {} } },
]

function descricaoAcao(acao: string, assunto: string): string {
  switch (acao) {
    case 'respondido': return `Respondeu automaticamente o e-mail "${assunto}"`
    case 'rascunho_criado': return `Preparou um rascunho de resposta pro e-mail "${assunto}"`
    case 'arquivado': return `Arquivou o e-mail "${assunto}"`
    default: return `Revisou o e-mail "${assunto}" e não fez nada`
  }
}

async function processarUmEmail(
  supabase: SupabaseClient,
  empresaId: string,
  msg: MensagemCompleta,
  contaEmail: string,
  regras: Regra[],
  accessToken: string
): Promise<void> {
  const regra = encontrarRegra(regras, 'email', `${msg.assunto} ${msg.corpoTexto}`)
  const autonomia = regra?.autonomia ?? 'rascunho'

  const system = `Você é a Donna, assistente de e-mail do negócio conectado em "${contaEmail}". Leia o e-mail e decida: responder direto, criar um rascunho pra aprovação, arquivar (spam/promoção/newsletter/notificação automática) ou ignorar. Respostas em português, educadas, objetivas, sem assinatura (isso é adicionado depois).`
  const mensagem = `De: ${msg.remetente}\nAssunto: ${msg.assunto}\n\n${msg.corpoTexto}`
  const decisao = await decidirAcao({ system, mensagem, tools: TOOLS_EMAIL })

  let acao: 'respondido' | 'rascunho_criado' | 'arquivado' | 'ignorado' = 'ignorado'
  let corpoResposta: string | null = null
  let status: 'concluido' | 'pendente_aprovacao' = 'concluido'

  if (!decisao || decisao.tool === 'ignorar') {
    acao = 'ignorado'
  } else if (decisao.tool === 'arquivar') {
    try { await arquivar(accessToken, msg.id) } catch { /* segue mesmo se falhar */ }
    acao = 'arquivado'
  } else {
    const corpo = String(decisao.input.corpo ?? '').trim()
    corpoResposta = corpo || null
    if (decisao.tool === 'responder_email' && autonomia === 'automatico' && corpo) {
      await enviarResposta(accessToken, { to: msg.remetente, from: contaEmail, subject: msg.assunto, bodyText: corpo, threadId: msg.threadId, messageIdHeader: msg.id })
      try { await marcarComoLida(accessToken, msg.id) } catch { /* não crítico */ }
      acao = 'respondido'
    } else {
      // pedido de envio direto, mas a regra não autoriza automático → rebaixa pra rascunho.
      status = 'pendente_aprovacao'
      acao = 'rascunho_criado'
    }
  }

  await supabase.from('donna_emails_processados').insert({
    empresa_id: empresaId,
    gmail_message_id: msg.id,
    gmail_thread_id: msg.threadId,
    remetente: msg.remetente,
    assunto: msg.assunto,
    snippet: msg.snippet,
    regra_id: regra?.id ?? null,
    autonomia_aplicada: autonomia,
    acao,
    corpo_resposta: corpoResposta,
    status,
  })

  await registrarAcaoAgente(supabase, empresaId, 'donna', descricaoAcao(acao, msg.assunto), { detalhe: msg.remetente })

  if (status === 'pendente_aprovacao') {
    await supabase.from('notificacoes').insert({
      empresa_id: empresaId,
      titulo: 'Donna preparou uma resposta de e-mail',
      mensagem: `De ${msg.remetente}: "${msg.assunto}" — aguardando sua aprovação.`,
      tipo: 'info',
      modulo: 'donna',
      link: '/dashboard/agentes/automacoes?tab=emails',
      lida: false,
    })
  }
}

/**
 * Processa a caixa de entrada de uma empresa — função pura, chamada tanto
 * pela rota "verificar agora" (usuário) quanto pelo cron. Idempotente via o
 * unique(empresa_id, gmail_message_id) em donna_emails_processados.
 */
export async function processarInboxEmpresa(empresaId: string): Promise<{ processados: number; erro?: string }> {
  const supabase = db()

  const { data: conta } = await supabase.from('google_contas').select('email,refresh_token_cifrado').eq('empresa_id', empresaId).eq('ativo', true).maybeSingle()
  if (!conta) return { processados: 0, erro: 'Google não conectado' }

  let accessToken: string
  try {
    const refreshToken = decifrar(conta.refresh_token_cifrado as string)
    const tok = await renovarAccessToken(refreshToken)
    accessToken = tok.access_token
  } catch {
    return { processados: 0, erro: 'Falha ao renovar o acesso ao Google — reconecte em Integrações' }
  }

  const { data: regras } = await supabase.from('donna_regras').select('*').eq('empresa_id', empresaId).eq('ativa', true)

  let resumos: { id: string; threadId: string }[]
  try {
    resumos = await listarNaoLidas(accessToken, 20)
  } catch {
    return { processados: 0, erro: 'Falha ao listar e-mails no Gmail' }
  }

  let processados = 0
  for (const resumo of resumos) {
    try {
      const { data: existente } = await supabase.from('donna_emails_processados').select('id').eq('empresa_id', empresaId).eq('gmail_message_id', resumo.id).maybeSingle()
      if (existente) continue
      const msg = await obterMensagem(accessToken, resumo.id)
      await processarUmEmail(supabase, empresaId, msg, conta.email as string, (regras ?? []) as Regra[], accessToken)
      processados++
    } catch {
      // um e-mail com problema não deve travar os demais
    }
  }

  await supabase.from('google_contas').update({ ultima_sincronizacao: new Date().toISOString() }).eq('empresa_id', empresaId)
  return { processados }
}
