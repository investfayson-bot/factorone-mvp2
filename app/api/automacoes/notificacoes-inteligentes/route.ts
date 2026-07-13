import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'

export const runtime = 'nodejs'

type TipoNotificacao = 'critico' | 'importante' | 'informativo' | 'departamento'

interface NotificacaoPayload {
  tipo: TipoNotificacao
  titulo: string
  descricao?: string
  departamento_id?: string
  usuario_id?: string
  acoes?: Array<{ label: string; url: string }>
}

export async function POST(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as NotificacaoPayload
  const { tipo, titulo, descricao, departamento_id, usuario_id } = body

  if (!titulo) return NextResponse.json({ error: 'Título obrigatório' }, { status: 400 })

  const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = (u?.empresa_id as string) ?? user.id

  try {
    // Filtra agilidade: se é crítico, notifica admin + chefe de setor
    // Se é departamento, só notifica membros daquele setor
    let usuarios_notificar: string[] = []

    if (tipo === 'critico') {
      // Admin + todos chefes de departamento
      const { data: admins } = await supabase.from('usuario_empresas').select('user_id').eq('empresa_id', empresaId).eq('papel', 'admin')
      usuarios_notificar = admins?.map(a => a.user_id) || []
    } else if (tipo === 'departamento' && departamento_id) {
      // Membros do departamento
      const { data: membros } = await supabase
        .from('departamento_membros')
        .select('user_id')
        .eq('departamento_id', departamento_id)
      usuarios_notificar = membros?.map(m => m.user_id) || []
    } else if (usuario_id) {
      usuarios_notificar = [usuario_id]
    }

    // Cria notificação para cada usuário
    const notificacoes = usuarios_notificar.map(uid => ({
      empresa_id: empresaId,
      user_id: uid,
      tipo,
      titulo,
      descricao: descricao || null,
      departamento_id: departamento_id || null,
      lida: false,
      created_at: new Date().toISOString(),
    }))

    if (notificacoes.length > 0) {
      const { error } = await supabase.from('notificacoes').insert(notificacoes)
      if (error) throw error
    }

    // Emite evento real-time se é crítico (urgente)
    if (tipo === 'critico' && usuarios_notificar.length > 0) {
      supabase.channel(`notif:${empresaId}`).send({
        type: 'broadcast',
        event: 'notificacao_critica',
        payload: { titulo, descricao, usuarios: usuarios_notificar },
      }).catch(() => null)
    }

    return NextResponse.json({
      ok: true,
      notificacoes_criadas: notificacoes.length,
      usuarios_notificados: usuarios_notificar,
    })
  } catch (e) {
    console.error('Notificacao error:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha ao criar notificação' }, { status: 500 })
  }
}

// GET: listar notificações do usuário
export async function GET(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = (u?.empresa_id as string) ?? user.id

  try {
    const { data } = await supabase
      .from('notificacoes')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    const naoLidas = data?.filter(n => !n.lida).length || 0

    return NextResponse.json({ notificacoes: data, nao_lidas: naoLidas })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha ao listar' }, { status: 500 })
  }
}
