'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'
import toast from 'react-hot-toast'

// IRPF 2024 — tabela progressiva mensal
const FAIXAS_IRPF = [
  { ate: 2259.20, aliquota: 0,     deducao: 0 },
  { ate: 2826.65, aliquota: 0.075, deducao: 169.44 },
  { ate: 3751.05, aliquota: 0.15,  deducao: 381.44 },
  { ate: 4664.68, aliquota: 0.225, deducao: 662.77 },
  { ate: Infinity, aliquota: 0.275, deducao: 896.00 },
]
const DEDUCAO_DEPENDENTE_MENSAL = 189.59
const LIMITE_EDUCACAO_ANUAL = 3561.50

function calcularIR(rendaBruta: number, deducoesAnuais: {
  dependentes: number; saude: number; educacao: number; inss: number; previdencia: number; outros: number
}) {
  const rendaMensal = rendaBruta
  const deducaoDependentes = deducoesAnuais.dependentes * DEDUCAO_DEPENDENTE_MENSAL
  const deducaoEducacaoMensal = Math.min(deducoesAnuais.educacao / 12, LIMITE_EDUCACAO_ANUAL / 12)
  const deducaoMensal = deducaoDependentes + (deducoesAnuais.saude / 12) + deducaoEducacaoMensal + (deducoesAnuais.inss / 12) + (deducoesAnuais.previdencia / 12) + (deducoesAnuais.outros / 12)
  const baseCalculo = Math.max(0, rendaMensal - deducaoMensal)

  const faixa = FAIXAS_IRPF.find(f => baseCalculo <= f.ate)!
  const irMensal = Math.max(0, baseCalculo * faixa.aliquota - faixa.deducao)
  const aliquotaEfetiva = rendaMensal > 0 ? irMensal / rendaMensal : 0

  return { baseCalculo, irMensal, irAnual: irMensal * 12, aliquotaEfetiva, aliquotaNominal: faixa.aliquota, deducaoMensal }
}

