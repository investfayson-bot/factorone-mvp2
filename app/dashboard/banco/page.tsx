'use client'

// Módulo Banco virou rotas próprias por sub-aba (Fase 3) — este index só
// redireciona. Preserva o link ?aba=fila usado por conciliacao/assistente/
// classificar (a Fila de confirmação virou o filtro "Aguardando OK" do
// Extrato novo). Os componentes antigos (VisaoGeralTab/FilaTab/ExtratoTab/
// ResumoTab) continuam no repo, só não são mais renderizados por aqui.

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function BancoRedirect() {
  const router = useRouter()
  const params = useSearchParams()

  useEffect(() => {
    const aba = params.get('aba')
    if (aba === 'fila') router.replace('/dashboard/banco/extrato?status=aguardando')
    else router.replace('/dashboard/banco/visao-geral')
  }, [params, router])

  return null
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <BancoRedirect />
    </Suspense>
  )
}
