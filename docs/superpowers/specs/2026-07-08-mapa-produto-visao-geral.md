# Mapa de produto — visão geral (2026-07-08)

> **Status: notas vivas de brainstorming, não é spec final.** Objetivo desta sessão: estruturar a ideia geral com todas as perguntas respondidas ANTES de codar (instrução explícita do Fayson). Cada módulo abaixo vira sua própria spec em `docs/superpowers/specs/` quando formos desenhá-lo em detalhe.

## Por que o FactorOne existe (a tese, nas palavras do Fayson)

Os clientes reais do Fayson (imobiliária, indústria química, transportadora com frota) hoje usam Omie/Bling e "acham que dá pro gasto", mas querem algo mais inteligente. O FactorOne não é só "mais um ERP" — é oferecido em **três modos de entrada**:

1. **Produto completo** — o cliente migra pra cá e usa tudo.
2. **Só a inteligência, plugada no que ele já usa** — plugar a camada de IA/insight em cima do Omie/Bling existente do cliente, sem forçar migração.
3. **Esteira** — o modo 2 vira a porta de entrada; conforme o cliente confia, ele vai trazendo mais áreas pra dentro do FactorOne aos poucos (financeiro primeiro, depois vendas, depois o resto).

**Restrição inegociável (palavras do Fayson):** *"não quero muitos APPS plugin que não faz nada, que estão lá só pra encher linguiça."* Todo módulo rotulado como "app" precisa ser robusto e completo o bastante pra ser usado sozinho — senão não vira app, vira feature de outro módulo.

## O que já existe no código (não inventar de novo)

O FactorOne já tem exatamente a espinha dorsal que essa visão precisa — achar isso no código foi o que validou os próximos passos em vez de propor um sistema de plugin novo:

- **`lib/marketplace.ts`** — catálogo único `MARKET_APPS[]`. Cada app tem `navGroup` (onde aparece na sidebar quando instalado), `href`, categoria. Instalar/desinstalar é por empresa, persistido via `/api/apps` (RLS).
- **`app/dashboard/layout.tsx`** — `GRUPO_ROLES` (quem vê qual grupo do menu por role: admin/financeiro/comercial/operacional/logistica/viewer) + filtro por `segmento` (ex: `hidePatrimonio` esconde o grupo Patrimônio pra quem não é do segmento `imoveis`/`completo`).
- **`app/onboarding/page.tsx`** — `SEGMENTOS[]` (produto, servico, imoveis, industria, completo) já molda o workspace: cada segmento instala um preset de apps do marketplace automaticamente; o resto fica disponível pra instalar manualmente.

Ou seja: **o mecanismo de "plugar módulo no sidebar por segmento" já existe.** A pergunta não é "criar um plugin system", é "que eixo usar pra decidir o que é core vs. o que é instalável".

## O eixo proposto: Core vs. App instalável vs. Camada de inteligência

| | Definição | Exemplos |
|---|---|---|
| **Core (sempre ligado)** | Serve todo cliente, independente de segmento. Não aparece no Marketplace pra instalar/desinstalar. | Banco ([[banco-module-vision]]), Financeiro, Contador ([[contador-module-vision]]), a "Central" (feed proativo de IA — substitui o antigo conceito de "Agentes IA" no sidebar) |
| **App instalável (por segmento)** | Robusto e completo, mas só faz sentido pra parte da base. Vive no Marketplace, instala via `SEGMENTOS[].apps`. | Patrimônio, Marketing, Logística/Frota, Estoque/Produção |
| **Camada de inteligência (modo "esteira")** | Não é uma tela nova — é IA lendo/atuando em cima de um sistema externo (Omie, Bling) antes do cliente migrar de vez. | Plug-in de classificação/insight sobre dados do Omie/Bling do cliente |

Isso também resolve a dúvida específica do Fayson — *"monto algo específico pro cliente plugar, ou já coloco no sidebar?"* — a resposta depende de qual das 3 categorias acima o módulo cai.

## Classificação do que foi discutido até agora

