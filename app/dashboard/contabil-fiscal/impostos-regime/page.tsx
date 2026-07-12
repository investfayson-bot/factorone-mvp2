'use client'

// Impostos & Regime (Fase 5, Bloco 1 + Bloco 4). Bloco 1 entregou o
// estimador de DAS do Simples Nacional (mantido abaixo). Bloco 4 adiciona o
// Simulador de Regime (Simples × Presumido × Real), o Painel de Impostos, o
// card "Como pagar menos imposto" (Fator R) e "Onde cada CNPJ está
// cadastrado" — seguindo o mockup 05-contabil.html. Todo valor de Presumido/
// Real é estimativa simplificada (lib/fiscal/lucro-presumido.ts,
// lucro-real.ts) — não substitui apuração oficial do contador.

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'
import toast from 'react-hot-toast'
import { useHolding } from '@/lib/holding-context'
import { calcularPresumido, type TipoAtividade } from '@/lib/fiscal/lucro-presumido'
import { calcularReal } from '@/lib/fiscal/lucro-real'
import { calcularFatorR } from '@/lib/fiscal/fator-r'
import { estimarCppPatronal, ALIQUOTA_CPP_PATRONAL_ESTIMADA } from '@/lib/fiscal/cpp-patronal'
import NoticiasFiscais from '@/components/fiscal/NoticiasFiscais'

type Faixa = { ate: number; aliquota: number; pd: number }

// Tabelas do Simples Nacional 2024 (RBT12, alíquota nominal, parcela a deduzir).
const ANEXOS: Record<string, { nome: string; faixas: Faixa[] }> = {
  I: {
    nome: 'Anexo I — Comércio',
    faixas: [
      { ate: 180000, aliquota: 0.04, pd: 0 },
      { ate: 360000, aliquota: 0.073, pd: 5940 },
      { ate: 720000, aliquota: 0.095, pd: 13860 },
      { ate: 1800000, aliquota: 0.107, pd: 22500 },
      { ate: 3600000, aliquota: 0.143, pd: 87300 },
      { ate: 4800000, aliquota: 0.19, pd: 378000 },
    ],
  },
  II: {
    nome: 'Anexo II — Indústria',
    faixas: [
      { ate: 180000, aliquota: 0.045, pd: 0 },
      { ate: 360000, aliquota: 0.078, pd: 5940 },
      { ate: 720000, aliquota: 0.10, pd: 13860 },
      { ate: 1800000, aliquota: 0.112, pd: 22500 },
      { ate: 3600000, aliquota: 0.147, pd: 85500 },
      { ate: 4800000, aliquota: 0.30, pd: 720000 },
    ],
  },
  III: {
    nome: 'Anexo III — Serviços',
    faixas: [
      { ate: 180000, aliquota: 0.06, pd: 0 },
      { ate: 360000, aliquota: 0.112, pd: 9360 },
      { ate: 720000, aliquota: 0.135, pd: 17640 },
      { ate: 1800000, aliquota: 0.16, pd: 35640 },
      { ate: 3600000, aliquota: 0.21, pd: 125640 },
      { ate: 4800000, aliquota: 0.33, pd: 648000 },
    ],
  },
  IV: {
    nome: 'Anexo IV — Serviços',
    faixas: [
      { ate: 180000, aliquota: 0.045, pd: 0 },
      { ate: 360000, aliquota: 0.09, pd: 8100 },
      { ate: 720000, aliquota: 0.102, pd: 12420 },
      { ate: 1800000, aliquota: 0.14, pd: 39780 },
      { ate: 3600000, aliquota: 0.22, pd: 183780 },
      { ate: 4800000, aliquota: 0.33, pd: 828000 },
    ],
  },
  V: {
    nome: 'Anexo V — Serviços',
    faixas: [
      { ate: 180000, aliquota: 0.155, pd: 0 },
      { ate: 360000, aliquota: 0.18, pd: 4500 },
      { ate: 720000, aliquota: 0.195, pd: 9900 },
      { ate: 1800000, aliquota: 0.205, pd: 17100 },
      { ate: 3600000, aliquota: 0.23, pd: 62100 },
      { ate: 4800000, aliquota: 0.305, pd: 540000 },
    ],
  },
}

