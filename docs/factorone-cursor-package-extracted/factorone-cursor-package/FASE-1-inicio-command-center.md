# FASE 1 — Início / Command Center + Reskin da Casca (Sidebar/Topbar)

**Pré-requisito: Fase 0 concluída e confirmada.**
**Referência visual: `design-reference/01-inicio.html`** — abra este arquivo
no navegador e no editor lado a lado enquanto trabalha nesta fase.

---

## O que muda estruturalmente (afeta TODAS as telas futuras)

### Sidebar
Reskin completo seguindo `base.css` classes `.sidebar`, `.logo`, `.nav-label`,
`.nav-item`. Detalhes que não podem ser aproximados:
- Fundo verde-escuro quase preto (`--sb: #0C1D16`), não preto puro
- Item ativo: gradiente sutil horizontal + barra verde de 3px colada na
  borda esquerda (ver `.nav-item.on::before` em `base.css`) — isso é o
  indicador de localização atual, tem que estar pixel-preciso
- Ícones em outline/stroke, não preenchidos, 16x16, stroke da cor
  `#8CA096` quando inativo e `#4ADE80` quando o item está ativo
- Estrutura de grupos: "PRINCIPAL" (Início, Agentes IA) / "SOLUÇÕES" (Banco,
  Financeiro, Clientes & Vendas, Contábil & Fiscal, Marketing) / "EXTRAS"
  (Apps & Marketplace, Equipe & Planos, Integrações, Configurações)
- Rodapé fixo com avatar + nome + cargo do usuário (não rola com o menu)

### Topbar
- Seletor de Holding/PJ/PF à esquerda (da Fase 0 — Parte A)
- Busca central com atalho `⌘K` visível
- Ações à direita: botão verde de "+" (ação rápida/novo), sino de
  notificação com badge numérico vermelho, avatar do usuário
- Fundo branco, borda inferior de 1px na cor `--line`

## A tela Início / Command Center

Esta é a nova home do sistema — substitui o dashboard atual. Estrutura de
cima para baixo, **coluna principal (esquerda, mais larga) + rail lateral
(direita, fixo 316px)**:

### 1. Hero (saudação + score)
Dois cards lado a lado:
- Card de saudação: "Boa tarde, [Nome]" + subtítulo com data + contagem de
  empresas ativas no canto direito
- Card de Score da Empresa: número grande 0-100 (reescalar o score existente
  que hoje é 0-1000, dividir por 10) + selo textual ("Excelente" acima de 80,
  ajustar faixas conforme já definido no sistema) + sparkline dos últimos 30
  dias à direita

### 2. "Hoje na sua operação" — o Command Center de verdade
Grid de 4 cards fixos, um por área: **Financeiro, Vendas, Fiscal, Banco**.
Cada card segue este template exato:
```
[ícone] [Nome da área]                    [bolinha de status: verde/âmbar/vermelho]
✓ [linha de coisa positiva/concluída, com dado real]
⚠ [linha de pendência/alerta, com dado real]
[link de ação específico da área] →
```
Dados reais a plugar por área:
- **Financeiro**: pagamentos realizados hoje (count), contas vencendo nas
  próximas 24-48h (count) → link para Financeiro/Contas a Pagar
- **Vendas**: leads novos hoje (count), leads sem resposta há mais de 24h
  (count) → link para Clientes & Vendas/Pipeline
- **Fiscal**: documentos enviados ao contador (status), próxima obrigação
  vencendo em N dias → link para Contábil & Fiscal/Obrigações
- **Banco**: última sincronização Open Finance (horário), última
  movimentação relevante → link para Banco/Extrato
A bolinha de status por card é: verde se não há pendência crítica, âmbar se
há pendência não urgente, vermelho se há algo vencido/atrasado.

### 3. KPIs consolidados (5 cards em linha)
Caixa Consolidado, Receita (Mês), Lucro Líquido (Mês), Fluxo Previsto (30d),
Margem EBITDA. Cada card tem: label pequeno, valor grande em Space Grotesk,
variação percentual vs período anterior (verde se positivo, vermelho se
negativo), e uma sparkline SVG fina no rodapé do card. Estes 5 números
**respeitam o seletor de escopo do topbar** (Consolidado/PJ/PF).

### 4. Gráficos (2 colunas: 1.55fr + 1fr)
- Esquerda: Fluxo de Caixa consolidado, 30 dias, barras de entrada (verde)
  e saída (vermelho) + linha de saldo projetado (preta) sobreposta. Uma
  anotação flutuante deve aparecer automaticamente sobre o primeiro dia em
  que o saldo projetado fica negativo (se houver), no estilo balão escuro
  com seta — ver `.ann` em `01-inicio.html`
- Direita: Donut de Receita por Empresa (mês), com legenda lateral mostrando
  nome de cada empresa, percentual e valor — puxa direto das empresas do
  grupo (Fase 0)

### 5. Card "Insights de hoje" (IA)
Fundo escuro gradiente (`.insights`, mesmo padrão do card `.why` usado em
outras telas), badge "FACTORONE AI", 4 mini-cards de insight em grid. Cada
insight é gerado a partir de análise real dos dados do período (reaproveitar
o endpoint de análise que já existe no projeto, `/api/transacoes/analisar`)
— nunca são frases fixas, sempre calculadas a partir do dado real do grupo.

### 6. Despesas por Categoria + DRE resumido (2 colunas)
- Esquerda: barras horizontais por categoria de despesa, ordenadas da maior
  para a menor, com percentual do total
- Direita: mini-DRE (Receita Líquida, Custos, Despesas, EBITDA + margem)
  com link "Ver completo" para Financeiro/DRE

### Rail lateral direito (fixo, 4 cards empilhados)
1. **Conversas em tempo real** — últimas 5 conversas ativas do Agentes IA,
   com avatar colorido, ícone do canal (WhatsApp/Instagram/Site/Telegram/
   E-mail) sobreposto no canto do avatar, nome, canal+horário, badge de
   não-lidas
2. **Agenda de hoje** — próximos compromissos do dia, horário + título +
   contexto (empresa/cliente)
3. **Pendências & Aprovações** — contador de solicitações aguardando
   aprovação, contas a pagar vencendo, documentos para assinar + linha de
   alerta fiscal se houver (ex.: certificado digital vencendo)
4. **Atalhos rápidos** — grid 2x2 de botões: Nova cobrança, Emitir NF-e,
   Registrar despesa, Conectar banco (cada um leva direto para a ação no
   módulo correspondente)

## Critério de "pronto" desta fase
- [ ] Sidebar e topbar no padrão visual exato do mockup em toda página logada
- [ ] Início renderizando com dado real (não mockado) respeitando o seletor
      Consolidado/PJ/PF
- [ ] Os 4 cards de "Hoje na sua operação" com dado real e links funcionais
- [ ] `npx tsc --noEmit && npm run build` passam sem erro
- [ ] Parar e confirmar visualmente antes da Fase 2
