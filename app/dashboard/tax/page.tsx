'use client'
import GenericCrud from '@/components/apps/GenericCrud'
import { formatBRL } from '@/lib/currency-brl'

export default function TaxPage() {
  return (
    <GenericCrud
      table="tax_obrigacoes"
      titulo="Tax Compliance"
      subtitulo="Obrigações fiscais, vencimentos e status."
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
    />
  )
}
