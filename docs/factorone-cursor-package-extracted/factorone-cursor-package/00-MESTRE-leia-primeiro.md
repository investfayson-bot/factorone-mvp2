# FactorOne Finance OS — Documento Mestre de Reskin + Features Novas

Este é o guia de referência para TODAS as fases abaixo. Leia isto antes de começar
qualquer fase, e volte aqui sempre que tiver dúvida de critério.

---

## Contexto do projeto

- Projeto: FactorOne Finance OS — "a Brex brasileira", B2B fintech SaaS para PMEs
  e PJ/PF, com IA integrada em todos os módulos.
- Stack: Next.js App Router (16.2) + Supabase (Postgres) + Stripe + Anthropic API.
- Estado atual: build já tem 152 rotas, ~80% do backend e das telas já existe e
  funciona com dados reais. **Isto NÃO é um projeto do zero.** É reskin visual +
  reorganização de informação arquitetural + um punhado de features novas de
  backend descritas abaixo, fase por fase.
- Deploy: Vercel, auto-deploy a cada push em `main`.
- Repo: `investfayson-bot/factorone-mvp2`.

## Regra de ouro — fidelidade visual

Existe uma pasta `design-reference/` com 9 arquivos `.html` + `base.css` que são
**mockups aprovados pelo dono do produto, pixel a pixel**. Isso não é
"inspiração" — é a fonte da verdade.

1. **NUNCA reinterprete visualmente.** Se o mockup diz `border-radius: 12px`,
   use exatamente 12px. Se a cor é `#16A34A`, use exatamente essa cor. Não existe
   "parecido o suficiente" neste projeto.
2. **Extraia os valores do CSS, não olhe só a screenshot.** O arquivo `.html`
   tem os valores exatos; a imagem PNG é só para conferência humana.
3. **Reaproveite as classes já definidas em `base.css`** (`.card`, `.kpi`, `.chip`,
   `.tab`, `.nav-item`, `.why` — o card de insight de IA, etc.) em vez de criar
   componentes novos com o mesmo propósito.
4. **Onde o mockup mostra dado fictício** (nomes como "Juliana Oliveira",
   valores como "R$ 835.420"), isso é só para visualização — sempre plugar
   dado real do Supabase, nunca copiar o número do mockup.
5. **Onde este documento descrever uma sub-aba que NÃO tem HTML de referência**
   (ex.: "Contas a Pagar" dentro de Financeiro), a descrição em texto abaixo
   É a especificação — trate com o mesmo rigor que trataria um mockup visual.
   Não improvise layout: pergunte antes de inventar, se algo não estiver claro.

## Design tokens (resumo — detalhe completo em design-reference/DESIGN_TOKENS.md)

```css
--sb: #0C1D16;        /* sidebar bg */
--acc: #16A34A;        /* verde principal */
--acc2: #22C55E;       /* verde vivo (badges) */
--acc-soft: #E7F5EC;   /* fundo verde claro */
--acc-ink: #0E7A38;    /* texto verde escuro */
--bg: #F3F6F4;         /* fundo geral */
--card: #FFFFFF;
--line: #E5EBE7;
--ink: #111C16;        /* texto principal */
--mut: #68746E;        /* texto secundário */
--neg: #DE4B4B;         /* vermelho */
--warn: #D97706;        /* âmbar */
```
Fontes: **Space Grotesk** (títulos, números, KPIs) + **Manrope** (corpo, labels).
Já devem estar carregadas em `app/layout.tsx` — se não estiverem, adicionar via
Google Fonts, não via CSS import (bug já resolvido antes nesse projeto: mudança
de fonte só funciona se feita em `app/layout.tsx`, não só no CSS).

## Sidebar definitiva (vale para TODAS as fases, não muda)

