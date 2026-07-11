# Fase 5 — progresso e plano (handoff entre sessões)

Este arquivo não é parte do pacote original (`FASE-5-contabil-fiscal-portal-contador.md`
continua sendo a especificação-fonte). É uma nota de handoff escrita na sessão Linux em
2026-07-11, **antes de qualquer código ser escrito**, porque o Fayson pediu pra próxima
sessão (Windows) continuar a partir daqui. Memória do Claude Code é local por máquina e
não sincroniza entre os dois clones — por isso isso vai como arquivo versionado no repo,
não só como memória.

## Estado: Blocos 1 e 2 CONCLUÍDOS (commits 675e5ad e 2695cd4, sessão Windows, 2026-07-11). Próximo: Bloco 3 (Obrigações + links_governamentais), aguardando checkpoint do Fayson.

## Handoff 2026-07-11 (fim do dia, sessão Windows → claude.ai/code)

O Fayson vai continuar via claude.ai/code — estado operacional completo:

- **Login dele**: migrado de invest.fayson@gmail.com para
  **contato@factorone.com.br** (auth + public.usuarios, mesma senha).
- **Telegram**: bot ativo é **@Factorone1bot** (o @FactorONe_Bot anterior
  foi descartado, webhook removido). Webhook registrado pra
  /api/webhooks/telegram com secret; TELEGRAM_BOT_TOKEN e
  TELEGRAM_WEBHOOK_SECRET atualizados no Vercel production; Fayson
  redeployou e CONFIRMOU o bot funcionando. Vincular conta: Dashboard →
  Integrações → Telegram → Gerar código → mandar os 6 dígitos no bot.
- **E-mail**: EMAIL_PROVIDER=mailtrap ativo (Resend desligado por enquanto —
  domínio factorone.com.br pendente de verificação DNS lá; quando verificar,
  é só remover EMAIL_PROVIDER do Vercel que o Resend volta como principal).
  MAILTRAP_TOKEN no Vercel. ATENÇÃO: domínio demo do Mailtrap estourou a
  cota (403 usage limit no teste real) e só entrega pro e-mail do dono da
  conta Mailtrap — o convite bonito (template com banner/foto já pronto em
  app/api/equipe/convidar) só chega quando um provedor destravar.
- **Google/Gmail (erro 401 diagnosticado)**: GOOGLE_CLIENT_ID/SECRET
  estavam VAZIOS ("") em produção. Fayson criou as credenciais no Google
  Cloud, colocou no .env.local, e ambas foram atualizadas no Vercel
  production (ID validado: termina .apps.googleusercontent.com; secret
  GOCSPX-). **Falta redeploy pra valerem** — o próximo push em main
  auto-deploya. Depois: Agentes IA → Automações → Conectar Google.
- **Cofre Fiscal**: migration 20260711040000 JÁ RODADA em produção
  ("fiscal OK success"). Validação visual do Fayson ainda pendente.
- **Pendências do Fayson**: (a) validar Blocos 1-2 no app; (b) OK ou não
  pra contador poder ADICIONAR docs no Cofre (hoje pode, não exclui);
  (c) conferir RLS de notas_fiscais no painel Supabase; (d) rotacionar
  tokens que passaram em texto puro no chat (bot Telegram, Mailtrap).
- **Visão nova registrada**: "acesso total pelo Telegram" (mandar/gerar
  e-mail, anotações, últimos e-mails, agenda, saldo, tráfego do site,
  atendimento) — vira spec própria DEPOIS da Fase 5; não começar antes.
  **Ampliação (verbatim do Fayson, 2026-07-11)**: o @Factorone1bot tem que
  ser mais que assistente financeiro — assistente pessoal completo, agindo
  como CEO/CFO/COO em todos os níveis, gerenciando o sistema E o dia a dia.
  Exemplos dele: mandar FOTO de recibo no Telegram → bot lê (OCR já existe
  em /api/contabilidade/processar-recibo) e lança no sistema; extrato de
  cartão; arquivo/Excel de patrimônio/imóveis; vencimento de conta; boleto —
  identificar e categorizar TUDO sozinho, pro cliente que não consegue nem
  abrir o sistema. Isso conversa 1:1 com a visão "classificação universal"
  (memória visao-classificacao-universal-2026-07-11): o Telegram vira mais
  um canal de ENTRADA do mesmo pipeline documento→IA→classificação. Peças
  existentes reaproveitáveis: webhook do Telegram já recebe mensagem, OCR de
  recibo pronto, motor de classificação da Fase 0, importador de extrato.
  Falta: receber FOTO/arquivo no webhook (hoje só texto), rotear por tipo de
  documento, e o pipeline Excel de patrimônio (Fase 7 do pacote cobre
  patrimônio-OCR).
