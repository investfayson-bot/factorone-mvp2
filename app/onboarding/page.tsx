'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { setInstalled } from '@/lib/marketplace'
import toast from 'react-hot-toast'

type Screen = 'splash' | 'perfil' | 'empresa' | 'segmento' | 'banco'

const PJ_STEPS = [
  { key: 'perfil',   label: 'Tipo de conta'  },
  { key: 'empresa',  label: 'Sua empresa'    },
  { key: 'segmento', label: 'O que você faz' },
  { key: 'banco',    label: 'Conectar banco' },
] as const

// Cada segmento monta o workspace: liga os apps certos, o resto fica no Marketplace.
type Seg = { key: string; icon: string; cor: string; titulo: string; desc: string; apps: string[]; inclui: string[] }
const SEGMENTOS: Seg[] = [
  { key: 'produto', icon: 'fa-bag-shopping', cor: 'var(--teal)', titulo: 'Vendo produto', desc: 'Loja, e-commerce, artesanato — vende pelo site/Instagram/WhatsApp.',
    apps: ['crm', 'mkt', 'captacao', 'agenda', 'posvenda', 'produtos', 'sales', 'prop', 'ar'], inclui: ['CRM & vendas', 'Marketing & site', 'Produtos & margem', 'Pós-venda'] },
  { key: 'servico', icon: 'fa-user-doctor', cor: 'var(--navy)', titulo: 'Presto serviço', desc: 'Dentista, advogado, consultoria, clínica — atende cliente e agenda.',
    apps: ['crm', 'agenda', 'captacao', 'posvenda', 'prop', 'mkt', 'juridico'], inclui: ['Agendamento', 'CRM & clientes', 'Pós-venda', 'Propostas'] },
  { key: 'imoveis', icon: 'fa-building', cor: 'var(--gold)', titulo: 'Gerencio imóveis', desc: 'Aluguéis, obras, veículos, distribuição entre sócios.',
    apps: ['invest'], inclui: ['Imóveis & aluguéis', 'Obras & reformas', 'Distribuição por sócio'] },
  { key: 'industria', icon: 'fa-industry', cor: 'var(--teal)', titulo: 'Produzo e vendo', desc: 'Indústria/fabricação — produz, estoca e vende (ex: sabão, alimentos).',
    apps: ['crm', 'mkt', 'captacao', 'posvenda', 'produtos', 'inv', 'logistica', 'sales', 'ar'], inclui: ['Produtos & margem', 'Estoque', 'Logística', 'Pós-venda'] },
  { key: 'completo', icon: 'fa-layer-group', cor: 'var(--navy)', titulo: 'Quero tudo', desc: 'Me mostra a plataforma completa — eu escolho depois.',
    apps: ['crm', 'mkt', 'captacao', 'agenda', 'posvenda'], inclui: ['Tudo ligado', 'Ajusta no Marketplace quando quiser'] },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [screen, setScreen]     = useState<Screen>('splash')
  const [loading, setLoading]   = useState(false)
  const [userName, setUserName] = useState('')
  const [empresaId, setEmpresaId] = useState('')
  const [isPJ, setIsPJ]         = useState(false)

  const [empresa, setEmpresa] = useState({ nome: '', cnpj: '', setor: '', telefone: '' })

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      const n = user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email?.split('@')[0] ?? ''
      setUserName(n)
    })
  }, [])

  // Tipo de conta escolhido ANTES do login (tela de auth) — pula a etapa de seleção.
  const [tipoConsumido, setTipoConsumido] = useState(false)
  useEffect(() => {
    if (tipoConsumido) return
    const tipo = localStorage.getItem('fo_account_type')
    if (tipo !== 'pessoal' && tipo !== 'empresarial') return
    setTipoConsumido(true)
    localStorage.removeItem('fo_account_type')
    if (tipo === 'pessoal') void escolherPessoal()
    else void escolherEmpresarial()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipoConsumido])

  /* ── helpers ── */
  async function iniciar() { setScreen('perfil') }

  async function escolherPessoal() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }
      await supabase.from('perfil_usuario').upsert({ user_id: user.id, tipo: 'pessoal' }, { onConflict: 'user_id' })
      router.push('/dashboard-pessoal')
    } catch { toast.error('Falha ao salvar') }
    finally { setLoading(false) }
  }

  async function escolherEmpresarial() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }
      await supabase.from('perfil_usuario').upsert({ user_id: user.id, tipo: 'empresarial' }, { onConflict: 'user_id' })
      const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
      setEmpresaId(u?.empresa_id ?? user.id)
      setIsPJ(true)
      setScreen('empresa')
    } catch { toast.error('Falha ao salvar') }
    finally { setLoading(false) }
  }

  async function salvarEmpresa() {
    if (!empresa.nome.trim()) { toast.error('Informe o nome da empresa'); return }
    setLoading(true)
    try {
      await supabase.from('empresas').update({
        nome: empresa.nome.trim(),
        ...(empresa.cnpj    ? { cnpj:  empresa.cnpj.replace(/\D/g, '') } : {}),
        ...(empresa.setor   ? { setor: empresa.setor }   : {}),
      }).eq('id', empresaId)
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.access_token) {
          fetch('/api/email/boas-vindas', { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` } }).catch(() => {})
        }
      })
      setScreen('segmento')
    } catch { toast.error('Falha ao salvar empresa') }
    finally { setLoading(false) }
  }

  // Monta o workspace pelo segmento: instala o preset de apps (durável no banco) e marca o segmento.
  async function escolherSegmento(key: string) {
    setLoading(true)
    try {
      const seg = SEGMENTOS.find(s => s.key === key)
      if (seg) {
        if (empresaId) localStorage.setItem(`fo_segmento_${empresaId}`, key)
        await Promise.all(seg.apps.map(id => setInstalled(id, true).catch(() => {})))
      }
      setScreen('banco')
    } catch { toast.error('Falha ao configurar workspace') }
    finally { setLoading(false) }
  }

  /* ── step index for sidebar ── */
  const stepIdx = PJ_STEPS.findIndex(s => s.key === screen)
  const showSidebar = isPJ && screen !== 'splash'

  /* ── layout ── */
  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#F5F7FA' }}>

      {/* ── Sidebar (wizard PJ) ── */}
      {showSidebar && (
        <aside style={{ width: 260, background: 'var(--navy)', display: 'flex', flexDirection: 'column', padding: '32px 24px', flexShrink: 0 }}>
          {/* Logo */}
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: '-.04em', marginBottom: 6 }}>
            Factor<span style={{ color: 'var(--teal)' }}>One</span>
          </div>
          {empresa.nome && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', marginTop: 4, fontWeight: 500 }}>
              {empresa.nome}
            </div>
          )}
          {userName && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', marginBottom: 36 }}>{userName}</div>
          )}

          {/* Steps */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {PJ_STEPS.map((s, i) => {
              const done   = i < stepIdx
              const active = i === stepIdx
              return (
                <div key={s.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, paddingBottom: i < PJ_STEPS.length - 1 ? 0 : 0 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700, flexShrink: 0, zIndex: 1,
                      background: done ? 'var(--teal)' : active ? '#fff' : 'rgba(255,255,255,.1)',
                      color: done ? '#fff' : active ? 'var(--navy)' : 'rgba(255,255,255,.4)',
                      border: active ? '2px solid rgba(255,255,255,.3)' : 'none',
                    }}>
                      {done ? <i className="fa-solid fa-check" style={{ fontSize: 10 }} /> : i + 1}
                    </div>
                    {i < PJ_STEPS.length - 1 && (
                      <div style={{ width: 2, height: 32, background: done ? 'var(--teal)' : 'rgba(255,255,255,.1)', margin: '2px 0' }} />
                    )}
                  </div>
                  <div style={{ paddingTop: 4, paddingBottom: i < PJ_STEPS.length - 1 ? 30 : 0 }}>
                    <div style={{ fontSize: 12, fontWeight: active ? 700 : 500, color: active ? '#fff' : done ? 'rgba(255,255,255,.7)' : 'rgba(255,255,255,.35)' }}>
                      {s.label}
                    </div>
                  </div>
                </div>
              )
            })}
          </nav>

          <div style={{ marginTop: 'auto', fontSize: 10, color: 'rgba(255,255,255,.2)', lineHeight: 1.6 }}>
            © 2026 FactorOne<br />Termos · Privacidade
          </div>
        </aside>
      )}

      {/* ── Main content ── */}
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 24px' }}>

        {/* SPLASH */}
        {screen === 'splash' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: 560, width: '100%', textAlign: 'center' }}>
            {/* Banner */}
            <div style={{ marginBottom: 24, width: '100%', maxWidth: 480, borderRadius: 16, overflow: 'hidden', boxShadow: '0 12px 34px rgba(28,43,42,.22)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/onboarding-hero.png" alt="FactorOne Finance OS" style={{ width: '100%', display: 'block' }} />
            </div>

            {/* Logo */}
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600, color: 'var(--gray-400)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 }}>
              Finance OS
            </div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 28, fontWeight: 800, color: 'var(--navy)', letterSpacing: '-.03em', marginBottom: 6 }}>
              {userName ? `Bem-vindo, ${userName.split(' ')[0]}!` : 'Bem-vindo ao FactorOne'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--gray-400)', lineHeight: 1.7, marginBottom: 32, maxWidth: 420 }}>
              Este é o primeiro passo para simplificar a gestão financeira da sua empresa ou vida pessoal.
            </div>

            {/* Value props */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 400, marginBottom: 32, textAlign: 'left' }}>
              {[
                { icon: 'fa-gauge-high',    color: 'var(--teal)',  title: 'Gestão financeira completa', desc: 'DRE, Fluxo de Caixa, Contas a Pagar e Receber' },
                { icon: 'fa-robot',         color: 'var(--navy)',  title: 'AI CFO em tempo real',       desc: 'Insights automáticos e análises inteligentes' },
                { icon: 'fa-file-invoice',  color: 'var(--gold)',  title: 'Fiscal & Contabilidade',     desc: 'NF-e, DAS automático e portal do contador' },
              ].map(v => (
                <div key={v.title} style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '12px 16px', background: '#fff', borderRadius: 10, border: '1px solid var(--gray-100)', boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: `${v.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <i className={`fa-solid ${v.icon}`} style={{ color: v.color, fontSize: 15 }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', marginBottom: 1 }}>{v.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{v.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <button className="btn-action" style={{ width: '100%', maxWidth: 400, padding: '13px 0', fontSize: 14 }} onClick={() => void iniciar()}>
              Iniciar configuração <i className="fa-solid fa-arrow-right" style={{ marginLeft: 8 }} />
            </button>
          </div>
        )}

        {/* STEP: Tipo de conta */}
        {screen === 'perfil' && (
          <div style={{ width: '100%', maxWidth: 600 }}>
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 22, fontFamily: "var(--font-sans)", fontWeight: 800, color: 'var(--navy)', marginBottom: 6 }}>Como você vai usar o FactorOne?</div>
              <div style={{ fontSize: 13, color: 'var(--gray-400)' }}>Escolha o modo principal. Você pode usar os dois.</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {/* PJ */}
              <button
                onClick={() => void escolherEmpresarial()}
                disabled={loading}
                style={{ background: '#fff', border: '2px solid var(--teal)', borderRadius: 14, padding: '24px 22px', textAlign: 'left', cursor: 'pointer', opacity: loading ? .6 : 1, transition: 'box-shadow .15s', boxShadow: '0 2px 10px rgba(61,122,110,.1)' }}
              >
                <div style={{ width: 46, height: 46, background: 'var(--teal)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <i className="fa-solid fa-building" style={{ color: '#fff', fontSize: 18 }} />
                </div>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: 16, fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>Empresarial (PJ)</div>
                <div style={{ fontSize: 12, color: 'var(--gray-400)', lineHeight: 1.6, marginBottom: 16 }}>PMEs, startups e agências que precisam de gestão financeira completa.</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {['DRE & Fluxo de Caixa', 'AI CFO + Relatórios', 'NF-e, DAS, Contador'].map(f => (
                    <div key={f} style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--gray-500)', alignItems: 'center' }}>
                      <i className="fa-solid fa-circle-check" style={{ color: 'var(--teal)', fontSize: 11 }} /> {f}
                    </div>
                  ))}
                </div>
              </button>
              {/* PF */}
              <button
                onClick={() => void escolherPessoal()}
                disabled={loading}
                style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 14, padding: '24px 22px', textAlign: 'left', cursor: 'pointer', opacity: loading ? .6 : 1 }}
              >
                <div style={{ width: 46, height: 46, background: 'var(--gray-100)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <i className="fa-solid fa-user" style={{ color: 'var(--gray-500)', fontSize: 18 }} />
                </div>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: 16, fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>Pessoa Física</div>
                <div style={{ fontSize: 12, color: 'var(--gray-400)', lineHeight: 1.6, marginBottom: 16 }}>Organização financeira pessoal, metas e controle de gastos.</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {['Controle de gastos & metas', 'IRPF & investimentos', 'Orçamento mensal'].map(f => (
                    <div key={f} style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--gray-500)', alignItems: 'center' }}>
                      <i className="fa-solid fa-circle" style={{ color: 'var(--gray-300)', fontSize: 5 }} /> {f}
                    </div>
                  ))}
                </div>
              </button>
            </div>
            <button className="btn-action btn-ghost" style={{ marginTop: 16, fontSize: 12 }} onClick={() => setScreen('splash')}>
              <i className="fa-solid fa-arrow-left" style={{ marginRight: 6 }} /> Voltar
            </button>
          </div>
        )}

        {/* STEP: Dados da Empresa */}
        {screen === 'empresa' && (
          <div style={{ width: '100%', maxWidth: 520 }}>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 22, fontFamily: "var(--font-sans)", fontWeight: 800, color: 'var(--navy)', marginBottom: 6 }}>Como chama sua empresa?</div>
              <div style={{ fontSize: 13, color: 'var(--gray-400)' }}>Um campo e pronto — CNPJ, setor e o resto você completa depois, dentro do sistema.</div>
            </div>

            <div style={{ background: '#fff', borderRadius: 12, padding: '24px', border: '1px solid var(--gray-100)' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Nome da empresa <span style={{ color: 'var(--red)' }}>*</span></label>
                <input className="form-input" placeholder="Ex: Acme Tecnologia Ltda" value={empresa.nome} onChange={e => setEmpresa(p => ({ ...p, nome: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter' && empresa.nome.trim()) void salvarEmpresa() }} style={{ fontSize: 15 }} autoFocus />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button className="btn-action btn-ghost" style={{ flex: 1 }} onClick={() => setScreen('perfil')}>Voltar</button>
              <button className="btn-action" style={{ flex: 2, opacity: loading ? .6 : 1 }} onClick={() => void salvarEmpresa()} disabled={loading}>
                {loading ? 'Salvando…' : 'Continuar'}
              </button>
            </div>
          </div>
        )}

        {/* STEP: Segmento de negócio — monta o workspace */}
        {screen === 'segmento' && (
          <div style={{ width: '100%', maxWidth: 640 }}>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 22, fontFamily: 'var(--font-sans)', fontWeight: 800, color: 'var(--navy)', marginBottom: 6 }}>O que você faz?</div>
              <div style={{ fontSize: 13, color: 'var(--gray-400)' }}>Vou montar seu painel com as ferramentas certas. O resto fica no Marketplace — você liga quando quiser.</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {SEGMENTOS.map(s => (
                <button key={s.key} onClick={() => void escolherSegmento(s.key)} disabled={loading}
                  style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 14, padding: '18px 18px', textAlign: 'left', cursor: loading ? 'default' : 'pointer', opacity: loading ? .6 : 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ width: 42, height: 42, background: `color-mix(in srgb, ${s.cor} 14%, #fff)`, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                    <i className={`fa-solid ${s.icon}`} style={{ color: s.cor, fontSize: 17 }} />
                  </div>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 700, color: 'var(--navy)' }}>{s.titulo}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--gray-400)', lineHeight: 1.5, marginBottom: 6 }}>{s.desc}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 'auto' }}>
                    {s.inclui.map(f => <span key={f} style={{ fontSize: 10, fontWeight: 600, color: 'var(--teal)', background: 'rgba(61,122,110,.1)', padding: '2px 7px', borderRadius: 100 }}>{f}</span>)}
                  </div>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16, alignItems: 'center' }}>
              <button className="btn-action btn-ghost" style={{ fontSize: 12 }} onClick={() => setScreen('empresa')}>
                <i className="fa-solid fa-arrow-left" style={{ marginRight: 6 }} /> Voltar
              </button>
              <button className="btn-action btn-ghost" style={{ fontSize: 12 }} onClick={() => void escolherSegmento('completo')} disabled={loading}>
                Pular — decido depois
              </button>
            </div>
          </div>
        )}

        {/* CONECTAR BANCO (mesma página, depois do cadastro) */}
        {screen === 'banco' && (
          <div style={{ maxWidth: 540, width: '100%' }}>
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 24, fontWeight: 800, color: 'var(--navy)', letterSpacing: '-.02em', marginBottom: 6 }}>
                {empresa.nome ? `${empresa.nome} criada! ` : 'Quase lá! '}Conecte seu banco.
              </div>
              <div style={{ fontSize: 13.5, color: 'var(--gray-500)', lineHeight: 1.65 }}>
                Traga saldo e extrato por Open Finance. A IA já começa a <b>classificar suas compras</b> e montar a contabilidade — sem você digitar nada.
              </div>
            </div>

            {/* Banner com foto */}
            <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid var(--gray-100)', marginBottom: 16, boxShadow: '0 6px 20px rgba(19,32,29,.10)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/banco-hero.jpg" alt="Conecte seu banco ao FactorOne" style={{ width: '100%', height: 168, objectFit: 'cover', objectPosition: 'center', display: 'block' }} />
            </div>

            {/* Benefícios */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 22 }}>
              {[
                { icon: 'fa-building-columns', title: 'Saldo e extrato automáticos', desc: 'Conexão segura via Belvo (Open Finance)' },
                { icon: 'fa-wand-magic-sparkles', title: 'Classificação por IA', desc: 'Cada compra vira lançamento contábil sozinho' },
                { icon: 'fa-shield-halved', title: 'Somente leitura', desc: 'O FactorOne nunca move o seu dinheiro' },
              ].map(b => (
                <div key={b.title} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '11px 14px', background: '#fff', borderRadius: 10, border: '1px solid var(--gray-100)' }}>
                  <div style={{ width: 36, height: 36, background: 'rgba(61,122,110,.12)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <i className={`fa-solid ${b.icon}`} style={{ color: 'var(--teal)', fontSize: 14 }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--navy)' }}>{b.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{b.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <button className="btn-action" style={{ width: '100%', padding: '13px 0', fontSize: 14, marginBottom: 8 }} onClick={() => router.push('/dashboard/conexoes')}>
              <i className="fa-solid fa-link" style={{ marginRight: 8 }} />Conectar meu banco
            </button>
            <button className="btn-action btn-ghost" style={{ width: '100%', padding: '11px 0', fontSize: 13 }} onClick={() => router.push('/dashboard')}>
              Agora não — ir pro painel
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
