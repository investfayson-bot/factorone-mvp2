# Banco Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir as 3 telas do fluxo bancário (conta-pj, conciliação, classificar) por um dashboard único `/dashboard/banco` onde cada transação do extrato é confirmada com um clique — conciliada + categorizada + vinculada a fornecedor/cliente + baixando conta prevista, atomicamente no servidor.

**Architecture:** Página nova com 4 abas (Visão geral · Fila · Extrato · Resumo) sobre `extrato_bancario`. Dois endpoints novos: `GET /api/banco/fila` (monta a fila com sugestões de categoria/fornecedor/conta prevista) e `POST /api/banco/confirmar` (lote atômico por item). Migration adiciona 4 FKs nullable em `transacoes`. Spec: `docs/superpowers/specs/2026-07-08-banco-module-design.md`.

**Tech Stack:** Next.js 16 (App Router), Supabase (RLS por `empresa_id`), padrão de auth `getSupabaseUser` (Bearer token), IA de categorização existente (`lib/categorizar-ia.ts`).

**⚠️ Sem test runner:** este projeto não tem testes automatizados (package.json: só dev/build/start/lint). Verificação por task = `npx tsc --noEmit` + exercício real do fluxo (convenção do projeto — agente `qa-verificador`). Não introduzir framework de teste neste plano.

**Convenções obrigatórias do repo:**
- API routes: `getSupabaseUser(req)` de `@/lib/supabase-route`, retorna 401 se `!user`; `empresa_id` SEMPRE resolvido no servidor via `usuarios.empresa_id` (nunca confiar no client).
- Client: token via `supabase.auth.getSession()` → header `Authorization: Bearer`.
- UI: classes CSS globais existentes (`page-hdr`, `kpi`, `txs-card`, `btn-action`, `btn-ghost`, `form-input`, `bank-cards`, `tag`), inline styles com CSS vars (`var(--sage)`, `var(--ink)`, etc.), FontAwesome.
- Antes do commit final: rodar agentes `factorone-reviewer` e `revisor-financeiro`.

---

## File Structure

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `supabase/migrations/20260710000000_banco_module.sql` | Criar | 4 FKs nullable + índices em `transacoes` |
| `lib/banco/types.ts` | Criar | Tipos compartilhados (FilaItem, ConfirmarItem) + CATEGORIAS |
| `lib/banco/sugestoes.ts` | Criar | Lógica pura de matching: histórico de categoria, contraparte→cadastro, conta prevista |
| `app/api/transacoes/sugerir/route.ts` | Modificar | Importar helpers de `lib/banco/sugestoes.ts` (DRY, remove cópia local) |
| `app/api/banco/fila/route.ts` | Criar | GET — fila com sugestões |
| `app/api/banco/confirmar/route.ts` | Criar | POST — confirmação atômica em lote |
| `components/banco/BancoHeader.tsx` | Criar | Header estilo banco (saldo/contas), extraído do conta-pj |
| `components/banco/FilaTab.tsx` | Criar | Aba Fila (o coração) |
| `components/banco/ExtratoTab.tsx` | Criar | Aba Extrato |
| `components/banco/ResumoTab.tsx` | Criar | Aba Resumo (categoria + fornecedor/cliente) |
| `components/banco/VisaoGeralTab.tsx` | Criar | Aba Visão geral (KPIs + alertas) |
| `app/dashboard/banco/page.tsx` | Criar | Shell: header + abas + `?aba=` |
| `app/dashboard/layout.tsx` | Modificar | Banco vira grupo Core (sempre visível), remove Conciliação de Contabilidade |
| `lib/marketplace.ts` | Modificar | Remove entry `banco` de MARKET_APPS |
| `app/dashboard/conta-pj/page.tsx` | Substituir | redirect → /dashboard/banco |
| `app/dashboard/conciliacao/page.tsx` | Substituir | redirect → /dashboard/banco?aba=fila |
| `app/dashboard/classificar/page.tsx` | Substituir | redirect → /dashboard/banco?aba=fila |

---

### Task 1: Migration — FKs de classificação em `transacoes`

**Files:**
- Create: `supabase/migrations/20260710000000_banco_module.sql`

- [ ] **Step 1: Criar a migration**

```sql
-- Banco module: vínculo de transação com cadastro real e lançamento previsto.
-- Spec: docs/superpowers/specs/2026-07-08-banco-module-design.md
-- Todas nullable: nenhuma linha existente quebra.

ALTER TABLE public.transacoes
  ADD COLUMN IF NOT EXISTS fornecedor_id   uuid REFERENCES public.fornecedores(id)   ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cliente_id      uuid REFERENCES public.clientes(id)       ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS conta_pagar_id  uuid REFERENCES public.contas_pagar(id)   ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS conta_receber_id uuid REFERENCES public.contas_receber(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transacoes_fornecedor_id    ON public.transacoes(fornecedor_id)    WHERE fornecedor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transacoes_cliente_id       ON public.transacoes(cliente_id)       WHERE cliente_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transacoes_conta_pagar_id   ON public.transacoes(conta_pagar_id)   WHERE conta_pagar_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transacoes_conta_receber_id ON public.transacoes(conta_receber_id) WHERE conta_receber_id IS NOT NULL;
```

- [ ] **Step 2: Aplicar no Supabase**

Aplicar via SQL Editor do projeto Supabase (padrão deste repo) ou `npx supabase db push` se o CLI estiver linkado. Verificar com:

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'transacoes' AND column_name IN ('fornecedor_id','cliente_id','conta_pagar_id','conta_receber_id');
```
Expected: 4 linhas.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260710000000_banco_module.sql
git commit -m "feat(banco): FKs fornecedor/cliente/conta prevista em transacoes"
```

---

### Task 2: `lib/banco` — tipos e lógica pura de sugestão

**Files:**
- Create: `lib/banco/types.ts`
- Create: `lib/banco/sugestoes.ts`
- Modify: `app/api/transacoes/sugerir/route.ts` (importar helpers, apagar cópia local)

- [ ] **Step 1: Criar `lib/banco/types.ts`**

```ts
// Tipos compartilhados do Banco module (fila, confirmação, categorias).

export const CATEGORIAS = [
  'Alimentação', 'Transporte / Combustível', 'Software / SaaS', 'Marketing',
  'Fornecedores', 'Impostos', 'Salários', 'Aluguel', 'Serviços',
  'Receita de vendas', 'Tarifas bancárias', 'Outros',
] as const

export type FilaItem = {
  extrato_id: string
  data: string                       // ISO date
  descricao: string
  tipo: 'credito' | 'debito'
  valor: number
  contraparte_nome: string | null
  contraparte_documento: string | null
  sugestao_categoria: { categoria: string; fonte: 'aprendido' | 'ia' } | null
  // contraparte casou com cadastro existente (débito→fornecedor, crédito→cliente)
  sugestao_cadastro: { tipo: 'fornecedor' | 'cliente'; id: string; nome: string; match: 'cnpj' | 'nome' } | null
  // contraparte NÃO casou → UI oferece criar (só grava no confirmar)
  sugestao_criar: { tipo: 'fornecedor' | 'cliente'; nome: string } | null
  conta_prevista: {
    tipo: 'pagar' | 'receber'; id: string; descricao: string
    valor: number; data_vencimento: string; diffPct: number
  } | null
}

export type ConfirmarItem = {
  extrato_id: string
  categoria: string
  fornecedor_id?: string
  cliente_id?: string
  novo_fornecedor?: { razao_social: string }
  novo_cliente?: { nome: string }
  conta_pagar_id?: string
  conta_receber_id?: string
}

export type ConfirmarResposta = {
  confirmados: { extrato_id: string; transacao_id: string; ja_conciliado?: boolean }[]
  falhas: { extrato_id: string; erro: string }[]
}
```

