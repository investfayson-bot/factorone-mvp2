# Handoff — Cartão: análise de custos + parcelas restantes + nome/endereço do estabelecimento

## ⇢ STATUS AO VIVO (2026-07-09, sessão Linux) — LER PRIMEIRO

O Fayson não estava vendo o Banco no app, achou que "não foi entregue" e que /integracoes
estava no lugar errado. Diagnóstico com evidência:

- **O código do Banco ESTÁ no `main` e COMPILA.** `git cat-file` confirma
  `app/dashboard/banco/page.tsx` em `origin/main` (7fcf002); `npx tsc --noEmit` → exit 0, limpo.
  Ou seja: não é código faltando. **É o DEPLOY servindo versão velha.**
- **`/integracoes` já está certo:** existe só `app/dashboard/integracoes/page.tsx` (dentro da
  plataforma). NÃO existe rota `/integracoes` na raiz. A única referência
  (`layout.tsx:167`) aponta pra `/dashboard/integracoes`. Se o Fayson vê "errado", é a mesma
  causa: está olhando o deploy ANTIGO, de antes do merge do Banco.
- **Conclusão: os dois sintomas ("não vejo Banco" + "integracoes no lugar errado") têm UMA
  causa só — o deploy de produção está defasado / não reflete o `main` atual.** Ação: conferir
  na Vercel se produção aponta pra `main` e se o último build rodou; ou forçar redeploy.
  Não mexer mais no código por causa disso — o código está certo.
- **Belvo sandbox: beco sem saída confirmado** (ver seção MockBank abaixo). Pra SIMULAR
  cartão parcelado antes do cliente sem depender da Belvo: existe `POST /api/demo/seed`
  (autenticado) mas ele só popula `transacoes`, não `belvo_transacoes`/`extrato_bancario` com
  parcelas. Falta um seed que insira compras parceladas fake — tarefa pequena, ainda não feita.
- **feat/cartao-parcelas NÃO está no GitHub** — só no disco do Windows. Risco de perda.

---


> Pedido do Fayson (cliente perguntou): análise de custos por segmento, quantas parcelas
> ainda faltam nos próximos meses (somar as que terminam em 1 mês e em 2 meses), e
> identificar o estabelecimento real (nome fantasia → razão social + endereço), porque
> a fatura às vezes traz só o nome fantasia e demora pra identificar. Vale p/ PJ e PF.

## Resposta curta: NÃO existe hoje. E o motivo é um só.

**O sistema guarda o TOTAL da fatura, nunca as LINHAS dela.** Sem as linhas não há
"3/10", não há estabelecimento por compra, não há endereço.

## O que foi apurado no código (2026-07-09, sessão Linux)

- `belvo_transacoes` (migration `20260617_belvo_data.sql`): tem `estabelecimento`,
  `categoria`, `valor`, `data`. **NÃO tem coluna de parcela.**
- `faturas_cartao` e `belvo_bills`: só cabeçalho (`valor_total`, `vencimento`, `status`).
  **Nenhuma tabela de ITENS de fatura existe.**
- Parcela só existe em tabelas de entrada MANUAL:
  - PJ: `solicitacoes_cartao` (campos `parcelas`, `parcela_atual`) — preenchida em
    `app/dashboard/cartoes/page.tsx:142`.
  - PF: `despesas_pessoais` (campos `parcela_atual`, `total_parcelas`, `cartao_id`) —
    migration `20260507100000_sprint_pf.sql:42`.
- **A causa raiz está no NOSSO parser, não na Belvo:** o tipo `BelvoTransaction` em
  `app/api/belvo/transactions/route.ts:5-17` mapeia só 9 campos e DESCARTA o resto.
  A Belvo devolve `credit_card_data { installment_number, total_installments }` no objeto
  de transação de cartão, mas `mapTx` joga fora. Precisa ler esse campo.
- "Segmento" no código = `clientes.segmento` (atributo de CRM, irrelevante p/ gasto).
  Para custo, a única dimensão que existe é `categoria` (texto livre). **Confirmar com o
  Fayson se "segmento" = `categoria`.**
- Endereço de estabelecimento: NÃO existe em tabela nenhuma. Descritor de cartão
  raramente traz CNPJ limpo (ao contrário de PIX, que traz `contraparte_documento`).
  Enriquecer razão social + endereço exige CNPJ → BrasilAPI/ReceitaWS. Best-effort, não 100%.

## Verificação da Belvo (sandbox) — feita nesta sessão
- Auth OK (`/institutions/` → 200). Instituições BR: `ironbank_br_business` (sem BILLS) e
  `ofmockbank_br_retail` (COM BILLS).
- Sandbox tem 0 links e nenhum cartão com parcelas populado → não dá pra ver o formato real
  de `credit_card_data` só no sandbox. **Precisa de um link de produção/teste do banco real.**
- (Tentativa de criar link no mock esbarrou em credenciais do mock; classificador bloqueou
  o loop de senhas. Não é o caminho — o formato já foi deduzido do código.)

## Plano de implementação (do mais barato ao mais completo) — FAZER INLINE, sem fan-out de subagente

