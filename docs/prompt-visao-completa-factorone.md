# FactorOne — Prompt completo da solução (pra gerar visual/fluxograma)

> Documento pra colar em ferramenta de geração visual (ChatGPT, Figma, etc). Cobre
> tudo que já existe implementado, tudo que está decidido como próximo passo, e
> sugestões abertas. Marcado como: **[FEITO]** já está no ar, **[DECIDIDO]** já foi
> desenhado/aprovado mas não implementado, **[VISÃO]** ainda em aberto,
> **[SUGESTÃO]** ideia minha (Claude) pra você avaliar.

## O que é o FactorOne

Sistema de gestão empresarial (Finance OS) multi-tenant, para PMEs brasileiras.
Tese central do produto: **inteligência embutida em cada setor**, não um conjunto
de agentes soltos que o usuário precisa escolher. A IA age dentro de cada área e
o usuário sente isso — "joga aqui que eu resolvo" em vez de formulário. Referência
competitiva: constrói o que QuickBooks/Omie/HighLevel já fazem, e diferencia com
IA de verdade.

Stack: Next.js 16 (App Router) + Supabase (Postgres multi-tenant com RLS) + Resend
(e-mail) + OpenRouter/Gemini (categorização) + Claude (OCR, chat) + Belvo (Open
Finance) + Stripe (billing).

## Estrutura de navegação — 8 soluções

**[DECIDIDO]** Sidebar única com 8 itens (substitui os ~24 itens fragmentados de
antes). Cada solução abre com sub-abas no topo, não vira item de menu solto.

```
Principal
 ├─ Início (dashboard)
 └─ Agentes IA [FEITO — reorganizado]
     ├─ Acessor (CEO/CFO digital)
     ├─ Conversas (inbox multi-canal)
     └─ Automações (regras de autonomia)
Soluções
 ├─ Banco
 ├─ Financeiro
 ├─ Clientes & Vendas
 └─ Contábil & Fiscal
Extras
 ├─ Apps & Marketplace
 └─ Equipe & Planos
```

**[VISÃO — a definir]** Onde encaixar: Marketing (criação de conteúdo),
Configurações (senha/hierarquia/IA/cores), Integrações (CRM externo
bidirecional), Academy (EAD por setor), Chat Interno (equipe).

---

## 1. Início / Dashboard

**[FEITO, dados reais]** já calcula: receita/despesa/lucro do mês, DRE
simplificado, fluxo de caixa 30 dias, runway, Score Financeiro (0-1000, com
5 componentes detalhados), insight proativo de IA (`/api/transacoes/analisar`),
checklist de ativação pra conta nova, próximos compromissos da agenda, atalhos
rápidos (classificar, nova cobrança, despesa, NF-e, conectar banco).

**[DECIDIDO — próximo passo]** Reorganização visual em grid denso (referência:
mockup enviado pelo Fayson) — card de Score em destaque, KPIs em linha compacta,
gráfico de fluxo de caixa, insight de IA em card de destaque, tudo reaproveitando
os dados que já existem, sem holding consolidado nesta fase.

**[VISÃO]** "Caixa Consolidado / Holding" — somar saldo, receita e DRE de VÁRIAS
empresas ao mesmo tempo, com um seletor "Consolidado" vs. empresa individual no
topo. **Isso é feature nova de backend**, não existe hoje: o sistema atual troca
de empresa uma de cada vez (`CompanySwitcher` + `/api/empresas/trocar`), não soma.
Pra usuário com **mais de 2 CNPJs** (holding), isso é o pedido central — precisa
de: (a) agrupamento de empresas sob um "grupo"/holding, (b) queries agregadas
somando `empresa_id IN (lista)` em vez de uma só, (c) atribuição de papel por
empresa dentro do grupo (alguém pode ver 3 das 5 empresas do grupo, por exemplo).

---

## 2. Contábil & Fiscal / Contador

**[FEITO]** Duas peças hoje, ainda não fundidas:
- `/dashboard/escritorio` — cockpit do contador: login de verdade
  (`usuario_empresas.papel='contador'`), vê lista de TODAS as empresas-cliente,
  entra em cada uma com um clique, acesso de leitura garantido no servidor
  (`bloquearSeLeitura`, aplicado em 37 rotas de escrita).
