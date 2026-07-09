import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

type Regra = {
  id: string
  empresa_id: string
  nome: string
  tipo: string
  ativa: boolean
  config: Record<string, unknown>
}

function svc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function inserirNotif(supabase: ReturnType<typeof svc>, empresaId: string, titulo: string, mensagem: string, tipo: string, modulo: string, link: string | null) {
  await supabase.from('notificacoes').insert({ empresa_id: empresaId, titulo, mensagem, tipo, modulo, link, lida: false })
}

export async function POST(req: NextRequest) {
  const { user } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = svc()
  const { data: u } = await db.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = u?.empresa_id as string ?? user.id

  const { data: regras } = await db.from('automacoes_regras').select('*').eq('empresa_id', empresaId).eq('ativa', true)
  if (!regras?.length) return NextResponse.json({ processadas: 0 })

  let count = 0
  const hoje = new Date()

  for (const regra of regras as Regra[]) {
    const cfg = regra.config ?? {}
    try {
      if (regra.tipo === 'conta_vencendo') {
        const dias = Number(cfg.dias ?? 3)
        const alvo = new Date(hoje)
        alvo.setDate(alvo.getDate() + dias)
        const isoAlvo = alvo.toISOString().slice(0, 10)
        const isoHoje = hoje.toISOString().slice(0, 10)
        const { data: contas } = await db.from('contas_pagar').select('id,descricao,valor,data_vencimento').eq('empresa_id', empresaId).eq('status', 'pendente').gte('data_vencimento', isoHoje).lte('data_vencimento', isoAlvo)
        for (const c of contas ?? []) {
          await inserirNotif(db, empresaId, `Conta vencendo em ${dias}d`, `${c.descricao} — R$ ${Number(c.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'aviso', 'financeiro', '/dashboard/financeiro')
          count++
        }
      }

      if (regra.tipo === 'saldo_baixo') {
        const limite = Number(cfg.valor_limite ?? 5000)
        const { data: saldo } = await db.from('contas_bancarias').select('saldo_atual').eq('empresa_id', empresaId).order('saldo_atual', { ascending: true }).limit(1).maybeSingle()
        const s = Number(saldo?.saldo_atual ?? 0)
        if (s < limite) {
          await inserirNotif(db, empresaId, 'Saldo baixo detectado', `Saldo da conta está em R$ ${s.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} — abaixo do limite de R$ ${limite.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'erro', 'financeiro', '/dashboard/banco')
          count++
        }
      }

      if (regra.tipo === 'reembolso_pendente') {
        const diasLimite = Number(cfg.dias ?? 5)
        const limite = new Date(hoje)
        limite.setDate(limite.getDate() - diasLimite)
        const { data: items } = await db.from('reembolsos').select('id,descricao,solicitante_nome').eq('empresa_id', empresaId).eq('status', 'pendente').lt('created_at', limite.toISOString())
        if ((items?.length ?? 0) > 0) {
          await inserirNotif(db, empresaId, `${items!.length} reembolso(s) sem resposta há ${diasLimite}+ dias`, items!.map(i => i.solicitante_nome ?? i.descricao).join(', '), 'aviso', 'reembolsos', '/dashboard/reembolsos')
          count++
        }
      }

      if (regra.tipo === 'oportunidade_sem_followup') {
        const dias = Number(cfg.dias ?? 7)
        const limite = new Date(hoje)
        limite.setDate(limite.getDate() - dias)
        const { data: ops } = await db.from('crm_oportunidades').select('id,titulo').eq('empresa_id', empresaId).not('etapa', 'in', '("ganho","perdido")').lt('updated_at', limite.toISOString()).limit(5)
        if ((ops?.length ?? 0) > 0) {
          await inserirNotif(db, empresaId, `${ops!.length} oportunidade(s) sem follow-up há ${dias}+ dias`, ops!.map(o => o.titulo).join(', '), 'aviso', 'crm', '/dashboard/crm')
          count++
        }
      }

      if (regra.tipo === 'pneu_desgaste') {
        const pctLimite = Number(cfg.pct ?? 80)
        const { data: pneus } = await db.from('logistica_pneus').select('id,posicao,marca,desgaste_pct').eq('empresa_id', empresaId).gte('desgaste_pct', pctLimite)
        for (const p of pneus ?? []) {
          await inserirNotif(db, empresaId, `Pneu ${p.posicao} com ${p.desgaste_pct}% de desgaste`, `${p.marca ?? 'Pneu'} — ação necessária`, 'aviso', 'logistica', '/dashboard/logistica')
          count++
        }
      }

      await db.from('automacoes_regras').update({ ultima_exec: new Date().toISOString() }).eq('id', regra.id)
    } catch {
      // skip failed rule, continue others
    }
  }

  return NextResponse.json({ processadas: count })
}
