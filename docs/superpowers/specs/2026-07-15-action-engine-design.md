# Action Engine — Design v1

*Status: aprovado por seções em brainstorming com o Fayson, 2026-07-15. Escopo v1 focado no
vertical Contador (ver `docs/BACKLOG-PRODUTO.md`, seção VERTICAIS REAIS). Arquitetura pensada
pra crescer sem migração, mas só uma fatia é implementada agora.*

## Por que isso existe

O Cockpit hoje (`app/dashboard/page.tsx`) calcula "pendências" com 3 queries soltas e
independentes (reembolsos, aprovações, contas a pagar vencendo). Cada módulo novo que
precisar aparecer no Cockpit teria que inventar sua própria contagem — o mesmo erro que todo
ERP comete ("Banco → pendências, CRM → pendências, Fiscal → pendências", cada um isolado, sem
noção de prioridade real da empresa).

O Action Engine é a fila única que resolve isso: todo módulo publica fatos (Eventos), uma
única camada decide o que precisa de atenção humana (Work Items), e Cockpit/Donna/Intelligence
consomem a mesma fonte.

## Os três conceitos (não confundir)

1. **Event** — um fato que já aconteceu no mundo real. Imutável, só se registra, nunca se
   edita. Ex.: `transaction_received`, `document_uploaded`. Publicado por um módulo.
2. **Action Engine** — a única camada que interpreta Eventos, aplicando regra + IA + score.
   Não é publicado por ninguém, é o processador central.
3. **Work Item** — criado pelo Action Engine só quando a IA não resolveu sozinha (baixa
   confiança) ou quando a natureza do evento exige decisão humana. É o único jeito de pedir
   atenção de alguém no sistema.

Regra dura: **eventos derivados de decisão (ex.: "precisa de revisão") nunca são publicados
por um módulo.** Só o Action Engine decide se algo vira Work Item. Um módulo publica só o que
aconteceu de fato, nunca uma interpretação.

## Fluxo

```
Evento (transaction_received, document_uploaded, ...)
  │
  ▼
Action Engine (regra + IA + score)
  │
  ├── Confiança alta → resolve sozinho
  │     → atualiza o dado no módulo dono (Financeiro/CRM/Fiscal/...)
  │     → SEMPRE grava em Histórico de Decisão da IA (mesmo sem criar Work Item)
  │
  └── Confiança baixa / exige humano → cria Work Item
        → aparece em Cockpit (se score alto o suficiente pro Top 5)
        → Donna pode avisar (WhatsApp/Telegram)
        → quando resolvido por humano, também grava em Histórico
```

"Atualizar estado" e "registrar em histórico" não são ramos alternativos — resolução
automática sempre faz as duas coisas. Sem isso, uma decisão de IA fica invisível e ninguém
consegue auditar depois "por que esse PIX caiu como despesa de marketing".

## Event Catalog v0

Formato do registro: Evento / Descrição / Origem / Publicador / Consumidores / Payload.
Payload sempre usa `empresa_id` (convenção já usada em todo o schema — `usuario_empresas`,
RLS — não introduzir `company_id` como termo novo).

### `transaction_received`
- **Descrição:** nova movimentação financeira registrada.
- **Origem:** Open Finance, Banco PJ, importação OFX/CSV, integrações.
- **Publicador:** Financeiro/Banco.
- **Consumidores:** Action Engine.
- **Payload:** `empresa_id`, `account_id`, `transaction_id`, `merchant`, `amount`, `currency`,
  `description`, `payment_method`, `created_at`, `metadata`.

### `document_uploaded`
- **Descrição:** documento enviado (cliente, contador, ou sistema).
- **Origem:** Portal Cliente, WhatsApp, e-mail, upload manual.
- **Publicador:** Cofre Fiscal / Portal Contador.
- **Consumidores:** Action Engine.
- **Payload:** `empresa_id`, `documento_id`, `tipo`, `competencia`, `enviado_por` (papel:
  cliente/contador/sistema), `arquivo_path`, `created_at`.

### `tax_due`
- **Descrição:** obrigação fiscal com vencimento se aproximando ou vencida.
- **Origem:** `tax_obrigacoes` (motor de obrigações já existente).
- **Publicador:** Fiscal.
- **Consumidores:** Action Engine.
- **Payload:** `empresa_id`, `obrigacao_id`, `tipo`, `vencimento`, `valor`, `status`.

*(Reservados pro catálogo, não implementados na v1: `lead_created`, `invoice_generated`,
`meeting_created` — entram quando CRM/Agenda forem conectados ao Action Engine, fora do
escopo desta v1.)*

## Schema

