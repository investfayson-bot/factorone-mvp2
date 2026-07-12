import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { registrarAcaoAgente } from '@/lib/agentes-log'
import { encontrarRegra, type Regra } from '@/lib/donna/regras'
import { processarMensagemVisitante } from '@/lib/donna/site-agent'
import { checkRateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
}

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// Telegram manda esse header quando o webhook é registrado com secret_token.
// Sem secret configurado = rejeita tudo (mesmo padrão do webhook do LifeOS).
function autenticar(req: NextRequest): boolean {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!secret) return false
  return req.headers.get('x-telegram-bot-api-secret-token') === secret
}

async function sendTelegram(chatId: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  })
}

export async function GET() {
  return NextResponse.json({ status: 'ok', servico: 'FactorOne Telegram Webhook' })
}

// ── Ação: enviar DRE por e-mail ─────────────────────────────────────────
// Primeira "ferramenta de agir" do acessor (visão CEO/CFO/COO): em vez de
// responder "não consigo enviar e-mails", o bot gera o PDF do DRE
// (lib/pdf/dre, mesmo gerador da rota /api/dre/exportar-pdf) e envia por
// e-mail (lib/email/enviar, com anexo). Quem manda é o DONO já vinculado
// por telegram_chat_id — não há autonomia a configurar: é comando direto.

const MESES_PT: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, março: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
}

