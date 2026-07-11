# FASE 0 — Holding Multi-CNPJ+PF & Motor de Classificação de Transações

**Ler `00-MESTRE-leia-primeiro.md` antes desta fase.**

Esta fase NÃO tem tela nova de UI própria — é fundação de backend. As telas
das próximas fases vão consumir o que for construído aqui. Não pule para as
fases visuais sem terminar isto: retrabalho é garantido se pular.

---

## Parte A — Holding Multi-CNPJ + Pessoa Física

### Problema que resolve
Hoje o sistema opera por `empresa_id` isolado. O redesign inteiro assume que
existe um seletor no topbar (`Grupo Santos · Consolidado · 4 PJ + PF`) que
soma dado de várias empresas E da pessoa física do usuário, ao mesmo tempo,
em toda tela do sistema.

### Modelo de dados (adaptar aos nomes de tabela já existentes no projeto)
- Nova tabela `grupos_empresariais`: id, nome, owner_user_id, criado_em
- Nova tabela de junção `grupo_membros`: grupo_id, empresa_id (nullable),
  pessoa_fisica_user_id (nullable) — cada linha é OU uma empresa OU a pessoa
  física do dono, nunca as duas ao mesmo tempo
- Cada `empresa_id` continua existindo exatamente como hoje (não mexer na
  tabela `empresas` em si) — o grupo é uma camada de agregação por cima
- A "pessoa física" não ganha uma linha em `empresas`. Ela é tratada como uma
  entidade separada dentro do grupo, com seu próprio plano de contas pessoal
  (ver Parte B — a classificação nunca mistura categorias PJ com categorias PF)

### RLS (Row Level Security)
- Seguir o padrão que já existe no projeto (migration v4): checar
  `table_type='BASE TABLE'`, usar `DO $$` com `IF EXISTS`, `EXECUTE format(...)`
  para nomes de coluna variáveis (`user_id` vs `usuario_id`)
- Policy de leitura em `grupo_membros`: só o `owner_user_id` do grupo (e
  usuários com papel adequado dentro das empresas do grupo) podem ler
- Toda query agregada (dashboard, DRE consolidado, etc.) deve filtrar por
  `empresa_id IN (SELECT empresa_id FROM grupo_membros WHERE grupo_id = X)`

### Endpoints/queries que precisam existir
1. `GET /api/grupos/:id/resumo` — retorna: caixa consolidado, receita do mês,
   lucro líquido do mês, DRE resumido, todos agregando PJ+PF do grupo
