# Action Engine v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir as contagens soltas de "pendência" espalhadas pelo produto por uma fila única (`events` + `work_items`) que o Cockpit consome, começando pelos 3 publicadores que o vertical Contador precisa: documento do Cofre Fiscal, transação Open Finance sem classificação confiável, e obrigação fiscal vencendo. O rastreador de bookkeeping do Portal Contador é a UI que consome essa fila filtrada por origem.

**Architecture:** Duas tabelas novas (`events` fato imutável, `work_items` fila de atenção com score determinístico). Nenhum serviço/fila externa — cada publicador escreve direto na API route/cron que já existe, chamando uma função server-side síncrona (`registrarResultado`). Cockpit e Cofre Fiscal passam a ler `work_items`. Spec completo: `docs/superpowers/specs/2026-07-15-action-engine-design.md`.

**Tech Stack:** Next.js 16 (App Router), Supabase (RLS por `empresa_id`), padrão de auth `getSupabaseUser` (Bearer token), motor de classificação existente (`lib/financeiro/motorClassificacao.ts`).

**⚠️ Sem test runner:** este projeto não tem framework de teste automatizado (`package.json`: só `dev/build/start/lint`, sem `tsx`/`jest`/`vitest`). Verificação por task = `npx tsc --noEmit` + query SQL de checagem + exercício real do fluxo (mesma convenção usada em `docs/superpowers/plans/2026-07-08-banco-module.md`). Não introduzir framework de teste neste plano.

**Correção de escopo em relação ao spec:** o spec dizia que o Cockpit "troca" as 3 queries soltas (`reembolsos`, `aprovações`, `contasPagarVencendo`) pela fila nova. Isso está errado — nenhum desses 3 tipos tem publicador nesta v1 (só Cofre Fiscal, Open Finance e obrigação fiscal publicam). Trocar de verdade faria reembolsos/aprovações desaparecerem do Cockpit sem que nada os alimente. Este plano em vez disso **adiciona** um bloco novo "Prioridades" (Top 5 por score) ao lado do que já existe — migrar reembolsos/despesas pro Action Engine fica pra depois, como o spec já registrava em "Fora".

**Convenções obrigatórias do repo:**
- API routes: `getSupabaseUser(req)` de `@/lib/supabase-route`, retorna 401 se `!user`; `empresa_id` sempre resolvido no servidor via `usuarios.empresa_id` (nunca confiar no client).
- Escrita privilegiada: `createClient(...SERVICE_ROLE_KEY)` (função `svc()`), igual em todas as rotas existentes.
- Client: token via `supabase.auth.getSession()` → header `Authorization: Bearer`.
- UI: classes CSS globais existentes (`card-v2`, `chip-v2`, `btn-v2`), inline styles com CSS vars, FontAwesome.
- Tabelas em português, `empresa_id` como convenção universal (não `company_id`).
- Antes do commit final: rodar `rls-tenant-guardian` (migration nova + rotas que leem `work_items`) e `factorone-reviewer`.

---

## File Structure

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `supabase/migrations/20260715000000_action_engine.sql` | Criar | Tabelas `events`, `work_items` + RLS + índice de dedup + fix de default em `extrato_bancario.status_classificacao` |
| `lib/action-engine/types.ts` | Criar | Tipos compartilhados (`TipoEvento`, `OrigemWorkItem`, `ResponsavelPapel`, `RegistrarResultadoParams`) |
| `lib/action-engine/score.ts` | Criar | Função pura `calcularScore` |
| `lib/action-engine/registrarResultado.ts` | Criar | Única função de escrita: cria `work_item` aberto OU já resolvido, sempre com histórico |
| `app/api/cofre-fiscal/route.ts` | Modificar | POST publica `document_uploaded` após salvar o documento |
| `app/api/cron/belvo-sync/route.ts` | Modificar | Troca classificação cega por `classificarLote` (confiança) + publica `transaction_received` |
| `app/api/cron/automacoes-fase3/route.ts` | Modificar | Nova task `verificarObrigacoesFiscaisVencendo` publica `tax_due` |
| `app/api/action-engine/work-items/route.ts` | Criar | GET — lista work_items da empresa ativa, filtrável por `origem` |
| `app/api/action-engine/work-items/[id]/resolver/route.ts` | Criar | POST — marca work_item como resolvido manualmente |
| `app/dashboard/page.tsx` | Modificar | Novo bloco "Prioridades" (Top 5 por score) no Cockpit |
| `app/dashboard/contabil-fiscal/cofre-fiscal/page.tsx` | Modificar | Chip de status + ação "Marcar como processado" por documento (o rastreador) |

