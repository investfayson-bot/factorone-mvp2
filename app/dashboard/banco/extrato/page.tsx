import Link from 'next/link'

// Extrato consolidado (Fase 3) ainda não foi construído nesta rota — a versão
// funcional continua em /dashboard/conta-pj/extrato enquanto isso. Ver
// docs/factorone-cursor-package/FASE-3-banco-investimentos-ocr.md.
export default function BancoExtratoEmConstrucao() {
  return (
    <div className="card-v2" style={{ textAlign: 'center', padding: 40 }}>
      <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 6 }}>Extrato consolidado — em construção</div>
      <div style={{ fontSize: 12.5, color: 'var(--mut)', marginBottom: 14 }}>Esta sub-aba ainda está sendo migrada. Por enquanto, use a tela de extrato atual.</div>
      <Link href="/dashboard/conta-pj/extrato" className="btn-v2 primary" style={{ textDecoration: 'none', display: 'inline-block' }}>Ir para o Extrato atual</Link>
    </div>
  )
}
