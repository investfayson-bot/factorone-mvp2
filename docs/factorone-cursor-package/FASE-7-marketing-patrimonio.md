# FASE 7 — Marketing + Patrimônio com IA de Documentos

**Pré-requisito: Fases 0 a 6 concluídas.**
**Referência visual: `design-reference/06-marketing.html`** — cobre a
sub-aba Visão Geral de Marketing. Patrimônio não tem mockup — especificação
abaixo. As demais sub-abas de Marketing (Calendário Editorial, Tráfego
Pago, Campanhas, E-mail Marketing) aparecem parcialmente dentro da Visão
Geral do mockup, mas como telas dedicadas seguem a especificação abaixo.

---

## MARKETING

### Estrutura do módulo
Tabs: **Visão Geral** (TEM mockup) / **Calendário Editorial** (elementos no
mockup, expandir para tela cheia) / **Tráfego Pago** (elementos no mockup,
expandir) / **Campanhas** (elementos no mockup, expandir) / **E-mail
Marketing** (sem mockup) / **Mais ▾**

### Sub-aba: Visão Geral (TEM mockup — `06-marketing.html`)
Seguir exatamente. Elementos-chave:
- 4 KPIs: Investimento em ads (mês), ROAS médio, Leads gerados (mês) com
  CPL médio, Alcance orgânico
- Card "Assessora de Marketing — gerar conteúdo" (IA, fundo escuro
  gradiente): campo de input com o prompt do usuário + 3 cards de
  sugestão de conteúdo gerado (carrossel/reels/story) + botões "Agendar no
  calendário" e "Gerar mais variações"
- Calendário editorial resumido (semana/mês) com posts marcados por tipo
- Campanhas ativas com barra de progresso + ROAS por campanha
- Coluna direita: Tráfego pago por canal (Meta/Google, com investimento e
  ROAS), card "O que está funcionando" (IA), card explicando a integração
  com o chat de vendas (origem de lead rastreada)

### Sub-aba: Calendário Editorial (versão dedicada, tela cheia)
- Mesmo componente `.cal-grid` do mockup, mas ocupando a largura toda,
  com navegação mês anterior/próximo
- Cada post no calendário é clicável, abre detalhe/edição (canal, texto,
  imagem, horário de publicação, status: Rascunho/Agendado/Publicado)
- Botão "+ Novo conteúdo" abre o mesmo fluxo de geração por IA do card da
  Visão Geral

### Sub-aba: Tráfego Pago (versão dedicada, tela cheia)
- Detalhamento por canal (Meta Ads, Google Ads) com métricas completas:
  investimento, impressões, cliques, CTR, CPL, conversões, ROAS
- Gráfico de evolução do investimento e ROAS ao longo do tempo
- Conexão com contas de anúncio via OAuth (Meta Business, Google Ads) — se
  ainda não conectado, mostrar estado vazio com botão "Conectar conta"

### Sub-aba: Campanhas (versão dedicada, tela cheia)
- Tabela completa de campanhas: Nome | Canal | Investimento | Leads |
  Conversões | ROAS | Status (Ativa/Pausada/Encerrada) | Ações
- Permitir pausar/retomar campanha diretamente (se a integração de API
  permitir essa ação, senão só leitura nesta fase)

### Sub-aba: E-mail Marketing (sem mockup — especificação básica)
- Lista de campanhas de e-mail enviadas/agendadas: Assunto | Lista/
  Segmento | Taxa de abertura | Taxa de clique | Data de envio
- Editor simples de novo e-mail (pode reaproveitar o gerador de conteúdo
  por IA do card da Visão Geral, adaptado para formato de e-mail)

---

## PATRIMÔNIO (dentro de Banco, ou módulo próprio — decisão de IA abaixo)

### Onde mora esta tela
O produto já tem uma tela de Patrimônio existente ("Patrimônio (baixa
fixed)" no estado atual do projeto) — esta fase evolui essa tela existente,
não cria do zero. Ela deve ficar acessível a partir de Banco (tab "Mais ▾")
ou como sub-aba própria dentro de Banco, mantendo consistência com o resto
do módulo financeiro.

