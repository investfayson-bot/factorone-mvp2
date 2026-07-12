import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseUser, bloquearSeLeitura } from '@/lib/supabase-route'

export const runtime = 'nodejs'

function svc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

const ETAPAS_KANBAN = ['prospeccao', 'qualificado', 'proposta', 'negociacao']
const TEMPERATURAS = ['frio', 'morno', 'quente']

async function empresaDe(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return { user: null, supabase, empresaId: '' }
  const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  return { user, supabase, empresaId: (u?.empresa_id as string) ?? user.id }
}

export async function GET(req: NextRequest) {
  const { user, supabase, empresaId } = await empresaDe(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data, error } = await supabase
    .from('crm_oportunidades')
    .select('id, titulo, valor, etapa, temperatura, ia_negociando, desconto_max_pct, canal_negociacao, ultimo_contato_em, updated_at, created_at, clientes(nome)')
    .eq('empresa_id', empresaId)
    .in('etapa', ETAPAS_KANBAN)
    .order('updated_at', { ascending: false })
    .limit(200)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const negocios = (data ?? []).map(o => {
    const cli = o.clientes as unknown as { nome: string } | { nome: string }[] | null
    const contato = Array.isArray(cli) ? cli[0]?.nome : cli?.nome
    const referencia = (o.ultimo_contato_em as string) || (o.updated_at as string) || (o.created_at as string)
    const diasParado = referencia ? Math.floor((Date.now() - new Date(referencia).getTime()) / 86400000) : 0
    return { ...o, clientes: undefined, contato: contato ?? null, dias_parado: diasParado }
  })

  return NextResponse.json({ negocios })
}

// Ações do Kanban: mover etapa, classificar temperatura, ajustar alçada,
// registrar contato. Toda mutação grava evento de auditoria (origem
// 'humano' — quem chama aqui é sempre gente; a IA usa lib/crm/pipeline-auto).
export async function PATCH(req: NextRequest) {
  const { user, supabase, empresaId } = await empresaDe(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const bloqueio = await bloquearSeLeitura(supabase, user.id)
  if (bloqueio) return NextResponse.json({ error: `Papel ${bloqueio} tem acesso somente-leitura.` }, { status: 403 })

  const body = await req.json().catch(() => ({})) as {
    id?: string; acao?: string; etapa?: string; temperatura?: string
    desconto_max_pct?: number; canal_negociacao?: string; ia_negociando?: boolean
  }
  const id = String(body.id ?? '')
  const acao = String(body.acao ?? '')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  // valida posse antes de qualquer escrita
  const { data: op } = await supabase.from('crm_oportunidades').select('id, titulo, etapa, temperatura').eq('id', id).eq('empresa_id', empresaId).maybeSingle()
  if (!op) return NextResponse.json({ error: 'Negócio não encontrado' }, { status: 404 })

  const service = svc()
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  let evento: { titulo: string; detalhe: string } | null = null

  if (acao === 'mover') {
    const etapa = String(body.etapa ?? '')
    if (!ETAPAS_KANBAN.includes(etapa) && !['fechado_ganho', 'fechado_perdido'].includes(etapa)) {
      return NextResponse.json({ error: 'Etapa inválida' }, { status: 400 })
    }
    patch.etapa = etapa
    evento = { titulo: `Movido para ${etapa}`, detalhe: `De ${op.etapa} para ${etapa}, manualmente` }
  } else if (acao === 'temperatura') {
    const t = String(body.temperatura ?? '')
    if (!TEMPERATURAS.includes(t)) return NextResponse.json({ error: 'Temperatura inválida' }, { status: 400 })
    patch.temperatura = t
    evento = { titulo: `Lead classificado como "${t}"`, detalhe: op.temperatura ? `Reclassificado (antes: ${op.temperatura})` : 'Primeira classificação, manual' }
  } else if (acao === 'alcada') {
    if (body.desconto_max_pct != null) {
      const pct = Number(body.desconto_max_pct)
      if (!Number.isFinite(pct) || pct < 0 || pct > 100) return NextResponse.json({ error: 'Desconto inválido' }, { status: 400 })
      patch.desconto_max_pct = pct
    }
    if (body.canal_negociacao != null) patch.canal_negociacao = String(body.canal_negociacao).slice(0, 40)
    if (body.ia_negociando != null) patch.ia_negociando = !!body.ia_negociando
    const partes = []
    if (patch.desconto_max_pct != null) partes.push(`desconto até ${patch.desconto_max_pct}%`)
    if (patch.canal_negociacao) partes.push(`canal ${patch.canal_negociacao}`)
    if (patch.ia_negociando != null) partes.push(`negociação automática ${patch.ia_negociando ? 'ON' : 'OFF'}`)
    evento = { titulo: 'Alçada de negociação ajustada', detalhe: partes.join(' · ') || 'sem mudanças' }
  } else if (acao === 'contato') {
    patch.ultimo_contato_em = new Date().toISOString()
    evento = { titulo: 'Contato registrado', detalhe: 'Marcado manualmente como contatado' }
  } else {
    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
  }

  const { error } = await service.from('crm_oportunidades').update(patch).eq('id', id).eq('empresa_id', empresaId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (evento) {
    await service.from('crm_negociacao_eventos').insert({
      empresa_id: empresaId, oportunidade_id: id, origem: 'humano',
      titulo: evento.titulo, detalhe: evento.detalhe,
    })
  }

  return NextResponse.json({ ok: true })
}
