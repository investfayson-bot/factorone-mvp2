'use client'
import Link from 'next/link'

export default function VoltarSolucao({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: 'var(--mut)', textDecoration: 'none', marginBottom: 14 }}
    >
      <i className="fa-solid fa-arrow-left" style={{ fontSize: 11 }} />
      Voltar para {label}
    </Link>
  )
}
