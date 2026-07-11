'use client'

// Cofre Fiscal (Fase 5) — vault de documentos fiscais com filtro por
// tipo/competência. É o Bloco 2, ainda não construído. Placeholder honesto
// linkando pro que já guarda documento hoje. (Não confundir com
// /dashboard/cofre, que é vault de senhas/chaves — só colisão de nome.)

import Link from 'next/link'

const ATALHOS = [
  { href: '/dashboard/notas', icone: 'fa-file-invoice', titulo: 'Notas fiscais', desc: 'XML e PDF das NF-e/NFS-e emitidas e recebidas' },
  { href: '/dashboard/despesas', icone: 'fa-receipt', titulo: 'Recibos & comprovantes', desc: 'Comprovantes anexados às despesas' },
  { href: '/dashboard/contabilidade', icone: 'fa-book', titulo: 'Contabilidade', desc: 'Recibos com OCR, lançamentos e Tributação IA' },
]

export default function CofreFiscalPage() {
  return (
    <div style={{ maxWidth: 760, paddingBottom: 30 }}>
      <div className="card-v2" style={{ padding: '34px 24px', textAlign: 'center', marginBottom: 16 }}>
        <i className="fa-solid fa-vault" style={{ fontSize: 30, color: 'var(--acc)', marginBottom: 12, display: 'block' }} />
        <div style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--ink)', marginBottom: 6 }}>Cofre Fiscal — em construção</div>
        <div style={{ fontSize: 13, color: 'var(--mut)', maxWidth: 480, margin: '0 auto', lineHeight: 1.6 }}>
          Aqui vai ficar o arquivo único de documentos fiscais da empresa — guias, declarações, certidões e notas,
          filtráveis por tipo e competência. Enquanto não chega, seus documentos continuam nos lugares de sempre:
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {ATALHOS.map(a => (
          <Link key={a.href} href={a.href} style={{ textDecoration: 'none' }}>
            <div className="card-v2" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
              <i className={`fa-solid ${a.icone}`} style={{ fontSize: 17, color: 'var(--acc)', width: 24, textAlign: 'center' }} />
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{a.titulo}</div>
                <div style={{ fontSize: 12, color: 'var(--mut)' }}>{a.desc}</div>
              </div>
              <i className="fa-solid fa-arrow-right" style={{ marginLeft: 'auto', color: 'var(--mut)', fontSize: 12 }} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
