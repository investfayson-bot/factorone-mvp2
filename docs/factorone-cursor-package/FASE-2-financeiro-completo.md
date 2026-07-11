# FASE 2 — Financeiro (reskin completo + todas as sub-abas)

**Pré-requisito: Fases 0 e 1 concluídas.**
**Referência visual: `design-reference/02-financeiro.html`** — mas atenção:
esse arquivo só renderiza a sub-aba **Visão Geral**. As outras 4 sub-abas
(Contas a Pagar, Contas a Receber, Fluxo de Caixa, DRE) NÃO têm mockup
visual — a especificação delas está escrita abaixo, com o mesmo rigor. Não
invente layout: siga a descrição literalmente, reaproveitando os componentes
visuais (`.card`, `.kpi`, tabela `table/th/td`, `.chip`) que já estão
definidos em `base.css` e usados no restante do sistema.

---

## Estrutura do módulo (vale para todas as 5 sub-abas)

Header fixo do módulo (`.mod-head`), fora da área de conteúdo rolável:
- Título "Financeiro" + rota atual em badge monoespaçado (ex.:
  `factorone.app/financeiro/contas-a-pagar`)
- Botões de ação à direita: "Exportar" (ghost) + "+ Novo lançamento" (verde,
  primário) — o botão primário muda de label conforme a sub-aba ativa
  (ex.: em Contas a Pagar vira "+ Nova conta a pagar")
- Abaixo do título, barra de tabs: Visão Geral / Contas a Pagar (com contador
  de títulos) / Contas a Receber (com contador) / Fluxo de Caixa / DRE /
  "Mais ▾" (dropdown com Assinaturas, Reembolsos, Orçamentos, Centro de
  Custos, Categorias, Forecast, Precificação — os itens que estão no hub
  "Tudo do Financeiro" da Visão Geral, ver abaixo)
- Cada tab é rota própria: `/financeiro/visao-geral`,
  `/financeiro/contas-a-pagar`, `/financeiro/contas-a-receber`,
  `/financeiro/fluxo-de-caixa`, `/financeiro/dre`

Todo dado desta tela respeita o seletor Consolidado/PJ/PF do topbar (Fase 0).

---

## Sub-aba: Visão Geral (TEM mockup — `02-financeiro.html`)

Seguir o arquivo exatamente. Resumo da estrutura para contexto:
- 4 KPI cards no topo: A pagar (7 dias), A receber (7 dias), Saldo projetado
  (30d), Inadimplência — cada um com border-top colorido (vermelho, verde,
  preto, âmbar respectivamente, ver classes `.kpi.red` `.kpi.ink` `.kpi.gold`)
- Tabela "Vencendo agora": Fornecedor, Empresa, Vencimento, Valor, Status
  (chip colorido conforme urgência)
- Hub "Tudo do Financeiro": 6 cards de atalho (Assinaturas & Recorrências,
  Reembolsos, Orçamentos, Centro de Custos, Categorias, Forecast &
  Cenários) + card de **Precificação & Margem** (ver Fase 2 - Precificação
  abaixo) — cada card leva para a tela dedicada daquele assunto
- Coluna direita: card "Por que sua margem caiu X p.p.?" (IA, fundo escuro
  gradiente, classe `.why`) + "Risco de inadimplência" (barras horizontais
  por cliente, preditivo) + "Régua de cobrança" (timeline D-3/D+1/D+7)

## Sub-aba: Contas a Pagar (SEM mockup — especificação abaixo)

Layout:
- 3 KPIs no topo: Total em aberto (mês), Vencendo em 7 dias, Vencido (valor
  em vermelho se houver)
- Filtros horizontais acima da tabela: por Empresa (multi-select respeitando
  o grupo), por Status (Todas / A vencer / Vencidas / Pagas — como tabs
  internas secundárias, estilo pill, reaproveitar `.pill-sel`), por período
- Tabela principal, colunas: Fornecedor | Empresa | Categoria | Vencimento |
  Valor | Status (chip) | Ações (ícone de pagar rápido + menu de 3 pontos
  para editar/excluir/anexar comprovante)
- Cada linha expansível (accordion) mostra: histórico de pagamento com este
  fornecedor, anexo de comprovante se houver (gancho de OCR da Fase 0), e
  campo de observação
- Botão "+ Nova conta a pagar" abre modal (usar o padrão de modal já
  existente no projeto: `.modais com double box-shadow + backdrop blur`)
  com campos: Fornecedor, Empresa, Categoria, Valor, Vencimento, Recorrente?
  (toggle — se sim, pede frequência), campo de upload de comprovante/nota

## Sub-aba: Contas a Receber (SEM mockup — especificação abaixo)

