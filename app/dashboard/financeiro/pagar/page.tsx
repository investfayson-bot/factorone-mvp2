import { redirect } from 'next/navigation'

export default function FinanceiroPagarAlias() {
  redirect('/dashboard/financeiro?tab=pagar')
}
