'use client'

import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  CheckCircle2,
  RefreshCw,
  Clock,
  ShieldCheck,
  XCircle,
  Camera,
  Brain,
  BarChart3,
  UserCog,
  ArrowRight,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ui/useToast'
import LoadingButton from '@/components/ui/LoadingButton'

export const dynamic = 'force-dynamic'

type StatusKind = 'sync' | 'open_finance' | 'connected' | 'crm' | 'transmitting'
type RuntimeStatus = 'aguardando_configuracao' | 'configurado' | 'sincronizando' | 'sincronizado' | 'erro'

const sistemas: {
  nome: string
  status: StatusKind
  label: string
}[] = [
  { nome: 'Omie ERP', status: 'sync', label: 'Sincronizado' },
  { nome: 'Conta Azul', status: 'sync', label: 'Sincronizado' },
  { nome: 'SAP B1', status: 'sync', label: 'Sincronizado' },
  { nome: 'Itaú Empresas', status: 'open_finance', label: 'Open Finance' },
  { nome: 'BTG Pactual', status: 'open_finance', label: 'Open Finance' },
  { nome: 'XP Inc.', status: 'connected', label: 'Conectado' },
  { nome: 'Salesforce', status: 'crm', label: 'CRM Sync' },
  { nome: 'SEFAZ / NF-e', status: 'transmitting', label: 'Transmitindo' },
  { nome: 'Oracle NetSuite', status: 'sync', label: 'Sincronizado' },
]

type SistemaView = {
  nome: string
  status: StatusKind
  label: string
  runtimeStatus: RuntimeStatus
  ultimoSyncEm?: string | null
}

function badgeClass(kind: StatusKind) {
  switch (kind) {
    case 'sync':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200'
    case 'open_finance':
      return 'bg-sky-50 text-sky-800 border-sky-200'
    case 'connected':
      return 'bg-violet-50 text-violet-800 border-violet-200'
    case 'crm':
      return 'bg-amber-50 text-amber-900 border-amber-200'
    case 'transmitting':
      return 'bg-teal-50 text-teal-800 border-teal-200'
    default:
      return 'bg-slate-50 text-slate-700 border-slate-200'
  }
}

