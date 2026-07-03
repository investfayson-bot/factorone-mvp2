'use client'
import { useEffect, useState } from 'react'

/** Alterna tema claro/escuro (verde clarinho ↔ verde-floresta). Persiste em localStorage. */
export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    const saved = (localStorage.getItem('fo-theme') as 'light' | 'dark' | null)
    const initial = saved ?? (document.documentElement.dataset.theme as 'light' | 'dark') ?? 'light'
    setTheme(initial)
    document.documentElement.dataset.theme = initial
  }, [])

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.dataset.theme = next
    try { localStorage.setItem('fo-theme', next) } catch { /* ignore */ }
  }

  const isDark = theme === 'dark'
  return (
    <button
      onClick={toggle}
      title={isDark ? 'Tema claro' : 'Tema escuro'}
      aria-label={isDark ? 'Ativar tema claro' : 'Ativar tema escuro'}
      style={{
        display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer',
        border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-soft)',
        borderRadius: 100, padding: compact ? '6px 8px' : '6px 12px', fontSize: 11.5, fontWeight: 600,
        fontFamily: 'var(--font-sans)', transition: 'all .15s',
      }}
    >
      <i className={`fa-solid ${isDark ? 'fa-sun' : 'fa-moon'}`} style={{ fontSize: 12, color: isDark ? 'var(--gold)' : 'var(--sage)' }} />
      {!compact && (isDark ? 'Claro' : 'Escuro')}
    </button>
  )
}
