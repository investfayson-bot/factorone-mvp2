import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { calcularMetricasMes } from '@/lib/financeiro/calcularMetricas'
import { emailRelatorioMensal } from '@/lib/email/notificacoes'

export const runtime = 'nodejs'
export const maxDuration = 300

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// Roda dia 1 de cada mês (vercel.json). Manda o resumo do mês ANTERIOR pro
// admin de cada empresa ativa. Empresa sem e-mail de admin ou sem
// RESEND_API_KEY configurada é pulada silenciosamente — mesmo padrão de
// tolerância a erro dos outros crons (não derruba o job inteiro).
export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const supabase = db()
  const hoje = new Date()
  const mesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)
  const mesRetrasado = new Date(hoje.getFullYear(), hoje.getMonth() - 2, 1)
  const competenciaLabel = mesAnterior.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  const { data: empresas } = await supabase.from('empresas').select('id, nome, relatorio_mensal_nivel')

  let enviados = 0
  const erros: string[] = []

  for (const emp of empresas ?? []) {
    try {
      const empresaId = emp.id as string
      const { data: dono } = await supabase
        .from('usuarios')
        .select('email')
        .eq('empresa_id', empresaId)
        .not('email', 'is', null)
        .limit(1)
        .maybeSingle()
      if (!dono?.email) continue

      const metricas = await calcularMetricasMes(empresaId, mesAnterior)
      const metricasAnterior = await calcularMetricasMes(empresaId, mesRetrasado)
      const variacaoLucroPct = metricasAnterior.lucro_liquido !== 0
        ? ((metricas.lucro_liquido - metricasAnterior.lucro_liquido) / Math.abs(metricasAnterior.lucro_liquido)) * 100
        : null

      const ok = await emailRelatorioMensal(
        dono.email as string,
        (emp.nome as string) || 'Sua empresa',
        competenciaLabel,
        metricas,
        variacaoLucroPct
      )
      if (ok) enviados++
    } catch (e) {
      erros.push(`${emp.id}: ${e instanceof Error ? e.message : 'erro'}`)
    }
  }

  return NextResponse.json({ empresas: (empresas ?? []).length, enviados, erros })
}
