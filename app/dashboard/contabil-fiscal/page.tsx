'use client'

// Índice do módulo Contábil & Fiscal (Fase 5) — só redireciona pra Visão
// Geral, mesmo padrão de app/dashboard/banco/page.tsx.

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ContabilFiscalRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/dashboard/contabil-fiscal/visao-geral') }, [router])
  return null
}