```sql
create table events (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id),
  tipo text not null,               -- 'transaction_received', 'document_uploaded', 'tax_due'
  payload jsonb not null,
  publicado_por text not null,      -- nome do módulo/rota que publicou
  created_at timestamptz not null default now()
);

create table work_items (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id),
  event_id uuid references events(id),   -- null se criado sem evento de origem (raro, v1 não usa)
  tipo text not null,                     -- reaproveita o vocabulário do event catalog
  origem text not null,                   -- 'open_finance' | 'documento' | 'obrigacao_fiscal'
  responsavel_papel text not null,        -- 'financeiro' | 'contador' | 'dono'
  status text not null default 'aberto',  -- 'aberto' | 'em_analise' | 'resolvido' | 'ignorado'
  prazo date,
  impacto_valor numeric,                  -- valor financeiro/fiscal em jogo, se houver
  score numeric not null,
  sugestao_ia jsonb,                      -- o que a IA propôs (categoria sugerida, confiança, etc.)
  historico jsonb not null default '[]',  -- array de {em, quem, acao}
  arquivo_path text,
  chat_thread_id uuid,                    -- referência pro fio de conversa relacionado (v1: nullable, sem UI própria ainda)
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
```

RLS por `empresa_id` seguindo o padrão já usado em todas as tabelas do produto (ver
`rls-tenant-guardian` como revisor obrigatório antes de mergear a migration).

## Score (determinístico, não IA)

```
score = peso_base_do_tipo
      + peso_prazo(dias_ate_vencer)     -- cresce conforme se aproxima/passa do prazo
      + peso_valor(impacto_valor)       -- log(valor) escalado, não linear
```

Pesos base por tipo, ponto de partida (ajustável sem migração, é config, não schema):
- `tax_due` vencido ou vencendo em 48h: base alta (ex.: 90+)
- `transaction_received` de baixa confiança com valor alto: base média-alta
- `document_uploaded` aguardando processamento há >48h: base média, sobe com o tempo parado

Cockpit nunca mostra a fila inteira — só os N de maior score (Top 5, configurável).

## Como cada módulo publica evento (v1)

Escrita direta na API route que já existe — não trigger de banco, não fila externa. Motivo:
simples de debugar, explícito no código, sem infra nova. Os 3 pontos de publicação da v1:

1. Webhook/parser de Open Finance/cartão → depois de processar a transação, insere em
   `events` (`transaction_received`) e chama o Action Engine.
2. Upload no Cofre Fiscal (`cofre_fiscal_documentos`) → insere em `events`
   (`document_uploaded`).
3. Cron/rotina de obrigações (`tax_obrigacoes`) → ao detectar vencimento próximo, insere em
   `events` (`tax_due`).

O "Action Engine" em si, na v1, é uma função server-side chamada logo após cada insert acima
— não é um serviço separado nem fila assíncrona. Vira serviço próprio só se o volume exigir.

## O que o Cockpit passa a fazer

Troca as 3 queries soltas (`reembolsos`, `aprovacoes`, `contasPagarVencendo` em
`app/dashboard/page.tsx`) por uma query em `work_items` ordenada por `score desc`, Top 5.
Reembolsos e aprovações que já existem hoje continuam existindo como *tipos* de work_item,
não como contagem separada — evita perder o que já funciona.

## Escopo explícito da v1

**Dentro:**
- Tabelas `events` e `work_items` com RLS.
- 3 publicadores (Open Finance/transação, Cofre Fiscal/documento, obrigação fiscal).
- Action Engine como função server-side (regra + score determinístico; IA só entra na
  classificação de transação, que já existe parcialmente).
- Cockpit consumindo `work_items` em vez das 3 queries soltas.
- Rastreador de bookkeeping do Portal Contador = a UI que lista `work_items` filtrados por
  `origem = 'documento'`, com o status visível pro cliente (estilo rastreio de encomenda).

**Fora (registrado, não construído agora):**
- CRM, Marketing, Agenda publicando eventos (`lead_created`, `meeting_created`, `invoice_generated`).
- Donna consumindo work_items pra notificar proativamente via WhatsApp/Telegram (a Donna hoje
  já lê e-mail; conectar ao Action Engine é o próximo passo, não este).
- Intelligence consumindo work_items pra análise histórica/aprendizado.
- UI de chat por work_item (`chat_thread_id` existe no schema, sem tela própria ainda).
- Score calculado por IA (decisão explícita: determinístico por ora).

## Testando

- Cada publicador testável isoladamente: inserir um evento sintético, checar que o work_item
  certo é criado com o score esperado.
- Caso de resolução automática: evento com alta confiança não deve criar work_item, deve
  aparecer no histórico.
- RLS: usuário de uma empresa não pode ler `work_items`/`events` de outra (checklist do
  rls-tenant-guardian).