### Objetivo (pedido explícito e detalhado do dono do produto)
Permitir que o usuário cadastre imóveis/lotes/bens de posse (via foto,
planilha Excel, ou outro documento), e a IA organiza tudo automaticamente
por endereço, cidade, preço, metragem — calculando inclusive tributos
aplicáveis (ITBI na aquisição, imposto sobre a venda se vendido).

### Fluxo de cadastro
1. Usuário escolhe o método de entrada: **Upload de foto** (do documento,
   contrato, ou matrícula do imóvel), **Upload de planilha** (Excel/CSV com
   múltiplos imóveis de uma vez), ou **Cadastro manual** (formulário direto)
2. Se foto/documento: processar via OCR + extração estruturada (mesmo
   princípio do OCR de comprovante da Fase 3, mas com prompt/schema
   diferente, focado em: endereço completo, cidade/UF, metragem, valor de
   aquisição, data de aquisição, tipo de imóvel)
3. Se planilha: parser de Excel/CSV mapeando colunas para os mesmos campos
   estruturados — mostrar prévia editável antes de importar em lote
4. Em qualquer um dos casos, mostrar uma tela de conferência antes de
   salvar definitivamente, com todos os campos extraídos editáveis

### Estrutura da tela (lista + detalhe)
- Lista principal: card ou linha por imóvel, com foto/thumbnail, endereço,
  cidade, metragem, valor atual estimado, valor de aquisição, variação
- Filtro por cidade e por tipo de imóvel
- Ao abrir um imóvel específico:
  - Dados completos (endereço, metragem, matrícula se houver, documentos
    anexados)
  - **Cálculo de ITBI**: campo de alíquota municipal (o sistema NÃO deve
    tentar adivinhar automaticamente a alíquota de cada prefeitura do
    Brasil — isso varia por município, tipicamente entre 2% e 3%, sem uma
    base pública unificada e confiável disponível gratuita para consulta
    automática). Em vez disso: o sistema sugere uma alíquota padrão
    editável (ex.: 2% como default nacional aproximado) e pede para o
    usuário confirmar/corrigir a alíquota real do município daquele imóvel
    na primeira vez — depois disso, salva como preferência por cidade,
    similar ao motor de "regra aprendida" da classificação de transações
    (Fase 0), para não perguntar de novo para a mesma cidade
  - Com a alíquota confirmada, calcula automaticamente: ITBI devido (sobre
    o valor de aquisição) e, se o imóvel for marcado como vendido, ganho de
    capital estimado e imposto sobre a venda (seguindo a lógica de IR sobre
    ganho de capital em alienação de bens, com as isenções legais comuns —
    ex. único imóvel abaixo de determinado valor — sinalizadas como aviso,
    não como cálculo automático definitivo; sempre exibir nota de que é uma
    estimativa e recomendar validação com o contador antes de decisão
    definitiva)

### Ligação com outros sistemas (visão de longo prazo do dono do produto)
O dono do produto mencionou que Gestão de Cartão de Crédito + Patrimônio +
integração com sites imobiliários/e-commerce/contabilidade são os primeiros
clientes-alvo dessa combinação de inteligências. Nesta fase, não é
necessário construir a integração externa com portal imobiliário — apenas
garantir que o modelo de dados do Patrimônio (endereço estruturado, preço,
metragem, status de venda) seja limpo o suficiente para, no futuro, servir
de fonte para uma integração desse tipo sem precisar remodelar o schema.

## Critério de "pronto" desta fase
- [ ] Marketing: 5 sub-abas implementadas como rotas próprias, Visão Geral
      pixel-fiel ao mockup
- [ ] Gerador de conteúdo por IA funcional, criando rascunhos que podem ser
      agendados no calendário editorial
- [ ] Patrimônio: fluxo de cadastro por foto, planilha e manual funcionando,
      com prévia editável antes de salvar
- [ ] Cálculo de ITBI e estimativa de imposto sobre venda funcionando com
      alíquota confirmável e "lembrada" por cidade
- [ ] `npx tsc --noEmit && npm run build` passam sem erro
- [ ] Esta é a última fase do pacote — ao concluir, fazer uma revisão geral
      de todas as 7 fases juntas antes de considerar o reskin encerrado
