import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

export const runtime = 'nodejs'
const openrouter = new OpenAI({ baseURL: 'https://openrouter.ai/api/v1', apiKey: process.env.OPENROUTER_API_KEY || '' })
const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const dias = (d: string | null) => (d ? Math.ceil((new Date(d + 'T12:00:00').getTime() - Date.now()) / 86400000) : null)

async function reunirContexto(empresa: string) {
  const d = db()
  const safe = async <T>(p: PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> => { try { const r = await p; return r.error ? [] : (r.data ?? []) } catch { return [] } }

  const tx = await safe<{ tipo: string; valor: number; categoria: string | null }>(d.from('transacoes').select('tipo,valor,categoria').eq('empresa_id', empresa).limit(2000))
  const recibos = await safe<{ pagamento: string | null; locatario: string | null; aluguel: number; juros: number; agua: number; outros: number; comissao: number; desconto: number }>(d.from('recibos_locacao').select('*').eq('empresa_id', empresa))
  const veiculos = await safe<{ modelo: string | null; placa: string | null; ipva_venc: string | null; seguro_venc: string | null }>(d.from('veiculos').select('modelo,placa,ipva_venc,seguro_venc').eq('empresa_id', empresa))
  const obras = await safe<{ nome: string | null; orcamento: number; pagamentos: { valor: number }[] }>(d.from('obras').select('nome,orcamento,pagamentos').eq('empresa_id', empresa))
  const imoveis = await safe<{ ocupada: boolean; aluguel: number }>(d.from('imoveis').select('ocupada,aluguel').eq('empresa_id', empresa))
  const ops = await safe<{ valor: number | null; etapa: string }>(d.from('crm_oportunidades').select('valor,etapa').eq('empresa_id', empresa))
  const atvs = await safe<{ status: string }>(d.from('crm_atividades').select('status').eq('empresa_id', empresa))

  const entrou = tx.filter(t => t.tipo === 'entrada').reduce((s, t) => s + Number(t.valor), 0)
  const saiu = tx.filter(t => t.tipo === 'saida').reduce((s, t) => s + Number(t.valor), 0)
  const aClassificar = tx.filter(t => !t.categoria || String(t.categoria).trim() === '').length
  const catMap = new Map<string, number>()
  for (const t of tx) if (t.tipo === 'saida' && t.categoria && String(t.categoria).trim()) catMap.set(t.categoria, (catMap.get(t.categoria) || 0) + Number(t.valor))
  const topCats = Array.from(catMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5)

  const liq = (r: typeof recibos[number]) => Number(r.aluguel) + Number(r.juros) + Number(r.agua) + Number(r.outros) - Number(r.comissao) - Number(r.desconto)
  const aReceber = recibos.filter(r => !r.pagamento)
  const vencs: string[] = []
  for (const v of veiculos) {
    const di = dias(v.ipva_venc); if (di !== null && di <= 30) vencs.push(`IPVA ${v.modelo ?? v.placa ?? ''} ${di < 0 ? 'VENCIDO' : `em ${di}d`}`)
    const ds = dias(v.seguro_venc); if (ds !== null && ds <= 30) vencs.push(`Seguro ${v.modelo ?? v.placa ?? ''} ${ds < 0 ? 'VENCIDO' : `em ${ds}d`}`)
  }
  const obrasEstouro = obras.filter(o => o.pagamentos.reduce((s, p) => s + Number(p.valor), 0) > Number(o.orcamento) && Number(o.orcamento) > 0).map(o => o.nome ?? 'obra')
  const aluguelMes = imoveis.filter(i => i.ocupada).reduce((s, i) => s + Number(i.aluguel), 0)
  const abertas = ops.filter(o => !['fechado_ganho', 'fechado_perdido'].includes(o.etapa))
  const pipelineAberto = abertas.reduce((s, o) => s + Number(o.valor ?? 0), 0)
  const ganhoValor = ops.filter(o => o.etapa === 'fechado_ganho').reduce((s, o) => s + Number(o.valor ?? 0), 0)
  const atividadesPendentes = atvs.filter(a => a.status === 'pendente').length

  return {
    resumo: {
      resultado: entrou - saiu, entrou, saiu, aClassificar,
      aReceberQtd: aReceber.length, aReceberValor: aReceber.reduce((s, r) => s + liq(r), 0),
      vencimentos: vencs, obrasEstouro, aluguelMes, imoveis: imoveis.length, topCats,
      pipelineAberto, ganhoValor, atividadesPendentes, oportunidadesAbertas: abertas.length,
    },
  }
}

export async function GET(req: NextRequest) {
  const { user } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { data: u } = await db().from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresa = (u?.empresa_id as string) ?? user.id
  const ctx = await reunirContexto(empresa)
  return NextResponse.json(ctx)
}

export async function POST(req: NextRequest) {
  const { user } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { pergunta } = await req.json().catch(() => ({})) as { pergunta?: string }
  if (!pergunta?.trim()) return NextResponse.json({ error: 'Pergunta vazia' }, { status: 400 })
  const { data: u } = await db().from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresa = (u?.empresa_id as string) ?? user.id
  const { resumo } = await reunirContexto(empresa)

  // Agente que age: detecta UMA ação concreta que o sistema pode executar (com gate no front).
  const pl = pergunta.toLowerCase()
  let acao: { tipo: string; label: string } | null = null
  if (/classific|organiz|pend[êe]nc|categor|arruma|a revisar/.test(pl) && resumo.aClassificar > 0) {
    acao = { tipo: 'classificar', label: `Classificar ${resumo.aClassificar} transações com a IA` }
  } else if (/relat[óo]rio|resumo do dia|report/.test(pl)) {
    acao = { tipo: 'relatorio', label: 'Gerar o relatório do dia' }
  }

  const contexto = [
    `Resultado do período: ${fmt(resumo.resultado)} (entrou ${fmt(resumo.entrou)}, saiu ${fmt(resumo.saiu)}).`,
    `Transações a classificar: ${resumo.aClassificar}.`,
    `Imóveis: ${resumo.imoveis}, aluguel dos ocupados: ${fmt(resumo.aluguelMes)}/mês.`,
    `Recibos a receber: ${resumo.aReceberQtd} (${fmt(resumo.aReceberValor)}).`,
    `Vencimentos (30d): ${resumo.vencimentos.join('; ') || 'nenhum'}.`,
    `Obras estourando o orçamento: ${resumo.obrasEstouro.join('; ') || 'nenhuma'}.`,
    `CRM: ${resumo.oportunidadesAbertas} oportunidades abertas (pipeline ${fmt(resumo.pipelineAberto)}), ganho ${fmt(resumo.ganhoValor)}, ${resumo.atividadesPendentes} atividades pendentes.`,
    `Maiores gastos: ${resumo.topCats.map(([c, v]) => `${c}=${fmt(v)}`).join('; ') || 'n/d'}.`,
  ].join('\n')

  if (!process.env.OPENROUTER_API_KEY) return NextResponse.json({ resposta: `Aqui está o que vejo:\n${contexto}`, acao })
  try {
    const completion = await openrouter.chat.completions.create({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: 'Você é o gestor 24/7 do FactorOne. Você atua em vários "chapéus" conforme a pergunta: FINANÇAS (DRE, caixa, contas), VENDAS (CRM, pipeline, leads), PÓS-VENDA e relacionamento com o cliente, e PATRIMÔNIO (imóveis, aluguéis, obras, veículos). Identifique o chapéu certo e responda como aquele especialista. Português, curto, direto e prático, SEMPRE usando os números do contexto — nunca invente. Se houver uma ação óbvia que o sistema pode executar (classificar transações, gerar relatório, agendar follow-up), sugira UMA e diga que pode fazer por ele.' },
        { role: 'user', content: `Contexto atual:\n${contexto}\n\nPergunta: ${pergunta}` },
      ],
      temperature: 0.4,
    })
    return NextResponse.json({ resposta: completion.choices[0]?.message?.content ?? 'Não consegui responder agora.', acao })
  } catch {
    return NextResponse.json({ resposta: `Aqui está o que vejo:\n${contexto}`, acao })
  }
}
