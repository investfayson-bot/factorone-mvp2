# 🎯 FactorOne — Roadmap Completo (Fase 2+)

**Status:** Fase 1 (Base admin + trials) ✅ → **Fase 2 começa aqui** ⬇️

---

## 📋 MAPA DE FUNCIONALIDADES vs MÓDULOS

### ✅ = Já tem | 🟡 = Parcial | ❌ = Falta | 🚀 = Prioridade alta

| Funcionalidade | Agentes | Banco | Financeiro | Clientes/Vendas | Contábil/Fiscal | Marketing |
|---|---|---|---|---|---|---|
| **Tudo Clicável** (abrir detalhes) | 🟡 | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Chat integrado** (não abrir aba nova) | ✅ | 🚀 | 🚀 | 🚀 | ✅ | 🚀 |
| **OCR + Upload** (foto recibo/doc) | ❌ | 🚀 | 🚀 | ❌ | ❌ | ❌ |
| **Telegram/WhatsApp webhook** | ✅ | ❌ | ❌ | 🟡 | ❌ | ❌ |
| **Email → Plataforma** (leads automático) | ❌ | ❌ | ❌ | 🚀 | ❌ | ❌ |
| **Gerenciar Email na plataforma** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Folders/Organização** de comunicação | ❌ | ❌ | ❌ | 🟡 | ❌ | ❌ |
| **Chat por departamento** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Chefe de departamento** + **AI por setor** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Download logs** (mês/ano/filtrado) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Cartão: gerenciar SEM aba nova** | 🚀 | 🚀 | — | — | — | — |
| **Reatividade tempo real** (movimento → notif) | 🟡 | ❌ | ❌ | 🟡 | ❌ | ❌ |
| **Dashboard 100% clicável com drilldown** | 🟡 | 🚀 | 🚀 | ❌ | 🚀 | ❌ |

---

## 🏗️ FASE 2 — ORDEM RECOMENDADA (7 blocos de trabalho)

### **Bloco 1: Banco redesenhado** (2-3 dias)
**Inspiração:** QuickBooks (contas), Stripe (cartões), Traditional Banking

**O que vai ter:**
- ✅ Contas: saldo clicável → drill-down histórico mês/ano
- ✅ Cartões: gerenciar DENTRO da aba Banco (não nova página)
  - Transações clicáveis → categoria/detalhes
  - Parcelas visíveis com timeline
  - Recategorização inline
- ✅ Extratos:
  - OCR automático de recebos (upload foto)
  - Classificação automática (IA) + manual inline
  - Download por período (PDF, CSV, JSON)
- ✅ PIX/Transferências: histórico + agendadas + sugerir pagamentos
- ✅ **Reatividade:** movimento na conta → aviso no dashboard em tempo real

---

### **Bloco 2: Financeiro 100% clicável** (2-3 dias)
**Inspiração:** QuickBooks Dashboard, SAP Finance, Oracle Financials

**O que vai ter:**
- ✅ DRE: cada linha clicável → detalhes transações (período, categoria)
- ✅ Fluxo de Caixa: gráfico → click → lista transações
- ✅ Indicadores (margem, ROI, turnover): clica → drilldown
- ✅ Cenários (3 projeções): compare inline
- ✅ Download relatórios (mês/trimestre/ano) com filtros
- ✅ **Integração:** cartão importado → automático aparece aqui

---

### **Bloco 3: Clientes & Vendas integrado** (3-4 dias)
**Inspiração:** Salesforce, GoHighLevel, Omie CRM

**O que vai ter:**
- ✅ **Email → Lead automático:** recebe email → aparece em "Novos Leads"
  - Pastas na plataforma: "Inbox", "Leads Qualificados", "Propostas", "Clientes"
  - Se não conseguir integrar webmail direto, cria sistema de folders interno
