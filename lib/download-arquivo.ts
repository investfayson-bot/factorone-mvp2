import { supabase } from '@/lib/supabase'

/**
 * Baixa um arquivo de uma API route autenticada (PDF, Excel, CSV etc).
 * Resolve dois bugs comuns:
 * 1. <a href="/api/..."> não envia o header Authorization — APIs que
 *    exigem login sempre retornam 401 quando acessadas assim.
 * 2. fetch() sem checar res.ok trata uma resposta de erro como se fosse
 *    o arquivo, baixando um .pdf/.xlsx corrompido sem nenhum aviso.
 *
 * Use isso em vez de <a href="/api/...">, e em vez de fetch() cru.
 */
export async function baixarArquivo(url: string, nomeArquivoFallback: string): Promise<{ ok: true } | { ok: false; erro: string }> {
  try {
    const { data: sess } = await supabase.auth.getSession()
    const token = sess.session?.access_token

    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })

    if (!res.ok) {
      let erro = `Falha ao gerar arquivo (HTTP ${res.status})`
      try {
        const body = await res.json()
        if (body?.error) erro = body.error
      } catch {
        // resposta não era JSON, mantém mensagem genérica
      }
      return { ok: false, erro }
    }

    const blob = await res.blob()
    if (blob.size === 0) {
      return { ok: false, erro: 'Arquivo gerado está vazio. Tente novamente.' }
    }

    const disposition = res.headers.get('content-disposition') || ''
    const match = disposition.match(/filename="?([^"]+)"?/)
    const nomeArquivo = match?.[1] || nomeArquivoFallback

    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = nomeArquivo
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(blobUrl)

    return { ok: true }
  } catch (e: unknown) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Erro de conexão ao baixar arquivo' }
  }
}