export default function IRPage() {
  const [userId, setUserId] = useState('')
  const [renda, setRenda] = useState(0)
  const [ano] = useState(new Date().getFullYear())
  const [deducoes, setDeducoes] = useState({ dependentes: 0, saude: 0, educacao: 0, inss: 0, previdencia: 0, outros: 0 })
  const [saving, setSaving] = useState(false)
  const [importando, setImportando] = useState(false)

  async function importarGastos() {
    if (!userId) return
    setImportando(true)
    try {
      const ini = `${ano}-01-01`, fim = `${ano}-12-31`
      const { data } = await supabase
        .from('despesas_pessoais')
        .select('valor, categoria, data_despesa')
        .eq('user_id', userId)
        .gte('data_despesa', ini).lte('data_despesa', fim)
        .in('categoria', ['Saúde', 'Educação'])
      const saude = (data ?? []).filter(d => d.categoria === 'Saúde').reduce((s, d) => s + Number(d.valor), 0)
      const educacao = (data ?? []).filter(d => d.categoria === 'Educação').reduce((s, d) => s + Number(d.valor), 0)
      if (!saude && !educacao) { toast('Nenhum gasto de Saúde/Educação encontrado no ano.'); return }
      setDeducoes(d => ({ ...d, saude, educacao }))
      toast.success(`Importado: ${formatBRL(saude)} saúde + ${formatBRL(educacao)} educação. Revise e salve.`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao importar')
    } finally {
      setImportando(false)
    }
  }

  const carregar = useCallback(async (uid: string) => {
    const [perfil, ded] = await Promise.all([
      supabase.from('perfil_usuario').select('renda_mensal').eq('user_id', uid).maybeSingle(),
      supabase.from('deducoes_ir_pf').select('*').eq('user_id', uid).eq('ano', ano).maybeSingle(),
    ])
    if (perfil.data?.renda_mensal) setRenda(Number(perfil.data.renda_mensal))
    if (ded.data) setDeducoes({ dependentes: ded.data.dependentes ?? 0, saude: Number(ded.data.saude ?? 0), educacao: Number(ded.data.educacao ?? 0), inss: Number(ded.data.inss ?? 0), previdencia: Number(ded.data.previdencia ?? 0), outros: Number(ded.data.outros ?? 0) })
  }, [ano])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) { setUserId(user.id); carregar(user.id) }
    })
  }, [carregar])

  async function salvar() {
    setSaving(true)
    const { error } = await supabase.from('deducoes_ir_pf').upsert({ user_id: userId, ano, ...deducoes }, { onConflict: 'user_id,ano' })
    setSaving(false)
    if (error) return toast.error(error.message)
    toast.success('Deduções salvas')
  }

  const resultado = calcularIR(renda, deducoes)

  const faixaLabel = (aliquota: number) => {
    if (aliquota === 0) return 'Isento'
    return `${(aliquota * 100).toFixed(1)}%`
  }

  return (
    <>
      <div className="page-hdr">
        <div>
          <div className="page-title">Imposto de Renda {ano}</div>
          <div className="page-sub">Estimativa IRPF com tabela progressiva 2024</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={importarGastos} className="btn-action btn-ghost" disabled={importando}>{importando ? 'Importando...' : 'Importar gastos do ano'}</button>
          <button onClick={salvar} className="btn-action" disabled={saving}>{saving ? 'Salvando...' : 'Salvar deduções'}</button>
        </div>
      </div>

      {renda === 0 && (
        <div style={{ background: 'rgba(234,179,8,.08)', border: '1px solid rgba(234,179,8,.3)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#92400e' }}>
          Configure sua renda mensal em <strong>Receitas</strong> para calcular o IR corretamente.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Deduções */}
        <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>Deduções anuais</div>
          <div style={{ fontSize: 11, color: 'var(--gray-400)', marginBottom: 16 }}>Valores do ano completo</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-500)', display: 'block', marginBottom: 4 }}>Dependentes (quantidade)</label>
              <input className="form-input" type="number" min="0" max="20" value={deducoes.dependentes} onChange={e => setDeducoes(d => ({ ...d, dependentes: parseInt(e.target.value) || 0 }))} />
              <div style={{ fontSize: 10, color: 'var(--gray-400)', marginTop: 2 }}>R$ 189,59/mês por dependente</div>
            </div>
            {[
              { key: 'saude', label: 'Saúde (plano, consultas, exames)', hint: 'Dedução integral' },
              { key: 'educacao', label: 'Educação (escola, faculdade)', hint: `Limite R$ ${formatBRL(LIMITE_EDUCACAO_ANUAL)}/ano` },
              { key: 'inss', label: 'INSS pago no ano', hint: 'Dedução integral' },
              { key: 'previdencia', label: 'Previdência privada (PGBL)', hint: 'Até 12% da renda bruta anual' },
              { key: 'outros', label: 'Outras deduções', hint: 'Doações, livro-caixa etc.' },
            ].map(({ key, label, hint }) => (
              <div key={key}>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-500)', display: 'block', marginBottom: 4 }}>{label}</label>
                <input className="form-input" type="number" min="0" value={deducoes[key as keyof typeof deducoes]} onChange={e => setDeducoes(d => ({ ...d, [key]: Number(e.target.value) || 0 }))} />
                <div style={{ fontSize: 10, color: 'var(--gray-400)', marginTop: 2 }}>{hint}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Resultado */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="kpis" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="kpi">
              <div className="kpi-lbl">IR mensal estimado</div>
              <div className="kpi-val" style={{ color: resultado.irMensal > 0 ? 'var(--red)' : 'var(--teal)' }}>{formatBRL(resultado.irMensal)}</div>
              <div className={`kpi-delta ${resultado.irMensal > 0 ? 'dn' : 'up'}`}>{resultado.irMensal > 0 ? faixaLabel(resultado.aliquotaNominal) : 'Isento'}</div>
            </div>
            <div className="kpi">
              <div className="kpi-lbl">IR anual estimado</div>
              <div className="kpi-val" style={{ color: resultado.irAnual > 0 ? 'var(--red)' : 'var(--teal)' }}>{formatBRL(resultado.irAnual)}</div>
              <div className="kpi-delta">13 meses estimados</div>
            </div>
            <div className="kpi">
              <div className="kpi-lbl">Alíquota efetiva</div>
              <div className="kpi-val">{(resultado.aliquotaEfetiva * 100).toFixed(2)}%</div>
              <div className="kpi-delta">sobre renda bruta</div>
            </div>
            <div className="kpi">
              <div className="kpi-lbl">Base de cálculo</div>
              <div className="kpi-val" style={{ fontSize: 16 }}>{formatBRL(resultado.baseCalculo)}</div>
              <div className="kpi-delta">após deduções</div>
            </div>
          </div>

          {/* Resumo deduções */}
          <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', marginBottom: 12 }}>Resumo do cálculo</div>
            {[
              { label: 'Renda bruta mensal', valor: renda, cor: 'var(--teal)' },
              { label: 'Total de deduções/mês', valor: -resultado.deducaoMensal, cor: 'var(--navy)' },
              { label: 'Base de cálculo', valor: resultado.baseCalculo, cor: 'var(--navy)', bold: true },
              { label: 'IR retido na fonte', valor: -resultado.irMensal, cor: resultado.irMensal > 0 ? 'var(--red)' : 'var(--teal)' },
              { label: 'Renda líquida estimada', valor: renda - resultado.irMensal, cor: 'var(--teal)', bold: true },
            ].map(({ label, valor, cor, bold }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '6px 0', borderBottom: '1px solid var(--gray-100)', fontWeight: bold ? 700 : 400 }}>
                <span style={{ color: 'var(--gray-400)' }}>{label}</span>
                <span style={{ color: cor, fontFamily: "'DM Mono',monospace" }}>{valor < 0 ? `- ${formatBRL(Math.abs(valor))}` : formatBRL(valor)}</span>
              </div>
            ))}
          </div>

          {/* Tabela IRPF */}
          <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', marginBottom: 10 }}>Tabela IRPF 2024 (mensal)</div>
            <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ color: 'var(--gray-400)' }}>
                  <th style={{ textAlign: 'left', paddingBottom: 6 }}>Base de cálculo</th>
                  <th style={{ textAlign: 'right', paddingBottom: 6 }}>Alíquota</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { faixa: 'Até R$ 2.259,20', aliquota: 'Isento' },
                  { faixa: 'R$ 2.259,21 a R$ 2.826,65', aliquota: '7,5%' },
                  { faixa: 'R$ 2.826,66 a R$ 3.751,05', aliquota: '15%' },
                  { faixa: 'R$ 3.751,06 a R$ 4.664,68', aliquota: '22,5%' },
                  { faixa: 'Acima de R$ 4.664,68', aliquota: '27,5%' },
                ].map(({ faixa, aliquota }) => {
                  const ativa = aliquota === faixaLabel(resultado.aliquotaNominal) || (aliquota === 'Isento' && resultado.aliquotaNominal === 0)
                  return (
                    <tr key={faixa} style={{ background: ativa ? 'rgba(94,140,135,.08)' : 'transparent' }}>
                      <td style={{ padding: '5px 4px', color: ativa ? 'var(--navy)' : 'var(--gray-400)', fontWeight: ativa ? 700 : 400 }}>{faixa} {ativa && '←'}</td>
                      <td style={{ textAlign: 'right', padding: '5px 4px', color: ativa ? 'var(--teal)' : 'var(--gray-400)', fontWeight: ativa ? 700 : 400 }}>{aliquota}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div style={{ fontSize: 10, color: 'var(--gray-400)', marginTop: 10, lineHeight: 1.6 }}>
              Estimativa baseada nos dados informados. Consulte um contador para valores definitivos.
              Não considera renda variável, ganho de capital ou outras fontes.
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