- ✅ **Gerenciar email na plataforma:** ver conversa completa + responder sem sair
- ✅ **Chat inline:** conversa com cliente direto na aba (não abrir chat novo)
- ✅ **Clientes clicáveis:** nome → histórico, transações, propostas, tickets
- ✅ **Pipeline Kanban:** stages clicáveis → detalhes do deal
- ✅ **Propostas:** gerar online, clicar → preview + enviar direto
- ✅ **Telefone integrado:** ligações → vinculadas ao cliente (via Telegram/WhatsApp)

---

### **Bloco 4: Contábil & Fiscal completo** (3-4 dias)
**Inspiração:** ContaSimples, Omie, SAP Accounting

**O que vai ter:**
- ✅ **Livros clicáveis:** diário/razão → cada lançamento → detalhes (doc origem, PDF)
- ✅ **Contador acesso:** visualiza tudo + faz comentários + propõe ajustes
- ✅ **Chat contador-empresa:** conversa integrada (não email solto)
- ✅ **DRE gerado:** automático pelas transações
- ✅ **Obrigações:** SPED, ECF, Simples, IRPF → checklist + alertas
- ✅ **Cofre Fiscal:** PDFs, notas, recibos organizados + busca
- ✅ **Download:** balancete/diário/razão por período
- ✅ **Auditoria:** quem mexeu, quando, o quê (log completo)

---

### **Bloco 5: Marketing com AI por setor** (2-3 dias)
**Inspiração:** GoHighLevel, HubSpot, Klaviyo

**O que vai ter:**
- ✅ **Campanhas clicáveis:** metabase-style, cada métrica → drill-down
- ✅ **Calendário editorial:** arrasta evento → detalha (conteúdo, responsável, AI sugestões)
- ✅ **Email marketing:** templates + automação + A/B clicáveis
- ✅ **Tráfego pago:** ads → performance → recomendação AI
- ✅ **Chat do setor:** marketing integrando com AI sobre trends/performance

---

### **Bloco 6: Departamentos + Chat + AI por setor** (2-3 dias)
**Novo — não existe em nenhuma referência exata, mas combina Slack + OrganizationChart + AI:**

**O que vai ter:**
- ✅ **Organograma:** cadastra departamentos (Financeiro, Marketing, Vendas, etc)
- ✅ **Chefe de departamento:** atribuir usuário responsável por cada setor
- ✅ **Chat por departamento:** Financeiro tem chat fechado, Marketing tem outro
- ✅ **AI por setor:** Acessor (agora chamado "AI Setorial")
  - Financeiro vê: tendências gastos, alertas, sugestões
  - Marketing vê: performance, tendências mercado, sugestões
  - Vendas vê: pipeline health, previsão, sugestões
- ✅ **Permissões automáticas:** chefe vê tudo do setor, não vê outros
- ✅ **Notificações:** avisos por departamento (não global)

---

### **Bloco 7: Agentes AI melhorados** (1-2 dias)
**Já tem:** Acessor, Automações

**Adicionar:**
- ✅ **Acessor sectorial:** cada setor tem seu próprio contexto/recomendações
- ✅ **Whatsapp/Telegram:** chats automáticos (suporte, leads, follow-up)
- ✅ **Automação:** triggers em qualquer módulo (cartão importado → auto-classifica, lead chega → auto-qualifica)

---

## 🎨 PRINCÍPIO: Tudo na mesma tela

**ERRADO (hoje):**
```
Dashboard → clica em Cartão → ABRE NOVA ABA → Gerenciar Cartão
                                 ↑
                         (sai do contexto)
```

**CERTO (Fase 2):**
```
Banco → Cartões → transação → inline: categoria/detalhe/comentário
                                ↑
                        (nunca sai da aba)
```

---

## 🚀 SUGESTÕES DE MELHORIA

### 1. **Unificação de "Movimentações"** 
   Criar uma view única que mistura:
   - Transações bancárias (importadas)
   - Cartão (importado)
   - Notas fiscais emitidas/recebidas
   - Despesas manuais
   
   **Resultado:** toda ação financeira em 1 lugar, clicável, categorizável