---

### Task 1: Migration — `events`, `work_items`, RLS, dedup

**Files:**
- Create: `supabase/migrations/20260715000000_action_engine.sql`

- [ ] **Step 1: Escrever a migration**

```sql
-- Action Engine v1 — spec em docs/superpowers/specs/2026-07-15-action-engine-design.md
-- Duas tabelas: `events` (fato imutável, o que aconteceu) e `work_items`
-- (fila de atenção, criada pelo Action Engine — nunca publicada direto por
-- um módulo). Um work_item pode nascer já "resolvido" (IA decidiu sozinha)
-- só pra manter o histórico auditável — nunca é descartado silenciosamente.

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  tipo text not null check (tipo in ('transaction_received','document_uploaded','tax_due')),
  payload jsonb not null,
  publicado_por text not null,
  created_at timestamptz not null default now()
);
create index if not exists events_empresa_idx on public.events(empresa_id);
create index if not exists events_tipo_idx on public.events(tipo);

create table if not exists public.work_items (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  event_id uuid references public.events(id) on delete set null,
  tipo text not null check (tipo in ('transaction_received','document_uploaded','tax_due')),
  origem text not null check (origem in ('open_finance','documento','obrigacao_fiscal')),
  -- 'tabela:id' da linha que originou (ex.: 'cofre_fiscal_documentos:<uuid>') — dedup e link de volta.
  origem_ref text not null,
  responsavel_papel text not null check (responsavel_papel in ('financeiro','contador','dono')),
  status text not null default 'aberto' check (status in ('aberto','em_analise','resolvido','ignorado')),
  prazo date,
  impacto_valor numeric,
  score numeric not null default 0,
  sugestao_ia jsonb,
  historico jsonb not null default '[]'::jsonb,
  arquivo_path text,
  chat_thread_id uuid,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
-- Nunca dois work_items ABERTOS pra mesma origem (evita duplicar se o
-- publicador rodar de novo antes do primeiro ser resolvido). Resolvidos não
-- entram nessa restrição — histórico pode ter várias linhas resolvidas.
create unique index if not exists work_items_origem_aberto_idx
  on public.work_items(origem_ref) where status in ('aberto','em_analise');
create index if not exists work_items_empresa_score_idx
  on public.work_items(empresa_id, score desc) where status in ('aberto','em_analise');

alter table public.events enable row level security;
drop policy if exists "events select by empresa" on public.events;
create policy "events select by empresa" on public.events
  for select using (empresa_id in (select empresa_id from public.usuario_empresas where user_id = auth.uid()));

alter table public.work_items enable row level security;
drop policy if exists "work_items select by empresa" on public.work_items;
create policy "work_items select by empresa" on public.work_items
  for select using (empresa_id in (select empresa_id from public.usuario_empresas where user_id = auth.uid()));
-- Sem policy de insert/update/delete pro client: toda escrita passa por
-- rota server-side (service role), mesmo padrão de usuario_empresas.

-- Fix: linhas novas de extrato_bancario nasciam com status_classificacao
-- 'confirmada' por default (nunca precisavam de revisão), porque só quem
-- setava esse campo explicitamente era o motor lazy da tela Extrato. Com o
-- Action Engine classificando na ingestão (Task 5), o default correto pra
-- uma linha nova é "ainda não foi vista" — 'sugerida'.
alter table public.extrato_bancario
  alter column status_classificacao set default 'sugerida';
```

- [ ] **Step 2: Aplicar no Supabase**

Aplicar via SQL Editor do projeto Supabase (padrão deste repo) ou `npx supabase db push` se o CLI estiver linkado. Verificar com:

```sql
SELECT table_name FROM information_schema.tables WHERE table_name IN ('events','work_items');
SELECT indexname FROM pg_indexes WHERE tablename = 'work_items' AND indexname = 'work_items_origem_aberto_idx';
SELECT column_default FROM information_schema.columns WHERE table_name = 'extrato_bancario' AND column_name = 'status_classificacao';
```
Expected: 2 linhas na primeira query, 1 linha na segunda, `'sugerida'::text` na terceira.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260715000000_action_engine.sql
git commit -m "feat(action-engine): tabelas events/work_items + RLS + dedup"
```

---

### Task 2: `lib/action-engine/types.ts` e `score.ts`

**Files:**
- Create: `lib/action-engine/types.ts`
- Create: `lib/action-engine/score.ts`

- [ ] **Step 1: Criar `lib/action-engine/types.ts`**

```ts
// Tipos do Action Engine — ver docs/superpowers/specs/2026-07-15-action-engine-design.md

