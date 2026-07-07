'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import ChatWidget from '@/components/site/ChatWidget'

// Página que roda DENTRO do iframe do snippet embed (public/donna-embed.js),
// hospedada em domínios externos dos clientes. Sem chrome nenhum — só o
// widget, fundo transparente, tamanho controlado pelo loader via postMessage.
export default function WidgetEmbutido() {
  const { slug } = useParams<{ slug: string }>()
  const params = useSearchParams()
  const [site, setSite] = useState<{ nome: string | null; cor: string } | null>(null)

  useEffect(() => {
    document.documentElement.style.background = 'transparent'
    document.body.style.background = 'transparent'
  }, [])

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch(`/api/site/public/${slug}`)
        if (r.ok) { const j = await r.json(); setSite({ nome: j.site?.nome ?? null, cor: j.site?.cor ?? '#3D7A6E' }); return }
      } catch { /* segue pro fallback via querystring */ }
      setSite({ nome: params.get('nome'), cor: params.get('cor') || '#3D7A6E' })
    })()
  }, [slug, params])

  if (!site) return null

  return <ChatWidget slug={String(slug)} cor={site.cor} nome={site.nome ?? params.get('nome') ?? ''} embutido />
}
