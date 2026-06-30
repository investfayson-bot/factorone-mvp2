'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { maskCpfCnpj } from '@/lib/masks'

const PLANOS = [
  {
    id: 'FactorOne Bank',
    nome: 'Essencial',
    preco: 'Gratuito',
    cor: 'var(--teal)',
    features: ['Conta corrente PJ', 'PIX ilimitado', 'TED (5/mês)', '1 cartão virtual', 'AI CFO básico'],
  },
  {
    id: 'FactorOne Premium',
    nome: 'Profissional',
    preco: 'R$ 49/mês',
    cor: 'var(--navy)',
    destaque: true,
    features: ['Tudo do Essencial', 'TEDs ilimitados', 'Boletos ilimitados', '5 cartões virtuais', 'AI CFO completo', 'Score financeiro'],
  },
  {
    id: 'FactorOne Cash+',
    nome: 'Enterprise',
    preco: 'R$ 149/mês',
    cor: '#7C3AED',
    features: ['Tudo do Profissional', 'Cartões ilimitados', 'Multiusuários', 'Conciliação automática', 'Open Finance', 'Gerente dedicado'],
  },
]

const DOCS = [
  { id: 'contrato_social', label: 'Contrato Social / Requerimento de Empresário', icon: 'fa-file-contract' },
  { id: 'rg_cnh', label: 'RG ou CNH dos sócios', icon: 'fa-id-card' },
  { id: 'comprovante_endereco', label: 'Comprovante de endereço', icon: 'fa-map-marker-alt' },
  { id: 'alvara', label: 'Alvará de funcionamento (se aplicável)', icon: 'fa-store' },
]

const FEATURES_SIDEBAR = [
  { icon: 'fa-bolt', label: 'Conta aberta em minutos' },
  { icon: 'fa-infinity', label: 'PIX ilimitado sem custo' },
  { icon: 'fa-credit-card', label: 'Cartões virtuais por setor' },
  { icon: 'fa-robot', label: 'AI CFO integrado' },
  { icon: 'fa-chart-line', label: 'Rentabilidade 100% CDI' },
  { icon: 'fa-shield-halved', label: 'Dados criptografados e seguros' },
]

