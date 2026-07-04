import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Público: o cliente vê a config + horários ocupados, e marca.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const d = db()
  const { data: cfg } = await d.from('agenda_config').select('*').eq('token', token).maybeSingle()
  if (!cfg) return NextResponse.json({ error: 'Link inválido' }, { status: 404 })
  const hoje = new Date().toISOString().slice(0, 10)
  const fim = new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10)
  const { data: atv } = await d.from('crm_atividades').select('data,hora_inicio').eq('empresa_id', cfg.empresa_id).eq('tipo', 'reuniao').gte('data', hoje).lte('data', fim)
  const ocupados = ((atv ?? []) as { data: string; hora_inicio: string | null }[]).map(a => `${a.data} ${a.hora_inicio ?? ''}`.trim())
  return NextResponse.json({ titulo: cfg.titulo, duracao: cfg.duracao, hora_inicio: cfg.hora_inicio, hora_fim: cfg.hora_fim, dias: cfg.dias, ocupados })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const d = db()
  const { data: cfg } = await d.from('agenda_config').select('empresa_id,titulo').eq('token', token).maybeSingle()
  if (!cfg) return NextResponse.json({ error: 'Link inválido' }, { status: 404 })
  const b = await req.json().catch(() => ({})) as { data?: string; hora?: string; nome?: string; email?: string; telefone?: string }
  if (!b.data || !b.hora || !b.nome?.trim()) return NextResponse.json({ error: 'Preencha data, horário e nome' }, { status: 400 })

  // já ocupado?
  const { data: existe } = await d.from('crm_atividades').select('id').eq('empresa_id', cfg.empresa_id).eq('tipo', 'reuniao').eq('data', b.data).eq('hora_inicio', b.hora).limit(1)
  if (existe && existe.length) return NextResponse.json({ error: 'Esse horário acabou de ser preenchido. Escolha outro.' }, { status: 409 })

  await d.from('crm_atividades').insert({ empresa_id: cfg.empresa_id, tipo: 'reuniao', titulo: `${cfg.titulo} — ${b.nome.trim()}`, data: b.data, hora_inicio: b.hora, descricao: `Agendado pelo cliente · ${b.email ?? ''} · ${b.telefone ?? ''}`, responsavel_nome: b.nome.trim(), status: 'pendente' })
  await d.from('marketing_leads').insert({ empresa_id: cfg.empresa_id, nome: b.nome.trim(), email: b.email ?? null, telefone: b.telefone ?? null, origem: 'Agendamento', status: 'novo' })
  return NextResponse.json({ ok: true })
}