export type TipoEvento = 'transaction_received' | 'document_uploaded' | 'tax_due'
export type OrigemWorkItem = 'open_finance' | 'documento' | 'obrigacao_fiscal'
export type ResponsavelPapel = 'financeiro' | 'contador' | 'dono'
export type StatusWorkItem = 'aberto' | 'em_analise' | 'resolvido' | 'ignorado'

export type HistoricoEntrada = {
  em: string
  quem: string // 'sistema' | 'ia' | e-mail de quem resolveu manualmente
  acao: string
  detalhe?: Record<string, unknown>
}

export type RegistrarResultadoParams = {
  empresaId: string
  eventoId?: string | null
  tipo: TipoEvento
  origem: OrigemWorkItem
  origemRef: string
  responsavelPapel: ResponsavelPapel
  resolvidoAutomaticamente: boolean
  prazo?: string | null
  impactoValor?: number | null
  sugestaoIa?: Record<string, unknown> | null
  arquivoPath?: string | null
  decisaoDetalhe?: Record<string, unknown>
}
```

- [ ] **Step 2: Criar `lib/action-engine/score.ts`**

```ts
import type { TipoEvento } from './types'

// Score determinístico (decisão explícita: não é a IA que prioriza a fila,
// é config auditável). base por tipo + urgência de prazo + impacto
// financeiro (log, não linear) + tempo parado sem ninguém olhar.
const PESO_BASE: Record<TipoEvento, number> = {
  tax_due: 70,
  transaction_received: 30,
  document_uploaded: 20,
}

function pesoPrazo(prazo: string | null): number {
  if (!prazo) return 0
  const dias = Math.floor((new Date(`${prazo}T00:00:00`).getTime() - Date.now()) / 86_400_000)
  if (dias <= 0) return 30
  if (dias <= 2) return 25
  if (dias <= 7) return 12
  return 0
}

function pesoValor(valor: number | null): number {
  if (!valor || valor <= 0) return 0
  return Math.min(20, Math.log10(valor + 1) * 4)
}

function pesoEspera(criadoEm: Date): number {
  const horas = (Date.now() - criadoEm.getTime()) / 3_600_000
  return Math.min(10, (horas / 24) * 2)
}

export function calcularScore(params: {
  tipo: TipoEvento
  prazo: string | null
  impactoValor: number | null
  criadoEm?: Date
}): number {
  const base = PESO_BASE[params.tipo]
  const total = base + pesoPrazo(params.prazo) + pesoValor(params.impactoValor) + pesoEspera(params.criadoEm ?? new Date())
  return Math.round(total)
}
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros novos relacionados a `lib/action-engine/`.

- [ ] **Step 4: Commit**

```bash
git add lib/action-engine/types.ts lib/action-engine/score.ts
git commit -m "feat(action-engine): tipos + função de score determinístico"
```

---

### Task 3: `lib/action-engine/registrarResultado.ts`

**Files:**
- Create: `lib/action-engine/registrarResultado.ts`

- [ ] **Step 1: Criar a função**

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { calcularScore } from './score'
import type { HistoricoEntrada, RegistrarResultadoParams } from './types'

/**
 * Único ponto de escrita em work_items. Duas formas de sair:
 * - resolvidoAutomaticamente: true  → nasce com status 'resolvido' e
 *   resolved_at preenchido. Nunca aparece pro usuário, mas fica rastreável
 *   (auditoria, métrica futura do Intelligence).
 * - resolvidoAutomaticamente: false → nasce 'aberto', aparece no Cockpit
 *   conforme o score, alguém precisa agir.
 *
 * Retorna null (sem lançar erro) quando já existe um work_item ABERTO pra
 * mesma origem_ref — é o dedup esperado (unique index parcial), não falha.
 */
