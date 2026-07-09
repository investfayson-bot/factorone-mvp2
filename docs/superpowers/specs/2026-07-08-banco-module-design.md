# Banco Module — spec de design (2026-07-08)

> **Status: aprovado pelo Fayson em 2026-07-08** (abordagem, dados, API, UI, navegação, erros e verificação validados seção a seção em sessão). Substitui as 3 telas atuais do fluxo bancário por um dashboard único. Contexto de produto: `2026-07-08-mapa-produto-visao-geral.md` (Banco é módulo **Core**, sempre visível, fora do Marketplace).

## Problema

Hoje uma transação do Belvo leva 3 telas manuais até virar dado útil:

1. `extrato_bancario` — feed cru do Belvo (tem `contraparte_nome`, `contraparte_documento`, `conciliado`, `transaction_id`).
2. **Conciliação** (`app/dashboard/conciliacao/page.tsx`) — casa `transacoes` com `contas_pagar`/`contas_receber`. **Bug/limitação atual: o vínculo manual é só estado do client, não é persistido — some no refresh.**
3. **Classificar** (`app/dashboard/classificar/page.tsx`) — fila estilo QuickBooks que aplica categoria em `transacoes` (sugestão IA via `/api/transacoes/sugerir`, fonte `aprendido`/`ia`).

`conta-pj` é a quarta tela (visual de banco: saldo/cartão/extrato) desconectada das outras.

Existem **duas conciliações conceitualmente diferentes** no código, e o Banco funde as duas numa fila só:
- "isso aconteceu mesmo?" — extrato → caixa (`/api/conciliacao/lancar`)
- "isso era esperado?" — caixa → contas a pagar/receber (matching por valor+data, score > 0.5)

## Decisão (abordagem A — aprovada)

Página nova `app/dashboard/banco/` + endpoint atômico único. **Um clique = um estado consistente**: concilia + classifica (categoria E fornecedor/cliente) + vincula/baixa conta prevista, tudo numa transação de servidor. Nunca existe transação conciliada-mas-sem-categoria.

Alternativas rejeitadas:
- Evoluir `classificar/page.tsx` (541 linhas viram monolito de 1000+; opera sobre `transacoes`, não `extrato_bancario`).
- Página nova orquestrando endpoints existentes no client (falha parcial deixa estado inconsistente — inaceitável pra dado que alimenta DRE e imposto).

## Camada de dados (migration nova `20260708*_banco_module.sql`)

Em `transacoes`, 4 colunas novas, **todas nullable** (nada existente quebra), com índice cada:

| Coluna | Tipo | FK |
|---|---|---|
| `fornecedor_id` | uuid | `fornecedores(id)` |
| `cliente_id` | uuid | `clientes(id)` |
| `conta_pagar_id` | uuid | `contas_pagar(id)` |
| `conta_receber_id` | uuid | `contas_receber(id)` |

- Nomenclatura segue o padrão de `20260508200000_sprint9_crm_marketing_logistica.sql` / `20260508300000_sprint10.sql`.
- **Nada muda em `extrato_bancario`** — já tem tudo (`contraparte_nome`, `contraparte_documento`, `conciliado`, `transaction_id`).
- RLS: policy existente de `transacoes` (por `empresa_id`) já cobre; colunas novas não abrem furo.

## Camada de API

### `GET /api/banco/fila`
Monta a fila pronta: itens de `extrato_bancario` com `conciliado = false`, cada um com:
- **Sugestão de categoria** — reusa a lógica de `/api/transacoes/sugerir` (aprendido do histórico → IA), com fonte (`aprendido`/`ia`) pra UI mostrar o badge.
- **Sugestão de fornecedor/cliente** — ordem de match: `contraparte_documento` (CNPJ, chave exata) → nome exato → nome aproximado → sem sugestão (aí a UI oferece criar cadastro).
- **Candidato de conta a pagar/receber** — heurística valor+data da tela de conciliação atual (score > 0.5), débito→`contas_pagar`, crédito→`contas_receber`.

### `POST /api/banco/confirmar`
Recebe lote:

```jsonc
{ "itens": [{
    "extrato_id": "uuid",
    "categoria": "string",
    "fornecedor_id": "uuid?",            // OU cliente_id
    "cliente_id": "uuid?",
    "novo_fornecedor": { "razao_social": "..." },  // opcional, OU novo_cliente
    "novo_cliente": { "nome": "..." },
    "conta_pagar_id": "uuid?",           // OU conta_receber_id
    "conta_receber_id": "uuid?"
}] }
```

