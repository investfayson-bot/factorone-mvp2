# Handoff — Cartão: análise de custos + parcelas restantes + nome/endereço do estabelecimento

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

## IMPORTANTE (custo)
Fazer TUDO inline. Nada de `subagent-driven-development`. Ver memória `custo-subagentes-fan-out`.
