# FASE 6 — Clientes & Vendas (Pipeline Automático + Alçada + Ofertas)

**Pré-requisito: Fases 0 a 5 concluídas.**
**Referência visual: `design-reference/08-crm.html`** — cobre a sub-aba
Pipeline. As sub-abas Visão Geral, Agendamento, Propostas e Pós-venda NÃO
têm mockup — especificação abaixo.

---

## Estrutura do módulo

Tabs: **Visão Geral** (sem mockup, ver abaixo) / **Pipeline** (TEM mockup) /
**Agendamento** (sem mockup, ver abaixo — mas já existe backend, é reskin) /
**Propostas** (sem mockup, ver abaixo — já existe backend, é reskin) /
**Pós-venda** (sem mockup, ver abaixo, módulo mais novo) / **Mais ▾**
(Dashboard de Ofertas — ver seção própria abaixo)

## Sub-aba: Pipeline (TEM mockup — `08-crm.html`)

Seguir exatamente. Elementos que não podem ser perdidos:

### Kanban com temperatura
- 4 colunas: Prospect / Qualificação / Proposta / Negociação, cada uma com
  contador de negócios + soma de valor no header
- Cada card: nome da empresa/negócio, nome do contato, **badge de
  temperatura** (Frio azul / Morno âmbar / Quente vermelho com ícone de
  chama), valor do negócio
- Card parado há muito tempo sem contato mostra aviso vermelho pequeno
  abaixo do valor (ex.: "⚠ 12 dias parado, sem contato")
- Card em negociação automática pela IA tem borda verde + fundo verde claro
  + linha "🤖 IA negociando dentro da alçada"

### Preenchimento automático do pipeline (pergunta direta do dono do
produto — respondida com este comportamento obrigatório)
- Quando o usuário classifica manualmente a temperatura de um lead (frio/
  morno/quente) em qualquer tela do sistema (ex.: dentro de uma conversa no
  Agentes IA), esse lead entra automaticamente na coluna "Prospect" do
  Pipeline se ainda não existir um card para ele
- Quando o Assessor IA (Agentes IA, Fase 4) identifica sinal de intenção de
  compra dentro de uma conversa (linguagem de interesse, pedido de
  orçamento/proposta), cria o card automaticamente na coluna apropriada,
  já com a temperatura sugerida pela IA (o usuário pode corrigir depois)
- Mover um card de coluna manualmente (drag-and-drop) sempre é possível e
  tem prioridade sobre qualquer sugestão automática

### Card "Alçada de negociação" (fundo escuro gradiente, mesmo padrão `.why`
usado em outras telas)
- Aparece quando um card específico do Kanban é selecionado/aberto
- Mostra: Desconto autorizado (slider/barra visual até o limite definido
  pelo usuário, ex. "até 15%"), Canal permitido (ex. WhatsApp), Cliente
  classificado (badge de temperatura), Negociação automática (toggle on/off)
- Texto de rodapé explicando o estado atual em linguagem natural (exemplo
  literal do mockup: "A IA já ofereceu 10% e o cliente ainda não fechou.
  Como está com ON, ela pode chegar até os 15% autorizados sem te avisar de
  novo — só cai em 'Precisamos de você' se pedir mais que isso.")
- Esta é a MESMA infraestrutura de alçada/toggle da Fase 4 (Agentes IA),
  aplicada especificamente a negociação de desconto — não duplicar lógica,
  reaproveitar o motor de regras

### Registro de auditoria da negociação
- Lista cronológica de eventos daquele negócio específico: quando a IA
  ofereceu desconto, quando o cliente pediu algo fora da alçada, quando o
  humano aprovou manualmente, quando a temperatura foi (re)classificada —
  cada evento com timestamp e origem (IA/humano)

## Sub-aba: Visão Geral (SEM mockup — especificação abaixo)

Hub-resumo do módulo, mesmo princípio das outras Visões Gerais:
- KPIs: Total em pipeline (R$), Taxa de conversão (mês), Ticket médio,
  Tempo médio de fechamento
- Funil visual (Prospect → Qualificação → Proposta → Negociação → Fechado)
  mostrando quantidade e valor em cada etapa, com taxa de passagem entre
  etapas
- Lista de "Leads quentes sem contato recente" — cruzamento direto de
  temperatura + tempo parado, alimentando a fila de atenção do usuário

## Sub-aba: Agendamento (SEM mockup — já existe backend no projeto, é
reskin visual, não feature nova)
- Calendário (mesmo componente reaproveitado de Marketing/Contábil) com
  compromissos de vendas: reuniões, follow-ups, ligações agendadas
- Lista lateral ou abaixo com os compromissos do dia/semana selecionada,
  vinculados ao negócio/contato do Pipeline

## Sub-aba: Propostas (SEM mockup — já existe backend, é reskin visual)
- Lista de propostas enviadas: Cliente | Negócio vinculado | Valor | Status
  (Rascunho/Enviada/Visualizada/Aceita/Recusada) | Data de envio
- Ação de criar nova proposta a partir de um card do Pipeline

## Sub-aba: Pós-venda (SEM mockup — módulo mais novo, especificação básica)
- Lista de clientes fechados com status de onboarding/satisfação
- Espaço para registrar NPS ou feedback pós-venda, se o projeto já tiver
  essa captura — caso não tenha, deixar como estrutura simples de anotação
  por cliente para esta fase, aprofundar depois se necessário

## Dashboard de Ofertas (NOVO — pedido do dono do produto, "não sei se vai
ficar ali, mas pensei aqui agora" — decisão: mora dentro de Clientes &
Vendas, acessível pela tab "Mais ▾")
- Rota: `/clientes-vendas/ofertas`
- Objetivo: dar visibilidade agregada de todas as ofertas/descontos que a
  IA está oferecendo ou já ofereceu, através de todos os negócios ativos —
  hoje essa informação só existe espalhada card por card no Pipeline
- Estrutura sugerida:
  - KPIs: Ofertas ativas agora, Desconto médio oferecido, Taxa de aceite de
    oferta, Valor total em desconto concedido no mês
  - Tabela: Cliente | Negócio | Desconto oferecido | Status (Aguardando
    resposta/Aceita/Recusada/Expirada) | Canal | Automática ou manual
  - Filtro por faixa de desconto e por temperatura do cliente
- Esta tela é nova e não tem mockup de referência anterior — pode seguir o
  padrão visual geral do sistema (cards `.kpi`, tabela `table/th/td`) sem
  necessidade de replicar pixel a pixel algo que não foi desenhado ainda;
  o rigor visual das outras fases não se aplica aqui da mesma forma, mas a
  paleta de cores e tipografia (Design Tokens do documento mestre) continua
  obrigatória

## Critério de "pronto" desta fase
- [ ] 5 sub-abas + Dashboard de Ofertas implementados como rotas próprias
- [ ] Pipeline pixel-fiel ao mockup, incluindo card de alçada e log de
      auditoria
- [ ] Preenchimento automático do Kanban funcionando (classificação manual
      de temperatura cria/move card; IA detecta intenção e cria card)
- [ ] Alçada de negociação reaproveitando o motor de regras da Fase 4, não
      duplicando lógica
- [ ] Dashboard de Ofertas com dado real agregado de todos os negócios
- [ ] `npx tsc --noEmit && npm run build` passam sem erro
- [ ] Parar e confirmar visualmente antes da Fase 7
