-- Sprint 10 — Equipe, Notificações, Portal Cliente, Relatório Gerencial
-- Rode no SQL Editor do Supabase

-- ── MEMBROS DA EQUIPE ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.membros_equipe (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  uuid NOT NULL,
  email       text NOT NULL,
  nome        text,
  role        text CHECK (role IN ('admin','financeiro','comercial','operacional','logistica','viewer')) DEFAULT 'viewer',
  status      text CHECK (status IN ('pendente','ativo','revogado')) DEFAULT 'pendente',
  token       text UNIQUE,
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  convidado_por uuid,
  expires_at  timestamptz,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE(empresa_id, email)
);
ALTER TABLE public.membros_equipe ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "membros_equipe_rls" ON public.membros_equipe;
CREATE POLICY "membros_equipe_rls" ON public.membros_equipe FOR ALL
  USING (empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()));
DROP POLICY IF EXISTS "membros_equipe_token_read" ON public.membros_equipe;
CREATE POLICY "membros_equipe_token_read" ON public.membros_equipe FOR SELECT
  USING (true);
CREATE INDEX IF NOT EXISTS idx_membros_equipe_empresa ON public.membros_equipe(empresa_id);
CREATE INDEX IF NOT EXISTS idx_membros_equipe_token ON public.membros_equipe(token);

-- ── NOTIFICAÇÕES ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notificacoes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  uuid NOT NULL,
  user_id     uuid, -- null = para todos da empresa
  titulo      text NOT NULL,
  mensagem    text,
  tipo        text CHECK (tipo IN ('info','sucesso','aviso','erro')) DEFAULT 'info',
  modulo      text DEFAULT 'sistema',
  link        text,
  lida        boolean DEFAULT false,
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notificacoes_rls" ON public.notificacoes;
CREATE POLICY "notificacoes_rls" ON public.notificacoes FOR ALL
  USING (empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()));
CREATE INDEX IF NOT EXISTS idx_notificacoes_empresa ON public.notificacoes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_lida ON public.notificacoes(empresa_id, lida);

-- ── PORTAL DO CLIENTE ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cliente_links (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  uuid NOT NULL,
  cliente_id  uuid REFERENCES public.clientes(id) ON DELETE CASCADE,
  token       text NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  status      text CHECK (status IN ('ativo','expirado')) DEFAULT 'ativo',
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE public.cliente_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cliente_links_rls" ON public.cliente_links;
CREATE POLICY "cliente_links_rls" ON public.cliente_links FOR ALL
  USING (empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()));
DROP POLICY IF EXISTS "cliente_links_public_read" ON public.cliente_links;
CREATE POLICY "cliente_links_public_read" ON public.cliente_links FOR SELECT
  USING (true);
CREATE INDEX IF NOT EXISTS idx_cliente_links_token ON public.cliente_links(token);
