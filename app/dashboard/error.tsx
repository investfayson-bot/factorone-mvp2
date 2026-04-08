'use client'

import { useEffect } from 'react'
import { AlertCircle } from 'lucide-react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-[40vh] flex items-center justify-center p-8">
      <div className="max-w-md w-full rounded-2xl border border-red-200 bg-red-50 p-8 text-center shadow-sm">
        <AlertCircle className="w-10 h-10 text-red-600 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-red-900">Erro no painel</h2>
        <p className="text-sm text-red-800/90 mt-2">{error.message || 'Ocorreu um erro inesperado.'}</p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 w-full rounded-xl bg-red-700 hover:bg-red-800 text-white font-medium py-2.5 text-sm transition-colors"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  )
}
