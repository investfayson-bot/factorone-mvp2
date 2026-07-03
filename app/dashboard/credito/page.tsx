'use client'
import { useState, useMemo } from 'react'
import { formatBRL } from '@/lib/currency-brl'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts'

type ModoCalc = 'financiamento' | 'consorcio' | 'credito_giro' | 'comparativo'

// ── Calculadora Price (SAC e Price) ──────────────────────────
function calcPrice(pv: number, taxa: number, n: number) {
  if (taxa === 0) return Array.from({ length: n }, (_, i) => ({ mes: i + 1, parcela: pv / n, juros: 0, amortizacao: pv / n, saldo: pv - (pv / n) * (i + 1) }))
  const r = taxa / 100
  const pmt = pv * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
  const rows = []
  let saldo = pv
  for (let i = 1; i <= n; i++) {
    const juros = saldo * r
    const amort = pmt - juros
    saldo -= amort
    rows.push({ mes: i, parcela: pmt, juros, amortizacao: amort, saldo: Math.max(0, saldo) })
  }
  return rows
}

function calcSAC(pv: number, taxa: number, n: number) {
  const r = taxa / 100
  const amort = pv / n
  const rows = []
  let saldo = pv
  for (let i = 1; i <= n; i++) {
    const juros = saldo * r
    const parcela = amort + juros
    saldo -= amort
    rows.push({ mes: i, parcela, juros, amortizacao: amort, saldo: Math.max(0, saldo) })
  }
  return rows
}

const TAXAS_MERCADO = [
  { nome: 'Crédito Imobiliário (CEF)', taxa: 0.83, tipo: 'Imóvel' },
  { nome: 'Financiamento Veículo', taxa: 1.49, tipo: 'Veículo' },
  { nome: 'Capital de Giro PJ', taxa: 2.1, tipo: 'Empresa' },
  { nome: 'BNDES (PME)', taxa: 0.95, tipo: 'Empresa' },
  { nome: 'Antecipação de Recebíveis', taxa: 1.8, tipo: 'Empresa' },
  { nome: 'Crédito Pessoal (banco)', taxa: 3.5, tipo: 'Pessoal' },
  { nome: 'Cheque Especial PJ', taxa: 7.2, tipo: 'Alerta' },
  { nome: 'Cartão de Crédito PJ', taxa: 12.4, tipo: 'Alerta' },
]

const ESTRATEGIAS = [
  { titulo: 'Alavancagem inteligente', icon: 'fa-chart-line', cor: '#3D7A6E', desc: 'Use crédito para investimentos com retorno superior à taxa de juros. Se a taxa é 1.5%/mês e seu negócio retorna 3%/mês, a dívida gera riqueza.' },
  { titulo: 'Score e relacionamento bancário', icon: 'fa-star', cor: '#B08A3E', desc: 'Mantenha conta ativa, pague em dia e movimente regularmente. Bancos analisam tempo de relacionamento, faturamento médio e adimplência.' },
  { titulo: 'Antecipação de recebíveis', icon: 'fa-money-bill-transfer', cor: '#3D6E8E', desc: 'Antecipe notas fiscais e duplicatas com taxas menores que capital de giro. Ideal para capital de giro de curto prazo.' },
  { titulo: 'BNDES e linhas subsidiadas', icon: 'fa-landmark', cor: '#7A6A9E', desc: 'BNDES PME, Pronampe e Crédito para PMEs têm taxas muito menores que o mercado. Exige CNPJ ativo há 2+ anos e certidões negativas.' },
  { titulo: 'Consórcio como alternativa', icon: 'fa-handshake', cor: '#B08A3E', desc: 'Sem juros (só taxa adm.). Ideal para quem não tem urgência e quer parcelar com custo baixo. Risco: sorteio/lance para contemplação.' },
  { titulo: 'Diversificar fontes de crédito', icon: 'fa-scale-balanced', cor: '#B0413E', desc: 'Não concentre todo crédito num só banco. Fintech + banco tradicional + BNDES = melhores condições e menor dependência.' },
]