```
PRINCIPAL
  Início                (Command Center — Fase 1)
  Agentes IA             (badge com contador de conversas)
SOLUÇÕES
  Banco
  Financeiro
  Clientes & Vendas
  Contábil & Fiscal
  Marketing
EXTRAS
  Apps & Marketplace     (Academy, Chat Interno, etc. viram apps aqui dentro)
  Equipe & Planos         (billing/assinatura entram aqui, não em Configurações)
  Integrações
  Configurações
--- rodapé ---
  Perfil do usuário (avatar + nome + cargo)
```
Regra de navegação: **dropdown só para trocar de entidade** (seletor de
Holding/PJ/PF no topbar). **Sub-aba (tab no topo do módulo) para trocar de
tela dentro do módulo.** Nunca criar dropdown de sub-página na sidebar — isso já
foi decidido e rejeitado antes.

## Regra de rotas

Cada sub-aba é uma **rota própria de verdade**, não estado de componente:
`/financeiro/visao-geral`, `/financeiro/contas-a-pagar`, `/financeiro/dre` etc.
Isso permite bookmark, botão voltar funcional, e compartilhar link direto de
uma tela específica. Nunca implementar sub-aba como `?tab=x` só.

## Regra do seletor Holding / PJ / PF

Em TODAS as telas, o topbar tem o seletor:
`[GS] Grupo Santos · Consolidado [4 PJ + PF] ▾`

Ele controla o **escopo de dado que a tela mostra** — é a peça mais importante
de todo o redesign, por isso é a Fase 0. Três estados:
- **Consolidado**: soma todos os PJs do grupo + a PF do usuário
- **Só empresas**: soma só os PJs
- **Só pessoa física**: mostra só a conta/investimentos/patrimônio pessoal
Trocar o seletor **refiltra a tela inteira** sem reload de página (client-side
com re-fetch dos dados filtrados por `empresa_id IN (...)` ou pela PF).
**Classificação de transações e plano de contas NUNCA se misturam entre
titularidades** mesmo na visão consolidada — o dado de origem sempre carrega
a tag de qual empresa/PF pertence.

## Regra de "IA que decide vs IA que avisa"

Isso aparece em várias fases (Agentes IA, CRM) e é um princípio, não uma
feature isolada — vale registrar aqui uma vez:
- Toda ação automatizável tem **três modos possíveis**: `Automático` (a IA
  faz e só informa depois), `Rascunho/Aprovação` (a IA prepara, humano aprova
  antes de sair), `Sempre manual` (nunca decide sozinha, ex.: cancelamento,
  reembolso acima de limite).
- O modo é configurável por regra, com toggle on/off visual (ícone de toggle
  verde=on / cinza=off, já está nos ícones inline dos mockups de referência).
- Quando uma ação cai fora da alçada automática, ela vai para a fila
  **"Precisamos de você"** (ver Fase 3 — Agentes IA) com o motivo específico
  exposto (não um genérico "revisar"), ex.: "Fora da alçada de desconto
  autorizada", "Valor acima de R$ 500 (alçada financeira)".
- Toda decisão da IA — automática ou aprovada — fica registrada em log de
  auditoria, timestamped, visível pro usuário (ver Fase 5 — CRM).

## Ordem das fases

| Fase | Nome | Por quê nessa ordem |
|---|---|---|
| 0 | Holding multi-CNPJ+PF & Motor de Classificação | Tudo depende disso — backend puro, sem tela nova |
| 1 | Início / Command Center + reskin da sidebar/topbar | Primeira tela visível, valida o design system em produção |
| 2 | Financeiro (reskin + sub-abas completas) | Módulo mais usado, maior ganho imediato |
| 3 | Banco + Investimentos | Depende do motor de classificação (Fase 0) já rodando |
| 4 | Agentes IA (omnichannel + Precisamos de você) | Depende de Início e Financeiro já no ar |
| 5 | Contábil & Fiscal (cofre, regime, portal do contador) | Módulo mais denso de informação nova |
| 6 | Clientes & Vendas (CRM + alçada de negociação) | Depende de Agentes IA (mesmo motor de automação) |
| 7 | Marketing + Patrimônio com IA de documentos | Módulos novos de escopo maior, ficam por último |

Cada fase tem seu próprio arquivo de prompt neste pacote. **Não pule fases.**
Ao terminar uma fase, rode sempre:
```
npx tsc --noEmit && npm run build
```
Só faça commit/push se os dois passarem. Depois de cada fase, pare e peça
confirmação visual antes de seguir para a próxima — não encadeie fases sem
revisão.