- [ ] **Step 2: Criar `lib/banco/sugestoes.ts`**

```ts
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
```

- [ ] **Step 3: Refatorar `app/api/transacoes/sugerir/route.ts` (DRY)**

Substituir o arquivo inteiro por (mesmo comportamento, helpers importados):

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'
import { categorizarLoteIA } from '@/lib/categorizar-ia'
import { registrarAcaoAgente } from '@/lib/agentes-log'
import { construirHistorico, melhorDoHistorico } from '@/lib/banco/sugestoes'
import { CATEGORIAS } from '@/lib/banco/types'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = (u?.empresa_id as string) ?? user.id

  const { data } = await supabase.from('transacoes').select('id,descricao,categoria').eq('empresa_id', empresaId).limit(500)
  const rows = (data ?? []) as { id: string; descricao: string; categoria: string | null }[]
  const pend = rows.filter(r => !r.categoria || r.categoria.trim() === '')
  if (pend.length === 0) return NextResponse.json({ sugestoes: {} })

  const hist = construirHistorico(rows)

  const sugestoes: Record<string, { categoria: string; fonte: 'aprendido' | 'ia' }> = {}
  const paraIA: { id: string; texto: string }[] = []
  for (const r of pend) {
    const ap = melhorDoHistorico(hist, r.descricao)
    if (ap) sugestoes[r.id] = { categoria: ap, fonte: 'aprendido' }
    else paraIA.push({ id: r.id, texto: r.descricao.replace(/\[demo\]/g, '').trim() })
  }
  if (paraIA.length) {
    const mapa = await categorizarLoteIA(paraIA, [...CATEGORIAS])
    for (const [id, cat] of Object.entries(mapa)) sugestoes[id] = { categoria: cat, fonte: 'ia' }
  }
  const nSugeridas = Object.keys(sugestoes).length
  if (nSugeridas > 0) {
    void registrarAcaoAgente(supabase, empresaId, 'louis', `Sugeriu categoria para ${nSugeridas} transaç${nSugeridas === 1 ? 'ão' : 'ões'}`, {
      detalhe: `${paraIA.length} via IA · ${nSugeridas - paraIA.length} aprendidas do histórico`,
    })
  }
  return NextResponse.json({ sugestoes })
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros novos (erros pré-existentes de outros arquivos, se houver, não contam).

- [ ] **Step 5: Commit**

```bash
git add lib/banco/types.ts lib/banco/sugestoes.ts app/api/transacoes/sugerir/route.ts
git commit -m "feat(banco): lib de sugestões (histórico, contraparte, conta prevista) + DRY no sugerir"
```

---

### Task 3: `GET /api/banco/fila`

**Files:**
- Create: `app/api/banco/fila/route.ts`

- [ ] **Step 1: Criar a rota**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'
import { categorizarLoteIA } from '@/lib/categorizar-ia'
import { construirHistorico, melhorDoHistorico, matchContraparte, matchContaPrevista, type Cadastro, type ContaPrevista } from '@/lib/banco/sugestoes'
import { CATEGORIAS, type FilaItem } from '@/lib/banco/types'

export const runtime = 'nodejs'

/**
 * Monta a fila do Banco: itens não conciliados do extrato, cada um com
 * sugestão de categoria (histórico → IA), fornecedor/cliente (CNPJ → nome)
 * e conta a pagar/receber candidata (valor+data, score > 0.5).
 */
