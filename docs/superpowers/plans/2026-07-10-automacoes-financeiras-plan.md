# Automações financeiras — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer a classificação por IA rodar sozinha todo dia, criar um relatório mensal automático por e-mail, e casar comprovantes com movimentações bancárias sem intervenção manual.

**Architecture:** As três features plugam em infraestrutura que já existe — o cron `belvo-sync`, a função `categorizarLoteIA`, `calcularMetricasMes`, e o padrão de e-mail em `lib/email/notificacoes.ts`. Nenhuma reescrita, só orquestração nova. Este projeto não tem suíte de testes automatizados — verificação é typecheck + chamada manual das rotas.

**Tech Stack:** Next.js API routes (App Router), Supabase (Postgres + service role client), Resend (e-mail), OpenRouter/Gemini (categorização via `categorizarLoteIA`).

---

### Task 1: Classificação automática diária

**Files:**
- Modify: `app/api/cron/belvo-sync/route.ts`

- [ ] **Step 1: Adicionar a categorização em lote ao final do sync**

No fim de `GET` (depois do loop `for (const l of links ?? [])`), antes do `return`, adicionar:

```ts
import { categorizarLoteIA } from '@/lib/categorizar-ia'
```

(adicionar esse import no topo do arquivo, junto dos outros).

Depois do loop de sync, antes do `return NextResponse.json(...)`:

```ts
  // Classificação automática: pega linhas sem categoria (ou 'Outros') inseridas
  // agora e categoriza em lote por IA — mesma função usada no botão manual
  // de /api/conta-pj/categorizar-extrato.
  const { data: pendentes } = await db
    .from('extrato_bancario')
    .select('id, descricao, contraparte_nome, categoria')
    .or('categoria.eq.Outros,categoria.is.null')
    .gte('created_at', new Date(Date.now() - 3600_000).toISOString())
    .limit(500)
  if (pendentes?.length) {
    const itens = pendentes.map(t => ({
      id: t.id as string,
      texto: [t.descricao, t.contraparte_nome].filter(Boolean).join(' · '),
    }))
    const mapa = await categorizarLoteIA(itens)
    await Promise.all(
      Object.entries(mapa).map(([id, categoria]) =>
        db.from('extrato_bancario').update({ categoria }).eq('id', id)
      )
    )
  }

  return NextResponse.json({ links: (links ?? []).length, sincronizados: okCount, transacoes: totalTx, erros })
```

Remover o `return NextResponse.json(...)` original que estava logo após o loop (ele vira o novo, no final, depois do bloco de categorização).

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit -p tsconfig.json
```
Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add app/api/cron/belvo-sync/route.ts
git commit -m "feat(automacao): classifica extrato bancario automaticamente apos o sync diario"
```

---

### Task 2: Matching automático de comprovante ↔ movimentação

**Files:**
- Create: `supabase/migrations/20260710020000_recibo_extrato_match.sql`
- Create: `lib/financeiro/matchComprovante.ts`
- Modify: `app/api/contabilidade/processar-recibo/route.ts`
- Modify: `app/api/cron/belvo-sync/route.ts`

- [ ] **Step 1: Migration — coluna de back-reference**

```sql
-- Liga um recibo fotografado à linha de extrato bancário correspondente,
-- uma vez que o matching automático encontra a movimentação certa.
-- Evita tentar casar o mesmo recibo duas vezes.
ALTER TABLE public.recibos_fotografados
  ADD COLUMN IF NOT EXISTS extrato_bancario_id uuid REFERENCES public.extrato_bancario(id);

CREATE INDEX IF NOT EXISTS idx_recibos_extrato_pendente
  ON public.recibos_fotografados(empresa_id)
  WHERE extrato_bancario_id IS NULL;
```

- [ ] **Step 2: Função de matching isolada**

