import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'

export async function GET(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const cliente = searchParams.get('cliente')
  const page = Number(searchParams.get('page') || '1')
  const pageSize = 20
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = (u?.empresa_id as string) || user.id
  let q = supabase.from('contas_receber').select('*', { count: 'exact' }).eq('empresa_id', empresaId).order('data_vencimento', { ascending: true }).range(from, to)
  if (status && status !== 'todas') q = q.eq('status', status)
  if (cliente) q = q.ilike('cliente_nome', `%${cliente}%`)
  const { data, error, count } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data: data || [], pagination: { page, pageSize, total: count || 0 } })
}

export async function POST(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = await req.json()
  const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = (u?.empresa_id as string) || user.id
  const parcelas = Number(body.parcelas || 1)
  const valor = Number(body.valor || 0)
  const base = {
    empresa_id: empresaId,
    descricao: body.descricao,
    cliente_nome: body.cliente_nome,
    cliente_documento: body.cliente_documento || null,
    cliente_email: body.cliente_email || null,
    categoria: body.categoria || 'Receita Operacional',
    data_emissao: body.data_emissao || new Date().toISOString().slice(0, 10),
    data_vencimento: body.data_vencimento,
    tipo_cobranca: body.tipo_cobranca || null,
    chave_pix_cobranca: body.chave_pix_cobranca || null,
    link_pagamento: body.link_pagamento || null,
    nota_fiscal_id: body.nota_fiscal_id || null,
    recorrente: Boolean(body.recorrente),
    recorrencia_tipo: body.recorrencia_tipo || null,
    observacoes: body.observacoes || null,
    parcelas,
    juros_mora: body.juros_mora ?? 0.0033,
    multa: body.multa ?? 0.02,
  }
  if (parcelas <= 1) {
    const { data, error } = await supabase.from('contas_receber').insert({ ...base, valor, parcela_atual: 1 }).select('*').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ data })
  }
  const valorParcela = valor / parcelas
  const inserts = Array.from({ length: parcelas }).map((_, i) => {
    const dt = new Date(body.data_vencimento)
    dt.setMonth(dt.getMonth() + i)
    return { ...base, valor: valorParcela, parcela_atual: i + 1, data_vencimento: dt.toISOString().slice(0, 10) }
  })
  const { data, error } = await supabase.from('contas_receber').insert(inserts).select('*')
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data })
}
