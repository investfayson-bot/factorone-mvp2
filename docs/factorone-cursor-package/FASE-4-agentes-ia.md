# FASE 4 — Agentes IA (Omnichannel + Precisamos de Você + Acessor)

**Pré-requisito: Fases 0, 1, 2 e 3 concluídas.**
**Referência visual: `design-reference/07-agentes-ia.html`.**

---

## Mudança de layout em relação ao mockup original — LER COM ATENÇÃO

O dono do produto revisou o mockup depois de ver a screenshot e pediu uma
mudança específica: **a área de chat (coluna do meio) tem que ser maior**.
No HTML de referência as 3 colunas do omnichannel estão em proporção
aproximada 250px / 1fr / 300px. Ajustar para dar mais respiro à conversa —
proporção alvo aproximada: **22% / 56% / 22%** das 3 colunas (lista de
conversas / thread de mensagens / painel de automação), mantendo os mesmos
componentes visuais (mesmos avatares, mesmas bolhas de mensagem, mesmo
painel de toggle) só com a coluna central redistribuída para ocupar mais
espaço horizontal e vertical. A lista de contatos à esquerda continua
existindo, só fica proporcionalmente mais estreita — não remover nenhuma
informação dela, só redistribuir largura.

---

## Estrutura do módulo

Tabs: **Acessor** (sem mockup dedicado, ver abaixo) / **Conversas** (tem
mockup — `07-agentes-ia.html`) / **Automações** (integrada visualmente
dentro de Conversas, ver nota abaixo)

### Nota sobre Conversas + Automações
O mockup original tinha essas duas como telas separadas, mas ao ver o
resultado o dono do produto preferiu a versão unificada: a tab "Conversas"
já mostra o painel de automação por conversa na coluna da direita (como está
em `07-agentes-ia.html`). A tab "Automações" separada deve existir como uma
visão de configuração global (lista de TODAS as regras de todos os canais,
não só do contato selecionado no momento) — é um nível de zoom diferente,
não uma tela redundante.

## Sub-aba: Conversas (TEM mockup — `07-agentes-ia.html`)

Seguir a estrutura exata, com o ajuste de proporção de colunas descrito
acima. Elementos que não podem ser perdidos:

### Bloco "Precisamos de você" (topo, antes do omnichannel)
- Fundo âmbar clarinho com borda âmbar (`.need`, gradiente
  `#FBF1E2 → #FEF9F0`, borda `#F3D9A8`)
- Título com ícone de sino + contador de pendentes à direita
- Uma linha por item pendente: avatar do canal, nome do contato + canal,
  trecho da mensagem entre aspas, **badge com o motivo específico do porquê
  caiu ali** (nunca genérico — exemplos reais do mockup: "Fora da alçada de
  desconto autorizada", "Palavra-chave sensível: cancelamento", "Detectado
  tom urgente", "Valor acima de R$ 500 (alçada financeira)"), botão "Ver e
  responder"
- Esta lista é dinâmica, populada pelas regras de automação configuradas
  (ver Fase 6 — CRM para a lógica de alçada de negociação, que é o exemplo
  mais desenvolvido desse mecanismo)

### Coluna 1 — Lista de conversas (proporção ~22%)
- Header "Caixa de entrada" + contador total
- Um item por conversa: avatar colorido com iniciais + badge pequeno do
  canal sobreposto no canto inferior direito (ícone de check colorido:
  verde WhatsApp, rosa/roxo Instagram, azul Site, azul claro Telegram, azul
  e-mail), nome, canal + tempo decorrido, contador de não lidas
- Item selecionado tem fundo verde claro (`.oc-item.on`)

### Coluna 2 — Thread de mensagens (proporção ~56%, AUMENTADA)
- Header com nome do contato + canal + chip de status se aplicável (ex.:
  "Aguardando você" em âmbar quando há algo pendente nessa conversa
  específica)
- Bolhas de mensagem: mensagens do contato alinhadas à esquerda, fundo
  cinza claro; respostas da IA alinhadas à direita, fundo verde, com
  etiqueta pequena acima indicando o modo ("IA · automático" em texto
  branco translúcido) — **quando a IA está com uma resposta pausada
  aguardando decisão humana**, a bolha muda de cor (fundo âmbar claro,
  texto escuro) e a etiqueta vira "IA · pausada, aguardando você", com o
  texto explicando exatamente por que pausou
- Campo de digitação/envio manual do humano no rodapé da coluna (não estava
  detalhado no mockup, mas é necessário: input de texto + botão enviar, para
  o humano poder assumir a conversa a qualquer momento)

### Coluna 3 — Painel de automação da conversa (proporção ~22%)
- Um bloco por regra de automação daquele canal específico (ex.: "Responder
  dúvidas de preço", "Conceder desconto", "Agendar reunião",
  "Cancelamento/reembolso")
- Cada bloco: nome da regra + toggle visual on/off (ícone verde preenchido
  = ligado, cinza = desligado) + descrição curta da regra + badge de modo
  (`Automático` verde / `Rascunho / aprovação` âmbar / `Sempre manual` âmbar
  mais forte, sem toggle disponível — esse modo é fixo por design para ações
  sensíveis como cancelamento)

## Sub-aba: Acessor (SEM mockup dedicado — especificação abaixo)

Esta é a interface de chat direto com a IA financeira (o "AI CFO" mencionado
no stack técnico do projeto), separada do omnichannel de clientes — aqui é
o dono do negócio conversando com a própria IA do sistema, não um cliente
externo. Estrutura:
- Layout de chat simples, 1 coluna central (mais estreita que a thread do
  omnichannel, tipo largura de chat de assistente), com histórico de
  conversas anteriores acessível por um menu lateral fino (ou dropdown no
  topo) para retomar threads antigas
- Sugestões de pergunta rápida acima do campo de input quando a conversa
  está vazia (ex.: "Como está meu fluxo de caixa esse mês?", "Por que minha
  margem caiu?", "Simule um cenário de contratação")
- A IA aqui tem acesso de leitura a todos os dados do grupo (respeitando o
  seletor Consolidado/PJ/PF ativo) e pode executar ações via function
  calling já existente no projeto (buscar saldo, listar transações, gerar
  relatório PDF) — reaproveitar a infraestrutura de Tool Use que já está
  documentada no stack técnico do projeto, não recriar do zero
- Respostas em streaming (SSE), como já é o padrão do AI CFO existente

## Critério de "pronto" desta fase
- [ ] Sub-aba Conversas com as 3 colunas na proporção correta (chat maior)
- [ ] Bloco "Precisamos de você" funcional, populado por regras reais, com
      motivo específico exibido por item
- [ ] Painel de automação por conversa com toggles funcionais alterando o
      modo da regra no banco
- [ ] Sub-aba Automações (visão global de todas as regras, todos os canais)
- [ ] Sub-aba Acessor com chat funcional, streaming, e acesso aos dados do
      grupo ativo
- [ ] `npx tsc --noEmit && npm run build` passam sem erro
- [ ] Parar e confirmar visualmente antes da Fase 5
