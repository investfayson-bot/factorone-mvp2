'use client'

import { Component, type ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'

type Props = { children: ReactNode; title?: string }

type State = { hasError: boolean; message?: string }

export class DashboardErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(err: Error): State {
    return { hasError: true, message: err.message }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm">{this.props.title || 'Algo deu errado neste bloco'}</p>
              <p className="text-sm mt-1 opacity-90">
                {this.state.message || 'Tente recarregar a página ou voltar em instantes.'}
              </p>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
