'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'
import Link from 'next/link'

const CATS_ICON: Record<string, string> = {
  'Alimentação': 'fa-burger', 'Transporte': 'fa-car', 'Moradia': 'fa-house', 'Saúde': 'fa-pills',
  'Lazer': 'fa-film', 'Educação': 'fa-book', 'Vestuário': 'fa-shirt', 'Assinaturas': 'fa-tv',
  'Outros': 'fa-box',
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

  if (loading) return <div style={{ padding: 40, fontSize: 15, color: 'var(--gray-400)' }}>Carregando...</div>

  return (
    <>
      <div className="page-hdr">
        <div>
          <div className="page-title">Olá, {nome.split(' ')[0] || 'você'}</div>
          <div className="page-sub">Resumo financeiro do mês atual</div>
        </div>
        <Link href="/dashboard-pessoal/aicfo" style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--navy)', color: '#fff', borderRadius: 10, padding: '8px 16px', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
          <i className="fa-solid fa-robot" /> Perguntar ao AI CFO
        </Link>
      </div>

      {/* KPIs */}
      <div className="kpis" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <div className="kpi" style={{ borderTop: '3px solid #3D7A6E' }}>
          <div className="kpi-lbl">
            Renda do mês
            <div style={{ width: 28, height: 28, borderRadius: 8, background: '#E9F0ED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa-solid fa-arrow-down-circle" style={{ fontSize: 14, color: '#3D7A6E' }} />
            </div>
          </div>
          <div className="kpi-val">{formatBRL(rendaBase)}</div>
          <div className="kpi-delta up">{receitas > 0 ? '↑ registrada este mês' : 'configure em Receitas'}</div>
        </div>
        <div className="kpi" style={{ borderTop: `3px solid ${pctGasto > 80 ? '#B0413E' : '#B08A3E'}` }}>
          <div className="kpi-lbl">
            Gastos totais
            <div style={{ width: 28, height: 28, borderRadius: 8, background: pctGasto > 80 ? '#F4E4E1' : '#F3ECDA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa-solid fa-arrow-up-circle" style={{ fontSize: 14, color: pctGasto > 80 ? '#B0413E' : '#B08A3E' }} />
            </div>
          </div>
          <div className="kpi-val">{formatBRL(totalGastos)}</div>
          <div className={`kpi-delta ${pctGasto > 80 ? 'dn' : 'warn'}`}>{pctGasto.toFixed(0)}% da renda mensal</div>
        </div>
        <div className="kpi" style={{ borderTop: `3px solid ${saldo >= 0 ? '#3D7A6E' : '#B0413E'}` }}>
          <div className="kpi-lbl">
            Saldo disponível
            <div style={{ width: 28, height: 28, borderRadius: 8, background: saldo >= 0 ? '#E9F0ED' : '#F4E4E1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa-solid fa-wallet" style={{ fontSize: 14, color: saldo >= 0 ? '#3D7A6E' : '#B0413E' }} />
            </div>
          </div>
          <div className="kpi-val">{formatBRL(saldo)}</div>
          <div className={`kpi-delta ${saldo >= 0 ? 'up' : 'dn'}`}>{saldo >= 0 ? '✓ no azul' : '↓ revise os gastos'}</div>
        </div>
        <div className="kpi" style={{ borderTop: '3px solid #7A6A9E' }}>
          <div className="kpi-lbl">
            Assinaturas
            <div style={{ width: 28, height: 28, borderRadius: 8, background: '#F3F0FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa-solid fa-rotate" style={{ fontSize: 14, color: '#7A6A9E' }} />
            </div>
          </div>
          <div className="kpi-val">{formatBRL(totalAssinaturas)}</div>
          <div className="kpi-delta">{assinaturas.filter(a => a.ativa).length} serviços ativos</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
        {/* Onde vai meu dinheiro */}
        <div style={{ background: '#fff', border: '0.5px solid #E4DCCC', borderRadius: 14, padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#13201D', fontFamily: "var(--font-sans)" }}>Para onde vai o dinheiro</div>
              <div style={{ fontSize: 12, color: '#7B8C88', marginTop: 2 }}>Top categorias do mês</div>
            </div>
            <Link href="/dashboard-pessoal/gastos" style={{ fontSize: 12, color: '#3D7A6E', fontWeight: 600, textDecoration: 'none' }}>Ver todos →</Link>
          </div>
          {gastos.length === 0 ? (
            <div style={{ fontSize: 14, color: '#7B8C88', padding: '20px 0', textAlign: 'center' }}>
              <i className="fa-solid fa-receipt" style={{ fontSize: 24, marginBottom: 8, display: 'block', color: '#D1D9D8' }} />
              Nenhum gasto registrado. <Link href="/dashboard-pessoal/gastos" style={{ color: '#3D7A6E' }}>Adicionar</Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {gastos.slice(0, 5).map(g => {
                const pct = totalGastos > 0 ? (g.valor / totalGastos) * 100 : 0
                const icon = CATS_ICON[g.categoria] ?? 'fa-box'
                return (
                  <div key={g.categoria}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5, alignItems: 'center' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: '#13201D' }}>
                        <span style={{ width: 22, height: 22, borderRadius: 6, background: '#F7F4EE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <i className={`fa-solid ${icon}`} style={{ fontSize: 12, color: '#3D7A6E' }} />
                        </span>
                        {g.categoria}
                      </span>
                      <span style={{ color: '#7B8C88' }}>{formatBRL(g.valor)} · <span style={{ fontWeight: 700, color: pct > 40 ? '#B0413E' : '#13201D' }}>{pct.toFixed(0)}%</span></span>
                    </div>
                    <div style={{ height: 6, borderRadius: 99, background: '#F1ECE1' }}>
                      <div style={{ height: '100%', borderRadius: 99, background: pct > 50 ? '#B0413E' : '#3D7A6E', width: `${pct}%`, transition: 'width 0.4s' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Metas */}
          <div style={{ background: '#fff', border: '0.5px solid #E4DCCC', borderRadius: 14, padding: '16px 18px', flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#13201D', fontFamily: "var(--font-sans)" }}>Metas financeiras</div>
              <Link href="/dashboard-pessoal/metas" style={{ fontSize: 12, color: '#3D7A6E', fontWeight: 600, textDecoration: 'none' }}>Ver todas →</Link>
            </div>
            {metas.length === 0 ? (
              <div style={{ fontSize: 13, color: '#7B8C88', textAlign: 'center', padding: '12px 0' }}>
                Nenhuma meta. <Link href="/dashboard-pessoal/metas" style={{ color: '#3D7A6E' }}>Criar</Link>
              </div>
            ) : metas.map(m => {
              const pct = m.valor_meta > 0 ? Math.min(100, (m.valor_atual / m.valor_meta) * 100) : 0
              return (
                <div key={m.nome} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                    <span style={{ fontWeight: 600, color: '#13201D' }}>{m.icone} {m.nome}</span>
                    <span style={{ color: '#7B8C88' }}>{formatBRL(m.valor_atual)} / {formatBRL(m.valor_meta)}</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 99, background: '#F1ECE1' }}>
                    <div style={{ height: '100%', borderRadius: 99, background: '#3D7A6E', width: `${pct}%`, transition: 'width 0.4s' }} />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Assinaturas resumo */}
          <div style={{ background: '#fff', border: '0.5px solid #E4DCCC', borderRadius: 14, padding: '16px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#13201D', fontFamily: "var(--font-sans)" }}>Assinaturas ativas</div>
              <Link href="/dashboard-pessoal/assinaturas" style={{ fontSize: 12, color: '#3D7A6E', fontWeight: 600, textDecoration: 'none' }}>Gerenciar →</Link>
            </div>
            {assinaturas.filter(a => a.ativa).length === 0 ? (
              <div style={{ fontSize: 13, color: '#7B8C88' }}>Nenhuma assinatura. <Link href="/dashboard-pessoal/assinaturas" style={{ color: '#3D7A6E' }}>Adicionar</Link></div>
            ) : assinaturas.filter(a => a.ativa).slice(0, 4).map(a => (
              <div key={a.nome} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, padding: '7px 0', borderBottom: '0.5px solid #EFE9DC' }}>
                <span style={{ fontWeight: 600, color: '#13201D' }}>{a.nome}</span>
                <span style={{ fontFamily: "var(--font-sans)", fontWeight: 700, color: '#B0413E' }}>{formatBRL(Number(a.valor))}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Banner upgrade PJ */}
      <div style={{ background: '#13201D', borderRadius: 14, padding: '16px 20px', marginTop: 12, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 44, height: 44, borderRadius: 11, background: 'rgba(61,122,110,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <i className="fa-solid fa-building" style={{ fontSize: 20, color: '#6FA595' }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 3 }}>Tem uma empresa? Abra sua Conta PJ</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>Acesse DRE, NF-e, portal do contador e cartão corporativo. Tudo integrado ao FactorOne.</div>
        </div>
        <Link href="/dashboard/planos" style={{ background: '#3D7A6E', color: '#fff', borderRadius: 9, padding: '9px 18px', fontSize: 13, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>
          Ver planos PJ
        </Link>
      </div>
    </>
  )
}
