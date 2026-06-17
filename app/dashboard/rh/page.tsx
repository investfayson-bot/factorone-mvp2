'use client'
import GenericCrud from '@/components/apps/GenericCrud'
import { formatBRL } from '@/lib/currency-brl'

export default function RHPage() {
  return (
    <GenericCrud
      table="rh_beneficios"
      titulo="RH & Benefícios"
      subtitulo="Benefícios concedidos aos colaboradores."
      icon="fa-heart-pulse"
      addLabel="Novo benefício"
      emptyLabel="Nenhum benefício cadastrado."
      fields={[
        { key: 'funcionario', label: 'Funcionário', required: true },
        { key: 'tipo', label: 'Tipo', type: 'select', options: ['Vale-refeição', 'Vale-alimentação', 'Vale-transporte', 'Plano de saúde', 'Plano odontológico', 'Seguro de vida', 'Outro'] },
        { key: 'valor', label: 'Valor (R$)', type: 'money' },
        { key: 'status', label: 'Status', type: 'select', options: ['ativo', 'inativo'] },
      ]}
      columns={[
        { key: 'funcionario', label: 'Funcionário' },
        { key: 'tipo', label: 'Tipo' },
        { key: 'valor', label: 'Valor', align: 'right', money: true },
        { key: 'status', label: 'Status', tag: true },
      ]}
      kpis={[
        { label: 'Benefícios', value: rows => String(rows.length) },
        { label: 'Ativos', value: rows => String(rows.filter(r => r.status === 'ativo').length), color: () => 'var(--teal)' },
        { label: 'Custo mensal', value: rows => formatBRL(rows.filter(r => r.status === 'ativo').reduce((s, r) => s + Number(r.valor ?? 0), 0)) },
      ]}
    />
  )
}