// "maio/2026", "maio de 2026", "2026-05", "mês passado", nada → mês anterior
// (último mês fechado — DRE do mês corrente ainda está incompleto).
function extrairCompetencia(texto: string): string {
  const t = texto.toLowerCase()
  const iso = t.match(/\b(20\d{2})-(0[1-9]|1[0-2])\b/)
  if (iso) return `${iso[1]}-${iso[2]}`
  const nome = t.match(/\b(janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b(?:\s*(?:de|\/)\s*(20\d{2}))?/)
  if (nome) {
    const mes = MESES_PT[nome[1]]
    const ano = nome[2] ? Number(nome[2]) : new Date().getFullYear()
    return `${ano}-${String(mes).padStart(2, '0')}`
  }
  const ref = new Date()
  ref.setDate(1)
  ref.setMonth(ref.getMonth() - 1)
  return ref.toISOString().slice(0, 7)
}

function pedeEnvioDre(texto: string): boolean {
  const t = texto.toLowerCase()
  return /\bdre\b|demonstrativo de resultado/.test(t) && /\b(envia|enviar|envie|manda|mandar|mande|e-?mail|gera|gerar|gere)\b/.test(t)
}

async function enviarDrePorEmail(
  supabase: ReturnType<typeof db>, empresaId: string, userId: string, texto: string, emailPadrao: string | null,
): Promise<string> {
  const emailNoTexto = texto.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0]
  const destino = (emailNoTexto || emailPadrao || '').toLowerCase()
  if (!destino) return 'Pra qual e-mail envio? Manda de novo com o endereço (ex.: "envia o DRE de maio pra contato@factorone.com.br").'

  const competencia = extrairCompetencia(texto)
  try {
    const { gerarDrePdf } = await import('@/lib/pdf/dre')
    const dre = await gerarDrePdf(supabase, empresaId, competencia)
    if (dre.resumo.receita === 0 && dre.resumo.lucro === 0) {
      return `Não achei métricas fechadas pra ${dre.periodo} — o DRE sairia zerado. Confere em Financeiro → DRE se a competência ${competencia} está calculada, ou me pede outro mês.`
    }

    const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    const assunto = `DRE ${dre.periodo} — ${dre.empresaNome}`
    const anexos = [{ filename: dre.filename, conteudoBase64: dre.buffer.toString('base64'), tipo: 'application/pdf' }]
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4ef;font-family:'Helvetica Neue',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4ef;padding:32px 16px"><tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;border:1px solid #e5e2d9;overflow:hidden">
      <tr><td style="background:#0C1D16;padding:22px 32px">
        <div style="color:#ffffff;font-size:20px;font-weight:800">Factor<span style="color:#4ADE80">One</span></div>
        <div style="color:#9FC3BB;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;margin-top:2px">DRE Mensal</div>
      </td></tr>
      <tr><td style="padding:28px 32px">
        <h1 style="margin:0 0 8px;font-size:18px;font-weight:800;color:#13201D">DRE de ${dre.periodo}</h1>
        <p style="margin:0 0 16px;font-size:13px;line-height:1.7;color:#3C4A46">${dre.empresaNome} — demonstrativo completo em anexo (PDF).</p>
        <table cellpadding="0" cellspacing="0" width="100%" style="font-size:13px;color:#3C4A46">
          <tr><td style="padding:6px 0;border-bottom:1px solid #f0ede4">Receita Bruta</td><td align="right" style="font-weight:700;color:#13201D">${fmt(dre.resumo.receita)}</td></tr>
          <tr><td style="padding:6px 0;border-bottom:1px solid #f0ede4">EBITDA</td><td align="right" style="font-weight:700;color:#13201D">${fmt(dre.resumo.ebitda)}</td></tr>
          <tr><td style="padding:6px 0">Lucro Líquido (${dre.resumo.margem.toFixed(1)}%)</td><td align="right" style="font-weight:700;color:${dre.resumo.lucro >= 0 ? '#16A34A' : '#B0413E'}">${fmt(dre.resumo.lucro)}</td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:14px 32px 20px;border-top:1px solid #f0ede4">
        <p style="margin:0;font-size:11px;color:#9AA6A2">Gerado e enviado pelo acessor FactorOne via Telegram</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`

    // 1º: Gmail do próprio dono (google_contas conectada) — sai do e-mail
    // real dele, sem cota de terceiros. 2º: fallback Mailtrap/Resend.
    const okMsg = (via: string) => `Feito ✅ DRE de ${dre.periodo} (${dre.empresaNome}) enviado pra ${destino} ${via}.\n\nResumo: receita ${fmt(dre.resumo.receita)} · EBITDA ${fmt(dre.resumo.ebitda)} · lucro líquido ${fmt(dre.resumo.lucro)} (${dre.resumo.margem.toFixed(1)}%).`

    const errosEnvio: string[] = []
    const { data: contaGoogle } = await supabase.from('google_contas').select('email, refresh_token_cifrado').eq('empresa_id', empresaId).eq('ativo', true).maybeSingle()
    if (contaGoogle) {
      try {
        const { decifrar } = await import('@/lib/cofre-crypto')
        const { renovarAccessToken } = await import('@/lib/google-oauth')
        const { enviarEmailNovo } = await import('@/lib/gmail-client')
        const tok = await renovarAccessToken(decifrar(contaGoogle.refresh_token_cifrado as string))
        await enviarEmailNovo(tok.access_token, { to: destino, from: contaGoogle.email as string, subject: assunto, html, anexos })
        return okMsg(`pelo seu Gmail (${contaGoogle.email})`)
      } catch (e) {
        errosEnvio.push(`Gmail: ${e instanceof Error ? e.message.slice(0, 160) : 'falha'}`)
      }
    }

    const { enviarEmail } = await import('@/lib/email/enviar')
    const resultado = await enviarEmail({ para: destino, assunto, html, anexos })
    if (resultado.ok) return okMsg(`(via ${resultado.provedor})`)

    errosEnvio.push(resultado.erro ?? 'falha')
    let dica = ''
    if (!contaGoogle) {
      // Caso real do Fayson: Google conectado, mas em OUTRA empresa do mesmo
      // dono — sem este aviso a dica genérica confunde ("mas já conectei!").
      const { data: vinculos } = await supabase.from('usuario_empresas').select('empresa_id').eq('user_id', userId)
      const empresasDoUsuario = (vinculos ?? []).map(v => v.empresa_id as string).filter(id => id !== empresaId)
      const { data: outras } = empresasDoUsuario.length > 0
        ? await supabase.from('google_contas').select('email, empresa_id, empresas(nome)').eq('ativo', true).in('empresa_id', empresasDoUsuario)
        : { data: [] }
      const outra = (outras ?? [])[0] as { email: string; empresas: { nome: string } | { nome: string }[] | null } | undefined
      if (outra) {
        const nomeOutra = Array.isArray(outra.empresas) ? outra.empresas[0]?.nome : outra.empresas?.nome
        dica = `\n\nSeu Google (${outra.email}) está conectado na empresa "${nomeOutra ?? 'outra'}", não nesta. Conecta também aqui: Agentes IA → Automações → Conectar Google (com a empresa atual ativa).`
      } else {
        dica = '\n\nDica: conecta seu Google em Agentes IA → Automações que eu passo a enviar direto do seu Gmail, sem depender de provedor externo.'
      }
    }
    return `Gerei o DRE de ${dre.periodo}, mas o envio falhou: ${errosEnvio.join(' | ')}${dica}`
  } catch (e) {
    return `Não consegui gerar/enviar o DRE: ${e instanceof Error ? e.message : 'erro inesperado'}`
  }
}

const TIPOS_ATIVIDADE = ['reuniao', 'ligacao', 'email', 'tarefa', 'visita', 'whatsapp', 'outro'] as const

type ExtracaoAgendamento = {
  eh_agendamento: boolean
  cliente: string | null
  data: string | null
  hora_inicio: string | null
  tipo: typeof TIPOS_ATIVIDADE[number]
  titulo: string
}

// Extrai a intenção de agendamento da mensagem (sem gravar nada ainda).
async function extrairAgendamento(texto: string): Promise<ExtracaoAgendamento | null> {
  const hoje = new Date()
  const hojeStr = hoje.toISOString().slice(0, 10)
  const diaSemana = hoje.toLocaleDateString('pt-BR', { weekday: 'long' })
  try {
    const completion = await getAnthropic().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: `Você extrai dados de agendamento de mensagens em português do Brasil. Hoje é ${hojeStr} (${diaSemana}).
Responda APENAS com um JSON válido, sem markdown, sem texto antes ou depois, no formato exato:
{"eh_agendamento": boolean, "cliente": string|null, "data": "YYYY-MM-DD"|null, "hora_inicio": "HH:MM"|null, "tipo": "reuniao"|"ligacao"|"email"|"tarefa"|"visita"|"whatsapp"|"outro", "titulo": string}
Use "eh_agendamento": false se a mensagem não for um pedido claro de marcar/agendar algo, ou se não conseguir identificar a data com confiança.
Resolva datas relativas (amanhã, sexta, dia 15) usando a data de hoje acima.`,
      messages: [{ role: 'user', content: texto }],
    })
    const raw = completion.content[0]?.type === 'text' ? completion.content[0].text : ''
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return null
    const extraido = JSON.parse(match[0]) as ExtracaoAgendamento
    if (!extraido.eh_agendamento || !extraido.data) return null
    return extraido
  } catch {
    return null
  }
}

// Grava de verdade em crm_atividades e devolve a mensagem de confirmação —
// o "agente que age", não só responde. Só é chamada quando a autonomia
// (donna_regras, canal telegram) autoriza ação automática, ou depois que o
// usuário confirmou um rascunho.
async function commitAgendamento(
  supabase: ReturnType<typeof db>,
  empresaId: string,
  extraido: ExtracaoAgendamento,
  textoOriginal: string
): Promise<string> {
  let clienteId: string | null = null
  if (extraido.cliente) {
    const { data: cliente } = await supabase
      .from('clientes')
      .select('id, nome')
      .eq('empresa_id', empresaId)
      .ilike('nome', `%${extraido.cliente}%`)
      .limit(1)
      .maybeSingle()
    clienteId = (cliente?.id as string) ?? null
  }

  const tipo = TIPOS_ATIVIDADE.includes(extraido.tipo) ? extraido.tipo : 'tarefa'
  const { error } = await supabase.from('crm_atividades').insert({
    empresa_id: empresaId,
    cliente_id: clienteId,
    tipo,
    titulo: extraido.titulo || textoOriginal.slice(0, 80),
    descricao: textoOriginal,
    data: extraido.data,
    hora_inicio: extraido.hora_inicio,
    status: 'pendente',
    lembrete: true,
  })
  if (error) return 'Entendi o pedido, mas não consegui salvar no CRM agora. Tenta de novo?'

  await registrarAcaoAgente(supabase, empresaId, 'donna', `Agendou ${tipo}${extraido.cliente ? ` com ${extraido.cliente}` : ''} via Telegram`, { detalhe: extraido.titulo })

  const dataFmt = new Date(`${extraido.data}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })
  const horaFmt = extraido.hora_inicio ? ` às ${extraido.hora_inicio}` : ''
  const quemFmt = extraido.cliente ? ` com ${extraido.cliente}` : ''
  return `Feito! Agendei ${tipo}${quemFmt} pra ${dataFmt}${horaFmt}. Já está no seu CRM (aba Agenda).`
}

