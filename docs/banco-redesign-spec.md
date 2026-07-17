# Banco — spec de redesign (mockups 2026-07-16)

Fonte: mockups gerados pelo Fayson em outro chat (imagens `ChatGPT Image Jul 16, 2026`), versão final usada como referência: a com a tela de Conexões/Open Finance no canto inferior direito.

Módulo já existe em código: `app/dashboard/banco/` (visao-geral, extrato, pix-transferencias, cartoes, investimentos, patrimonio) + `app/dashboard/conexoes/page.tsx`. Isso é redesign/evolução, não construção do zero.

## Estrutura fixa (todas as sub-telas)

- Sidebar: Início, Agentes IA (badge contagem) / Banco (ativo), Financeiro, Clientes & Vendas, Contábil & Fiscal, Marketing / Apps & Marketplace, Equipe & Planos, Integrações, Configurações / rodapé "Acessor IA — Pergunte sobre seu banco" + Nova conversa + perfil
- Header: breadcrumb + rota (`factorone.app/banco/...`), busca global ⌘K, ícones (+, notificação, ajuda, avatar), "Exportar", botão verde "Nova operação"
- Sub-tabs do Banco: Visão Geral · Extrato · PIX & Transferências · Cartões · Investimentos · Patrimônio · **Open Finance**

## 1. Visão Geral

- KPIs: Saldo consolidado, Saldo em contas (quebra PJ/PF), Investimentos, Patrimônio total, Gastos no mês (donut categorias)
- "Contas conectadas" — avatares/ícones dos bancos conectados, resumido
- Bloco **IA Financeira**: Economia encontrada (R$), Anomalia identificada (contagem), Conciliações pendentes (contagem), Previsão de caixa (30 dias) — link "Ver todas as análises"
- Movimentações recentes: tabs Todas/Entradas/Saídas/PIX/Transferências/Cartões, tabela Data/Descrição/Categoria/Origem/Valor/Status
- Fluxo de caixa (7 dias, seletor de período): barras Entradas/Saídas + linha Saldo, resumo Entradas/Saídas/Saldo proj.
- Pendências: conciliações, comprovantes, aprovações — com contagem e link
- Ações rápidas: Novo PIX, Transferência, Pagar boleto, Depositar, Extrato PDF, Comprovante, Agendar OFX

## 2. Extrato

- Filtros: conta, intervalo de datas, categoria, origem, status, "mais filtros"
- Tabs: Todas / Entradas / Saídas / Não classificados (N) / Pendentes de IA (N) / Regras IA / Anexos
- Tabela: Data, Descrição, Categoria, Origem, Valor, Status
- **Drawer de detalhe da transação** (clique na linha):
  - Detalhes: origem, CPF/CNPJ contraparte, conta destino, categoria, centro de custo, projeto, descrição, NF vinculada
  - **IA sugeriu categoria + % de confiança** → botões **Aprovar** / **Alterar**
  - Ações: comprovante, PDF, e-mail, WhatsApp, compartilhar, baixar PDF
  - Anexos com tamanho de arquivo e download
  - Bloco "IA Financeira" contextual (ex.: "essa receita é recorrente, média mensal R$X, últimos N meses")

## 3. PIX & Transferências

- Form "Fazer PIX": chave (CPF/CNPJ/e-mail/telefone/aleatória), nome do favorecido, valor, descrição, conta de origem (com saldo exibido), botão Continuar
- Histórico de PIX: tabs Todos/Enviados/Recebidos/Favoritos/Recentes
- Ações rápidas: Ler QR Code, PIX Copia e Cola, Transferência, Agendar PIX, Comprovantes
- Limites PIX: diário restante e mensal restante, cada um com barra de progresso

## 4. Cartões

- KPIs: limite total, utilizado no mês (%), disponível, transações no mês
- Card visual por cartão (nome, bandeira, responsável, status, disponível) + tile "Novo cartão"
- Tabs: Visão Geral / Gastos / Faturas / Parcelamentos / Limites / Equipe
- Gastos por categoria (donut) + últimos gastos (lista)
- Resumo da fatura atual: vencimento, valor aberto, pagamento mínimo, botão "Ver fatura"

## 5. Investimentos

- KPIs: patrimônio investido, rentabilidade mês/ano (R$ e %), CDI ano, IPCA ano
- Alocação por classe (donut: Renda Fixa, Fundos, Ações, Criptomoedas, Outros)
- Evolução do patrimônio (linha, por mês)
- **Melhores ativos do mês** (lista com rentabilidade individual)
- Ações rápidas: Aplicar, Resgatar, Meus objetivos, Simulador, Extrato de IR, Relatório completo

## 6. Patrimônio

- KPI: patrimônio total + variação no mês
- "Bens e ativos": lista por tipo (Imóveis, Investimentos, Veículos, Participações, Outros ativos) com valor e contagem
- Composição do patrimônio (donut)
- Ações rápidas: Adicionar bem, Avaliar bem, Gerar relatório, Exportar completo
- Link "Ver patrimônio completo"
- **Drill-down de imóvel** (exemplo visto numa versão anterior do mockup): endereço, tipo, área, valor atual, renda mensal, sócios; tabs Resumo/Documentos/Financeiro/Locatários/Obras/Contratos; dados de aquisição vs. valorização; contrato de locação vigente; **IA insights** (aluguel abaixo do mercado, preço/m² abaixo da região, reajuste pendente)

## 7. Open Finance (Conexões bancárias)

Rota: `factorone.app/banco/conexoes-bancarias` (hoje existe como `/dashboard/conexoes`, precisa virar sub-tab do Banco).

- Coluna "Instituições conectadas": banco, conta, última sincronização, status (Conectado / "Expira em N dia(s)" quando o consentimento Open Finance está perto de vencer), botão "+ Conectar nova instituição"
- Coluna "Configurações de conexão":
  - Sincronização automática (toggle)
  - Importar histórico (seletor de período, ex. 12 meses)
  - Categorias automáticas (toggle — liga/desliga classificação por IA das transações dessa conexão)
  - Botão "Gerenciar conexões"

## Pontos em aberto / não resolvidos pelos mockups

1. "Regras IA" (tab do Extrato) — conteúdo da tela de criação de regras de classificação não foi mostrado.
2. Drill-down de imóvel: modal/drawer ou rota própria (`/patrimonio/imoveis/[id]`)? Precisa decisão de arquitetura.
3. Anomalia identificada / Previsão de caixa / Economia encontrada — esses 3 cards do bloco "IA Financeira" implicam lógica de análise real (detecção de outlier, forecast, negociação de tarifas). Precisa definir se é IA de verdade (chamada a modelo) ou heurística determinística primeiro.
4. "Melhores ativos do mês" em Investimentos — depende de ter rentabilidade por ativo individual, não só por classe.
