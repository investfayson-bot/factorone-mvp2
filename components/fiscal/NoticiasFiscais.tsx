'use client'

// Card "⚠ Mudanças de legislação" (Fase 5, Bloco 5) — lista de até 5
// notícias tributárias de RSS público (Receita Federal + Agência Brasil),
// via /api/fiscal/noticias. Auto-contido pra ser plugado em Impostos &
// Regime e na Visão Geral sem acoplar nas páginas.

import { useEffect, useState } from 'react'

type Noticia = { titulo: string; link: string; data: string | null; trecho: string; fonte: string }

export default function NoticiasFiscais() {
  const [noticias, setNoticias] = useState<Noticia[]>([])
  const [carregou, setCarregou] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch('/api/fiscal/noticias')
        const d = await r.json() as { noticias?: Noticia[] }
        if (r.ok) setNoticias(d.noticias ?? [])
      } catch { /* feed fora do ar não pode quebrar a página */ }
      finally { setCarregou(true) }
    })()
  }, [])

  if (carregou && noticias.length === 0) return null // sem notícia, sem card vazio

  return (
    <div className="card-v2" style={{ padding: 16 }}>
      <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--ink)', marginBottom: 10 }}>
        <i className="fa-solid fa-triangle-exclamation" style={{ color: '#B08A3E', marginRight: 7, fontSize: 13 }} />
        Mudanças de legislação
      </div>
      {!carregou ? (
        <div style={{ fontSize: 12.5, color: 'var(--mut)' }}>Buscando notícias…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {noticias.map(n => (
            <a key={n.link} href={n.link} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.45 }}>{n.titulo}</div>
              <div style={{ fontSize: 11, color: 'var(--mut)', fontWeight: 600, marginTop: 2 }}>
                {n.fonte}{n.data ? ` · ${new Date(n.data).toLocaleDateString('pt-BR')}` : ''}
              </div>
              {n.trecho && <div style={{ fontSize: 11.5, color: 'var(--mut)', lineHeight: 1.5, marginTop: 2 }}>{n.trecho}…</div>}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
