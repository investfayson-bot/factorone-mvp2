import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const { searchParams } = new URL(req.url)
  const tab = searchParams.get('tab') ?? 'dre'

  const supabase = db()

  // Validate token
  const { data: cont } = await supabase
    .from('contadores')
    .select('nome, status, empresa_id, permissoes')
    .eq('token_acesso', token)
    .maybeSingle()

  if (!cont) return NextResponse.json({ error: 'invalid_token' }, { status: 401 })
  if (cont.status === 'revogado') return NextResponse.json({ error: 'revoked' }, { status: 403 })

  const eid = cont.empresa_id as string
  const perm = (cont.permissoes ?? {}) as Record<string, boolean>

  // Return contador info only
  if (tab === 'info') {
    return NextResponse.json({ nome: cont.nome, status: cont.status, permissoes: perm })
  }

  // Check permissions
  const permMap: Record<string, string> = {
    dre: 'ver_dre', lancamentos: 'ver_lancamentos', notas: 'ver_notas', despesas: 'ver_despesas',
  }
  if (permMap[tab] && perm[permMap[tab]] === false) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  if (tab === 'dre') {
    const { data } = await supabase
      .from('metricas_financeiras')
      .select('competencia, receita_bruta, lucro_liquido, ebitda, margem_liquida')
      .eq('empresa_id', eid)
      .order('competencia', { ascending: false })
      .limit(12)
    return NextResponse.json({ data: data ?? [] })
  }

  if (tab === 'lancamentos') {
    const { data } = await supabase
      .from('lancamentos')
      .select('id, descricao, valor, tipo, competencia, origem')
      .eq('empresa_id', eid)
      .order('competencia', { ascending: false })
      .limit(50)
    return NextResponse.json({ data: data ?? [] })
  }

  if (tab === 'notas') {
    const { data } = await supabase
      .from('notas_emitidas')
      .select('id, numero, destinatario_nome, valor_total, status, created_at')
      .eq('empresa_id', eid)
      .order('created_at', { ascending: false })
      .limit(30)
    return NextResponse.json({ data: data ?? [] })
  }

  if (tab === 'despesas') {
    const { data } = await supabase
      .from('despesas')
      .select('id, descricao, valor, categoria, status, data_despesa')
      .eq('empresa_id', eid)
      .order('data_despesa', { ascending: false })
      .limit(50)
    return NextResponse.json({ data: data ?? [] })
  }

  return NextResponse.json({ error: 'unknown_tab' }, { status: 400 })
}