export async function GET(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = (u?.empresa_id as string) ?? user.id

  const [exR, txR, fornR, cliR, pgR, rcR] = await Promise.all([
    supabase.from('extrato_bancario')
      .select('id,descricao,valor,tipo,data_transacao,contraparte_nome,contraparte_documento')
      .eq('empresa_id', empresaId).eq('conciliado', false)
      .order('data_transacao', { ascending: false }).limit(100),
    supabase.from('transacoes').select('descricao,categoria').eq('empresa_id', empresaId).limit(500),
    supabase.from('fornecedores').select('id,razao_social,nome_fantasia,cnpj').eq('empresa_id', empresaId),
    supabase.from('clientes').select('id,nome,cnpj_cpf').eq('empresa_id', empresaId),
    supabase.from('contas_pagar').select('id,descricao,valor,data_vencimento').eq('empresa_id', empresaId).in('status', ['pendente', 'vencida']),
    supabase.from('contas_receber').select('id,descricao,valor,data_vencimento').eq('empresa_id', empresaId).in('status', ['pendente', 'vencida', 'parcialmente_recebida']),
  ])

  const extrato = exR.data ?? []
  const hist = construirHistorico((txR.data ?? []) as { descricao: string; categoria: string | null }[])
  const fornecedores: Cadastro[] = (fornR.data ?? []).map(f => ({ id: f.id, nome: f.nome_fantasia || f.razao_social, documento: f.cnpj }))
  const clientes: Cadastro[] = (cliR.data ?? []).map(c => ({ id: c.id, nome: c.nome, documento: c.cnpj_cpf }))
  const pagar = (pgR.data ?? []).map(p => ({ ...p, valor: Number(p.valor) })) as ContaPrevista[]
  const receber = (rcR.data ?? []).map(r => ({ ...r, valor: Number(r.valor) })) as ContaPrevista[]

  const usadasPagar = new Set<string>(), usadasReceber = new Set<string>()
  const itens: FilaItem[] = []
  const paraIA: { id: string; texto: string }[] = []

  for (const e of extrato) {
    const data = String(e.data_transacao).slice(0, 10)
    const ehSaida = e.tipo === 'debito'
    const cadastros = ehSaida ? fornecedores : clientes
    const cad = matchContraparte(e.contraparte_nome, e.contraparte_documento, cadastros)
    const conta = matchContaPrevista(Number(e.valor), data, ehSaida ? pagar : receber, ehSaida ? usadasPagar : usadasReceber)
    const ap = melhorDoHistorico(hist, e.descricao)
    if (!ap) paraIA.push({ id: e.id, texto: `${e.descricao} ${e.contraparte_nome ?? ''}`.trim() })

    itens.push({
      extrato_id: e.id, data, descricao: e.descricao, tipo: e.tipo, valor: Number(e.valor),
      contraparte_nome: e.contraparte_nome, contraparte_documento: e.contraparte_documento,
      sugestao_categoria: ap ? { categoria: ap, fonte: 'aprendido' } : null,
      sugestao_cadastro: cad ? { tipo: ehSaida ? 'fornecedor' : 'cliente', ...cad } : null,
      sugestao_criar: !cad && e.contraparte_nome && e.contraparte_nome.trim().length >= 4
        ? { tipo: ehSaida ? 'fornecedor' : 'cliente', nome: e.contraparte_nome.trim() } : null,
      conta_prevista: conta
        ? { tipo: ehSaida ? 'pagar' : 'receber', id: conta.conta.id, descricao: conta.conta.descricao, valor: conta.conta.valor, data_vencimento: conta.conta.data_vencimento, diffPct: conta.diffPct }
        : null,
    })
  }

  if (paraIA.length) {
    const mapa = await categorizarLoteIA(paraIA, [...CATEGORIAS])
    for (const item of itens) {
      const cat = mapa[item.extrato_id]
      if (!item.sugestao_categoria && cat) item.sugestao_categoria = { categoria: cat, fonte: 'ia' }
    }
  }

  return NextResponse.json({ itens })
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit` — Expected: sem erros novos.

- [ ] **Step 3: Verificar manualmente**

Com `npm run dev` rodando e logado no app, no console do browser:

```js
const { data: { session } } = await window.supabase?.auth.getSession?.() ?? {};
// alternativa: copiar o token do localStorage (sb-*-auth-token)
fetch('/api/banco/fila', { headers: { Authorization: `Bearer ${TOKEN}` } }).then(r => r.json()).then(console.log)
```
Expected: `{ itens: [...] }` com sugestões preenchidas (ou `itens: []` se extrato vazio — usar "Dados de teste" do classificar antigo pra semear antes da Task 11 remover a tela).

- [ ] **Step 4: Commit**

```bash
git add app/api/banco/fila/route.ts
git commit -m "feat(banco): GET /api/banco/fila com sugestões de categoria, cadastro e conta prevista"
```

---

### Task 4: `POST /api/banco/confirmar`

**Files:**
- Create: `app/api/banco/confirmar/route.ts`

- [ ] **Step 1: Criar a rota**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'
import type { ConfirmarItem, ConfirmarResposta } from '@/lib/banco/types'

export const runtime = 'nodejs'

/**
 * Confirma itens da fila do Banco em lote. Por item, atomicamente do ponto de
 * vista do usuário: concilia extrato → cria transação já classificada
 * (categoria + fornecedor/cliente + vínculo) → baixa conta prevista.
 * Item que falha entra em `falhas` sem derrubar o lote.
 */
export async function POST(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = (u?.empresa_id as string) ?? user.id

  const body = (await req.json().catch(() => null)) as { itens?: ConfirmarItem[] } | null
  const itens = body?.itens
  if (!Array.isArray(itens) || itens.length === 0 || itens.length > 100) {
    return NextResponse.json({ error: 'itens deve ser uma lista de 1 a 100' }, { status: 400 })
  }

  const resp: ConfirmarResposta = { confirmados: [], falhas: [] }

  for (const item of itens) {
    try {
      if (!item.extrato_id || !item.categoria?.trim()) throw new Error('extrato_id e categoria obrigatórios')

      // 1. IDOR: extrato precisa ser da empresa da sessão. 2. Idempotência.
      const { data: ex } = await supabase.from('extrato_bancario').select('*').eq('id', item.extrato_id).eq('empresa_id', empresaId).maybeSingle()
      if (!ex) throw new Error('Extrato não encontrado')
      if (ex.conciliado) {
        resp.confirmados.push({ extrato_id: item.extrato_id, transacao_id: ex.transaction_id ?? '', ja_conciliado: true })
        continue
      }

      const ehSaida = ex.tipo === 'debito'

      // 3. Cadastro novo (só com confirmação do usuário; dedup por CNPJ da contraparte)
      let fornecedorId = item.fornecedor_id ?? null
      let clienteId = item.cliente_id ?? null
      const docCp = String(ex.contraparte_documento ?? '').replace(/\D/g, '')
      if (item.novo_fornecedor?.razao_social?.trim()) {
        if (docCp.length >= 11) {
          const { data: dup } = await supabase.from('fornecedores').select('id').eq('empresa_id', empresaId).eq('cnpj', docCp).maybeSingle()
          if (dup) fornecedorId = dup.id
        }
        if (!fornecedorId) {
          const { data: novo, error: e1 } = await supabase.from('fornecedores')
            .insert({ empresa_id: empresaId, razao_social: item.novo_fornecedor.razao_social.trim(), cnpj: docCp || null })
            .select('id').single()
          if (e1) throw new Error(`Criar fornecedor: ${e1.message}`)
          fornecedorId = novo.id
        }
      }
      if (item.novo_cliente?.nome?.trim()) {
        if (docCp.length >= 11) {
          const { data: dup } = await supabase.from('clientes').select('id').eq('empresa_id', empresaId).eq('cnpj_cpf', docCp).maybeSingle()
          if (dup) clienteId = dup.id
        }
        if (!clienteId) {
          const { data: novo, error: e2 } = await supabase.from('clientes')
            .insert({ empresa_id: empresaId, nome: item.novo_cliente.nome.trim(), cnpj_cpf: docCp || null, status: 'ativo' })
            .select('id').single()
          if (e2) throw new Error(`Criar cliente: ${e2.message}`)
          clienteId = novo.id
        }
      }

      // 4. Valida vínculo de conta prevista (também da empresa — IDOR)
      if (item.conta_pagar_id) {
        const { data: cp } = await supabase.from('contas_pagar').select('id').eq('id', item.conta_pagar_id).eq('empresa_id', empresaId).maybeSingle()
        if (!cp) throw new Error('Conta a pagar não encontrada')
      }
      if (item.conta_receber_id) {
        const { data: cr } = await supabase.from('contas_receber').select('id').eq('id', item.conta_receber_id).eq('empresa_id', empresaId).maybeSingle()
        if (!cr) throw new Error('Conta a receber não encontrada')
      }

      // 5. Cria a transação COMPLETA (nunca existe conciliada-sem-categoria)
      const dataTx = String(ex.data_transacao ?? '').slice(0, 10) || new Date().toISOString().slice(0, 10)
      const { data: tx, error: eTx } = await supabase.from('transacoes').insert({
        empresa_id: empresaId,
        descricao: ex.descricao ?? 'Lançamento bancário',
        categoria: item.categoria.trim(),
        tipo: ehSaida ? 'saida' : 'entrada',
        valor: Number(ex.valor ?? 0),
        status: 'pago',
        data: dataTx,
        fornecedor_id: ehSaida ? fornecedorId : null,
        cliente_id: ehSaida ? null : clienteId,
        conta_pagar_id: item.conta_pagar_id ?? null,
        conta_receber_id: item.conta_receber_id ?? null,
      }).select('id').single()
      if (eTx) throw new Error(eTx.message)

      // 6. Marca extrato conciliado
      await supabase.from('extrato_bancario').update({ conciliado: true, transaction_id: tx.id }).eq('id', item.extrato_id)

      // 7. Baixa a conta prevista (status reais do schema: 'paga' / 'recebida')
      if (item.conta_pagar_id) {
        await supabase.from('contas_pagar')
          .update({ status: 'paga', valor_pago: Number(ex.valor ?? 0), data_pagamento: dataTx })
          .eq('id', item.conta_pagar_id).eq('empresa_id', empresaId)
      }
      if (item.conta_receber_id) {
        await supabase.from('contas_receber')
          .update({ status: 'recebida', valor_recebido: Number(ex.valor ?? 0), data_recebimento: dataTx })
          .eq('id', item.conta_receber_id).eq('empresa_id', empresaId)
      }

      resp.confirmados.push({ extrato_id: item.extrato_id, transacao_id: tx.id })
    } catch (e: unknown) {
      resp.falhas.push({ extrato_id: item.extrato_id ?? '?', erro: e instanceof Error ? e.message : 'Erro interno' })
    }
  }

  return NextResponse.json(resp)
}
```

- [ ] **Step 2: Typecheck** — `npx tsc --noEmit`, sem erros novos.

- [ ] **Step 3: Verificar manualmente**

Com um item da fila (Task 3, Step 3), POST:

```js
fetch('/api/banco/confirmar', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
  body: JSON.stringify({ itens: [{ extrato_id: 'ID_DA_FILA', categoria: 'Fornecedores' }] }) }).then(r => r.json()).then(console.log)
```
Expected: `{ confirmados: [{ extrato_id, transacao_id }], falhas: [] }`. Repetir o mesmo POST → `ja_conciliado: true` (idempotência). No Supabase, a transação existe com categoria e o extrato está `conciliado = true`.

- [ ] **Step 4: Commit**

```bash
git add app/api/banco/confirmar/route.ts
git commit -m "feat(banco): POST /api/banco/confirmar — concilia+classifica+baixa em lote"
```

---

### Task 5: `components/banco/BancoHeader.tsx`

**Files:**
- Create: `components/banco/BancoHeader.tsx`

Extraído (não copiado) do padrão de `components/conta-pj/DashboardBancario.tsx`: cards de saldo + ocultar saldos. Sem cartões virtuais/investimentos aqui (ficam nas páginas próprias). Encolhe pra barra fina ao rolar.

- [ ] **Step 1: Criar o componente**

```tsx
'use client'
import { useEffect, useState } from 'react'
import { formatBRL } from '@/lib/currency-brl'
import { fmtBRLCompact } from '@/lib/dre-calculations'
import { maskCpfCnpj } from '@/lib/masks'

export type ContaBancaria = {
  id: string; saldo_disponivel: number; saldo: number
  agencia?: string | null; numero_conta?: string | null; digito?: string | null
  banco_nome?: string | null
}

type Props = {
  empresaNome: string; empresaCnpj: string | null
  contas: ContaBancaria[]
  receber30: { valor: number; duplicatas: number }
}

export default function BancoHeader({ empresaNome, empresaCnpj, contas, receber30 }: Props) {
  const [hide, setHide] = useState(false)
  const [compact, setCompact] = useState(false)

  useEffect(() => {
    setHide(localStorage.getItem('banco-hide-saldo') === '1')
    const onScroll = () => setCompact(window.scrollY > 120)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  function toggleHide() {
    const n = !hide; setHide(n)
    localStorage.setItem('banco-hide-saldo', n ? '1' : '0')
  }

  const saldoTotal = contas.reduce((s, c) => s + Number(c.saldo_disponivel || 0), 0)
  const principal = contas[0]
  const linhaCc = principal?.numero_conta
    ? `AG ${principal.agencia || '0001'} · CC ${principal.numero_conta}${principal.digito != null ? `-${principal.digito}` : ''}`
    : `${contas.length} conta${contas.length === 1 ? '' : 's'} conectada${contas.length === 1 ? '' : 's'}`

  if (compact) {
    return (
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--surface, #fff)', borderBottom: '1px solid var(--line, #E4DCCC)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12, borderRadius: '0 0 14px 14px' }}>
        <i className="fa-solid fa-building-columns" style={{ color: 'var(--sage)' }} />
        <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>{hide ? '••••••' : formatBRL(saldoTotal)}</span>
        <span style={{ fontSize: 13, color: 'var(--ink-mut)' }}>saldo disponível</span>
        <button className="btn-ghost" style={{ marginLeft: 'auto', fontSize: 12, padding: '4px 10px' }} onClick={toggleHide}>{hide ? 'Mostrar' : 'Ocultar'}</button>
      </div>
    )
  }

  return (
    <>
      <div className="page-hdr">
        <div>
          <div className="page-title">Banco</div>
          <div className="page-sub">{empresaNome}{empresaCnpj ? ` · ${maskCpfCnpj(empresaCnpj)}` : ''}</div>
        </div>
        <button className="btn-action btn-ghost" style={{ fontSize: 13 }} onClick={toggleHide}>
          {hide ? '👁 Mostrar saldos' : '🙈 Ocultar saldos'}
        </button>
      </div>
      <div className="bank-cards">
        <div className="bank-card dark" style={{ borderRadius: 18 }}>
          <div className="bc-lbl">Saldo disponível</div>
          <div className="bc-val">{hide ? '••••••' : formatBRL(saldoTotal)}</div>
          <div className="bc-sub">{linhaCc}</div>
        </div>
        <div className="bank-card teal" style={{ borderRadius: 18 }}>
          <div className="bc-lbl">A Receber 30d</div>
          <div className="bc-val">{hide ? '••••••' : fmtBRLCompact(receber30.valor)}</div>
          <div className="bc-sub">{receber30.duplicatas} duplicata{receber30.duplicatas === 1 ? '' : 's'} pendente{receber30.duplicatas === 1 ? '' : 's'}</div>
        </div>
        <div className="bank-card light" style={{ borderRadius: 18 }}>
          <div className="bc-lbl">Contas conectadas</div>
          <div className="bc-val">{contas.length}</div>
          <div className="bc-sub">{principal?.banco_nome || 'Open Finance (Belvo)'}</div>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Typecheck** — `npx tsc --noEmit`, sem erros novos.

- [ ] **Step 3: Commit**

```bash
git add components/banco/BancoHeader.tsx
git commit -m "feat(banco): BancoHeader — saldo/contas com modo compacto no scroll"
```

---

### Task 6: `components/banco/FilaTab.tsx` (o coração)

**Files:**
- Create: `components/banco/FilaTab.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
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
```

- [ ] **Step 2: Typecheck** — `npx tsc --noEmit`, sem erros novos.

- [ ] **Step 3: Commit**

```bash
git add components/banco/FilaTab.tsx
git commit -m "feat(banco): FilaTab — fila one-click com categoria, cadastro e conta prevista"
```

---

### Task 7: `components/banco/ExtratoTab.tsx` e `ResumoTab.tsx`

**Files:**
- Create: `components/banco/ExtratoTab.tsx`
- Create: `components/banco/ResumoTab.tsx`

- [ ] **Step 1: Criar `ExtratoTab.tsx`**

```tsx
'use client'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'

type Item = {
  id: string; descricao: string; valor: number; tipo: 'credito' | 'debito'
  data_transacao: string; contraparte_nome: string | null; conciliado: boolean
  tipo_operacao: string | null
}
type Props = { empresaId: string }

export default function ExtratoTab({ empresaId }: Props) {
  const [itens, setItens] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<'todos' | 'pendentes' | 'conciliadas'>('todos')
  const [dias, setDias] = useState(30)

  const carregar = useCallback(async () => {
    setLoading(true)
    const desde = new Date(); desde.setDate(desde.getDate() - dias)
    let q = supabase.from('extrato_bancario')
      .select('id,descricao,valor,tipo,data_transacao,contraparte_nome,conciliado,tipo_operacao')
      .eq('empresa_id', empresaId).gte('data_transacao', desde.toISOString().slice(0, 10))
      .order('data_transacao', { ascending: false }).limit(300)
    if (filtro === 'pendentes') q = q.eq('conciliado', false)
    if (filtro === 'conciliadas') q = q.eq('conciliado', true)
    const { data } = await q
    setItens((data ?? []) as Item[])
    setLoading(false)
  }, [empresaId, filtro, dias])

  useEffect(() => { void carregar() }, [carregar])

  return (
    <div className="txs-card">
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', flex: 1 }}>Extrato ({itens.length})</div>
        {([['todos', 'Todos'], ['pendentes', 'A revisar'], ['conciliadas', 'No caixa']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setFiltro(k)} className="btn-ghost" style={{ fontSize: 13, padding: '4px 12px', borderRadius: 20, background: filtro === k ? 'var(--ink)' : undefined, color: filtro === k ? '#fff' : undefined }}>{l}</button>
        ))}
        <select className="form-input" style={{ width: 'auto', fontSize: 13, padding: '4px 10px' }} value={dias} onChange={e => setDias(Number(e.target.value))}>
          <option value={7}>7 dias</option><option value={30}>30 dias</option><option value={90}>90 dias</option><option value={365}>1 ano</option>
        </select>
      </div>
      {loading ? <div style={{ padding: 36, textAlign: 'center', color: 'var(--ink-mut)' }}>Carregando…</div>
        : itens.length === 0 ? <div style={{ padding: 36, textAlign: 'center', color: 'var(--ink-mut)', fontSize: 15 }}>Nenhuma movimentação no período.</div>
        : itens.map(e => (
          <div key={e.id} className="tx-item">
            <div className="tx-left">
              <div className="tx-name">{e.descricao}</div>
              <div className="tx-sub">
                {e.contraparte_nome || '—'} · {new Date(e.data_transacao).toLocaleDateString('pt-BR')}
                {e.conciliado
                  ? <span className="tag green" style={{ marginLeft: 8, fontSize: 11 }}>no caixa</span>
                  : <span className="tag gray" style={{ marginLeft: 8, fontSize: 11 }}>a revisar</span>}
              </div>
            </div>
            <div className={`tx-amount ${e.tipo === 'credito' ? 'pos' : 'neg'}`}>
              {e.tipo === 'credito' ? '+' : '-'}{formatBRL(Number(e.valor || 0))}
            </div>
          </div>
        ))}
    </div>
  )
}
```

- [ ] **Step 2: Criar `ResumoTab.tsx`**

```tsx
'use client'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'

