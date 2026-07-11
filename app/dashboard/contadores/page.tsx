'use client'

// O Portal do Contador virou sub-aba de Contábil & Fiscal (Fase 5). O
// convite com login completo e a gestão dos links antigos por token estão
// lá. Mantém essa rota só pra não quebrar link salvo/favoritado.

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ContadoresRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/dashboard/contabil-fiscal/portal-contador') }, [router])
  return null
}
