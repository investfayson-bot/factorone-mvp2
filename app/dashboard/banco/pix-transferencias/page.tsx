import Link from 'next/link'

// PIX & Transferências (Fase 3) ainda não foi construído nesta rota — a
// versão funcional (agendamento manual, transferencias_agendadas) continua
// em /dashboard/conta-pj/transferencias enquanto isso.
export default function BancoPixEmConstrucao() {
  return (
    <div className="card-v2" style={{ textAlign: 'center', padding: 40 }}>
      <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 6 }}>PIX & Transferências — em construção</div>
      <div style={{ fontSize: 12.5, color: 'var(--mut)', marginBottom: 14 }}>Esta sub-aba ainda está sendo migrada. Por enquanto, use a tela atual.</div>
      <Link href="/dashboard/conta-pj/transferencias" className="btn-v2 primary" style={{ textDecoration: 'none', display: 'inline-block' }}>Ir para Transferências atual</Link>
    </div>
  )
}