export default function IntegracoesPage() {
  const toast = useToast()
  const [loadingSistema, setLoadingSistema] = useState<string | null>(null)
  const [runtime, setRuntime] = useState<Record<string, { status: RuntimeStatus; ultimoSyncEm?: string | null }>>({})

  useEffect(() => {
    let cancelled = false
    async function loadRuntime() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
      const empresaId = (u?.empresa_id as string) || user.id
      const { data } = await supabase
        .from('integracoes_config')
        .select('sistema,status,ultimo_sync_em')
        .eq('empresa_id', empresaId)
      if (cancelled) return
      const map: Record<string, { status: RuntimeStatus; ultimoSyncEm?: string | null }> = {}
      for (const d of data || []) {
        map[String(d.sistema)] = {
          status: (d.status as RuntimeStatus) || 'aguardando_configuracao',
          ultimoSyncEm: (d.ultimo_sync_em as string | null) || null,
        }
      }
      setRuntime(map)
    }
    loadRuntime()
    return () => {
      cancelled = true
    }
  }, [])

  const sistemasUi: SistemaView[] = useMemo(
    () =>
      sistemas.map((s) => ({
        ...s,
        runtimeStatus: runtime[s.nome]?.status || 'aguardando_configuracao',
        ultimoSyncEm: runtime[s.nome]?.ultimoSyncEm || null,
      })),
    [runtime]
  )

  const conectados = sistemasUi.filter((s) => s.runtimeStatus === 'sincronizado' || s.runtimeStatus === 'configurado').length

  async function configurar(sistema: string) {
    const apiKey = window.prompt(`Informe a API key para ${sistema}`)
    if (!apiKey) return
    setLoadingSistema(`cfg:${sistema}`)
    try {
      const { data: sess } = await supabase.auth.getSession()
      const res = await fetch('/api/integracoes/configurar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sess.session?.access_token ? { Authorization: `Bearer ${sess.session?.access_token}` } : {}),
        },
        body: JSON.stringify({ sistema, api_key: apiKey }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Falha ao configurar')
      setRuntime((prev) => ({ ...prev, [sistema]: { status: 'configurado', ultimoSyncEm: prev[sistema]?.ultimoSyncEm || null } }))
      toast.success(`${sistema} configurado`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao configurar')
    } finally {
      setLoadingSistema(null)
    }
  }

  async function sincronizar(sistema: string) {
    setLoadingSistema(`sync:${sistema}`)
    try {
      const { data: sess } = await supabase.auth.getSession()
      const res = await fetch('/api/integracoes/sincronizar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sess.session?.access_token ? { Authorization: `Bearer ${sess.session?.access_token}` } : {}),
        },
        body: JSON.stringify({ sistema }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Falha ao sincronizar')
      setRuntime((prev) => ({ ...prev, [sistema]: { status: 'sincronizado', ultimoSyncEm: data.synced_at } }))
      toast.success(`${sistema} sincronizado`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao sincronizar')
    } finally {
      setLoadingSistema(null)
    }
  }

  return (
    <>
      <div className="page-hdr">
        <div>
          <div className="page-title">Hub de Integrações</div>
          <div className="page-sub">{conectados} sistemas conectados · Tempo real</div>
        </div>
      </div>

      <div className="kpis">
        <div className="kpi">
          <div className="kpi-lbl">Sistemas ativos</div>
          <div className="kpi-val" style={{ color: 'var(--green)' }}>{conectados}</div>
          <div className="kpi-delta up">✓ conectados</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Sync hoje</div>
          <div className="kpi-val">1.248</div>
          <div className="kpi-delta up">transações</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Erros</div>
          <div className="kpi-val" style={{ color: 'var(--green)' }}>0</div>
          <div className="kpi-delta up">✓ limpo</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Última sync</div>
          <div className="kpi-val" style={{ fontSize: 16 }}>
            {(() => {
              const times = sistemasUi.map((s) => s.ultimoSyncEm).filter(Boolean) as string[]
              if (!times.length) return '—'
              const latest = new Date(times.sort().slice(-1)[0])
              const diffMin = Math.max(1, Math.round((Date.now() - latest.getTime()) / 60000))
              return `${diffMin}m atrás`
            })()}
          </div>
          <div className="kpi-delta up">automático</div>
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>

        {/* Lista de sistemas */}
        <section>
          <h2 className="mb-4 text-sm font-semibold text-gray-800">Conexões</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {sistemasUi.map((s) => (
              <div
                key={s.nome}
                className="rounded-2xl border border-gray-200/90 bg-white px-4 py-3.5 shadow-sm transition hover:border-emerald-200/80 hover:shadow-md"
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="min-w-0 font-medium text-gray-900">{s.nome}</span>
                  <span
                    className={`shrink-0 rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${badgeClass(s.status)}`}
                  >
                    {s.runtimeStatus === 'aguardando_configuracao'
                      ? 'Aguardando configuração'
                      : s.runtimeStatus === 'sincronizando'
                        ? 'Sincronizando'
                        : s.runtimeStatus === 'sincronizado'
                          ? 'Sincronizado'
                          : s.label}
                  </span>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <LoadingButton
                    loading={loadingSistema === `cfg:${s.nome}`}
                    loadingText="Salvando..."
                    onClick={() => configurar(s.nome)}
                    className="rounded-lg border border-[var(--fo-teal)] px-3 py-1.5 text-xs font-semibold text-[var(--fo-teal)]"
                  >
                    Configurar
                  </LoadingButton>
                  <LoadingButton
                    loading={loadingSistema === `sync:${s.nome}`}
                    loadingText="Sync..."
                    onClick={() => sincronizar(s.nome)}
                    className="rounded-lg bg-[var(--fo-teal)] px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Sincronizar agora
                  </LoadingButton>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Do recibo ao DRE */}
        <section className="overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-sm">
          <div className="border-b border-gray-100 bg-gradient-to-r from-emerald-50/80 to-teal-50/50 px-6 py-8 md:px-10">
            <h2 className="text-xl font-bold tracking-tight text-gray-900 md:text-2xl">
              Do recibo fotografado ao DRE — em segundos
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-gray-600">
              A IA captura, classifica e lança cada despesa automaticamente. Seu contador acessa tudo pelo portal dedicado — sem
              precisar pedir nada.
            </p>
          </div>
          <div className="grid gap-6 p-6 md:grid-cols-2 md:p-10 lg:grid-cols-4">
            <Passo
              icon={<Camera className="h-6 w-6 text-emerald-700" />}
              emoji="📷"
              titulo="Passo 1"
              tituloLinha="Foto do recibo"
              texto="Cliente fotografa o comprovante no app. Pode ser recibo, NF-e ou nota de papel."
            />
            <Passo
              icon={<Brain className="h-6 w-6 text-emerald-700" />}
              emoji="🧠"
              titulo="Passo 2"
              tituloLinha="IA extrai e classifica"
              texto="OCR lê valor, CNPJ e data em segundos. A IA categoriza automaticamente com 94% de precisão."
            />
            <Passo
              icon={<BarChart3 className="h-6 w-6 text-emerald-700" />}
              emoji="📊"
              titulo="Passo 3"
              tituloLinha="DRE atualizado na hora"
              texto="Cada lançamento alimenta o DRE em tempo real. Fechamento mensal acontece automaticamente."
            />
            <Passo
              icon={<UserCog className="h-6 w-6 text-emerald-700" />}
              emoji="🧑‍💼"
              titulo="Passo 4"
              tituloLinha="Contador valida online"
              texto="Contador acessa o portal dedicado, revisa os lançamentos e exporta SPED, ECD e ECF."
            />
          </div>
        </section>

        {/* Portal contador */}
        <section id="contador" className="rounded-2xl border border-gray-200/90 bg-white p-6 shadow-sm md:p-10">
          <div className="mx-auto max-w-4xl">
            <div className="mb-8 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Portal exclusivo para o contador</h2>
                <p className="mt-2 text-sm text-gray-600">
                  Convide seu contador com um clique. Ele terá acesso completo ao bookkeeping do ano — sem ver seu saldo nem
                  mover dinheiro.
                </p>
              </div>
              <a
                href="mailto:contato@factorone.com.br?subject=Convite%20contador%20FactorOne"
                className="mt-4 inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 md:mt-0"
              >
                Convidar meu contador
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>

            <div className="grid gap-8 md:grid-cols-2">
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-emerald-800">
                  <ShieldCheck className="h-4 w-4" />
                  O contador pode:
                </h3>
                <ul className="space-y-2.5 text-sm text-gray-700">
                  <li className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    Ver todos os lançamentos e comprovantes
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    Baixar NF-e, XMLs e recibos em lote
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    Corrigir categorias e adicionar comentários
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    Exportar DRE, balancete e livro caixa
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    Gerar SPED Contábil, ECD e ECF
                  </li>
                </ul>
              </div>
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-red-800">
                  <XCircle className="h-4 w-4" />
                  O contador NÃO pode:
                </h3>
                <ul className="space-y-2.5 text-sm text-gray-700">
                  <li className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                    Ver saldo em conta ou mover dinheiro
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                    Acessar cartões ou dados sensíveis
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Fechamento mensal */}
        <section className="rounded-2xl border border-gray-200/90 bg-white p-6 shadow-sm md:p-10">
          <h2 className="mb-8 text-center text-xl font-bold text-gray-900">Fechamento mensal</h2>
          <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-6">
              <p className="text-sm font-semibold text-slate-500">Antes</p>
              <ul className="mt-4 space-y-3 text-sm text-slate-700">
                <li>Juntar recibos em papel</li>
                <li>Enviar tudo por WhatsApp</li>
                <li>Contador digita manualmente</li>
                <li className="font-medium text-slate-900">5–10 dias úteis</li>
                <li className="text-red-700">Erros frequentes</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-6">
              <p className="text-sm font-semibold text-emerald-800">Com FactorOne</p>
              <ul className="mt-4 space-y-3 text-sm text-emerald-950/90">
                <li>Foto no celular na hora</li>
                <li>Portal atualizado em tempo real</li>
                <li>IA lança automaticamente</li>
                <li className="font-medium">Fechamento em 36 horas</li>
                <li>94% classificação automática</li>
              </ul>
            </div>
          </div>
        </section>

        <p className="pb-4 text-center text-xs text-gray-400">
          Dados de sincronização ilustrativos para demonstração do produto.{' '}
          <Link href="/dashboard" className="text-emerald-700 hover:underline">
            Voltar ao dashboard
          </Link>
        </p>
      </div>
    </>
  )
}

function Passo({
  icon,
  emoji,
  titulo,
  tituloLinha,
  texto,
}: {
  icon: ReactNode
  emoji: string
  titulo: string
  tituloLinha: string
  texto: string
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-2xl" aria-hidden>
          {emoji}
        </span>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-sm">{icon}</div>
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{titulo}</p>
      <p className="mt-1 font-semibold text-gray-900">{tituloLinha}</p>
      <p className="mt-2 text-sm leading-relaxed text-gray-600">{texto}</p>
    </div>
  )
}