Mesmo padrão estrutural de Contas a Pagar, espelhado:
- 3 KPIs: Total a receber (mês), A vencer em 7 dias, Inadimplente (vermelho)
- Filtros: Empresa, Status (A vencer / Vencidas / Recebidas), Cliente
- Tabela: Cliente | Empresa | Vencimento | Valor | Status | Ações (cobrar
  agora via WhatsApp/e-mail — conecta com o motor de automação da Fase 4,
  reenviar boleto/PIX, marcar como recebido)
- Diferencial: cada linha tem indicador de risco de inadimplência (mesma
  lógica preditiva do card "Risco de inadimplência" da Visão Geral) — um
  ponto colorido pequeno ao lado do nome do cliente (verde/âmbar/vermelho)
- Botão "+ Nova conta a receber" com modal espelhado ao de Contas a Pagar

## Sub-aba: Fluxo de Caixa (SEM mockup — especificação abaixo)

- Seletor de período no topo (7/30/90 dias, ou range customizado — mesmo
  componente de período usado na Fase 5/Contábil, reaproveitar)
- Gráfico principal grande (usar o mesmo estilo do gráfico de fluxo da tela
  Início — barras de entrada/saída + linha de saldo projetado), mas aqui em
  tamanho maior, ocupando a largura toda, com granularidade diária
- Abaixo do gráfico: tabela detalhada dia a dia (Data | Entradas | Saídas |
  Saldo do dia | Saldo acumulado), com as linhas onde o saldo projetado é
  negativo destacadas em vermelho claro de fundo
- Card lateral (ou seção acima): "Cenários" — permite simular "e se eu
  atrasar este pagamento" ou "e se este recebível não entrar", recalculando
  a projeção ao vivo (conecta com Forecast & Cenários do hub)

## Sub-aba: DRE (SEM mockup — especificação abaixo)

- Seletor de período (mês/trimestre/ano) + seletor de empresa/consolidado
- Estrutura em cascata clássica de DRE, cada linha com valor e (quando
  aplicável) percentual sobre a receita líquida:
  ```
  Receita Bruta
  (–) Deduções e Impostos
  = Receita Líquida
  (–) Custos (CMV/CPV)
  = Lucro Bruto
  (–) Despesas Operacionais (com submenu expansível por categoria)
  = EBITDA                      ← linha em destaque, fundo verde-claro
  (–) Depreciação/Amortização
  = EBIT
  (–) Resultado Financeiro
  = Lucro Antes do IR
  (–) IR/CSLL
  = Lucro Líquido               ← linha final em destaque forte
  ```
- Gráfico de barras comparando os últimos 6 meses de EBITDA/margem ao lado
  ou abaixo da tabela
- Botão "Exportar DRE em PDF" usando o template compartilhado já existente
  (`lib/pdf/template.ts`) e o helper de download autenticado
  (`lib/download-arquivo.ts`) — não usar `<a href>` direto (causa 401
  silencioso, bug já documentado neste projeto)

---

## Precificação & Margem (tela dedicada, acessada pelo hub da Visão Geral)

**Referência visual: `design-reference/09-precificacao.html`** — seguir
exatamente. Resumo:
- Rota: `/financeiro/precificacao`
- 3 sub-tabs internas: Calculadora / Produtos salvos / Comparar cenários
- Calculadora: formulário à esquerda (custo de matéria-prima por unidade —
  kg/L/m/item/hora —, mão de obra direta, despesas fixas rateadas, impostos
  %, comissão/taxa %, margem de lucro desejada %) → resultado à direita
  (preço de venda sugerido em destaque + breakdown "de onde vem o preço" +
  matriz de 4 números: lucro antes das fixas, lucro depois das fixas, ponto
  de equilíbrio em unidades/mês, markup aplicado)
- Cálculo é em tempo real conforme o usuário digita (debounce ~300ms)
- "Produtos salvos": lista de cálculos salvos por produto/serviço, editável
- "Comparar cenários": até 3 cálculos lado a lado para comparação visual

## Critério de "pronto" desta fase
- [ ] 5 sub-abas de Financeiro implementadas como rotas próprias
- [ ] Visão Geral pixel-fiel ao mockup
- [ ] Contas a Pagar/Receber com filtros e modal de criação funcionais
- [ ] Fluxo de Caixa com gráfico + tabela diária
- [ ] DRE em cascata com exportação PDF funcional (usando os helpers
      existentes, não `<a href>` cru)
- [ ] Precificação & Margem pixel-fiel ao mockup, cálculo em tempo real
- [ ] Tudo respeitando o seletor Consolidado/PJ/PF
- [ ] `npx tsc --noEmit && npm run build` passam sem erro
- [ ] Parar e confirmar visualmente antes da Fase 3