type Periodo = 'semana' | 'mes' | 'ano'
type Tx = { valor: number; tipo: 'entrada' | 'saida'; categoria: string | null; fornecedor_id: string | null; cliente_id: string | null }
type Props = { empresaId: string; refreshKey: number }

function inicioPeriodo(p: Periodo): string {
  const d = new Date()
  if (p === 'semana') d.setDate(d.getDate() - 7)
  else if (p === 'mes') d.setDate(1)
  else { d.setMonth(0); d.setDate(1) }
  return d.toISOString().slice(0, 10)
}

export default function ResumoTab({ empresaId, refreshKey }: Props) {
  const [periodo, setPeriodo] = useState<Periodo>('mes')
  const [txs, setTxs] = useState<Tx[]>([])
  const [nomes, setNomes] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  const carregar = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('transacoes')
      .select('valor,tipo,categoria,fornecedor_id,cliente_id')
      .eq('empresa_id', empresaId).gte('data', inicioPeriodo(periodo)).limit(1000)
    const rows = (data ?? []) as Tx[]
    setTxs(rows)
    const fIds = Array.from(new Set(rows.map(t => t.fornecedor_id).filter(Boolean))) as string[]
    const cIds = Array.from(new Set(rows.map(t => t.cliente_id).filter(Boolean))) as string[]
    const [fR, cR] = await Promise.all([
      fIds.length ? supabase.from('fornecedores').select('id,razao_social,nome_fantasia').in('id', fIds) : Promise.resolve({ data: [] }),
      cIds.length ? supabase.from('clientes').select('id,nome').in('id', cIds) : Promise.resolve({ data: [] }),
    ])
    const n: Record<string, string> = {}
    for (const f of (fR.data ?? []) as { id: string; razao_social: string; nome_fantasia: string | null }[]) n[f.id] = f.nome_fantasia || f.razao_social
    for (const c of (cR.data ?? []) as { id: string; nome: string }[]) n[c.id] = c.nome
    setNomes(n)
    setLoading(false)
  }, [empresaId, periodo])

  useEffect(() => { void carregar() }, [carregar, refreshKey])

  const saiu = txs.filter(t => t.tipo === 'saida').reduce((s, t) => s + Number(t.valor), 0)
  const entrou = txs.filter(t => t.tipo === 'entrada').reduce((s, t) => s + Number(t.valor), 0)

  function agrupa(chaveFn: (t: Tx) => string | null, tipo: 'entrada' | 'saida'): [string, number][] {
    const m = new Map<string, number>()
    for (const t of txs) {
      if (t.tipo !== tipo) continue
      const k = chaveFn(t); if (!k) continue
      m.set(k, (m.get(k) || 0) + Number(t.valor))
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8)
  }

  const porCategoria = agrupa(t => t.categoria?.trim() || null, 'saida')
  const porFornecedor = agrupa(t => t.fornecedor_id ? (nomes[t.fornecedor_id] ?? '…') : null, 'saida')
  const porCliente = agrupa(t => t.cliente_id ? (nomes[t.cliente_id] ?? '…') : null, 'entrada')

  function Bloco({ titulo, dados, total, cor }: { titulo: string; dados: [string, number][]; total: number; cor: string }) {
    return (
      <div className="txs-card" style={{ padding: '18px 20px' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 14 }}>{titulo}</div>
        {dados.length === 0 ? <div style={{ color: 'var(--ink-mut)', fontSize: 14.5 }}>Sem dados no período — confirme transações na Fila.</div>
          : dados.map(([k, v]) => {
            const pct = total > 0 ? (v / total) * 100 : 0
            return (
              <div key={k} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 5 }}>
                  <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{k}</span>
                  <span style={{ color: 'var(--ink)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatBRL(v)} <span style={{ color: 'var(--ink-mut)', fontWeight: 500 }}>· {pct.toFixed(0)}%</span></span>
                </div>
                <div style={{ height: 8, background: 'var(--paper-2, #F1ECE1)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: cor, borderRadius: 99 }} />
                </div>
              </div>
            )
          })}
      </div>
    )
  }

  if (loading) return <div style={{ padding: 44, textAlign: 'center', color: 'var(--ink-mut)', fontSize: 15 }}>Carregando…</div>

  return (
    <>
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {([['semana', 'Semana'], ['mes', 'Mês'], ['ano', 'Ano']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setPeriodo(k)} className="btn-ghost" style={{ fontSize: 14, padding: '6px 16px', borderRadius: 20, background: periodo === k ? 'var(--sage-tint)' : undefined, borderColor: periodo === k ? 'var(--sage)' : undefined, color: periodo === k ? 'var(--sage-deep)' : undefined, fontWeight: periodo === k ? 700 : 500 }}>{l}</button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
        <Bloco titulo="Onde você gastou (por categoria)" dados={porCategoria} total={saiu} cor="var(--sage)" />
        <Bloco titulo="Gasto por fornecedor" dados={porFornecedor} total={saiu} cor="#B08A3E" />
        <Bloco titulo="Recebido por cliente" dados={porCliente} total={entrou} cor="#3D7A6E" />
      </div>
    </>
  )
}
```

- [ ] **Step 3: Typecheck** — `npx tsc --noEmit`, sem erros novos.

- [ ] **Step 4: Commit**

```bash
git add components/banco/ExtratoTab.tsx components/banco/ResumoTab.tsx
git commit -m "feat(banco): abas Extrato e Resumo (categoria + fornecedor/cliente)"
```

---

### Task 8: `components/banco/VisaoGeralTab.tsx`

**Files:**
- Create: `components/banco/VisaoGeralTab.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
'use client'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'

type Props = { empresaId: string; pendentesFila: number; onIrParaFila: () => void; refreshKey: number }
type Previsto = { id: string; descricao: string; valor: number; data_vencimento: string; origem: 'pagar' | 'receber' }

export default function VisaoGeralTab({ empresaId, pendentesFila, onIrParaFila, refreshKey }: Props) {
  const [entrou, setEntrou] = useState(0)
  const [saiu, setSaiu] = useState(0)
  const [semTransacao, setSemTransacao] = useState<Previsto[]>([])
  const [loading, setLoading] = useState(true)

  const carregar = useCallback(async () => {
    setLoading(true)
    const mes0 = new Date(); mes0.setDate(1)
    const d0 = mes0.toISOString().slice(0, 10)
    const hoje = new Date().toISOString().slice(0, 10)
    const [txR, pgR, rcR] = await Promise.all([
      supabase.from('transacoes').select('valor,tipo').eq('empresa_id', empresaId).gte('data', d0).limit(1000),
      supabase.from('contas_pagar').select('id,descricao,valor,data_vencimento').eq('empresa_id', empresaId).in('status', ['pendente', 'vencida']).lte('data_vencimento', hoje).limit(10),
      supabase.from('contas_receber').select('id,descricao,valor,data_vencimento').eq('empresa_id', empresaId).in('status', ['pendente', 'vencida']).lte('data_vencimento', hoje).limit(10),
    ])
    const txs = (txR.data ?? []) as { valor: number; tipo: string }[]
    setEntrou(txs.filter(t => t.tipo === 'entrada').reduce((s, t) => s + Number(t.valor), 0))
    setSaiu(txs.filter(t => t.tipo === 'saida').reduce((s, t) => s + Number(t.valor), 0))
    setSemTransacao([
      ...((pgR.data ?? []) as Omit<Previsto, 'origem'>[]).map(p => ({ ...p, valor: Number(p.valor), origem: 'pagar' as const })),
      ...((rcR.data ?? []) as Omit<Previsto, 'origem'>[]).map(r => ({ ...r, valor: Number(r.valor), origem: 'receber' as const })),
    ].sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento)).slice(0, 6))
    setLoading(false)
  }, [empresaId])

  useEffect(() => { void carregar() }, [carregar, refreshKey])

  if (loading) return <div style={{ padding: 44, textAlign: 'center', color: 'var(--ink-mut)', fontSize: 15 }}>Carregando…</div>

  return (
    <>
      <div className="kpis" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="kpi"><div className="kpi-lbl">Entrou (mês)</div><div className="kpi-val" style={{ color: '#3D7A6E' }}>{formatBRL(entrou)}</div></div>
        <div className="kpi"><div className="kpi-lbl">Saiu (mês)</div><div className="kpi-val" style={{ color: '#B0413E' }}>{formatBRL(saiu)}</div></div>
        <div className="kpi"><div className="kpi-lbl">Resultado</div><div className="kpi-val" style={{ color: entrou - saiu >= 0 ? '#3D7A6E' : '#B0413E' }}>{formatBRL(entrou - saiu)}</div></div>
      </div>

      {pendentesFila > 0 && (
        <button onClick={onIrParaFila} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', padding: '14px 18px', background: 'var(--sage-tint)', border: '1px solid var(--sage)', borderRadius: 14, cursor: 'pointer', marginTop: 12 }}>
          <i className="fa-solid fa-inbox" style={{ color: 'var(--sage-deep)', fontSize: 18 }} />
          <span style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--sage-deep)', flex: 1 }}>
            {pendentesFila} transaç{pendentesFila === 1 ? 'ão' : 'ões'} esperando sua confirmação na Fila
          </span>
          <i className="fa-solid fa-arrow-right" style={{ color: 'var(--sage-deep)' }} />
        </button>
      )}

      {semTransacao.length > 0 && (
        <div style={{ background: '#F3ECDA', border: '0.5px solid #F59E0B', borderRadius: 14, padding: '12px 16px', fontSize: 14, color: '#13201D', lineHeight: 1.7, marginTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <i className="fa-solid fa-triangle-exclamation" style={{ color: '#B08A3E' }} />
            <strong>{semTransacao.length} lançamento{semTransacao.length > 1 ? 's' : ''} vencido{semTransacao.length > 1 ? 's' : ''}</strong> sem transação bancária correspondente
          </div>
          {semTransacao.map(p => (
            <div key={`${p.origem}-${p.id}`} style={{ fontSize: 13, color: '#7B8C88', paddingLeft: 20 }}>
              · {p.descricao} — {formatBRL(p.valor)} ({p.origem === 'pagar' ? 'a pagar' : 'a receber'}, venc. {new Date(p.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR')})
            </div>
          ))}
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 2: Typecheck** — `npx tsc --noEmit`, sem erros novos.

- [ ] **Step 3: Commit**

```bash
git add components/banco/VisaoGeralTab.tsx
git commit -m "feat(banco): aba Visão geral — KPIs, pendências da fila e vencidos sem transação"
```

---

### Task 9: `app/dashboard/banco/page.tsx` (shell)

**Files:**
- Create: `app/dashboard/banco/page.tsx`

- [ ] **Step 1: Criar a página**

```tsx
'use client'
import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BancoHeader, { type ContaBancaria } from '@/components/banco/BancoHeader'
import FilaTab from '@/components/banco/FilaTab'
import ExtratoTab from '@/components/banco/ExtratoTab'
import ResumoTab from '@/components/banco/ResumoTab'
import VisaoGeralTab from '@/components/banco/VisaoGeralTab'

type Aba = 'geral' | 'fila' | 'extrato' | 'resumo'
const ABAS: { id: Aba; label: string; icon: string }[] = [
  { id: 'geral', label: 'Visão geral', icon: 'fa-gauge-high' },
  { id: 'fila', label: 'Fila', icon: 'fa-inbox' },
  { id: 'extrato', label: 'Extrato', icon: 'fa-list-ul' },
  { id: 'resumo', label: 'Resumo', icon: 'fa-chart-pie' },
]

function BancoPage() {
  const params = useSearchParams()
  const abaInicial = (params.get('aba') as Aba) || 'geral'
  const [aba, setAba] = useState<Aba>(ABAS.some(a => a.id === abaInicial) ? abaInicial : 'geral')
  const [empresaId, setEmpresaId] = useState('')
  const [empresaNome, setEmpresaNome] = useState('')
  const [empresaCnpj, setEmpresaCnpj] = useState<string | null>(null)
  const [contas, setContas] = useState<ContaBancaria[]>([])
  const [receber30, setReceber30] = useState({ valor: 0, duplicatas: 0 })
  const [pendentesFila, setPendentesFila] = useState(0)
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  const carregar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data: sess } = await supabase.auth.getSession()
    setToken(sess.session?.access_token ?? '')
    const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const eid = (u?.empresa_id as string) ?? user.id
    setEmpresaId(eid)

    const hoje = new Date().toISOString().slice(0, 10)
    const em30 = new Date(); em30.setDate(em30.getDate() + 30)
    const [empR, contasR, crR, filaR] = await Promise.all([
      supabase.from('empresas').select('nome,cnpj').eq('id', eid).maybeSingle(),
      supabase.from('contas_bancarias').select('id,saldo_disponivel,saldo,agencia,numero_conta,digito,banco_nome').eq('empresa_id', eid).eq('status', 'ativa').order('is_principal', { ascending: false }),
      supabase.from('contas_receber').select('valor,valor_recebido').eq('empresa_id', eid).in('status', ['pendente', 'vencida', 'parcialmente_recebida']).gte('data_vencimento', hoje).lte('data_vencimento', em30.toISOString().slice(0, 10)),
      supabase.from('extrato_bancario').select('id', { count: 'exact', head: true }).eq('empresa_id', eid).eq('conciliado', false),
    ])
    setEmpresaNome(empR.data?.nome ?? '')
    setEmpresaCnpj(empR.data?.cnpj ?? null)
    setContas((contasR.data ?? []) as ContaBancaria[])
    const rows = crR.data ?? []
    setReceber30({ valor: rows.reduce((s, r) => s + Math.max(0, Number(r.valor || 0) - Number(r.valor_recebido || 0)), 0), duplicatas: rows.length })
    setPendentesFila(filaR.count ?? 0)
    setLoading(false)
  }, [])

  useEffect(() => { void carregar() }, [carregar, refreshKey])

  const onConfirmado = useCallback(() => setRefreshKey(k => k + 1), [])

  if (!loading && contas.length === 0 && pendentesFila === 0) {
    return (
      <>
        <div className="page-hdr"><div><div className="page-title">Banco</div><div className="page-sub">Conecte sua conta e toda transação chega pronta pra classificar.</div></div></div>
        <div className="txs-card" style={{ padding: 56, textAlign: 'center' }}>
          <i className="fa-solid fa-building-columns" style={{ fontSize: 34, color: 'var(--sage)', display: 'block', marginBottom: 14 }} />
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>Nenhuma conta conectada</div>
          <div style={{ fontSize: 14.5, color: 'var(--ink-mut)', marginBottom: 18 }}>Conecte pelo Open Finance (Belvo) — saldo e extrato entram sozinhos, e a IA classifica cada movimentação.</div>
          <Link href="/dashboard/conexoes" className="btn-action" style={{ fontSize: 14.5, textDecoration: 'none' }}>
            <i className="fa-solid fa-link" style={{ marginRight: 8 }} />Conectar banco
          </Link>
        </div>
      </>
    )
  }

  return (
    <>
      <BancoHeader empresaNome={empresaNome} empresaCnpj={empresaCnpj} contas={contas} receber30={receber30} />

      <div style={{ display: 'flex', gap: 4, margin: '4px 0 14px' }}>
        {ABAS.map(a => (
          <button key={a.id} onClick={() => setAba(a.id)} style={{
            fontSize: 14.5, fontWeight: aba === a.id ? 700 : 500, padding: '8px 18px', borderRadius: 22, cursor: 'pointer',
            border: `1px solid ${aba === a.id ? 'var(--sage)' : 'var(--line)'}`,
            background: aba === a.id ? 'var(--sage-tint)' : 'var(--surface, #fff)', color: aba === a.id ? 'var(--sage-deep)' : 'var(--ink-mut)',
          }}>
            <i className={`fa-solid ${a.icon}`} style={{ marginRight: 7, fontSize: 12.5 }} />
            {a.label}{a.id === 'fila' && pendentesFila > 0 ? ` (${pendentesFila})` : ''}
          </button>
        ))}
      </div>

      {aba === 'geral' && <VisaoGeralTab empresaId={empresaId} pendentesFila={pendentesFila} onIrParaFila={() => setAba('fila')} refreshKey={refreshKey} />}
      {aba === 'fila' && <FilaTab token={token} onConfirmado={onConfirmado} />}
      {aba === 'extrato' && <ExtratoTab empresaId={empresaId} />}
      {aba === 'resumo' && <ResumoTab empresaId={empresaId} refreshKey={refreshKey} />}
    </>
  )
}

export default function Page() {
  return <Suspense fallback={<div style={{ padding: 44, textAlign: 'center', color: 'var(--ink-mut)' }}>Carregando…</div>}><BancoPage /></Suspense>
}
```

Nota (Next.js 16): `useSearchParams` exige boundary de `<Suspense>` — por isso o wrapper no export. Confirmar contra `node_modules/next/dist/docs/01-app/` se algo divergir no build.

- [ ] **Step 2: Typecheck + build** — `npx tsc --noEmit` e `npm run build`. Expected: build passa.

- [ ] **Step 3: Verificar no browser**

`npm run dev` → `/dashboard/banco`: header com saldo, 4 abas navegam, `?aba=fila` abre direto na fila, confirmar um item remove da fila e atualiza contador.

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/banco/page.tsx
git commit -m "feat(banco): página /dashboard/banco — header banco + 4 abas"
```

---

### Task 10: Navegação — Banco vira Core

**Files:**
- Modify: `app/dashboard/layout.tsx`
- Modify: `lib/marketplace.ts`

- [ ] **Step 1: Grupo Banco sempre visível em `layout.tsx`**

Substituir o bloco condicional (linhas ~81–93):

```tsx
    ...(installedIds.includes('banco') ? [{
      label: 'Banco',
      collapsible: true,
      items: [
        { href: '/dashboard/conta-pj', icon: 'fa-building-columns', label: 'Visão geral', match: (p: string) => p === '/dashboard/conta-pj' },
        { href: '/dashboard/conta-pj/extrato', icon: 'fa-list-ul', label: 'Extrato' },
        { href: '/dashboard/conta-pj/transferencias', icon: 'fa-bolt', label: 'PIX & Transferências' },
        { href: '/dashboard/cartoes', icon: 'fa-credit-card', label: 'Cartões' },
        { href: '/dashboard/credito', icon: 'fa-hand-holding-dollar', label: 'Crédito & Financiamento' },
        { href: '/dashboard/conexoes', icon: 'fa-link', label: 'Open Finance (Belvo)' },
        { href: '/dashboard/conta-pj/abrir', icon: 'fa-circle-plus', label: 'Abrir conta' },
      ],
    }] : []),
```

por (Core — sem gate de instalação; spec: Banco sai do Marketplace):

```tsx
    {
      label: 'Banco',
      collapsible: true,
      items: [
        { href: '/dashboard/banco', icon: 'fa-building-columns', label: 'Visão geral', match: (p: string) => p === '/dashboard/banco' },
        { href: '/dashboard/banco?aba=fila', icon: 'fa-inbox', label: 'Fila (a revisar)' },
        { href: '/dashboard/banco?aba=extrato', icon: 'fa-list-ul', label: 'Extrato' },
        { href: '/dashboard/conta-pj/transferencias', icon: 'fa-bolt', label: 'PIX & Transferências' },
        { href: '/dashboard/cartoes', icon: 'fa-credit-card', label: 'Cartões' },
        { href: '/dashboard/credito', icon: 'fa-hand-holding-dollar', label: 'Crédito & Financiamento' },
        { href: '/dashboard/conexoes', icon: 'fa-link', label: 'Open Finance (Belvo)' },
        { href: '/dashboard/conta-pj/abrir', icon: 'fa-circle-plus', label: 'Abrir conta' },
      ],
    },
```

- [ ] **Step 2: Remover o item Conciliação do grupo Contabilidade**

No mesmo arquivo (linha ~75), remover a linha:

```tsx
        { href: '/dashboard/conciliacao', icon: 'fa-building-columns', label: 'Conciliação Bancária', badge: badges.aprovacoes > 0 ? String(badges.aprovacoes) : undefined, badgeColor: 'var(--teal)' },
```

(Se `badges.aprovacoes` ficar sem uso após remover, mover o badge pro item "Fila (a revisar)" do grupo Banco ou remover a variável — o que o typecheck pedir.)

- [ ] **Step 3: `pageTitles` em `layout.tsx`**

Adicionar: `'/dashboard/banco': 'Banco',` no objeto `pageTitles` (linha ~123).

- [ ] **Step 4: Remover `banco` de `MARKET_APPS` em `lib/marketplace.ts`**

Apagar a linha 32 (entry `{ id: 'banco', name: 'Banco PJ', ... }`). Em `layout.tsx`, apagar também a linha `if (app.id === 'banco') continue` (linha ~106) que fica morta.
Verificar consumidores: `grep -rn "'banco'" app/ lib/ components/` — ajustar qualquer referência a `MARKET_APPS` que assuma o id `banco` (ex.: onboarding presets em `app/onboarding/page.tsx` — remover `'banco'` das listas `SEGMENTOS[].apps` se aparecer).

- [ ] **Step 5: Typecheck + build** — `npx tsc --noEmit && npm run build`. Expected: passa.

- [ ] **Step 6: Commit**

```bash
git add app/dashboard/layout.tsx lib/marketplace.ts app/onboarding/page.tsx
git commit -m "feat(banco): Banco vira grupo Core no sidebar; sai do Marketplace"
```

---

### Task 11: Redirects das rotas antigas

**Files:**
- Replace: `app/dashboard/conta-pj/page.tsx`
- Replace: `app/dashboard/conciliacao/page.tsx`
- Replace: `app/dashboard/classificar/page.tsx`

**Regra da spec:** os arquivos antigos são substituídos por redirect, mas seu conteúdo fica recuperável no git — NÃO deletar subpáginas (`conta-pj/extrato`, `conta-pj/abrir`, `conta-pj/transferencias`, `conciliacao/relatorio` continuam como estão; `conta-pj/extrato` pode virar redirect numa limpeza futura, fora deste plano).

- [ ] **Step 1: Substituir `app/dashboard/conta-pj/page.tsx` (todo o conteúdo) por:**

```tsx
import { redirect } from 'next/navigation'

// Fundido no Banco module — spec docs/superpowers/specs/2026-07-08-banco-module-design.md
export default function Page() {
  redirect('/dashboard/banco')
}
```

- [ ] **Step 2: Substituir `app/dashboard/conciliacao/page.tsx` por:**

```tsx
import { redirect } from 'next/navigation'

// Fundido no Banco module (aba Fila) — o matching com contas a pagar/receber vive lá agora.
export default function Page() {
  redirect('/dashboard/banco?aba=fila')
}
```

- [ ] **Step 3: Substituir `app/dashboard/classificar/page.tsx` por:**

```tsx
import { redirect } from 'next/navigation'

// Fundido no Banco module (aba Fila).
export default function Page() {
  redirect('/dashboard/banco?aba=fila')
}
```

- [ ] **Step 4: Checar links internos para as rotas antigas**

Run: `grep -rn "dashboard/classificar\|dashboard/conciliacao\"\|dashboard/conta-pj'" app/ components/ lib/ --include="*.tsx" --include="*.ts"`
Atualizar todo `href`/`push` que aponte pra rota antiga → rota nova equivalente (`/dashboard/banco`, `?aba=fila`). O redirect cobre o que escapar, mas link direto é melhor.

- [ ] **Step 5: Typecheck + build** — `npx tsc --noEmit && npm run build`. Expected: passa (as páginas antigas viraram server components mínimos).

- [ ] **Step 6: Verificar no browser** — visitar `/dashboard/classificar`, `/dashboard/conciliacao`, `/dashboard/conta-pj` → todas caem em `/dashboard/banco`.

- [ ] **Step 7: Commit**

```bash
git add app/dashboard/conta-pj/page.tsx app/dashboard/conciliacao/page.tsx app/dashboard/classificar/page.tsx
git commit -m "feat(banco): rotas antigas (conta-pj, conciliacao, classificar) redirecionam pro Banco"
```

---

### Task 12: Verificação end-to-end + revisores

**Files:** nenhum novo (correções pontuais se os revisores acharem problema).

- [ ] **Step 1: Fluxo completo no browser (critério de pronto da spec)**

Com `npm run dev`:
1. Semear extrato de teste (via `/api/demo/seed` ou Belvo real).
2. `/dashboard/banco?aba=fila` → itens com categoria sugerida (badge ia/aprendido), fornecedor sugerido quando CNPJ bate, conta prevista quando casa.
3. Confirmar 1 item → some da fila, não volta no refresh; transação aparece na aba Extrato como "no caixa", no Resumo, e na DRE (`/dashboard/dre`).
4. Confirmar item com conta a pagar vinculada → conta vira `paga` no Financeiro.
5. Confirmar item com "Criar fornecedor" → cadastro aparece em `/dashboard/fornecedores`; confirmar OUTRO item da mesma contraparte → vincula ao mesmo cadastro (não duplica).
6. Lote com item já conciliado (abrir 2 abas e confirmar na outra) → `ja_conciliado`, sem erro pro usuário.
7. Redirects das 3 rotas antigas.
8. Sem conta conectada (empresa nova): empty state com CTA Conectar banco.

- [ ] **Step 2: Rodar os revisores obrigatórios**

Dispatch dos agentes `factorone-reviewer` (multi-tenant/IDOR/Next 16) e `revisor-financeiro` (baixa de contas, sinais, arredondamento) sobre o diff completo. Corrigir o que apontarem antes do commit final.

- [ ] **Step 3: Commit final de ajustes (se houver)**

```bash
git add -A
git commit -m "fix(banco): ajustes dos revisores (multi-tenant + financeiro)"
```
