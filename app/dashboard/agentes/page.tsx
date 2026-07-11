'use client'

// Módulo Agentes IA virou rotas próprias por sub-aba (Fase 4) — este index
// só redireciona, mesmo padrão de /dashboard/banco e /dashboard/financeiro.

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AgentesRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/dashboard/agentes/acessor') }, [router])
  return null
}
