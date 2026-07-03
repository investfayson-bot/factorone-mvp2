'use client'
import { useMemo, useState } from 'react'
import { formatBRL } from '@/lib/currency-brl'

/**
 * Classificar — caixa ÚNICA estilo QuickBooks ("Banking → For review").
 * Banco + cartão num lugar só. Cada transação: categoria sugerida pela IA →
 * você confirma (1 clique) ou troca → vai pra "Classificadas". Em lote também.
 * Dados FAKE (self-contained) para testar o fluxo agora.
 */

type Origem = 'banco' | 'cartao'
type Tx = {
  id: string
  data: string
  desc: string
  origem: Origem
  ultimos4?: string
  valor: number            // + entra, − sai
  sugestao: string         // categoria sugerida pela IA
  categoria: string | null // null = a revisar
  recibo?: boolean         // recibo casado (1 classificação só)
}

const CATEGORIAS = [
  'Alimentação', 'Transporte / Combustível', 'Software / SaaS', 'Marketing',
  'Fornecedores', 'Impostos', 'Salários', 'Aluguel', 'Serviços',
  'Receita de vendas', 'Tarifas bancárias', 'Outros',
]

const SEED: Tx[] = [
  { id: 't1', data: '2026-07-02', desc: 'iFood *Comida Japonesa', origem: 'cartao', ultimos4: '4417', valor: -184.90, sugestao: 'Alimentação', categoria: null, recibo: true },
  { id: 't2', data: '2026-07-02', desc: 'Posto Shell BR-101', origem: 'cartao', ultimos4: '4417', valor: -312.00, sugestao: 'Transporte / Combustível', categoria: null },
  { id: 't3', data: '2026-07-01', desc: 'AWS EMEA SARL', origem: 'cartao', ultimos4: '4417', valor: -742.15, sugestao: 'Software / SaaS', categoria: null },
  { id: 't4', data: '2026-07-01', desc: 'PIX RECEBIDO — Cliente ACME Ltda', origem: 'banco', valor: 12500.00, sugestao: 'Receita de vendas', categoria: null },
  { id: 't5', data: '2026-06-30', desc: 'Meta Ads (Facebook)', origem: 'cartao', ultimos4: '4417', valor: -1200.00, sugestao: 'Marketing', categoria: null },
  { id: 't6', data: '2026-06-30', desc: 'Tarifa pacote mensal', origem: 'banco', valor: -49.90, sugestao: 'Tarifas bancárias', categoria: null },
  { id: 't7', data: '2026-06-29', desc: 'TED — Fornecedor Aço Forte', origem: 'banco', valor: -3800.00, sugestao: 'Fornecedores', categoria: null, recibo: true },
  { id: 't8', data: '2026-06-28', desc: 'Uber *Trip', origem: 'cartao', ultimos4: '4417', valor: -37.40, sugestao: 'Transporte / Combustível', categoria: null },
  // já classificadas (exemplo)
  { id: 't9', data: '2026-06-27', desc: 'DARF — Simples Nacional', origem: 'banco', valor: -2140.00, sugestao: 'Impostos', categoria: 'Impostos' },
  { id: 't10', data: '2026-06-26', desc: 'Aluguel Sala Comercial', origem: 'banco', valor: -4500.00, sugestao: 'Aluguel', categoria: 'Aluguel' },
  { id: 't11', data: '2026-06-25', desc: 'PIX RECEBIDO — Cliente Beta SA', origem: 'banco', valor: 8300.00, sugestao: 'Receita de vendas', categoria: 'Receita de vendas' },
]

const OUT = '#B0413E'
const IN = '#3D7A6E'

