'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatBRL } from '@/lib/currency-brl'
import { supabase } from '@/lib/supabase'
import { useHolding, type EscopoHolding } from '@/lib/holding-context'

type Cartao = { id: string; nome: string; bandeira: string; limite: number; limite_disponivel: number; cor: string; pausado: boolean; empresa_id: string; empresa_nome: string | null }
type Parcela = { id: string; estabelecimento: string; parcela_atual: number; total_parcelas: number; valor: number; empresa_id: string | null; empresa_nome: string | null; categoria: string | null; titularidade: 'pj' | 'pf' }
type Dados = { cartoes: Cartao[]; parcelas: Parcela[]; gasto_por_categoria: { categoria: string; valor: number }[] }

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const t = data.session?.access_token
  return t ? { Authorization: `Bearer ${t}` } : {}
}

export default function BancoCartoesPage() {
  const { grupoAtivoId, escopo, setEscopo, grupos } = useHolding()
  const [dados, setDados] = useState<Dados | null>(null)
  const [loading, setLoading] = useState(true)
  const [filtroEmpresa, setFiltroEmpresa] = useState<string>('todas')

  useEffect(() => {
    let ativo = true
    void (async () => {
      setLoading(true)
      const h = await authHeaders()
      const qs = new URLSearchParams({ escopo })
      if (grupoAtivoId) qs.set('grupoId', grupoAtivoId)
      const r = await fetch(`/api/banco/cartoes?${qs}`, { headers: h }).then(x => x.json()).catch(() => null)
      if (!ativo) return
      setDados(r && !r.error ? r : null)
      setLoading(false)
    })()
    return () => { ativo = false }
  }, [grupoAtivoId, escopo])

  if (loading) return <div style={{ padding: '24px 0', color: 'var(--mut)', fontSize: 13 }}>Carregando…</div>
  if (!dados) return <div style={{ padding: '24px 0', color: 'var(--mut)', fontSize: 13 }}>Não foi possível carregar os cartões.</div>

  const empresasComCartao = Array.from(new Map(dados.cartoes.map(c => [c.empresa_id, c.empresa_nome ?? 'Empresa'])).entries())
  const parcelasFiltradas = filtroEmpresa === 'todas' ? dados.parcelas : dados.parcelas.filter(p => p.empresa_id === filtroEmpresa)
  const totalParcelasAbertas = parcelasFiltradas.reduce((s, p) => s + p.valor, 0)
  const maxGastoCategoria = Math.max(1, ...dados.gasto_por_categoria.map(g => g.valor))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div className="seg-v2">
          {(['consolidado', 'empresas', 'pf'] as EscopoHolding[]).map(e => (
            <span key={e} className={escopo === e ? 'on' : ''} onClick={() => setEscopo(e)}>
              {e === 'consolidado' ? 'Consolidado (PJ+PF)' : e === 'empresas' ? 'Só empresas' : 'Só pessoa física'}
            </span>
          ))}
        </div>
        <Link href="/dashboard/cartoes" className="btn-v2 primary" style={{ textDecoration: 'none' }}>Gerenciar cartões (solicitar / pausar / limites) →</Link>
      </div>
      {grupos.length === 0 && <small style={{ color: 'var(--mut)', fontWeight: 700, fontSize: 11 }}>Sem Holding criada, mostrando sua empresa.</small>}

      {/* Cards visuais (reaproveita cartoes_corporativos) */}
      {dados.cartoes.length === 0 ? (
        <div className="card-v2" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 6 }}>Nenhum cartão cadastrado</div>
          <Link href="/dashboard/cartoes" className="btn-v2 primary" style={{ textDecoration: 'none', display: 'inline-block' }}>Adicionar cartão</Link>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4 }}>
          {dados.cartoes.map(c => (
            <div key={c.id} style={{
              minWidth: 210, height: 120, borderRadius: 14, padding: '14px 16px', flexShrink: 0,
              background: `linear-gradient(135deg, ${c.cor} 0%, ${c.cor}cc 100%)`, color: '#fff', opacity: c.pausado ? 0.5 : 1,
            }}>
              <div style={{ fontSize: 11, opacity: .85, marginBottom: 20 }}>{c.bandeira} {c.empresa_nome ? `· ${c.empresa_nome}` : ''}</div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{c.nome}</div>
              <div style={{ fontSize: 11, opacity: .85, marginTop: 4 }}>Disponível: {formatBRL(c.limite_disponivel)} / {formatBRL(c.limite)}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 14 }}>
        <div className="card-v2">
          <div className="card-v2-h"><h3>Gasto por categoria (parcelado)</h3></div>
          {dados.gasto_por_categoria.length === 0 ? <div style={{ fontSize: 12.5, color: 'var(--mut)' }}>Sem compras parceladas.</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {dados.gasto_por_categoria.map(g => (
                <div key={g.categoria}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                    <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{g.categoria}</span>
                    <span style={{ color: 'var(--mut)' }}>{formatBRL(g.valor)}</span>
                  </div>
                  <div style={{ height: 5, background: 'var(--line)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(g.valor / maxGastoCategoria) * 100}%`, background: 'var(--acc)', borderRadius: 3 }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card-v2" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="card-v2-h" style={{ padding: '14px 16px 0' }}>
            <h3>Parcelas em aberto</h3>
            {empresasComCartao.length > 1 && (
              <select value={filtroEmpresa} onChange={e => setFiltroEmpresa(e.target.value)} style={{ fontSize: 12, border: '1px solid var(--line)', borderRadius: 7, padding: '4px 8px' }}>
                <option value="todas">Todas as empresas</option>
                {empresasComCartao.map(([id, nome]) => <option key={id} value={id ?? ''}>{nome}</option>)}
              </select>
            )}
          </div>
          <div style={{ padding: '6px 16px 0', fontSize: 11.5, color: 'var(--mut)' }}>{parcelasFiltradas.length} parcela(s) em aberto · {formatBRL(totalParcelasAbertas)}</div>
          {parcelasFiltradas.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--mut)', fontSize: 12.5 }}>Nenhuma compra parcelada em aberto.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginTop: 8 }}>
              <thead>
                <tr style={{ borderTop: '1px solid var(--line)', textAlign: 'left' }}>
                  {['Estabelecimento', 'Parcela', 'Valor', 'Empresa', 'Categoria'].map(h => (
                    <th key={h} style={{ padding: '7px 16px', fontWeight: 700, color: 'var(--mut)', fontSize: 10.5, textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parcelasFiltradas.map(p => (
                  <tr key={p.id} style={{ borderTop: '1px solid var(--line)' }}>
                    <td style={{ padding: '7px 16px', fontWeight: 600, color: 'var(--ink)' }}>{p.estabelecimento}{p.titularidade === 'pf' && <span style={{ marginLeft: 5, fontSize: 9.5, color: '#4F46E5', fontWeight: 700 }}>PF</span>}</td>
                    <td style={{ padding: '7px 16px', color: 'var(--mut)' }}>{p.parcela_atual}/{p.total_parcelas}</td>
                    <td style={{ padding: '7px 16px', fontWeight: 700 }}>{formatBRL(p.valor)}</td>
                    <td style={{ padding: '7px 16px', color: 'var(--mut)' }}>{p.empresa_nome ?? '—'}</td>
                    <td style={{ padding: '7px 16px', color: 'var(--mut)' }}>{p.categoria ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