Criar `lib/financeiro/matchComprovante.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'

const TOLERANCIA_CENTAVOS = 0.01
const JANELA_DIAS = 2

/**
 * Tenta achar UMA linha de extrato_bancario que bate com o valor/data de um
 * recibo processado por OCR, e anexa o comprovante nela. Se achar zero ou
 * mais de uma correspondência, não faz nada — errar o match é pior que não
 * casar automaticamente.
 */
export async function matchComprovante(
  db: SupabaseClient,
  empresaId: string,
  reciboId: string,
  valor: number,
  data: string,
  imagemUrl: string
): Promise<boolean> {
  const dataIni = new Date(data)
  dataIni.setDate(dataIni.getDate() - JANELA_DIAS)
  const dataFim = new Date(data)
  dataFim.setDate(dataFim.getDate() + JANELA_DIAS)

  const { data: candidatos } = await db
    .from('extrato_bancario')
    .select('id, valor')
    .eq('empresa_id', empresaId)
    .is('comprovante_url', null)
    .gte('data_transacao', dataIni.toISOString().slice(0, 10))
    .lte('data_transacao', dataFim.toISOString().slice(0, 10))

  const bateValor = (candidatos ?? []).filter(
    c => Math.abs(Number(c.valor) - valor) <= TOLERANCIA_CENTAVOS
  )
  if (bateValor.length !== 1) return false

  const alvo = bateValor[0]
  const { error } = await db
    .from('extrato_bancario')
    .update({ comprovante_url: imagemUrl })
    .eq('id', alvo.id)
  if (error) return false

  await db.from('recibos_fotografados').update({ extrato_bancario_id: alvo.id }).eq('id', reciboId)
  return true
}

/**
 * Varre recibos ainda sem match (extrato_bancario_id IS NULL) de uma empresa
 * e tenta casar cada um contra o extrato — usado pelo cron diário, para o
 * caso em que o recibo chegou antes da movimentação aparecer no Open Finance.
 */
export async function matchComprovantesPendentes(db: SupabaseClient, empresaId: string): Promise<number> {
  const { data: pendentes } = await db
    .from('recibos_fotografados')
    .select('id, valor_extraido, data_extraida, imagem_url')
    .eq('empresa_id', empresaId)
    .is('extrato_bancario_id', null)
    .not('valor_extraido', 'is', null)
    .not('data_extraida', 'is', null)

  let casados = 0
  for (const r of pendentes ?? []) {
    const ok = await matchComprovante(
      db,
      empresaId,
      r.id as string,
      Number(r.valor_extraido),
      r.data_extraida as string,
      r.imagem_url as string
    )
    if (ok) casados++
  }
  return casados
}
```

- [ ] **Step 3: Chamar o matching logo após o OCR do recibo**

Em `app/api/contabilidade/processar-recibo/route.ts`, adicionar o import:

```ts
import { matchComprovante } from '@/lib/financeiro/matchComprovante'
```

E logo depois do bloco que atualiza `recibos_fotografados` com os dados extraídos (após o `await service.from('recibos_fotografados').update({...}).eq('id', insertRecibo.data.id)` e antes do `return NextResponse.json({...})` final), adicionar:

```ts
    if (ocr.valor > 0) {
      await matchComprovante(service, empresaId, insertRecibo.data.id as string, ocr.valor, ocr.data, path)
    }
```

- [ ] **Step 4: Rodar o matching pendente dentro do cron diário**

Em `app/api/cron/belvo-sync/route.ts`, adicionar o import:

```ts
import { matchComprovantesPendentes } from '@/lib/financeiro/matchComprovante'
```

Dentro do loop `for (const l of links ?? [])`, logo após `await syncNativo(db, owner, accounts, txs)`, adicionar:

```ts
      if (owner.empresa_id) await matchComprovantesPendentes(db, owner.empresa_id)
```

- [ ] **Step 5: Typecheck**

```bash
npx tsc --noEmit -p tsconfig.json
```
Esperado: sem erros.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260710020000_recibo_extrato_match.sql lib/financeiro/matchComprovante.ts app/api/contabilidade/processar-recibo/route.ts app/api/cron/belvo-sync/route.ts
git commit -m "feat(automacao): casa comprovante com movimentacao bancaria automaticamente"
```

**Nota:** essa migration precisa ser rodada manualmente no Supabase SQL Editor (sem CLI/DB connection string configurados neste ambiente — mesmo caminho da migration anterior).

---

### Task 3: Relatório mensal automático por e-mail

**Files:**
- Create: `supabase/migrations/20260710030000_relatorio_mensal_config.sql`
- Create: `app/api/cron/relatorio-mensal/route.ts`
- Modify: `lib/email/notificacoes.ts`
- Modify: `vercel.json`
- Modify: `app/dashboard/equipe/page.tsx`

- [ ] **Step 1: Migration — nível de detalhe configurável**

```sql
-- Nível de detalhe do relatório mensal automático enviado por e-mail ao
-- admin da empresa. 'resumo' = receita/despesa/saldo do mês. 'completo' =
-- resumo + quebra por categoria (mesma fonte de dado do DRE).
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS relatorio_mensal_nivel text
  CHECK (relatorio_mensal_nivel IN ('resumo', 'completo')) DEFAULT 'resumo';