- **Próximo trabalho de código**: Bloco 3 (Obrigações — calendário fiscal
  + tabela links_governamentais + link Gov.br por obrigação), depois
  checkpoint, Bloco 4 (Simulador de Regime — revisor-financeiro
  OBRIGATÓRIO antes de dar por pronto), Bloco 5 (feed de notícias).

Bloco 2 (Cofre Fiscal): tabela `cofre_fiscal_documentos` (migration
20260711040000 — RODAR no Supabase), upload via /api/cofre-fiscal (bucket
`recibos`, prefixo cofre/), URL assinada e reenvio por e-mail via rotas
próprias. Decisão de produto pendente de OK do Fayson: papel contador PODE
adicionar docs ao Cofre (é o histórico do que ele fez), mas não excluir;
viewer 100% leitura. Guias de tax_obrigacoes aparecem automaticamente.
Também nesse intervalo: fix do e-mail de convite (from não verificado +
erro engolido; template profissional novo) — domínio factorone.com.br
verificando no Resend (DNS pending do lado do Fayson); plano B anotado:
Mailtrap com marca d'água como feature.

Bloco 1 entregue conforme o plano abaixo, com um adendo importante: a revisão
rls-tenant-guardian achou 2 furos CRÍTICOS pré-existentes de RLS
(contadores_public_read expunha token_acesso de todas as empresas pra anon;
membros_equipe_token_read USING(true) deixava qualquer login enumerar equipe
e tokens de convite de todos os tenants) + 1 escalada (papel contador
escrevia em tax_obrigacoes/contadores direto do client). Tudo corrigido no
mesmo commit: migration 20260711030000 (JÁ RODADA em produção pelo Fayson),
endpoint /api/equipe/convite/[token], rotas /api/fiscal/registrar-das e
/api/contadores/gerenciar com bloquearSeLeitura. PENDÊNCIA: confirmar no
painel do Supabase se `notas_fiscais` tem RLS em produção (definição só
existe em script solto antigo, não nas migrations — se não tiver, é crítico).

## O que já existe no repo (achado por investigação, não presumir do zero)

A parte mais difícil da Fase 5 — RBAC do papel Contador + cockpit multi-cliente sem
logout — **já está construída e funcionando**, só não está organizada nas rotas/nav
novas ainda:

- **RBAC + troca de empresa sem logout**: tabela `usuario_empresas` (user_id, empresa_id,
  papel) — migration `20260709000000_multi_empresa.sql`. `lib/supabase-route.ts` tem
  `getPapelAtivo()` e `papelPodeEscrever()`/`bloquearSeLeitura()`
  (`PAPEIS_SO_LEITURA = new Set(['contador', 'viewer'])`). Troca de empresa ativa:
  `GET /api/empresas` (lista empresas do login) + `POST /api/empresas/trocar`
  (`{empresa_id}`, valida vínculo, atualiza `usuarios.empresa_id` com service key — sem
  logout/relogin, mesma mecânica que já serve a troca Holding PJ/PF). Convite como
  contador (cria linha `usuario_empresas` com `papel='contador'`, login completo):
  `app/api/equipe/convidar/route.ts` (aceita `role: 'contador'`).
- **`app/dashboard/escritorio/page.tsx`**: é literalmente o cockpit "modo contador vendo
  seus clientes" que a Fase 5 pede — grid buscável de empresas, separa `clientes`
  (papel==='contador') de `proprias`, botão "Abrir contabilidade" chama
  `/api/empresas/trocar` e navega. **Não está linkado na sidebar hoje** (órfão, só por
  URL direta).
- **`app/dashboard/contadores/page.tsx`** (plural): metade "dono do negócio vendo seu
  contador" — card do contador, convite com login completo (usa o mesmo
  `/api/equipe/convidar`), **e também** um sistema paralelo mais antigo de link
  só-leitura por token (tabela `contadores`, campo `token_acesso`, modal de
  gerar/revogar). Obrigações nessa tela são mock hardcoded, não dado real.
- **`app/contador/[token]/page.tsx`** + `app/api/contador/[token]/*`: o portal público
  sem login que consome esse token — DRE/Lançamentos/Notas/Despesas, export CSV,
  XML/PDF de notas.