export async function registrarResultado(
  db: SupabaseClient,
  params: RegistrarResultadoParams
): Promise<string | null> {
  const agora = new Date()
  const score = calcularScore({
    tipo: params.tipo,
    prazo: params.prazo ?? null,
    impactoValor: params.impactoValor ?? null,
    criadoEm: agora,
  })

  const historico: HistoricoEntrada[] = params.resolvidoAutomaticamente
    ? [{ em: agora.toISOString(), quem: 'ia', acao: 'resolvido_automaticamente', detalhe: params.decisaoDetalhe ?? {} }]
    : [{ em: agora.toISOString(), quem: 'sistema', acao: 'criado' }]

  const { data, error } = await db
    .from('work_items')
    .insert({
      empresa_id: params.empresaId,
      event_id: params.eventoId ?? null,
      tipo: params.tipo,
      origem: params.origem,
      origem_ref: params.origemRef,
      responsavel_papel: params.responsavelPapel,
      status: params.resolvidoAutomaticamente ? 'resolvido' : 'aberto',
      prazo: params.prazo ?? null,
      impacto_valor: params.impactoValor ?? null,
      score,
      sugestao_ia: params.sugestaoIa ?? null,
      arquivo_path: params.arquivoPath ?? null,
      historico,
      resolved_at: params.resolvidoAutomaticamente ? agora.toISOString() : null,
    })
    .select('id')
    .single()

  if (error) {
    if ((error as { code?: string }).code === '23505') return null
    throw new Error(`registrarResultado falhou (${params.origemRef}): ${error.message}`)
  }
  return data.id as string
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros novos em `lib/action-engine/`.

- [ ] **Step 3: Commit**

```bash
git add lib/action-engine/registrarResultado.ts
git commit -m "feat(action-engine): registrarResultado (único ponto de escrita em work_items)"
```

---

### Task 4: Publicador — `document_uploaded` (Cofre Fiscal)

**Files:**
- Modify: `app/api/cofre-fiscal/route.ts:71-79`

- [ ] **Step 1: Publicar evento após salvar o documento**

Documento sempre precisa de revisão humana em v1 (não há "confiança" pra documento — é o contador quem processa). Substituir o bloco de insert (linhas 71-78) por:

```ts
  const { data, error } = await service
    .from('cofre_fiscal_documentos')
    .insert({ empresa_id: empresaId, tipo, nome, descricao, competencia, arquivo_path: arquivoPath, criado_por: user.id })
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { registrarResultado } = await import('@/lib/action-engine/registrarResultado')
  await registrarResultado(service, {
    empresaId,
    tipo: 'document_uploaded',
    origem: 'documento',
    origemRef: `cofre_fiscal_documentos:${data.id}`,
    responsavelPapel: 'contador',
    resolvidoAutomaticamente: false,
    sugestaoIa: null,
    arquivoPath,
  })

  return NextResponse.json({ ok: true, id: data.id })
```

Import dinâmico (`await import`) segue o padrão já usado nesta mesma rota (linha 87, `bloquearSeLeitura`) — evita import estático no topo do arquivo pra função usada só num branch.

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 3: Exercitar o fluxo real**

Com o servidor rodando (`npm run dev`) e um login válido, subir um documento pela tela `/dashboard/contabil-fiscal/cofre-fiscal` (botão "Guardar documento"). Depois, checar no Supabase:

```sql
select id, tipo, origem, origem_ref, status, responsavel_papel
from work_items
where origem = 'documento'
order by created_at desc limit 1;
```
Expected: 1 linha, `status = 'aberto'`, `origem_ref` no formato `cofre_fiscal_documentos:<uuid do documento recém-criado>`.

- [ ] **Step 4: Commit**

```bash
git add app/api/cofre-fiscal/route.ts
git commit -m "feat(action-engine): Cofre Fiscal publica document_uploaded"
```

---

### Task 5: Publicador — `transaction_received` (Open Finance / Banco PJ)

**Files:**
- Modify: `app/api/cron/belvo-sync/route.ts:135-155`

- [ ] **Step 1: Trocar a classificação cega por classificação com confiança**

O bloco atual (linhas 135-155) categoriza toda linha pendente com `categorizarLoteIA` direto, sem checar confiança nem gerar rastro — é exatamente o "cada módulo decide sozinho" que o Action Engine substitui. Trocar por `classificarLote` (já existe, já tem confiança por estabelecimento aprendido) agrupado por empresa, decidindo por linha se resolve sozinho ou vira work_item.

Substituir o bloco inteiro (da linha `// Classificação automática:` até o fechamento do `if (pendentes?.length)`) por:

```ts
  // Classificação automática via Action Engine: linhas sem categoria
  // inseridas na última hora. Confiança >= 3 (estabelecimento já confirmado
  // 3+ vezes por essa empresa) resolve sozinho; caso contrário vira work_item
  // pro usuário confirmar em /dashboard/banco/extrato.
  const { data: pendentes } = await db
    .from('extrato_bancario')
    .select('id, descricao, contraparte_nome, categoria, valor, empresa_id')
    .or('categoria.eq.Outros,categoria.is.null')
    .gte('created_at', new Date(Date.now() - 3600_000).toISOString())
    .limit(500)

  if (pendentes?.length) {
    const { classificarLote, confirmarClassificacao } = await import('@/lib/financeiro/motorClassificacao')
    const { registrarResultado } = await import('@/lib/action-engine/registrarResultado')
    const CATEGORIAS_PJ = ['Fornecedores', 'Marketing', 'Impostos/Taxas', 'Folha de Pagamento', 'Serviços de Terceiros', 'Aluguel/Infraestrutura', 'Tecnologia/Software', 'Assinaturas', 'Consultoria', 'Outros']
    const LIMIAR_CONFIANCA_AUTO = 3

    const porEmpresa = new Map<string, typeof pendentes>()
    for (const p of pendentes) {
      const eid = p.empresa_id as string
      if (!eid) continue
      if (!porEmpresa.has(eid)) porEmpresa.set(eid, [])
      porEmpresa.get(eid)!.push(p)
    }

    for (const [empresaId, linhas] of porEmpresa) {
      const itens = linhas.map(l => ({ id: l.id as string, texto: [l.descricao, l.contraparte_nome].filter(Boolean).join(' · ') }))
      const resultados = await classificarLote(db, { empresaId }, itens, CATEGORIAS_PJ)
      const porId = new Map(resultados.map(r => [r.id, r]))

      for (const linha of linhas) {
        const r = porId.get(linha.id as string)
        if (!r) continue
        const resolveSozinho = r.status === 'aguardando_ok' && r.confianca >= LIMIAR_CONFIANCA_AUTO
        const novoStatus = resolveSozinho ? 'confirmada' : r.status

        await db.from('extrato_bancario').update({ categoria: r.categoria, status_classificacao: novoStatus }).eq('id', linha.id)
        if (resolveSozinho) {
          await confirmarClassificacao(db, { empresaId }, [linha.descricao, linha.contraparte_nome].filter(Boolean).join(' · '), r.categoria)
        }

        await registrarResultado(db, {
          empresaId,
          tipo: 'transaction_received',
          origem: 'open_finance',
          origemRef: `extrato_bancario:${linha.id}`,
          responsavelPapel: 'financeiro',
          resolvidoAutomaticamente: resolveSozinho,
          impactoValor: Math.abs(Number(linha.valor) || 0),
          sugestaoIa: { categoria: r.categoria, confianca: r.confianca },
          decisaoDetalhe: resolveSozinho ? { categoria: r.categoria, confianca: r.confianca } : undefined,
        })
      }
    }
  }
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros novos. Se `classificarLote`/`confirmarClassificacao` não baterem assinatura, conferir contra `lib/financeiro/motorClassificacao.ts` (já existe no repo, não modificar esse arquivo).

- [ ] **Step 3: Exercitar o fluxo real**

Chamar a rota manualmente com o secret do cron (ver `CRON_SECRET` no `.env`):

```bash
curl -X POST http://localhost:3000/api/cron/belvo-sync -H "Authorization: Bearer $CRON_SECRET"
```

Checar no Supabase (ajustar pra uma empresa com Open Finance conectado e transação nova sem categoria):

```sql
select status_classificacao, categoria from public.extrato_bancario
where created_at > now() - interval '1 hour' order by created_at desc limit 5;

select tipo, origem, status, sugestao_ia from public.work_items
where tipo = 'transaction_received' order by created_at desc limit 5;
```
Expected: linhas com `status_classificacao` diferente do default antigo (`'confirmada'` cego); work_items com `sugestao_ia` preenchido — `status='resolvido'` pras de alta confiança, `status='aberto'` pras novas.

- [ ] **Step 4: Commit**

```bash
git add app/api/cron/belvo-sync/route.ts
git commit -m "feat(action-engine): belvo-sync classifica com confiança e publica transaction_received"
```

---

### Task 6: Publicador — `tax_due` (obrigação fiscal vencendo)

**Files:**
- Modify: `app/api/cron/automacoes-fase3/route.ts`

- [ ] **Step 1: Adicionar a task ao cron existente**

Modificar o array `tasks` (dentro de `POST`) pra incluir a nova função:

```ts
    const tasks = [
      processarCartaosNaoClassificados(),
      processarLeadsSemTemperatura(),
      verificarSaldosCriticos(),
      verificarObrigacoesFiscaisVencendo(),
    ]
```

E no map de nomes das tasks, logo abaixo, atualizar:

```ts
        task: ['cartoes', 'leads', 'saldos', 'obrigacoes_fiscais'][i],
```

Adicionar a função no final do arquivo (mesmo nível das outras `async function processar...`/`verificar...` já existentes):

```ts
async function verificarObrigacoesFiscaisVencendo() {
  const { registrarResultado } = await import('@/lib/action-engine/registrarResultado')
  const emTresDias = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10)

  const { data: obrigacoes } = await supabaseAdmin
    .from('tax_obrigacoes')
    .select('id, nome, tipo, vencimento, valor, empresa_id, status')
    .not('status', 'in', '(pago,entregue)')
    .lte('vencimento', emTresDias)

  let criados = 0
  for (const o of obrigacoes ?? []) {
    const id = await registrarResultado(supabaseAdmin, {
      empresaId: o.empresa_id as string,
      tipo: 'tax_due',
      origem: 'obrigacao_fiscal',
      origemRef: `tax_obrigacoes:${o.id}`,
      responsavelPapel: 'contador',
      resolvidoAutomaticamente: false,
      prazo: o.vencimento as string,
      impactoValor: o.valor != null ? Number(o.valor) : null,
      sugestaoIa: { nome: o.nome, tipo: o.tipo },
    })
    if (id) criados++
  }
  return { verificadas: (obrigacoes ?? []).length, work_items_criados: criados }
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 3: Exercitar o fluxo real**

```bash
curl -X POST http://localhost:3000/api/cron/automacoes-fase3 -H "Authorization: Bearer $CRON_SECRET"
```
Expected na resposta JSON: um item com `"task": "obrigacoes_fiscais"` e `"status": "fulfilled"`. Checar no Supabase:

```sql
select tipo, origem, prazo, impacto_valor, status from public.work_items
where tipo = 'tax_due' order by created_at desc limit 5;
```
Rodar o mesmo `curl` de novo imediatamente depois — `work_items_criados` da segunda chamada deve ser `0` pras mesmas obrigações (dedup funcionando via unique index).

- [ ] **Step 4: Commit**

```bash
git add app/api/cron/automacoes-fase3/route.ts
git commit -m "feat(action-engine): cron publica tax_due pra obrigação fiscal vencendo"
```

---

### Task 7: API — listar e resolver work items

**Files:**
- Create: `app/api/action-engine/work-items/route.ts`
- Create: `app/api/action-engine/work-items/[id]/resolver/route.ts`

- [ ] **Step 1: Criar `app/api/action-engine/work-items/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseUser } from '@/lib/supabase-route'

export const runtime = 'nodejs'

function svc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// Lista work_items da empresa ativa do login, ordenados por score desc.
// ?origem=documento|open_finance|obrigacao_fiscal filtra por origem.
// ?status=todos inclui resolvido/ignorado (default: só aberto/em_analise).
export async function GET(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = (u?.empresa_id as string) ?? user.id

  const { searchParams } = new URL(req.url)
  const origem = searchParams.get('origem')
  const incluirResolvidos = searchParams.get('status') === 'todos'

  const service = svc()
  let query = service
    .from('work_items')
    .select('id, tipo, origem, origem_ref, responsavel_papel, status, prazo, impacto_valor, score, sugestao_ia, historico, arquivo_path, created_at, resolved_at')
    .eq('empresa_id', empresaId)
    .order('score', { ascending: false })
    .limit(100)

  if (origem) query = query.eq('origem', origem)
  if (!incluirResolvidos) query = query.in('status', ['aberto', 'em_analise'])

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ work_items: data ?? [] })
}
```

- [ ] **Step 2: Criar `app/api/action-engine/work-items/[id]/resolver/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseUser } from '@/lib/supabase-route'

export const runtime = 'nodejs'

function svc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// Marca um work_item como resolvido manualmente. Papel: contador PODE
// resolver (é o dono do fluxo de bookkeeping, mesma exceção já usada em
// /api/cofre-fiscal); só 'viewer' é bloqueado.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = (u?.empresa_id as string) ?? user.id

  const { getPapelParaEmpresa } = await import('@/lib/supabase-route')
  const papel = await getPapelParaEmpresa(supabase, user.id, empresaId)
  if (papel === 'viewer') return NextResponse.json({ error: 'Papel viewer tem acesso somente-leitura.' }, { status: 403 })

  const service = svc()
  const { data: item } = await service.from('work_items').select('id, historico, status').eq('id', id).eq('empresa_id', empresaId).maybeSingle()
  if (!item) return NextResponse.json({ error: 'Work item não encontrado' }, { status: 404 })
  if (item.status === 'resolvido') return NextResponse.json({ ok: true, ja_resolvido: true })

  const historico = [...(item.historico as unknown[]), { em: new Date().toISOString(), quem: user.email ?? user.id, acao: 'resolvido_manual' }]
  const { error } = await service.from('work_items').update({ status: 'resolvido', resolved_at: new Date().toISOString(), historico }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 4: Exercitar o fluxo real**

Com um work_item existente (criado na Task 4), pegar o `id` via SQL e chamar:

```bash
curl http://localhost:3000/api/action-engine/work-items?origem=documento -H "Authorization: Bearer <token do login>"
curl -X POST http://localhost:3000/api/action-engine/work-items/<id>/resolver -H "Authorization: Bearer <token do login>"
```
Expected: primeiro retorna o item com `status: "aberto"`; segundo retorna `{"ok":true}`; repetir o GET e o item já não aparece mais (filtro default exclui resolvidos).

- [ ] **Step 5: Commit**

```bash
git add app/api/action-engine
git commit -m "feat(action-engine): rotas GET work-items e POST resolver"
```

---

### Task 8: Cockpit — bloco "Prioridades"

**Files:**
- Modify: `app/dashboard/page.tsx`

- [ ] **Step 1: Buscar work_items no load do dashboard**

Adicionar estado, logo abaixo da declaração de `pendencias` (linha 62):

```ts
  const [prioridades, setPrioridades] = useState<{ id: string; tipo: string; origem: string; score: number; prazo: string | null; impacto_valor: number | null }[]>([])
```

No `useEffect` de load, depois do bloco que já busca `rPendRes/aPendRes/cPagarRes` (por volta da linha 141, logo após `setPendencias(...)`), adicionar:

```ts
        const { data: sess } = await supabase.auth.getSession()
        const tk = sess.session?.access_token ?? ''
        if (tk) {
          const wiRes = await fetch('/api/action-engine/work-items', { headers: { Authorization: `Bearer ${tk}` } })
          if (wiRes.ok) {
            const wiJson = await wiRes.json() as { work_items?: typeof prioridades }
            setPrioridades((wiJson.work_items ?? []).slice(0, 5))
          }
        }
```

- [ ] **Step 2: Renderizar o bloco**

Logo antes do bloco existente de pendências (linha ~404, onde está `{pendencias.aprovacoes}`), adicionar um bloco novo, separado (não substitui o que já existe):

```tsx
              {prioridades.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--mut)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
                    Prioridades
                  </div>
                  {prioridades.map(p => (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 12.5 }}>
                      <span style={{ width: 6, height: 6, borderRadius: 3, background: p.score >= 70 ? '#B0413E' : p.score >= 40 ? '#B08A3E' : 'var(--acc)', flexShrink: 0 }} />
                      <span style={{ color: 'var(--ink)', flex: 1 }}>
                        {p.origem === 'obrigacao_fiscal' ? 'Obrigação fiscal' : p.origem === 'documento' ? 'Documento pendente' : 'Transação a confirmar'}
                        {p.prazo && <span style={{ color: 'var(--mut)' }}> · vence {new Date(`${p.prazo}T12:00:00`).toLocaleDateString('pt-BR')}</span>}
                      </span>
                    </div>
                  ))}
                </div>
              )}
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 4: Exercitar o fluxo real**

