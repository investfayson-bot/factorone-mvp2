'use client'
import GenericCrud from '@/components/apps/GenericCrud'
import { formatBRL } from '@/lib/currency-brl'

export default function CobrancasPage() {
  return (
    <GenericCrud
      table="assinaturas_cobranca"
      titulo="Subscription Billing"
      subtitulo="Assinaturas e cobranças recorrentes dos seus clientes."
      icon="fa-rotate"
      addLabel="Nova assinatura"
      emptyLabel="Nenhuma assinatura cadastrada."
      fields={[
        { key: 'cliente', label: 'Cliente', required: true },
        { key: 'plano', label: 'Plano' },
        { key: 'valor', label: 'Valor (R$)', type: 'money' },
        { key: 'ciclo', label: 'Ciclo', type: 'select', options: ['mensal', 'trimestral', 'anual'] },
        { key: 'status', label: 'Status', type: 'select', options: ['ativa', 'pausada', 'cancelada'] },
        { key: 'proxima_cobranca', label: 'Próxima cobrança', type: 'date' },
      ]}
      columns={[
        { key: 'cliente', label: 'Cliente' },
        { key: 'plano', label: 'Plano' },
        { key: 'ciclo', label: 'Ciclo' },
        { key: 'valor', label: 'Valor', align: 'right', money: true },
        { key: 'proxima_cobranca', label: 'Próxima' },
        { key: 'status', label: 'Status', tag: true },
      ]}
      kpis={[
        { label: 'Assinaturas', value: rows => String(rows.length) },
        { label: 'Ativas', value: rows => String(rows.filter(r => r.status === 'ativa').length), color: () => 'var(--teal)' },
        { label: 'MRR (mensal ativo)', value: rows => formatBRL(rows.filter(r => r.status === 'ativa' && r.ciclo === 'mensal').reduce((s, r) => s + Number(r.valor ?? 0), 0)) },
      ]}
    />
  )
}
