import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

function publicSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = publicSupabase()

  const { data: link } = await supabase
    .from('cliente_links')
    .select('*, clientes(id, nome, email, cnpj_cpf, telefone, segmento, status, valor_contrato, notas, empresa_id, empresas:empresa_id(nome))')
    .eq('token', token)
    .maybeSingle()

  if (!link) return NextResponse.json({ error: 'Link inválido' }, { status: 404 })
  if (link.expires_at && new Date(link.expires_at) < new Date()) return NextResponse.json({ error: 'Link expirado' }, { status: 410 })

  const cliente = link.clientes as Record<string, unknown> | null
  const empresaNome = (cliente?.empresas as Record<string, string> | null)?.nome ?? 'Empresa'
  const empresaId = cliente?.empresa_id as string

  // Load financial data for this client
  const [contasR, rotasR, opsR] = await Promise.all([
    supabase.from('contas_receber').select('descricao,valor,data_vencimento,status').eq('cliente_id', link.cliente_id).order('data_vencimento', { ascending: false }).limit(20),
    supabase.from('logistica_rotas').select('origem,destino,status,valor_frete,data_entrega,created_at').eq('empresa_id', empresaId).eq('cliente_id', link.cliente_id).order('created_at', { ascending: false }).limit(10),
    supabase.from('crm_oportunidades').select('titulo,etapa,valor,data_fechamento').eq('empresa_id', empresaId).eq('cliente_id', link.cliente_id).order('created_at', { ascending: false }).limit(10),
  ])

  return NextResponse.json({
    cliente: {
      nome: cliente?.nome,
      email: cliente?.email,
      cnpj_cpf: cliente?.cnpj_cpf,
      segmento: cliente?.segmento,
      status: cliente?.status,
      valor_contrato: cliente?.valor_contrato,
    },
    empresa_nome: empresaNome,
    faturas: contasR.data ?? [],
    entregas: rotasR.data ?? [],
    oportunidades: opsR.data ?? [],
  })
}
