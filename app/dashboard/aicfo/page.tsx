'use client'

// O chat do AI CFO virou a sub-aba Acessor dentro de Agentes IA (Fase 4).
// Mantém essa rota só pra não quebrar link salvo/favoritado.

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AicfoRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/dashboard/agentes/acessor') }, [router])
  return null
}
