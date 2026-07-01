'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, YAxis, AreaChart, Area } from 'recharts'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'
import { maskCpfCnpj } from '@/lib/masks'
import toast from 'react-hot-toast'

type Empresa = { nome: string; cnpj: string | null; email: string | null; setor: string | null }
type Conta = { id: string; saldo_disponivel: number; saldo: number; agencia: string | null; numero_conta: string | null; digito: string | null; status: string }
type Tx = { id: string; tipo: 'credito' | 'debito'; descricao: string; data_transacao: string; valor: number; contraparte_nome?: string | null }

const ACOES = [
  { label: 'PIX', emoji: 'fa-bolt', href: '/dashboard/conta-pj/transferencias', bg: 'rgba(94,140,135,.1)', color: 'var(--teal)' },
  { label: 'Pagar', emoji: 'fa-sack-dollar', href: '/dashboard/financeiro', bg: 'rgba(26,43,74,.08)', color: 'var(--navy)' },
  { label: 'Cobrar', emoji: 'fa-clipboard-list', href: '/dashboard/financeiro', bg: 'rgba(184,146,42,.1)', color: 'var(--gold)' },
  { label: 'Transferir', emoji: 'fa-right-left', href: '/dashboard/conta-pj/transferencias', bg: 'rgba(124,58,237,.08)', color: '#7C3AED' },
  { label: 'Extrato', emoji: 'fa-chart-column', href: '/dashboard/conta-pj/extrato', bg: 'rgba(45,155,111,.08)', color: 'var(--green)' },
  { label: 'Open Finance', emoji: 'fa-link', href: '/dashboard/conta-pj/conectar-banco', bg: 'rgba(94,140,135,.08)', color: 'var(--teal)' },
]

const FUNCIONALIDADES = [
  { emoji: 'fa-bolt', label: 'PIX', desc: 'Envie e receba 24h por dia', href: '/dashboard/conta-pj/transferencias' },
  { emoji: 'fa-sack-dollar', label: 'Pagamentos', desc: 'Pague contas, boletos e tributos', href: '/dashboard/financeiro' },
  { emoji: 'fa-right-left', label: 'Transferências', desc: 'TED, DOC e transferências internas', href: '/dashboard/conta-pj/transferencias' },
  { emoji: 'fa-file-lines', label: 'Cobranças', desc: 'Emita cobranças e boletos', href: '/dashboard/financeiro' },
  { emoji: 'fa-link', label: 'Open Finance', desc: 'Conecte contas de outros bancos', href: '/dashboard/conta-pj/conectar-banco' },
  { emoji: 'fa-credit-card', label: 'Cartões', desc: 'Peça cartões para sua empresa', href: '/dashboard/cartoes' },
  { emoji: 'fa-chart-column', label: 'Relatórios', desc: 'Relatórios financeiros completos', href: '/dashboard/relatorios' },
  { emoji: 'fa-money-bill-wave', label: 'Gestão de Caixa', desc: 'Controle seu fluxo de caixa', href: '/dashboard/cashflow' },
  { emoji: 'fa-plug', label: 'Integrações', desc: 'Integre com sistemas e plataformas', href: '/dashboard/integracoes' },
]

const CARGOS = ['Sócio Administrador', 'Diretor', 'Gerente', 'Procurador', 'Representante Legal']
const SEGMENTOS = ['Tecnologia', 'Varejo', 'Serviços', 'Saúde', 'Educação', 'Alimentação', 'Construção', 'Transporte', 'Financeiro', 'Outro']
const ESTADOS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

const STEP_LABELS = ['Informações da empresa', 'Dados dos responsáveis', 'Endereço da empresa', 'Documentos', 'Confirmação de dados']

function buildBalanceTrend(txs: Tx[], saldoAtual: number) {
  const sorted = [...txs].sort((a, b) => a.data_transacao.localeCompare(b.data_transacao))
  const totalDelta = sorted.reduce((s, t) => s + (t.tipo === 'credito' ? Number(t.valor) : -Number(t.valor)), 0)
  let running = saldoAtual - totalDelta
  const map: Record<string, number> = {}
  for (const t of sorted) {
    const key = t.data_transacao.slice(0, 10)
    running += t.tipo === 'credito' ? Number(t.valor) : -Number(t.valor)
    map[key] = running
  }
  const today = new Date()
  const result: { date: string; saldo: number }[] = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    if (map[key] !== undefined) result.push({ date: key.slice(5), saldo: map[key] })
    else if (result.length > 0) result.push({ date: key.slice(5), saldo: result[result.length - 1].saldo })
  }
  return result
}

function buildChartData(txs: Tx[]) {
  const map: Record<string, { entrada: number; saida: number }> = {}
  const today = new Date()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    map[key] = { entrada: 0, saida: 0 }
  }
  txs.forEach(t => {
    const key = t.data_transacao.slice(0, 10)
    if (!map[key]) return
    if (t.tipo === 'credito') map[key].entrada += Number(t.valor)
    else map[key].saida += Number(t.valor)
  })
  return Object.entries(map).map(([date, v]) => ({ date: date.slice(5), entrada: v.entrada, saida: v.saida }))
}

