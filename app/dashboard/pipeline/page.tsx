'use client'
import GenericCrud from '@/components/apps/GenericCrud'
import { formatBRL } from '@/lib/currency-brl'

const GANHO = 'ganho'
const ABERTAS = ['prospeccao', 'qualificacao', 'proposta', 'negociacao']

export default function PipelinePage() {
  return (
    <GenericCrud
      table="pipeline_oportunidades"
      titulo="Sales Pipeline"
      subtitulo="Oportunidades de venda por etapa."
      icon="fa-arrow-trend-up"
      addLabel="Nova oportunidade"
      emptyLabel="Nenhuma oportunidade cadastrada."
      fields={[
        { key: 'titulo', label: 'Oportunidade', required: true },
        { key: 'cliente', label: 'Cliente' },
        { key: 'valor', label: 'Valor (R$)', type: 'money' },
        { key: 'etapa', label: 'Etapa', type: 'select', options: ['prospeccao', 'qualificacao', 'proposta', 'negociacao', 'ganho', 'perdido'] },
        { key: 'probabilidade', label: 'Probabilidade (%)', type: 'number' },
      ]}
      columns={[
        { key: 'titulo', label: 'Oportunidade' },
        { key: 'cliente', label: 'Cliente' },
        { key: 'valor', label: 'Valor', align: 'right', money: true },
        { key: 'probabilidade', label: 'Prob. %', align: 'right' },
        { key: 'etapa', label: 'Etapa', tag: true },
      ]}
      kpis={[
        { label: 'Em aberto', value: rows => String(rows.filter(r => ABERTAS.includes(String(r.etapa))).length) },
        { label: 'Pipeline aberto', value: rows => formatBRL(rows.filter(r => ABERTAS.includes(String(r.etapa))).reduce((s, r) => s + Number(r.valor ?? 0), 0)), color: () => 'var(--teal)' },
        { label: 'Ganhos', value: rows => formatBRL(rows.filter(r => r.etapa === GANHO).reduce((s, r) => s + Number(r.valor ?? 0), 0)), color: () => 'var(--green)' },
      ]}
    />
  )
}
