# FactorOne — Visão de produto + Backlog (fonte única da verdade)

> Consolidado 2026-07-09 a partir da visão do Fayson + auditoria profissional
> (`docs/auditoria-navegacao.html`). Este é o arquivo único — não espalhar em outro lugar.

## PRINCÍPIO CENTRAL — o que estamos vendendo
**Inteligência embutida em CADA setor, não um corpo de agentes de IA solto no sidebar.**
Ninguém quer "perguntar pra todos os agentes". A IA tem que agir sozinha, dentro de cada área,
e o usuário SENTIR isso. Vendemos a inteligência por trás — não um sistema estático.

Exemplos concretos do que "inteligência embutida" significa:
- **Veículos:** usuário sobe o contrato do carro → a IA lê e preenche os dados sozinha (sem digitar).
- **Cobrança:** usuário tira foto de um cheque/recibo/nota e diz "guarda e cobra pra mim" →
  o sistema entende, guarda e executa a cobrança.
- Regra geral: tudo que hoje é digitação manual deve virar "joga aqui que eu resolvo".

**Quando o Fayson cita ClickUp / GoHighLevel / QuickBooks:** NÃO é pra comparar. É pra
**construir exatamente a solução que eles entregam, já rodando aqui, e ENTÃO diferenciar com
inteligência** — plugando mais coisas, mais facilidade, pensando pelo usuário. A solução deles
é o piso, não o teto.

## COMO TRABALHAR COM O FAYSON (feedback — profissionalismo nível 100)
- Não fazer ele repetir a mesma coisa 3-5 vezes. Capturar de primeira e de forma durável.
- Quando ele pergunta "mais alguma coisa? algum update?" — FALAR proativamente o que sei,
  não ficar quieto e depois admitir "ah, você tinha razão, passou". Antecipar, não reagir.
- Achar o quadro completo de uma vez, não bug por bug.

---

## ⏰ PRAZO: no ar SEMANA QUE VEM para VENDA (já atrasado)

### PRIORIDADE Nº1 PRA VENDER: Recorrência financeira
Cobrança recorrente / assinatura — sem isso não vende. É o topo da fila.

### Donna — IA de e-mail e triagem de leads (tarefa concreta)
Em `contato@factorone.com.br` chegam submissions de clientes pedindo demo; alguns mandaram
mensagem. A Donna deve:
- Ler as mensagens recebidas E as ENVIADAS.
- Analisar o perfil de cada lead e classificar **quente / morno / frio**.
- Só então mandar o link de teste, adequado ao perfil.
- **Ficar no canal (e-mail) respondendo e fazendo follow-up** com os clientes — não só uma resposta.
- No envio: mandar também um **PDF explicando o sistema** + um **login especial de 1 mês grátis**
  pra essa pessoa usar.

### Campo de sugestões com diagnóstico em 48h (feature no sistema)
Dentro do sistema, um campo "coloque aqui sua sugestão de mudança". Fluxo prometido ao cliente:
**diagnóstico pronto em 48h para execução.** Serve pra captar o que os usuários estão achando e
o que precisa mudar — canal direto de feedback → execução rápida.

## FOCO — o que entregar SEMANA QUE VEM (prioridade do Fayson)

### 1. Financeiro completo
DRE, Fluxo de Caixa (com gráficos), Contas a pagar/receber, Despesas, **tracking de assinaturas**,
vendas, transações, **cartão de crédito (com a feature nova de parcelas de hoje)**, Classificação.
- Contas a pagar HOJE quebra ao criar manual → BUG a corrigir.

### 2. CRM + automação + e-mail + agendamento
Estilo GoHighLevel, já rodando. **Acessível também por Telegram/WhatsApp como "acessor".**
Agendamento estilo Google Calendar + automação de e-mail (o mockup que o Fayson mandou).

### 3. Marketing completo
### 4. Rede social + criação de conteúdo + sites + landing pages **de verdade** + e-commerce (como apps)
### 5. Patrimônio como APP (não fixo no menu) com funções inteligentes
### 6. Plugabilidade da inteligência
Opção de **plugar essas inteligências em sites, e-commerce ou outros sistemas** — a pessoa pode
usar SÓ a inteligência, sem o resto do sistema.