- `/dashboard/contadores` — painel do lado do CLIENTE (dono da empresa): status
  de fechamento (lançamentos/NF-e/recibos/conciliação em %), lançamentos
  pendentes, obrigações acessórias (DARF, SPED, ECD, DEFIS), recibos, notas
  fiscais, e botão "Convidar meu contador" (login completo, mesma peça acima).

**[VISÃO — grande, ainda não especificado tecnicamente]** Reconstrução estilo
QuickBooks. O que o Fayson pediu explicitamente, sem perder nenhum detalhe:
- **Relatórios por período customizável** (data X até data Y), com **impressão**
  — não só "exportar", o usuário escolhe o intervalo igual um extrato bancário.
- **Painel de impostos**: quanto a empresa paga, de qual operação (venda/compra),
  qual alíquota, por quê.
- **Alertas de mudança de legislação fiscal** em tempo real (ex.: "a alíquota do
  Simples mudou ontem, você está sabendo?").
- **Checklist de pendências com UX melhor** (já existe uma versão simples em
  `/dashboard/contadores`, mas com dado mockado nas Obrigações — precisa virar
  dado real).
- **Histórico de arquivos que o contador enviou** em competências passadas (guias
  pagas, declarações protocoladas) — com **link pra imprimir ou reenviar por
  e-mail** pra outra pessoa (ex.: contador manda a guia, dono reenvia pro sócio).
- **Dashboard "ao vivo"** do status de submissões (protocolo no gov.br, envio pro
  sistema do contador) — visibilidade de "o que está acontecendo agora", não só
  o que já aconteceu.
- **[SUGESTÃO]** Um "cofre fiscal" — repositório único de documentos entregues
  (RG/CNPJ/contrato social/procurações) que tanto empresa quanto contador acessam,
  evita re-pedir documento que já foi mandado antes.
- **[SUGESTÃO]** Linha do tempo por competência (mês fiscal): visual tipo
  timeline mostrando "07/2026: lançamentos ✓ → conciliação ✓ → DAS pago ✓ → SPED
  pendente" — dá pro usuário ver o pipeline contábil como um funil, não uma lista.

**Automações já plugadas aqui [FEITO nesta sessão]**: classificação automática
diária do extrato bancário (roda junto do sync do Belvo), matching automático de
comprovante com movimentação bancária (por valor+data), relatório mensal
automático por e-mail (dia 1 de cada mês).

---

## 3. Financeiro

**[FEITO]** Contas a Pagar & Receber (com parcelamento, recorrência, régua de
cobrança), Despesas (com OCR de recibo), DRE automático (calculado do que foi
classificado, com margens/EBITDA/indicadores), Orçamento (orçado × realizado,
com suplementação e aprovação), Conciliação bancária, Indicadores (LTV, CAC,
MRR, ROI/ROIC, burn, runway).

**[FEITO nesta sessão]** Gate de segurança em 37 rotas de escrita — papel
`contador`/`viewer` é leitura-apenas garantido no servidor, não só escondido na
UI. Classificação automática diária.

**[VISÃO]** O pedido do Fayson foi "muito bem estruturado, robusto, com
inteligência que o mercado ainda não viu" — sem detalhe concreto ainda,
próxima área a aprofundar quando chegar a vez (depois de Banco/Clientes&Vendas).
**[SUGESTÃO]** Candidatos a "inteligência que o mercado não tem": (a) explicação
em linguagem natural de POR QUE uma métrica mudou (não só "EBITDA caiu 12%", mas
"caiu porque Marketing subiu 34% e duas duplicatas grandes atrasaram"); (b)
simulação "e se" (o CFO IA já tem isso embrionário no chat — expandir pra UI
dedicada de cenários); (c) alerta preditivo de inadimplência por cliente, baseado
em padrão histórico de atraso.

---

## 4. Banco

**[FEITO]** Extrato agregado via Open Finance (Belvo), cartões (fatura/limite),
investimentos (aplicado/rendimento/CDI), conectar bancos (widget único).

**[DECIDIDO]** Visual "banking" mais parecido com app de banco de verdade
(referência: mockups já produzidos em `docs/factorone-sistema.html` e
`docs/auditoria-navegacao.html`) — saldo grande no topo, cards de ação rápida,
feed de transações recentes ao vivo.

**[VISÃO]** Relatório de período customizável (X até Y) pra imprimir "igual
contador faz" — mesmo pedido que aparece em Contábil & Fiscal, dá pra ser o
MESMO componente de relatório reaproveitado nas duas áreas.
**[SUGESTÃO]** Dashboard "ao vivo" com trocas de saldo em tempo real (via
Supabase Realtime, já disponível na stack) — mostra o número mudando quando uma
transação nova chega, sem precisar dar refresh.

---

## 5. Clientes & Vendas

**[FEITO]** CRM (leads/contatos/pipeline), Agendamento (link público tipo
Calendly), Captação de leads (webhook/Zapier/RD/Meta), Pós-venda & Follow-up,
Propostas comerciais, Sales Pipeline (kanban).

**[VISÃO]** Dashboard de agendamento mais moderno, estilo Google Calendar.
Respostas automáticas (editáveis ou geradas por IA) pra lead. Termômetro de lead
(score de temperatura: quente/morno/frio).
**[SUGESTÃO]** Esse termômetro já existe conceitualmente na Donna (ver seção
Agentes IA) pra qualificar lead recebido por e-mail — reaproveitar a mesma lógica
aqui em vez de duplicar. Kanban de pipeline com drag-and-drop real (hoje é
provavelmente estático) e indicador visual de tempo parado em cada etapa
("esse negócio está há 12 dias em Proposta, sem contato").

---

## 6. Agentes IA [FEITO — reorganizado nesta sessão]

- **Acessor** (`/dashboard/aicfo`) — antes "CFO IA", agora composto
  conceitualmente de CEO/CFO/todos os C-levels. Chat que analisa dados reais
  (transações, saldo, contas a pagar), projeta caixa, simula cenários.
- **Conversas** (`/dashboard/agentes/conversas`) — inbox unificado, 3 colunas
  (lista de conversas · thread · dados do contato). Hoje só canal Site tem dado
  real (widget de chat). Filtros de WhatsApp/Instagram/Telegram já na UI.
- **Automações** (`/dashboard/agentes/automacoes`) — motor de regras de
  autonomia por canal (e-mail/site/telegram): cada regra decide se a IA age
  sozinha ("automático") ou pede aprovação ("rascunho"), com toggle visual.
  Também gerencia conexão Gmail e fila de e-mails pendentes de aprovação.
- Donna como **persona separada foi removida** — a funcionalidade dela virou as
  duas soluções acima.

**[VISÃO — pedido novo do Fayson]** Donna interagindo com TUDO via **Telegram**
pra fazer mudança ou agendamento — não só responder pergunta. Hoje o bot do
Telegram (`app/api/webhooks/telegram/route.ts`) só CONSULTA dados (saldo,
transações, contas a pagar) pro dono conversar com o próprio assistente — é
leitura, não ação. O pedido é expandir pra: "Donna, marca reunião com o cliente
X quinta às 14h" → cria evento na Agenda de verdade; "Donna, muda a categoria
dessa despesa pra Marketing" → grava no banco de verdade. Isso é **um projeto de
integração próprio**, maior que ajuste de UI: precisa de (a) parser de intenção
(qual ação o usuário quer, em linguagem natural, não comando fixo), (b) mapear
intenção pra função real do sistema (agenda, despesas, financeiro, etc.), (c)
guardrail de segurança — mesma lógica de `donna_regras`/autonomia já existente,
aplicada a AÇÕES de mutação, não só a respostas de texto (crítico: uma ação
errada via Telegram pode mexer em dinheiro/agenda real, então precisa de
confirmação explícita antes de executar qualquer coisa que grava dado).
**[SUGESTÃO]** Começar pelo escopo mais seguro (agenda: criar/remarcar/cancelar
compromisso) antes de liberar ações financeiras via Telegram — errar uma
transação é mais caro que errar um agendamento.

---

## 7. Apps & Marketplace

**[FEITO]** 26 apps hoje, cada um aponta pra uma solução (`navGroup`) e
"liga/desliga" (o app instalado aparece dentro da solução correspondente, não
vira item de menu solto). Categorias reais hoje:

- **Financeiro**: Classificação IA, Produtos & Margem, Indicadores, M&A (oculto
  da vitrine), Contas a Receber Plus, Subscription Billing, Budget & Forecast,
  Investimentos.
- **Clientes & Vendas**: CRM, Captação de Leads, Agendamento, Pós-venda &
  Follow-up, Sales Pipeline, Propostas Comerciais.
- **Contábil & Fiscal**: Jurídico, Prefeituras & NFS-e, Tax Compliance, Simples
  Nacional (DAS).
- **Marketing**: Marketing (campanhas de e-mail e anúncios).
- **Operacional**: Logística, Gestão de Estoque, Contratos Digitais.
- **RH**: Folha de Pagamento, RH & Benefícios.
- **Patrimônio**: Patrimônio (imóveis/veículos/obras/recibos/sócios) — opt-in,
  só aparece se instalado ou segmento de negócio for imóveis.
- Fora de categoria fixa: CFO IA (vira Acessor, grupo Agentes IA).

**[VISÃO]** Fayson gosta da distribuição atual, quer manter o padrão
"instala → aparece dentro da solução certa, não como item solto".
**[SUGESTÃO]** Cada app card na vitrine já mostra rating/reviews (`rev`) — dá pra
adicionar "usado por X% dos seus pares no seu segmento" (social proof
contextual, usando dado real de quantas empresas do mesmo segmento instalaram),
e um preview/demo em 10 segundos antes de instalar (screenshot ou GIF curto),
já que hoje o card só tem ícone+descrição+rating.

---

## 8. Equipe & Planos

**[FEITO]** Convite por e-mail com papel (`admin/financeiro/comercial/
operacional/logistica/viewer/contador`), controle de acesso por grupo de menu
(`GRUPO_ROLES`), gate de escrita real no servidor por papel.

**[VISÃO]** Fayson gosta dessa parte, quer mais granularidade: contratar alguém
pra ver só um setor específico (logística, estoque, CRM/marketing) com
hierarquia e on/off fino do que a pessoa vê — hoje o controle é por GRUPO inteiro
de menu, não por função dentro do grupo.
**[SUGESTÃO]** Granularidade por AÇÃO dentro do módulo (ex.: vê CRM mas não pode
excluir lead; vê Financeiro mas só contas a pagar, não a receber) — precisa de
um sistema de permissões mais fino que o atual `GRUPO_ROLES` (que é on/off por
grupo inteiro).

**Faltando no menu, identificado pelo Fayson:**
- **Configurações**: senha, hierarquia, IA, cores, e outras preferências gerais.
- **Integrações**: plugar CRM externo (se o cliente não quiser usar o daqui),
  bidirecional — envia e recebe dado do sistema externo.

---

## Ideias soltas ainda não desenhadas [VISÃO]

- **Foto de perfil + indicador "online"** no chat de Conversas (referência: print
  que o Fayson mandou, estilo Tidio/Chatwoot).
- **Chat interno pra funcionários** (tipo Slack dentro do FactorOne).
- **Academy / EAD por setor** — treinar cultura e boas práticas por departamento,
  incentivo à qualidade. Referência que o Fayson deu: um app que ele já
  construiu pra "Tenda do Avivamento" (conteúdo/curso).
- **Score da Empresa** (0-100, aparece no mockup) — não confundir com o "Score
  Financeiro" (0-1000) que já existe no dashboard; precisa decidir se é o mesmo
  conceito reescalado ou uma métrica nova.
- **Símbolo/ícone de marca** — Fayson gostou do "F" atual mas quer algo que
  comunique fintech + IA + gestão. Sugestões dadas: F com seta de crescimento,
  nó de conexão (tudo integrado), F que termina em check mark.

---

## Notas técnicas importantes (pra quem for desenhar/especificar em cima disso)

- Todo dado é multi-tenant por `empresa_id`, protegido por RLS no Postgres —
  qualquer feature de Holding/multi-CNPJ precisa manter esse isolamento mesmo
  ao AGREGAR várias empresas (não pode vazar dado de uma empresa do grupo pra
  usuário sem permissão nela especificamente).
- Papel do usuário é resolvido por `usuario_empresas.papel` (fonte autoritativa,
  por user_id) — `contador`/`viewer` são leitura-apenas garantido no servidor via
  `bloquearSeLeitura`, aplicado hoje em 37 rotas do núcleo financeiro/fiscal.
- Automações (crons) já existentes: `belvo-sync` (6h, sync diário + classificação
  + matching de comprovante), `relatorio-mensal` (dia 1, 9h), `automacoes` (8h),
  `donna-email` (8h).
