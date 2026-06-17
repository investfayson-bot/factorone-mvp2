'use client'
import GenericCrud from '@/components/apps/GenericCrud'
import { formatBRL } from '@/lib/currency-brl'

export default function PropostasPage() {
  return (
    <GenericCrud
      table="propostas"
      titulo="Propostas Comerciais"
      subtitulo="Crie e acompanhe propostas e orçamentos."
      icon="fa-file-signature"
      addLabel="Nova proposta"
      emptyLabel="Nenhuma proposta cadastrada."
      fields={[
        { key: 'cliente', label: 'Cliente', required: true },
        { key: 'titulo', label: 'Título' },
        { key: 'valor', label: 'Valor (R$)', type: 'money' },
        { key: 'status', label: 'Status', type: 'select', options: ['rascunho', 'enviada', 'aceita', 'recusada'] },
        { key: 'validade', label: 'Validade', type: 'date' },
      ]}
      columns={[
        { key: 'cliente', label: 'Cliente' },
        { key: 'titulo', label: 'Título' },
        { key: 'valor', label: 'Valor', align: 'right', money: true },
        { key: 'validade', label: 'Validade' },
        { key: 'status', label: 'Status', tag: true },
      ]}
      kpis={[
        { label: 'Propostas', value: rows => String(rows.length) },
        { label: 'Aceitas', value: rows => String(rows.filter(r => r.status === 'aceita').length), color: () => 'var(--teal)' },
        { label: 'Valor aceito', value: rows => formatBRL(rows.filter(r => r.status === 'aceita').reduce((s, r) => s + Number(r.valor ?? 0), 0)) },
      ]}
    />
  )
}
