# Automações financeiras — classificação diária, relatório mensal, matching de comprovante

## Contexto

Pergunta real de um cliente (via Fayson): se o FactorOne classifica movimentações
automaticamente, mantém tudo atualizado diariamente uma vez o banco conectado, e
anexa comprovantes automaticamente nas movimentações. Hoje:

- Classificação por IA existe, mas só roda quando alguém clica no botão
  (`/api/conta-pj/categorizar-extrato`, `/api/despesas/categorizar-lote`).
- Não existe relatório mensal automático (só export manual sob demanda).
- Não existe matching automático de comprovante — hoje é 100% manual (usuário acha
  a movimentação e anexa, ou usa `/api/contabilidade/processar-recibo` que lança
  despesa mas não liga o recibo a uma linha específica do extrato bancário).

Puxar o comprovante *do banco* (ex.: PDF que o Nubank gera) não é possível — a API
da Belvo (Open Finance) não expõe esse documento, só os dados da transação. Este
spec cobre o que É possível: automatizar o que já existe no sistema.

## Escopo — 3 features independentes, mesma sessão de trabalho

### 1. Classificação automática diária

Hoje roda sob demanda. Passa a rodar sozinha: ao final do cron `belvo-sync`
(`app/api/cron/belvo-sync/route.ts`), depois de gravar `extrato_bancario`, chama a
mesma lógica de categorização em lote por IA (`lib/categorizar-ia.ts`,
`categorizarLoteIA`) para as linhas recém-inseridas sem categoria. Reaproveita a
função existente — não duplica lógica de categorização.

Nenhuma migration nova. Nenhuma mudança de UI (o botão manual continua existindo
para quando o usuário quiser recategorizar).

### 2. Relatório mensal automático

Cron novo (`app/api/cron/relatorio-mensal/route.ts`), mesmo padrão de autenticação
dos crons existentes (`Bearer ${CRON_SECRET}`), agendado no `vercel.json` pra rodar
dia 1 de cada mês.

Para cada empresa ativa, busca o papel `admin` em `usuario_empresas` (ou o dono via
`usuarios.empresa_id`), calcula o resumo do mês anterior reaproveitando
`calcularMetricasMes(empresaId, competencia)` (`lib/financeiro/calcularMetricas.ts`
— já existe, já calcula receita, despesa, lucro, margens) e envia por e-mail via
Resend, seguindo o padrão de `lib/email/notificacoes.ts` (nova função
`emailRelatorioMensal`, reaproveitando o `baseHtml` já usado por
`emailConviteContador`/`emailDasAlert`).

**Nível de detalhe configurável** (pedido do Fayson: "dar opção pro usuário"):
nova coluna `empresas.relatorio_mensal_nivel` (`'resumo' | 'completo'`, default
`'resumo'`). `'resumo'`: receita, despesa, saldo do mês, variação vs. mês anterior.
`'completo'`: mesmo e-mail + tabela por categoria (mesma fonte de dado do DRE em
`/dashboard/relatorios`). Configuração fica em `/dashboard/equipe` (mesma tela do
convite, já é onde o admin mexe em papel/e-mail da equipe) — um toggle simples
"resumo" / "completo" perto do topo da página.

Se `empresas.email_relatorio` (ou o e-mail do admin) não existir, ou `RESEND_API_KEY`
não configurada, o cron pula a empresa silenciosamente (mesmo padrão de tolerância
a erro dos crons existentes — não derruba o job inteiro).

### 3. Matching automático de comprovante ↔ movimentação

Quando um recibo é processado com sucesso (`recibos_fotografados` com
`valor_extraido`/`data_extraida` preenchidos — já acontece em
`/api/contabilidade/processar-recibo`), tenta achar automaticamente uma linha em
`extrato_bancario` da mesma empresa com:
- mesmo valor (tolerância de centavos, ex. ±R$0,01 por arredondamento)
- data dentro de uma janela de ±2 dias
- `comprovante_url IS NULL` (ainda não tem comprovante anexado)

Se achar exatamente uma correspondência, grava `extrato_bancario.comprovante_url`
(coluna que já existe) e marca o recibo como usado. Se achar zero ou mais de uma
correspondência, não faz nada automaticamente — fica como está hoje (manual),
porque adivinhar errado é pior que não adivinhar.

**Migration nova**: `recibos_fotografados.extrato_bancario_id uuid` (nullable, FK
pra `extrato_bancario`) — evita tentar casar o mesmo recibo duas vezes e permite
navegar do recibo pra movimentação.

Roda em dois pontos: (a) logo após o OCR em `processar-recibo/route.ts` (matching
imediato pro caso comum — recibo chega depois da movimentação já estar no
extrato); (b) dentro do cron `belvo-sync`, depois de importar novas linhas de
extrato, tenta casar contra recibos pendentes (`extrato_bancario_id IS NULL`) —
cobre o caso em que o recibo chegou primeiro e a movimentação só apareceu depois
no Open Finance.

Lógica de matching isolada em `lib/financeiro/matchComprovante.ts` (função pura,
testável, chamada dos dois pontos acima — não duplica a query).

## Fora de escopo (não construir agora)

- Puxar comprovante direto do banco (não existe API pra isso).
- WhatsApp/e-mail para receber comprovante automaticamente (existe infra parecida
  no Donna, mas é outro projeto).
- Envio de relatório mensal em PDF anexado (v1 é e-mail com o resumo no corpo,
  reaproveitando `baseHtml`; anexar PDF fica pra depois se pedirem).

## Verificação

- Typecheck (`npx tsc --noEmit`) limpo.
- Cron de classificação: rodar manualmente contra uma empresa de teste com extrato
  sem categoria, confirmar que populou `categoria`.
- Cron de relatório: chamar a rota com o `CRON_SECRET` local, checar e-mail
  recebido (ou log do Resend em dev, se a chave não estiver configurada).
- Matching de comprovante: subir um recibo com valor/data batendo uma linha do
  extrato, confirmar que `extrato_bancario.comprovante_url` foi preenchido;
  subir um recibo sem correspondência, confirmar que nada quebra e nada é
  anexado à força.
