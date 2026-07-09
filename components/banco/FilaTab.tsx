'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatBRL } from '@/lib/currency-brl'
import { CATEGORIAS, type FilaItem, type ConfirmarItem, type ConfirmarResposta } from '@/lib/banco/types'
import toast from 'react-hot-toast'

type Escolha = {
  categoria: string
  usarCadastro: boolean   // vincular ao cadastro sugerido
  criarCadastro: boolean  // criar cadastro novo (chip aceito)
  usarConta: boolean      // vincular/baixar conta prevista sugerida
}

type Props = { token: string; onConfirmado: () => void }

export default function FilaTab({ token, onConfirmado }: Props) {
  const [itens, setItens] = useState<FilaItem[]>([])
  const [escolhas, setEscolhas] = useState<Record<string, Escolha>>({})
  const [erros, setErros] = useState<Record<string, string>>({})
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const auth = useMemo(() => ({ 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }), [token])

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/banco/fila', { headers: auth })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Falha ao carregar a fila')
      const lista = (j.itens ?? []) as FilaItem[]
      setItens(lista)
      setEscolhas(prev => {
        const next = { ...prev }
        for (const it of lista) if (!next[it.extrato_id]) next[it.extrato_id] = {
          categoria: it.sugestao_categoria?.categoria ?? 'Outros',
          usarCadastro: !!it.sugestao_cadastro,
          criarCadastro: false,
          usarConta: !!it.conta_prevista,
        }
        return next
      })
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro') }
    finally { setLoading(false) }
  }, [auth])

  useEffect(() => { void carregar() }, [carregar])

  function montarItem(it: FilaItem): ConfirmarItem {
    const e = escolhas[it.extrato_id]
    const out: ConfirmarItem = { extrato_id: it.extrato_id, categoria: e?.categoria ?? 'Outros' }
    if (e?.usarCadastro && it.sugestao_cadastro) {
      if (it.sugestao_cadastro.tipo === 'fornecedor') out.fornecedor_id = it.sugestao_cadastro.id
      else out.cliente_id = it.sugestao_cadastro.id
    }
    if (e?.criarCadastro && it.sugestao_criar) {
      if (it.sugestao_criar.tipo === 'fornecedor') out.novo_fornecedor = { razao_social: it.sugestao_criar.nome }
      else out.novo_cliente = { nome: it.sugestao_criar.nome }
    }
    if (e?.usarConta && it.conta_prevista) {
      if (it.conta_prevista.tipo === 'pagar') out.conta_pagar_id = it.conta_prevista.id
      else out.conta_receber_id = it.conta_prevista.id
    }
    return out
  }

  async function confirmar(alvos: FilaItem[]) {
    if (alvos.length === 0) return
    setBusy(true)
    try {
      const r = await fetch('/api/banco/confirmar', { method: 'POST', headers: auth, body: JSON.stringify({ itens: alvos.map(montarItem) }) })
      const j = (await r.json()) as ConfirmarResposta & { error?: string }
      if (!r.ok) throw new Error(j.error || 'Falha ao confirmar')
      const okIds = new Set(j.confirmados.map(c => c.extrato_id))
      setItens(prev => prev.filter(i => !okIds.has(i.extrato_id)))
      setSel(new Set())
      setErros(prev => {
        const n = { ...prev }
        for (const id of Array.from(okIds)) delete n[id]
        for (const f of j.falhas) n[f.extrato_id] = f.erro
        return n
      })
      if (j.confirmados.length) toast.success(j.confirmados.length > 1 ? `${j.confirmados.length} confirmadas` : 'Confirmada — já está no caixa e na DRE')
      if (j.falhas.length) toast.error(`${j.falhas.length} não confirmada${j.falhas.length > 1 ? 's' : ''} — veja o motivo na linha`)
      onConfirmado()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro') }
    finally { setBusy(false) }
  }

  function toggleSel(id: string) { setSel(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n }) }
  const selecionados = itens.filter(i => sel.has(i.extrato_id))

  if (loading) return <div style={{ padding: 44, textAlign: 'center', color: 'var(--ink-mut)', fontSize: 15 }}>Carregando fila…</div>

  if (itens.length === 0) return (
    <div className="txs-card" style={{ padding: 44, textAlign: 'center', color: 'var(--ink-mut)', fontSize: 15 }}>
      <i className="fa-solid fa-circle-check" style={{ fontSize: 26, color: 'var(--sage)', display: 'block', marginBottom: 10 }} />
      Fila zerada — toda transação do extrato já está no caixa. 🎉
    </div>
  )

  return (
    <>
      {/* Barra de lote */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: 'var(--sage-tint)', border: '1px solid var(--sage)', borderRadius: 12, marginBottom: 12 }}>
        <i className="fa-solid fa-robot" style={{ color: 'var(--sage-deep)' }} />
        <span style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--sage-deep)' }}>
          {sel.size > 0 ? `${sel.size} selecionada${sel.size > 1 ? 's' : ''}` : `${itens.length} transações prontas — tudo já sugerido, é só confirmar.`}
        </span>
        <button className="btn-action" style={{ fontSize: 14, padding: '7px 16px', marginLeft: 'auto' }} disabled={busy}
          onClick={() => void confirmar(sel.size > 0 ? selecionados : itens)}>
          <i className="fa-solid fa-check-double" style={{ marginRight: 6 }} />
          {sel.size > 0 ? 'Confirmar selecionadas' : 'Confirmar tudo'}
        </button>
        {sel.size > 0 && <button className="btn-ghost" style={{ fontSize: 14 }} onClick={() => setSel(new Set())}>Limpar</button>}
      </div>

      {/* Linhas da fila */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {itens.map(it => {
          const e = escolhas[it.extrato_id]
          const erro = erros[it.extrato_id]
          const ehSaida = it.tipo === 'debito'
          return (
            <div key={it.extrato_id} className="txs-card" style={{ padding: '14px 18px', borderRadius: 16, border: erro ? '1px solid var(--red, #B0413E)' : undefined }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <input type="checkbox" checked={sel.has(it.extrato_id)} onChange={() => toggleSel(it.extrato_id)} style={{ accentColor: 'var(--sage)', marginTop: 4 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span style={{ color: 'var(--ink-mut)', fontWeight: 500, marginRight: 8, fontVariantNumeric: 'tabular-nums' }}>{it.data.slice(8, 10)}/{it.data.slice(5, 7)}</span>
                      {it.descricao}{it.contraparte_nome ? <span style={{ color: 'var(--ink-mut)', fontWeight: 500 }}> — {it.contraparte_nome}</span> : null}
                    </div>
                    <span style={{ fontSize: 15, fontWeight: 700, color: ehSaida ? '#B0413E' : '#3D7A6E', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {ehSaida ? '−' : '+'}{formatBRL(it.valor)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8, alignItems: 'center' }}>
                    {/* Categoria */}
                    <select className="form-input" style={{ width: 'auto', fontSize: 13.5, padding: '6px 10px' }} value={e?.categoria ?? 'Outros'}
                      onChange={ev => setEscolhas(p => ({ ...p, [it.extrato_id]: { ...p[it.extrato_id], categoria: ev.target.value } }))}>
                      {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    {it.sugestao_categoria && (
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: it.sugestao_categoria.fonte === 'aprendido' ? '#B08A3E' : 'var(--sage)' }}>
                        <i className={`fa-solid ${it.sugestao_categoria.fonte === 'aprendido' ? 'fa-graduation-cap' : 'fa-robot'}`} style={{ marginRight: 4 }} />
                        {it.sugestao_categoria.fonte === 'aprendido' ? 'aprendido' : 'ia'}
                      </span>
                    )}

                    {/* Fornecedor/cliente: sugerido OU chip de criar */}
                    {it.sugestao_cadastro && (
                      <button onClick={() => setEscolhas(p => ({ ...p, [it.extrato_id]: { ...p[it.extrato_id], usarCadastro: !p[it.extrato_id].usarCadastro } }))}
                        className="btn-ghost" style={{ fontSize: 12.5, padding: '4px 10px', borderRadius: 20, borderColor: e?.usarCadastro ? 'var(--sage)' : undefined, background: e?.usarCadastro ? 'var(--sage-tint)' : undefined, color: e?.usarCadastro ? 'var(--sage-deep)' : undefined }}>
                        <i className={`fa-solid ${e?.usarCadastro ? 'fa-circle-check' : 'fa-circle'}`} style={{ marginRight: 5, fontSize: 11 }} />
                        {it.sugestao_cadastro.tipo === 'fornecedor' ? 'Fornecedor' : 'Cliente'}: {it.sugestao_cadastro.nome}
                        {it.sugestao_cadastro.match === 'cnpj' && <span style={{ marginLeft: 5, fontWeight: 700 }}>✓ CNPJ</span>}
                      </button>
                    )}
                    {it.sugestao_criar && (
                      <button onClick={() => setEscolhas(p => ({ ...p, [it.extrato_id]: { ...p[it.extrato_id], criarCadastro: !p[it.extrato_id].criarCadastro } }))}
                        className="btn-ghost" style={{ fontSize: 12.5, padding: '4px 10px', borderRadius: 20, borderStyle: 'dashed', borderColor: e?.criarCadastro ? 'var(--sage)' : undefined, background: e?.criarCadastro ? 'var(--sage-tint)' : undefined, color: e?.criarCadastro ? 'var(--sage-deep)' : undefined }}>
                        <i className="fa-solid fa-plus" style={{ marginRight: 5, fontSize: 11 }} />
                        Criar {it.sugestao_criar.tipo} “{it.sugestao_criar.nome}”
                      </button>
                    )}

                    {/* Conta prevista */}
                    {it.conta_prevista && (
                      <button onClick={() => setEscolhas(p => ({ ...p, [it.extrato_id]: { ...p[it.extrato_id], usarConta: !p[it.extrato_id].usarConta } }))}
                        className="btn-ghost" style={{ fontSize: 12.5, padding: '4px 10px', borderRadius: 20, borderColor: e?.usarConta ? 'var(--sage)' : undefined, background: e?.usarConta ? 'var(--sage-tint)' : undefined, color: e?.usarConta ? 'var(--sage-deep)' : undefined }}>
                        <i className={`fa-solid ${e?.usarConta ? 'fa-link' : 'fa-link-slash'}`} style={{ marginRight: 5, fontSize: 11 }} />
                        Casou: {it.conta_prevista.descricao} · venc {it.conta_prevista.data_vencimento.slice(8, 10)}/{it.conta_prevista.data_vencimento.slice(5, 7)}
                        {it.conta_prevista.diffPct > 0 ? ` · Δ${it.conta_prevista.diffPct}%` : ' · Δ0%'}
                      </button>
                    )}

                    <button className="btn-action" style={{ fontSize: 13.5, padding: '6px 14px', marginLeft: 'auto', borderRadius: 20 }} disabled={busy} onClick={() => void confirmar([it])}>
                      <i className="fa-solid fa-check" style={{ marginRight: 5 }} />Confirmar
                    </button>
                  </div>

                  {erro && <div style={{ marginTop: 8, fontSize: 13, color: '#B0413E' }}><i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 6 }} />{erro}</div>}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
