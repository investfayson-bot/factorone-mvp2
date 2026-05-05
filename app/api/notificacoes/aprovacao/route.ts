import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'
import { createClient } from '@supabase/supabase-js'
import { enviarNotificacao, TipoNotificacao } from '@/lib/email/notificacoes'

export async function POST(req: NextRequest) {
  try {
    const { user } = await getSupabaseUser(req)
    if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })

    const body = await req.json() as {
      tipo: TipoNotificacao
      item_id: string
      tabela: 'reembolsos' | 'despesas'
      email_destino?: string
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const empresaId = (u?.empresa_id as string) || user.id

    let emailPara = body.email_destino || ''

    if (!emailPara) {
      // Busca IDs dos usuarios da empresa e resolve emails via auth.users
      const { data: membros } = await supabase
        .from('usuarios')
        .select('id')
        .eq('empresa_id', empresaId)
        .limit(5)
      if (membros?.length) {
        const ids = membros.map((m: { id: string }) => m.id)
        const { data: authUsers } = await supabase.auth.admin.listUsers()
        const emails = (authUsers?.users ?? [])
          .filter(au => ids.includes(au.id))
          .map(au => au.email)
          .filter(Boolean) as string[]
        emailPara = emails.join(',')
      }
    }

    if (!emailPara) return NextResponse.json({ ok: false, motivo: 'nenhum email encontrado' })

    let dados: Parameters<typeof enviarNotificacao>[0]['dados'] | null = null

    if (body.tabela === 'reembolsos') {
      const { data: r } = await supabase
        .from('reembolsos')
        .select('descricao,valor,categoria,solicitante_nome,rejeitado_motivo')
        .eq('id', body.item_id)
        .maybeSingle()
      if (r) dados = { descricao: r.descricao, valor: Number(r.valor), categoria: r.categoria, solicitante: r.solicitante_nome, motivo: r.rejeitado_motivo }
    } else {
      const { data: d } = await supabase
        .from('despesas')
        .select('descricao,valor,categoria,responsavel_nome,rejeitado_motivo')
        .eq('id', body.item_id)
        .maybeSingle()
      if (d) dados = { descricao: d.descricao, valor: Number(d.valor), categoria: d.categoria, solicitante: d.responsavel_nome, motivo: d.rejeitado_motivo }
    }

    if (!dados) return NextResponse.json({ ok: false, motivo: 'item nao encontrado' })

    const emails = emailPara.split(',').filter(Boolean)
    const resultados = await Promise.all(
      emails.map(email => enviarNotificacao({ tipo: body.tipo, para: email.trim(), dados: dados! }))
    )

    return NextResponse.json({ ok: resultados.some(Boolean), enviados: resultados.filter(Boolean).length })
  } catch (e: unknown) {
    console.error('Notificacao error:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}
