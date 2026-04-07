# FactorOne MVP — Guia de Deploy

## 1. Supabase — Criar o banco de dados

1. Acesse **supabase.com** → seu projeto `poquuezgtowpqjmgrbkh`
2. Clique em **SQL Editor** → **New query**
3. Cole todo o conteúdo do arquivo `supabase-schema.sql`
4. Clique em **Run** (ou F5)
5. ✅ Tabelas criadas

## 2. Configurar o projeto localmente

```bash
# Instalar dependências
npm install

# Criar o .env.local (já está pronto com suas chaves)
# Só falta adicionar o STRIPE_WEBHOOK_SECRET depois

# Rodar localmente
npm run dev
# Acesse http://localhost:3000
```

## 3. Stripe Webhook (para pagamentos funcionarem)

### Usando Stripe CLI (recomendado para teste local):
```bash
# Instalar Stripe CLI: stripe.com/docs/stripe-cli
stripe listen --forward-to localhost:3000/api/webhook
# Copie o webhook secret que aparecer (whsec_...) e cole no .env.local
```

### Para produção (Vercel):
1. dashboard.stripe.com → Developers → Webhooks → **Add endpoint**
2. URL: `https://SEU-DOMINIO.vercel.app/api/webhook`
3. Eventos: `checkout.session.completed`, `customer.subscription.deleted`
4. Copie o **Signing secret** → cole como `STRIPE_WEBHOOK_SECRET` no Vercel

## 4. Deploy na Vercel

```bash
# Instalar Vercel CLI
npm i -g vercel

# Deploy
vercel

# Seguir as instruções e configurar as variáveis de ambiente
# OU configurar pelo painel: vercel.com → seu projeto → Settings → Environment Variables
```

### Variáveis para configurar na Vercel:
```
NEXT_PUBLIC_SUPABASE_URL=https://poquuezgtowpqjmgrbkh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PRICE_ESSENCIAL=price_1TGr7aJA6DAGsEckmrH0fAgN
NEXT_PUBLIC_STRIPE_PRICE_PROFISSIONAL=price_1TGr82JA6DAGsEcknu6iVcd9
NEXT_PUBLIC_STRIPE_PRICE_SCALE=price_1TGr8OJA6DAGsEckLv5wxY07
ANTHROPIC_API_KEY=sk-ant-...
NEXT_PUBLIC_APP_URL=https://app.factorone.com.br
```

## 5. Domínio personalizado na Vercel

1. vercel.com → seu projeto → Settings → Domains
2. Adicione: `app.factorone.com.br`
3. No painel da Hostinger, adicione um CNAME:
   - Nome: `app`
   - Valor: `cname.vercel-dns.com`

## 6. Criar conta demo para mostrar aos clientes

Após subir, acesse o app e crie uma conta com:
- Email: `demo@factorone.com.br`
- Senha: `demo123456`
- Empresa: `Scale Corp (Demo)`

Depois entre no Supabase → Table Editor → metricas → preencha com dados realistas.

## Estrutura do projeto

```
factorone-mvp/
├── app/
│   ├── auth/page.tsx          # Login + cadastro
│   ├── onboarding/page.tsx    # Escolha de plano + Stripe
│   ├── dashboard/
│   │   ├── layout.tsx         # Sidebar de navegação
│   │   ├── page.tsx           # Dashboard principal
│   │   ├── cashflow/page.tsx  # Cash flow + gráficos
│   │   ├── despesas/page.tsx  # CRUD + upload comprovante
│   │   ├── invoices/page.tsx  # Invoices + billing
│   │   ├── relatorios/page.tsx # DRE automático
│   │   ├── aicfo/page.tsx     # AI CFO com Claude
│   │   └── integracoes/page.tsx
│   ├── api/
│   │   ├── stripe/checkout/route.ts  # Criar sessão Stripe
│   │   ├── webhook/route.ts          # Webhook Stripe
│   │   └── aicfo/route.ts            # Claude API
│   └── globals.css
├── lib/
│   ├── supabase.ts            # Client-side Supabase
│   └── supabase-server.ts     # Server-side Supabase
├── supabase-schema.sql        # SQL para rodar no Supabase
├── .env.local                 # ⚠️ Não commitar no Git!
└── README.md
```