Abrir `/dashboard` logado numa empresa que já tenha work_items abertos (das tasks anteriores). Confirmar visualmente que o bloco "Prioridades" aparece com os itens esperados, ordenados por urgência (score), e que o bloco antigo de pendências (reembolsos/aprovações/contas a pagar) continua funcionando do lado dele.

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/page.tsx
git commit -m "feat(action-engine): Cockpit mostra bloco Prioridades (top 5 por score)"
```

---

### Task 9: Rastreador de bookkeeping no Cofre Fiscal

**Files:**
- Modify: `app/dashboard/contabil-fiscal/cofre-fiscal/page.tsx`

- [ ] **Step 1: Buscar work_items de documento junto com os documentos**

No tipo `Doc` (linha 15-19), adicionar campo opcional:

```ts
type Doc = {
  id: string; tipo: string; nome: string; descricao: string | null
  competencia: string | null; arquivo_path: string | null; created_at: string
  origem: 'cofre' | 'obrigacao'
  workItemId?: string; workItemStatus?: 'aberto' | 'em_analise' | 'resolvido' | 'ignorado'
}
```

Na função `carregar` (linha 53-80), depois do `Promise.all` que busca `cofreRes`/`obrigRes`, adicionar a busca de work_items e cruzar pelo `origem_ref`:

```ts
      const wiRes = await fetch('/api/action-engine/work-items?origem=documento&status=todos', { headers: await auth() })
      const wiJson = wiRes.ok ? await wiRes.json() as { work_items?: { id: string; origem_ref: string; status: string }[] } : { work_items: [] }
      const statusPorDocId = new Map((wiJson.work_items ?? []).map(w => [w.origem_ref.replace('cofre_fiscal_documentos:', ''), w]))
