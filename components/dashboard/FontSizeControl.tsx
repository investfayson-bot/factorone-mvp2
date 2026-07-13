'use client'
import { useEffect, useState } from 'react'

type Tamanho = 'sm' | 'md' | 'lg'
const STORAGE_KEY = 'fo-font-size'

function aplicar(tamanho: Tamanho) {
  if (tamanho === 'md') document.documentElement.removeAttribute('data-font-size')
  else document.documentElement.setAttribute('data-font-size', tamanho)
  localStorage.setItem(STORAGE_KEY, tamanho)
}

export default function FontSizeControl() {
  const [tamanho, setTamanho] = useState<Tamanho>('md')

  useEffect(() => {
    const salvo = localStorage.getItem(STORAGE_KEY)
    if (salvo === 'sm' || salvo === 'lg' || salvo === 'md') setTamanho(salvo)
  }, [])

  function escolher(t: Tamanho) {
    setTamanho(t)
    aplicar(t)
  }

  const OPCOES: { valor: Tamanho; label: string; fontSize: number }[] = [
    { valor: 'sm', label: 'A', fontSize: 12 },
    { valor: 'md', label: 'A', fontSize: 15 },
    { valor: 'lg', label: 'A', fontSize: 18 },
  ]

  return (
    <div style={{ background: 'var(--card, #fff)', border: '1px solid var(--line, #e2e8f0)', borderRadius: 12, padding: 24, marginTop: 16 }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Tamanho da fonte</div>
      <div style={{ fontSize: 13, color: 'var(--mut, #7B8C88)', marginBottom: 16 }}>
        Ajusta o tamanho de texto e ícones em todo o sistema. Fica salvo neste navegador.
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {OPCOES.map(o => (
          <button
            key={o.valor}
            onClick={() => escolher(o.valor)}
            style={{
              width: 44, height: 44, borderRadius: 9, cursor: 'pointer',
              border: tamanho === o.valor ? '2px solid var(--sage, #3D7A6E)' : '1px solid var(--line, #e2e8f0)',
              background: tamanho === o.valor ? 'var(--sage-tint, #E9F0ED)' : 'transparent',
              color: 'var(--ink, #13201D)', fontWeight: 700, fontSize: o.fontSize,
            }}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
