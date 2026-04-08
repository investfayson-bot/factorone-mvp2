'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Check,
  Download,
  Loader2,
  Mail,
  X,
  Ban,
} from 'lucide-react'

export type NotaEmitidaRow = {
  id: string
  tipo: 'nfe' | 'nfse'
  numero: string | null
  destinatario_nome: string
  valor_total: number
  status: 'processando' | 'autorizada' | 'rejeitada' | 'cancelada'
  created_at: string
  xml_url: string | null
  pdf_url: string | null
  sefaz_motivo: string | null
}

export default function HistoricoNotas() {
  const [rows, setRows] = useState<NotaEmitidaRow[]>([])
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'nfe' | 'nfse'>('todos')
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7))
  const [emailModal, setEmailModal] = useState<{ id: string; email: string } | null>(null)
  const [cancelModal, setCancelModal] = useState<{ id: string; j: string } | null>(null)
  const [loadingEmail, setLoadingEmail] = useState(false)

  const carregar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const inicio = `${mes}-01`
    const [y, m] = mes.split('-').map(Number)
    const fim = new Date(y, m, 0)
    const fimStr = fim.toISOString().slice(0, 10)

    let q = supabase
      .from('notas_emitidas')
      .select('id,tipo,numero,destinatario_nome,valor_total,status,created_at,xml_url,pdf_url,sefaz_motivo')
      .eq('empresa_id', user.id)
      .gte('created_at', `${inicio}T00:00:00`)
      .lte('created_at', `${fimStr}T23:59:59`)
      .order('created_at', { ascending: false })

    if (filtroTipo !== 'todos') {
      q = q.eq('tipo', filtroTipo)
    }
    if (filtroStatus !== 'todos') {
      q = q.eq('status', filtroStatus)
    }

    const { data } = await q
    setRows((data ?? []) as NotaEmitidaRow[])
  }, [mes, filtroTipo, filtroStatus])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const temProcessando = useMemo(() => rows.some((r) => r.status === 'processando'), [rows])

  useEffect(() => {
    if (!temProcessando) return
    const t = setInterval(() => {
      void carregar()
    }, 10000)
    return () => clearInterval(t)
  }, [temProcessando, carregar])

  async function enviarEmail() {
    if (!emailModal) return
    setLoadingEmail(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      await fetch('/api/notas/enviar-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ nota_emitida_id: emailModal.id, email: emailModal.email }),
      })
      setEmailModal(null)
    } finally {
      setLoadingEmail(false)
    }
  }

  async function cancelar() {
    if (!cancelModal || cancelModal.j.trim().length < 15) return
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`/api/notas/cancelar/${cancelModal.id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ justificativa: cancelModal.j }),
    })
    if (res.ok) {
      setCancelModal(null)
      void carregar()
    }
  }

  function badge(r: NotaEmitidaRow) {
    if (r.status === 'processando') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-900 border border-amber-200">
          <Loader2 size={12} className="animate-spin" /> Processando
        </span>
      )
    }
    if (r.status === 'autorizada') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-800 border border-emerald-200">
          <Check size={12} /> Autorizada
        </span>
      )
    }
    if (r.status === 'rejeitada') {
      return (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-800 border border-red-200"
          title={r.sefaz_motivo || ''}
        >
          <X size={12} /> Rejeitada
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-slate-200 text-slate-600 line-through">
        Cancelada
      </span>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <label className="text-sm">
          Tipo
          <select
            className="block mt-1 border border-slate-200 rounded-xl px-3 py-2 text-sm"
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value as 'todos' | 'nfe' | 'nfse')}
          >
            <option value="todos">Todos</option>
            <option value="nfe">NF-e</option>
            <option value="nfse">NFS-e</option>
          </select>
        </label>
        <label className="text-sm">
          Status
          <select
            className="block mt-1 border border-slate-200 rounded-xl px-3 py-2 text-sm"
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
          >
            <option value="todos">Todos</option>
            <option value="processando">Processando</option>
            <option value="autorizada">Autorizada</option>
            <option value="rejeitada">Rejeitada</option>
            <option value="cancelada">Cancelada</option>
          </select>
        </label>
        <label className="text-sm">
          Mês
          <input
            type="month"
            className="block mt-1 border border-slate-200 rounded-xl px-3 py-2 text-sm"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
          />
        </label>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-600 text-left">
                <th className="p-3 font-medium">Número</th>
                <th className="p-3 font-medium">Tipo</th>
                <th className="p-3 font-medium">Destinatário</th>
                <th className="p-3 font-medium">Valor</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Data</th>
                <th className="p-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    Nenhuma nota emitida no período.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="p-3">{r.numero || '—'}</td>
                    <td className="p-3">{r.tipo === 'nfe' ? 'NF-e' : 'NFS-e'}</td>
                    <td className="p-3 max-w-[180px] truncate">{r.destinatario_nome}</td>
                    <td className="p-3">
                      {Number(r.valor_total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td className="p-3">{badge(r)}</td>
                    <td className="p-3 whitespace-nowrap">
                      {new Date(r.created_at).toLocaleString('pt-BR')}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {r.xml_url && (
                          <a
                            href={r.xml_url}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50"
                            title="XML"
                          >
                            <Download size={14} />
                          </a>
                        )}
                        {r.pdf_url && (
                          <a
                            href={r.pdf_url}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50"
                            title="PDF"
                          >
                            <Download size={14} />
                          </a>
                        )}
                        <button
                          type="button"
                          className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50"
                          title="E-mail"
                          onClick={() => setEmailModal({ id: r.id, email: '' })}
                        >
                          <Mail size={14} />
                        </button>
                        {r.status !== 'cancelada' && r.status !== 'rejeitada' && (
                          <button
                            type="button"
                            className="p-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-50"
                            title="Cancelar"
                            onClick={() => setCancelModal({ id: r.id, j: '' })}
                          >
                            <Ban size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {emailModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-3 shadow-xl">
            <h3 className="font-semibold">Enviar por e-mail</h3>
            <input
              type="email"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
              placeholder="email@empresa.com"
              value={emailModal.email}
              onChange={(e) => setEmailModal({ ...emailModal, email: e.target.value })}
            />
            <div className="flex justify-end gap-2">
              <button type="button" className="px-4 py-2 text-sm rounded-xl border" onClick={() => setEmailModal(null)}>
                Fechar
              </button>
              <button
                type="button"
                disabled={loadingEmail}
                className="px-4 py-2 text-sm rounded-xl bg-blue-700 text-white"
                onClick={enviarEmail}
              >
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}

      {cancelModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-3 shadow-xl">
            <h3 className="font-semibold">Cancelar nota</h3>
            <p className="text-sm text-slate-600">Justificativa (mín. 15 caracteres)</p>
            <textarea
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm min-h-[100px]"
              value={cancelModal.j}
              onChange={(e) => setCancelModal({ ...cancelModal, j: e.target.value })}
            />
            <div className="flex justify-end gap-2">
              <button type="button" className="px-4 py-2 text-sm rounded-xl border" onClick={() => setCancelModal(null)}>
                Voltar
              </button>
              <button
                type="button"
                className="px-4 py-2 text-sm rounded-xl bg-red-700 text-white disabled:opacity-50"
                disabled={cancelModal.j.trim().length < 15}
                onClick={cancelar}
              >
                Confirmar cancelamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