// Bot de atendimento a cliente via deep link (t.me/<bot>?start=<empresaId>):
// o dono do negócio divulga esse link pros próprios clientes, que ficam
// numa conversa de cliente (atendimento_conversas, canal telegram) —
// completamente separada do assistente pessoal (usuarios.telegram_chat_id).
// É um bot global (1 token pra todo o FactorOne) — o mesmo chatId PODE ser
// cliente de mais de uma empresa ao mesmo tempo, de propósito (cada empresa
// tem seu próprio link). A unicidade de verdade é por empresa (índice único
// empresa_id+canal+canal_identificador), não global.
async function abrirConversaCliente(supabase: ReturnType<typeof db>, empresaId: string, chatId: string): Promise<string> {
  const { data, error } = await supabase
    .from('atendimento_conversas')
    .upsert(
      { empresa_id: empresaId, canal: 'telegram', canal_identificador: chatId, visitante_nome: 'Contato via Telegram', status: 'aberta' },
      { onConflict: 'empresa_id,canal,canal_identificador', ignoreDuplicates: true }
    )
    .select('id')
    .maybeSingle()
  if (data) return data.id as string
  if (error) throw error

  // ignoreDuplicates não devolve a linha existente — busca de novo.
  const { data: existente } = await supabase
    .from('atendimento_conversas')
    .select('id')
    .eq('empresa_id', empresaId)
    .eq('canal', 'telegram')
    .eq('canal_identificador', chatId)
    .single()
  return existente!.id as string
}

