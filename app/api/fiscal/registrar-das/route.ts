import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser, bloquearSeLeitura } from '@/lib/supabase-route'

export const runtime = 'nodejs'

// Registrar/atualizar o DAS estimado em tax_obrigacoes. Antes era escrita
// direta do client — papel só-leitura (contador/viewer) conseguia registrar
// imposto do cliente, contornando o gate de papel do commit 92f7236. Aqui
// passa pelo bloquearSeLeitura; a RLS de tax_obrigacoes continua limitando
// ao tenant do login.
export async function POST(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const bloqueio = await bloquearSeLeitura(supabase, user.id)
  if (bloqueio) return NextResponse.json({ error: `Papel ${bloqueio} tem acesso somente-leitura.` }, { status: 403 })

  const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = (u?.empresa_id as string) ?? user.id

  const body = await req.json().catch(() => ({})) as { competencia?: string; valor?: number; vencimento?: string }
  const competencia = String(body.competencia ?? '')
  const valor = Number(body.valor)
  const vencimento = String(body.vencimento ?? '')
  if (!/^\d{4}-\d{2}$/.test(competencia)) return NextResponse.json({ error: 'Competência inválida' }, { status: 400 })
  if (!Number.isFinite(valor) || valor <= 0) return NextResponse.json({ error: 'Valor inválido' }, { status: 400 })
  if (!/^\d{4}-\d{2}-\d{2}$/.test(vencimento)) return NextResponse.json({ error: 'Vencimento inválido' }, { status: 400 })

  const payload = {
    empresa_id: empresaId,
    nome: `DAS Simples Nacional ${competencia}`,
    tipo: 'DAS',
    competencia,
    vencimento,
    valor: Number(valor.toFixed(2)),
    status: 'pendente',
  }

  // evita duplicar a mesma competência
  const { data: existente } = await supabase
    .from('tax_obrigacoes')
    .select('id').eq('empresa_id', empresaId).eq('tipo', 'DAS').eq('competencia', competencia).maybeSingle()

  const { error } = existente
    ? await supabase.from('tax_obrigacoes').update(payload).eq('id', existente.id)
    : await supabase.from('tax_obrigacoes').insert(payload)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, atualizado: !!existente })
}