```

E ao montar `doCofre` (linha 66), incluir o cruzamento:

```ts
      const doCofre: Doc[] = ((cofreRes.data ?? []) as Omit<Doc, 'origem' | 'workItemId' | 'workItemStatus'>[]).map(d => {
        const wi = statusPorDocId.get(d.id)
        return { ...d, origem: 'cofre' as const, workItemId: wi?.id, workItemStatus: wi?.status as Doc['workItemStatus'] }
      })
```

- [ ] **Step 2: Ação "Marcar como processado"**

Adicionar função, próxima das outras (`excluir`, `reenviar`):

```ts
  async function marcarProcessado(doc: Doc) {
    if (!doc.workItemId) return
    setAcaoEm(doc.id)
    try {
      const res = await fetch(`/api/action-engine/work-items/${doc.workItemId}/resolver`, { method: 'POST', headers: await auth() })
      const d = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok || !d.ok) throw new Error(d.error || 'Falha ao marcar como processado')
      toast.success('Documento marcado como processado')
      void carregar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro')
    } finally { setAcaoEm(null) }
  }
```

- [ ] **Step 3: Mostrar o chip de status e o botão**

Na lista (por volta da linha 196-204, dentro do `filtrados.map`), depois do bloco de nome/descrição, adicionar o chip — estilo rastreio de encomenda:

```tsx
              {d.workItemStatus && d.workItemStatus !== 'resolvido' && (
                <span className="chip-v2 y" style={{ flexShrink: 0 }}>Aguardando contador</span>
              )}
              {d.workItemStatus === 'resolvido' && (
                <span className="chip-v2 g" style={{ flexShrink: 0 }}>Processado</span>
              )}
