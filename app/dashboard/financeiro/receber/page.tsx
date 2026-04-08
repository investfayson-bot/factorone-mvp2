import { redirect } from 'next/navigation'

export default function FinanceiroReceberAlias() {
  redirect('/dashboard/financeiro?tab=receber')
}
