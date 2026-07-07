import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'

async function empresaDe(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return { user: null, supabase, empresaId: '' }
  const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = (u?.empresa_id as string) || user.id
  return { user, supabase, empresaId }
}

export async function GET(req: NextRequest) {
  const { user, supabase, empresaId } = await empresaDe(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { data, error } = await supabase
    .from('tarefas')
    .select('id,projeto_id,parent_id,titulo,responsavel,prioridade,prazo,status,ordem,created_at')
    .eq('empresa_id', empresaId)
    .order('ordem', { ascending: true })
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tarefas: data ?? [] })
}

export async function POST(req: NextRequest) {
  const { user, supabase, empresaId } = await empresaDe(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const titulo = String(body.titulo || '').trim()
  if (!titulo) return NextResponse.json({ error: 'Informe o título da tarefa' }, { status: 400 })
  const row = {
    empresa_id: empresaId,
    projeto_id: body.projeto_id || null,
    parent_id: body.parent_id || null,
    titulo,
    responsavel: body.responsavel ? String(body.responsavel) : null,
    prioridade: ['baixa', 'media', 'alta', 'urgente'].includes(body.prioridade) ? body.prioridade : 'media',
    prazo: body.prazo || null,
    status: ['a_fazer', 'fazendo', 'rascunho', 'feito'].includes(body.status) ? body.status : 'a_fazer',
  }
  const { data, error } = await supabase.from('tarefas').insert(row).select('id,projeto_id,parent_id,titulo,responsavel,prioridade,prazo,status,ordem,created_at').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tarefa: data })
}
