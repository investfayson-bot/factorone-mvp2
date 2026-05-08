import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

function getAnon() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = getAnon()

  const { data, error } = await supabase
    .from('fornecedor_links')
    .select('empresa_id,descricao,valor_sugerido,data_vencimento_sugerida,categoria,expires_at,status')
    .eq('token', token)
    .maybeSingle()

  if (error || !data) return NextResponse.json({ error: 'Link inválido' }, { status: 404 })
  if (data.status !== 'ativo') return NextResponse.json({ error: 'Link expirado ou já utilizado' }, { status: 410 })
  if (new Date(data.expires_at as string) < new Date()) return NextResponse.json({ error: 'Link expirado' }, { status: 410 })

  const { data: emp } = await supabase.from('empresas').select('nome').eq('id', data.empresa_id).maybeSingle()

  return NextResponse.json({
    empresa_nome: emp?.nome || 'Empresa',
    descricao: data.descricao,
    valor_sugerido: data.valor_sugerido,
    data_vencimento_sugerida: data.data_vencimento_sugerida,
    categoria: data.categoria,
  })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = getAnon()

  const { data: link, error: linkErr } = await supabase
    .from('fornecedor_links')
    .select('empresa_id,descricao,categoria,expires_at,status')
    .eq('token', token)
    .maybeSingle()

  if (linkErr || !link) return NextResponse.json({ error: 'Link inválido' }, { status: 404 })
  if (link.status !== 'ativo') return NextResponse.json({ error: 'Link já utilizado' }, { status: 410 })
  if (new Date(link.expires_at as string) < new Date()) return NextResponse.json({ error: 'Link expirado' }, { status: 410 })

  const body = await req.json() as {
    fornecedor_nome: string; fornecedor_documento: string; descricao: string
    valor: number; data_vencimento: string; tipo_pagamento: string
    chave_pix?: string; codigo_barras?: string; observacoes?: string
  }

  if (!body.fornecedor_nome || !body.valor || !body.data_vencimento) {
    return NextResponse.json({ error: 'Dados obrigatórios faltando' }, { status: 400 })
  }

  const { error: insErr } = await supabase.from('contas_pagar').insert({
    empresa_id: link.empresa_id,
    descricao: body.descricao || link.descricao || 'Fatura do fornecedor',
    fornecedor_nome: body.fornecedor_nome,
    fornecedor_documento: body.fornecedor_documento || null,
    categoria: link.categoria || 'Fornecedores',
    valor: body.valor,
    data_vencimento: body.data_vencimento,
    tipo_pagamento: body.tipo_pagamento || null,
    chave_pix: body.chave_pix || null,
    codigo_barras: body.codigo_barras || null,
    observacoes: body.observacoes || null,
    status: 'pendente',
    origem: 'portal_fornecedor',
  })

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

  await supabase.from('fornecedor_links').update({ status: 'utilizado' }).eq('token', token)

  return NextResponse.json({ ok: true })
}
