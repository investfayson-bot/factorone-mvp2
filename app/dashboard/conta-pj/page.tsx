'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'
import { maskCpfCnpj } from '@/lib/masks'
import toast from 'react-hot-toast'

type Empresa = { nome: string; cnpj: string | null; email: string | null; setor: string | null }
type Conta = { id: string; saldo_disponivel: number; saldo: number; agencia: string | null; numero_conta: string | null; digito: string | null; status: string }
type Tx = { id: string; tipo: 'credito' | 'debito'; descricao: string; data_transacao: string; valor: number; contraparte_nome?: string | null }

const ACOES = [
  { label: 'PIX', emoji: '⚡', href: '/dashboard/conta-pj/transferencias', bg: 'rgba(0,168,150,.1)', color: 'var(--teal)' },
  { label: 'Pagar', emoji: '💰', href: '/dashboard/financeiro', bg: 'rgba(26,43,74,.08)', color: 'var(--navy)' },
  { label: 'Cobrar', emoji: '📋', href: '/dashboard/financeiro', bg: 'rgba(184,146,42,.1)', color: 'var(--gold)' },
  { label: 'Transferir', emoji: '↔️', href: '/dashboard/conta-pj/transferencias', bg: 'rgba(124,58,237,.08)', color: '#7C3AED' },
  { label: 'Extrato', emoji: '📊', href: '/dashboard/conta-pj/extrato', bg: 'rgba(45,155,111,.08)', color: 'var(--green)' },
  { label: 'Open Finance', emoji: '🔗', href: '/dashboard/conta-pj/conectar-banco', bg: 'rgba(0,168,150,.08)', color: 'var(--teal)' },
]

const FUNCIONALIDADES = [
  { emoji: '⚡', label: 'PIX', desc: 'Envie e receba 24h por dia', href: '/dashboard/conta-pj/transferencias' },
  { emoji: '💰', label: 'Pagamentos', desc: 'Pague contas, boletos e tributos', href: '/dashboard/financeiro' },
  { emoji: '↔️', label: 'Transferências', desc: 'TED, DOC e transferências internas', href: '/dashboard/conta-pj/transferencias' },
  { emoji: '📄', label: 'Cobranças', desc: 'Emita cobranças e boletos', href: '/dashboard/financeiro' },
  { emoji: '🔗', label: 'Open Finance', desc: 'Conecte contas de outros bancos', href: '/dashboard/conta-pj/conectar-banco' },
  { emoji: '💳', label: 'Cartões', desc: 'Peça cartões para sua empresa', href: '/dashboard/cartoes' },
  { emoji: '📊', label: 'Relatórios', desc: 'Relatórios financeiros completos', href: '/dashboard/relatorios' },
  { emoji: '💸', label: 'Gestão de Caixa', desc: 'Controle seu fluxo de caixa', href: '/dashboard/cashflow' },
  { emoji: '🔌', label: 'Integrações', desc: 'Integre com sistemas e plataformas', href: '/dashboard/integracoes' },
]

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
  return Object.entries(map).map(([date, v]) => ({
    date: date.slice(5),
    entrada: v.entrada,
    saida: v.saida,
  }))
}

