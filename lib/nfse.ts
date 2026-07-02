/**
 * NFS-e (nota fiscal de serviço municipal) via AGREGADOR.
 * Cada prefeitura tem um webservice diferente — por isso usamos um agregador
 * (NFE.IO, PlugNotas, Focus NFe) que já conectou TODAS as prefeituras, em vez de
 * integrar município por município. Trocar de agregador = trocar o adapter.
 *
 * Ative preenchendo NFSE_PROVIDER=nfeio e NFEIO_API_KEY no ambiente.
 */
export function nfseStatus(): { ativo: boolean; configurado: boolean; provider: string | null } {
  const provider = (process.env.NFSE_PROVIDER || '').toLowerCase()
  const configurado = provider === 'nfeio' ? Boolean(process.env.NFEIO_API_KEY) : false
  return { ativo: Boolean(provider), configurado, provider: provider || null }
}