```

- [ ] **Step 2: Função de e-mail em `lib/email/notificacoes.ts`**

Adicionar ao final do arquivo (mesmo padrão de `emailDasAlert`/`emailSaldoBaixo`):

```ts
export async function emailRelatorioMensal(
  para: string,
  nomeEmpresa: string,
  competenciaLabel: string,
  metricas: { receita_bruta: number; despesas_operacionais: number; lucro_liquido: number },
  variacaoLucroPct: number | null
): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) return false
  const variacaoTxt = variacaoLucroPct === null
    ? ''
    : `<div style="font-size:12px;color:${variacaoLucroPct >= 0 ? '#047857' : '#B91C1C'};margin-top:4px">${variacaoLucroPct >= 0 ? '▲' : '▼'} ${Math.abs(variacaoLucroPct).toFixed(1)}% vs. mês anterior</div>`
  const corpo = `
    <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#334155">
      Resumo financeiro de <strong>${nomeEmpresa}</strong> — <strong>${competenciaLabel}</strong>:
    </p>
    <div style="display:flex;gap:16px;margin-bottom:20px">
      <div style="flex:1;background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:14px 16px">
        <div style="font-size:11px;color:#047857;font-weight:700;text-transform:uppercase;letter-spacing:.05em">Receita</div>
        <div style="font-size:18px;font-weight:800;color:#047857;font-family:monospace">${formatBRL(metricas.receita_bruta)}</div>
      </div>
      <div style="flex:1;background:#FEF2F2;border:1px solid #FCA5A5;border-radius:8px;padding:14px 16px">
        <div style="font-size:11px;color:#991B1B;font-weight:700;text-transform:uppercase;letter-spacing:.05em">Despesas</div>
        <div style="font-size:18px;font-weight:800;color:#991B1B;font-family:monospace">${formatBRL(metricas.despesas_operacionais)}</div>
      </div>
    </div>
    <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:14px 16px;margin-bottom:20px">
      <div style="font-size:11px;color:#334155;font-weight:700;text-transform:uppercase;letter-spacing:.05em">Resultado do mês</div>
      <div style="font-size:22px;font-weight:800;color:#0f172a;font-family:monospace">${formatBRL(metricas.lucro_liquido)}</div>
      ${variacaoTxt}
    </div>
    <a href="${APP_URL}/dashboard/relatorios" style="display:inline-block;background:#3D7A6E;color:#fff;text-decoration:none;padding:11px 24px;border-radius:8px;font-size:13px;font-weight:700">
      Ver DRE completo →
    </a>`
  try {
    const { error } = await getResend().emails.send({
      from: FROM, to: para, subject: `Resumo de ${competenciaLabel} — ${nomeEmpresa}`,
      html: baseHtml('#3D7A6E', `Resumo financeiro · ${competenciaLabel}`, corpo, para),
    })
    return !error
  } catch { return false }
}
```

- [ ] **Step 3: Cron novo**

Criar `app/api/cron/relatorio-mensal/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { calcularMetricasMes } from '@/lib/financeiro/calcularMetricas'
import { emailRelatorioMensal } from '@/lib/email/notificacoes'