- **Sidebar hoje**: o item "Contábil & Fiscal" (`app/dashboard/layout.tsx`) aponta pra
  `/dashboard/contabilidade/livros` (balancete/balanço/fechamento), não pra nenhuma das
  telas acima.

O que **não existe** e precisa ser construído do zero:
- Cofre Fiscal (vault de documentos fiscais com filtro tipo/competência) —
  `app/dashboard/cofre/page.tsx` existe mas é outra coisa (vault de senha/API key,
  colisão de nome só).
- Obrigações de verdade (calendário + vencimentos + link Gov.br por obrigação) — só
  mock hoje.
- Tabela `links_governamentais` — não existe; `app/dashboard/fiscal/page.tsx` tem um
  array hardcoded (`PORTAIS`) de ~20 links Gov.br/SEFAZ/eSocial, é o mais próximo.
- Simulador de Regime (Simples vs Presumido vs Real) — só existe cálculo de Simples/DAS
  (`lib/fiscal/simples-nacional.ts`, usado em `app/dashboard/simples/page.tsx` e na aba
  "Tributação IA" de `app/dashboard/contabilidade/page.tsx`). Presumido e Real: nada.
- Feed de notícias de mudança de legislação (RSS) — nada no repo.
- Componente `PeriodBar` reaproveitável (Imprimir/Baixar PDF/Reenviar) — não existe como
  componente; só fragmentos parecidos em `app/dashboard/relatorios/page.tsx`
  (`baixarArquivo` de `lib/download-arquivo.ts`) e `app/dashboard/despesas/page.tsx`.
  "Reenviar por e-mail" não existe em lugar nenhum ainda.

"Apps soltos" que a Fase 5 deveria consolidar (nenhum tem mapeamento 1:1 exato com as
5 sub-abas da spec): `app/dashboard/fiscal/page.tsx` (portais Gov.br estáticos),
`app/dashboard/contabilidade/page.tsx` (recibos+OCR / lançamentos / Tributação IA),
`app/dashboard/contabilidade/livros/page.tsx` (balancete/balanço — é o que a sidebar
linka hoje como "Contábil & Fiscal"), `app/dashboard/tax/page.tsx` (registrar pagamento
de imposto, pequeno), `app/dashboard/nota-fiscal/page.tsx` (stub morto, já redireciona
pra `/dashboard/notas`).

## Decisões já tomadas com o Fayson (não reabrir sem motivo novo)

1. **Acesso do contador**: só login real via `usuario_empresas` (papel `contador`) vai
   pra frente. O sistema de link por token (`/contador/[token]`) **para de ser
   oferecido pra convites novos** — motivo do Fayson: token não passa por MFA nem gera
   audit log de verdade, contraria os requisitos já travados na plataforma (Resolução
   BCB 85, log imutável LGPD/Bacen). **Não quebrar links já enviados** — não deletar
   `app/contador/[token]/*` nem a tabela `contadores`, só parar de expor a UI de "gerar
   novo link" em `contadores/page.tsx`. Pro caso "contador externo que só vai olhar uma
   vez": usar o convite com login completo já existente (`/api/equipe/convidar` com
   `role:'contador'`) em vez de criar um fluxo de magic link novo — **checar antes de
   implementar** se esse convite já manda e-mail com link de criação de senha/login
   (parece que sim, dado o nome do commit `f145b9a "convite com login completo direto
   na area Contador"`); se sim, não precisa construir nada novo pra isso, só remover a
   opção de token.

2. **Ordem de execução**: quebrar em blocos, com checkpoint do Fayson entre eles —
   **não fazer tudo de uma vez**.
   - **Bloco 1 (baixo risco, "porta o que já existe")**: pode ir inteiro sem pausa no
     meio. Ver plano detalhado abaixo.
   - **Bloco 2**: Cofre Fiscal — parar e confirmar antes do Bloco 3.
   - **Bloco 3**: Obrigações + tabela `links_governamentais` — parar e confirmar antes
     do Bloco 4.
   - **Bloco 4**: Simulador de Regime (Simples/Presumido/Real) — **atenção especial**,
     o Fayson foi explícito que quer conferir a lógica de cálculo com cuidado antes de
     seguir, porque vira decisão tributária real de cliente. Rodar `revisor-financeiro`
     nisso antes de considerar pronto, não só depois.
   - **Bloco 5**: Feed de notícias (RSS) — pode ser o último, é o de menor risco/impacto.

