'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export type Plano = 'trial' | 'starter' | 'pro' | 'enterprise'

export function usePlano() {
  const [plano, setPlano] = useState<Plano>('trial')
  const [planoAtivo, setPlanoAtivo] = useState(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setLoading(false); return }
      const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
      const eid = u?.empresa_id ?? user.id
      const { data: emp } = await supabase.from('empresas').select('plano,plano_ativo').eq('id', eid).maybeSingle()
      if (emp) {
        setPlano((emp.plano as Plano) ?? 'trial')
        setPlanoAtivo(emp.plano_ativo ?? true)
      }
      setLoading(false)
    })
  }, [])

  const isPlus = planoAtivo && (plano === 'pro' || plano === 'enterprise')
  const isEnterprise = planoAtivo && plano === 'enterprise'

  return { plano, planoAtivo, isPlus, isEnterprise, loading }
}
