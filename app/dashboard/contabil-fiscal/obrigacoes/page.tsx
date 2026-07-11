'use client'

// Obrigações (Fase 5) — a versão de verdade (calendário + vencimentos +
// link Gov.br por obrigação, tabela links_governamentais) é o Bloco 3.
// Enquanto isso: placeholder honesto que mostra o que JÁ existe de real
// (tax_obrigacoes — DAS registrados etc.) e linka pras telas antigas.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'

type Obrigacao = { id: string; nome: string; tipo: string | null; competencia: string | null; vencimento: string | null; valor: number | null; status: string }

export default function ObrigacoesPage() {
  const [obrigacoes, setObrigacoes] = useState<Obrigacao[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
      const eid = (u?.empresa_id as string) ?? user.id
      const { data } = await supabase
        .from('tax_obrigacoes')
        .select('id, nome, tipo, competencia, vencimento, valor, status')
        .eq('empresa_id', eid)
        .order('vencimento', { ascending: true })
        .limit(40)
      setObrigacoes((data as Obrigacao[]) ?? [])
      setLoading(false)
    })()
  }, [])

  const pendentes = obrigacoes.filter(o => o.status !== 'entregue' && o.status !== 'pago')

  return (
    <div style={{ maxWidth: 940, paddingBottom: 30 }}>
      <div style={{ background: 'var(--acc-soft)', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 12.5, color: 'var(--acc-ink)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <i className="fa-solid fa-circle-info" />
        O calendário completo de obrigações com link Gov.br por item está em construção. Por enquanto você vê aqui o que já foi registrado (ex.: DAS do estimador).
      </div>

      <div className="card-v2" style={{ overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>Obrigações registradas</div>
          {pendentes.length > 0 && <span className="chip-v2 y">{pendentes.length} pendente{pendentes.length === 1 ? '' : 's'}</span>}
        </div>
        {loading ? (
          <div style={{ padding: '30px 16px', textAlign: 'center', color: 'var(--mut)', fontSize: 13 }}>Carregando…</div>
        ) : obrigacoes.length === 0 ? (
          <div style={{ padding: '30px 16px', textAlign: 'center', color: 'var(--mut)', fontSize: 13 }}>
            Nenhuma obrigação registrada ainda. Calcule e registre o DAS em <Link href="/dashboard/contabil-fiscal/impostos-regime" style={{ color: 'var(--acc)', fontWeight: 600 }}>Impostos &amp; Regime</Link>.
          </div>
        ) : obrigacoes.map(o => {
          const pago = o.status === 'entregue' || o.status === 'pago'
          const dias = o.vencimento ? Math.ceil((new Date(o.vencimento + 'T12:00:00').getTime() - Date.now()) / 86400000) : null
          return (
            <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: '1px solid var(--line)' }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: pago ? 'var(--acc-soft)' : '#F3ECDA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className={`fa-solid ${pago ? 'fa-check' : 'fa-clock'}`} style={{ fontSize: 14, color: pago ? 'var(--acc)' : '#B08A3E' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{o.nome}</div>
                <div style={{ fontSize: 12, color: 'var(--mut)' }}>
                  {o.vencimento ? `Vence ${new Date(o.vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}` : 'Sem vencimento'}
                  {!pago && dias != null && ` · ${dias > 0 ? `em ${dias} dia${dias === 1 ? '' : 's'}` : 'vencida'}`}
                </div>
              </div>
              {o.valor != null && <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{formatBRL(Number(o.valor))}</div>}
              <span className={`chip-v2 ${pago ? 'g' : 'y'}`}>{pago ? 'Pago' : 'Pendente'}</span>
            </div>
          )
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Link href="/dashboard/fiscal" style={{ textDecoration: 'none' }}>
          <div className="card-v2" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
            <i className="fa-solid fa-landmark" style={{ fontSize: 18, color: 'var(--acc)' }} />
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>Portais do Governo</div>
              <div style={{ fontSize: 12, color: 'var(--mut)' }}>Gov.br, SEFAZ, eSocial e outros — acesso rápido</div>
            </div>
            <i className="fa-solid fa-arrow-right" style={{ marginLeft: 'auto', color: 'var(--mut)', fontSize: 12 }} />
          </div>
        </Link>
        <Link href="/dashboard/tax" style={{ textDecoration: 'none' }}>
          <div className="card-v2" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
            <i className="fa-solid fa-file-invoice-dollar" style={{ fontSize: 18, color: 'var(--acc)' }} />
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>Tax Compliance</div>
              <div style={{ fontSize: 12, color: 'var(--mut)' }}>Registrar pagamento de imposto no fluxo de caixa</div>
            </div>
            <i className="fa-solid fa-arrow-right" style={{ marginLeft: 'auto', color: 'var(--mut)', fontSize: 12 }} />
          </div>
        </Link>
      </div>
    </div>
  )
}
