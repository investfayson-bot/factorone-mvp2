import { redirect } from 'next/navigation'

// Fundido no Banco module (aba Fila).
export default function Page() {
  redirect('/dashboard/banco?aba=fila')
}
