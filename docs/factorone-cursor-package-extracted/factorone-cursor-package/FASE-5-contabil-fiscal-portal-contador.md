# FASE 5 — Contábil & Fiscal (Cofre, Regime, Notícias, Portal do Contador)

**Pré-requisito: Fases 0 a 4 concluídas.**
**Referência visual: `design-reference/05-contabil.html`** — cobre as
sub-abas Visão Geral (parcialmente) e Impostos & Regime. As sub-abas
Obrigações e Portal do Contador NÃO têm mockup visual — especificação abaixo.

---

## Estrutura do módulo

Tabs: **Visão Geral** (sem mockup dedicado, ver abaixo) / **Obrigações**
(sem mockup dedicado, ver abaixo) / **Impostos & Regime** (TEM mockup) /
**Cofre Fiscal** (TEM mockup, dentro do mesmo HTML) / **Portal do Contador**
(sem mockup — ESTA É A PEÇA QUE FALTOU NO DESIGN E O DONO DO PRODUTO PEDIU
EXPLICITAMENTE, tratar com atenção especial, ver seção própria abaixo)

## Componente compartilhado: barra de período (usar em Visão Geral,
Impostos & Regime, e qualquer exportação futura)

Já está no mockup (`.period-bar` em `05-contabil.html`): campo de data
início, "até", campo de data fim, chip da empresa selecionada, e 3 botões
à direita — Imprimir / Baixar PDF / Reenviar por e-mail. Este componente é
genérico o suficiente para ser reaproveitado em outras telas que precisem de
relatório por período (não recriar do zero em cada lugar).

## Sub-aba: Visão Geral (SEM mockup dedicado — especificação abaixo)

Painel-resumo do módulo inteiro, seguindo o mesmo princípio de "hub" usado
em Financeiro (Fase 2):
- KPIs no topo: Próxima obrigação (nome + dias restantes), Documentos
  pendentes de envio ao contador, Total de impostos pagos (mês/ano
  conforme período selecionado), Status geral (chip verde "Em dia" / âmbar
  "Atenção" / vermelho "Pendência crítica")
- Card "Próximas obrigações" (lista curta, com link "ver todas" para a
  sub-aba Obrigações)
- Card com o mesmo "Painel de Impostos" resumido (versão compacta do que
  está completo em Impostos & Regime)
- Hub de atalhos: Cofre Fiscal, Simulador de Regime, Portal do Contador,
  Convidar contador

## Sub-aba: Obrigações (SEM mockup dedicado — especificação abaixo)

- Calendário fiscal mensal (grid de dias, mesmo estilo do calendário
  editorial usado em Marketing — reaproveitar componente `.cal-grid`),
  com cada obrigação marcada no dia de vencimento
- Abaixo ou ao lado, lista detalhada: Nome da obrigação (DAS, DCTFWeb,
  EFD-Contribuições, SPED, etc.) | Empresa | Vencimento | Status (chip:
  Pendente/Enviada/Paga) | Ação (botão para marcar como feita, anexar
  comprovante, ou abrir direto o link oficial se houver — ver integração
  Gov.br abaixo)
