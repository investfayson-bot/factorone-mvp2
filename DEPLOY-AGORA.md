# FactorOne — Deploy em 15 minutos

## PASSO 1 — Supabase (2 min)
1. Acesse: https://supabase.com/dashboard/project/poquuezgtowpqjmgrbkh
2. Clique em **SQL Editor** (menu esquerdo) → **New query**
3. Apague qualquer texto que estiver lá
4. Cole TODO o conteúdo do arquivo `supabase-schema-reset.sql`
5. Clique **Run** → deve aparecer "Success"

## PASSO 2 — Subir código na Vercel (5 min)

### Opção A — Via GitHub (recomendada):
1. Crie repositório em github.com → "New repository" → nome: `factorone-mvp`
2. Descompacte o ZIP no seu computador
3. Na pasta descompactada, abra o terminal:
```
git init
git add .
git commit -m "FactorOne MVP"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/factorone-mvp.git
git push -u origin main
```
4. Acesse vercel.com → "Add New Project" → Import do GitHub → selecione `factorone-mvp`

### Opção B — Upload direto (mais fácil):
1. Acesse vercel.com → "Add New Project"
2. Clique em "Upload" e arraste a pasta descompactada

## PASSO 3 — Variáveis de ambiente na Vercel (3 min)
Na tela de configuração do projeto, clique em **Environment Variables** e adicione:

```
NEXT_PUBLIC_SUPABASE_URL = https://poquuezgtowpqjmgrbkh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvcXV1ZXpndG93cHFqbWdyYmtoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2ODYxNTUsImV4cCI6MjA4OTI2MjE1NX0.6kU6f6zEFbHnSyVt6h-sy9oikNKGX7IJ6kO270Xlbk8
SUPABASE_SERVICE_ROLE_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvcXV1ZXpndG93cHFqbWdyYmtoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzY4NjE1NSwiZXhwIjoyMDg5MjYyMTU1fQ.nwkB4OAzfMylsJFQkGbhzI4sZh59Lgw1i2O3NMVLjSQ
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = pk_test_51TGq8tJA6DAGsEckKOJJA580NrPWA5MbDkPhIcBOZW21Yn6X2RrQbjDA8uBXqtugBoiDshW8fEH4uknZIuzhFIoO00cEmZkvyx
STRIPE_SECRET_KEY = sk_test_51TGq8tJA6DAGsEckwbt1CnoGDsD5nt2qu8qraIbagIP7uppdyDLrhmcOmrwbn5lSPVyXjozzYqSLnPsw8Z2nCxsp00wykFugtO
STRIPE_WEBHOOK_SECRET = whsec_placeholder
NEXT_PUBLIC_STRIPE_PRICE_ESSENCIAL = price_1TGr7aJA6DAGsEckmrH0fAgN
NEXT_PUBLIC_STRIPE_PRICE_PROFISSIONAL = price_1TGr82JA6DAGsEcknu6iVcd9
NEXT_PUBLIC_STRIPE_PRICE_SCALE = price_1TGr8OJA6DAGsEckLv5wxY07
ANTHROPIC_API_KEY = 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
NEXT_PUBLIC_APP_URL = https://SEU-PROJETO.vercel.app
```

5. Clique **Deploy** → aguarda ~2 minutos

## PASSO 4 — Webhook Stripe (3 min)
Após o deploy aparecer a URL (ex: `factorone-mvp-abc123.vercel.app`):

1. Acesse: dashboard.stripe.com → Developers → Webhooks → **Add endpoint**
2. Endpoint URL: `https://SEU-PROJETO.vercel.app/api/webhook`
3. Eventos: marque `checkout.session.completed` e `customer.subscription.deleted`
4. Clique **Add endpoint**
5. Clique no webhook criado → **Reveal** no "Signing secret"
6. Copie o `whsec_...` 
7. Volte na Vercel → Settings → Environment Variables → atualize `STRIPE_WEBHOOK_SECRET`
8. Redeploy (botão "Redeploy" na aba Deployments)

## PASSO 5 — Testar (2 min)
1. Acesse a URL do seu projeto na Vercel
2. Clique em "Criar conta" → preencha nome, empresa, email, senha
3. Você vai ver o dashboard! 🎉

## Domínio app.factorone.com.br (opcional)
1. Vercel → Settings → Domains → Add: `app.factorone.com.br`
2. Na Hostinger → DNS → Adicionar registro:
   - Tipo: CNAME
   - Nome: app
   - Valor: cname.vercel-dns.com
3. Aguardar 5-30 min para propagar

