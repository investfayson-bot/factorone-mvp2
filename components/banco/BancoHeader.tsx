'use client'
import { useEffect, useRef, useState } from 'react'
import { formatBRL } from '@/lib/currency-brl'
import { fmtBRLCompact } from '@/lib/dre-calculations'
import { maskCpfCnpj } from '@/lib/masks'

export type ContaBancaria = {
  id: string; saldo_disponivel: number; saldo: number
  agencia?: string | null; numero_conta?: string | null; digito?: string | null
  banco_nome?: string | null
}

type Props = {
  empresaNome: string; empresaCnpj: string | null
  contas: ContaBancaria[]
  receber30: { valor: number; duplicatas: number }
}

export default function BancoHeader({ empresaNome, empresaCnpj, contas, receber30 }: Props) {
  const [hide, setHide] = useState(false)
  const [compact, setCompact] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setHide(localStorage.getItem('banco-hide-saldo') === '1')
  }, [])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => setCompact(!entry.isIntersecting), { threshold: 0 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  function toggleHide() {
    const n = !hide; setHide(n)
    localStorage.setItem('banco-hide-saldo', n ? '1' : '0')
  }

  const saldoTotal = contas.reduce((s, c) => s + Number(c.saldo_disponivel || 0), 0)
  const principal = contas[0]
  const linhaCc = principal?.numero_conta
    ? `AG ${principal.agencia || '0001'} · CC ${principal.numero_conta}${principal.digito != null ? `-${principal.digito}` : ''}`
    : `${contas.length} conta${contas.length === 1 ? '' : 's'} conectada${contas.length === 1 ? '' : 's'}`

  return (
    <>
      <div ref={sentinelRef} style={{ height: 1 }} />
      {compact ? (
        <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--surface, #fff)', borderBottom: '1px solid var(--line, #E4DCCC)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12, borderRadius: '0 0 14px 14px' }}>
          <i className="fa-solid fa-building-columns" style={{ color: 'var(--sage)' }} />
          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>{hide ? '••••••' : formatBRL(saldoTotal)}</span>
          <span style={{ fontSize: 13, color: 'var(--ink-mut)' }}>saldo disponível</span>
          <button className="btn-ghost" style={{ marginLeft: 'auto', fontSize: 12, padding: '4px 10px' }} onClick={toggleHide}>{hide ? 'Mostrar' : 'Ocultar'}</button>
        </div>
      ) : (
        <>
          <div className="page-hdr">
            <div>
              <div className="page-title">Banco</div>
              <div className="page-sub">{empresaNome}{empresaCnpj ? ` · ${maskCpfCnpj(empresaCnpj)}` : ''}</div>
            </div>
            <button className="btn-action btn-ghost" style={{ fontSize: 13 }} onClick={toggleHide}>
              {hide ? '👁 Mostrar saldos' : '🙈 Ocultar saldos'}
            </button>
          </div>
          <div className="bank-cards">
            <div className="bank-card dark" style={{ borderRadius: 18 }}>
              <div className="bc-lbl">Saldo disponível</div>
              <div className="bc-val">{hide ? '••••••' : formatBRL(saldoTotal)}</div>
              <div className="bc-sub">{linhaCc}</div>
            </div>
            <div className="bank-card teal" style={{ borderRadius: 18 }}>
              <div className="bc-lbl">A Receber 30d</div>
              <div className="bc-val">{hide ? '••••••' : fmtBRLCompact(receber30.valor)}</div>
              <div className="bc-sub">{receber30.duplicatas} duplicata{receber30.duplicatas === 1 ? '' : 's'} pendente{receber30.duplicatas === 1 ? '' : 's'}</div>
            </div>
            <div className="bank-card light" style={{ borderRadius: 18 }}>
              <div className="bc-lbl">Contas conectadas</div>
              <div className="bc-val">{contas.length}</div>
              <div className="bc-sub">{principal?.banco_nome || 'Open Finance (Belvo)'}</div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
