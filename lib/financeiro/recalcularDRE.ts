import { createClient } from '@supabase/supabase-js'
import { calcularMetricasMes } from '@/lib/financeiro/calcularMetricas'

export async function recalcularDREMes(empresaId: string, competencia: Date): Promise<void> {
  await calcularMetricasMes(empresaId, competencia)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  await supabase.channel(`dre-refresh-${empresaId}`).send({
    type: 'broadcast',
    event: 'dre_recalculado',
    payload: { empresaId, competencia: competencia.toISOString().slice(0, 10) },
  })
}
