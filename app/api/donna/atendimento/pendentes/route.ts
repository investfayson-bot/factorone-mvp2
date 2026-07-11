import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'

type Pendente = {
  id: string
  canal: 'site' | 'email'
  contato: string
  trecho: string
  motivo: string
  created_at: string
  link: string
}

export async function GET(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = (u?.empresa_id as string) || user.id

  const [conversasRes, emailsRes] = await Promise.all([
    supabase
      .from('atendimento_conversas')
      .select('id,visitante_nome,motivo,updated_at')
      .eq('empresa_id', empresaId)
      .eq('status', 'aguardando_humano')
      .order('updated_at', { ascending: false })
      .limit(30),
    supabase
      .from('donna_emails_processados')
      .select('id,remetente,assunto,snippet,created_at,regra_id,donna_regras(nome,criterio)')
      .eq('empresa_id', empresaId)
      .eq('status', 'pendente_aprovacao')
      .order('created_at', { ascending: false })
      .limit(30),
  ])

  const conversas = (conversasRes.data ?? []) as { id: string; visitante_nome: string | null; motivo: string | null; updated_at: string }[]
  const conversaIds = conversas.map(c => c.id)

  const trechoPorConversa = new Map<string, string>()
  if (conversaIds.length > 0) {
    const { data: mensagens } = await supabase
      .from('atendimento_mensagens')
      .select('conversa_id,texto,autor,created_at')
      .in('conversa_id', conversaIds)
      .eq('autor', 'visitante')
      .order('created_at', { ascending: false })
    for (const m of (mensagens ?? []) as { conversa_id: string; texto: string }[]) {
      if (!trechoPorConversa.has(m.conversa_id)) trechoPorConversa.set(m.conversa_id, m.texto)
    }
  }

  const pendentesConversas: Pendente[] = conversas.map(c => ({
    id: c.id,
    canal: 'site',
    contato: `${c.visitante_nome || 'Visitante'} · Site`,
    trecho: trechoPorConversa.get(c.id) || '',
    motivo: c.motivo || 'Aguardando sua resposta',
    created_at: c.updated_at,
    link: `/dashboard/agentes/conversas?conversa=${c.id}`,
  }))

  type RegraEmbed = { nome: string | null; criterio: string }
  type EmailRow = { id: string; remetente: string; assunto: string | null; snippet: string | null; created_at: string; donna_regras: RegraEmbed | RegraEmbed[] | null }
  const pendentesEmails: Pendente[] = ((emailsRes.data ?? []) as unknown as EmailRow[]).map(e => {
    const regra = Array.isArray(e.donna_regras) ? (e.donna_regras[0] ?? null) : e.donna_regras
    return {
      id: e.id,
      canal: 'email' as const,
      contato: `${e.remetente} · E-mail`,
      trecho: e.assunto || e.snippet || '',
      motivo: regra ? `Regra "${regra.nome ?? regra.criterio}" está em modo rascunho — aguardando sua aprovação` : 'Resposta de e-mail preparada aguardando sua aprovação',
      created_at: e.created_at,
      link: `/dashboard/agentes/automacoes?tab=emails`,
    }
  })

  const pendentes = [...pendentesConversas, ...pendentesEmails].sort((a, b) => b.created_at.localeCompare(a.created_at))
  return NextResponse.json({ pendentes })
}