```

E no grupo de botões de ação (linha 205-212), adicionar antes do botão de excluir:

```tsx
              {d.workItemId && d.workItemStatus !== 'resolvido' && (
                <button title="Marcar como processado" className="btn-v2" style={{ padding: '5px 9px' }} disabled={!!acaoEm} onClick={() => void marcarProcessado(d)}>
                  <i className="fa-solid fa-check" style={{ fontSize: 12, color: '#2E7D32' }} />
                </button>
              )}
```

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 5: Exercitar o fluxo real**

Abrir `/dashboard/contabil-fiscal/cofre-fiscal`. Um documento subido na Task 4 deve aparecer com o chip "Aguardando contador". Clicar no botão de check (marcar como processado) e confirmar que o chip muda pra "Processado" e o botão de check some.

- [ ] **Step 6: Commit**

```bash
git add app/dashboard/contabil-fiscal/cofre-fiscal/page.tsx
git commit -m "feat(action-engine): rastreador de bookkeeping no Cofre Fiscal (chip + marcar processado)"
```

---

### Task 10: Revisão final

- [ ] **Step 1: Rodar `rls-tenant-guardian`**

Focar em: migration `20260715000000_action_engine.sql` (RLS de `events`/`work_items`) e as 2 rotas novas em `app/api/action-engine/`. Checar principalmente que `work-items/route.ts` nunca aceita `empresa_id` vindo do client (sempre resolve via `usuarios.empresa_id` do usuário autenticado).

- [ ] **Step 2: Rodar `factorone-reviewer`**

Revisão geral do diff acumulado desta feature (Tasks 1-9).

- [ ] **Step 3: Corrigir achados, se houver, e commitar**

```bash
git add -A
git commit -m "fix(action-engine): ajustes da revisão de segurança/qualidade"
```

- [ ] **Step 4: Build final**

Run: `npm run build`
Expected: build passa sem erro.

---

## Fora deste plano (registrado no spec, não construído agora)

- CRM/Marketing/Agenda publicando eventos (`lead_created`, `meeting_created`, `invoice_generated`).
- Donna consumindo `work_items` pra notificar proativamente via WhatsApp/Telegram.
- Intelligence consumindo `work_items` pra análise histórica.
- UI de chat por work_item (`chat_thread_id` existe na tabela, sem tela).
- Migrar `reembolsos`/`despesas.pendente_aprovacao` pro Action Engine (Cockpit continua com os dois blocos lado a lado por ora).