- Filtro por empresa (para grupos com várias empresas, cada uma com seu
  próprio calendário fiscal — usar o seletor Consolidado/PJ/PF, mas aqui
  cada obrigação sempre pertence a UMA empresa específica, então o "Só
  empresas" mostra todas juntas com etiqueta de qual é qual)

### Integração com Gov.br (pedido explícito do dono do produto)
Não é login único via Gov.br neste momento (isso seria uma integração de
autenticação federal mais complexa, fora de escopo desta fase) — o que
entra AGORA é: cada obrigação, quando aplicável, tem um **link direto** para
a página oficial correspondente no Gov.br/e-CAC onde aquela guia é gerada
ou consultada (ex.: link para emissão de DAS no Simples Nacional, link para
o e-CAC para consulta de situação fiscal). Isso poupa o usuário de precisar
procurar o link certo toda vez. Guardar esses links como configuração
(tabela simples `links_governamentais`: nome, url, tipo_obrigacao) para
poder atualizar sem precisar alterar código se o governo mudar a URL.

## Sub-aba: Impostos & Regime (TEM mockup — `05-contabil.html`)

Seguir exatamente. Elementos que não podem ser perdidos:
- Painel de Impostos: tabela Operação | Alíquota | Base | Imposto, com nota
  de rodapé explicando o porquê da alíquota aplicada (ex.: Fator R)
- Simulador de Regime Tributário: 3 cards lado a lado (Simples/Presumido/
  Real) comparando valor total no período, com o card recomendado destacado
  em verde e badge "Recomendado" — mais uma linha de texto calculando a
  economia em R$ do regime recomendado vs o segundo melhor
- Card lateral "Como pagar menos imposto" (IA, fundo escuro gradiente) com
  recomendação acionável baseada em dado real (ex.: Fator R próximo do
  limite, sugestão de ajuste)
- Card "Onde cada CNPJ está cadastrado" — lista simples nome + regime +
  cidade/UF

### Notícias sobre mudança de legislação (pedido novo do dono do produto)
Adicionar um card "⚠ Mudanças recentes" (já existe um exemplo simples no
mockup, "Mudança de legislação" com um item — expandir para lista de até 3-5
itens). Fonte de dado sugerida, sem custo:
- RSS/feed público do **Diário Oficial da União** e/ou do portal da
  **Receita Federal** (seção de notícias), filtrado por palavras-chave
  relevantes (ISS, Simples Nacional, DAS, Reforma Tributária, etc.)
- Alternativa complementar: RSS de fontes jornalísticas especializadas em
  tributário, se houver feed público gratuito disponível
- Cada item do card: título da notícia + data + trecho curto + link para
  a fonte original — não é preciso IA para isso nesta fase, é um feed
  direto, mas pode-se usar a IA depois para filtrar relevância por
  segmento/regime da empresa (fica como melhoria futura, não bloqueia esta
  fase)

## Sub-aba: Cofre Fiscal (TEM mockup — dentro de `05-contabil.html`)

Seguir exatamente:
- Lista de documentos, cada um com: ícone por tipo, nome do documento,
  descrição (protocolo, data, quem enviou/assinou), botões de ação
  (imprimir, reenviar por e-mail)
- Isto é o "histórico de tudo que o contador fez" que o dono do produto
  pediu: cada guia paga, cada SPED protocolado, cada procuração assinada
  fica registrado aqui permanentemente, por competência
- Adicionar filtro por competência (mês/ano) e por tipo de documento
  (Guias/Contratos/Procurações/Declarações) no topo da lista, que não
  estava explícito no mockup mas é necessário para navegar um histórico
  longo ao longo do tempo

## Sub-aba: Portal do Contador (SEM mockup — ESPECIFICAÇÃO PRIORITÁRIA)

Esta tela tem 2 modos de visualização, conforme quem está logado:

### Modo "dono do negócio vendo seu contador"
- Card com dados do contador responsável: nome, CRC, contato, foto/avatar
- Lista de documentos que o contador está esperando do usuário (pendências
  de envio do lado do cliente) — isto fecha o ciclo "nada fica em branco"
  que o dono do produto pediu: o sistema mostra claramente o que falta
  entregar para o contador, não só o que já foi entregue
- Histórico de interações/mensagens trocadas com o contador (pode
  reaproveitar o mesmo padrão de thread de conversa do Agentes IA)

### Modo "contador vendo seus clientes" (multi-empresa — A PEÇA QUE FALTAVA)
Esta é a resposta direta ao pedido: *"se o contador tem mais de 10 clientes
do FactorOne, ele não pode precisar logar em cada um separadamente."*
- Ao logar, um contador com papel `contador` (RBAC já existente no projeto,
  ver papéis Admin/CFO/Financeiro/Funcionário — adicionar `Contador` como
  novo papel) vê uma **tela inicial diferente**: uma lista/grid de todas as
  empresas às quais ele foi vinculado (independente de grupo/holding — um
  contador pode atender clientes de holdings diferentes)
- Cada card de cliente na lista mostra: nome da empresa, regime tributário,
  status geral (chip verde/âmbar/vermelho — mesmo padrão da Visão Geral),
  próxima obrigação vencendo, contador de documentos pendentes
- Clicar em um cliente leva para a visão completa do módulo Contábil &
  Fiscal **daquela empresa específica**, sem precisar logout/login — é uma
  troca de contexto dentro da mesma sessão (implementação técnica: o
  contador tem uma linha de permissão por empresa em vez de pertencer a um
  único grupo; trocar de cliente troca o `empresa_id` ativo na sessão,
  mesma mecânica usada para trocar de empresa dentro de um grupo/holding
  na Fase 0, só que aqui atravessando grupos diferentes)
- Barra de busca/filtro no topo da lista de clientes (por nome, por
  pendência, por regime) — essencial se o contador tiver muitos clientes
- Esta tela é, na prática, o "micro-SaaS dentro do SaaS" que o dono do
  produto pediu — vale considerar como um mini-produto à parte dentro do
  Portal do Contador, com sua própria identidade visual mínima (mesma
  paleta, mas pode ter um layout de lista mais denso, tipo tabela, em vez
  do grid de cards, se a quantidade de clientes for grande — decisão de
  UX que pode ser ajustada durante a implementação, mas a função tem que
  estar 100% presente)

## Critério de "pronto" desta fase
- [ ] 5 sub-abas de Contábil & Fiscal implementadas como rotas próprias
- [ ] Impostos & Regime e Cofre Fiscal pixel-fiéis ao mockup
- [ ] Barra de período reaproveitável, com Imprimir/Baixar PDF/Reenviar
      funcionais (usando os helpers de download autenticado já existentes)
- [ ] Card de notícias/mudanças de legislação puxando de fonte real (RSS
      gratuito), mesmo que a lista inicial seja curta
- [ ] Links diretos para Gov.br/e-CAC nas obrigações aplicáveis
- [ ] Portal do Contador com os dois modos funcionando: visão do cliente
      (pendências claras) e visão do contador (lista multi-cliente sem
      necessidade de logout/login entre eles)
- [ ] Papel `Contador` adicionado ao RBAC existente
- [ ] `npx tsc --noEmit && npm run build` passam sem erro
- [ ] Parar e confirmar visualmente antes da Fase 6
