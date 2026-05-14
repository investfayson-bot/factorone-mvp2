'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'
import { maskCpfCnpj } from '@/lib/masks'
import toast from 'react-hot-toast'

type Empresa = { nome: string; cnpj: string | null; email: string | null; setor: string | null }
type Conta = { id: string; saldo_disponivel: number; saldo: number; agencia: string | null; numero_conta: string | null; digito: string | null; status: string }
type ExtratoItem = { id: string; tipo: 'credito' | 'debito'; descricao: string; data_transacao: string; valor: number; categoria: string | null; origem: string | null }

type Tab = 'extrato' | 'operacoes' | 'extrato-upload' | 'conciliacao'

const OPERACOES = [
  { id: 'pix', icon: 'fa-bolt', label: 'PIX', color: 'var(--teal)' },
  { id: 'ted', icon: 'fa-right-left', label: 'TED', color: 'var(--navy)' },
  { id: 'boleto', icon: 'fa-barcode', label: 'Boleto', color: 'var(--gold)' },
  { id: 'extrato', icon: 'fa-list', label: 'Extrato', color: 'var(--green)' },
]

export default function ContaPJPage() {
  const [loading, setLoading] = useState(true)
  const [empresaId, setEmpresaId] = useState('')
  const [empresa, setEmpresa] = useState<Empresa>({ nome: '', cnpj: null, email: null })
  const [conta, setConta] = useState<Conta | null>(null)
  const [extrato, setExtrato] = useState<ExtratoItem[]>([])
  const [tab, setTab] = useState<Tab>('extrato')
  const [hide, setHide] = useState(false)
  const [ofxFile, setOfxFile] = useState<File | null>(null)
  const [importando, setImportando] = useState(false)
  const [importResult, setImportResult] = useState<{ importadas: number; categorizadas: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Company form (for registration)
  const [wizardStep, setWizardStep] = useState(1)
  const [wizardConexao, setWizardConexao] = useState<'open_finance' | 'extrato' | 'manual' | null>(null)
  const [editEmp, setEditEmp] = useState(false)
  const [empForm, setEmpForm] = useState({ nome: '', cnpj: '', email: '' })
  const [savingEmp, setSavingEmp] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const eid = (u?.empresa_id as string) || user.id
    setEmpresaId(eid)
    const [empR, contaR, extratoR] = await Promise.all([
      supabase.from('empresas').select('nome,cnpj,email,setor').eq('id', eid).maybeSingle(),
      supabase.from('contas_bancarias').select('id,saldo_disponivel,saldo,agencia,numero_conta,digito,status').eq('empresa_id', eid).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('extrato_bancario').select('id,tipo,descricao,data_transacao,valor,categoria,origem').eq('empresa_id', eid).order('data_transacao', { ascending: false }).limit(30),
    ])
    const emp = empR.data as Empresa | null
    setEmpresa({ nome: emp?.nome ?? '', cnpj: emp?.cnpj ?? null, email: emp?.email ?? null, setor: emp?.setor ?? null })
    setEmpForm({ nome: emp?.nome ?? '', cnpj: emp?.cnpj ?? '', email: emp?.email ?? '' })
    setConta((contaR.data as Conta) ?? null)
    setExtrato((extratoR.data ?? []) as ExtratoItem[])
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

  async function importarExtrato() {
    if (!ofxFile) return
    setImportando(true)
    setImportResult(null)
    const { data: { session } } = await supabase.auth.getSession()
    const fd = new FormData()
    fd.append('file', ofxFile)
    const res = await fetch('/api/conta-pj/importar-extrato', {
      method: 'POST',
      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      body: fd,
    })
    const json = await res.json() as { importadas?: number; categorizadas?: number; error?: string }
    if (!res.ok) {
      toast.error(json.error ?? 'Erro ao importar')
    } else {
      setImportResult({ importadas: json.importadas ?? 0, categorizadas: json.categorizadas ?? 0 })
      toast.success(`${json.importadas} transações importadas`)
      setOfxFile(null)
      void carregar()
    }
    setImportando(false)
  }

  const saldo = conta?.saldo_disponivel ?? conta?.saldo ?? 0
  const creditos = extrato.filter(e => e.tipo === 'credito').reduce((s, e) => s + Number(e.valor), 0)
  const debitos = extrato.filter(e => e.tipo === 'debito').reduce((s, e) => s + Number(e.valor), 0)

  if (loading) return <div style={{ padding: 32, color: 'var(--gray-400)', fontSize: 13 }}>Carregando…</div>

  // Wizard shown when no bank account exists yet
  if (!conta) return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '32px 16px' }}>
      {/* Progress bar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 32 }}>
        {[1, 2, 3].map(s => (
          <div key={s} style={{ flex: 1, height: 4, borderRadius: 4, background: s <= wizardStep ? 'var(--teal)' : 'var(--gray-200)', transition: 'background .2s' }} />
        ))}
      </div>

      {wizardStep === 1 && (
        <>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <i className="fa-solid fa-building-columns" style={{ fontSize: 24, color: '#fff' }} />
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--navy)' }}>Abrir Conta PJ</div>
            <div style={{ fontSize: 13, color: 'var(--gray-400)', marginTop: 6 }}>Confirme os dados da sua empresa para continuar</div>
          </div>

          <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: '20px 20px', marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 14 }}>Dados da empresa</div>
            {[
              { label: 'Razão Social', value: empresa.nome || '—', icon: 'fa-building' },
              { label: 'CNPJ', value: empresa.cnpj || 'Não informado', icon: 'fa-id-card' },
              { label: 'Setor', value: empresa.setor || 'Não informado', icon: 'fa-briefcase' },
              { label: 'E-mail', value: empresa.email || 'Não informado', icon: 'fa-envelope' },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', paddingBottom: 12, borderBottom: '1px solid var(--gray-100)', marginBottom: 12 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--gray-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <i className={`fa-solid ${row.icon}`} style={{ fontSize: 12, color: 'var(--navy)' }} />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--gray-400)', fontWeight: 600, marginBottom: 1 }}>{row.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)' }}>{row.value}</div>
                </div>
              </div>
            ))}
            <button className="btn-action btn-ghost" style={{ fontSize: 11, padding: '5px 12px', marginTop: 4 }} onClick={() => setEditEmp(true)}>
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
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--navy)' }}>Como deseja conectar seu banco?</div>
            <div style={{ fontSize: 13, color: 'var(--gray-400)', marginTop: 6 }}>Escolha a forma de integração bancária</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
            {([
              { key: 'open_finance', icon: 'fa-plug', color: 'var(--teal)', title: 'Open Finance', desc: 'Conexão automática em tempo real com seu banco via API oficial (Pluggy)' },
              { key: 'extrato', icon: 'fa-file-arrow-up', color: 'var(--gold)', title: 'Importar Extrato', desc: 'Faça upload do extrato OFX ou CSV exportado pelo seu banco' },
              { key: 'manual', icon: 'fa-keyboard', color: 'var(--navy)', title: 'Cadastro Manual', desc: 'Informe agência e conta para registrar sem integração automática' },
            ] as const).map(opt => (
              <button
                key={opt.key}
                onClick={() => setWizardConexao(opt.key)}
                style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '14px 16px', borderRadius: 10, border: `2px solid ${wizardConexao === opt.key ? opt.color : 'var(--gray-100)'}`, background: wizardConexao === opt.key ? 'var(--gray-50)' : '#fff', cursor: 'pointer', textAlign: 'left', transition: 'all .15s' }}
              >
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <i className={`fa-solid ${opt.icon}`} style={{ fontSize: 16, color: opt.color }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)', marginBottom: 2 }}>{opt.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--gray-400)', lineHeight: 1.5 }}>{opt.desc}</div>
                </div>
                {wizardConexao === opt.key && <i className="fa-solid fa-circle-check" style={{ color: opt.color, fontSize: 16 }} />}
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
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(0,168,150,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <i className="fa-solid fa-circle-check" style={{ fontSize: 24, color: 'var(--teal)' }} />
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--navy)' }}>Tudo pronto!</div>
            <div style={{ fontSize: 13, color: 'var(--gray-400)', marginTop: 6 }}>Sua conta PJ para <strong>{empresa.nome}</strong> está configurada</div>
          </div>

          <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: '20px', marginBottom: 24 }}>
            {wizardConexao === 'open_finance' && (
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <i className="fa-solid fa-plug" style={{ fontSize: 28, color: 'var(--teal)', marginBottom: 10, display: 'block' }} />
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)', marginBottom: 6 }}>Conectar via Open Finance</div>
                <div style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 16 }}>Você será redirecionado para autorizar a conexão com seu banco</div>
                <button className="btn-action" onClick={() => { void (async () => { const res = await fetch('/api/pluggy/connect-token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ empresaId }) }); const json = await res.json() as { connectToken?: string }; if (json.connectToken) window.open(`https://connect.pluggy.ai?connectToken=${json.connectToken}`, '_blank') })() }}>
                  <i className="fa-solid fa-link" style={{ marginRight: 8 }} />Conectar banco
                </button>
              </div>
            )}
            {wizardConexao === 'extrato' && (
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <i className="fa-solid fa-file-arrow-up" style={{ fontSize: 28, color: 'var(--gold)', marginBottom: 10, display: 'block' }} />
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)', marginBottom: 6 }}>Importe seu extrato</div>
                <div style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 16 }}>Exporte o extrato OFX/CSV pelo seu internet banking e importe aqui</div>
                <button className="btn-action" onClick={() => { void carregar() }}>
                  <i className="fa-solid fa-upload" style={{ marginRight: 8 }} />Ir para importação
                </button>
              </div>
            )}
            {wizardConexao === 'manual' && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 14 }}>Dados bancários</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {['Banco', 'Agência', 'Conta', 'Dígito'].map(f => (
                    <div key={f}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-500)', display: 'block', marginBottom: 5 }}>{f}</label>
                      <input className="form-input" placeholder={f} />
                    </div>
                  ))}
                </div>
                <button className="btn-action" style={{ width: '100%', marginTop: 16 }} onClick={async () => {
                  await supabase.from('contas_bancarias').insert({ empresa_id: empresaId, tipo: 'corrente', status: 'ativa', saldo: 0, saldo_disponivel: 0 })
                  await carregar()
                }}>
                  <i className="fa-solid fa-floppy-disk" style={{ marginRight: 8 }} />Salvar conta bancária
                </button>
              </div>
            )}
          </div>

          {wizardConexao !== 'manual' && (
            <button className="btn-action btn-ghost" style={{ width: '100%' }} onClick={() => setWizardStep(2)}>Voltar</button>
          )}
        </>
      )}

      {/* Modal dados da empresa (reutilizado no wizard) */}
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
                <input
                  className="form-input"
                  placeholder={f.placeholder}
                  value={empForm[f.key as keyof typeof empForm]}
                  onChange={e => {
                    const v = f.key === 'cnpj' ? maskCpfCnpj(e.target.value) : e.target.value
                    setEmpForm(prev => ({ ...prev, [f.key]: v }))
                  }}
                />
              </div>
            ))}
            <div className="modal-actions" style={{ marginTop: 16 }}>
              <button className="btn-ghost" onClick={() => setEditEmp(false)}>Cancelar</button>
              <button className="btn-action" disabled={savingEmp} onClick={() => void salvarEmpresa()}>{savingEmp ? 'Salvando…' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  return (
    <>
      <div className="page-hdr">
        <div>
          <div className="page-title">Conta PJ</div>
          <div className="page-sub">{empresa.nome || 'Empresa'}{empresa.cnpj ? ` · ${empresa.cnpj}` : ''}</div>
        </div>
        <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setEditEmp(true)}>
          <i className="fa-solid fa-pen" style={{ marginRight: 5 }} />Dados da empresa
        </button>
      </div>

      {/* Saldo card */}
      <div style={{ background: 'var(--navy)', borderRadius: 14, padding: '24px 28px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.45)', marginBottom: 8 }}>Saldo disponível</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
            {hide ? '••••••' : formatBRL(saldo)}
          </div>
          {conta?.agencia && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', marginTop: 8, fontFamily: 'monospace' }}>
              Ag {conta.agencia} · CC {conta.numero_conta}{conta.digito ? `-${conta.digito}` : ''}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={() => setHide(h => !h)} style={{ background: 'rgba(255,255,255,.08)', border: 'none', color: 'rgba(255,255,255,.6)', borderRadius: 8, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>
            <i className={`fa-solid ${hide ? 'fa-eye' : 'fa-eye-slash'}`} style={{ marginRight: 5 }} />{hide ? 'Mostrar' : 'Ocultar'}
          </button>
          {OPERACOES.slice(0, 3).map(op => (
            <button key={op.id} onClick={() => toast('Disponível com Open Finance ativo')} style={{ background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.12)', color: '#fff', borderRadius: 8, padding: '6px 16px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
              <i className={`fa-solid ${op.icon}`} style={{ marginRight: 6, color: op.color, opacity: .9 }} />{op.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs rápidos */}
      <div className="kpis" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 16 }}>
        <div className="kpi">
          <div className="kpi-lbl">Entradas (extrato)</div>
          <div className="kpi-val" style={{ color: 'var(--green)' }}>{formatBRL(creditos)}</div>
          <div className="kpi-delta">{extrato.filter(e => e.tipo === 'credito').length} lançamentos</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Saídas (extrato)</div>
          <div className="kpi-val" style={{ color: 'var(--red)' }}>{formatBRL(debitos)}</div>
          <div className="kpi-delta">{extrato.filter(e => e.tipo === 'debito').length} lançamentos</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Resultado</div>
          <div className="kpi-val" style={{ color: creditos - debitos >= 0 ? 'var(--green)' : 'var(--red)' }}>{formatBRL(creditos - debitos)}</div>
          <div className="kpi-delta">{extrato.length} transações carregadas</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {([['extrato', 'Extrato'], ['extrato-upload', 'Importar OFX/CSV'], ['conciliacao', 'Conciliação']] as [Tab, string][]).map(([k, l]) => (
          <button key={k} className={`btn-action${tab !== k ? ' btn-ghost' : ''}`} style={{ fontSize: 11, padding: '5px 12px' }} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {/* Extrato */}
      {tab === 'extrato' && (
        <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, overflow: 'hidden' }}>
          {extrato.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--gray-400)', fontSize: 13 }}>
              <i className="fa-solid fa-inbox" style={{ fontSize: 28, marginBottom: 10, display: 'block' }} />
              Nenhum lançamento. Importe um extrato OFX ou ative o Open Finance.
            </div>
          ) : (
            <div className="expenses-table">
              <table>
                <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th style={{ textAlign: 'right' }}>Valor</th></tr></thead>
                <tbody>
                  {extrato.map(e => (
                    <tr key={e.id}>
                      <td style={{ fontSize: 12, color: 'var(--gray-400)', whiteSpace: 'nowrap' }}>{new Date(e.data_transacao + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                      <td>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{e.descricao}</div>
                        {e.origem === 'importacao_ofx' && <div style={{ fontSize: 10, color: 'var(--gray-400)' }}>OFX</div>}
                      </td>
                      <td><span className="tag gray" style={{ fontSize: 10 }}>{e.categoria ?? 'Outros'}</span></td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: e.tipo === 'credito' ? 'var(--green)' : 'var(--red)', fontSize: 13 }}>
                        {e.tipo === 'credito' ? '+' : '-'}{formatBRL(Number(e.valor))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Upload OFX/CSV */}
      {tab === 'extrato-upload' && (
        <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: '28px 24px', maxWidth: 560 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy)', marginBottom: 6 }}>Importar extrato bancário</div>
          <div style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 20, lineHeight: 1.7 }}>
            Formatos aceitos: <strong>OFX</strong> (Itaú, Bradesco, BB, Caixa, Santander) e <strong>CSV</strong> com colunas <code>data;descrição;valor</code>.<br />
            As transações serão categorizadas automaticamente por IA (Claude Haiku) em até 10 segundos.
          </div>

          {/* Drop zone */}
          <div
            onClick={() => fileRef.current?.click()}
            style={{ border: `2px dashed ${ofxFile ? 'var(--teal)' : 'var(--gray-200)'}`, borderRadius: 10, padding: '32px 24px', textAlign: 'center', cursor: 'pointer', background: ofxFile ? 'rgba(0,168,150,.03)' : '#fafafa', transition: 'all .15s', marginBottom: 20 }}
          >
            <i className={`fa-solid ${ofxFile ? 'fa-file-check' : 'fa-file-arrow-up'}`} style={{ fontSize: 28, color: ofxFile ? 'var(--teal)' : 'var(--gray-400)', marginBottom: 10, display: 'block' }} />
            {ofxFile ? (
              <div>
                <div style={{ fontWeight: 600, color: 'var(--navy)', fontSize: 13 }}>{ofxFile.name}</div>
                <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 4 }}>{(ofxFile.size / 1024).toFixed(0)} KB · clique para trocar</div>
              </div>
            ) : (
              <div>
                <div style={{ fontWeight: 600, color: 'var(--navy)', fontSize: 13 }}>Arraste ou clique para selecionar</div>
                <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 4 }}>OFX, OFC ou CSV · máx. 4 MB</div>
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept=".ofx,.ofc,.csv" style={{ display: 'none' }} onChange={e => { setOfxFile(e.target.files?.[0] ?? null); setImportResult(null) }} />

          {importResult && (
            <div style={{ background: 'rgba(45,155,111,.06)', border: '1px solid rgba(45,155,111,.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: 'var(--green)' }}>
              <i className="fa-solid fa-circle-check" style={{ marginRight: 6 }} />
              <strong>{importResult.importadas}</strong> transações importadas · <strong>{importResult.categorizadas}</strong> categorizadas por IA
            </div>
          )}

          <button className="btn-action" disabled={!ofxFile || importando} onClick={() => void importarExtrato()} style={{ width: '100%', opacity: importando ? 0.7 : 1 }}>
            {importando ? <><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 8 }} />Processando com IA…</> : <><i className="fa-solid fa-wand-magic-sparkles" style={{ marginRight: 8 }} />Importar e categorizar</>}
          </button>
        </div>
      )}

      {/* Conciliação */}
      {tab === 'conciliacao' && (
        <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: '24px' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy)', marginBottom: 6 }}>Conciliação Bancária</div>
          <div style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 20, lineHeight: 1.7 }}>
            Compare o extrato importado (OFX/Open Finance) com as contas a pagar e receber do sistema. Importe o extrato primeiro na aba ao lado.
          </div>
          {extrato.length === 0 ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--gray-400)', fontSize: 13 }}>
              <i className="fa-solid fa-code-branch" style={{ fontSize: 24, marginBottom: 10, display: 'block' }} />
              Importe um extrato para iniciar a conciliação
            </div>
          ) : (
            <div className="expenses-table">
              <table>
                <thead>
                  <tr>
                    <th>Data</th><th>Descrição</th><th>Categoria</th>
                    <th style={{ textAlign: 'right' }}>Valor</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {extrato.map(e => (
                    <tr key={e.id}>
                      <td style={{ fontSize: 12, color: 'var(--gray-400)', whiteSpace: 'nowrap' }}>{new Date(e.data_transacao + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                      <td style={{ fontSize: 13 }}>{e.descricao}</td>
                      <td><span className="tag gray" style={{ fontSize: 10 }}>{e.categoria ?? 'Outros'}</span></td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: e.tipo === 'credito' ? 'var(--green)' : 'var(--red)', fontSize: 13 }}>
                        {e.tipo === 'credito' ? '+' : '-'}{formatBRL(Number(e.valor))}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'rgba(184,146,42,.1)', color: 'var(--gold)', fontWeight: 600 }}>Pendente</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal dados da empresa */}
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
                <input
                  className="form-input"
                  placeholder={f.placeholder}
                  value={empForm[f.key as keyof typeof empForm]}
                  onChange={e => {
                    const v = f.key === 'cnpj' ? maskCpfCnpj(e.target.value) : e.target.value
                    setEmpForm(prev => ({ ...prev, [f.key]: v }))
                  }}
                />
              </div>
            ))}
            <div className="modal-actions" style={{ marginTop: 16 }}>
              <button className="btn-ghost" onClick={() => setEditEmp(false)}>Cancelar</button>
              <button className="btn-action" disabled={savingEmp} onClick={() => void salvarEmpresa()}>{savingEmp ? 'Salvando…' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