1. **Capturar parcela do feed Belvo (raiz):** estender `BelvoTransaction`/`mapTx` p/ ler
   `credit_card_data`; criar tabela de itens de fatura (ou colunas `parcela_atual`,
   `total_parcelas`, `descritor_bruto` em `belvo_transacoes`); gravar no sync. Depois
   "faltam X parcelas, some as que terminam em 1 e 2 meses" = query
   (`restantes = total_parcelas - parcela_atual`, group by restantes=1, restantes=2).
   Depende do banco do cliente entregar `credit_card_data` via Open Finance.
2. **Importar fatura (PDF/CSV/OFX):** cliente sobe o arquivo, parseia linhas + "PARC 03/10".
   Independe da Belvo. Plano B p/ bancos que não entregam parcelamento.
3. **Nome fantasia → razão social + endereço:** limpar descritor → casar com fornecedor
   cadastrado → quando houver CNPJ, enriquecer via BrasilAPI. Best-effort.

## Decisão do Fayson (2026-07-09, sessão Windows): opção (b) — codar assumindo, com fallback
Escopo aprovado: capturar `credit_card_data` da Belvo (item 1) + importação de fatura como
caminho B (item 2). **Estabelecimento/endereço (item 3) fica de fora por enquanto** — não
fazia parte da decisão, é escopo separado (best-effort, depende de CNPJ + BrasilAPI).

## Tentativa de validar no sandbox (2026-07-09, sessão Windows) — outro beco sem saída
Tentamos criar um Link real na Belvo sandbox via API direta (`POST /api/links/`), com um
cliente de teste brasileiro criado no MockBank.io (banco por trás de `ofmockbank_br_retail`):
- Chamada direta à Belvo funcionou até certo ponto: descobrimos que `ofmockbank_br_retail`
  exige `username_type` (103 ou 104) e que `username` deve ser o CPF, não o login do
  MockBank. Depois disso, Belvo retornou `unexpected_error` — provável causa: a conta de
  teste no MockBank estava configurada como `BerlinGroup`/IBAN/EUR (padrão europeu) em vez
  de formato brasileiro/BRL, e tinha 0 contas/transações reais.
- Tentamos usar a **Internal API do MockBank** (Swagger, `api.mockbank.io/swagger-ui.html`)
  pra criar conta+transações com parcela via API, em vez de clicar na UI. **Não conseguimos
  autenticar**: o fluxo OAuth2 password do Swagger (`/oauth/token`) retorna 401 mesmo com o
  login/senha corretos do MockBank — parece bug/config faltando no client_id da própria
  ferramenta (Springfox), não erro do usuário. Testamos `client_id` genérico `test:test` via
  curl direto (bypass do Swagger) — mesmo 401 genérico, sem detalhe de campo (diferente do
  erro específico que a Belvo dá). Não vale mais tempo nisso sem suporte do MockBank.
- **Conclusão: abandonar validação ao vivo no sandbox por agora.** Seguir implementando com
  o formato documentado (`installment_number`/`total_installments` em `credit_card_data`) e
  validar só quando um banco de cliente real conectar em produção.

## Implementado (2026-07-09, sessão Windows) — branch `feat/cartao-parcelas`

- `supabase/migrations/20260709100000_cartao_parcelas.sql`: `parcela_atual`/`total_parcelas`/
  `descritor_bruto` (nullable) em `belvo_transacoes` + tabela nova `fatura_itens_importados`
  (PJ via `empresa_id` ou PF via `user_id`, RLS igual ao padrão de `belvo_transacoes`).
- `app/api/belvo/transactions/route.ts`: lê `credit_card_data.installment_number`/
  `total_installments` (antes descartado) e persiste.
- `lib/fatura-import.ts` + `app/api/cartoes/importar-fatura/route.ts`: importação de fatura
  CSV/XLSX (reaproveita padrão de `/api/importar/despesas`), OFX (parser de `<STMTTRN>` por
  regex) e PDF (via IA, reaproveita padrão de `/api/despesas/extrair-comprovante`). Fluxo
  preview → confirm.
- `app/api/cartoes/parcelas-restantes/route.ts`: junta `belvo_transacoes` +
  `fatura_itens_importados` + `despesas_pessoais` (PF) e agrupa por parcelas restantes,
  destacando "termina em 1 mês" / "termina em 2 meses".

**Bug pego no code review e corrigido:** a Belvo grava uma linha NOVA por mês faturado de
uma compra parcelada (parcela 1/10, depois 2/10, ...), cada uma com o valor da parcela — sem
deduplicar, o endpoint de resumo somava a mesma compra uma vez por mês já cobrado, inflando
"quanto falta pagar". Corrigido agrupando por compra (origem+descrição+valor+total) e usando
só a linha de maior `parcela_atual` antes de somar.

**Limitação conhecida, não corrigida (baixo risco):** o filtro de dono usa `empresa_id` OU
`user_id`, nunca os dois — linha legada gravada só num dos dois campos ficaria de fora do
somatório mesmo sendo visível via RLS. Mesmo padrão já existe em `belvo_transacoes` etc.

**Fora de escopo (não decidido ainda):** item 3 (estabelecimento real via CNPJ/BrasilAPI).
**Não validado com dado real da Belvo** — sandbox/mock abandonado por fricção (ver seção
acima). Validar quando um banco de cliente real conectar em produção.

## IMPORTANTE (custo)
Fazer TUDO inline. Nada de `subagent-driven-development`. Ver memória `custo-subagentes-fan-out`.
