import Link from 'next/link'

// Cartões (Fase 3, com detalhamento de parcelas por empresa/segmento) ainda
// não foi construído nesta rota — a versão funcional (visual estilo Clara)
// continua em /dashboard/cartoes enquanto isso.
export default function BancoCartoesEmConstrucao() {
  return (
    <div className="card-v2" style={{ textAlign: 'center', padding: 40 }}>
      <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 6 }}>Cartões — em construção</div>
      <div style={{ fontSize: 12.5, color: 'var(--mut)', marginBottom: 14 }}>Esta sub-aba ainda está sendo migrada. Por enquanto, use a tela atual.</div>
      <Link href="/dashboard/cartoes" className="btn-v2 primary" style={{ textDecoration: 'none', display: 'inline-block' }}>Ir para Cartões atual</Link>
    </div>
  )
}
