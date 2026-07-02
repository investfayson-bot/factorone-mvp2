import type { BaaSProvider } from './types'
import { CelcoinProvider } from './celcoin'

export * from './types'

/**
 * Retorna o provider BaaS configurado via BAAS_PROVIDER (celcoin | dock | swap…),
 * ou null se nenhum estiver ativo (aí o app segue no fluxo simulado).
 */
export function getBaaS(): BaaSProvider | null {
  const provider = (process.env.BAAS_PROVIDER || '').toLowerCase()
  switch (provider) {
    case 'celcoin': return new CelcoinProvider()
    // TODO: 'dock', 'swap', 'matera', 'qitech' — cada um implementa BaaSProvider
    default: return null
  }
}

/** Resumo do estado da BaaS para UI / rota de status. */
export function baasStatus(): { ativo: boolean; configurado: boolean; provider: string | null; env: string | null } {
  const b = getBaaS()
  if (!b) return { ativo: false, configurado: false, provider: null, env: null }
  return { ativo: true, configurado: b.configurado(), provider: b.nome, env: b.env }
}
