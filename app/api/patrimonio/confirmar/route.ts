import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseUser, bloquearSeLeitura } from '@/lib/supabase-route'

export const runtime = 'nodejs'

// Fase 7 — salva os imóveis conferidos na prévia (importação em lote ou
// cadastro manual) em imoveis_detalhes. Também gerencia a alíquota de ITBI
// lembrada por cidade (PUT) e marca venda (PATCH).

type Linha = {
  endereco?: string | null; cidade?: string | null; uf?: string | null
  area_m2?: number | null; valor_aquisicao?: number | null; data_aquisicao?: string | null
  tipo_imovel?: string | null; matricula?: string | null
}

const TIPOS = new Set(['comercial', 'residencial', 'rural', 'terreno', 'industrial'])

async function contexto(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return null
  const bloqueio = await bloquearSeLeitura(supabase, user.id)
  if (bloqueio) return { erro: NextResponse.json({ error: `Papel ${bloqueio} tem acesso somente-leitura.` }, { status: 403 }) }
  const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  return { supabase, empresaId: (u?.empresa_id as string) ?? user.id }
}

export async function POST(req: NextRequest) {
  const ctx = await contexto(req)
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if ('erro' in ctx) return ctx.erro

  const body = await req.json().catch(() => ({})) as { imoveis?: Linha[] }
  const linhas = (body.imoveis ?? []).slice(0, 100)
  if (linhas.length === 0) return NextResponse.json({ error: 'Nenhum imóvel pra salvar' }, { status: 400 })

  const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const registros = linhas
    .filter(l => l.endereco?.trim() || l.cidade?.trim())
    .map(l => ({
      empresa_id: ctx.empresaId,
      endereco: l.endereco?.trim().slice(0, 200) ?? null,
      cidade: l.cidade?.trim().slice(0, 80) ?? null,
      estado: l.uf?.trim().toUpperCase().slice(0, 2) ?? null,
      area_m2: Number.isFinite(Number(l.area_m2)) && Number(l.area_m2) > 0 ? Number(l.area_m2) : null,
      valor_aquisicao: Number.isFinite(Number(l.valor_aquisicao)) && Number(l.valor_aquisicao) > 0 ? Number(l.valor_aquisicao) : null,
      data_aquisicao: l.data_aquisicao && /^\d{4}-\d{2}-\d{2}$/.test(l.data_aquisicao) ? l.data_aquisicao : null,
      tipo_imovel: l.tipo_imovel && TIPOS.has(l.tipo_imovel) ? l.tipo_imovel : 'comercial',
      matricula: l.matricula?.trim().slice(0, 60) ?? null,
    }))
  if (registros.length === 0) return NextResponse.json({ error: 'Todas as linhas estão sem endereço/cidade' }, { status: 400 })

  const { error } = await service.from('imoveis_detalhes').insert(registros)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, salvos: registros.length })
}

// PUT — confirma/atualiza a alíquota de ITBI de uma cidade (lembrada)
export async function PUT(req: NextRequest) {
  const ctx = await contexto(req)
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if ('erro' in ctx) return ctx.erro

  const body = await req.json().catch(() => ({})) as { cidade?: string; uf?: string; aliquota_pct?: number }
  const cidade = String(body.cidade ?? '').trim()
  const uf = String(body.uf ?? '').trim().toUpperCase() || null
  const pct = Number(body.aliquota_pct)
  if (!cidade) return NextResponse.json({ error: 'Cidade obrigatória' }, { status: 400 })
  if (!Number.isFinite(pct) || pct < 0 || pct > 10) return NextResponse.json({ error: 'Alíquota inválida (0 a 10%)' }, { status: 400 })

  const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { error } = await service.from('itbi_aliquotas').upsert(
    { empresa_id: ctx.empresaId, cidade, uf, aliquota_pct: pct },
    { onConflict: 'empresa_id,cidade,uf' },
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// PATCH — marca/desmarca venda de um imóvel
export async function PATCH(req: NextRequest) {
  const ctx = await contexto(req)
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if ('erro' in ctx) return ctx.erro

  const body = await req.json().catch(() => ({})) as { id?: string; vendido?: boolean; valor_venda?: number; data_venda?: string }
  const id = String(body.id ?? '')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: existente } = await service.from('imoveis_detalhes').select('id').eq('id', id).eq('empresa_id', ctx.empresaId).maybeSingle()
  if (!existente) return NextResponse.json({ error: 'Imóvel não encontrado' }, { status: 404 })

  const vendido = !!body.vendido
  const { error } = await service.from('imoveis_detalhes').update({
    vendido,
    valor_venda: vendido && Number.isFinite(Number(body.valor_venda)) ? Number(body.valor_venda) : null,
    data_venda: vendido && body.data_venda && /^\d{4}-\d{2}-\d{2}$/.test(body.data_venda) ? body.data_venda : null,
  }).eq('id', id).eq('empresa_id', ctx.empresaId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