async function atenderClienteTelegram(supabase: ReturnType<typeof db>, empresaId: string, conversaId: string, chatId: string, texto: string): Promise<void> {
  await supabase.from('atendimento_mensagens').insert({ conversa_id: conversaId, empresa_id: empresaId, autor: 'visitante', texto })
  const { data: regrasData } = await supabase.from('donna_regras').select('*').eq('empresa_id', empresaId).eq('ativa', true)
  await processarMensagemVisitante(supabase, empresaId, conversaId, texto, (regrasData ?? []) as Regra[], 'telegram', t => sendTelegram(chatId, t))
}

const ACAO_PENDENTE = 'aguardando_confirmacao_agendamento'
const AFIRMATIVO = /^(sim|s|ss|confirma|confirmado|pode|pode sim|ok|okay|beleza|isso|exato|correto|manda)\b/i

// Se a regra da Donna pra Telegram exigir aprovação, ela pergunta antes de
// agendar; a confirmação do usuário no próximo turno é resolvida aqui,
// olhando o último "pedido pendente" registrado no log de ações.
async function tentarConfirmarPendente(
  supabase: ReturnType<typeof db>,
  empresaId: string,
  texto: string
): Promise<string | null> {
  if (!AFIRMATIVO.test(texto.trim())) return null
  const dezMinAtras = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const { data: pendente } = await supabase
    .from('agentes_acoes')
    .select('id, detalhe')
    .eq('empresa_id', empresaId)
    .eq('agente_id', 'donna')
    .eq('acao', ACAO_PENDENTE)
    .gt('created_at', dezMinAtras)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!pendente?.detalhe) return null

  await supabase.from('agentes_acoes').delete().eq('id', pendente.id)
  try {
    const { extraido, textoOriginal } = JSON.parse(pendente.detalhe) as { extraido: ExtracaoAgendamento; textoOriginal: string }
    return await commitAgendamento(supabase, empresaId, extraido, textoOriginal)
  } catch {
    return null
  }
}

