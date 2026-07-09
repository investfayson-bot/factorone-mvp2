// Lógica PURA de sugestão do Banco (sem I/O — testável e reusável).
// Usada por /api/banco/fila e /api/transacoes/sugerir.

const STOP = new Set(['pix', 'ted', 'doc', 'recebido', 'enviado', 'compra', 'pagamento', 'transferencia', 'transferência', 'demo', 'para', 'com', 'sarl'])

// chave = 1º token relevante da descrição (o "estabelecimento"), pra casar histórico
export function chave(desc: string): string {
  const toks = desc.toLowerCase().replace(/\[demo\]/g, '').replace(/[^a-z0-9à-ú ]/gi, ' ').split(/\s+/)
  return toks.find(w => w.length >= 3 && !STOP.has(w)) ?? ''
}

// Aprende do histórico: chave -> categoria mais usada pelo usuário.
export function construirHistorico(rows: { descricao: string; categoria: string | null }[]): Map<string, Map<string, number>> {
  const hist = new Map<string, Map<string, number>>()
  for (const r of rows) {
    if (!r.categoria || !r.categoria.trim()) continue
    const k = chave(r.descricao); if (!k) continue
    if (!hist.has(k)) hist.set(k, new Map())
    const m = hist.get(k)!; m.set(r.categoria, (m.get(r.categoria) || 0) + 1)
  }
  return hist
}

export function melhorDoHistorico(hist: Map<string, Map<string, number>>, desc: string): string | null {
  const k = chave(desc); const m = k ? hist.get(k) : null
  if (!m) return null
  let best = '', n = 0
  for (const [c, ct] of Array.from(m.entries())) if (ct > n) { best = c; n = ct }
  return best || null
}

// ---- Match de contraparte → cadastro (fornecedor/cliente) ----

function normDoc(s: string | null | undefined): string { return (s ?? '').replace(/\D/g, '') }

function normNome(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\b(ltda|me|epp|eireli|sa|s\/a)\b/g, '').replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ').trim()
}

export type Cadastro = { id: string; nome: string; documento: string | null }

/** Ordem: CNPJ/CPF exato → nome exato → nome aproximado (um contém o outro, min 4 chars). */
export function matchContraparte(
  contraparteNome: string | null, contraparteDoc: string | null, cadastros: Cadastro[],
): { id: string; nome: string; match: 'cnpj' | 'nome' } | null {
  const doc = normDoc(contraparteDoc)
  if (doc.length >= 11) {
    const hit = cadastros.find(c => normDoc(c.documento) === doc)
    if (hit) return { id: hit.id, nome: hit.nome, match: 'cnpj' }
  }
  const nome = normNome(contraparteNome)
  if (nome.length >= 4) {
    const exato = cadastros.find(c => normNome(c.nome) === nome)
    if (exato) return { id: exato.id, nome: exato.nome, match: 'nome' }
    const aprox = cadastros.find(c => {
      const n = normNome(c.nome)
      return n.length >= 4 && (n.includes(nome) || nome.includes(n))
    })
    if (aprox) return { id: aprox.id, nome: aprox.nome, match: 'nome' }
  }
  return null
}

// ---- Match de conta prevista (mesma heurística da tela de conciliação antiga) ----

export type ContaPrevista = { id: string; descricao: string; valor: number; data_vencimento: string }

function score(valorTx: number, dataTx: string, ref: ContaPrevista): number {
  const diff = Math.abs(valorTx - ref.valor) / Math.max(ref.valor, 1)
  const dias = Math.abs(new Date(dataTx).getTime() - new Date(ref.data_vencimento).getTime()) / 86400000
  if (diff > 0.15 || dias > 10) return 0
  return (1 - diff) * 0.7 + (1 - dias / 10) * 0.3
}

/** Melhor candidata com score > 0.5; `usadas` evita a mesma conta em 2 itens da fila. */
export function matchContaPrevista(
  valorTx: number, dataTx: string, contas: ContaPrevista[], usadas: Set<string>,
): { conta: ContaPrevista; diffPct: number } | null {
  let best: ContaPrevista | null = null, bestScore = 0
  for (const c of contas) {
    if (usadas.has(c.id)) continue
    const s = score(valorTx, dataTx, c)
    if (s > bestScore) { bestScore = s; best = c }
  }
  if (!best || bestScore <= 0.5) return null
  usadas.add(best.id)
  return { conta: best, diffPct: Math.round(Math.abs(valorTx - best.valor) / Math.max(best.valor, 1) * 100) }
}