const TIPO_POR_ANEXO: Record<string, TipoAtividade> = {
  I: 'comercio', II: 'industria', III: 'servicos', IV: 'servicos', V: 'servicos',
}

function calcular(rbt12: number, receitaMes: number, anexo: string) {
  const faixas = ANEXOS[anexo].faixas
  const faixa = faixas.find(f => rbt12 <= f.ate) ?? faixas[faixas.length - 1]
  const aliqEfetiva = rbt12 > 0 ? Math.max(0, (rbt12 * faixa.aliquota - faixa.pd) / rbt12) : 0
  const das = receitaMes * aliqEfetiva
  const acimaLimite = rbt12 > 4800000
  return { faixa, aliqEfetiva, das, acimaLimite }
}

type EmpresaCadastro = { id: string; nome: string; cnpj: string | null; cidade: string | null; uf: string | null; regime_tributario: string | null }

const REGIME_LABEL: Record<string, string> = { simples: 'Simples Nacional', presumido: 'Lucro Presumido', real: 'Lucro Real' }

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const t = data.session?.access_token
  return t ? { Authorization: `Bearer ${t}` } : {}
}

export default function ImpostosRegimePage() {
  const { grupoAtivoId, escopo, grupos } = useHolding()
  const [empresaId, setEmpresaId] = useState('')
  const [anexo, setAnexo] = useState('III')
  const [rbt12, setRbt12] = useState('')
  const [receitaMes, setReceitaMes] = useState('')
  const [competencia, setCompetencia] = useState(new Date().toISOString().slice(0, 7))
  const [estimando, setEstimando] = useState(false)
  const [registrando, setRegistrando] = useState(false)

  // Simulador de Regime
  const [meses, setMeses] = useState('6')
  const [despesasMes, setDespesasMes] = useState('')
  const [aliquotaIssIcms, setAliquotaIssIcms] = useState('5')
  const [folha12m, setFolha12m] = useState('')

  // Onde cada CNPJ está cadastrado
  const [empresas, setEmpresas] = useState<EmpresaCadastro[]>([])
  const [editando, setEditando] = useState<string | null>(null)
  const [formEdit, setFormEdit] = useState({ cidade: '', uf: '', regime: '' })
  const [salvandoEdit, setSalvandoEdit] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
      setEmpresaId((u?.empresa_id as string) ?? user.id)
    })
  }, [])

  const carregarEmpresas = useCallback(async () => {
    const qs = new URLSearchParams({ escopo })
    if (grupoAtivoId) qs.set('grupoId', grupoAtivoId)
    try {
      const res = await fetch(`/api/empresas/perfil-fiscal?${qs}`, { headers: await authHeaders() })
      const d = await res.json() as { empresas?: EmpresaCadastro[] }
      setEmpresas(res.ok ? (d.empresas ?? []) : [])
    } catch { setEmpresas([]) }
  }, [escopo, grupoAtivoId])
  useEffect(() => { void carregarEmpresas() }, [carregarEmpresas])

  async function estimarFaturamento() {
    if (!empresaId) return
    setEstimando(true)
    try {
      const { data } = await supabase
        .from('metricas_financeiras')
        .select('receita_bruta, competencia')
        .eq('empresa_id', empresaId)
        .order('competencia', { ascending: false })
        .limit(12)
      const linhas = data ?? []
      if (!linhas.length) { toast('Sem dados de faturamento. Preencha manualmente.'); return }
      const soma = linhas.reduce((s, r) => s + Number(r.receita_bruta ?? 0), 0)
      setRbt12(String(Math.round(soma)))
      if (!receitaMes) setReceitaMes(String(Math.round(Number(linhas[0].receita_bruta ?? 0))))
      toast.success(`RBT12 estimado de ${linhas.length} meses: ${formatBRL(soma)}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao estimar')
    } finally {
      setEstimando(false)
    }
  }

  const r = calcular(Number(rbt12) || 0, Number(receitaMes) || 0, anexo)
  const faixas = ANEXOS[anexo].faixas

  // DAS vence no dia 20 do mês seguinte à competência.
  function vencimentoDAS(comp: string): string {
    const [y, m] = comp.split('-').map(Number)
    const prox = new Date(Date.UTC(y, m, 20))
    return prox.toISOString().slice(0, 10)
  }

  async function registrarDAS() {
    if (!empresaId) return
    if (r.das <= 0) { toast.error('Calcule um DAS maior que zero antes de registrar.'); return }
    setRegistrando(true)
    try {
      const venc = vencimentoDAS(competencia)
      const res = await fetch('/api/fiscal/registrar-das', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ competencia, valor: Number(r.das.toFixed(2)), vencimento: venc }),
      })
      const d = await res.json() as { ok?: boolean; atualizado?: boolean; error?: string }
      if (!res.ok || !d.ok) throw new Error(d.error || 'Falha ao registrar')
      toast.success(`DAS de ${competencia} ${d.atualizado ? 'atualizado' : 'registrado'} (vence ${venc}).`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao registrar')
    } finally {
      setRegistrando(false)
    }
  }

  // ---------- Simulador de Regime ----------
  const tipoAtividade = TIPO_POR_ANEXO[anexo]
  // Fator R (LC 123 §5º-J/§5º-M) só decide entre Anexo III e V — não existe
  // pro Anexo IV (construção, vigilância, advocacia etc., achado do
  // revisor-financeiro: mostrar Fator R pro Anexo IV é conselho fiscal
  // errado, essas atividades nunca migram de anexo por causa da folha).
  const elegivelFatorR = anexo === 'III' || anexo === 'V'
  // CPP/INSS patronal já vem embutida na alíquota do DAS nos Anexos I, II,
  // III e V — só o Anexo IV paga CPP à parte, igual Presumido/Real.
  const cppEmbutidaNoSimples = anexo !== 'IV'
  const mesesNum = Math.max(1, Math.min(12, Number(meses) || 6))
  const receitaMesNum = Number(receitaMes) || 0
  const despesasMesNum = Math.max(0, Number(despesasMes) || 0)
  const aliquotaIssIcmsNum = Math.max(0, Number(aliquotaIssIcms) || 0) / 100
  const folhaMesNum = Math.max(0, Number(folha12m) || 0) / 12
  const podeSimular = receitaMesNum > 0

  const simplesTotal = r.das * mesesNum
  const presumido = useMemo(
    () => calcularPresumido(receitaMesNum, mesesNum, tipoAtividade, aliquotaIssIcmsNum),
    [receitaMesNum, mesesNum, tipoAtividade, aliquotaIssIcmsNum]
  )
  const real = useMemo(
    () => calcularReal(receitaMesNum, despesasMesNum, mesesNum, tipoAtividade, aliquotaIssIcmsNum),
    [receitaMesNum, despesasMesNum, mesesNum, tipoAtividade, aliquotaIssIcmsNum]
  )

  // CPP patronal estimada: soma-se a Presumido/Real (à parte, sempre) só
  // quando o Simples do anexo escolhido já a embute — senão a comparação
  // favorece Presumido/Real artificialmente (achado do revisor-financeiro).
  // Sem folha informada, não dá pra estimar — o aviso abaixo cobre isso.
  const cppAjuste = folhaMesNum > 0 && cppEmbutidaNoSimples ? estimarCppPatronal(folhaMesNum, mesesNum) : 0
  const comparacaoIncompleta = cppEmbutidaNoSimples && folhaMesNum === 0

  // Lucro Presumido é ilegal acima de R$78M de receita bruta anual (Lei
  // 9.718/98, art. 13) — usa o maior entre RBT12 informado e a receita do
  // mês anualizada como proxy de receita anual.
  const receitaAnualProxy = Math.max(Number(rbt12) || 0, receitaMesNum * 12)
  const presumidoPermitido = receitaAnualProxy <= 78_000_000

  const candidatos = [
    { id: 'simples' as const, nome: 'Simples Nacional', total: simplesTotal, elegivel: true, nota: `Anexo ${anexo} · alíquota efetiva ${(r.aliqEfetiva * 100).toFixed(2)}%` },
    { id: 'presumido' as const, nome: 'Lucro Presumido', total: presumido.total + cppAjuste, elegivel: presumidoPermitido, nota: presumidoPermitido ? `IRPJ+CSLL+PIS/COFINS+ISS/ICMS${cppAjuste > 0 ? '+CPP' : ''}` : 'Acima de R$78M/ano — obrigatório Lucro Real' },
    { id: 'real' as const, nome: 'Lucro Real', total: real.total + cppAjuste, elegivel: true, nota: `Apuração sobre lucro efetivo${cppAjuste > 0 ? '+CPP' : ''}` },
  ]
  const regimes = candidatos.filter(c => c.elegivel).sort((a, b) => a.total - b.total)
  const melhor = podeSimular ? regimes[0] : undefined
  const segundo = regimes[1]
  const economia = podeSimular && melhor && segundo ? segundo.total - melhor.total : 0

  const fatorR = folha12m && rbt12 ? calcularFatorR(Number(folha12m) || 0, Number(rbt12) || 0) : null

  // Painel de Impostos: itens do regime recomendado (+ CPP quando somada)
  const cppItem = cppAjuste > 0 ? [{ operacao: 'CPP patronal estimada (INSS+RAT+terceiros, ~26,8% da folha)', aliquota: ALIQUOTA_CPP_PATRONAL_ESTIMADA, base: folhaMesNum * mesesNum, imposto: cppAjuste }] : []
  const painelItens = podeSimular && melhor
    ? melhor.id === 'simples'
      ? [{ operacao: `Simples Nacional — Anexo ${anexo}`, aliquota: r.aliqEfetiva, base: receitaMesNum * mesesNum, imposto: simplesTotal }]
      : melhor.id === 'presumido' ? [...presumido.itens, ...cppItem] : [...real.itens, ...cppItem]
    : []

  async function abrirEdicao(e: EmpresaCadastro) {
    setEditando(e.id)
    setFormEdit({ cidade: e.cidade ?? '', uf: e.uf ?? '', regime: e.regime_tributario ?? '' })
  }

  async function salvarEdicao(id: string) {
    setSalvandoEdit(true)
    try {
      const res = await fetch('/api/empresas/perfil-fiscal', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ empresaId: id, cidade: formEdit.cidade, uf: formEdit.uf, regimeTributario: formEdit.regime }),
      })
      const d = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok || !d.ok) throw new Error(d.error || 'Falha ao salvar')
      toast.success('Cadastro atualizado')
      setEditando(null)
      void carregarEmpresas()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro')
    } finally { setSalvandoEdit(false) }
  }

  return (
    <div style={{ maxWidth: 1080, paddingBottom: 30 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--ink)' }}>Simples Nacional — Estimador de DAS</div>
          <div style={{ fontSize: 12.5, color: 'var(--mut)', marginTop: 2 }}>Alíquota efetiva e imposto do mês (tabelas 2024).</div>
        </div>
        <button onClick={() => void estimarFaturamento()} className="btn-v2" disabled={estimando}>
          {estimando ? 'Estimando…' : 'Estimar RBT12 do faturamento'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Entradas */}
        <div className="card-v2" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Anexo (atividade)</label>
            <select className="form-input" value={anexo} onChange={e => setAnexo(e.target.value)}>
              {Object.entries(ANEXOS).map(([k, v]) => <option key={k} value={k}>{v.nome}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">RBT12 — Receita bruta dos últimos 12 meses (R$)</label>
            <input className="form-input" type="number" value={rbt12} onChange={e => setRbt12(e.target.value)} placeholder="Ex.: 600000" />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Receita do mês (R$)</label>
            <input className="form-input" type="number" value={receitaMes} onChange={e => setReceitaMes(e.target.value)} placeholder="Ex.: 50000" />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Competência</label>
            <input className="form-input" type="month" value={competencia} onChange={e => setCompetencia(e.target.value)} />
          </div>
          <button onClick={() => void registrarDAS()} className="btn-v2 primary" disabled={registrando || r.das <= 0} style={{ opacity: (registrando || r.das <= 0) ? .6 : 1 }}>
            {registrando ? 'Registrando…' : 'Registrar DAS nas obrigações'}
          </button>
        </div>

        {/* Resultado */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="card-v2" style={{ padding: '13px 16px' }}>
              <div style={{ fontSize: 11.5, color: 'var(--mut)', textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 700 }}>DAS do mês</div>
              <div style={{ fontSize: 21, fontWeight: 800, color: '#B0413E', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{formatBRL(r.das)}</div>
            </div>
            <div className="card-v2" style={{ padding: '13px 16px' }}>
              <div style={{ fontSize: 11.5, color: 'var(--mut)', textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 700 }}>Alíquota efetiva</div>
              <div style={{ fontSize: 21, fontWeight: 800, color: 'var(--ink)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{(r.aliqEfetiva * 100).toFixed(2)}%</div>
            </div>
          </div>

          <div className="card-v2" style={{ padding: 16 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>Resumo</div>
            {[
              { label: 'Alíquota nominal da faixa', valor: `${(r.faixa.aliquota * 100).toFixed(2)}%` },
              { label: 'Parcela a deduzir', valor: formatBRL(r.faixa.pd) },
              { label: 'RBT12', valor: formatBRL(Number(rbt12) || 0) },
              { label: 'Receita do mês', valor: formatBRL(Number(receitaMes) || 0) },
            ].map(x => (
              <div key={x.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                <span style={{ color: 'var(--mut)' }}>{x.label}</span>
                <span style={{ color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{x.valor}</span>
              </div>
            ))}
          </div>

          {r.acimaLimite && (
            <div style={{ background: 'rgba(176,65,62,.08)', border: '1px solid rgba(176,65,62,.3)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#B0413E' }}>
              RBT12 acima de R$ 4.800.000 — fora do limite do Simples Nacional. Considere Lucro Presumido/Real.
            </div>
          )}
        </div>
      </div>

      {/* Tabela do anexo */}
      <div className="card-v2" style={{ padding: 16, marginTop: 16 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 10 }}>{ANEXOS[anexo].nome} — faixas</div>
        <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ color: 'var(--mut)', fontSize: 12 }}>
              <th style={{ textAlign: 'left', padding: '6px 4px' }}>RBT12 até</th>
              <th style={{ textAlign: 'right', padding: '6px 4px' }}>Alíquota</th>
              <th style={{ textAlign: 'right', padding: '6px 4px' }}>Parcela a deduzir</th>
            </tr>
          </thead>
          <tbody>
            {faixas.map((f, i) => {
              const ativa = f === r.faixa && (Number(rbt12) || 0) > 0
              return (
                <tr key={i} style={{ background: ativa ? 'var(--acc-soft)' : 'transparent' }}>
                  <td style={{ padding: '6px 4px', fontWeight: ativa ? 700 : 400, color: ativa ? 'var(--ink)' : 'var(--mut)', fontVariantNumeric: 'tabular-nums' }}>{formatBRL(f.ate)} {ativa && '←'}</td>
                  <td style={{ textAlign: 'right', padding: '6px 4px', fontWeight: ativa ? 700 : 400, fontVariantNumeric: 'tabular-nums' }}>{(f.aliquota * 100).toFixed(2)}%</td>
                  <td style={{ textAlign: 'right', padding: '6px 4px', color: 'var(--mut)', fontVariantNumeric: 'tabular-nums' }}>{formatBRL(f.pd)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div style={{ fontSize: 12, color: 'var(--mut)', marginTop: 10, lineHeight: 1.6 }}>
          Estimativa simplificada. Não considera Fator R (Anexo III × V), sublimites estaduais, ICMS/ISS por fora, nem retenções. Consulte seu contador para o valor oficial.
        </div>
      </div>

      <div style={{ marginTop: 14, marginBottom: 26, fontSize: 12.5, color: 'var(--mut)' }}>
        Registrou o DAS? Acompanhe o pagamento em <Link href="/dashboard/tax" style={{ color: 'var(--acc)', fontWeight: 600 }}>Tax Compliance</Link>.
      </div>

      {/* ---------- Simulador de Regime ---------- */}
      <div style={{ borderTop: '1px solid var(--line)', paddingTop: 22, marginBottom: 6 }}>
        <div style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--ink)' }}>Simulador de Regime Tributário</div>
        <div style={{ fontSize: 12.5, color: 'var(--mut)', marginTop: 2, marginBottom: 16, lineHeight: 1.6 }}>
          Estimativa simplificada pra comparar Simples × Lucro Presumido × Lucro Real com os mesmos dados acima — não substitui apuração oficial.
          Assume receita mensal constante durante todo o período simulado (o RBT12 real muda mês a mês). Entre R$3,6M–4,8M de RBT12 o Simples também paga ICMS/ISS por fora do DAS, não incluído aqui.
        </div>
      </div>

      <div className="card-v2" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Período (meses)</label>
            <input className="form-input" type="number" min={1} max={12} value={meses} onChange={e => setMeses(e.target.value)} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Despesas dedutíveis/mês (R$)</label>
            <input className="form-input" type="number" value={despesasMes} onChange={e => setDespesasMes(e.target.value)} placeholder="Ex.: 20000" />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Alíquota {tipoAtividade === 'servicos' ? 'ISS' : 'ICMS'} (%)</label>
            <input className="form-input" type="number" step="0.1" value={aliquotaIssIcms} onChange={e => setAliquotaIssIcms(e.target.value)} placeholder="Ex.: 5" />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Folha 12m — p/ Fator R (R$, opcional)</label>
            <input className="form-input" type="number" value={folha12m} onChange={e => setFolha12m(e.target.value)} placeholder="Salários + pró-labore + encargos" />
          </div>
        </div>
      </div>

      {!podeSimular ? (
        <div className="card-v2" style={{ padding: 24, textAlign: 'center', color: 'var(--mut)', fontSize: 13, marginBottom: 16 }}>
          Preencha a receita do mês acima pra comparar os 3 regimes.
        </div>
      ) : (
        <>
          {comparacaoIncompleta && (
            <div style={{ background: 'rgba(176,65,62,.08)', border: '1px solid rgba(176,65,62,.3)', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: 12.5, color: '#B0413E', fontWeight: 600 }}>
              ⚠ Sem a folha de pagamento (campo &quot;Folha 12m&quot; acima), esta comparação NÃO inclui a CPP/INSS patronal (~26,8% da folha) que Presumido e Real pagam à parte — no Anexo {anexo} do Simples ela já está embutida no DAS. Sem esse dado, Presumido/Real podem aparecer mais baratos do que realmente são.
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
            {candidatos.map(reg => {
              const recomendado = reg.elegivel && melhor?.id === reg.id
              return (
                <div key={reg.id} className="card-v2" style={{
                  padding: 14, border: recomendado ? '1.5px solid var(--acc)' : '1.5px solid var(--line)',
                  background: recomendado ? 'var(--acc-soft)' : 'var(--card)',
                  opacity: reg.elegivel ? 1 : .55,
                }}>
                  {recomendado && <span className="chip-v2 g" style={{ marginBottom: 6, display: 'inline-block' }}>Recomendado</span>}
                  {!reg.elegivel && <span className="chip-v2 y" style={{ marginBottom: 6, display: 'inline-block' }}>Não permitido</span>}
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>{reg.nome}</div>
                  <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
                    {formatBRL(reg.total)}<small style={{ fontSize: 11, fontWeight: 700, color: 'var(--mut)' }}> /{mesesNum === 1 ? 'mês' : `${mesesNum}m`}</small>
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--mut)', fontWeight: 700, marginTop: 3 }}>{reg.nota}</div>
                </div>
              )
            })}
          </div>
          {economia > 0 && melhor && segundo && (
            <div style={{ background: 'var(--acc-soft)', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 12.5, color: 'var(--acc-ink)', fontWeight: 700 }}>
              💡 Ficando em {melhor.nome}, a economia é de {formatBRL(economia)} em relação a {segundo.nome} no período de {mesesNum} mês{mesesNum === 1 ? '' : 'es'}.
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, marginBottom: 8 }}>
            {/* Painel de impostos */}
            <div className="card-v2" style={{ padding: 16 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 10 }}>Painel de Impostos — regime recomendado ({melhor?.nome})</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1.6fr .7fr 1fr .8fr', fontSize: 11, color: 'var(--mut)', fontWeight: 700, padding: '4px 0', borderBottom: '1px solid var(--line)' }}>
                <span>Operação</span><span>Alíquota</span><span>Base</span><span style={{ textAlign: 'right' }}>Imposto</span>
              </div>
              {painelItens.map((it, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.6fr .7fr 1fr .8fr', fontSize: 12.5, padding: '7px 0', borderBottom: '1px solid var(--line)' }}>
                  <span style={{ color: 'var(--ink)' }}>{it.operacao}</span>
                  <span style={{ fontWeight: 700 }}>{(it.aliquota * 100).toFixed(2)}%</span>
                  <span style={{ color: 'var(--mut)', fontVariantNumeric: 'tabular-nums' }}>{formatBRL(it.base)}</span>
                  <span style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatBRL(it.imposto)}</span>
                </div>
              ))}
              <div style={{ fontSize: 11.5, color: 'var(--mut)', fontWeight: 600, marginTop: 10, lineHeight: 1.6 }}>
                Total apurado no período: <b style={{ color: 'var(--ink)' }}>{formatBRL(melhor?.total ?? 0)}</b>.
                {melhor?.id === 'real' && ' Lucro Real aqui não desconta créditos de PIS/COFINS sobre insumos — o valor real tende a ser menor do que este.'}
              </div>
            </div>

            {/* Como pagar menos imposto */}
            <div style={{ background: 'linear-gradient(135deg,#0C1D16,#143526)', borderRadius: 14, padding: '16px 18px', color: '#DCE7E0' }}>
              <span style={{ background: '#22C55E', color: '#06130C', fontSize: 9.5, fontWeight: 800, padding: '2px 7px', borderRadius: 5, letterSpacing: '.05em' }}>FACTORONE AI</span>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: '#fff', margin: '9px 0 8px' }}>Como pagar menos imposto</div>
              {fatorR && elegivelFatorR ? (
                <p style={{ fontSize: 12, lineHeight: 1.6 }}>
                  Seu Fator R está em <b>{(fatorR.percentual * 100).toFixed(1)}%</b> — {fatorR.acimaDoLimite
                    ? <>acima dos 28% que garantem o Anexo III. Margem de segurança: <b>{fatorR.margemPontosPercentuais.toFixed(1)} p.p.</b> Se a folha cair, você perde o Anexo III e paga mais imposto.</>
                    : <>abaixo dos 28% — você está no Anexo V, com alíquota maior. Aumentando a folha (salários/pró-labore) pra pelo menos <b>{formatBRL(fatorR.folhaMensalMinimaParaAnexoIII)}/mês</b>, você entra no Anexo III.</>}
                </p>
              ) : melhor ? (
                <p style={{ fontSize: 12, lineHeight: 1.6 }}>
                  {melhor.id === 'simples'
                    ? `O Simples Nacional segue sendo o mais barato com os dados atuais.${elegivelFatorR ? ' Informe a folha de pagamento acima pra ver o Fator R.' : ''}`
                    : `${melhor.nome} está saindo mais barato que o Simples com os dados informados — vale confirmar com o contador antes de migrar de regime (a troca só vale pro ano seguinte).`}
                </p>
              ) : (
                <p style={{ fontSize: 12, lineHeight: 1.6 }}>Preencha a receita do mês pra receber uma recomendação.</p>
              )}
            </div>
          </div>
        </>
      )}

      {/* Mudanças de legislação (Bloco 5 — RSS público) */}
      <div style={{ marginBottom: 16 }}>
        <NoticiasFiscais />
      </div>

      {/* Onde cada CNPJ está cadastrado */}
      <div className="card-v2" style={{ overflow: 'hidden', marginBottom: 30 }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>
          Onde cada CNPJ está cadastrado
        </div>
        {empresas.length === 0 ? (
          <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--mut)', fontSize: 13 }}>Nenhuma empresa no escopo atual.</div>
        ) : empresas.map(e => (
          <div key={e.id} style={{ padding: '10px 16px', borderBottom: '1px solid var(--line)' }}>
            {editando === e.id ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', minWidth: 140 }}>{e.nome}</span>
                <select className="form-input" style={{ width: 150, height: 30, fontSize: 12 }} value={formEdit.regime} onChange={ev => setFormEdit(f => ({ ...f, regime: ev.target.value }))}>
                  <option value="">Regime — selecione</option>
                  <option value="simples">Simples Nacional</option>
                  <option value="presumido">Lucro Presumido</option>
                  <option value="real">Lucro Real</option>
                </select>
                <input className="form-input" style={{ width: 150, height: 30, fontSize: 12 }} placeholder="Cidade" value={formEdit.cidade} onChange={ev => setFormEdit(f => ({ ...f, cidade: ev.target.value }))} />
                <input className="form-input" style={{ width: 54, height: 30, fontSize: 12 }} placeholder="UF" maxLength={2} value={formEdit.uf} onChange={ev => setFormEdit(f => ({ ...f, uf: ev.target.value.toUpperCase() }))} />
                <button className="btn-v2 primary" style={{ padding: '5px 10px', fontSize: 12 }} disabled={salvandoEdit} onClick={() => void salvarEdicao(e.id)}>Salvar</button>
                <button className="btn-v2" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => setEditando(null)}>Cancelar</button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600 }}>
                <span style={{ color: 'var(--ink)', fontWeight: 700 }}>{e.nome}</span>
                <span style={{ color: 'var(--mut)' }}>·</span>
                <span style={{ color: 'var(--ink)', fontWeight: 700 }}>{e.regime_tributario ? REGIME_LABEL[e.regime_tributario] : 'Regime não informado'}</span>
                {(e.cidade || e.uf) && <><span style={{ color: 'var(--mut)' }}>·</span><span style={{ color: 'var(--mut)' }}>{[e.cidade, e.uf].filter(Boolean).join('/')}</span></>}
                <button className="btn-v2" style={{ padding: '3px 9px', fontSize: 11, marginLeft: 'auto' }} onClick={() => void abrirEdicao(e)}>Editar</button>
              </div>
            )}
          </div>
        ))}
        {grupos.length === 0 && (
          <div style={{ padding: '8px 16px', fontSize: 11, color: 'var(--mut)' }}>Sem Holding criada — mostrando sua empresa.</div>
        )}
      </div>
    </div>
  )
}