### Core
- **Banco** — dash estilo banco real + classificação automática de transação (estilo QuickBooks) por categoria e fornecedor/cliente. Detalhe: [[banco-module-vision]]. Ainda não desenhado em spec própria.
- **Financeiro** — dash "de verdade", workflow profissional, departamentos conversando entre si (ex: uma venda no CRM já bate no DRE — isso já existe parcialmente via `produtos` → DRE). Precisa spec própria detalhando o que "departamentos se conversando" significa em telas concretas.
- **Contador / Contábil & Fiscal** — P&L, status de IR, upload de documento, regime fiscal, multi-CNPJ, convite de contador com portal próprio. Detalhe: [[contador-module-vision]]. Ainda não desenhado em spec própria.
- **Central (IA)** — resolvido nesta sessão: **não** é um seletor de 7 agentes (`hub-agentes.ts` fica só como orquestração de backend). É um item único no menu, feed proativo tipo central de notificação ("seu DAS vence em 3 dias", "gasto 40% maior em posto de gasolina"). Ver [[factorhub-project]].

### Apps instaláveis (Marketplace)
- **Patrimônio** — hoje é um grupo hardcoded escondido por `hidePatrimonio`, **não** está no catálogo `MARKET_APPS`. O Fayson já decidiu: precisa virar app de verdade (entrada em `MARKET_APPS`, instalável, com ícone/rating/etc como os outros). Cliente-alvo: imobiliária (múltiplos imóveis, aluguel), mas também donos de empresa com imóveis pessoais (ex: cliente de produtos químicos com casas/apê/casa de praia alugada).
- **Marketing** — já existe como app `mkt` (`navGroup: 'Clientes & Vendas'`), mas raso perto do que o Fayson quer. O Fayson já decidiu que vira app próprio (não só um item dentro de Vendas). Escopo pedido: ler e responder e-mail automaticamente (com toggle on/off), postar automaticamente no Instagram/redes sociais, criar conteúdo (posts, reels, vídeos), widget de chat embutível no site/redes do cliente respondendo perguntas e mandando conteúdo — tudo com IA fazendo por trás. Precisa spec própria.
- **Vendas/CRM** — já existe (`crm`, `pipeline`, `captacao`, `posvenda`, `propostas`). O pedido é elevar o nível: inteligência tipo HighLevel — visão de quanto se gasta, CAC, estratégia pra baixar CAC, com "especialista" (IA) por setor. Precisa spec própria pra detalhar o que muda em relação ao que já existe.
- **Logística/Frota** — já existe `logistica`. Cliente-alvo: transportadora com frota de caminhões que hoje usa Bling e quer algo mais inteligente. Precisa avaliar o que existe hoje vs. o que falta pra "gestão de frota de verdade".
- **Estoque/Produção** — já existe `inv`/`produtos`. Cliente-alvo: fabricante de produtos químicos (compra insumo, fabrica, vende produto E serviço — ex: lavanderia usando os próprios produtos), múltiplos funcionários, carro de empresa, entrega, estoque. Precisa avaliar o que existe hoje vs. o que falta.

### Resolvido nesta sessão (pergunta que o Fayson deixou comigo)
**"Agendamento completo + automação de e-mail + atendimento/follow-up — isso é o quê?"**

Recomendação: **não é um app novo.** Divide por função, encostando no que já existe:
- **Agendamento** (link de marcação, calendário) continua onde já está — dentro do fluxo de Vendas/CRM (app `agenda` já existe, vira lead + reunião no CRM).
- **Automação de e-mail, post automático em rede social, criação de conteúdo, chat embutível no site** — isso É a substância do app **Marketing** reconstruído (ver acima). Não é módulo à parte; é o que faz o Marketing deixar de ser raso.
- **Acesso via Telegram/WhatsApp** ("na palma da mão": métrica, se pagou ou não, marcar reunião, mandar e-mail) — não é um app, é uma **camada de entrega transversal** que já tem base commitada (agente que age via Telegram, acessor de bolso) e deveria expor a Central + qualquer módulo core/instalado via comando, não ser reconstruída do zero.

## Personas/clientes reais citados (pra ancorar as specs de cada módulo)

1. **Imobiliária** — quer "inteligência imobiliária", autonomia de ações: financeiro, vendas/CRM, marketing, controle da plataforma como um todo.
2. **Indústria química** (compra insumo, fabrica, vende produto e serviço — ex: lavanderia com produto próprio) — precisa de arquitetura financeira saudável, fluxo de caixa bem montado, múltiplos funcionários, veículo de empresa, entrega, controle de estoque. Também tem patrimônio pessoal (casas, apê, casa de praia alugada) — candidato a usar o app Patrimônio também.
3. **Transportadora/frota** — usa Bling hoje, precisa de gestão de frota mais inteligente.
4. **Cliente com site/e-commerce genérico** — precisa ver: quanto vende, custo real do produto, custo antes/depois de despesas fixas, preço final, margem de lucro — isso é essencially o Financeiro + Produtos&Margem já existentes, mas a pergunta em aberto é como ele *conecta* essas informações (via plugin no site dele, ou via app instalado no FactorOne — depende do módulo, ver eixo Core/App acima).

