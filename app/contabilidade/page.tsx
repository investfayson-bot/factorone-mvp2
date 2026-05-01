'use client'

import { useEffect, useMemo, useState } from 'react'
import { Calculator, Camera, Brain, BarChart3, UserCog, UploadCloud } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import LoadingButton from '@/components/ui/LoadingButton'
import { useToast } from '@/components/ui/useToast'
import { fmtBRLCompact } from '@/lib/dre-calculations'

export default function ContabilidadePage() {
  const toast = useToast()
  const [tab, setTab] = useState<'visao' | 'recibos' | 'lancamentos' | 'contador' | 'exportacoes' | 'tributacao'>('visao')
  const [loadingUpload, setLoadingUpload] = useState(false)
  const [recibos, setRecibos] = useState<Array<{ id: string; status: string; fornecedor_extraido: string | null; valor_extraido: number | null; data_extraida: string | null; categoria_sugerida: string | null }>>([])
  const [contadores, setContadores] = useState<Array<{ id: string; nome: string; email: string; status: string; crc: string | null; token_acesso: string }>>([])
  const [formCont, setFormCont] = useState({ nome: '', email: '', crc: '', telefone: '' })
  const [loadingConvite, setLoadingConvite] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) return
      const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', auth.user.id).maybeSingle()
      const empresaId = (u?.empresa_id as string) || auth.user.id
      const [r, c] = await Promise.all([
        supabase.from('recibos_fotografados').select('id,status,fornecedor_extraido,valor_extraido,data_extraida,categoria_sugerida').eq('empresa_id', empresaId).order('created_at', { ascending: false }).limit(20),
        supabase.from('contadores').select('id,nome,email,status,crc,token_acesso').eq('empresa_id', empresaId).order('created_at', { ascending: false }),
      ])
      if (!cancelled) {
        setRecibos((r.data || []) as typeof recibos)
        setContadores((c.data || []) as typeof contadores)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const kpi = useMemo(() => {
    const total = recibos.length
    const lancados = recibos.filter((x) => x.status === 'lancado').length
    const pend = recibos.filter((x) => x.status === 'extraido' || x.status === 'processando').length
    return {
      total,
      classificadosPct: total ? (lancados / total) * 100 : 0,
      pend,
    }
  }, [recibos])

  async function uploadRecibo(file: File) {
    setLoadingUpload(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const { data: sess } = await supabase.auth.getSession()
      const res = await fetch('/api/contabilidade/processar-recibo', {
        method: 'POST',
        headers: sess.session?.access_token ? { Authorization: `Bearer ${sess.session.access_token}` } : {},
        body: form,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Falha no processamento')
      toast.success(data?.lancado_automaticamente ? 'Recibo lançado automaticamente' : 'Recibo extraído para revisão')
      setRecibos((prev) => [
        {
          id: data.recibo_id,
          status: data.lancado_automaticamente ? 'lancado' : 'extraido',
          fornecedor_extraido: data.dados_extraidos?.fornecedor || null,
          valor_extraido: data.dados_extraidos?.valor || null,
          data_extraida: data.dados_extraidos?.data || null,
          categoria_sugerida: data.dados_extraidos?.categoria || null,
        },
        ...prev,
      ])
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro no upload')
    } finally {
      setLoadingUpload(false)
    }
  }

  async function convidarContador() {
    setLoadingConvite(true)
    try {
      const { data: sess } = await supabase.auth.getSession()
      const res = await fetch('/api/contabilidade/convidar-contador', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sess.session?.access_token ? { Authorization: `Bearer ${sess.session.access_token}` } : {}),
        },
        body: JSON.stringify(formCont),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Falha ao convidar')
      toast.success('Contador convidado')
      setFormCont({ nome: '', email: '', crc: '', telefone: '' })
      setContadores((prev) => [
        {
          id: data.contador_id,
          nome: formCont.nome,
          email: formCont.email,
          status: 'convidado',
          crc: formCont.crc || null,
          token_acesso: data.access_url?.split('/').pop() || '',
        },
        ...prev,
      ])
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao convidar contador')
    } finally {
      setLoadingConvite(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--fo-bg)] p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[var(--fo-text)]">Contabilidade</h1>
            <p className="text-sm text-[var(--fo-text-muted)]">Recibos, lançamentos, portal do contador e exportações.</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--fo-border)] bg-[var(--fo-teal-bg)] px-3 py-1 text-xs font-semibold text-[var(--fo-teal)]">
            <span className="fo-live-dot" />
            Tempo Real
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Lançamentos do mês" value={String(kpi.total)} />
          <Kpi label="Classificados %" value={`${kpi.classificadosPct.toFixed(0)}%`} />
          <Kpi label="Pendentes" value={String(kpi.pend)} />
          <Kpi label="Último fechamento" value="em andamento" />
        </div>

        <div className="flex flex-wrap gap-2 border-b border-[var(--fo-border)] pb-2">
          {[
            ['visao', 'Visão Geral'],
            ['recibos', 'Recibos'],
            ['lancamentos', 'Lançamentos'],
            ['contador', 'Portal Contador'],
            ['exportacoes', 'Exportações'],
            ['tributacao', 'Tributação IA'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id as typeof tab)}
              className={`rounded-xl px-3 py-2 text-sm font-medium ${
                tab === id ? 'bg-[var(--fo-teal)] text-white' : 'border border-[var(--fo-border)] bg-white text-[var(--fo-text-muted)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'visao' && (
          <div className="rounded-2xl border border-[var(--fo-border)] bg-white p-6">
            <div className="mb-3 flex items-center gap-2">
              <Calculator className="h-5 w-5 text-[var(--fo-teal)]" />
              <h2 className="font-semibold text-[var(--fo-text)]">Fluxo contábil</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <Step icon={<Camera className="h-4 w-4" />} title="Foto" />
              <Step icon={<Brain className="h-4 w-4" />} title="IA Extrai" />
              <Step icon={<BarChart3 className="h-4 w-4" />} title="DRE Atualizado" />
              <Step icon={<UserCog className="h-4 w-4" />} title="Contador Valida" />
            </div>
          </div>
        )}

        {tab === 'recibos' && (
          <div className="rounded-2xl border border-[var(--fo-border)] bg-white p-6">
            <h2 className="mb-3 font-semibold text-[var(--fo-text)]">Captura de recibos</h2>
            <label className="flex min-h-36 cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-[var(--fo-border)] bg-slate-50 text-sm text-[var(--fo-text-muted)]">
              <span className="inline-flex items-center gap-2">
                <UploadCloud className="h-4 w-4" />
                Arraste ou selecione imagem/PDF
              </span>
              <input
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void uploadRecibo(f)
                  e.currentTarget.value = ''
                }}
              />
            </label>
            <div className="mt-3 text-right">
              <LoadingButton loading={loadingUpload} loadingText="Processando..." className="rounded-xl bg-[var(--fo-teal)] px-3 py-2 text-sm font-semibold text-white">
                Aguardando envio
              </LoadingButton>
            </div>
            <div className="mt-4 space-y-2">
              {recibos.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-xl border border-[var(--fo-border)] px-3 py-2 text-sm">
                  <span className="min-w-0 truncate">{r.fornecedor_extraido || 'Recibo'}</span>
                  <span className="text-[var(--fo-text-muted)]">{r.categoria_sugerida || '—'}</span>
                  <span className="font-semibold">{r.valor_extraido ? fmtBRLCompact(Number(r.valor_extraido)) : '—'}</span>
                  <span className="rounded-lg bg-[var(--fo-teal-bg)] px-2 py-0.5 text-xs text-[var(--fo-teal)]">{r.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'lancamentos' && (
          <div className="rounded-2xl border border-[var(--fo-border)] bg-white p-6 text-sm text-[var(--fo-text-muted)]">
            Tabela de lançamentos contábeis será conectada ao livro razão na próxima etapa.
          </div>
        )}

        {tab === 'contador' && (
          <div className="rounded-2xl border border-[var(--fo-border)] bg-white p-6">
            <h2 className="mb-3 font-semibold text-[var(--fo-text)]">Convidar contador</h2>
            <div className="grid gap-2 md:grid-cols-4">
              <input className="rounded-xl border border-[var(--fo-border)] px-3 py-2 text-sm" placeholder="Nome" value={formCont.nome} onChange={(e) => setFormCont((f) => ({ ...f, nome: e.target.value }))} />
              <input className="rounded-xl border border-[var(--fo-border)] px-3 py-2 text-sm" placeholder="Email" value={formCont.email} onChange={(e) => setFormCont((f) => ({ ...f, email: e.target.value }))} />
              <input className="rounded-xl border border-[var(--fo-border)] px-3 py-2 text-sm" placeholder="CRC" value={formCont.crc} onChange={(e) => setFormCont((f) => ({ ...f, crc: e.target.value }))} />
              <input className="rounded-xl border border-[var(--fo-border)] px-3 py-2 text-sm" placeholder="Telefone" value={formCont.telefone} onChange={(e) => setFormCont((f) => ({ ...f, telefone: e.target.value }))} />
            </div>
            <div className="mt-3 text-right">
              <LoadingButton
                loading={loadingConvite}
                loadingText="Convidando..."
                onClick={convidarContador}
                className="rounded-xl bg-[var(--fo-teal)] px-3 py-2 text-sm font-semibold text-white"
              >
                Convidar contador
              </LoadingButton>
            </div>
            <div className="mt-4 space-y-2">
              {contadores.map((c) => (
                <div key={c.id} className="rounded-xl border border-[var(--fo-border)] px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-[var(--fo-text)]">{c.nome}</span>
                    <span className="text-[var(--fo-text-muted)]">{c.email}</span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{c.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'exportacoes' && (
          <div className="rounded-2xl border border-[var(--fo-border)] bg-white p-6 text-sm text-[var(--fo-text-muted)]">
            Exportações contábeis (SPED/ECD/ECF) prontas para integração em próximo bloco.
          </div>
        )}

        {tab === 'tributacao' && (
          <div className="rounded-2xl border border-[var(--fo-border)] bg-white p-6 text-sm text-[var(--fo-text-muted)]">
            IA Tributária: painel base ativo. Insights proativos serão conectados via API dedicada.
          </div>
        )}
      </div>
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--fo-border)] bg-white p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--fo-text-muted)]">{label}</p>
      <p className="mt-2 text-2xl font-bold text-[var(--fo-text)]">{value}</p>
    </div>
  )
}

function Step({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="rounded-xl border border-[var(--fo-border)] bg-slate-50 p-3">
      <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white text-[var(--fo-teal)]">{icon}</div>
      <p className="text-sm font-medium text-[var(--fo-text)]">{title}</p>
    </div>
  )
}
