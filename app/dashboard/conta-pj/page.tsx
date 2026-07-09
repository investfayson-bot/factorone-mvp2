import { redirect } from 'next/navigation'

// Fundido no Banco module — spec docs/superpowers/specs/2026-07-08-banco-module-design.md
export default function Page() {
  redirect('/dashboard/banco')
}
