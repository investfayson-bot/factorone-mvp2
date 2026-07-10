'use client'

// A Donna deixou de ser uma persona separada — a funcionalidade dela virou
// duas soluções: Conversas (atendimento multi-canal) e Automações (regras
// de autonomia + fila de e-mails). Mantém essa rota só pra não quebrar link
// salvo/favoritado.

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function DonnaRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/dashboard/agentes/conversas') }, [router])
  return null
}
