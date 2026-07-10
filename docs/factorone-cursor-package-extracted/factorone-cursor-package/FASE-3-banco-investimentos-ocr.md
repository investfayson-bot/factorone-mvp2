# FASE 3 — Banco, Investimentos, OCR de Comprovantes e Ticker de Mercado

**Pré-requisito: Fases 0, 1 e 2 concluídas.**
**Referências visuais: `design-reference/03-banco.html` (Visão Geral +
Investimentos) e `04-investimentos.html` (sub-aba Investimentos, versão
completa).**

---

## Estrutura do módulo Banco

Tabs: **Visão Geral** (tem mockup) / **Extrato** (sem mockup, ver abaixo) /
**PIX & Transferências** (sem mockup, ver abaixo) / **Cartões** (sem mockup,
ver abaixo) / **Investimentos** (tem mockup completo em `04-investimentos.html`)

## Sub-aba: Visão Geral (TEM mockup — `03-banco.html`)

Seguir exatamente. Pontos que não podem ser perdidos:
- Segmented control no topo: **Consolidado (PJ+PF) / Só empresas / Só
  pessoa física** — este É o seletor da Fase 0, só que replicado como
  controle secundário dentro da própria tela (além do que já existe no
  topbar) porque aqui o contraste PJ vs PF é o assunto central da tela
- 3 cards de patrimônio: Saldo em contas PJ (tag verde), Saldo em conta PF
  (tag azul/indigo `#4F46E5`), Investimentos com todas as origens (tag âmbar)
- Gráfico de área "Patrimônio Total Consolidado" — soma tudo, linha verde
  com preenchimento gradiente
- 2 colunas: "Contas por titularidade" (lista de contas com ícone
  diferenciando PJ 🏢 de PF 👤, cor do ícone variando por instituição) +
  "Extrato recente" (feed de últimas movimentações com ícone por tipo:
  entrada verde, saída vermelha, rendimento indigo)

## Sub-aba: Extrato (SEM mockup — especificação abaixo)

Esta é a tela onde a classificação de transações (motor da Fase 0) se torna
visível e interativa. Estrutura:
- Filtros no topo: Empresa/PF (respeitando titularidade), período, tipo
  (Todas/Entradas/Saídas), status de classificação (Todas/Classificadas/
  Pendentes de confirmação)
- **Botão de destaque "Confirmar em lote"** — visível quando houver
  transações no estado `aguardando_ok` (classificadas automaticamente pela
  regra aprendida, esperando só a confirmação humana). Ao clicar, mostra
  contador ("14 transações prontas para confirmar") e permite confirmar
  todas de uma vez ou revisar uma a uma
- Tabela principal: Data | Descrição (nome bruto do lançamento, ex.: "123
  IRMAOS LTDA") | Categoria sugerida/confirmada (dropdown editável) | Valor
  | Origem (badge: 🏦 Open Finance / ✏️ Manual / 📷 OCR) | Status de
  classificação (chip: "Confirmado" verde / "Aguardando OK" âmbar tracejado
  / "Sugestão da IA, revisar" âmbar sólido)
- Clicar numa linha "Aguardando OK" mostra inline (sem modal) um botão
  grande "✓ Confirmar: [categoria sugerida]" + link pequeno "não é isso,
  trocar categoria"
- **Botão "+ Anexar extrato"** no cabeçalho — abre uma área de upload
  (drag-and-drop) que aceita PDF/OFX/CSV do banco. Ao processar, mostra uma
  prévia das transações extraídas antes de importar, para conferência
- **Botão "+ Registrar com foto"** — abre câmera/upload de imagem para
  OCR de recibo, boleto ou comprovante. Fluxo:
  1. Usuário tira foto ou faz upload
  2. Sistema processa via OCR (extrai valor, data, nome do estabelecimento)
  3. Mostra prévia editável dos dados extraídos antes de salvar, com a
     imagem original visível ao lado para conferência visual
  4. Ao confirmar, a transação entra no motor de classificação normalmente
     (Fase 0, Parte B) e o campo `documento_anexo_url` guarda a imagem
- Cada transação no extrato, se tiver comprovante anexado (seja por OCR ou
  upload manual), mostra um ícone de clipe/anexo clicável que abre a imagem

## Sub-aba: PIX & Transferências (SEM mockup — especificação abaixo)

- 2 blocos principais lado a lado: "Fazer PIX/Transferência" (formulário:
  conta de origem — respeita qual empresa/PF —, chave PIX ou dados
  bancários, valor, descrição, agendar para depois opcional) e "Histórico"
  (lista de PIX/TEDs enviados e recebidos, com status: Concluído/Pendente/
  Falhou)
- Atalho "Chaves PIX favoritas" — lista de destinatários frequentes para
  envio rápido

## Sub-aba: Cartões (SEM mockup — especificação abaixo, conecta no motor
de classificação da Fase 0)