### 2. **OCR + Telegram/WhatsApp + Email como canais de captura**
   - Envia recibo por Telegram → sistema lê (OCR) → classificação AI → aparece em Financeiro
   - Idem para WhatsApp, email
   - Sem manual: tudo automático

### 3. **Chat como colinha de comunicação**
   Hoje tem Chat (Conversas), mas é pra clientes.
   
   **Adicionar:**
   - Chat de Equipe (por departamento)
   - Inline em cada módulo (Banco → comenta sobre transação, Vendas → comenta sobre cliente)
   - Histórico vinculado (clica em chat → vê conversa completa + contexto)

### 4. **Dashboard por Departamento**
   Cada chefe de setor vê só suas métricas:
   - Financeiro: cashflow, DRE, alertas, tendências
   - Vendas: pipeline, taxa conversão, forecast
   - Marketing: ROI campanhas, MQL/SQL, engagement
   - Contábil: obrigações, alertas, conciliação

### 5. **Auditoria + Compliance automática**
   Toda ação deixa rastro:
   - Quem, quando, o quê, antes/depois
   - Download "audit trail" por período
   - Relatório para contador/auditor

### 6. **Notificações inteligentes**
   Não bombardeia. Agrupa por relevância:
   - Crítico: saldo baixo, obrigação vencida
   - Importante: recebimento atrasado, anomalia
   - Informativo: nova transação, proposta enviada
   - Setor-específica: dept Financeiro não recebe alerta de Marketing

---

## 📊 COMPARAÇÃO COM REFERÊNCIAS

| Recurso | QuickBooks | Salesforce | GoHighLevel | ContaSimples | FactorOne (v2) |
|---|---|---|---|---|---|
| Contabilidade completa | ✅ | ❌ | ❌ | ✅ | ✅ |
| CRM + Pipeline | ❌ | ✅ | ✅ | ❌ | ✅ |
| Marketing Automation | ❌ | 🟡 | ✅ | ❌ | ✅ |
| Chat integrado | ❌ | ✅ | ✅ | ❌ | ✅ |
| AI Setorial | ❌ | 🟡 | 🟡 | ❌ | ✅ |
| Organograma + Departamentos | ❌ | ✅ | ❌ | ❌ | ✅ |
| **Tudo numa aba** (sem sair) | ❌ | ❌ | ❌ | ❌ | ✅ |

**FactorOne v2 = hibrído de todos + melhor**

---

## ⏰ TIMELINE ESTIMADO

| Fase | Blocos | Duração | Acumulado |
|---|---|---|---|
| **1 (Base)** ✅ | Admin + Trials | 1 dia | 1 dia |
| **2 (Core)** | Banco, Financeiro, Clientes, Contábil, Marketing | 12-15 dias | 13-16 dias |
| **3 (Departamentos)** | Chat, Organograma, AI por setor | 2-3 dias | 15-19 dias |
| **4 (Polish)** | Automações, Webhooks, Notificações | 3-5 dias | 18-24 dias |

**= 1 mês de desenvolvimento até estar 100% pronto pra demo/venda**

---

## ✅ CHECKLIST ANTES DE COMEÇAR FASE 2

- [ ] Migration `20260714000000_fix_admin_ownership.sql` rodou no Supabase
- [ ] Login demo → sidebar completo
- [ ] Convite contador funciona
- [ ] Demo seedado com dados (rodar `/api/demo/seed`)
- [ ] Painel admin-fayson acessível
- [ ] Todos os concerns da lista ✓ estão aqui

**Quando tudo ✅ → começa Bloco 1 (Banco)**

---

## 💡 UX PRINCIPLE pra toda Fase 2

> **"Se precisar abrir uma nova aba/modal, é porque design quebrou."**

Tudo inline, tudo drilldown, tudo na mesma página.
