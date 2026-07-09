import { redirect } from 'next/navigation'

// Fundido no Banco module (aba Fila) — o matching com contas a pagar/receber vive lá agora.
export default function Page() {
  redirect('/dashboard/banco?aba=fila')
}
