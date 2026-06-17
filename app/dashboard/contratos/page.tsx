'use client'
import GenericCrud from '@/components/apps/GenericCrud'
import { formatBRL } from '@/lib/currency-brl'

export default function ContratosPage() {
  return (
    <GenericCrud
      table="contratos"
      titulo="Contratos Digitais"
      subtitulo="Contratos, vigência e status de assinatura."
      icon="fa-file-contract"
      addLabel="Novo contrato"
      emptyLabel="Nenhum contrato cadastrado."
      fields={[
        { key: 'titulo', label: 'Título', required: true },
        { key: 'contraparte', label: 'Contraparte' },
        { key: 'valor', label: 'Valor (R$)', type: 'money' },
        { key: 'status', label: 'Status', type: 'select', options: ['rascunho', 'enviado', 'assinado', 'cancelado'] },
        { key: 'vigencia_fim', label: 'Vigência até', type: 'date' },
      ]}
      columns={[
        { key: 'titulo', label: 'Contrato' },
        { key: 'contraparte', label: 'Contraparte' },
        { key: 'valor', label: 'Valor', align: 'right', money: true },
        { key: 'vigencia_fim', label: 'Vigência' },
        { key: 'status', label: 'Status', tag: true },
      ]}
      kpis={[
        { label: 'Contratos', value: rows => String(rows.length) },
        { label: 'Assinados', value: rows => String(rows.filter(r => r.status === 'assinado').length), color: () => 'var(--teal)' },
        { label: 'Valor assinado', value: rows => formatBRL(rows.filter(r => r.status === 'assinado').reduce((s, r) => s + Number(r.valor ?? 0), 0)) },
      ]}
    />
  )
}