2. `GET /api/grupos/:id/empresas` — lista de empresas do grupo com nome e
   saldo individual (para o dropdown do seletor e para a lista "Empresas do
   Grupo" que aparece no card de conversas/dashboard)
3. Parâmetro de escopo em TODA query existente que hoje já filtra por
   `empresa_id` único — adicionar suporte a filtrar por lista de empresa_ids
   OU pela pessoa física, conforme o estado do seletor (Consolidado / Só
   empresas / Só PF)

### Comportamento de UI do seletor (para quando chegar nas fases visuais)
- Fica no topbar, canto esquerdo, sempre visível em toda tela logada
- Três opções via segmented control (ver `.seg` em `base.css`, usado em
  `03-banco.html`): **Consolidado (PJ+PF)** / **Só empresas** / **Só pessoa
  física**
- Trocar o seletor refiltra a página atual sem reload — refetch client-side
- O chip ao lado do nome do grupo (`4 PJ + PF`) mostra a contagem de membros

---

## Parte B — Motor de Classificação de Transações (o mais importante desta fase)

### Problema que resolve
Hoje transações chegam do Open Finance (Belvo) sem categoria, e alguém tem
que classificar manualmente toda vez. O objetivo é replicar o comportamento
do QuickBooks: a IA lê a transação, sugere categoria, humano confirma uma
vez, e da próxima vez que o mesmo estabelecimento aparecer, ela já classifica
sozinha — só esperando um "OK" de confirmação rápida, sem re-digitar nada.

### Fluxo exato (isto é a especificação de UX, siga literalmente)

1. Transação nova chega (via Belvo/Open Finance ou lançamento manual)
2. Sistema verifica: já existe uma "regra aprendida" para este
   estabelecimento (nome normalizado do lançamento) **nesta empresa/PF
   específica**? Regras NUNCA vazam entre titularidades — uma regra
   aprendida na conta PJ da FLAC não se aplica à conta PF do Fayson, mesmo
   que seja o mesmo estabelecimento, porque o motivo do gasto pode ser
   diferente.
   - **Se sim**: classifica automaticamente e marca como `status:
     aguardando_ok` — aparece na lista de transações já com a categoria
     preenchida, badge verde "Classificado automaticamente", e um botão
     único "OK" para confirmar em lote (múltiplas transações do mesmo tipo
     podem ser confirmadas de uma vez)
   - **Se não**: dispara a IA (via Anthropic API) com contexto do nome do
     estabelecimento + valor + histórico de transações similares na conta
     para *sugerir* uma categoria. Mostra a transação com a categoria
     sugerida pré-preenchida MAS com destaque visual de "sugestão, não
     confirmada" (ex.: borda tracejada ou cor âmbar), e um dropdown para o
     usuário trocar se a IA errou
3. Quando o usuário confirma (ou corrige) a categoria pela primeira vez,
   o sistema salva isso como "regra aprendida" — nova tabela
   `regras_classificacao`: id, empresa_id (nullable), pessoa_fisica_user_id
   (nullable), nome_estabelecimento_normalizado, categoria_id, criado_em,
   confianca (aumenta a cada confirmação repetida)
4. Da próxima vez que aparecer transação do mesmo estabelecimento na mesma
   conta, pula direto para "aguardando_ok" (passo do item 2, ramo "sim")

### Exemplo literal que o dono do produto deu (use como caso de teste)
> "123 Irmãos Ltda" é na verdade um posto de gasolina. A IA não sabe disso
> de cara. Na primeira vez, ela pergunta ou sugere algo genérico
> ("Fornecedores" ou similar) com baixa confiança. O usuário corrige para
> "Combustível". Da segunda vez em diante, toda transação de "123 Irmãos
> Ltda" nessa mesma conta já vem classificada como "Combustível" — só falta
> o usuário clicar OK.

### Separação PJ / PF nas telas de classificação
Onde quer que a lista de transações apareça (Extrato do Banco, Financeiro),
tem que existir um jeito claro de ver as classificações filtradas por
titularidade — reaproveitar o mesmo seletor Consolidado/PJ/PF da Parte A.
Categorias de plano de contas empresarial (ex.: "Serviços de Terceiros",
"Marketing") são uma lista; categorias pessoais (ex.: "Mercado", "Lazer",
"Saúde") são outra lista completamente separada — nunca mostrar categoria
pessoal como opção pra transação de PJ e vice-versa.

### Cartão de crédito — classificação com detalhamento adicional
Transações de cartão de crédito passam pelo mesmo motor de classificação
acima, mas precisam guardar metadado extra:
- Número de parcelas (se compra parcelada) e qual parcela é esta
- A qual "fatura" (ciclo de fechamento) pertence
Isso alimenta, em fase futura (Fase 3), um diagrama de "quanto cada
segmento/setor está gastando" e "quantas parcelas em aberto por empresa" —
não precisa construir o diagrama agora, só garantir que o dado granular
(parcela X de Y, categoria, empresa) está sendo salvo desde já.

### OCR — colocar o gancho agora, implementar o preenchimento na Fase 3
Nesta fase, criar apenas a estrutura de dados que vai receber o resultado de
OCR futuramente: campo `origem_documento` (foto/PDF/manual/open_finance) e
campo `documento_anexo_url` na tabela de transações/lançamentos, para que a
Fase 3 (upload de recibo/comprovante) só precise plugar o serviço de OCR sem
precisar alterar schema de novo.

---

## Critério de "pronto" desta fase
- [ ] Tabela `grupos_empresariais` e `grupo_membros` criadas com RLS
- [ ] Endpoint de resumo consolidado retorna soma correta de 2+ empresas de teste
- [ ] Seletor Consolidado/Só empresas/Só PF funcional em pelo menos uma tela
      (pode ser uma tela de teste simples, não precisa ser a UI final ainda)
- [ ] Tabela `regras_classificacao` criada com RLS, isolada por
      empresa_id/pessoa_fisica_user_id
- [ ] Fluxo de "primeira classificação → regra aprendida → auto-classifica
      da próxima vez" funcionando de ponta a ponta com pelo menos 1
      transação de teste
- [ ] `npx tsc --noEmit && npm run build` passam sem erro
- [ ] Parar aqui e confirmar com o dono do produto antes de seguir para a
      Fase 1 (reskin visual)