export const runtime = 'nodejs'
export const maxDuration = 300

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// Roda dia 1 de cada mês (vercel.json). Manda o resumo do mês ANTERIOR pro
// admin de cada empresa ativa. Empresa sem e-mail de admin ou sem
// RESEND_API_KEY configurada é pulada silenciosamente — mesmo padrão de
// tolerância a erro dos outros crons (não derruba o job inteiro).
export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const supabase = db()
  const hoje = new Date()
  const mesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)
  const mesRetrasado = new Date(hoje.getFullYear(), hoje.getMonth() - 2, 1)
  const competenciaLabel = mesAnterior.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  const { data: empresas } = await supabase.from('empresas').select('id, nome, relatorio_mensal_nivel')

  let enviados = 0
  const erros: string[] = []

  for (const emp of empresas ?? []) {
    try {
      const empresaId = emp.id as string
      const { data: dono } = await supabase
        .from('usuarios')
        .select('email')
        .eq('empresa_id', empresaId)
        .not('email', 'is', null)
        .limit(1)
        .maybeSingle()
      if (!dono?.email) continue

      const metricas = await calcularMetricasMes(empresaId, mesAnterior)
      const metricasAnterior = await calcularMetricasMes(empresaId, mesRetrasado)
      const variacaoLucroPct = metricasAnterior.lucro_liquido !== 0
        ? ((metricas.lucro_liquido - metricasAnterior.lucro_liquido) / Math.abs(metricasAnterior.lucro_liquido)) * 100
        : null

      const ok = await emailRelatorioMensal(
        dono.email as string,
        (emp.nome as string) || 'Sua empresa',
        competenciaLabel,
        metricas,
        variacaoLucroPct
      )
      if (ok) enviados++
    } catch (e) {
      erros.push(`${emp.id}: ${e instanceof Error ? e.message : 'erro'}`)
    }
  }

  return NextResponse.json({ empresas: (empresas ?? []).length, enviados, erros })
}
```

- [ ] **Step 4: Agendar no `vercel.json`**

Adicionar ao array `crons`:

```json
    {
      "path": "/api/cron/relatorio-mensal",
      "schedule": "0 9 1 * *"
    }
```

(dia 1 de cada mês, 9h)

- [ ] **Step 5: Toggle de nível de detalhe em `/dashboard/equipe`**

Em `app/dashboard/equipe/page.tsx`, adicionar estado e um controle simples perto do topo da página (dentro do `page-hdr`, antes do botão "Convidar membro"):

No topo do componente, junto dos outros `useState`:

```ts
const [nivelRelatorio, setNivelRelatorio] = useState<'resumo' | 'completo'>('resumo')
```

Dentro de `carregar()`, depois de obter `eid`, adicionar:

```ts
    const { data: emp } = await supabase.from('empresas').select('relatorio_mensal_nivel').eq('id', eid).maybeSingle()
    if (emp?.relatorio_mensal_nivel) setNivelRelatorio(emp.relatorio_mensal_nivel as 'resumo' | 'completo')
```

Adicionar a função de salvar:

```ts
async function salvarNivelRelatorio(nivel: 'resumo' | 'completo') {
  setNivelRelatorio(nivel)
  await supabase.from('empresas').update({ relatorio_mensal_nivel: nivel }).eq('id', empresaId)
}
```

No JSX, dentro de `<div className="page-hdr">`, antes do `<button className="btn-action" ...>Convidar membro</button>`, adicionar:

```tsx
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#7B8C88' }}>
          Relatório mensal por e-mail:
          <select value={nivelRelatorio} onChange={e => void salvarNivelRelatorio(e.target.value as 'resumo' | 'completo')} style={{ fontSize: 13, padding: '4px 8px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
            <option value="resumo">Resumo</option>
            <option value="completo">Completo</option>
          </select>
        </div>
```

**Nota:** o cron de Task 3 usa hoje só o nível `'resumo'` (a variante `'completo'` fica de fora do v1 — o spec já registrava isso como possível segunda iteração; guardar como próximo passo, não implementar agora, pra não estourar escopo).

- [ ] **Step 6: Typecheck**

```bash
npx tsc --noEmit -p tsconfig.json
```
Esperado: sem erros.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260710030000_relatorio_mensal_config.sql app/api/cron/relatorio-mensal/route.ts lib/email/notificacoes.ts vercel.json app/dashboard/equipe/page.tsx
git commit -m "feat(automacao): relatorio financeiro mensal automatico por e-mail"
```

**Nota:** ambas as migrations deste plano (Task 2 e Task 3) precisam ser aplicadas manualmente no SQL Editor do Supabase.

---

## Verificação final

1. `npx tsc --noEmit -p tsconfig.json` limpo em todo o plano.
2. Rodar as duas migrations novas no SQL Editor.
3. Chamar cada cron manualmente com o `CRON_SECRET` local para confirmar que não quebra:
   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/belvo-sync
   curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/relatorio-mensal
   ```
4. Subir um recibo de teste com valor/data batendo uma linha do extrato e confirmar que `extrato_bancario.comprovante_url` foi preenchido.