function StepIndicator({ step, goTo }: { step: number; goTo: (s: number) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', marginBottom: 36, gap: 0 }}>
      {STEP_LABELS.map((label, i) => {
        const n = i + 1
        const done = n < step
        const active = n === step
        return (
          <div key={n} style={{ display: 'flex', alignItems: 'flex-start', flex: n < 5 ? 1 : 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 52 }}>
              <button
                onClick={() => done && goTo(n)}
                style={{
                  width: 32, height: 32, borderRadius: '50%', border: 'none', cursor: done ? 'pointer' : 'default',
                  background: done ? 'var(--teal)' : active ? 'var(--navy)' : 'var(--gray-100)',
                  color: done || active ? '#fff' : 'var(--gray-400)',
                  fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all .2s', flexShrink: 0,
                }}
              >
                {done ? <i className="fa-solid fa-check" style={{ fontSize: 12 }} /> : n}
              </button>
              <div style={{ fontSize: 10, fontWeight: active ? 700 : 500, color: active ? 'var(--navy)' : done ? 'var(--teal)' : 'var(--gray-400)', marginTop: 6, textAlign: 'center', maxWidth: 80, lineHeight: 1.3 }}>
                {label}
              </div>
            </div>
            {n < 5 && (
              <div style={{ flex: 1, height: 2, background: done ? 'var(--teal)' : 'var(--gray-100)', marginTop: 15, marginLeft: 4, marginRight: 4, borderRadius: 2, transition: 'background .2s' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-500)', display: 'block', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  )
}

function FileUploadBox({ label, accept, value, onChange }: { label: string; accept: string; value: string; onChange: (name: string) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div
      onClick={() => ref.current?.click()}
      style={{ border: `1.5px dashed ${value ? 'var(--teal)' : 'var(--gray-200)'}`, borderRadius: 10, padding: '18px 16px', textAlign: 'center', cursor: 'pointer', background: value ? 'rgba(94,140,135,.04)' : 'var(--gray-50)', transition: 'all .15s', marginBottom: 12 }}
    >
      <input ref={ref} type="file" accept={accept} style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) onChange(e.target.files[0].name) }} />
      {value ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <i className="fa-solid fa-circle-check" style={{ color: 'var(--teal)', fontSize: 16 }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--teal)' }}>{value}</span>
        </div>
      ) : (
        <>
          <i className="fa-solid fa-cloud-arrow-up" style={{ fontSize: 22, color: 'var(--gray-300)', marginBottom: 8 }} />
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 4 }}>
            <span style={{ color: 'var(--teal)' }}>Clique para enviar</span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--gray-400)' }}>PDF, PNG ou JPG até 10MB</div>
        </>
      )}
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-500)', marginTop: value ? 0 : 6 }}>{label}</div>
    </div>
  )
}