export default function CreditoPage() {
  const [modo, setModo] = useState<ModoCalc>('financiamento')
  const [valor, setValor] = useState('100000')
  const [taxa, setTaxa] = useState('1.5')
  const [prazo, setPrazo] = useState('60')
  const [sistema, setSistema] = useState<'price' | 'sac'>('price')
  const [entrada, setEntrada] = useState('20000')
  // Consórcio
  const [taxaAdm, setTaxaAdm] = useState('15')
  // Crédito giro
  const [faturamento, setFaturamento] = useState('50000')

  const pv = Number(valor) - Number(entrada)
  const t = Number(taxa)
  const n = Number(prazo)

  const tabelaPrice = useMemo(() => pv > 0 && t > 0 && n > 0 ? calcPrice(pv, t, n) : [], [pv, t, n])
  const tabelaSAC   = useMemo(() => pv > 0 && t > 0 && n > 0 ? calcSAC(pv, t, n) : [], [pv, t, n])
  const tabela = sistema === 'price' ? tabelaPrice : tabelaSAC

  const totalPago = tabela.reduce((s, r) => s + r.parcela, 0)
  const totalJuros = tabela.reduce((s, r) => s + r.juros, 0)
  const custoEfetivo = pv > 0 ? ((totalPago / pv) - 1) * 100 : 0
  const parcelaPrimeira = tabela[0]?.parcela ?? 0
  const parcelaUltima = tabela[tabela.length - 1]?.parcela ?? 0

  // Gráfico comparativo Price vs SAC (primeiras 12 parcelas)
  const comparativo = useMemo(() => {
    return tabelaPrice.slice(0, Math.min(12, n)).map((p, i) => ({
      mes: `M${i + 1}`,
      price: Math.round(p.parcela),
      sac: Math.round(tabelaSAC[i]?.parcela ?? 0),
    }))
  }, [tabelaPrice, tabelaSAC, n])

  // Consórcio
  const parcelaConsorcio = Number(valor) * (1 + Number(taxaAdm) / 100) / Number(prazo)
  const totalConsorcio = parcelaConsorcio * Number(prazo)
  const economiaVsFinanc = totalPago - totalConsorcio

  // Limite de crédito sugerido
  const limiteGiro = Number(faturamento) * 0.3
  const limite6meses = Number(faturamento) * 6 * 0.25

  const TABS = [
    { key: 'financiamento', label: 'Simulador', icon: 'fa-calculator' },
    { key: 'consorcio', label: 'Consórcio', icon: 'fa-handshake' },
    { key: 'credito_giro', label: 'Capital de Giro', icon: 'fa-rotate' },
    { key: 'comparativo', label: 'Taxas do Mercado', icon: 'fa-chart-bar' },
  ] as const

  return (
    <>
      <div className="page-hdr">
        <div>
          <div className="page-title">Crédito & Financiamento</div>
          <div className="page-sub">Simulador · consórcio · capital de giro · estratégias de captação</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, background: '#F1ECE1', padding: 3, borderRadius: 10, width: 'fit-content', marginBottom: 20 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setModo(t.key)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 11, fontWeight: modo === t.key ? 700 : 500,
            padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: modo === t.key ? '#fff' : 'transparent',
            color: modo === t.key ? '#13201D' : '#7B8C88', transition: 'all .15s',
          }}>
            <i className={`fa-solid ${t.icon}`} style={{ fontSize: 10 }} />{t.label}
          </button>
        ))}
      </div>

      {/* SIMULADOR */}
      {modo === 'financiamento' && (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 14 }}>
          {/* Formulário */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: '#fff', border: '0.5px solid #E4DCCC', borderRadius: 14, padding: '16px 18px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#13201D', marginBottom: 14, fontFamily: "var(--font-sans)" }}>Parâmetros</div>
              {[
                { label: 'Valor do bem (R$)', value: valor, set: setValor, placeholder: '100000' },
                { label: 'Entrada (R$)', value: entrada, set: setEntrada, placeholder: '20000' },
                { label: 'Taxa de juros (%/mês)', value: taxa, set: setTaxa, placeholder: '1.5' },
                { label: 'Prazo (meses)', value: prazo, set: setPrazo, placeholder: '60' },
              ].map(f => (
                <div key={f.label} style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 10, fontWeight: 600, color: '#7B8C88', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{f.label}</label>
                  <input className="form-input" type="number" placeholder={f.placeholder} value={f.value} onChange={e => f.set(e.target.value)} style={{ fontFamily: "var(--font-sans)", fontWeight: 600 }} />
                </div>
              ))}
              <div>
                <label style={{ fontSize: 10, fontWeight: 600, color: '#7B8C88', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Sistema de amortização</label>
                <div style={{ display: 'flex', gap: 2, background: '#F1ECE1', padding: 3, borderRadius: 8 }}>
                  {(['price', 'sac'] as const).map(s => (
                    <button key={s} onClick={() => setSistema(s)} style={{
                      flex: 1, padding: '6px', borderRadius: 7, border: 'none', cursor: 'pointer',
                      fontSize: 11, fontWeight: sistema === s ? 700 : 500,
                      background: sistema === s ? '#fff' : 'transparent',
                      color: sistema === s ? '#13201D' : '#7B8C88',
                    }}>{s.toUpperCase()}</button>
                  ))}
                </div>
                <div style={{ fontSize: 10, color: '#7B8C88', marginTop: 6, lineHeight: 1.5 }}>
                  {sistema === 'price' ? 'Price: parcelas iguais — mais usado em financiamentos.' : 'SAC: amortização constante — parcelas decrescentes, menos juros no total.'}
                </div>
              </div>
            </div>

            {/* KPIs resumo */}
            {tabela.length > 0 && (
              <div style={{ background: '#13201D', borderRadius: 14, padding: '16px 18px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#6FA595', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Resumo</div>
                {[
                  { label: 'Valor financiado', val: formatBRL(pv), cor: '#fff' },
                  { label: 'Primeira parcela', val: formatBRL(parcelaPrimeira), cor: '#fff' },
                  { label: sistema === 'sac' ? 'Última parcela' : 'Parcela (fixa)', val: formatBRL(parcelaUltima), cor: '#fff' },
                  { label: 'Total de juros', val: formatBRL(totalJuros), cor: '#FFB3B3' },
                  { label: 'Total pago', val: formatBRL(totalPago), cor: '#FFB3B3' },
                  { label: 'Custo efetivo total', val: `${custoEfetivo.toFixed(1)}%`, cor: custoEfetivo > 50 ? '#FFB3B3' : '#6FA595' },
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '0.5px solid rgba(255,255,255,.06)' }}>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,.55)' }}>{item.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: item.cor, fontFamily: "var(--font-sans)" }}>{item.val}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Resultados */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Gráfico Price vs SAC */}
            {comparativo.length > 0 && (
              <div style={{ background: '#fff', border: '0.5px solid #E4DCCC', borderRadius: 14, padding: '16px 18px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#13201D', marginBottom: 4, fontFamily: "var(--font-sans)" }}>Price vs SAC — parcelas (primeiros 12 meses)</div>
                <div style={{ fontSize: 11, color: '#7B8C88', marginBottom: 14 }}>Price tem parcelas fixas. SAC começa maior mas você paga menos juros no total.</div>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={comparativo} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EFE9DC" vertical={false} />
                    <XAxis dataKey="mes" tick={{ fontSize: 9, fill: '#7B8C88' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: '#A6B0AC' }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}K`} width={44} />
                    <Tooltip formatter={(v: number) => formatBRL(v)} contentStyle={{ fontSize: 11, borderRadius: 8, border: '0.5px solid #E4DCCC' }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="price" stroke="#3D7A6E" strokeWidth={2} dot={false} name="Price (fixo)" />
                    <Line type="monotone" dataKey="sac" stroke="#B0413E" strokeWidth={2} dot={false} name="SAC (decrescente)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Tabela amortização */}
            {tabela.length > 0 && (
              <div style={{ background: '#fff', border: '0.5px solid #E4DCCC', borderRadius: 14, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #E4DCCC', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FBF8F1' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#13201D', fontFamily: "var(--font-sans)" }}>Tabela de amortização — {sistema.toUpperCase()}</div>
                  <span style={{ fontSize: 10, color: '#7B8C88' }}>mostrando {Math.min(24, tabela.length)} de {tabela.length} meses</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 1fr 1fr 1fr', padding: '9px 16px', background: '#FBF8F1', borderBottom: '0.5px solid #E4DCCC' }}>
                  {['Mês', 'Parcela', 'Juros', 'Amortização', 'Saldo'].map(h => (
                    <div key={h} style={{ fontSize: 10, fontWeight: 600, color: '#7B8C88', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</div>
                  ))}
                </div>
                <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                  {tabela.slice(0, 24).map((r, i) => (
                    <div key={r.mes} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 1fr 1fr 1fr', padding: '8px 16px', borderBottom: i < Math.min(24, tabela.length) - 1 ? '0.5px solid #EFE9DC' : 'none', alignItems: 'center' }}>
                      <div style={{ fontSize: 11, color: '#7B8C88', fontFamily: "var(--font-sans)" }}>{r.mes}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#13201D', fontFamily: "var(--font-sans)" }}>{formatBRL(r.parcela)}</div>
                      <div style={{ fontSize: 11, color: '#B0413E', fontFamily: "var(--font-sans)" }}>{formatBRL(r.juros)}</div>
                      <div style={{ fontSize: 11, color: '#3D7A6E', fontFamily: "var(--font-sans)" }}>{formatBRL(r.amortizacao)}</div>
                      <div style={{ fontSize: 11, color: '#7B8C88', fontFamily: "var(--font-sans)" }}>{formatBRL(r.saldo)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CONSÓRCIO */}
      {modo === 'consorcio' && (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 14 }}>
          <div style={{ background: '#fff', border: '0.5px solid #E4DCCC', borderRadius: 14, padding: '16px 18px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#13201D', marginBottom: 14, fontFamily: "var(--font-sans)" }}>Simular consórcio</div>
            {[
              { label: 'Valor do bem (R$)', value: valor, set: setValor },
              { label: 'Taxa administrativa (%)', value: taxaAdm, set: setTaxaAdm, placeholder: '15' },
              { label: 'Prazo (meses)', value: prazo, set: setPrazo },
            ].map(f => (
              <div key={f.label} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 10, fontWeight: 600, color: '#7B8C88', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{f.label}</label>
                <input className="form-input" type="number" value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.placeholder || '0'} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="kpis" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
              <div className="kpi" style={{ borderTop: '3px solid #3D7A6E' }}>
                <div className="kpi-lbl">Parcela mensal</div>
                <div className="kpi-val">{formatBRL(parcelaConsorcio)}</div>
                <div className="kpi-delta">sem juros</div>
              </div>
              <div className="kpi" style={{ borderTop: '3px solid #B08A3E' }}>
                <div className="kpi-lbl">Total pago</div>
                <div className="kpi-val">{formatBRL(totalConsorcio)}</div>
                <div className="kpi-delta warn">inclui taxa adm.</div>
              </div>
              <div className="kpi" style={{ borderTop: `3px solid ${economiaVsFinanc > 0 ? '#3D7A6E' : '#B0413E'}` }}>
                <div className="kpi-lbl">Vs financiamento</div>
                <div className="kpi-val" style={{ color: economiaVsFinanc > 0 ? '#3D7A6E' : '#B0413E' }}>
                  {economiaVsFinanc > 0 ? '-' : '+'}{formatBRL(Math.abs(economiaVsFinanc))}
                </div>
                <div className={`kpi-delta ${economiaVsFinanc > 0 ? 'up' : 'dn'}`}>
                  {economiaVsFinanc > 0 ? '✓ mais barato' : '↑ mais caro'}
                </div>
              </div>
            </div>

            <div style={{ background: '#fff', border: '0.5px solid #E4DCCC', borderRadius: 14, padding: '16px 18px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#13201D', marginBottom: 12, fontFamily: "var(--font-sans)" }}>Pontos importantes sobre consórcio</div>
              {[
                { cor: '#3D7A6E', icon: 'fa-check', texto: 'Sem juros — só taxa de administração (geralmente 10-20% do valor)' },
                { cor: '#3D7A6E', icon: 'fa-check', texto: 'Ideal para quem não tem urgência e quer parcelar com custo baixo' },
                { cor: '#3D7A6E', icon: 'fa-check', texto: 'Pode dar lance para ser contemplado mais rápido (usa FGTS para imóvel)' },
                { cor: '#B08A3E', icon: 'fa-triangle-exclamation', texto: 'Contemplação por sorteio — pode demorar meses ou anos' },
                { cor: '#B08A3E', icon: 'fa-triangle-exclamation', texto: 'Cota varia com reajuste do bem — parcela pode subir' },
                { cor: '#B0413E', icon: 'fa-xmark', texto: 'Multa alta por desistência (até 30% das parcelas pagas)' },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: i < 5 ? '0.5px solid #EFE9DC' : 'none', alignItems: 'flex-start' }}>
                  <i className={`fa-solid ${item.icon}`} style={{ fontSize: 11, color: item.cor, marginTop: 2, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: '#13201D', lineHeight: 1.5 }}>{item.texto}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CAPITAL DE GIRO */}
      {modo === 'credito_giro' && (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 14 }}>
          <div style={{ background: '#fff', border: '0.5px solid #E4DCCC', borderRadius: 14, padding: '16px 18px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#13201D', marginBottom: 14, fontFamily: "var(--font-sans)" }}>Dados da empresa</div>
            {[
              { label: 'Faturamento mensal médio (R$)', value: faturamento, set: setFaturamento },
              { label: 'Taxa de juros (%/mês)', value: taxa, set: setTaxa },
              { label: 'Prazo desejado (meses)', value: prazo, set: setPrazo },
            ].map(f => (
              <div key={f.label} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 10, fontWeight: 600, color: '#7B8C88', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{f.label}</label>
                <input className="form-input" type="number" value={f.value} onChange={e => f.set(e.target.value)} />
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="kpis" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
              <div className="kpi" style={{ borderTop: '3px solid #3D7A6E' }}>
                <div className="kpi-lbl">Limite estimado de giro</div>
                <div className="kpi-val">{formatBRL(limiteGiro)}</div>
                <div className="kpi-delta">30% do faturamento/mês</div>
              </div>
              <div className="kpi" style={{ borderTop: '3px solid #3D6E8E' }}>
                <div className="kpi-lbl">Limite 6 meses</div>
                <div className="kpi-val">{formatBRL(limite6meses)}</div>
                <div className="kpi-delta">base 25% receita bruta</div>
              </div>
              <div className="kpi" style={{ borderTop: '3px solid #B08A3E' }}>
                <div className="kpi-lbl">Custo mensal (juros)</div>
                <div className="kpi-val" style={{ color: '#B08A3E' }}>{formatBRL(limiteGiro * Number(taxa) / 100)}</div>
                <div className="kpi-delta warn">sobre limite de giro</div>
              </div>
            </div>

            <div style={{ background: '#fff', border: '0.5px solid #E4DCCC', borderRadius: 14, padding: '16px 18px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#13201D', marginBottom: 14, fontFamily: "var(--font-sans)" }}>Linhas recomendadas para sua empresa</div>
              {TAXAS_MERCADO.filter(t => t.tipo === 'Empresa').map(linha => (
                <div key={linha.nome} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '0.5px solid #EFE9DC' }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#13201D' }}>{linha.nome}</div>
                    <div style={{ fontSize: 10, color: '#7B8C88' }}>Custo sobre {formatBRL(limiteGiro)}: {formatBRL(limiteGiro * linha.taxa / 100)}/mês</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: linha.taxa > 2 ? '#B08A3E' : '#3D7A6E', fontFamily: "var(--font-sans)" }}>{linha.taxa}%/mês</div>
                    <div style={{ fontSize: 10, color: '#7B8C88' }}>{(linha.taxa * 12).toFixed(1)}% a.a.</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAXAS DO MERCADO */}
      {modo === 'comparativo' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Gráfico comparativo */}
          <div style={{ background: '#fff', border: '0.5px solid #E4DCCC', borderRadius: 14, padding: '16px 18px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#13201D', marginBottom: 4, fontFamily: "var(--font-sans)" }}>Taxas de crédito no mercado (Junho 2026)</div>
            <div style={{ fontSize: 11, color: '#7B8C88', marginBottom: 14 }}>Taxas mensais — quanto menor, melhor. Cartão e cheque especial devem ser evitados.</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={TAXAS_MERCADO} layout="vertical" margin={{ top: 0, right: 60, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EFE9DC" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 9, fill: '#A6B0AC' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                <YAxis type="category" dataKey="nome" tick={{ fontSize: 10, fill: '#13201D' }} axisLine={false} tickLine={false} width={170} />
                <Tooltip formatter={(v: number) => [`${v}%/mês`, 'Taxa']} contentStyle={{ fontSize: 11, borderRadius: 8, border: '0.5px solid #E4DCCC' }} />
                <Bar dataKey="taxa" radius={[0, 4, 4, 0]}
                  label={{ position: 'right', fontSize: 10, fill: '#7B8C88', formatter: (v: number) => `${v}%` }}
                  fill="#3D7A6E"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Estratégias */}
          <div style={{ fontSize: 12, fontWeight: 700, color: '#13201D', fontFamily: "var(--font-sans)" }}>Estratégias para conseguir mais crédito</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
            {ESTRATEGIAS.map(e => (
              <div key={e.titulo} style={{ background: '#fff', border: '0.5px solid #E4DCCC', borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: `${e.cor}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className={`fa-solid ${e.icon}`} style={{ fontSize: 13, color: e.cor }} />
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#13201D', lineHeight: 1.3 }}>{e.titulo}</div>
                </div>
                <div style={{ fontSize: 11, color: '#7B8C88', lineHeight: 1.6 }}>{e.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
