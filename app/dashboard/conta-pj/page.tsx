'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import AberturaContaWizard from '@/components/conta-pj/AberturaContaWizard'
import DashboardBancario from '@/components/conta-pj/DashboardBancario'

export default function ContaPJPage() {
  const [loading, setLoading] = useState(true)
  const [empresaId, setEmpresaId] = useState('')
  const [empresaNome, setEmpresaNome] = useState('Minha Empresa')
  const [empresaCnpj, setEmpresaCnpj] = useState('')
  const [conta, setConta] = useState<{ id: string; saldo_disponivel: number; saldo_bloqueado: number; saldo: number } | null>(null)
  const [contaPendente, setContaPendente] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const userRow = await supabase.from('usuarios').select('empresa_id, nome').eq('id', user.id).maybeSingle()
    const id = (userRow.data?.empresa_id as string) || user.id
    setEmpresaId(id)
    setEmpresaNome(userRow.data?.nome || 'Minha Empresa')
    const empresa = await supabase.from('empresas').select('cnpj, nome').eq('id', id).maybeSingle()
    setEmpresaCnpj((empresa.data?.cnpj as string) || '')
    setEmpresaNome((empresa.data?.nome as string) || userRow.data?.nome || 'Minha Empresa')
    const temConta = await supabase.from('contas_bancarias').select('*').eq('empresa_id', id).eq('status', 'ativa').maybeSingle()
    const pend = await supabase.from('contas_bancarias').select('id').eq('empresa_id', id).eq('status', 'pendente').maybeSingle()
    setContaPendente(Boolean(pend.data))
    setConta(temConta.data || null)
    setLoading(false)
  }, [])
  useEffect(() => {
    void carregar()
  }, [carregar])

  if (loading) return <div className="p-6">Carregando Conta PJ...</div>
  return <div className="bg-slate-50">{conta ? <DashboardBancario empresaId={empresaId} empresaNome={empresaNome} empresaCnpj={empresaCnpj} conta={conta} /> : <div className="p-6 space-y-4">{contaPendente && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Sua solicitação de conta PJ está em análise. Enquanto isso, você pode revisar seus dados abaixo.</div>}<AberturaContaWizard /></div>}</div>
}