// Ponto de entrada: extrai, casa a regra de autonomia do canal 'telegram' e
// decide entre agendar direto ou pedir confirmação antes.
async function tentarAgendar(
  supabase: ReturnType<typeof db>,
  empresaId: string,
  texto: string
): Promise<string | null> {
  const extraido = await extrairAgendamento(texto)
  if (!extraido) return null

  const { data: regrasData } = await supabase.from('donna_regras').select('*').eq('empresa_id', empresaId).eq('ativa', true)
  const regra = encontrarRegra((regrasData ?? []) as Regra[], 'telegram', texto)
  // Sem regra que capture isso, mantém o comportamento histórico (agenda direto)
  // pra não regredir quem já usa — só vira "pergunta antes" com regra explícita.
  const autonomia = regra?.autonomia ?? 'automatico'

  if (autonomia === 'automatico') {
    return commitAgendamento(supabase, empresaId, extraido, texto)
  }

  await registrarAcaoAgente(supabase, empresaId, 'donna', ACAO_PENDENTE, { detalhe: JSON.stringify({ extraido, textoOriginal: texto }) })
  const dataFmt = new Date(`${extraido.data}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })
  const horaFmt = extraido.hora_inicio ? ` às ${extraido.hora_inicio}` : ''
  const quemFmt = extraido.cliente ? ` com ${extraido.cliente}` : ''
  return `Posso marcar ${extraido.tipo}${quemFmt} pra ${dataFmt}${horaFmt}? Responde "sim" que eu confirmo.`
}

export async function POST(req: NextRequest) {
  if (!autenticar(req)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const body = await req.json().catch(() => ({})) as { message?: { chat?: { id?: number }; text?: string } }
    const message = body.message
    const chatId = message?.chat?.id != null ? String(message.chat.id) : ''
    const texto = (message?.text ?? '').trim()
    if (!chatId || !texto) return NextResponse.json({ ok: true })

    const supabase = db()
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('id, empresa_id, nome, email')
      .eq('telegram_chat_id', chatId)
      .maybeSingle()

    // Conta ainda não vinculada a este chat como dono — pode ser: deep link de
    // cliente (/start <empresaId>), continuação de uma conversa de cliente já
    // aberta, pareamento por código (dono), ou desconhecido.
    if (!usuario) {
      const deepLinkMatch = texto.match(/^\/start\s+([0-9a-f-]{36})$/i)
      if (deepLinkMatch) {
        if (!checkRateLimit(`tg-start:${chatId}`, 5, 60_000).allowed) return NextResponse.json({ ok: true })
        const empresaId = deepLinkMatch[1]
        const { data: donoValido } = await supabase.from('usuarios').select('id').eq('empresa_id', empresaId).limit(1).maybeSingle()
        if (!donoValido) {
          await sendTelegram(chatId, 'Esse link não parece válido. Confere com quem te mandou.')
          return NextResponse.json({ ok: true })
        }
        await abrirConversaCliente(supabase, empresaId, chatId)
        await sendTelegram(chatId, 'Oi! Pode mandar sua dúvida que eu já te ajudo.')
        return NextResponse.json({ ok: true })
      }

      // O mesmo chatId pode ter uma atendimento_conversas em mais de uma
      // empresa (bot global, várias empresas divulgando o próprio link) —
      // sem jeito de saber qual empresa essa mensagem solta é "pra". Rotear
      // pra conversa mais recentemente ativa é a melhor aproximação (é o que
      // qualquer app de chat faria); nunca escolher arbitrariamente.
      const { data: conversasCliente } = await supabase
        .from('atendimento_conversas')
        .select('id, empresa_id')
        .eq('canal', 'telegram')
        .eq('canal_identificador', chatId)
        .order('updated_at', { ascending: false })
        .limit(1)
      const conversaCliente = conversasCliente?.[0]
      if (conversaCliente) {
        if (!checkRateLimit(`tg-cliente:${chatId}`, 15, 60_000).allowed || !checkRateLimit(`tg-empresa:${conversaCliente.empresa_id}`, 60, 3_600_000).allowed) {
          return NextResponse.json({ ok: true })
        }
        await atenderClienteTelegram(supabase, conversaCliente.empresa_id as string, conversaCliente.id as string, chatId, texto)
        return NextResponse.json({ ok: true })
      }

      if (texto === '/start') {
        await sendTelegram(chatId, 'Oi! Sou o assistente do FactorOne. Pra te reconhecer, gere um código em /dashboard/integracoes (Telegram) e me manda o código aqui.')
        return NextResponse.json({ ok: true })
      }

      const codigo = texto.replace(/\D/g, '')
      if (codigo.length === 6) {
        const { data: pendente } = await supabase
          .from('usuarios')
          .select('id')
          .eq('telegram_link_code', codigo)
          .gt('telegram_link_code_exp', new Date().toISOString())
          .maybeSingle()

        if (pendente) {
          const { error } = await supabase
            .from('usuarios')
            .update({ telegram_chat_id: chatId, telegram_link_code: null, telegram_link_code_exp: null })
            .eq('id', pendente.id)
          if (error) {
            await sendTelegram(chatId, 'Esse Telegram já está vinculado a outra conta FactorOne.')
          } else {
            await sendTelegram(chatId, 'Conta vinculada! Pode perguntar sobre suas finanças a qualquer hora — saldo, contas a vencer, DAS, o que quiser.')
          }
          return NextResponse.json({ ok: true })
        }
      }

      await sendTelegram(chatId, 'Não te reconheço ainda. Gere um código em /dashboard/integracoes (Telegram) e manda esse código aqui pra vincular sua conta.')
      return NextResponse.json({ ok: true })
    }

    // Conta vinculada. Uma resposta curta afirmativa pode estar confirmando um
    // agendamento que a Donna deixou pendente (regra 'rascunho') — checa isso
    // independente de bater a palavra-chave de agendamento.
    const empresaIdTg = usuario.empresa_id as string
    const confirmacaoPendente = await tentarConfirmarPendente(supabase, empresaIdTg, texto)
    if (confirmacaoPendente) {
      await sendTelegram(chatId, confirmacaoPendente)
      return NextResponse.json({ ok: true })
    }

    // Pedido de envio do DRE — age de verdade (gera PDF + e-mail com anexo).
    if (pedeEnvioDre(texto)) {
      const resposta = await enviarDrePorEmail(supabase, empresaIdTg, usuario.id as string, texto, (usuario.email as string) ?? null)
      await sendTelegram(chatId, resposta)
      await supabase.from('lifeos_interacoes').insert({ empresa_id: empresaIdTg, origem: 'telegram', mensagem_usuario: texto, resposta_ia: resposta }).then(() => {})
      return NextResponse.json({ ok: true })
    }

    // Se parecer um pedido de agendamento, tenta agir de verdade (cria em
    // crm_atividades, ou pergunta antes conforme a regra de autonomia) em vez
    // de só responder em texto.
    if (/\b(marca|marque|agend|reuni[ãa]o|visita|compromisso|lembr|liga[çc][ãa]o|ligar para)\b/i.test(texto)) {
      const acao = await tentarAgendar(supabase, empresaIdTg, texto)
      if (acao) {
        await sendTelegram(chatId, acao)
        return NextResponse.json({ ok: true })
      }
      // confiança baixa na extração — segue pro fluxo normal de resposta
    }

    // Conta vinculada — busca contexto financeiro real e responde.
    const empresaId = usuario.empresa_id as string
    const hoje = new Date()
    const inicioMes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`
    const em7 = new Date(hoje.getTime() + 7 * 86400000).toISOString().slice(0, 10)

    const [txRes, contasRes, pagarRes] = await Promise.all([
      supabase.from('transacoes').select('tipo,valor,categoria,data').eq('empresa_id', empresaId).order('data', { ascending: false }).limit(30),
      supabase.from('contas_bancarias').select('banco,saldo_disponivel,saldo').eq('empresa_id', empresaId).limit(3),
      supabase.from('contas_pagar').select('descricao,valor,data_vencimento').eq('empresa_id', empresaId).neq('status', 'pago').lte('data_vencimento', em7).limit(10),
    ])

    const transacoes = txRes.data ?? []
    const contas = contasRes.data ?? []
    const receitaMes = transacoes.filter(t => t.tipo === 'entrada' && t.data >= inicioMes).reduce((s, t) => s + Number(t.valor || 0), 0)
    const gastoMes = transacoes.filter(t => t.tipo === 'saida' && t.data >= inicioMes).reduce((s, t) => s + Number(t.valor || 0), 0)
    const saldoTotal = contas.reduce((s, c) => s + Number(c.saldo_disponivel || c.saldo || 0), 0)

    const contexto = {
      nome: usuario.nome,
      saldo_total: saldoTotal,
      receita_mes: receitaMes,
      gasto_mes: gastoMes,
      contas_pagar_proximos_7d: pagarRes.data ?? [],
      transacoes_recentes: transacoes.slice(0, 15),
    }

    let resposta = 'Não consegui processar sua mensagem agora.'
    try {
      const completion = await getAnthropic().messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system: `Você é o acessor FactorOne via Telegram — assistente executivo (CEO/CFO) do dono do negócio. Responda em português, de forma MUITO concisa (máx 3 parágrafos curtos). Sem emojis em excesso. Seja direto como um CFO.

AÇÕES QUE VOCÊ EXECUTA DE VERDADE (nunca diga que não consegue): enviar o DRE mensal por e-mail em PDF (o usuário pede "envia o DRE de <mês> pra <email>"), agendar reuniões/compromissos. Se o pedido for uma dessas ações mas você recebeu a mensagem aqui, oriente o usuário a formular assim. Outras ações (ler e-mails, responder leads) estão chegando — diga que estão em construção, não que são impossíveis.

DADOS DA EMPRESA:
${JSON.stringify(contexto)}`,
        messages: [{ role: 'user', content: texto }],
      })
      resposta = completion.content[0]?.type === 'text' ? completion.content[0].text : resposta
    } catch { /* mantém resposta padrão */ }

    await sendTelegram(chatId, resposta)
    await supabase.from('lifeos_interacoes').insert({ empresa_id: empresaId, origem: 'telegram', mensagem_usuario: texto, resposta_ia: resposta }).then(() => {})

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Telegram webhook error:', e)
    return NextResponse.json({ ok: true }) // sempre 200 pro Telegram não ficar reenviando
  }
}