### 7. PF + PJ juntos
- Opção de migrar/usar como PF também.
- **PF e PJ no mesmo sistema** (se o usuário contratar os dois juntos) — pra diferenciar na hora
  das taxas.

### 8. Portal do Contador
Fácil, tipo QuickBooks. Precisa:
- Ver a diferença PF vs PJ e todos os features acima.
- **Export sabendo qual mês / qual período exportar** (hoje NÃO tem isso — "coisa boba que já
  deveria estar lá").

---

## SIDEBAR — estado alvo (decisões do Fayson)
DEIXAR no sidebar:
- **Banco (Open Finance)** — read-only por enquanto.
- **Gestão de cartão completa** (com a feature de parcelas de hoje).
- **Classificação** — saber pra onde vai o dinheiro, onde está gastando e em quê.
- **PIX** (como sugerido na auditoria).
- e mais.

NÃO agora:
- **Abertura de conta bancária** → deixar no app como **"em breve / em acesso"** (coming soon), não ativo.

## DASHBOARD — decisão do Fayson (importante, não confundir)
- **MANTER o dashboard atual** (círculos de atalho + insights). O Fayson GOSTA dele.
- **NÃO usar o dashboard do mockup** — falta informação demais.
- **FALTA: gráficos.** Dashboard é pra ter TODA a informação. Principalmente o **Financeiro com gráficos**.
- Patrimônio e afins: se for muita coisa, mostrar em formato **linear/compacto**, não tudo espalhado.

---

## ✅ PROGRESSO (branch feat/enxugamento-nav — 2026-07-09)
- [x] Grupos duplicados fundidos: Gestão financeira+Financeiro→Financeiro; Contabilidade+
      Contabilidade & Fiscal→Contábil & Fiscal (commit 396bca1)
- [x] RH saiu de Configurações → grupo próprio; Marketing e Investimentos → solução própria
- [x] Abertura de conta → badge "em breve"; Crédito & Financiamento removido do menu (a767f8f)
- [x] M&A fora da vitrine (campo `oculto`, página preservada); Patrimônio virou app opt-in (c3ae6fa)
- [x] "Comece por aqui" JÁ tinha auto-hide em 100% + botão Dispensar ✕ (nada a fazer)
- [x] **Cockpit do contador** (`/dashboard/escritorio`) — contador vê todos os clientes num
      login só; consome /api/empresas + /api/empresas/trocar (seguros). Commit 478406b.
- [x] **Segurança (rls-tenant-guardian auditou o cockpit):** cockpit é seguro, SEM vazamento
      cross-tenant. Mas o revisor achou um fail-open pré-existente, CORRIGIDO (commit 92f7236):
      papel agora vem de `usuario_empresas.papel` (por user_id), não de e-mail; helper
      `getPapelAtivo`/`bloquearSeLeitura` em lib/supabase-route (contador/viewer = leitura-apenas
      no servidor); /api/equipe/convidar com gate por papel + e-mail normalizado.

### ⏭️ PRÓXIMOS PASSOS (branch feat/enxugamento-nav — pra continuar no Windows)
1. **Ligar o convite de contador → membership:** hoje `/api/contabilidade/convidar-contador`
   cria só uma linha na tabela `contadores` (token). Pro cockpit ENCHER a seção "Clientes",
   o convite precisa TAMBÉM inserir em `usuario_empresas` com `papel='contador'`. AGORA é
   SEGURO fazer isso (o fail-open foi fechado e contador é leitura-apenas no servidor).
2. **Gatear as demais rotas de escrita** com `bloquearSeLeitura` (padrão já em equipe/convidar):
   aprovar despesa/reembolso, pagar conta, mudar plano/billing. Contador não pode escrever.
3. **Endurecimento (médio):** token do portal contador sem expiry; contexto de empresa ativa é
   global por login (risco de lançamento cruzado em abas — considerar contexto por sessão).
4. Enxugamento restante: telas com ABAS de verdade. Depois: gráficos no Financeiro; bug conta a
   pagar; dados de demo semeados; Donna leads; recorrência (o que VENDE).
Tudo verificado com typecheck e no GitHub (feat/enxugamento-nav). Rodar rls-tenant-guardian +
ciberseguranca em tudo que toca dados.

## ENXUGAMENTO DA NAVEGAÇÃO (auditoria — começar por aqui)
- Fundir grupos duplicados: "Gestão financeira" + "Financeiro"; "Contabilidade" + "Contabilidade & Fiscal".
- Patrimônio → app opcional (flag `hidePatrimonio` já existe em `layout.tsx:117`).
- Apps soltos → soluções com sub-abas (modo Advanced).
- Abertura de banco → "em breve".

## 🎯 CANAL DE VENDA (a virada estratégica — 2026-07-09)
**O cliente nº1 do Fayson é um CONTADOR com +10 mil clientes na base.** Se ele indicar o
FactorOne pros clientes dele = sucesso imediato. Isso muda a prioridade: **ganhar o contador
é ganhar 10 mil clientes de uma vez.** Logo o **Portal do Contador NÃO é corte — é o item nº1.**
- Toda parte fiscal, contábil e **transações automatizadas**.
- Contador vendo o **bookkeeping** dos clientes.
- **2º cliente-chave:** tem e-commerce com sistema próprio → quer só PLUGAR a inteligência.

## DECISÕES NOVAS (2026-07-09) — reversão de cortes + specs
- **Contador: MUST** (ver canal de venda acima). Não cortar.
- **Múltiplos CNPJ: MUST** (grifado forte pelo Fayson).
- **PF + PJ: entra.** Pessoa traz investimentos + contas bancárias → por isso PF/PJ juntos importam.
- **Plugar inteligência em sistemas externos: entra** (2º cliente com e-commerce).
- **Marketing/criação de conteúdo:** usar API externa (OpenRouter) — não construir do zero.
- **DELETAR: financiamento / opções de crédito por score.** A ideia era: baseado no score, aparecer
  opções de financiamento e cartão. Sem um motor de score de verdade, não faz sentido AGORA. Tirar.
- **Investimentos = igual investidor10.com:** usuário adiciona ativos manualmente, aparece com logo
  da empresa, cotação, métricas. IMPORTANTE: replicar a FUNCIONALIDADE (construir o nosso), NÃO
  copiar o código-fonte deles — é risco legal/técnico. Fica igual ou melhor, e é nosso.
- **Auditar redundância:** revisar TODAS as ferramentas do app, achar as repetitivas/redundantes e
  fundir (o enxugamento). Referência: seção "ENXUGAMENTO DA NAVEGAÇÃO" acima.

## DASHBOARD — decisão refinada (o Fayson GOSTA do atual)
Manter: círculos de atalho, próximos compromissos, "comece por aqui", insights de IA.
- **"Comece por aqui" some sozinho** quando tudo estiver completo, OU tem um "x" pra fechar.
- Melhorar o VISUAL → mais cara de banco/fintech. Mas manter a EXPERIÊNCIA (ele gosta de ter aquilo).
- Adicionar **gráficos** (principalmente Financeiro).
- Regra: **tudo tem que ter um porquê** — cada card responde "e agora, o que eu faço?".

## SIDEBAR — rodapé e Config
- Rodapé: **Integrações** tem que estar lá.
- **Setor Config** pra configurar todas as automações: Donna responde e-mail on/off, chatbot do
  site, agendamento automático, classificação de leads.
- **Chatbot automático pra colocar no site dos clientes** — tem que ter.

## MÉTODO "INTELIGÊNCIA POR DEPARTAMENTO" (como pensar toda solução)
Não é planilha estática — é copiloto que diz onde está o dinheiro. Exemplos do Fayson:
- **Gestão (cliente de bijuteria):** vendas, atendimento, controle de pagamento, estoque, preço
  (antes e depois das despesas). Mas como AUTOMAÇÃO: ela põe a matéria-prima e vê os valores
  aparecendo (tipo Excel inteligente). A IA calcula: quantos metros de fio por peça, as metragens
  que mais vendem, quantos produtos saem de um rolo, margem por peça, e SUGERE onde vender mais e
  onde economizar.
- **Logística:** onde os caminhões estão, quanto custa operar.
- **Patrimônio:** aluguel, ITBI, impostos — tudo.
Pensar fora da caixa assim em TODOS os departamentos. UX de banco/fintech, inovador.
"Não sai fazendo nada que não esteja programado" — planejar/spec antes de codar.

## VISUAL / EXPERIÊNCIA (não pode parecer pré-histórico)
- Usar **imagens grátis** (bancos de imagem livres), fazer algo **diferente**. O usuário tem que
  sentir que é um sistema **moderno, do dia a dia dele** — cara de banco/fintech, não planilha de 2010.
- **Investimentos estilo Bloomberg:** cotação de ações ao vivo (via API de mercado) se o usuário
  quiser. Dado de mercado vivo, criativo — não estático.

## ENXUGAMENTO DO MARKETPLACE — de 24 apps soltos → 9 soluções (2026-07-09)
O Fayson mandou otimizar a lista de apps: tirar o que não tem utilidade, fundir os repetidos,
tudo em soluções organizadas com abas (como o mockup). Mapa proposto:

**REGRA DE OURO DO ENXUGAMENTO: enxugar ≠ apagar. Se está bonito, NÃO tira.**
Consolidar é reorganizar (juntar o repetido na mesma solução), nunca jogar fora trabalho bom
ou UI bonita. Faixas, cards de oferta, gradientes, telas bem-feitas → preservar e reusar.

**FUNDIR (redundância — a capacidade fica, o app solto some):**
- Sales Pipeline → dentro de **CRM** (é a mesma coisa).
- Indicadores + Budget & Forecast → dentro de **CFO IA** (todos "analisam números e projetam").
- Contratos Digitais → dentro de **Jurídico** (é subconjunto).
- Contas a Receber Plus → dentro de **Financeiro / Contas a receber**.
- Folha de Pagamento → dentro de **RH & Benefícios**.
- Captação de Leads + Agendamento + Propostas + Pós-venda → dentro de **Clientes & Vendas**.
- Classificação IA + CFO IA são a INTELIGÊNCIA do Financeiro, não apps à parte (alinha com a tese:
  inteligência embutida, não agente solto).

**CORTAR (sem utilidade pro alvo atual — parar pra tier "Pro" depois):**
- **M&A** (valuation + due diligence) — nicho, não é pra PME no lançamento. Tirar agora.

**AS 9 SOLUÇÕES (com abas):**
1. **Banco** — Open Finance (read-only), Cartão, PIX, Classificação.
2. **Financeiro** — Contas a pagar/receber, Despesas, DRE, Fluxo, Produtos & Margem, Subscription
   Billing (recorrência), aba **CFO IA** (funde Indicadores + Budget & Forecast).
3. **Clientes & Vendas** — CRM (+ Sales Pipeline), Captação, Agendamento, Propostas, Pós-venda.
4. **Contábil & Fiscal** (o contador) — Bookkeeping, Tax Compliance, Simples/DAS, Prefeituras & NFS-e.
5. **Operações** — Estoque, Logística.
6. **RH** — Folha + Benefícios.
7. **Jurídico** — Jurídico + Contratos Digitais.
8. **Marketing** — campanhas/conteúdo via API externa (OpenRouter).
9. **Investimentos** — estilo investidor10 (ativos manuais + cotação ao vivo).

Implementação: campo `navGroup` de cada app em `lib/marketplace.ts` aponta pra solução certa;
preservar GRUPO_ROLES e hidePatrimonio. NÃO codar sem o Fayson aprovar o mapa.

## DIREÇÃO VISUAL — verdes e faixas de oferta (2026-07-09, "considerar")
NÃO mudar os verdes — já padronizados no código. Usar exatamente:
- `linear-gradient(135deg, #13201D 0%, #1C2E29 100%)` — escuro → médio.
- `linear-gradient(135deg, #1C2E29 0%, #13201D 55%, #0F1918 100%)` — aprofunda pro quase-black.
- `#3D7A6E` — verde claro de destaque.
Ideia do Fayson: gradiente verde-escuro→claro nos **cards de OFERTA** (ex.: o card "Conta PJ —
powered by Celcoin"); verde bem escuro tipo black quando for oferta/premium (os cartões vão ser black).
- **Resgatar a faixa "convide seu contador"** no topo (ainda existe em `contabilidade`/`contadores`/
  `simples`) — era bonita E é o gancho de indicação do contador (canal dos 10 mil clientes).
- Regra geral já registrada: visual não pode parecer pré-histórico; cara de banco/fintech, moderno.

## NORTE (depois do ship)
Business OS por departamento, com inteligência real, + integração FactorOne + FactorHub + LifeOS.

## VERTICAIS REAIS — mapeamento e priorização AGILE (2026-07-15)

Base: 7 clientes/dores reais do Fayson que já testaram a plataforma e gostaram (contador com base
de 1000+ contadores, imobiliária, e-commerce/social commerce, logística/frota, indústria química
B2B, gestão de pousadas/hotéis via agência de marketing, restaurante). Ver arquitetura de 5 camadas
em memória `arquitetura-camadas-ceo-os`.

### O padrão (o que TODO vertical pediu, sem exceção) → 🟢 CORE
Isso não é feature de nicho — é a espinha do produto, tem que estar rígido antes de qualquer
vertical entrar:
- Financeiro (DRE, fluxo de caixa, quanto gasta e em qual setor)
- **Agenda** — todo vertical tem compromisso/visita/entrega/reunião pra controlar
- **Controle de vendas** — não só CRM de lead, o funil fechado até a venda
- CRM + funil + follow-up **apuradíssimo** — não é feature secundária, é diferencial
- **Central de atendimento** — atendimento ao cliente do tenant, não só canal de venda
- Canal unificado / omnichannel (WhatsApp, Telegram, chat) — já existe conceito "Conversa"
- Acesso via WhatsApp/Telegram (Donna) — "contabilidade fiscal na palma da mão"
- Multi-CNPJ / múltiplas empresas por usuário, cada uma no seu ambiente
- Dashboard que se adapta ao tipo de negócio (Cockpit + Intelligence, não um dash genérico) —
  precisa servir tanto quem está **começando** (quer o básico funcionando) quanto quem já está
  **no meio ou lá em cima** (quer métrica e relatório fundo). O Core tem que aguentar as duas pontas
  do mesmo empreendedor ao longo do tempo, não só o dia 1.
- **Inovação/criação/conteúdo** — geração de conteúdo não é só Growth de e-commerce/imobiliária,
  é algo que todo empreendedor early/mid-stage pede pra se manter relevante

### 🟡 GROWTH (recorrente entre verticais, mas não estrutural)
- Geração automática de conteúdo (vídeo → cortes/reels) — pedido por e-commerce, imobiliária, pousada
- Bot de atendimento que cai direto no CRM (e-commerce, pousada, restaurante)
- Email marketing + copy automatizada
- Pesquisa de satisfação / NPS (restaurante, pousada)
- Prospecção B2B assistida (scraping tipo mymaps + estratégia de lead) — química, mas reaplicável

### 🔵 MARKETPLACE (plugável, por vertical — não vai para todo tenant)
| Vertical | App/módulo específico | Por quê é marketplace e não core |
|---|---|---|
| **Contador** | Portal Contador↔Cliente com rastreador de bookkeeping estilo "rastreio de encomenda" (o que o cliente mandou vs. o que o contador já viu/processou) | Só existe onde há relação contador-cliente formal |
| Imobiliária/corretor | Gestão de Patrimônio (upload PDF/Excel de imóvel → valor, documentos) + chaves/visitas/agendamento por telefone | Peso de imóvel físico é vertical, não universal |
| E-commerce | Custo por unidade (antes/depois de fixo), automação de postagem pro algoritmo | Modelo de margem por SKU é de quem vende produto |
| Logística/frota | Gestão de frota: rota, vida útil de pneu, manutenção, pagamento de motorista | Ativo físico (caminhão) não existe fora desse vertical |
| Química/indústria B2B | Estoque de matéria-prima + dosador, prospecção presencial B2B | Fluxo de venda presencial/B2B é atípico |
| Pousada/hotel (via agência) | CRM + ofertas + canal unificado *para os clientes da agência* (multi-tenant dentro de multi-tenant) | Agência revendendo pra terceiros é modelo de revenda, não uso direto |
| Restaurante/bar/padaria | Cardápio com QR code, controle de pessoal, NPS | Cardápio físico é vertical |

### Mecanismo técnico: Perfil de Negócio
Não existe hoje um jeito de a plataforma "saber" que tipo de negócio é o tenant. Proposta:
- No onboarding (ou depois, em Configurações), o usuário escolhe o **tipo de negócio**
  (Contador / Imobiliária / E-commerce / Logística / Indústria B2B / Agência / Food service / Outro).
- Esse campo decide: quais apps do Marketplace aparecem sugeridos, quais KPIs o Cockpit prioriza
  por padrão, e quais perguntas o Intelligence já sabe fazer sem o usuário digitar.
- Isso é o que o Fayson descreveu como "a plataforma vai direcionar baseado no tipo de serviço dele"
  — é 1 campo + 1 tabela de mapeamento, não um sistema novo. Reaproveita `lib/marketplace.ts`
  (já tem `navGroup` por app — só falta o filtro por tipo de negócio).

### Priorização AGILE — ordem de construção, não lista de features
Regra: **nunca abrir 2 verticais em paralelo.** Cada vertical novo só entra depois do anterior
estar vendendo, não só "funcionando".

1. **Sprint atual (já em andamento):** Core 🟢 — recorrência financeira, CRM, omnichannel. Isso já
   está no backlog como prioridade nº1 pra venda desta semana. Nenhum vertical novo compete com isso.
2. **Próximo vertical: Contador.** Motivo — não é 1 cliente, é um canal de distribuição (1000+
   contadores, cada um traz N clientes). Já existe base disso na seção "Portal do Contador" acima
   e a faixa "convide seu contador" já estava planejada. Constrói o rastreador
   contador↔cliente + o Perfil de Negócio mínimo (só o suficiente pra diferenciar contador de PJ comum).
3. **Depois:** entre os outros 6, priorizar por sinal comercial real (quem já topou pagar/testar de
   verdade), não por qual é "mais legal de construir". Fayson decide qual dos 6 está mais quente
   quando chegar a hora — não travar decisão nisso agora.
4. Cada vertical novo = 1 app de Marketplace + ajuste no Perfil de Negócio, nunca um fork do
   produto. Se algum pedido de vertical exigir mudar o Core, ele sobe de categoria pra 🟢 e entra
   na discussão de Constituição, não é implementado direto.

### O que isso NÃO é
Não é planejar construir os 7 verticais. É garantir que quando cada um chegar, ele encaixa num
molde já pronto (Perfil de Negócio + Marketplace) em vez de virar um projeto novo do zero.

### 🔵 Aposta de longo prazo (Marketplace/Norte, NÃO construir agora): Crédito
Ideia do Fayson: score de crédito próprio + sugestão de cartão de crédito baseado nesse score,
no estilo Credit Karma (Canadá) — ele identifica isso como um gargalo real do mercado brasileiro
(não existe hoje). Caminho natural: score → recomendação de cartão → eventualmente o FactorOne
emitir cartão e aceitar pagamento direto. Pré-requisito óbvio: só faz sentido depois que o FactorOne
tiver histórico financeiro real e volume de dado suficiente pra sustentar um score honesto — não é
Sprint 0 nem vertical, é um produto financeiro à parte que nasce dos dados que o Core já vai estar
coletando. Registrado aqui pra não perder a ideia, não pra entrar no roadmap atual.
