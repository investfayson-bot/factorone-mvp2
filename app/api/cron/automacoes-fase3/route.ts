import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

// Cron: processa automações de Fase 3 a cada 5 min
// Endpoints que chama:
// 1. Auto-classifica cartões sem categoria
// 2. Auto-qualifica leads sem temperatura
// 3. Avisa sobre saldos críticos

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')

  // Validação: só roda se chamado com token secreto (Vercel Cron)
  if (token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const tasks = [
      processarCartaosNaoClassificados(),
      processarLeadsSemTemperatura(),
      verificarSaldosCriticos(),
    ]

    const resultados = await Promise.allSettled(tasks)

    return NextResponse.json({
      ok: true,
      tasks: resultados.map((r, i) => ({
        task: ['cartoes', 'leads', 'saldos'][i],
        status: r.status,
        resultado: r.status === 'fulfilled' ? r.value : r.reason?.message || 'Erro',
      })),
    })
  } catch (e) {
    console.error('Cron automacoes error:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro no cron' }, { status: 500 })
  }
}

async function processarCartaosNaoClassificados() {
  // Pega cartões dos últimos 30 min sem categoria
  const limite = new Date(Date.now() - 30 * 60000).toISOString()

  const { data: cartoes } = await supabaseAdmin
    .from('cartao_transacoes')
    .select('id, empresa_id, descricao, estabelecimento')
    .is('categoria', null)
    .gte('created_at', limite)

  let processados = 0

  if (cartoes && cartoes.length > 0) {
    const categorias: Record<string, string[]> = {
      alimentacao: ['restaurante', 'cafe', 'padaria', 'comida', 'ifood', 'rappi'],
      transporte: ['uber', 'taxi', 'gasolina', 'estacionamento'],
      internet_telefone: ['internet', 'telefone', 'netflix', 'spotify'],
      energia_agua: ['energia', 'água', 'conta'],
      saude: ['farmácia', 'médico', 'hospital'],
      educacao: ['escola', 'universidade', 'curso'],
      viagem: ['hotel', 'airbnb', 'passagem', 'voo'],
      subscricoes: ['assinatura', 'premium', 'plano'],
      software: ['software', 'app', 'saas', 'slack', 'adobe'],
    }

    for (const c of cartoes) {
      const texto = `${c.descricao} ${c.estabelecimento || ''}`.toLowerCase()
      let categoriaauto = 'outras'

      for (const [cat, palavras] of Object.entries(categorias)) {
        if (palavras.some(p => texto.includes(p))) {
          categoriaauto = cat
          break
        }
      }

      await supabaseAdmin.from('cartao_transacoes').update({ categoria: categoriaauto }).eq('id', c.id)
      processados++
    }
  }

  return { processados }
}

async function processarLeadsSemTemperatura() {
  // Pega leads dos últimos 30 min sem temperatura
  const limite = new Date(Date.now() - 30 * 60000).toISOString()

  const { data: leads } = await supabaseAdmin
    .from('crm_oportunidades')
    .select('id, titulo')
    .is('temperatura', null)
    .in('etapa', ['prospeccao', 'qualificado'])
    .gte('created_at', limite)

  let processados = 0

  if (leads && leads.length > 0) {
    for (const lead of leads) {
      // Default: frio (não tem contexto)
      await supabaseAdmin
        .from('crm_oportunidades')
        .update({ temperatura: 'frio' })
        .eq('id', lead.id)
      processados++
    }
  }

  return { processados }
}

async function verificarSaldosCriticos() {
  // Verifica saldos baixos (< R$ 500) e notifica admin
  const { data: contas } = await supabaseAdmin
    .from('contas_bancarias')
    .select('id, empresa_id, nome, saldo_disponivel')
    .lt('saldo_disponivel', 500)

  let notificacoes_criadas = 0

  if (contas && contas.length > 0) {
    for (const conta of contas) {
      const { data: admin } = await supabaseAdmin
        .from('usuario_empresas')
        .select('user_id')
        .eq('empresa_id', conta.empresa_id)
        .eq('papel', 'admin')
        .limit(1)
        .maybeSingle()

      if (admin) {
        await supabaseAdmin.from('notificacoes').insert({
          empresa_id: conta.empresa_id,
          user_id: admin.user_id,
          tipo: 'critico',
          titulo: `Saldo crítico em ${conta.nome}`,
          descricao: `Saldo de ${conta.saldo_disponivel?.toFixed(2)} está abaixo de R$ 500`,
        })
        notificacoes_criadas++
      }
    }
  }

  return { contas_criticas: contas?.length || 0, notificacoes_criadas }
}
