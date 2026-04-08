'use client'
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'
import NovoAtivoModal from '@/components/patrimonio/NovoAtivoModal'
import DetalhesAtivoModal from '@/components/patrimonio/DetalhesAtivoModal'
import BaixaAtivoModal from '@/components/patrimonio/BaixaAtivoModal'
import QRCodeAtivo from '@/components/patrimonio/QRCodeAtivo'

type Categoria = { id: string; nome: string; vida_util_anos: number; metodo_depreciacao: 'linear' | 'acelerada' | 'soma_digitos' }
type Ativo = {
  id: string
  nome: string
  categoria_id: string | null
  codigo_interno: string | null
  localizacao: string | null
  valor_aquisicao: number
  depreciacao_acumulada: number
  valor_contabil: number
  status: 'ativo' | 'em_manutencao' | 'baixado' | 'alienado' | 'perdido'
  foto_url: string | null
  responsavel_nome: string | null
  qr_code: string
  empresa_id: string
}

export default function PatrimonioPage() {
  const [empresaId, setEmpresaId] = useState('')
  const [ativos, setAtivos] = useState<Ativo[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [depreciacoes, setDepreciacoes] = useState<Array<{ competencia: string; valor_depreciacao: number }>>([])
  const [manutencoes, setManutencoes] = useState<Array<{ id: string; ativo_id: string; tipo: string; descricao: string; data_manutencao: string; proxima_manutencao: string | null }>>([])
  const [tab, setTab] = useState<'ativos' | 'categorias' | 'depreciacao' | 'manutencoes'>('ativos')
  const [openNovo, setOpenNovo] = useState(false)
  const [detalhes, setDetalhes] = useState<Ativo | null>(null)
  const [baixa, setBaixa] = useState<Ativo | null>(null)
  const [qr, setQr] = useState<Ativo | null>(null)
  const [fCategoria, setFCategoria] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [fLocal, setFLocal] = useState('')
  const [fResp, setFResp] = useState('')
  const [loadingDep, setLoadingDep] = useState(false)

  const carregar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const u = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const eid = (u.data?.empresa_id as string) || user.id
    setEmpresaId(eid)
    const [a, c, d, m] = await Promise.all([
      supabase.from('ativos').select('*').eq('empresa_id', eid).order('created_at', { ascending: false }),
      supabase.from('categorias_ativo').select('id,nome,vida_util_anos,metodo_depreciacao').eq('empresa_id', eid).order('nome'),
      supabase.from('depreciacoes').select('competencia,valor_depreciacao').eq('empresa_id', eid).order('competencia', { ascending: false }).limit(24),
      supabase.from('manutencoes_ativo').select('id,ativo_id,tipo,descricao,data_manutencao,proxima_manutencao').eq('empresa_id', eid).order('data_manutencao', { ascending: false }).limit(50),
    ])
    setAtivos((a.data || []) as Ativo[])
    setCategorias((c.data || []) as Categoria[])
    setDepreciacoes((d.data || []) as Array<{ competencia: string; valor_depreciacao: number }>)
    setManutencoes((m.data || []) as Array<{ id: string; ativo_id: string; tipo: string; descricao: string; data_manutencao: string; proxima_manutencao: string | null }>)
  }, [])
  useEffect(() => { void carregar() }, [carregar])
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab')
    if (t === 'depreciacao' || t === 'manutencoes' || t === 'categorias' || t === 'ativos') setTab(t)
  }, [])

  const ativosFiltrados = ativos.filter((a) =>
    (!fCategoria || a.categoria_id === fCategoria) &&
    (!fStatus || a.status === fStatus) &&
    (!fLocal || (a.localizacao || '').toLowerCase().includes(fLocal.toLowerCase())) &&
    (!fResp || (a.responsavel_nome || '').toLowerCase().includes(fResp.toLowerCase()))
  )
  const totalAtivos = ativosFiltrados.length
  const valorTotal = ativosFiltrados.reduce((s, a) => s + Number(a.valor_aquisicao || 0), 0)
  const valorContabil = ativosFiltrados.reduce((s, a) => s + Number(a.valor_contabil || 0), 0)
  const depMes = depreciacoes.filter((d) => d.competencia?.startsWith(new Date().toISOString().slice(0, 7))).reduce((s, d) => s + Number(d.valor_depreciacao || 0), 0)
  const porCategoria = useMemo(() => categorias.map((c) => {
    const list = ativos.filter((a) => a.categoria_id === c.id)
    const total = list.reduce((s, a) => s + Number(a.valor_aquisicao || 0), 0)
    const contabil = list.reduce((s, a) => s + Number(a.valor_contabil || 0), 0)
    const depPerc = total > 0 ? ((total - contabil) / total) * 100 : 0
    return { ...c, totalAtivos: list.length, total, contabil, depPerc }
  }), [ativos, categorias])

  async function processarDepreciacao() {
    setLoadingDep(true)
    const { data: sess } = await supabase.auth.getSession()
    const res = await fetch('/api/patrimonio/depreciar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(sess.session?.access_token ? { Authorization: `Bearer ${sess.session.access_token}` } : {}) },
      body: JSON.stringify({ empresaId, competencia: new Date().toISOString().slice(0, 7) }),
    })
    const payload = await res.json().catch(() => ({}))
    setLoadingDep(false)
    if (!res.ok) return alert(payload.error || 'Falha ao processar depreciação')
    alert(`Depreciação processada: ${payload.processados} ativos`)
    await carregar()
  }

  function categoriaNome(id: string | null): string {
    return categorias.find((c) => c.id === id)?.nome || 'Sem categoria'
  }
  function depProgress(ativo: Ativo): number {
    const total = Number(ativo.valor_aquisicao || 0)
    if (!total) return 0
    return ((Number(ativo.depreciacao_acumulada || 0)) / total) * 100
  }
  function progressClass(p: number): string {
    if (p > 80) return 'bg-red-500'
    if (p >= 50) return 'bg-amber-500'
    return 'bg-emerald-500'
  }

  return (
    <div className="space-y-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Patrimônio & Ativos</h1>
        <div className="flex gap-2">
          <button className="rounded-xl border px-3 py-2" onClick={() => setOpenNovo(true)}>+ Novo Ativo</button>
          <button className="rounded-xl bg-blue-700 px-3 py-2 text-white disabled:opacity-60" disabled={loadingDep} onClick={() => void processarDepreciacao()}>Processar Depreciação</button>
          <a className="rounded-xl border px-3 py-2" href="/api/patrimonio/relatorio" target="_blank">Exportar Relatório</a>
        </div>
      </div>
      <div className="grid gap-2 md:grid-cols-4">
        <select className="rounded border px-3 py-2" value={fCategoria} onChange={(e) => setFCategoria(e.target.value)}><option value="">Categoria</option>{categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
        <select className="rounded border px-3 py-2" value={fStatus} onChange={(e) => setFStatus(e.target.value)}><option value="">Status</option><option value="ativo">Ativo</option><option value="em_manutencao">Em manutenção</option><option value="baixado">Baixado</option><option value="alienado">Alienado</option><option value="perdido">Perdido</option></select>
        <input className="rounded border px-3 py-2" placeholder="Localização" value={fLocal} onChange={(e) => setFLocal(e.target.value)} />
        <input className="rounded border px-3 py-2" placeholder="Responsável" value={fResp} onChange={(e) => setFResp(e.target.value)} />
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border bg-white p-4"><p className="text-sm text-slate-500">Total ativos</p><p className="text-2xl font-bold">{totalAtivos}</p></div>
        <div className="rounded-2xl border bg-white p-4"><p className="text-sm text-slate-500">Valor total</p><p className="text-2xl font-bold">{formatBRL(valorTotal)}</p></div>
        <div className="rounded-2xl border bg-white p-4"><p className="text-sm text-slate-500">Deprec. mês</p><p className="text-2xl font-bold">{formatBRL(depMes)}</p></div>
        <div className="rounded-2xl border bg-white p-4"><p className="text-sm text-slate-500">Valor contábil</p><p className="text-2xl font-bold">{formatBRL(valorContabil)}</p></div>
      </div>
      <div className="flex gap-2">
        <button className={`rounded-xl px-3 py-2 ${tab === 'ativos' ? 'bg-blue-700 text-white' : 'border bg-white'}`} onClick={() => setTab('ativos')}>Lista de Ativos</button>
        <button className={`rounded-xl px-3 py-2 ${tab === 'categorias' ? 'bg-blue-700 text-white' : 'border bg-white'}`} onClick={() => setTab('categorias')}>Por Categoria</button>
        <button className={`rounded-xl px-3 py-2 ${tab === 'depreciacao' ? 'bg-blue-700 text-white' : 'border bg-white'}`} onClick={() => setTab('depreciacao')}>Depreciação</button>
        <button className={`rounded-xl px-3 py-2 ${tab === 'manutencoes' ? 'bg-blue-700 text-white' : 'border bg-white'}`} onClick={() => setTab('manutencoes')}>Manutenções</button>
      </div>

      {tab === 'ativos' && (
        <div className="overflow-x-auto rounded-2xl border bg-white">
          <table className="min-w-full text-sm">
            <thead><tr className="border-b bg-slate-50"><th className="p-2 text-left">Foto</th><th className="p-2 text-left">Código</th><th className="p-2 text-left">Nome</th><th className="p-2 text-left">Categoria</th><th className="p-2 text-left">Localização</th><th className="p-2 text-right">Aquisição</th><th className="p-2 text-right">Deprec.</th><th className="p-2 text-right">Contábil</th><th className="p-2">Status</th><th className="p-2">Ações</th></tr></thead>
            <tbody>
              {ativosFiltrados.map((a) => {
                const p = depProgress(a)
                return (
                  <tr key={a.id} className="border-b">
                    <td className="p-2"><div className="h-8 w-8 overflow-hidden rounded-full bg-slate-100">{a.foto_url ? <img src={a.foto_url} alt={a.nome} className="h-full w-full object-cover" /> : null}</div></td>
                    <td className="p-2">{a.codigo_interno || '-'}</td>
                    <td className="p-2">{a.nome}<div className="mt-1 h-1.5 rounded bg-slate-100"><div className={`h-1.5 rounded ${progressClass(p)}`} style={{ width: `${Math.min(p, 100)}%` }} /></div></td>
                    <td className="p-2">{categoriaNome(a.categoria_id)}</td>
                    <td className="p-2">{a.localizacao || '-'}</td>
                    <td className="p-2 text-right">{formatBRL(Number(a.valor_aquisicao || 0))}</td>
                    <td className="p-2 text-right">{formatBRL(Number(a.depreciacao_acumulada || 0))}</td>
                    <td className="p-2 text-right">{formatBRL(Number(a.valor_contabil || 0))}</td>
                    <td className="p-2 text-center">{a.status}</td>
                    <td className="p-2 text-center">
                      <div className="flex justify-center gap-1">
                        <button className="rounded border px-2 py-1 text-xs" onClick={() => setDetalhes(a)}>Ver</button>
                        <button className="rounded border px-2 py-1 text-xs" onClick={() => setBaixa(a)}>Baixar</button>
                        <button className="rounded border px-2 py-1 text-xs" onClick={() => setQr(a)}>QR</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'categorias' && (
        <div className="grid gap-3 md:grid-cols-3">
          {porCategoria.map((c) => (
            <button key={c.id} className="rounded-2xl border bg-white p-4 text-left" onClick={() => { setFCategoria(c.id); setTab('ativos') }}>
              <p className="font-semibold">{c.nome}</p>
              <p className="text-sm text-slate-500">{c.totalAtivos} ativos</p>
              <p className="text-sm">{formatBRL(c.total)} / {formatBRL(c.contabil)}</p>
              <div className="mt-2 h-2 rounded bg-slate-100"><div className="h-2 rounded bg-blue-600" style={{ width: `${Math.min(c.depPerc, 100)}%` }} /></div>
            </button>
          ))}
        </div>
      )}

      {tab === 'depreciacao' && (
        <div className="rounded-2xl border bg-white p-4">
          <h3 className="mb-3 font-semibold">Histórico de depreciações</h3>
          <div className="space-y-2">
            {depreciacoes.map((d, i) => <div key={String(i)} className="flex justify-between rounded border p-2 text-sm"><span>{d.competencia}</span><span>{formatBRL(Number(d.valor_depreciacao || 0))}</span></div>)}
          </div>
        </div>
      )}

      {tab === 'manutencoes' && (
        <div className="rounded-2xl border bg-white p-4">
          <h3 className="mb-3 font-semibold">Manutenções</h3>
          <div className="space-y-2">
            {manutencoes.map((m) => <div key={m.id} className="rounded border p-2 text-sm"><p>{m.tipo} • {m.descricao}</p><p className="text-xs text-slate-500">{m.data_manutencao} {m.proxima_manutencao ? `• próxima: ${m.proxima_manutencao}` : ''}</p></div>)}
          </div>
        </div>
      )}

      <NovoAtivoModal open={openNovo} onClose={() => setOpenNovo(false)} onDone={carregar} empresaId={empresaId} categorias={categorias} />
      {detalhes && <DetalhesAtivoModal open={Boolean(detalhes)} onClose={() => setDetalhes(null)} ativo={{ id: detalhes.id, nome: detalhes.nome, categoria: categoriaNome(detalhes.categoria_id), foto_url: detalhes.foto_url, localizacao: detalhes.localizacao, responsavel_nome: detalhes.responsavel_nome, valor_contabil: Number(detalhes.valor_contabil || 0) }} />}
      {baixa && <BaixaAtivoModal open={Boolean(baixa)} onClose={() => setBaixa(null)} onDone={carregar} ativo={{ id: baixa.id, nome: baixa.nome, valor_contabil: Number(baixa.valor_contabil || 0), empresa_id: baixa.empresa_id }} />}
      {qr && <QRCodeAtivo open={Boolean(qr)} onClose={() => setQr(null)} qrCode={qr.qr_code} nome={qr.nome} />}
    </div>
  )
}