export default function ClassificarPage() {
  const [txs, setTxs] = useState<Tx[]>(SEED)
  const [aba, setAba] = useState<'revisar' | 'classificadas'>('revisar')
  const [sel, setSel] = useState<Set<string>>(new Set())

  const revisar = useMemo(() => txs.filter(t => t.categoria === null), [txs])
  const classificadas = useMemo(() => txs.filter(t => t.categoria !== null), [txs])
  const lista = aba === 'revisar' ? revisar : classificadas

  function setCategoria(id: string, cat: string) {
    setTxs(prev => prev.map(t => t.id === id ? { ...t, sugestao: cat } : t))
  }
  function confirmar(id: string) {
    setTxs(prev => prev.map(t => t.id === id ? { ...t, categoria: t.sugestao } : t))
    setSel(prev => { const n = new Set(prev); n.delete(id); return n })
  }
  function desfazer(id: string) {
    setTxs(prev => prev.map(t => t.id === id ? { ...t, categoria: null } : t))
  }
  function confirmarLote() {
    setTxs(prev => prev.map(t => sel.has(t.id) ? { ...t, categoria: t.sugestao } : t))
    setSel(new Set())
  }
  function toggleSel(id: string) {
    setSel(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }
  function toggleTodos() {
    if (sel.size === revisar.length) setSel(new Set())
    else setSel(new Set(revisar.map(t => t.id)))
  }

  return (
    <>
      <div className="page-hdr">
        <div>
          <div className="page-title">Classificar</div>
          <div className="page-sub">Caixa única — banco e cartão num lugar só. A IA sugere, você confirma.</div>
        </div>
        <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => { setTxs(SEED); setSel(new Set()) }}>
          <i className="fa-solid fa-rotate" style={{ marginRight: 6 }} />Recarregar exemplos
        </button>
      </div>

      {/* Resumo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
        {[
          { lbl: 'A revisar', val: String(revisar.length), cor: OUT, ic: 'fa-inbox' },
          { lbl: 'Classificadas', val: String(classificadas.length), cor: IN, ic: 'fa-circle-check' },
          { lbl: 'A pagar (saídas a revisar)', val: formatBRL(revisar.filter(t => t.valor < 0).reduce((s, t) => s + Math.abs(t.valor), 0)), cor: 'var(--navy)', ic: 'fa-money-bill-wave' },
        ].map(k => (
          <div key={k.lbl} className="kpi" style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink-mut)', textTransform: 'uppercase', letterSpacing: '.08em' }}>{k.lbl}</span>
              <i className={`fa-solid ${k.ic}`} style={{ fontSize: 12, color: k.cor }} />
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: k.cor, marginTop: 8, fontVariantNumeric: 'tabular-nums' }}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* Abas */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {([['revisar', `A revisar (${revisar.length})`], ['classificadas', `Classificadas (${classificadas.length})`]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setAba(k)} style={{
            fontSize: 12.5, fontWeight: aba === k ? 700 : 500, padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
            border: `1px solid ${aba === k ? 'var(--sage)' : 'var(--line)'}`,
            background: aba === k ? 'var(--sage-tint)' : 'var(--surface)', color: aba === k ? 'var(--sage-deep)' : 'var(--ink-mut)',
          }}>{label}</button>
        ))}
      </div>

      {/* Barra de lote */}
      {aba === 'revisar' && sel.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: 'var(--sage-tint)', border: '1px solid var(--sage)', borderRadius: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--sage-deep)' }}>{sel.size} selecionada{sel.size > 1 ? 's' : ''}</span>
          <button className="btn-action" style={{ fontSize: 12, padding: '7px 16px', marginLeft: 'auto' }} onClick={confirmarLote}>
            <i className="fa-solid fa-check" style={{ marginRight: 6 }} />Confirmar em lote
          </button>
          <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setSel(new Set())}>Limpar</button>
        </div>
      )}

      {/* Tabela */}
      <div className="txs-card">
        {/* Cabeçalho */}
        <div style={{ display: 'grid', gridTemplateColumns: aba === 'revisar' ? '30px 74px 1fr 130px 230px 110px' : '74px 1fr 130px 230px 90px', gap: 12, padding: '11px 18px', borderBottom: '1px solid var(--line)', background: 'var(--surface-2)', fontSize: 10, fontWeight: 600, color: 'var(--ink-mut)', textTransform: 'uppercase', letterSpacing: '.08em' }}>
          {aba === 'revisar' && <input type="checkbox" checked={sel.size === revisar.length && revisar.length > 0} onChange={toggleTodos} style={{ accentColor: 'var(--sage)' }} />}
          <span>Data</span><span>Descrição</span><span style={{ textAlign: 'right' }}>Valor</span><span>Categoria</span><span />
        </div>

        {lista.length === 0 ? (
          <div style={{ padding: 44, textAlign: 'center', color: 'var(--ink-mut)', fontSize: 13 }}>
            <i className="fa-solid fa-circle-check" style={{ fontSize: 26, color: 'var(--sage)', display: 'block', marginBottom: 10 }} />
            {aba === 'revisar' ? 'Tudo classificado! 🎉' : 'Nada classificado ainda.'}
          </div>
        ) : lista.map((t, i) => (
          <div key={t.id} style={{ display: 'grid', gridTemplateColumns: aba === 'revisar' ? '30px 74px 1fr 130px 230px 110px' : '74px 1fr 130px 230px 90px', gap: 12, padding: '12px 18px', borderBottom: i < lista.length - 1 ? '1px solid var(--line-soft)' : 'none', alignItems: 'center' }}>
            {aba === 'revisar' && <input type="checkbox" checked={sel.has(t.id)} onChange={() => toggleSel(t.id)} style={{ accentColor: 'var(--sage)' }} />}
            <span style={{ fontSize: 12, color: 'var(--ink-mut)', fontVariantNumeric: 'tabular-nums' }}>{t.data.slice(8, 10)}/{t.data.slice(5, 7)}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.desc}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 9.5, fontWeight: 600, color: t.origem === 'cartao' ? '#7A6A9E' : 'var(--sage-deep)', background: t.origem === 'cartao' ? '#ECE7F2' : 'var(--sage-tint)', padding: '2px 7px', borderRadius: 20 }}>
                  <i className={`fa-solid ${t.origem === 'cartao' ? 'fa-credit-card' : 'fa-building-columns'}`} style={{ fontSize: 9 }} />
                  {t.origem === 'cartao' ? `Cartão ••${t.ultimos4}` : 'Banco'}
                </span>
                {t.recibo && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 9.5, fontWeight: 600, color: 'var(--gold)', background: 'var(--gold-tint)', padding: '2px 7px', borderRadius: 20 }}>
                    <i className="fa-solid fa-paperclip" style={{ fontSize: 9 }} />Recibo casado
                  </span>
                )}
              </div>
            </div>
            <span style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: t.valor >= 0 ? IN : OUT, fontVariantNumeric: 'tabular-nums' }}>
              {t.valor >= 0 ? '+' : '−'}{formatBRL(Math.abs(t.valor))}
            </span>
            {aba === 'revisar' ? (
              <select className="form-input" value={t.sugestao} onChange={e => setCategoria(t.id, e.target.value)} style={{ fontSize: 12, padding: '7px 10px' }}>
                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            ) : (
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--sage-deep)', background: 'var(--sage-tint)', padding: '5px 10px', borderRadius: 8, justifySelf: 'start' }}>
                <i className="fa-solid fa-tag" style={{ marginRight: 6, fontSize: 10 }} />{t.categoria}
              </span>
            )}
            {aba === 'revisar' ? (
              <button className="btn-action" style={{ fontSize: 12, padding: '7px 0' }} onClick={() => confirmar(t.id)}>
                <i className="fa-solid fa-check" style={{ marginRight: 5 }} />Confirmar
              </button>
            ) : (
              <button className="btn-ghost" style={{ fontSize: 11, padding: '6px 10px' }} onClick={() => desfazer(t.id)}>Desfazer</button>
            )}
          </div>
        ))}
      </div>

      <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 12, lineHeight: 1.6 }}>
        <i className="fa-solid fa-wand-magic-sparkles" style={{ color: 'var(--sage)', marginRight: 6 }} />
        A categoria já vem sugerida pela IA — é só confirmar. Quando um recibo tem o mesmo valor/data de uma compra do cartão, ele <b>casa automaticamente</b> (você classifica uma vez só). Ao confirmar, vira lançamento contábil sozinho.
      </div>
    </>
  )
}