export default function ContaPJPage() {
  const [loading, setLoading] = useState(true)
  const [empresaId, setEmpresaId] = useState('')
  const [empresa, setEmpresa] = useState<Empresa>({ nome: '', cnpj: null, email: null, setor: null })
  const [conta, setConta] = useState<Conta | null>(null)
  const [txs, setTxs] = useState<Tx[]>([])
  const [entradasMes, setEntradasMes] = useState(0)
  const [saidasMes, setSaidasMes] = useState(0)
  const [numCartoes, setNumCartoes] = useState(0)
  const [hide, setHide] = useState(false)
  const [extratoTab, setExtratoTab] = useState<'todas' | 'entradas' | 'saidas'>('todas')
  const [chartTab, setChartTab] = useState<'saldo' | 'fluxo'>('fluxo')
  const [userName, setUserName] = useState('')

  // Wizard state
  const [wStep, setWStep] = useState(1)
  const [wSuccess, setWSuccess] = useState(false)
  const [wTermos, setWTermos] = useState(false)
  const [cepLoading, setCepLoading] = useState(false)
  const [w1, setW1] = useState({ cnpj: '', razaoSocial: '', nomeFantasia: '', segmento: '' })
  const [w2, setW2] = useState({ nome: '', cpf: '', cargo: 'Sócio Administrador', email: '', telefone: '' })
  const [w3, setW3] = useState({ cep: '', endereco: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '' })
  const [w4, setW4] = useState({ contrato: '', docResp: '', comprovante: '' })
  const [wEditSection, setWEditSection] = useState<null | 1 | 2>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserName(user.email?.split('@')[0] ?? '')
    const { data: u } = await supabase.from('usuarios').select('empresa_id,nome').eq('id', user.id).maybeSingle()
    const eid = (u?.empresa_id as string) || user.id
    if (u?.nome) setUserName(u.nome as string)
    setEmpresaId(eid)

    const since30 = new Date(); since30.setDate(since30.getDate() - 30)
    const mes0 = new Date(); mes0.setDate(1)
    const [empR, contaR, txR, cartoesR] = await Promise.all([
      supabase.from('empresas').select('nome,cnpj,email,setor').eq('id', eid).maybeSingle(),
      supabase.from('contas_bancarias').select('id,saldo_disponivel,saldo,agencia,numero_conta,digito,status').eq('empresa_id', eid).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('extrato_bancario').select('id,tipo,descricao,valor,data_transacao,contraparte_nome').eq('empresa_id', eid).gte('data_transacao', since30.toISOString().slice(0, 10)).order('data_transacao', { ascending: false }).limit(100),
      supabase.from('solicitacoes_cartao').select('id', { count: 'exact', head: true }).eq('empresa_id', eid).eq('status', 'aprovado'),
    ])
    const emp = empR.data as Empresa | null
    setEmpresa({ nome: emp?.nome ?? '', cnpj: emp?.cnpj ?? null, email: emp?.email ?? null, setor: emp?.setor ?? null })
    setW1(prev => ({ ...prev, cnpj: emp?.cnpj ?? '', razaoSocial: emp?.nome ?? '', segmento: emp?.setor ?? '' }))
    setW2(prev => ({ ...prev, email: emp?.email ?? '' }))
    setConta((contaR.data as Conta) ?? null)
    const allTxs = (txR.data ?? []) as Tx[]
    setTxs(allTxs)
    const mes0Str = mes0.toISOString().slice(0, 10)
    setEntradasMes(allTxs.filter(t => t.tipo === 'credito' && t.data_transacao >= mes0Str).reduce((s, t) => s + Number(t.valor), 0))
    setSaidasMes(allTxs.filter(t => t.tipo === 'debito' && t.data_transacao >= mes0Str).reduce((s, t) => s + Number(t.valor), 0))
    setNumCartoes(cartoesR.count ?? 0)
    setLoading(false)
  }, [])

  useEffect(() => { void carregar() }, [carregar])

  async function buscarCep(cep: string) {
    const raw = cep.replace(/\D/g, '')
    if (raw.length !== 8) return
    setCepLoading(true)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${raw}/json/`)
      const data = await res.json()
      if (!data.erro) {
        setW3(p => ({ ...p, endereco: data.logradouro ?? p.endereco, bairro: data.bairro ?? p.bairro, cidade: data.localidade ?? p.cidade, estado: data.uf ?? p.estado }))
      }
    } catch { /* ignore */ }
    setCepLoading(false)
  }

  async function criarContaManual() {
    await supabase.from('empresas').update({
      nome: w1.razaoSocial || undefined,
      cnpj: w1.cnpj || undefined,
      setor: w1.segmento || undefined,
      email: w2.email || undefined,
    }).eq('id', empresaId)
    await supabase.from('contas_bancarias').insert({ empresa_id: empresaId, tipo: 'corrente', status: 'ativa', saldo: 0, saldo_disponivel: 0 })
    await carregar()
  }

  async function finalizarWizard() {
    await criarContaManual()
    setWSuccess(true)
  }

  function copiarPix() {
    const key = empresa.cnpj ?? empresa.email ?? empresaId
    void navigator.clipboard.writeText(key)
    toast.success('Chave PIX copiada!')
  }

  if (loading) return <div style={{ padding: 32, color: 'var(--gray-400)', fontSize: 13 }}>Carregando…</div>

  // ─── SUCCESS SCREEN ──────────────────────────────────────────────────────
  if (wSuccess) return (
    <div style={{ maxWidth: 520, margin: '40px auto', padding: '0 16px', textAlign: 'center' }}>
      <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg,var(--teal),#2D9B6F)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
        <i className="fa-solid fa-check" style={{ fontSize: 32, color: '#fff' }} />
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--navy)', fontFamily: "'Space Grotesk', system-ui, sans-serif", marginBottom: 8 }}>
        Conta PJ criada com sucesso!
      </div>
      <div style={{ fontSize: 13, color: 'var(--gray-400)', marginBottom: 28 }}>
        Sua conta está pronta para uso. Confira os dados abaixo.
      </div>
      <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 14, padding: 24, marginBottom: 20, textAlign: 'left' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 14 }}>Dados da conta</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--gray-400)', marginBottom: 3 }}>Empresa</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>{w1.razaoSocial || empresa.nome}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--gray-400)', marginBottom: 3 }}>Segmento</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)' }}>{w1.segmento || empresa.setor || '—'}</div>
          </div>
          {conta?.agencia && (
            <>
              <div>
                <div style={{ fontSize: 10, color: 'var(--gray-400)', marginBottom: 3 }}>Agência</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--navy)', fontFamily: 'monospace' }}>{conta.agencia}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--gray-400)', marginBottom: 3 }}>Conta</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--navy)', fontFamily: 'monospace' }}>{conta.numero_conta}{conta.digito ? `-${conta.digito}` : ''}</div>
              </div>
            </>
          )}
        </div>
        <div style={{ borderTop: '1px solid var(--gray-100)', paddingTop: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', marginBottom: 10 }}>O que você pode fazer agora:</div>
          {['Realizar pagamentos e PIX', 'Conectar via Open Finance', 'Solicitar cartão corporativo', 'Gerir suas finanças'].map(item => (
            <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 12, color: 'var(--navy)' }}>
              <i className="fa-solid fa-check" style={{ color: 'var(--teal)', fontSize: 11 }} />
              {item}
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        <button className="btn-action" onClick={() => setWSuccess(false)} style={{ flex: 1 }}>
          <i className="fa-solid fa-gauge-high" style={{ marginRight: 8 }} />Acessar minha conta
        </button>
        <Link href="/dashboard/conta-pj/conectar-banco" className="btn-action btn-ghost" style={{ flex: 1, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <i className="fa-solid fa-link" style={{ marginRight: 8 }} />Explorar funcionalidades
        </Link>
      </div>
      <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 16 }}>
        As funcionalidades serão analisadas e liberadas em até 24h.
      </div>
    </div>
  )

  // ─── WIZARD (no account) ─────────────────────────────────────────────────
  if (!conta) return (
    <div style={{ maxWidth: wStep === 5 ? 900 : 640, margin: '0 auto', padding: '24px 16px' }}>
      <StepIndicator step={wStep} goTo={setWStep} />

      {/* STEP 1 — Informações da empresa */}
      {wStep === 1 && (
        <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 14, padding: '28px 32px' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--navy)', fontFamily: "'Space Grotesk', system-ui, sans-serif", marginBottom: 4 }}>Informações da empresa</div>
          <div style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 24 }}>Dados básicos para abrir sua conta PJ gratuita.</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
            <FieldGroup label="CNPJ">
              <input className="form-input" placeholder="00.000.000/0001-00" value={w1.cnpj}
                onChange={e => setW1(p => ({ ...p, cnpj: maskCpfCnpj(e.target.value) }))} />
            </FieldGroup>
            <FieldGroup label="Segmento">
              <select className="form-input" value={w1.segmento} onChange={e => setW1(p => ({ ...p, segmento: e.target.value }))}>
                <option value="">Selecione o segmento</option>
                {SEGMENTOS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </FieldGroup>
            <FieldGroup label="Razão Social">
              <input className="form-input" placeholder="Minha Empresa LTDA" value={w1.razaoSocial}
                onChange={e => setW1(p => ({ ...p, razaoSocial: e.target.value }))} />
            </FieldGroup>
            <FieldGroup label="Nome Fantasia (opcional)">
              <input className="form-input" placeholder="Minha Empresa" value={w1.nomeFantasia}
                onChange={e => setW1(p => ({ ...p, nomeFantasia: e.target.value }))} />
            </FieldGroup>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <button className="btn-action" style={{ minWidth: 160 }} onClick={() => setWStep(2)}>
              Continuar <i className="fa-solid fa-arrow-right" style={{ marginLeft: 8 }} />
            </button>
          </div>
          <div style={{ marginTop: 20, padding: '12px 16px', background: 'rgba(45,155,111,.06)', borderRadius: 8, display: 'flex', gap: 10, alignItems: 'center' }}>
            <i className="fa-solid fa-shield-halved" style={{ color: 'var(--green)', fontSize: 16, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: 'var(--gray-500)' }}>Abertura 100% digital e gratuita · Sem mensalidades ou tarifas escondidas</span>
          </div>
        </div>
      )}

      {/* STEP 2 — Dados dos responsáveis */}
      {wStep === 2 && (
        <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 14, padding: '28px 32px' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--navy)', fontFamily: "'Space Grotesk', system-ui, sans-serif", marginBottom: 4 }}>Dados dos responsáveis</div>
          <div style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 24 }}>Informações do sócio ou administrador.</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <FieldGroup label="Nome completo">
                <input className="form-input" placeholder="João da Silva" value={w2.nome}
                  onChange={e => setW2(p => ({ ...p, nome: e.target.value }))} />
              </FieldGroup>
            </div>
            <FieldGroup label="CPF">
              <input className="form-input" placeholder="000.000.000-00" value={w2.cpf}
                onChange={e => setW2(p => ({ ...p, cpf: maskCpfCnpj(e.target.value) }))} />
            </FieldGroup>
            <FieldGroup label="Cargo">
              <select className="form-input" value={w2.cargo} onChange={e => setW2(p => ({ ...p, cargo: e.target.value }))}>
                {CARGOS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </FieldGroup>
            <FieldGroup label="E-mail">
              <input className="form-input" type="email" placeholder="joao@minhaempresa.com" value={w2.email}
                onChange={e => setW2(p => ({ ...p, email: e.target.value }))} />
            </FieldGroup>
            <FieldGroup label="Telefone">
              <input className="form-input" placeholder="(11) 99999-9999" value={w2.telefone}
                onChange={e => setW2(p => ({ ...p, telefone: e.target.value }))} />
            </FieldGroup>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <button className="btn-action btn-ghost" style={{ minWidth: 100 }} onClick={() => setWStep(1)}>Voltar</button>
            <button className="btn-action" style={{ minWidth: 160 }} onClick={() => setWStep(3)}>
              Continuar <i className="fa-solid fa-arrow-right" style={{ marginLeft: 8 }} />
            </button>
          </div>
          <div style={{ marginTop: 20, padding: '12px 16px', background: 'rgba(45,155,111,.06)', borderRadius: 8, display: 'flex', gap: 10, alignItems: 'center' }}>
            <i className="fa-solid fa-shield-halved" style={{ color: 'var(--green)', fontSize: 16, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: 'var(--gray-500)' }}>Precisamos dessas informações para garantir a segurança da sua conta.</span>
          </div>
        </div>
      )}

      {/* STEP 3 — Endereço da empresa */}
      {wStep === 3 && (
        <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 14, padding: '28px 32px' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--navy)', fontFamily: "'Space Grotesk', system-ui, sans-serif", marginBottom: 4 }}>Endereço da empresa</div>
          <div style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 24 }}>Confirme o endereço da sua empresa.</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
            <FieldGroup label="CEP">
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="form-input" placeholder="01234-567" value={w3.cep}
                  onChange={e => setW3(p => ({ ...p, cep: e.target.value }))} style={{ flex: 1 }} />
                <button className="btn-action btn-ghost" style={{ fontSize: 11, padding: '6px 12px', flexShrink: 0 }}
                  onClick={() => void buscarCep(w3.cep)} disabled={cepLoading}>
                  {cepLoading ? '…' : 'Buscar CEP'}
                </button>
              </div>
            </FieldGroup>
            <div />
            <div style={{ gridColumn: '1 / -1' }}>
              <FieldGroup label="Endereço">
                <input className="form-input" placeholder="Rua das Empresas" value={w3.endereco}
                  onChange={e => setW3(p => ({ ...p, endereco: e.target.value }))} />
              </FieldGroup>
            </div>
            <FieldGroup label="Número">
              <input className="form-input" placeholder="123" value={w3.numero}
                onChange={e => setW3(p => ({ ...p, numero: e.target.value }))} />
            </FieldGroup>
            <FieldGroup label="Complemento (opcional)">
              <input className="form-input" placeholder="Sala 45" value={w3.complemento}
                onChange={e => setW3(p => ({ ...p, complemento: e.target.value }))} />
            </FieldGroup>
            <FieldGroup label="Bairro">
              <input className="form-input" placeholder="Centro" value={w3.bairro}
                onChange={e => setW3(p => ({ ...p, bairro: e.target.value }))} />
            </FieldGroup>
            <div />
            <FieldGroup label="Cidade">
              <input className="form-input" placeholder="São Paulo" value={w3.cidade}
                onChange={e => setW3(p => ({ ...p, cidade: e.target.value }))} />
            </FieldGroup>
            <FieldGroup label="Estado">
              <select className="form-input" value={w3.estado} onChange={e => setW3(p => ({ ...p, estado: e.target.value }))}>
                <option value="">UF</option>
                {ESTADOS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
              </select>
            </FieldGroup>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <button className="btn-action btn-ghost" style={{ minWidth: 100 }} onClick={() => setWStep(2)}>Voltar</button>
            <button className="btn-action" style={{ minWidth: 160 }} onClick={() => setWStep(4)}>
              Continuar <i className="fa-solid fa-arrow-right" style={{ marginLeft: 8 }} />
            </button>
          </div>
          <div style={{ marginTop: 20, padding: '12px 16px', background: 'rgba(45,155,111,.06)', borderRadius: 8, display: 'flex', gap: 10, alignItems: 'center' }}>
            <i className="fa-solid fa-shield-halved" style={{ color: 'var(--green)', fontSize: 16, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: 'var(--gray-500)' }}>Endereço utilizado para validação e documentos oficiais.</span>
          </div>
        </div>
      )}

      {/* STEP 4 — Documentos */}
      {wStep === 4 && (
        <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 14, padding: '28px 32px' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--navy)', fontFamily: "'Space Grotesk', system-ui, sans-serif", marginBottom: 4 }}>Documentos</div>
          <div style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 24 }}>Documentos da empresa e dos sócios.</div>
          <FileUploadBox
            label="Contrato Social ou Estatuto"
            accept=".pdf,.png,.jpg,.jpeg"
            value={w4.contrato}
            onChange={name => setW4(p => ({ ...p, contrato: name }))}
          />
          <FileUploadBox
            label="Documento de responsável (RG ou CNH)"
            accept=".pdf,.png,.jpg,.jpeg"
            value={w4.docResp}
            onChange={name => setW4(p => ({ ...p, docResp: name }))}
          />
          <FileUploadBox
            label="Comprovante de endereço"
            accept=".pdf,.png,.jpg,.jpeg"
            value={w4.comprovante}
            onChange={name => setW4(p => ({ ...p, comprovante: name }))}
          />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
            <button className="btn-action btn-ghost" style={{ minWidth: 100 }} onClick={() => setWStep(3)}>Voltar</button>
            <button className="btn-action" style={{ minWidth: 160 }} onClick={() => setWStep(5)}>
              Continuar <i className="fa-solid fa-arrow-right" style={{ marginLeft: 8 }} />
            </button>
          </div>
          <div style={{ marginTop: 20, padding: '12px 16px', background: 'rgba(45,155,111,.06)', borderRadius: 8, display: 'flex', gap: 10, alignItems: 'center' }}>
            <i className="fa-solid fa-lock" style={{ color: 'var(--green)', fontSize: 16, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: 'var(--gray-500)' }}>Documentos protegidos com segurança e criptografia de ponta.</span>
          </div>
        </div>
      )}

      {/* STEP 5 — Confirmação */}
      {wStep === 5 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>
          {/* Left: review */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Dados da empresa */}
            <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 14, padding: '22px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>Dados da empresa</div>
                <button className="btn-action btn-ghost" style={{ fontSize: 11, padding: '4px 12px' }} onClick={() => setWStep(1)}>
                  <i className="fa-solid fa-pen" style={{ marginRight: 5, fontSize: 10 }} />Editar
                </button>
              </div>
              {[
                { label: 'Razão Social', value: w1.razaoSocial },
                { label: 'CNPJ', value: w1.cnpj },
                { label: 'Nome Fantasia', value: w1.nomeFantasia || '—' },
                { label: 'Segmento', value: w1.segmento },
                { label: 'Endereço', value: [w3.endereco, w3.numero, w3.complemento].filter(Boolean).join(', ') || '—' },
                { label: 'Cidade/UF', value: w3.cidade && w3.estado ? `${w3.cidade} - ${w3.estado}` : '—' },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--gray-400)', minWidth: 100 }}>{row.label}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--navy)' }}>{row.value || '—'}</div>
                </div>
              ))}
            </div>
            {/* Responsável */}
            <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 14, padding: '22px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>Responsável</div>
                <button className="btn-action btn-ghost" style={{ fontSize: 11, padding: '4px 12px' }} onClick={() => setWStep(2)}>
                  <i className="fa-solid fa-pen" style={{ marginRight: 5, fontSize: 10 }} />Editar
                </button>
              </div>
              {[
                { label: 'Nome', value: w2.nome },
                { label: 'CPF', value: w2.cpf },
                { label: 'Cargo', value: w2.cargo },
                { label: 'E-mail', value: w2.email },
                { label: 'Telefone', value: w2.telefone },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--gray-400)', minWidth: 100 }}>{row.label}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--navy)' }}>{row.value || '—'}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: finalizar */}
          <div style={{ background: 'var(--navy)', borderRadius: 14, padding: '28px 24px', color: '#fff', position: 'sticky', top: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.5)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 14 }}>Revise seus dados antes de finalizar.</div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{w1.razaoSocial || 'Empresa'}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.6)', marginBottom: 4 }}>{w1.cnpj || '—'}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.6)', marginBottom: 4 }}>{w1.segmento || '—'}</div>
            {w3.cidade && <div style={{ fontSize: 11, color: 'rgba(255,255,255,.6)', marginBottom: 16 }}>{w3.cidade}{w3.estado ? ` - ${w3.estado}` : ''}</div>}
            <div style={{ borderTop: '1px solid rgba(255,255,255,.12)', paddingTop: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', marginBottom: 4 }}>Responsável</div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{w2.nome || '—'}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', marginTop: 2 }}>{w2.cpf || '—'}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', marginTop: 2 }}>{w2.email || '—'}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 18 }}>
              <input
                type="checkbox" id="termos" checked={wTermos} onChange={e => setWTermos(e.target.checked)}
                style={{ marginTop: 2, accentColor: 'var(--teal)', width: 14, height: 14, flexShrink: 0 }}
              />
              <label htmlFor="termos" style={{ fontSize: 11, color: 'rgba(255,255,255,.65)', lineHeight: 1.5, cursor: 'pointer' }}>
                Declaro que li e concordo com os <span style={{ color: 'var(--teal)', textDecoration: 'underline', cursor: 'pointer' }}>Termos de Uso</span> e <span style={{ color: 'var(--teal)', textDecoration: 'underline', cursor: 'pointer' }}>Política de Privacidade</span>.
              </label>
            </div>
            <button
              className="btn-action"
              style={{ width: '100%', background: 'var(--teal)', opacity: wTermos ? 1 : 0.5 }}
              disabled={!wTermos}
              onClick={() => void finalizarWizard()}
            >
              <i className="fa-solid fa-check" style={{ marginRight: 8 }} />Finalizar cadastro
            </button>
            <div style={{ marginTop: 12, fontSize: 10, color: 'rgba(255,255,255,.4)', textAlign: 'center', lineHeight: 1.5 }}>
              As funcionalidades serão analisadas e liberadas em até 24h.
            </div>
            <button className="btn-action btn-ghost" style={{ width: '100%', marginTop: 8, color: 'rgba(255,255,255,.6)', borderColor: 'rgba(255,255,255,.2)', fontSize: 12 }} onClick={() => setWStep(4)}>
              Voltar
            </button>
          </div>
        </div>
      )}
    </div>
  )

  // ─── VISÃO GERAL DASHBOARD ───────────────────────────────────────────────
  const saldo = conta.saldo_disponivel ?? conta.saldo ?? 0
  const txsMes = txs.filter(t => { const m = new Date(); m.setDate(1); return t.data_transacao >= m.toISOString().slice(0, 10) })
  const chartData = buildChartData(txs)
  const txsRecentes = txs.slice(0, 5)
  const extratoFiltered = txs.filter(t =>
    extratoTab === 'todas' ? true : extratoTab === 'entradas' ? t.tipo === 'credito' : t.tipo === 'debito'
  ).slice(0, 6)

  function txIcon(tx: Tx) {
    const d = tx.descricao.toLowerCase()
    if (d.includes('pix')) return 'fa-bolt'
    if (d.includes('transfer')) return 'fa-right-left'
    if (d.includes('pagament')) return 'fa-sack-dollar'
    if (d.includes('cobran')) return 'fa-clipboard-list'
    return tx.tipo === 'credito' ? 'fa-inbox' : 'fa-paper-plane'
  }

  return (
    <>
      {/* HEADER */}
      <div className="page-hdr" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--navy)', fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
            Olá, {empresa.nome || userName}! 
          </div>
          <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 2 }}>
            Bem-vindo à sua conta PJ gratuita
            {conta.agencia && <span style={{ marginLeft: 8, fontFamily: 'monospace', fontSize: 11, color: 'var(--gray-300)' }}>Ag {conta.agencia} · CC {conta.numero_conta}{conta.digito ? `-${conta.digito}` : ''}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn-action btn-ghost" onClick={copiarPix} style={{ fontSize: 12 }}>
            PIX copia e cola
          </button>
          <Link href="/dashboard/conta-pj/transferencias" className="btn-action" style={{ fontSize: 12, textDecoration: 'none' }}>
            ↔️ Nova transferência
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpis" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 20 }}>
        <div className="kpi">
          <div className="kpi-lbl">Saldo disponível</div>
          <div className="kpi-val" style={{ color: 'var(--navy)' }}>
            {hide ? '••••••' : formatBRL(saldo)}
          </div>
          <button onClick={() => setHide(h => !h)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: 'var(--gray-400)', padding: 0 }}>
            <i className={`fa-solid ${hide ? 'fa-eye' : 'fa-eye-slash'}`} style={{ marginRight: 4 }} />{hide ? 'Mostrar' : 'Ocultar'}
          </button>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Entradas do mês</div>
          <div className="kpi-val" style={{ color: 'var(--green)' }}>{formatBRL(entradasMes)}</div>
          <div className="kpi-delta">{txsMes.filter(t => t.tipo === 'credito').length} transações</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Saídas do mês</div>
          <div className="kpi-val" style={{ color: 'var(--red)' }}>{formatBRL(saidasMes)}</div>
          <div className="kpi-delta">{txsMes.filter(t => t.tipo === 'debito').length} transações</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Cartões corporativos</div>
          <div className="kpi-val" style={{ color: 'var(--navy)' }}>{numCartoes}</div>
          <Link href="/dashboard/cartoes" style={{ fontSize: 10, color: 'var(--teal)', textDecoration: 'none' }}>Gerenciar cartões →</Link>
        </div>
      </div>

      {/* AÇÕES RÁPIDAS */}
      <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-400)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '.04em' }}>Ações rápidas</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {ACOES.map(a => (
            <Link key={a.label} href={a.href} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '12px 16px', borderRadius: 10, background: a.bg, border: '1px solid transparent', textDecoration: 'none', minWidth: 72, cursor: 'pointer', transition: 'opacity .15s' }}>
              <span style={{ fontSize: 22 }}><i className={`fa-solid ${a.emoji}`} /></span>
              <span style={{ fontSize: 11, fontWeight: 700, color: a.color }}>{a.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* CONTENT GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16, marginBottom: 20, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>Movimentações recentes</span>
              <Link href="/dashboard/conta-pj/extrato" style={{ fontSize: 11, color: 'var(--teal)', textDecoration: 'none' }}>Ver extrato completo →</Link>
            </div>
            {txsRecentes.length === 0 ? (
              <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--gray-400)', fontSize: 12 }}>Nenhuma movimentação nos últimos 30 dias</div>
            ) : (
              <div>
                {txsRecentes.map(tx => (
                  <div key={tx.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 20px', borderBottom: '1px solid var(--gray-50)' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: tx.tipo === 'credito' ? 'rgba(45,155,111,.1)' : 'rgba(220,53,69,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                      {txIcon(tx)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tx.descricao}</div>
                      <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{tx.contraparte_nome ?? ''} · {new Date(tx.data_transacao + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</div>
                    </div>
                    <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: tx.tipo === 'credito' ? 'var(--green)' : 'var(--red)', flexShrink: 0 }}>
                      {tx.tipo === 'credito' ? '+' : '-'}{formatBRL(Number(tx.valor))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>Análise financeira</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {(['fluxo', 'saldo'] as const).map(t => (
                  <button key={t} onClick={() => setChartTab(t)}
                    style={{ fontSize: 10, fontWeight: chartTab === t ? 700 : 500, padding: '3px 10px', borderRadius: 6, border: `1px solid ${chartTab === t ? 'var(--teal)' : 'var(--gray-200)'}`, background: chartTab === t ? 'var(--teal)' : '#fff', color: chartTab === t ? '#fff' : 'var(--gray-400)', cursor: 'pointer' }}>
                    {t === 'fluxo' ? 'Fluxo 30d' : 'Saldo 30d'}
                  </button>
                ))}
              </div>
            </div>
            {chartTab === 'fluxo' && (
              <>
                <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--gray-500)' }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--green)' }} /> Entradas
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--gray-500)' }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--red)' }} /> Saídas
                  </div>
                </div>
                {chartData.every(d => d.entrada === 0 && d.saida === 0) ? (
                  <div style={{ height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gray-300)', fontSize: 12 }}>Sem dados — importe seu extrato</div>
                ) : (
                  <ResponsiveContainer width="100%" height={130}>
                    <BarChart data={chartData} barGap={1} barCategoryGap="20%">
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--gray-300)' }} axisLine={false} tickLine={false} interval={6} />
                      <YAxis tick={{ fontSize: 9, fill: 'var(--gray-300)' }} axisLine={false} tickLine={false} tickFormatter={v => formatBRL(v).replace('R$ ', '')} width={48} />
                      <Tooltip formatter={(v: number, name: string) => [formatBRL(v), name === 'entrada' ? 'Entrada' : 'Saída']} contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid var(--gray-100)' }} />
                      <Bar dataKey="entrada" fill="var(--green)" radius={[3, 3, 0, 0]} maxBarSize={10} />
                      <Bar dataKey="saida" fill="var(--red)" radius={[3, 3, 0, 0]} maxBarSize={10} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </>
            )}
            {chartTab === 'saldo' && (() => {
              const balanceData = buildBalanceTrend(txs, saldo)
              const hasBal = balanceData.length > 1
              return hasBal ? (
                <>
                  <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--gray-500)' }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--teal)' }} /> Evolução do saldo
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={130}>
                    <AreaChart data={balanceData}>
                      <defs>
                        <linearGradient id="gradSaldo" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--teal)" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="var(--teal)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--gray-300)' }} axisLine={false} tickLine={false} interval={6} />
                      <YAxis tick={{ fontSize: 9, fill: 'var(--gray-300)' }} axisLine={false} tickLine={false} tickFormatter={v => formatBRL(v).replace('R$ ', '')} width={48} />
                      <Tooltip formatter={(v: number) => [formatBRL(v), 'Saldo']} contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid var(--gray-100)' }} />
                      <Area type="monotone" dataKey="saldo" stroke="var(--teal)" strokeWidth={2} fill="url(#gradSaldo)" dot={false} activeDot={{ r: 4 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </>
              ) : (
                <div style={{ height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gray-300)', fontSize: 12 }}>Sem histórico de transações</div>
              )
            })()}
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>Extrato rápido</span>
            <Link href="/dashboard/conta-pj/extrato" style={{ fontSize: 11, color: 'var(--teal)', textDecoration: 'none' }}>Ver extrato →</Link>
          </div>
          <div style={{ display: 'flex', gap: 4, padding: '10px 16px', borderBottom: '1px solid var(--gray-100)' }}>
            {(['todas', 'entradas', 'saidas'] as const).map(tab => (
              <button key={tab} onClick={() => setExtratoTab(tab)}
                className={`btn-action${extratoTab !== tab ? ' btn-ghost' : ''}`}
                style={{ fontSize: 10, padding: '3px 10px', textTransform: 'capitalize' }}>
                {tab === 'todas' ? 'Todas' : tab === 'entradas' ? 'Entradas' : 'Saídas'}
              </button>
            ))}
          </div>
          {extratoFiltered.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--gray-400)', fontSize: 12 }}>Sem movimentações</div>
          ) : (
            <div>
              {extratoFiltered.map(tx => (
                <div key={tx.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', borderBottom: '1px solid var(--gray-50)' }}>
                  <span style={{ fontSize: 14 }}>{txIcon(tx)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--navy)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tx.descricao}</div>
                    <div style={{ fontSize: 10, color: 'var(--gray-400)' }}>{new Date(tx.data_transacao + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</div>
                  </div>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12, color: tx.tipo === 'credito' ? 'var(--green)' : 'var(--red)', flexShrink: 0 }}>
                    {tx.tipo === 'credito' ? '+' : '-'}{formatBRL(Number(tx.valor))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* FUNCIONALIDADES */}
      <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: '16px 20px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)', marginBottom: 16 }}>Funcionalidades disponíveis</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
          {FUNCIONALIDADES.map(f => (
            <Link key={f.label} href={f.href} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--gray-100)', textDecoration: 'none', background: '#fafafa' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--gray-50)')}
              onMouseLeave={e => (e.currentTarget.style.background = '#fafafa')}
            >
              <span style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}><i className={`fa-solid ${f.emoji}`} /></span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', marginBottom: 2 }}>{f.label}</div>
                <div style={{ fontSize: 10, color: 'var(--gray-400)', lineHeight: 1.4 }}>{f.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </>
  )
}
