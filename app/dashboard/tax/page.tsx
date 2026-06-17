'use client'
import { useState } from 'react'
import GenericCrud, { type RowActionCtx } from '@/components/apps/GenericCrud'
import { formatBRL } from '@/lib/currency-brl'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

type Row = Record<string, unknown>

function PagarBtn({ row, ctx }: { row: Row; ctx: RowActionCtx }) {
  const [loading, setLoading] = useState(false)
  const pago = row.status === 'entregue'
  if (pago) return <span style={{ fontSize: 11, color: '#2D9B6F', fontWeight: 600 }}><i className="fa-solid fa-check" style={{ marginRight: 4 }} />pago</span>

  async function pagar() {
    setLoading(true)
    try {
      const valor = Number(row.valor ?? 0)
      // lança a saída no fluxo de caixa (transacoes — fonte do Cash Flow)
      const { error: e1 } = await supabase.from('transacoes').insert({
        empresa_id: ctx.empresaId,
        descricao: `Pagamento: ${String(row.nome ?? 'Imposto')}`,
        categoria: 'Impostos',
        tipo: 'saida',
        valor,
        status: 'pago',
        data: new Date().toISOString().slice(0, 10),
      })
      if (e1) throw e1
      const { error: e2 } = await supabase.from('tax_obrigacoes').update({ status: 'entregue' }).eq('id', row.id as string)
      if (e2) throw e2
      toast.success(`Pagamento de ${formatBRL(valor)} lançado no caixa.`)
      ctx.reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao registrar pagamento')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button onClick={pagar} disabled={loading} title="Registrar pagamento no caixa"
      style={{ fontSize: 11, fontWeight: 600, cursor: loading ? 'default' : 'pointer', border: '1px solid var(--teal)', background: 'rgba(94,140,135,.08)', color: 'var(--teal)', borderRadius: 6, padding: '3px 9px', opacity: loading ? .6 : 1 }}>
      {loading ? '...' : 'Registrar pagamento'}
    </button>
  )
}

export default function TaxPage() {
  return (
    <GenericCrud
      table="tax_obrigacoes"
      titulo="Tax Compliance"
      subtitulo="Obrigações fiscais, vencimentos e status. Ao pagar, lança a saída no fluxo de caixa."
      icon="fa-scale-balanced"
      addLabel="Nova obrigação"
      emptyLabel="Nenhuma obrigação cadastrada."
      fields={[
        { key: 'nome', label: 'Obrigação', required: true },
        { key: 'tipo', label: 'Tipo', type: 'select', options: ['DAS', 'DCTF', 'SPED', 'EFD', 'GIA', 'ISS', 'ICMS', 'Outro'] },
        { key: 'competencia', label: 'Competência (AAAA-MM)' },
        { key: 'vencimento', label: 'Vencimento', type: 'date' },
        { key: 'valor', label: 'Valor (R$)', type: 'money' },
        { key: 'status', label: 'Status', type: 'select', options: ['pendente', 'entregue', 'atrasada'] },
      ]}
      columns={[
        { key: 'nome', label: 'Obrigação' },
        { key: 'tipo', label: 'Tipo' },
        { key: 'competencia', label: 'Competência' },
        { key: 'vencimento', label: 'Vencimento' },
        { key: 'valor', label: 'Valor', align: 'right', money: true },
        { key: 'status', label: 'Status', tag: true },
      ]}
      kpis={[
        { label: 'Obrigações', value: rows => String(rows.length) },
        { label: 'Pendentes', value: rows => String(rows.filter(r => r.status === 'pendente').length), color: rows => rows.some(r => r.status === 'pendente') ? '#C0504A' : 'var(--green)' },
        { label: 'A pagar (pendente)', value: rows => formatBRL(rows.filter(r => r.status === 'pendente').reduce((s, r) => s + Number(r.valor ?? 0), 0)) },
      ]}
      actions={(row, ctx) => <PagarBtn row={row} ctx={ctx} />}
    />
  )
}