## Plano do Bloco 1 (ainda não implementado — é isto que a próxima sessão faz primeiro)

1. `app/dashboard/contabil-fiscal/layout.tsx` — casca do módulo com 5 tabs (Visão
   Geral / Obrigações / Impostos & Regime / Cofre Fiscal / Portal do Contador), mesmo
   padrão de `app/dashboard/banco/layout.tsx` / `financeiro/layout.tsx` /
   `agentes/layout.tsx` (mod-head, mod-tabs, route-v2).
2. Atualizar `app/dashboard/layout.tsx` — item "Contábil & Fiscal" da sidebar passa a
   apontar pra `/dashboard/contabil-fiscal/visao-geral` (ou index com redirect, mesmo
   padrão banco/financeiro/agentes) em vez de `/dashboard/contabilidade/livros`.
3. `/dashboard/contabil-fiscal/portal-contador/page.tsx` — portar
   `app/dashboard/escritorio/page.tsx` quase como está (seção "Seus clientes", só
   aparece se o login tiver pelo menos uma empresa com papel `contador`) + versão
   enxuta de `app/dashboard/contadores/page.tsx` pra seção "Seu contador" (card do
   contador responsável, convite com login completo) — **removendo** a UI de gerar link
   por token (decisão 1), mantendo o resto do arquivo/tabela intocado no banco.
   `app/dashboard/escritorio/page.tsx` e `app/dashboard/contadores/page.tsx` viram
   redirect pra essa rota nova (mesmo padrão `donna/page.tsx` → `agentes/conversas`).
4. `/dashboard/contabil-fiscal/impostos-regime/page.tsx` — portar o cálculo de
   Simples/DAS existente (`lib/fiscal/simples-nacional.ts`) como baseline, com nota
   visível "comparação com Presumido/Real chega no Bloco 4" — não fingir que o
   simulador de 3 regimes já existe.
5. `/dashboard/contabil-fiscal/obrigacoes/page.tsx` e `/cofre-fiscal/page.tsx` —
   placeholder "em construção", linkando pras telas antigas equivalentes mais próximas
   (`fiscal/page.tsx` pros portais Gov.br, no caso de Obrigações), mesmo padrão usado
   no Extrato/PIX/Cartões da Fase 3 antes de serem construídos de verdade.
6. `/dashboard/contabil-fiscal/visao-geral/page.tsx` — hub com KPIs (alguns
   necessariamente vazios/placeholder até os Blocos 2-3 existirem: "próxima obrigação"
   fica sem dado até Obrigações ser real) + atalhos pra Cofre Fiscal, Simulador,
   Portal do Contador, e pras telas antigas sem mapeamento 1:1 que ficam standalone
   (`contabilidade/page.tsx` — recibos/lançamentos/Tributação IA,
   `contabilidade/livros/page.tsx` — balancete/balanço, `fiscal/page.tsx` — portais
   Gov.br, `tax/page.tsx`) — mesmo padrão do `/dashboard/relatorios` na Fase 2 (mantido
   standalone e linkado, não forçado pra dentro de uma sub-aba sem mapeamento).
7. `npx tsc --noEmit && npm run build` limpos, commit, **perguntar antes de dar push**
   se for a primeira vez pushando depois de reabrir a sessão (verificar se há commits
   novos em `origin/main` primeiro — `git fetch` — já que o outro lado (Windows/Linux)
   pode ter avançado noutra coisa nesse meio tempo).

## Contexto de processo (pra não repetir descoberta)

- Ver `[[reskin-cursor-package]]` (memória) pro histórico completo das Fases 0-4 e a
  regra geral do processo (uma fase por vez, checkpoint visual, sem fan-out de
  subagentes na implementação — só pra revisão pontual como
  `ciberseguranca`/`rls-tenant-guardian`/`revisor-financeiro`).
- Fase 4 (Agentes IA) + expansão fora de sequência (Telegram/e-mail no inbox de
  Conversas) já commitadas e pushed: `6d05164` e `648aeae`.
- Ambiente: `.env.local` local não tem `TELEGRAM_BOT_TOKEN`/`WEBHOOK_SECRET`/
  `USERNAME`, `GOOGLE_CLIENT_ID/SECRET`, `WHATSAPP_TOKEN` configurados — só em
  produção/Vercel, presumivelmente. Verificação visual headless não é viável neste
  container (falta `libnspr4`, sem sudo) — confirmar rodando `npm run dev` e abrindo
  no navegador de verdade.
