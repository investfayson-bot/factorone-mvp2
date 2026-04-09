'use client'
export const dynamic = 'force-dynamic'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Building2, UserRound } from 'lucide-react'
import toast from 'react-hot-toast'

type TipoPerfil = 'empresarial' | 'pessoal'

export default function OnboardingPage() {
  const [loading, setLoading] = useState<TipoPerfil | null>(null)
  const router = useRouter()

  async function selecionar(tipo: TipoPerfil) {
    setLoading(tipo)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth')
        return
      }

      const { error } = await supabase.from('perfil_usuario').upsert(
        {
          user_id: user.id,
          tipo,
        },
        { onConflict: 'user_id' }
      )

      if (error) throw error
      toast.success(`Modo ${tipo === 'empresarial' ? 'Empresarial' : 'Pessoal'} configurado`)
      router.push(tipo === 'empresarial' ? '/dashboard' : '/dashboard-pessoal')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Falha ao salvar seu perfil')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--fo-bg)] px-4 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-[var(--fo-text)]">Como você quer usar a FactorOne?</h1>
          <p className="mt-2 text-sm text-[var(--fo-text-muted)]">Escolha seu modo principal. Você pode alterar depois.</p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="rounded-2xl border border-[var(--fo-border)] bg-white p-6">
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--fo-teal-bg)]">
              <Building2 className="h-6 w-6 text-[var(--fo-teal)]" />
            </div>
            <h2 className="text-xl font-semibold text-[var(--fo-text)]">Empresarial</h2>
            <p className="mt-1 text-sm text-[var(--fo-text-muted)]">Para PMEs e empresas</p>
            <ul className="mt-4 space-y-2 text-sm text-[var(--fo-text-muted)]">
              <li>· Gestão completa</li>
              <li>· NF-e / DRE</li>
              <li>· Cartões corporativos</li>
              <li>· Módulo fiscal</li>
              <li>· Portal do contador</li>
            </ul>
            <button
              type="button"
              onClick={() => selecionar('empresarial')}
              disabled={loading !== null}
              className="mt-6 w-full rounded-xl bg-[var(--fo-teal)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--fo-teal-light)] disabled:opacity-60"
            >
              {loading === 'empresarial' ? 'Salvando...' : 'Começar como Empresa'}
            </button>
          </div>

          <div className="rounded-2xl border border-[var(--fo-border)] bg-white p-6">
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--fo-teal-bg)]">
              <UserRound className="h-6 w-6 text-[var(--fo-teal)]" />
            </div>
            <h2 className="text-xl font-semibold text-[var(--fo-text)]">Pessoa Física</h2>
            <p className="mt-1 text-sm text-[var(--fo-text-muted)]">Para finanças pessoais</p>
            <ul className="mt-4 space-y-2 text-sm text-[var(--fo-text-muted)]">
              <li>· Controle de gastos</li>
              <li>· Contas a pagar</li>
              <li>· Orçamento mensal</li>
              <li>· Onde vai meu dinheiro</li>
              <li>· Assinaturas e fixos</li>
            </ul>
            <button
              type="button"
              onClick={() => selecionar('pessoal')}
              disabled={loading !== null}
              className="mt-6 w-full rounded-xl border border-[var(--fo-teal)] bg-transparent px-4 py-2.5 text-sm font-semibold text-[var(--fo-teal)] transition hover:bg-[var(--fo-teal-bg)] disabled:opacity-60"
            >
              {loading === 'pessoal' ? 'Salvando...' : 'Começar como Pessoa'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
