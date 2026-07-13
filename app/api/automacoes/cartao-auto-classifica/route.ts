import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'

export const runtime = 'nodejs'

interface CartaoTransacao {
  id: string
  descricao: string
  valor: number
  categoria?: string
  estabelecimento?: string
  tipo?: string
}

export async function POST(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as { transacao_id?: string; auto_classifica?: boolean }
  const transacaoId = body.transacao_id
  if (!transacaoId) return NextResponse.json({ error: 'transacao_id obrigatório' }, { status: 400 })

  const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = (u?.empresa_id as string) ?? user.id

  try {
    const { data: tx } = await supabase.from('cartao_transacoes').select('*').eq('id', transacaoId).eq('empresa_id', empresaId).maybeSingle()
    if (!tx) return NextResponse.json({ error: 'Transação não encontrada' }, { status: 404 })

    // Auto-classifica se não tem categoria
    if (!tx.categoria || tx.categoria === 'nao_classificado') {
      const categoriaAuto = classificarAutomaticamente(tx.descricao, tx.estabelecimento)

      await supabase
        .from('cartao_transacoes')
        .update({ categoria: categoriaAuto, status: 'classificada' })
        .eq('id', transacaoId)

      return NextResponse.json({ ok: true, categoria_atribuida: categoriaAuto, foi_auto_classificado: true })
    }

    return NextResponse.json({ ok: true, categoria_atual: tx.categoria, foi_auto_classificado: false })
  } catch (e) {
    console.error('Cartao auto-classifica error:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha ao classificar' }, { status: 500 })
  }
}

function classificarAutomaticamente(descricao: string, estabelecimento: string = ''): string {
  const texto = `${descricao} ${estabelecimento}`.toLowerCase()

  const categorias: Record<string, string[]> = {
    alimentacao: ['restaurante', 'cafe', 'padaria', 'pizzaria', 'bar', 'churrascaria', 'comida', 'refeição', 'delivery', 'ifood', 'rappi', 'zé'],
    transporte: ['uber', 'taxi', 'gasolina', 'combustível', 'estacionamento', 'passagem', 'metrô', 'ônibus', 'ferry', '99'],
    internet_telefone: ['internet', 'telefone', 'claro', 'vivo', 'oi', 'tim', 'netflix', 'spotify'],
    energia_agua: ['energia', 'água', 'eletricidade', 'conta'],
    saude: ['farmácia', 'médico', 'hospital', 'dentista', 'clinica', 'farmácia', 'drauzio'],
    educacao: ['escola', 'universidade', 'curso', 'educação', 'livro'],
    viagem: ['hotel', 'airbnb', 'passagem aérea', 'voo', 'booking', 'turismo'],
    subscricoes: ['assinatura', 'premium', 'plano', 'mensalidade'],
    marketing: ['google ads', 'facebook ads', 'publicidade', 'anúncio', 'mídias'],
    software: ['software', 'app', 'saas', 'assinatura digital', 'microsoft', 'adobe', 'slack'],
  }

  for (const [cat, palavras] of Object.entries(categorias)) {
    if (palavras.some(p => texto.includes(p))) return cat
  }

  return 'outras'
}