export default function AberturaContaWizard() {
  const [etapa, setEtapa] = useState(1)
  const [empresaId, setEmpresaId] = useState('')
  const [empresa, setEmpresa] = useState({ cnpj: '', razao_social: '', cnae: '', data_abertura: '' })
  const [socios, setSocios] = useState([{ nome: '', cpf: '', participacao: 0 }])
  const [documentos, setDocumentos] = useState<Record<string, string>>({})
  const [plano, setPlano] = useState('FactorOne Premium')
  const [aceite, setAceite] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [enviado, setEnviado] = useState(false)
  const progresso = useMemo(() => (etapa / 4) * 100, [etapa])

  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const u = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
      const id = (u.data?.empresa_id as string) || user.id
      setEmpresaId(id)
      const e = await supabase.from('empresas').select('cnpj,nome').eq('id', id).maybeSingle()
      setEmpresa(prev => ({ ...prev, cnpj: e.data?.cnpj || prev.cnpj, razao_social: e.data?.nome || prev.razao_social }))
    })()
  }, [])

  async function salvarProgresso() {
    setSaving(true); setMsg('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !empresaId) { setSaving(false); return }
    const { error } = await supabase.from('abertura_conta_pj').upsert({
      empresa_id: empresaId, cnpj: empresa.cnpj, razao_social: empresa.razao_social,
      cnae: empresa.cnae, data_abertura: empresa.data_abertura, socios, documentos,
      banco_escolhido: plano, etapa_atual: etapa, updated_at: new Date().toISOString(),
    })
    setSaving(false)
    setMsg(error ? error.message : 'Progresso salvo.')
  }

  async function concluirSolicitacao() {
    if (!aceite) { setMsg('Confirme os termos para continuar.'); return }
    setSaving(true)
    const { error } = await supabase.from('contas_bancarias').insert({
      empresa_id: empresaId, tipo: 'conta_pj_factorone', banco_nome: plano,
      banco_codigo: '399', is_principal: true, status: 'pendente',
      saldo: 0, saldo_disponivel: 0, saldo_bloqueado: 0,
    })
    setSaving(false)
    if (error) setMsg(error.message)
    else setEnviado(true)
  }

  const inp: React.CSSProperties = {
    width: '100%', border: '1px solid var(--gray-100)', borderRadius: 8,
    padding: '10px 14px', fontSize: 13, color: 'var(--navy)',
    background: '#fff', boxSizing: 'border-box', outline: 'none',
  }
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 4, display: 'block' }

  if (enviado) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 64, textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(94,140,135,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <i className="fa-solid fa-circle-check" style={{ fontSize: 36, color: 'var(--teal)' }} />
        </div>
        <h2 style={{ fontFamily: "'Space Grotesk', 'Sora', sans-serif", fontSize: 22, fontWeight: 700, color: 'var(--navy)', marginBottom: 10 }}>Solicitação enviada!</h2>
        <p style={{ fontSize: 14, color: 'var(--gray-500)', maxWidth: 380, lineHeight: 1.6 }}>
          Sua conta PJ está em análise. Em até 1 dia útil você receberá a confirmação por e-mail e poderá acessar o dashboard bancário completo.
        </p>
        <p style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 8 }}>Plano selecionado: <strong>{PLANOS.find(p => p.id === plano)?.nome}</strong></p>
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 0, minHeight: 580, borderRadius: 16, overflow: 'hidden', border: '1px solid var(--gray-100)', boxShadow: '0 4px 24px rgba(0,0,0,.06)' }}>
      {/* Left panel */}
      <div style={{ background: 'var(--navy)', padding: '36px 28px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontFamily: "'Space Grotesk', 'Sora', sans-serif", fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
            Factor<span style={{ color: 'var(--teal)' }}>One</span> Bank
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>Conta PJ para PMEs e Startups</div>
        </div>

        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 16 }}>Por que FactorOne</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {FEATURES_SIDEBAR.map(f => (
              <div key={f.icon} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <i className={`fa-solid ${f.icon}`} style={{ fontSize: 13, color: 'var(--teal)' }} />
                </div>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', lineHeight: 1.4 }}>{f.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 32, padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>Progresso</p>
          <div style={{ height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 4 }}>
            <div style={{ height: 4, borderRadius: 4, background: 'var(--teal)', width: `${progresso}%`, transition: 'width .3s' }} />
          </div>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 6 }}>Etapa {etapa} de 4</p>
        </div>
      </div>

      {/* Right panel */}
      <div style={{ background: '#fff', padding: '36px 32px', display: 'flex', flexDirection: 'column' }}>
        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 32 }}>
          {[
            { n: 1, label: 'Empresa' },
            { n: 2, label: 'Sócios' },
            { n: 3, label: 'Documentos' },
            { n: 4, label: 'Plano' },
          ].map((s, idx) => (
            <div key={s.n} style={{ display: 'flex', alignItems: 'center', flex: idx < 3 ? 1 : 'none' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700,
                  background: etapa > s.n ? 'var(--green)' : etapa === s.n ? 'var(--teal)' : 'var(--gray-100)',
                  color: etapa >= s.n ? '#fff' : 'var(--gray-400)',
                }}>
                  {etapa > s.n ? <i className="fa-solid fa-check" style={{ fontSize: 11 }} /> : s.n}
                </div>
                <span style={{ fontSize: 10, fontWeight: 600, color: etapa >= s.n ? 'var(--navy)' : 'var(--gray-400)', whiteSpace: 'nowrap' }}>{s.label}</span>
              </div>
              {idx < 3 && <div style={{ flex: 1, height: 1, background: etapa > s.n ? 'var(--teal)' : 'var(--gray-100)', margin: '0 6px', marginBottom: 14 }} />}
            </div>
          ))}
        </div>

        {/* Step 1: Empresa */}
        {etapa === 1 && (
          <div style={{ flex: 1 }}>
            <h3 style={{ fontFamily: "'Space Grotesk', 'Sora', sans-serif", fontSize: 18, fontWeight: 700, color: 'var(--navy)', marginBottom: 6 }}>Dados da empresa</h3>
            <p style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 24 }}>Usados para abrir sua conta e emitir documentos.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={lbl}>Razão Social *</label>
                <input style={inp} placeholder="Nome completo da empresa" value={empresa.razao_social} onChange={e => setEmpresa({ ...empresa, razao_social: e.target.value })} />
              </div>
              <div>
                <label style={lbl}>CNPJ *</label>
                <input style={inp} placeholder="00.000.000/0001-00" value={empresa.cnpj} onChange={e => setEmpresa({ ...empresa, cnpj: maskCpfCnpj(e.target.value) })} />
              </div>
              <div>
                <label style={lbl}>CNAE principal</label>
                <input style={inp} placeholder="Ex.: 6201-5/00" value={empresa.cnae} onChange={e => setEmpresa({ ...empresa, cnae: e.target.value })} />
              </div>
              <div>
                <label style={lbl}>Data de abertura</label>
                <input style={inp} type="date" value={empresa.data_abertura} onChange={e => setEmpresa({ ...empresa, data_abertura: e.target.value })} />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Sócios */}
        {etapa === 2 && (
          <div style={{ flex: 1 }}>
            <h3 style={{ fontFamily: "'Space Grotesk', 'Sora', sans-serif", fontSize: 18, fontWeight: 700, color: 'var(--navy)', marginBottom: 6 }}>Quadro societário</h3>
            <p style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 24 }}>Informe todos os sócios com participação ≥ 25% (PEPs e compliance).</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {socios.map((s, i) => (
                <div key={i} style={{ padding: '14px 16px', border: '1px solid var(--gray-100)', borderRadius: 10, background: '#fafafa' }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', marginBottom: 10 }}>Sócio {i + 1}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 100px', gap: 10 }}>
                    <div>
                      <label style={lbl}>Nome completo</label>
                      <input style={inp} placeholder="Nome" value={s.nome} onChange={e => { const c = [...socios]; c[i].nome = e.target.value; setSocios(c) }} />
                    </div>
                    <div>
                      <label style={lbl}>CPF</label>
                      <input style={inp} placeholder="000.000.000-00" value={s.cpf} onChange={e => { const c = [...socios]; c[i].cpf = maskCpfCnpj(e.target.value); setSocios(c) }} />
                    </div>
                    <div>
                      <label style={lbl}>% participação</label>
                      <input style={inp} type="number" min={0} max={100} placeholder="0" value={s.participacao || ''} onChange={e => { const c = [...socios]; c[i].participacao = Number(e.target.value || 0); setSocios(c) }} />
                    </div>
                  </div>
                </div>
              ))}
              <button type="button" onClick={() => setSocios([...socios, { nome: '', cpf: '', participacao: 0 }])}
                style={{ alignSelf: 'flex-start', padding: '6px 14px', borderRadius: 8, border: '1px dashed var(--teal)', background: 'rgba(94,140,135,0.04)', color: 'var(--teal)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                <i className="fa-solid fa-plus" style={{ marginRight: 5, fontSize: 10 }} />Adicionar sócio
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Documentos */}
        {etapa === 3 && (
          <div style={{ flex: 1 }}>
            <h3 style={{ fontFamily: "'Space Grotesk', 'Sora', sans-serif", fontSize: 18, fontWeight: 700, color: 'var(--navy)', marginBottom: 6 }}>Documentos</h3>
            <p style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 24 }}>Faça upload dos documentos para análise KYB.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {DOCS.map(doc => (
                <label key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', border: documentos[doc.id] ? '1px solid var(--teal)' : '1px solid var(--gray-100)', borderRadius: 10, background: documentos[doc.id] ? 'rgba(94,140,135,0.04)' : '#fafafa', cursor: 'pointer' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: documentos[doc.id] ? 'rgba(94,140,135,0.1)' : 'var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <i className={`fa-solid ${documentos[doc.id] ? 'fa-circle-check' : doc.icon}`} style={{ fontSize: 14, color: documentos[doc.id] ? 'var(--teal)' : 'var(--gray-400)' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--navy)', margin: 0 }}>{doc.label}</p>
                    <p style={{ fontSize: 11, color: 'var(--gray-400)', margin: '2px 0 0' }}>{documentos[doc.id] || 'Clique para selecionar'}</p>
                  </div>
                  <input type="file" style={{ display: 'none' }} onChange={e => setDocumentos({ ...documentos, [doc.id]: e.target.files?.[0]?.name || '' })} />
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Step 4: Plano */}
        {etapa === 4 && (
          <div style={{ flex: 1 }}>
            <h3 style={{ fontFamily: "'Space Grotesk', 'Sora', sans-serif", fontSize: 18, fontWeight: 700, color: 'var(--navy)', marginBottom: 6 }}>Escolha seu plano</h3>
            <p style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 20 }}>Você pode mudar de plano a qualquer momento.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
              {PLANOS.map(p => (
                <button key={p.id} type="button" onClick={() => setPlano(p.id)} style={{
                  borderRadius: 12, border: plano === p.id ? `2px solid ${p.cor}` : '1px solid var(--gray-100)',
                  background: plano === p.id ? (p.cor === 'var(--navy)' ? 'rgba(10,25,47,0.04)' : `rgba(94,140,135,0.04)`) : '#fff',
                  padding: 14, textAlign: 'left', cursor: 'pointer', position: 'relative',
                }}>
                  {p.destaque && (
                    <div style={{ position: 'absolute', top: -8, right: 10, background: 'var(--teal)', color: '#fff', fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 20, textTransform: 'uppercase' }}>Recomendado</div>
                  )}
                  <p style={{ fontSize: 13, fontWeight: 700, color: p.cor === 'var(--teal)' ? 'var(--teal)' : p.cor === '#7C3AED' ? '#7C3AED' : 'var(--navy)', margin: '0 0 2px' }}>{p.nome}</p>
                  <p style={{ fontSize: 11, color: 'var(--gray-500)', margin: '0 0 10px', fontWeight: 600 }}>{p.preco}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {p.features.map(f => (
                      <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--gray-500)' }}>
                        <i className="fa-solid fa-check" style={{ color: 'var(--teal)', fontSize: 9 }} />
                        {f}
                      </div>
                    ))}
                  </div>
                </button>
              ))}
            </div>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', border: '1px solid var(--gray-100)', borderRadius: 10, cursor: 'pointer', fontSize: 12, color: 'var(--gray-500)', lineHeight: 1.5 }}>
              <input type="checkbox" checked={aceite} onChange={e => setAceite(e.target.checked)} style={{ marginTop: 2, flexShrink: 0 }} />
              Declaro que os dados informados são verdadeiros e aceito os <a href="#" style={{ color: 'var(--teal)' }}>termos de abertura de conta PJ</a>.
            </label>
          </div>
        )}

        {/* Footer nav */}
        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button type="button" onClick={() => setEtapa(Math.max(1, etapa - 1))} disabled={etapa === 1}
            style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid var(--gray-100)', background: '#fff', color: 'var(--gray-500)', fontSize: 12, fontWeight: 600, cursor: etapa === 1 ? 'not-allowed' : 'pointer', opacity: etapa === 1 ? 0.4 : 1 }}>
            <i className="fa-solid fa-arrow-left" style={{ marginRight: 6, fontSize: 11 }} />Anterior
          </button>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {msg && <span style={{ fontSize: 11, color: msg.includes('salvo') ? 'var(--teal)' : 'var(--red)' }}>{msg}</span>}
            <button type="button" disabled={saving} onClick={() => void salvarProgresso()}
              style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid var(--gray-100)', background: '#fff', color: 'var(--navy)', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
              Salvar
            </button>
            {etapa < 4 ? (
              <button type="button" onClick={() => setEtapa(etapa + 1)}
                style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: 'var(--navy)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                Continuar<i className="fa-solid fa-arrow-right" style={{ marginLeft: 6, fontSize: 11 }} />
              </button>
            ) : (
              <button type="button" disabled={saving || !aceite} onClick={() => void concluirSolicitacao()}
                style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: aceite ? 'var(--teal)' : 'var(--gray-100)', color: aceite ? '#fff' : 'var(--gray-400)', fontSize: 12, fontWeight: 700, cursor: aceite ? 'pointer' : 'not-allowed', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Enviando…' : 'Abrir conta'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
