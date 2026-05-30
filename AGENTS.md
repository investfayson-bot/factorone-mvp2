# AGENTS.md — FactorOne

Este arquivo define o contexto completo do projeto para todos os agentes de IA.
Leia inteiro antes de qualquer ação. Nunca assuma — consulte este arquivo.

---

## Identidade do produto

- Nome: **FactorOne**
- O que é: SaaS financeiro para PMEs brasileiras
- IA interna: sempre chamada de **"FactorOne AI"** — NUNCA mencionar Claude ou Anthropic na UI
- Sem emojis em relatórios Excel ou PDF

---

## Stack técnica

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js 16.2 (App Router) |
| Backend | Supabase (PostgreSQL + Auth + Storage) |
| IA | Claude API (Anthropic) |
| Deploy | Vercel (auto-deploy no push para main) |
| Pagamentos | Stripe |
| Banco digital | Swap API |

---

## Estrutura de pastas

```
/ (raiz)
├── app/              ← todas as rotas e páginas (App Router)
├── components/       ← componentes React reutilizáveis
├── lib/              ← utilitários, clientes Supabase, helpers
├── public/           ← assets estáticos
└── AGENTS.md         ← este arquivo
```

**Não existe pasta src/** — tudo fica em `app/`, `components/` e `lib/` diretamente na raiz.

---

## Padrões obrigatórios de código

### Autenticação em API Routes
```typescript
import { getSupabaseUser } from '@/lib/supabase-route'

export async function GET(req: Request) {
  const { user, supabase, error } = await getSupabaseUser(req)
  if (error || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  // seu código aqui
}
```

### Cliente Supabase no frontend (Client Components)
```typescript
import { supabase } from '@/lib/supabase'
```

### Cliente Supabase no servidor (Server Components)
```typescript
import { createServerSupabase } from '@/lib/supabase-server'
const supabase = createServerSupabase()
```

### empresa_id — regra crítica
- Toda tabela tem `empresa_id` que referencia a tabela `empresas`
- Nunca use o `user.id` como empresa_id — busque sempre da tabela `usuarios`
- Padrão de busca:
```typescript
const { data: usuario } = await supabase
  .from('usuarios')
  .select('empresa_id')
  .eq('id', user.id)
  .single()

const empresa_id = usuario?.empresa_id
```

### RLS (Row Level Security) — padrão para todas as tabelas
```sql
CREATE POLICY "usuarios_empresa" ON nome_da_tabela
  FOR ALL USING (
    empresa_id IN (
      SELECT empresa_id FROM usuarios WHERE id = auth.uid()
    )
  );
```

---

## Banco de dados — status atual

### Tabelas funcionando normalmente
```
transacoes
metricas
invoices
perfil_usuario
contas_pagar
contas_receber
centros_custo
empresas
usuarios
notas_fiscais
```

### Tabelas com problema conhecido
```
despesas        ← FK errada (aponta para tabela errada) — P0 para corrigir
centros_custo   ← FK corrigida mas não carrega no frontend
```

### Tabelas que NÃO existem ainda (precisam ser criadas)
```
reembolsos
aprovacoes
cartoes
solicitacoes_cartao
patrimonio
orcamento
audit_log
company_members
portal_contador
lifeos_sessions
```

### Padrão para criar nova tabela
```sql
CREATE TABLE nome_tabela (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
  -- adicionar colunas específicas aqui
);

ALTER TABLE nome_tabela ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuarios_empresa" ON nome_tabela
  FOR ALL USING (
    empresa_id IN (
      SELECT empresa_id FROM usuarios WHERE id = auth.uid()
    )
  );

CREATE INDEX idx_nome_tabela_empresa ON nome_tabela(empresa_id);
```

---

## Status dos módulos

### Funcionando — pode mostrar para cliente
- Auth (login, signup, Google OAuth, magic link)
- Dashboard (KPIs e gráficos com dados reais)
- FactorOne AI (chat, cards visuais, export Excel/PDF, WhatsApp, Email)
- Insights proativos (popup flutuante com contexto tributário)
- Financeiro (contas a pagar e receber — CRUD completo)
- Onboarding (seleção PJ/PF, salva no banco)
- Deploy (Vercel com auto-deploy)

### Quebrado — corrigir antes de mostrar para cliente
- Despesas (FK errada, modal quebrado, criar falha)
- Cash Flow (tela existe, zerada, sem conexão ao banco)
- DRE Auto (lib de cálculo existe mas não conectada)
- Conciliação (dados mockados)
- Modais (layout inconsistente entre módulos)
- Categorização (bugs ao criar e editar)

### Só visual — sem backend
- Cartões corporativos
- Conta PJ
- Reembolsos
- Aprovações
- Fiscal / NF-e (parcial)
- Orçamento
- Patrimônio
- Contabilidade
- Relatórios
- Integrações (Claude, Stripe, Swap ativas — resto é botão sem ação)
- Marketplace (filtros funcionam, sem apps reais)

### Não existe ainda
- Portal do Contador
- OCR real de recibos (simulado apenas)
- Open Finance real (Pluggy — Nubank, Sicredi, PagBank, MercadoPago)
- Emissão NF-e/NFS-e real
- Cálculo tributário automático
- SPED / eSocial / REINF
- LifeOS / WhatsApp webhook
- Conta PJ real (Swap API)
- Cartão corporativo real
- RBAC granular
- Audit log imutável
- MFA obrigatório
- Criptografia AES-256
- KYB real (Serpro)
- Multi-empresa

---

## Prioridades de execução

### P0 — Corrigir agora (quebra o produto)
1. Corrigir FK da tabela `despesas` + CRUD completo funcionando
2. Padronizar todos os modais e layouts de página
3. Conectar Cash Flow aos dados reais da tabela `transacoes`
4. Conectar DRE com a lib de cálculo existente
5. Corrigir bugs de Categorização

### P1 — Sprint 1 (necessário para primeiro cliente)
6. Criar tabelas: `reembolsos`, `aprovacoes`, `cartoes`
7. Conectar módulos ao banco com CRUD real
8. OCR real via Google Vision API
9. RBAC completo por role (admin, contador, gestor)
10. Audit log básico

### P2 — Sprint 2 (escala)
11. Emissão NF-e real (NFe.io ou PlugNotas)
12. Open Finance via Pluggy (4 bancos)
13. Cálculo tributário — Simples Nacional primeiro
14. Portal do Contador (MVP)
15. LifeOS WhatsApp webhook

### P3 — Sprint 3 (enterprise)
16. SPED / eSocial
17. Conta PJ real (Swap API)
18. Cartão corporativo real
19. Multi-empresa
20. SOC 2 / LGPD completo

---

## Regras que nunca podem ser quebradas

1. **Nunca mencionar Claude ou Anthropic na UI** — sempre "FactorOne AI"
2. **Nunca usar emojis em relatórios** Excel ou PDF
3. **Sempre usar `empresa_id`** nas queries — nunca `user.id` diretamente
4. **Sempre aplicar RLS** em toda nova tabela criada
5. **Sempre seguir o padrão de imports** de `@/lib/supabase-route`, `@/lib/supabase` e `@/lib/supabase-server`
6. **Nunca criar pasta src/** — estrutura é `app/`, `components/`, `lib/`
7. **Sempre criar índice** em `empresa_id` para toda nova tabela
8. **Antes de criar qualquer coisa**, verificar se já existe em `components/` ou `lib/`

---

## Integrações ativas

| Serviço | Status | Uso |
|---------|--------|-----|
| Claude API | Ativo | FactorOne AI (chat financeiro) |
| Stripe | Ativo | Pagamentos |
| Swap API | Parcial | Conta PJ (não implementado) |
| Vercel | Ativo | Deploy automático |
| Google OAuth | Ativo | Login social |

---

## Como trabalhar neste projeto

Antes de qualquer mudança:
1. Leia este arquivo inteiro
2. Verifique se a tabela envolvida existe e qual seu status
3. Siga o padrão de imports correto para o contexto (client / server / route)
4. Aplique RLS em qualquer nova tabela
5. Teste o fluxo completo antes de commitar

Para bugs: identifique o arquivo → leia o código existente → corrija seguindo os padrões → verifique se há outros módulos com o mesmo problema.

Para novas features: verifique a prioridade (P0→P3) → crie a tabela se necessário → implemente o backend (API route) → implemente o frontend → teste com RLS ativo.

