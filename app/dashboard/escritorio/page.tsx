'use client'

// O cockpit do escritório contábil virou a seção "Seus clientes" do Portal
// do Contador (Fase 5). Mantém essa rota só pra não quebrar link salvo.

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function EscritorioRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/dashboard/contabil-fiscal/portal-contador') }, [router])
  return null
}
