'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'
import Link from 'next/link'

const CATS_ICON: Record<string, string> = {
  'Alimentação': '🍔', 'Transporte': '🚗', 'Moradia': '🏠', 'Saúde': '💊',
  'Lazer': '🎬', 'Educação': '📚', 'Vestuário': '👕', 'Assinaturas': '📺',
  'Outros': '📦',
}

export default function DashboardPessoalPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [nome, setNome] = useState('')
  const [renda, setRenda] = useState(0)
  const [gastos, setGastos] = useState<{ categoria: string; valor: number }[]>([])
  const [assinaturas, setAssinaturas] = useState<{ nome: string; valor: number; ativa: boolean }[]>([])
  const [metas, setMetas] = useState<{ nome: string; valor_meta: number; valor_atual: number; icone: string }[]>([])
  const [receitas, setReceitas] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }

      const ini = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`

      const [perfil, desp, rec, assin, met] = await Promise.all([
        supabase.from('perfil_usuario').select('nome_completo,renda_mensal').eq('user_id', user.id).maybeSingle(),
        supabase.from('despesas_pessoais').select('categoria,valor').eq('user_id', user.id).gte('data_despesa', ini),
        supabase.from('receitas_pessoais').select('valor').eq('user_id', user.id).gte('data_recebimento', ini),
        supabase.from('assinaturas_pessoais').select('nome,valor,ativa').eq('user_id', user.id),
        supabase.from('metas_financeiras_pf').select('nome,valor_meta,valor_atual,icone').eq('user_id', user.id).limit(3),
      ])

      if (cancelled) return
      if (perfil.data?.nome_completo) setNome(perfil.data.nome_completo)
      if (perfil.data?.renda_mensal) setRenda(Number(perfil.data.renda_mensal))

      // Agrupar gastos por categoria
      const map = new Map<string, number>()
      for (const d of desp.data ?? []) {
        const cat = d.categoria || 'Outros'
        map.set(cat, (map.get(cat) ?? 0) + Number(d.valor))
      }
      setGastos(Array.from(map.entries()).map(([categoria, valor]) => ({ categoria, valor })).sort((a, b) => b.valor - a.valor))
      setReceitas((rec.data ?? []).reduce((s, r) => s + Number(r.valor), 0))
      setAssinaturas((assin.data ?? []) as typeof assinaturas)
      setMetas((met.data ?? []) as typeof metas)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [router])

  const totalGastos = useMemo(() => gastos.reduce((s, g) => s + g.valor, 0), [gastos])
  const totalAssinaturas = useMemo(() => assinaturas.filter(a => a.ativa).reduce((s, a) => s + Number(a.valor), 0), [assinaturas])
  const rendaBase = renda || receitas
  const saldo = rendaBase - totalGastos
  const pctGasto = rendaBase > 0 ? Math.min(100, (totalGastos / rendaBase) * 100) : 0

  if (loading) return <div style={{ padding: 40, fontSize: 13, color: 'var(--gray-400)' }}>Carregando...</div>

  return (
    <>
      <div className="page-hdr">
        <div>
          <div className="page-title">Olá, {nome.split(' ')[0] || 'você'}</div>
          <div className="page-sub">Resumo financeiro do mês atual</div>
        </div>
        <Link href="/dashboard-pessoal/aicfo" style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--navy)', color: '#fff', borderRadius: 10, padding: '8px 16px', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
          <i className="fa-solid fa-robot" /> Perguntar ao AI CFO
        </Link>
      </div>

      {/* KPIs */}
      <div className="kpis" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <div className="kpi">
          <div className="kpi-lbl">Renda do mês</div>
          <div className="kpi-val" style={{ color: 'var(--teal)' }}>{formatBRL(rendaBase)}</div>
          <div className="kpi-delta up">{receitas > 0 ? 'registrada' : 'configure em Receitas'}</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Gastos totais</div>
          <div className="kpi-val" style={{ color: pctGasto > 80 ? 'var(--red)' : 'var(--navy)' }}>{formatBRL(totalGastos)}</div>
          <div className={`kpi-delta ${pctGasto > 80 ? 'dn' : 'up'}`}>{pctGasto.toFixed(0)}% da renda</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Saldo disponível</div>
          <div className="kpi-val" style={{ color: saldo >= 0 ? 'var(--teal)' : 'var(--red)' }}>{formatBRL(saldo)}</div>
          <div className={`kpi-delta ${saldo >= 0 ? 'up' : 'dn'}`}>{saldo >= 0 ? 'positivo' : 'negativo'}</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Assinaturas ativas</div>
          <div className="kpi-val">{formatBRL(totalAssinaturas)}</div>
          <div className="kpi-delta">{assinaturas.filter(a => a.ativa).length} serviços</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 8 }}>
        {/* Onde vai meu dinheiro */}
        <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>Para onde vai meu dinheiro</div>
          <div style={{ fontSize: 11, color: 'var(--gray-400)', marginBottom: 14 }}>Top categorias do mês</div>
          {gastos.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--gray-400)', padding: '20px 0' }}>Nenhum gasto registrado ainda. <Link href="/dashboard-pessoal/gastos" style={{ color: 'var(--teal)' }}>Adicionar</Link></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {gastos.slice(0, 5).map(g => {
                const pct = totalGastos > 0 ? (g.valor / totalGastos) * 100 : 0
                return (
                  <div key={g.categoria}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600 }}>{CATS_ICON[g.categoria] ?? '📦'} {g.categoria}</span>
                      <span style={{ color: 'var(--gray-400)' }}>{formatBRL(g.valor)} · {pct.toFixed(0)}%</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 4, background: 'var(--gray-100)' }}>
                      <div style={{ height: '100%', borderRadius: 4, background: pct > 50 ? 'var(--red)' : 'var(--teal)', width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          <Link href="/dashboard-pessoal/gastos" style={{ display: 'block', marginTop: 14, fontSize: 11, color: 'var(--teal)', fontWeight: 600, textDecoration: 'none' }}>Ver todos →</Link>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Metas */}
          <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: 20, flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>Metas</div>
              <Link href="/dashboard-pessoal/metas" style={{ fontSize: 11, color: 'var(--teal)', fontWeight: 600, textDecoration: 'none' }}>Ver todas →</Link>
            </div>
            {metas.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>Nenhuma meta. <Link href="/dashboard-pessoal/metas" style={{ color: 'var(--teal)' }}>Criar</Link></div>
            ) : metas.map(m => {
              const pct = m.valor_meta > 0 ? Math.min(100, (m.valor_atual / m.valor_meta) * 100) : 0
              return (
                <div key={m.nome} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600 }}>{m.icone} {m.nome}</span>
                    <span style={{ color: 'var(--gray-400)' }}>{pct.toFixed(0)}%</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 4, background: 'var(--gray-100)' }}>
                    <div style={{ height: '100%', borderRadius: 4, background: 'var(--green)', width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Assinaturas resumo */}
          <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>Assinaturas ativas</div>
              <Link href="/dashboard-pessoal/assinaturas" style={{ fontSize: 11, color: 'var(--teal)', fontWeight: 600, textDecoration: 'none' }}>Gerenciar →</Link>
            </div>
            {assinaturas.filter(a => a.ativa).slice(0, 4).map(a => (
              <div key={a.nome} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '6px 0', borderBottom: '1px solid var(--gray-100)' }}>
                <span style={{ fontWeight: 600 }}>📺 {a.nome}</span>
                <span style={{ fontFamily: "'Inter', sans-serif", color: 'var(--red)' }}>{formatBRL(Number(a.valor))}</span>
              </div>
            ))}
            {assinaturas.filter(a => a.ativa).length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>Nenhuma assinatura. <Link href="/dashboard-pessoal/assinaturas" style={{ color: 'var(--teal)' }}>Adicionar</Link></div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