Por item, no servidor, nesta ordem:
1. Valida que o `extrato_id` pertence à empresa da sessão (IDOR).
2. Recheca `conciliado = false`; se já conciliou responde `ja_conciliado: true` (idempotência — padrão do `lancar` atual).
3. Se veio `novo_fornecedor`/`novo_cliente`: antes de criar, procura cadastro existente com o mesmo CNPJ (`contraparte_documento`) na empresa — se achar, vincula ao existente em vez de duplicar.
4. Insere em `transacoes` já completo: descrição, valor, tipo (`credito`→`entrada`, `debito`→`saida`), `status: 'pago'`, categoria, `fornecedor_id`/`cliente_id`, `conta_pagar_id`/`conta_receber_id`.
5. Marca `extrato_bancario.conciliado = true` + `transaction_id`.
6. Se vinculou conta prevista: marca `contas_pagar.status = 'pago'` / baixa em `contas_receber`.

Resposta: `{ confirmados: [...], falhas: [{ extrato_id, erro }] }` — item que falha não derruba o lote.

### O que NÃO muda
`/api/transacoes/sugerir`, `/api/transacoes/classificar`, `/api/conciliacao/lancar` e demais continuam existindo — outros pontos do sistema usam. O Banco só deixa de depender das telas antigas.

## Camada de UI (`app/dashboard/banco/page.tsx`)

Direção visual: verde/estrutura atual refinada, cantos arredondados estilo Nubank — **não** mockup fintech genérico (decisão de 2026-07-08).

### BancoHeader (novo `components/banco/BancoHeader.tsx`)
**Extraído** (não copiado) da parte saldo/cartão/contas de `components/conta-pj/DashboardBancario.tsx`. Presente em todas as abas: saldo consolidado, cartão/limite quando houver, seletor de conta Belvo. Ao rolar, encolhe pra barra fina só com saldo. Dados: mesmas queries do `conta-pj` (`contas_bancarias` + saldo do sync) — nenhuma query nova.

### Aba Fila (a revisar) — o coração
Cada linha traz tudo resolvido, esperando um clique:

```
05/07  PIX enviado — AUTO POSTO SILVA LTDA          −R$ 320,00
       Categoria: [Transporte/Combustível ▾] 🤖 ia
       Fornecedor: [Auto Posto Silva ▾]  ✓ CNPJ bateu
       Casou com: "Combustível frota — venc 04/07" Δ0%
                                   [Confirmar tudo ✓] [Editar]
```

- Contraparte sem cadastro → chip **"+ Criar fornecedor 'X'"**; só grava no confirmar (nunca auto-cria sem confirmação — decisão do Fayson, evita poluir base com "PIX 8817").
- Seleção múltipla + "IA confirma tudo" em lote (mecânica reaproveitada do `classificar`).
- Sem match de conta prevista → linha não mostra essa parte. Sem sugestão ≠ bloqueio.

### Aba Extrato
Todas as transações (conciliadas ou não), filtro período/conta/tipo, badge Banco/Cartão. Substitui `conta-pj/extrato`.

### Aba Resumo
Gasto por categoria e **por fornecedor/cliente** (o eixo novo), filtrável semana/mês/ano. Herda análise CFO IA e projeção de caixa do `classificar`.

### Aba Visão geral
KPIs do mês (entrou/saiu/resultado), pendências da fila, alerta âmbar de lançamentos previstos sem transação (vem da conciliação atual).

## Navegação

- `Banco` = item **Core** no sidebar (grupo fixo em `app/dashboard/layout.tsx`, fora de `MARKET_APPS`).
- `conta-pj`, `conciliacao`, `classificar` → `redirect('/dashboard/banco')`. Arquivos velhos só são apagados depois do Banco verificado em produção de fato.

## Fora de escopo (v1)

- Reclassificação em massa de transações antigas.
- Regras automáticas ("sempre que vier de X, classifica Y sem perguntar").
- Relatório WhatsApp/e-mail — fica onde está.
- Múltiplas contas Belvo: já suportado pelo sync atual, nada a fazer.

## Erros e casos-limite

| Caso | Comportamento |
|---|---|
| Lote parcialmente falho | UI mantém na fila só o que falhou, com motivo na linha; sem "deu erro" genérico |
| Duplo clique / duas abas | Servidor recheca `conciliado`; responde `ja_conciliado`, UI remove da fila |
| Cadastro duplicado | Mesmo CNPJ na empresa → vincula ao existente, não cria |
| IDOR | Toda query por `extrato_id` valida `empresa_id` da sessão |
| Sem conta Belvo | Empty state com CTA "Conectar banco" (→ `/dashboard/conexoes`) + dados de teste |

## Verificação (critério de pronto)

1. Migration aplica limpa em banco com dados existentes.
2. Fluxo real no browser: semear/conectar extrato → fila com sugestões → confirmar 1 item → transação classificada aparece na DRE e no Resumo → conta a pagar vinculada vira "paga" → item some da fila e não volta no refresh.
3. Redirects das 3 rotas antigas funcionam.
4. Lote com item inválido: os válidos confirmam, o inválido volta com erro na linha.
5. Revisores antes do commit: `factorone-reviewer` (multi-tenant/IDOR) + `revisor-financeiro` (baixa de contas mexe em status de dinheiro).

Related: [[banco-module-vision]], [[contador-module-vision]], `2026-07-08-mapa-produto-visao-geral.md`.