## Decisões já fechadas nesta sessão
- FactorHub não é produto à venda separado — vira camada interna de IA do FactorOne. ([[factorhub-project]])
- Sidebar não mostra "Agentes IA" como seletor de chat — vira "Central", feed proativo único.
- Patrimônio e Marketing: confirmado pelo Fayson que ambos viram apps instaláveis de verdade (não ficam soltos/hardcoded).
- Agendamento/automação/atendimento: não vira app novo — se distribui entre Vendas (agendamento) e Marketing (automação/conteúdo/chat), ver acima.

## Banco — desenho em andamento (aguardando aprovação final do Fayson, ver histórico de chat)

Achado ao investigar o código: hoje o caminho de uma transação do Belvo até virar dado útil passa por **3 telas/passos manuais**: `extrato_bancario` (feed cru) → **Conciliação** (confirma que é real, só aí grava em `transacoes`) → **Classificar** (`app/dashboard/classificar/page.tsx`, só depois disso a IA categoriza). `conta-pj` é a terceira tela (visual de banco: saldo/cartão/extrato).

Decisões já confirmadas pelo Fayson nesta sessão (retomar se a conversa pivotar antes da aprovação final do desenho completo):
- **Dashboard único**: fundir `conta-pj` (visual) + Conciliação + `classificar` (categorização) numa tela só. `Banco` vira grupo **Core** (sai do Marketplace/`MARKET_APPS`, sempre visível, não depende de segmento/instalação).
- **Fluxo em um clique**: cada transação nova do extrato aparece pronta pra confirmar — concilia (grava em `transacoes`) E classifica (categoria + fornecedor/cliente) ao mesmo tempo, sem 2 telas separadas.
- **Tag de fornecedor/cliente**: novo campo `fornecedor_id`/`cliente_id` (nullable, FK) em `transacoes` — linka com cadastro REAL de `fornecedores`/`clientes` (não texto livre). Segue o mesmo padrão de nomenclatura já usado em `20260508200000_sprint9_crm_marketing_logistica.sql` e `20260508300000_sprint10.sql`.
- **Auto-criação de cadastro**: quando o nome do estabelecimento do Belvo não bate com nenhum fornecedor/cliente existente, a IA **sugere** criar um novo cadastro, mas só grava quando o usuário confirma (evita poluir a base com nomes crus de extrato tipo "PIX 8817").
- Abas propostas no dashboard único: Visão geral · Fila (a revisar) · Extrato/Classificadas · Resumo (por categoria e por fornecedor/cliente, filtrável por semana/mês/ano).
- Fora de escopo desta spec: reclassificação em massa de transações antigas, regras automáticas tipo "sempre que vier de X classifica Y sem perguntar" (fica pra depois), múltiplas contas Belvo (já suportado pelo sync atual).

## Em aberto — perguntas ainda sem resposta (não codar até resolver)
1. **Banco**: desenho acima aguardando aprovação final — falta o Fayson confirmar o desenho consolidado antes de virar spec fechada.
2. **Financeiro**: o que concretamente significa "departamentos se conversando" em tela — quais módulos precisam mostrar dado de qual outro módulo?
3. **Contador**: modelo de permissão pra contador convidado (um contador atendendo vários clientes, um cliente com vários CNPJs) ainda não existe no modelo atual de single-tenant-per-usuário — precisa desenho de RLS/roles novo.
4. **Marketing**: quais integrações de verdade (Instagram API, WhatsApp Business API, e-mail — Gmail/Outlook?) o Fayson já tem acesso/credencial, e quais dependem de aprovação de terceiro (Meta, Google) que pode travar prazo.
5. **Vendas/CRM "estilo HighLevel"**: o que especificamente falta hoje no CRM/pipeline atual pra chegar nesse nível (funil, automação de sequência, etc.)?
6. **Logística/Frota** e **Estoque/Produção**: gap entre o que já existe (`logistica`, `inv`, `produtos`) e o que os dois clientes reais (química, transportadora) realmente precisam.
7. **Ordem de construção**: depois do mapa aprovado, em que ordem atacar os módulos? (Banco foi a sugestão original por ser fundação de dados pros outros, mas o Fayson pediu o mapa geral primeiro — retomar essa decisão depois que o mapa estiver validado.)

Related: [[factorhub-project]], [[banco-module-vision]], [[contador-module-vision]].
