# Banco — redesign de fidelidade (design)

## Contexto

O Fayson trouxe mockups gerados em outro chat (referência visual completa em `docs/banco-redesign-spec.md`) descrevendo as 7 sub-abas do módulo Banco com nível de detalhe de produto real (KPIs, IA embutida, fluxos de aprovação). O módulo já existe em código (`app/dashboard/banco/*`), então isso é reconstrução/evolução de UI + preenchimento de gaps funcionais, não greenfield.

Dois problemas concretos identificados durante a investigação (não vindos do mockup, achados no código real):
1. `/dashboard/cartoes` (menu antigo) e `/dashboard/banco/cartoes` são duas páginas de cartão desconectadas, com dado inconsistente.
2. `Open Finance` não tinha sub-aba própria — existia como página solta `/dashboard/conexoes`.

## Decisões fechadas

### Tipografia
- `--font-display` migra de Space Grotesk para **Inter** (Google Fonts, já tem mecanismo de `<link>` no `app/layout.tsx` — só adicionar a família).
- Escala aplicada: Display 32px/700/1.2, Título de Seção 24px/700/1.25, Subseção 18px/600/1.35, Texto padrão 14px/400/1.55, Labels/Menus/Botões 13px/500/1.4, Caption 12px/400/1.4, valor financeiro em card 34px/700, tabela cabeçalho 12px/600 uppercase, sidebar principal 15px/600, submenu 14px/500. `letter-spacing: -0.02em` em títulos, `0` no resto. `font-variant-numeric: tabular-nums` em todo número financeiro.
- **Fora de escopo agora:** paleta de cores. Sidebar e o resto da identidade visual (sage/paper) ficam como estão. Não mexer.

### Dados
Abordagem escolhida (de 3 propostas): **híbrido** — dado real via seed no Supabase para as telas que já têm API (Extrato, PIX, Cartões, Investimentos), e endpoints novos de verdade (não mock solto) para as peças que ainda não existem (Regras IA, IA Financeira heurística, Open Finance). Critério: precisa dar pra manipular e testar de verdade pela UI (aprovar sugestão, criar regra, editar transação), então tem que persistir — mock hardcoded no frontend foi descartado por não atender isso.

IA Financeira (economia encontrada, anomalia, previsão de caixa) roda como **heurística determinística sobre o dado seedado** nesta fase — não é modelo de ML real. Fica documentado como simplificação aceita, não bug.

### Escopo por sub-aba

| Sub-aba | Escopo |
|---|---|
| Visão Geral | KPIs, bloco IA Financeira, movimentações recentes, fluxo de caixa 7 dias, pendências, ações rápidas |
| Extrato | Filtros (conta/data/categoria/origem/status), tabs incl. Não classificados/Pendentes de IA/**Regras IA** (nova), drawer de detalhe com Aprovar/Alterar |
| PIX & Transferências | Form de PIX, histórico, limites com barra de progresso |
| Cartões | **Consolidado numa página só** — elimina `/dashboard/cartoes`; tabs Visão Geral/Gastos/Faturas/Parcelamentos/Limites/Equipe |
| Investimentos | KPIs, alocação, evolução, melhores ativos do mês |
| Patrimônio | Bens e ativos por categoria, composição |
| Open Finance | Vira 7ª sub-aba do Banco (hoje é `/dashboard/conexoes` solta); layout 2 colunas — instituições conectadas + configurações de conexão |

Construção **tela por tela, com checkpoint visual** a cada uma, começando pela Visão Geral.

### Consolidação de Cartões
- `/dashboard/banco/cartoes` vira a página única, com as 6 tabs do mockup todas inline (sem navegar pra outra rota pra "gerenciar").
- Apaga `/dashboard/cartoes` (rota órfã do menu antigo "Conta PJ → Soluções"); atualiza o link em `app/dashboard/conta-pj/solucoes/page.tsx` pra apontar pro caminho novo.
- "Parcelamentos" e "Equipe" (cartão por colaborador) são tabs novas: `cartao_transacoes` já guarda parcela, falta só a visão agrupada; "Equipe" precisa de vínculo cartão↔membro (verificar se já existe coluna, senão adicionar).

### Regras IA
Tela nova dentro do Extrato: lista de regras ativas (condição → categoria, ex: "descrição contém 'Google' → Serviços, aprova automático"), criar regra, toggle ativo/inativo. Ao chegar uma transação nova, testa contra as regras antes de cair em "pendente de IA". Precisa de tabela nova `regras_classificacao` (ou nome equivalente), escopada por `empresa_id`, com RLS.

## Fora de escopo desta spec
- Reskin de cores do app inteiro (decisão adiada, sidebar e paleta atual ficam).
- Drill-down de imóvel em Patrimônio (visto em versão anterior do mockup, não confirmado pro escopo atual do Banco).
- IA real (ML) por trás dos insights — fica heurística por enquanto.

## Referência visual completa
Ver `docs/banco-redesign-spec.md` para o levantamento tela-a-tela detalhado (KPIs, campos, botões, comportamento).