export default function ContaPJPage() {
  const [loading, setLoading] = useState(true)
  const [empresaId, setEmpresaId] = useState('')
  const [empresa, setEmpresa] = useState<Empresa>({ nome: '', cnpj: null, email: null, setor: null })
  const [conta, setConta] = useState<Conta | null>(null)
  const [txs, setTxs] = useState<Tx[]>([])
  const [aReceber, setAReceber] = useState(0)
  const [aPagar, setAPagar] = useState(0)
  const [hide, setHide] = useState(false)
  const [extratoTab, setExtratoTab] = useState<'todas' | 'entradas' | 'saidas'>('todas')
  const [userName, setUserName] = useState('')

  // Wizard state (when no account)
  const [wizardStep, setWizardStep] = useState(1)
  const [wizardConexao, setWizardConexao] = useState<'open_finance' | 'extrato' | 'manual' | null>(null)
  const [editEmp, setEditEmp] = useState(false)
  const [empForm, setEmpForm] = useState({ nome: '', cnpj: '', email: '' })
  const [savingEmp, setSavingEmp] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

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
    const [empR, contaR, txR, aReceberR, aPagarR] = await Promise.all([
      supabase.from('empresas').select('nome,cnpj,email,setor').eq('id', eid).maybeSingle(),
      supabase.from('contas_bancarias').select('id,saldo_disponivel,saldo,agencia,numero_conta,digito,status').eq('empresa_id', eid).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('extrato_bancario').select('id,tipo,descricao,valor,data_transacao,contraparte_nome').eq('empresa_id', eid).gte('data_transacao', since30.toISOString().slice(0, 10)).order('data_transacao', { ascending: false }).limit(100),
      supabase.from('contas_receber').select('valor').eq('empresa_id', eid).eq('status', 'pendente'),
      supabase.from('contas_pagar').select('valor').eq('empresa_id', eid).eq('status', 'pendente'),
    ])
    const emp = empR.data as Empresa | null
    setEmpresa({ nome: emp?.nome ?? '', cnpj: emp?.cnpj ?? null, email: emp?.email ?? null, setor: emp?.setor ?? null })
    setEmpForm({ nome: emp?.nome ?? '', cnpj: emp?.cnpj ?? '', email: emp?.email ?? '' })
    setConta((contaR.data as Conta) ?? null)
    setTxs((txR.data ?? []) as Tx[])
    setAReceber((aReceberR.data ?? []).reduce((s, r) => s + Number(r.valor || 0), 0))
    setAPagar((aPagarR.data ?? []).reduce((s, r) => s + Number(r.valor || 0), 0))
    setLoading(false)
  }, [])

  useEffect(() => { void carregar() }, [carregar])

  async function salvarEmpresa() {
    setSavingEmp(true)
    await supabase.from('empresas').update({ nome: empForm.nome, cnpj: empForm.cnpj || null, email: empForm.email || null }).eq('id', empresaId)
    await carregar()
    setEditEmp(false)
    toast.success('Dados atualizados')
    setSavingEmp(false)
  }

  async function criarContaManual() {
    await supabase.from('contas_bancarias').insert({ empresa_id: empresaId, tipo: 'corrente', status: 'ativa', saldo: 0, saldo_disponivel: 0 })
    await carregar()
    toast.success('Conta criada!')
  }

  function copiarPix() {
    const key = empresa.cnpj ?? empresa.email ?? empresaId
    void navigator.clipboard.writeText(key)
    toast.success('Chave PIX copiada!')
  }

  if (loading) return <div style={{ padding: 32, color: 'var(--gray-400)', fontSize: 13 }}>Carregando…</div>

  // ─── WIZARD (no account) ─────────────────────────────────────────────────
  if (!conta) return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '32px 16px' }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 32 }}>
        {[1, 2, 3].map(s => (
          <div key={s} style={{ flex: 1, height: 4, borderRadius: 4, background: s <= wizardStep ? 'var(--teal)' : 'var(--gray-200)', transition: 'background .2s' }} />
        ))}
      </div>

      {wizardStep === 1 && (
        <>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🏦</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--navy)', fontFamily: "'Sora',sans-serif" }}>Abrir Conta PJ</div>
            <div style={{ fontSize: 13, color: 'var(--gray-400)', marginTop: 6 }}>Confirme os dados da sua empresa para continuar</div>
          </div>
          <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 14 }}>Dados da empresa</div>
            {[
              { label: 'Razão Social', value: empresa.nome || '—', icon: '🏢' },
              { label: 'CNPJ', value: empresa.cnpj || 'Não informado', icon: '🪪' },
              { label: 'Setor', value: empresa.setor || 'Não informado', icon: '💼' },
              { label: 'E-mail', value: empresa.email || 'Não informado', icon: '📧' },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', gap: 12, alignItems: 'center', paddingBottom: 12, borderBottom: '1px solid var(--gray-100)', marginBottom: 12 }}>
                <span style={{ fontSize: 18, width: 32, textAlign: 'center' }}>{row.icon}</span>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--gray-400)', fontWeight: 600, marginBottom: 1 }}>{row.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)' }}>{row.value}</div>
                </div>
              </div>
            ))}
            <button className="btn-action btn-ghost" style={{ fontSize: 11, padding: '5px 12px' }} onClick={() => setEditEmp(true)}>
              <i className="fa-solid fa-pen" style={{ marginRight: 5 }} />Editar dados
            </button>
          </div>
          <button className="btn-action" style={{ width: '100%' }} onClick={() => setWizardStep(2)}>
            Confirmar e continuar <i className="fa-solid fa-arrow-right" style={{ marginLeft: 8 }} />
          </button>
        </>
      )}

      {wizardStep === 2 && (
        <>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🔗</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--navy)', fontFamily: "'Sora',sans-serif" }}>Como quer conectar seu banco?</div>
            <div style={{ fontSize: 13, color: 'var(--gray-400)', marginTop: 6 }}>Escolha a forma de integração bancária</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
            {([
              { key: 'open_finance', emoji: '🔗', color: 'var(--teal)', title: 'Open Finance', desc: 'Conexão automática em tempo real via API oficial (Pluggy)' },
              { key: 'extrato', emoji: '📁', color: 'var(--gold)', title: 'Importar Extrato', desc: 'Upload do extrato OFX ou CSV exportado pelo seu banco' },
              { key: 'manual', emoji: '✏️', color: 'var(--navy)', title: 'Cadastro Manual', desc: 'Informe agência e conta sem integração automática' },
            ] as const).map(opt => (
              <button key={opt.key} onClick={() => setWizardConexao(opt.key)}
                style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '14px 16px', borderRadius: 10, border: `2px solid ${wizardConexao === opt.key ? opt.color : 'var(--gray-100)'}`, background: wizardConexao === opt.key ? 'var(--gray-50)' : '#fff', cursor: 'pointer', textAlign: 'left' }}
              >
                <span style={{ fontSize: 24, width: 40, textAlign: 'center' }}>{opt.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)', marginBottom: 2 }}>{opt.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--gray-400)', lineHeight: 1.5 }}>{opt.desc}</div>
                </div>
                {wizardConexao === opt.key && <i className="fa-solid fa-circle-check" style={{ color: opt.color, fontSize: 18 }} />}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-action btn-ghost" style={{ flex: 1 }} onClick={() => setWizardStep(1)}>Voltar</button>
            <button className="btn-action" style={{ flex: 2 }} disabled={!wizardConexao} onClick={() => setWizardStep(3)}>
              Continuar <i className="fa-solid fa-arrow-right" style={{ marginLeft: 8 }} />
            </button>
          </div>
        </>
      )}

      {wizardStep === 3 && (
        <>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--navy)', fontFamily: "'Sora',sans-serif" }}>Quase lá!</div>
            <div style={{ fontSize: 13, color: 'var(--gray-400)', marginTop: 6 }}>Conta PJ para <strong>{empresa.nome}</strong></div>
          </div>
          <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
            {wizardConexao === 'open_finance' && (
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>🔗</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)', marginBottom: 6 }}>Conectar via Open Finance</div>
                <div style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 16 }}>Você será redirecionado para autorizar a conexão com seu banco</div>
                <Link href="/dashboard/conta-pj/conectar-banco" className="btn-action" style={{ display: 'inline-block' }}>
                  <i className="fa-solid fa-link" style={{ marginRight: 8 }} />Conectar banco
                </Link>
              </div>
            )}
            {wizardConexao === 'extrato' && (
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>📁</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)', marginBottom: 6 }}>Importar extrato bancário</div>
                <div style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 16 }}>Exporte o OFX/CSV pelo seu internet banking e importe aqui</div>
                <button className="btn-action" onClick={() => void (async () => { await criarContaManual() })()}>
                  <i className="fa-solid fa-upload" style={{ marginRight: 8 }} />Criar conta e importar
                </button>
              </div>
            )}
            {wizardConexao === 'manual' && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)', marginBottom: 14 }}>✏️ Dados bancários</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  {['Banco', 'Agência', 'Conta', 'Dígito'].map(f => (
                    <div key={f}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-500)', display: 'block', marginBottom: 5 }}>{f}</label>
                      <input className="form-input" placeholder={f} />
                    </div>
                  ))}
                </div>
                <button className="btn-action" style={{ width: '100%' }} onClick={() => void criarContaManual()}>
                  <i className="fa-solid fa-floppy-disk" style={{ marginRight: 8 }} />Salvar e abrir conta
                </button>
              </div>
            )}
          </div>
          {wizardConexao !== 'manual' && (
            <button className="btn-action btn-ghost" style={{ width: '100%' }} onClick={() => setWizardStep(2)}>Voltar</button>
          )}
        </>
      )}

      {editEmp && (
        <div className="modal-bg" onClick={() => setEditEmp(false)}>
          <div className="modal-box" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 className="modal-title">Dados da empresa</h3>
              <button className="modal-close" onClick={() => setEditEmp(false)}><i className="fa-solid fa-xmark" /></button>
            </div>
            {[
              { label: 'Razão Social', key: 'nome', placeholder: 'Nome da empresa' },
              { label: 'CNPJ', key: 'cnpj', placeholder: '00.000.000/0001-00' },
              { label: 'E-mail', key: 'email', placeholder: 'contato@empresa.com' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-500)', display: 'block', marginBottom: 6 }}>{f.label}</label>
                <input className="form-input" placeholder={f.placeholder} value={empForm[f.key as keyof typeof empForm]}
                  onChange={e => { const v = f.key === 'cnpj' ? maskCpfCnpj(e.target.value) : e.target.value; setEmpForm(p => ({ ...p, [f.key]: v })) }} />
              </div>
            ))}
            <div className="modal-actions" style={{ marginTop: 16 }}>
              <button className="btn-action btn-ghost" onClick={() => setEditEmp(false)}>Cancelar</button>
              <button className="btn-action" disabled={savingEmp} onClick={() => void salvarEmpresa()}>{savingEmp ? 'Salvando…' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  // ─── VISÃO GERAL DASHBOARD ───────────────────────────────────────────────
  const saldo = conta.saldo_disponivel ?? conta.saldo ?? 0
  const saldoTotal = saldo + aReceber - aPagar
  const chartData = buildChartData(txs)
  const txsRecentes = txs.slice(0, 5)
  const extratoFiltered = txs.filter(t =>
    extratoTab === 'todas' ? true : extratoTab === 'entradas' ? t.tipo === 'credito' : t.tipo === 'debito'
  ).slice(0, 6)

  const txIcons: Record<string, string> = {
    'pix': '⚡', 'transferencia': '↔️', 'pagamento': '💰', 'cobranca': '📋',
    'credito': '📈', 'debito': '📉',
  }
  function txIcon(tx: Tx) {
    const d = tx.descricao.toLowerCase()
    if (d.includes('pix')) return '⚡'
    if (d.includes('transfer')) return '↔️'
    if (d.includes('pagament')) return '💰'
    if (d.includes('cobran')) return '📋'
    return tx.tipo === 'credito' ? '📥' : '📤'
  }

  return (
    <>
      {/* HEADER */}
      <div className="page-hdr" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--navy)', fontFamily: "'Sora',sans-serif" }}>
            Olá, {empresa.nome || userName}! 👋
          </div>
          <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 2 }}>
            Bem-vindo à sua conta PJ gratuita
            {conta.agencia && <span style={{ marginLeft: 8, fontFamily: 'monospace', fontSize: 11, color: 'var(--gray-300)' }}>Ag {conta.agencia} · CC {conta.numero_conta}{conta.digito ? `-${conta.digito}` : ''}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn-action btn-ghost" onClick={copiarPix} style={{ fontSize: 12 }}>
            ⚡ PIX copia e cola
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
          <div className="kpi-val" style={{ color: 'var(--navy)', fontSize: hide ? 20 : undefined }}>
            {hide ? '••••••' : formatBRL(saldo)}
          </div>
          <div className="kpi-delta" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button onClick={() => setHide(h => !h)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: 'var(--gray-400)', padding: 0 }}>
              <i className={`fa-solid ${hide ? 'fa-eye' : 'fa-eye-slash'}`} style={{ marginRight: 4 }} />{hide ? 'Mostrar' : 'Ocultar'}
            </button>
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">A receber</div>
          <div className="kpi-val" style={{ color: 'var(--green)' }}>{formatBRL(aReceber)}</div>
          <Link href="/dashboard/financeiro" style={{ fontSize: 10, color: 'var(--teal)', textDecoration: 'none' }}>Ver detalhes →</Link>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">A pagar</div>
          <div className="kpi-val" style={{ color: 'var(--red)' }}>{formatBRL(aPagar)}</div>
          <Link href="/dashboard/financeiro" style={{ fontSize: 10, color: 'var(--teal)', textDecoration: 'none' }}>Ver detalhes →</Link>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Saldo total</div>
          <div className="kpi-val" style={{ color: saldoTotal >= 0 ? 'var(--green)' : 'var(--red)' }}>{formatBRL(saldoTotal)}</div>
          <div className="kpi-delta">saldo + a receber − a pagar</div>
        </div>
      </div>

      {/* AÇÕES RÁPIDAS */}
      <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-400)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '.04em' }}>Ações rápidas</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {ACOES.map(a => (
            <Link key={a.label} href={a.href} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '12px 16px', borderRadius: 10, background: a.bg, border: '1px solid transparent', textDecoration: 'none', minWidth: 72, cursor: 'pointer', transition: 'opacity .15s' }}>
              <span style={{ fontSize: 22 }}>{a.emoji}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: a.color }}>{a.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* CONTENT GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16, marginBottom: 20, alignItems: 'start' }}>
        {/* LEFT: movimentações + chart */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Movimentações recentes */}
          <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>Movimentações recentes</span>
              <Link href="/dashboard/conta-pj/extrato" style={{ fontSize: 11, color: 'var(--teal)', textDecoration: 'none' }}>Ver extrato completo →</Link>
            </div>
            {txsRecentes.length === 0 ? (
              <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--gray-400)', fontSize: 12 }}>
                📭 Nenhuma movimentação nos últimos 30 dias
              </div>
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

          {/* Gráfico fluxo de caixa */}
          <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>📊 Gráfico de fluxo de caixa</span>
              <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>Últimos 30 dias</span>
            </div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--gray-500)' }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--green)' }} />
                Entradas
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--gray-500)' }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--red)' }} />
                Saídas
              </div>
            </div>
            {chartData.every(d => d.entrada === 0 && d.saida === 0) ? (
              <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gray-300)', fontSize: 12 }}>
                📭 Sem dados para exibir — importe seu extrato
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={chartData} barGap={1} barCategoryGap="20%">
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--gray-300)' }} axisLine={false} tickLine={false} interval={6} />
                  <Tooltip
                    formatter={(v: number, name: string) => [formatBRL(v), name === 'entrada' ? 'Entrada' : 'Saída']}
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid var(--gray-100)' }}
                  />
                  <Bar dataKey="entrada" fill="var(--green)" radius={[3, 3, 0, 0]} maxBarSize={12} />
                  <Bar dataKey="saida" fill="var(--red)" radius={[3, 3, 0, 0]} maxBarSize={12} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* RIGHT: Extrato rápido */}
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
                {tab === 'todas' ? 'Todas' : tab === 'entradas' ? '📥 Entradas' : '📤 Saídas'}
              </button>
            ))}
          </div>
          {extratoFiltered.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--gray-400)', fontSize: 12 }}>📭 Sem movimentações</div>
          ) : (
            <div>
              {extratoFiltered.map(tx => (
                <div key={tx.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', borderBottom: '1px solid var(--gray-50)' }}>
                  <span style={{ fontSize: 14 }}>{txIcon(tx)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--navy)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tx.descricao}</div>
                    <div style={{ fontSize: 10, color: 'var(--gray-400)' }}>{new Date(tx.data_transacao + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
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
            <Link key={f.label} href={f.href} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--gray-100)', textDecoration: 'none', background: '#fafafa', transition: 'background .15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--gray-50)')}
              onMouseLeave={e => (e.currentTarget.style.background = '#fafafa')}
            >
              <span style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>{f.emoji}</span>
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