- Cards visuais no topo, um por cartão corporativo/pessoal, no estilo já
  existente no projeto (Clara-style, mencionado no estado atual do produto)
  — reaproveitar o componente visual de cartão que já existe, só ajustar
  cor/tipografia ao novo design system
- Abaixo, **painel de detalhamento de gastos por cartão**:
  - Gráfico de barras: gasto por categoria/segmento no ciclo atual da
    fatura (puxa da classificação da Fase 0 — cada transação de cartão já
    carrega categoria + parcela)
  - Lista de compras parceladas em aberto: Estabelecimento | Parcela atual/
    total | Valor da parcela | Empresa | Categoria — permite ver de forma
    agregada "quantas parcelas tem para cada empresa e segmento" (pedido
    explícito do dono do produto)
  - Filtro por empresa (para grupos com vários CNPJs, cada um com seu
    próprio cartão) e por período de fatura
- Transações de cartão aparecem também no Extrato geral, mas aqui têm a
  granularidade extra de parcelamento visível

## Sub-aba: Investimentos (TEM mockup completo — `04-investimentos.html`)

Seguir exatamente. Pontos-chave:
- 4 KPIs: Patrimônio investido, Rentabilidade mês, Rentabilidade 12m (ambos
  comparados a % do CDI), Proventos recebidos no mês
- Donut de alocação por classe (Renda Fixa / Ações & FIIs / Fundos
  multimercado / Internacional) com legenda detalhada
- Tabela de Posições: Ativo | Origem (badge "Open Finance · [Banco]" verde
  ou "Manual" cinza) | Posição em R$ | Rentabilidade | Ações (botões
  Comprar/Vender/Resgatar conforme o tipo de ativo)
- **IMPORTANTE — não ambíguo**: os botões Comprar/Vender/Resgatar **abrem
  a ordem pré-preenchida direto na corretora de origem** (deep-link ou
  redirect), eles **não executam a ordem dentro do FactorOne**. Isso deve
  estar escrito como nota de rodapé na própria tela (já está no mockup:
  "Ordens de compra/venda abrem pré-preenchidas direto na corretora de
  origem") — não remover esse aviso, é intencional e importante para não
  criar expectativa errada no usuário
- Card "Sugestão de rebalanceamento" (IA, fundo escuro gradiente) comparando
  alocação atual vs meta definida pelo usuário
- Card "Por instituição" — soma por banco/corretora
- Card "Proventos recentes" — feed de dividendos/juros/cupons

### Widget de ticker de mercado (NOVO — não estava no mockup original,
adicionar no topo da sub-aba Investimentos, acima dos KPIs)
- Faixa horizontal fina, estilo Bloomberg/CNBC, rotação automática de cards
  pequenos mostrando: principais índices (Ibovespa, S&P 500), câmbio
  (USD/BRL), Bitcoin, e 2-3 ações/ativos relevantes à carteira do usuário
- Fontes de dado sugeridas (gratuitas, avaliar limites de uso antes de
  produção):
  - **BRAPI** (brapi.dev) para ações da B3 e Ibovespa
  - **AwesomeAPI** (economia.awesomeapi.com.br) para câmbio
  - **CoinGecko API** (gratuita, sem key para uso básico) para cripto
- Atualização a cada X minutos (não precisa ser tempo real — cache de 5-15
  min é aceitável e reduz custo de chamada), com indicador visual do horário
  da última atualização
- É puramente informativo — não interage com o resto da tela

## Critério de "pronto" desta fase
- [ ] 5 sub-abas de Banco implementadas como rotas próprias
- [ ] Visão Geral e Investimentos pixel-fiéis aos mockups
- [ ] Extrato com fluxo de classificação (auto-classificar → aguardando OK →
      confirmar) funcionando com dado real, respeitando isolamento PJ/PF
- [ ] Upload de extrato (PDF/OFX/CSV) com prévia antes de importar
- [ ] OCR de foto/comprovante funcionando (pelo menos com um provedor,
      ex. Claude com visão ou serviço de OCR dedicado) com prévia editável
- [ ] Cartões com detalhamento de parcelas por empresa/segmento
- [ ] Botões Comprar/Vender/Resgatar redirecionando corretamente para a
      corretora, com o aviso de que não executam ordem internamente
- [ ] Ticker de mercado rotativo funcionando com pelo menos 1 fonte grátis
- [ ] `npx tsc --noEmit && npm run build` passam sem erro
- [ ] Parar e confirmar visualmente antes da Fase 4
