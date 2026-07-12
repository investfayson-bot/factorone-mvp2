import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import { decifrar } from '@/lib/cofre-crypto'
import { renovarAccessToken } from '@/lib/google-oauth'
import { listarMensagens, obterMensagem, garantirLabel, listarLabels, arquivarEModificar } from '@/lib/gmail-client'
import { registrarAcaoAgente } from '@/lib/agentes-log'

// Acessor — "organiza meus e-mails": varre a caixa recente, classifica em
// categorias fixas (1 chamada de IA em lote), cria as labels FactorOne/*
// DENTRO do Gmail, aplica em cada mensagem e devolve o relatório em texto
// (pro Telegram ou pra UI). Não responde nada, não arquiva, não deleta —
// só rotula e reporta.

const CATEGORIAS = ['Leads', 'Clientes', 'Cobranças', 'Urgente', 'Newsletters', 'Pessoal', 'Outros'] as const
type Categoria = typeof CATEGORIAS[number]
const PREFIXO = 'FactorOne/'
const MAX_MENSAGENS = 40 // custo: 1 chamada IA com assunto+trecho de até 40 e-mails

export type ResultadoOrganizacao = { ok: boolean; relatorio?: string; erro?: string }

export async function organizarInboxEmpresa(supabase: SupabaseClient, empresaId: string): Promise<ResultadoOrganizacao> {
  const { data: conta } = await supabase.from('google_contas').select('email, refresh_token_cifrado').eq('empresa_id', empresaId).eq('ativo', true).maybeSingle()
  if (!conta) return { ok: false, erro: 'Google não conectado nesta empresa — conecta em Agentes IA → Automações.' }
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, erro: 'IA não configurada no servidor.' }

  let accessToken: string
  try {
    accessToken = (await renovarAccessToken(decifrar(conta.refresh_token_cifrado as string))).access_token
  } catch {
    return { ok: false, erro: 'Falha ao renovar o acesso ao Google — reconecte em Integrações.' }
  }

  // e-mails dos últimos 7 dias na caixa de entrada
  const resumos = await listarMensagens(accessToken, 'in:inbox newer_than:7d', MAX_MENSAGENS)
  if (resumos.length === 0) return { ok: true, relatorio: 'Sua caixa de entrada não tem e-mails novos nos últimos 7 dias. Nada pra organizar.' }

  const mensagens = await Promise.all(resumos.map(r => obterMensagem(accessToken, r.id).catch(() => null)))
  const validas = mensagens.filter((m): m is NonNullable<typeof m> => !!m)

  // classificação em lote — devolve índice → categoria
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const lista = validas.map((m, i) => `${i}| de: ${m.remetente.slice(0, 60)} | assunto: ${m.assunto.slice(0, 90)} | trecho: ${m.snippet.slice(0, 110)}`).join('\n')
  const completion = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    system: `Classifique cada e-mail em UMA categoria: ${CATEGORIAS.join(', ')}.
Leads = interessado em comprar/orçamento/demo. Clientes = cliente existente falando. Cobranças = fatura/boleto/pagamento a fazer ou receber. Urgente = exige ação rápida (prazo, problema grave). Newsletters = marketing/notícia em massa. Pessoal = não é do negócio.
Responda APENAS JSON: {"0":"Leads","1":"Outros",...} — todos os índices, sem explicação.`,
    messages: [{ role: 'user', content: lista }],
  })
  const raw = completion.content[0]?.type === 'text' ? completion.content[0].text : '{}'
  let mapa: Record<string, string> = {}
  try {
    const clean = raw.replace(/```json|```/g, '').trim()
    mapa = JSON.parse(clean.slice(clean.indexOf('{'), clean.lastIndexOf('}') + 1))
  } catch {
    return { ok: false, erro: 'A IA devolveu um formato inesperado — tenta de novo em instantes.' }
  }

  // garante as labels e aplica
  const labelsExistentes = await listarLabels(accessToken)
  const labelIds = new Map<Categoria, string>()
  const porCategoria = new Map<Categoria, typeof validas>()
  for (let i = 0; i < validas.length; i++) {
    const cat = (CATEGORIAS as readonly string[]).includes(mapa[String(i)]) ? mapa[String(i)] as Categoria : 'Outros'
    porCategoria.set(cat, [...(porCategoria.get(cat) ?? []), validas[i]])
  }

  let aplicadas = 0
  for (const [cat, msgs] of Array.from(porCategoria.entries())) {
    if (msgs.length === 0) continue
    if (!labelIds.has(cat)) labelIds.set(cat, await garantirLabel(accessToken, `${PREFIXO}${cat}`, labelsExistentes))
    const id = labelIds.get(cat)!
    for (const msg of msgs) {
      try { await arquivarEModificar(accessToken, msg.id, { addLabelIds: [id] }); aplicadas++ } catch { /* segue */ }
    }
  }

  // relatório
  const ordem: Categoria[] = ['Urgente', 'Leads', 'Cobranças', 'Clientes', 'Pessoal', 'Newsletters', 'Outros']
  const linhas = ordem
    .filter(c => (porCategoria.get(c)?.length ?? 0) > 0)
    .map(c => {
      const msgs = porCategoria.get(c)!
      const destaque = ['Urgente', 'Leads', 'Cobranças'].includes(c)
        ? '\n' + msgs.slice(0, 3).map(m => `   • ${m.assunto.slice(0, 60) || '(sem assunto)'} — ${m.remetente.replace(/<.*>/, '').trim().slice(0, 40)}`).join('\n')
        : ''
      return `${c}: ${msgs.length}${destaque}`
    })
  const relatorio = `Caixa organizada (${conta.email}) — ${validas.length} e-mails dos últimos 7 dias, ${aplicadas} rotulados com labels FactorOne/* no seu Gmail:\n\n${linhas.join('\n')}`

  await registrarAcaoAgente(supabase, empresaId, 'donna', 'Organizou a caixa de e-mail com labels', { detalhe: `${validas.length} e-mails classificados` })
  await supabase.from('lifeos_interacoes').insert({ empresa_id: empresaId, origem: 'telegram', mensagem_usuario: '[organizar inbox]', resposta_ia: relatorio.slice(0, 500) }).then(() => {})

  return { ok: true, relatorio }
}
