'use client'

// Índice do módulo Clientes & Vendas (Fase 6) — redireciona pra Visão
// Geral, mesmo padrão de banco/contabil-fiscal.

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ClientesVendasRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/dashboard/clientes-vendas/visao-geral') }, [router])
  return null
}
