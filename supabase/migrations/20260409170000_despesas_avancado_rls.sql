-- Ajustes avançados do módulo de despesas (RLS híbrido + campos extras)

ALTER TABLE public.despesas
  ADD COLUMN IF NOT EXISTS subcategoria text,
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS metadados jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS projeto text,
  ADD COLUMN IF NOT EXISTS moeda text DEFAULT 'BRL',
  ADD COLUMN IF NOT EXISTS valor_original decimal(15, 2),
  ADD COLUMN IF NOT EXISTS taxa_cambio decimal(15, 6) DEFAULT 1;

ALTER TABLE public.despesas DROP CONSTRAINT IF EXISTS despesas_recorrencia_check;
ALTER TABLE public.despesas
  ADD CONSTRAINT despesas_recorrencia_check CHECK (
    recorrencia_tipo IS NULL OR recorrencia_tipo IN ('semanal', 'bisemanal', 'mensal')
  );

-- Política híbrida: funciona em instalações com usuarios.empresa_id
-- e também com empresas.user_id.
DROP POLICY IF EXISTS "usuarios veem proprias despesas" ON public.despesas;
CREATE POLICY "usuarios veem proprias despesas" ON public.despesas
  FOR ALL
  USING (
    empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
    OR empresa_id IN (SELECT id FROM public.empresas WHERE user_id = auth.uid())
    OR empresa_id = auth.uid()
  )
  WITH CHECK (
    empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
    OR empresa_id IN (SELECT id FROM public.empresas WHERE user_id = auth.uid())
    OR empresa_id = auth.uid()
  );

DROP POLICY IF EXISTS "usuarios veem proprios centros" ON public.centros_custo;
CREATE POLICY "usuarios veem proprios centros" ON public.centros_custo
  FOR ALL
  USING (
    empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
    OR empresa_id IN (SELECT id FROM public.empresas WHERE user_id = auth.uid())
  )
  WITH CHECK (
    empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
    OR empresa_id IN (SELECT id FROM public.empresas WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "usuarios veem categorias despesas" ON public.categorias_despesa;
CREATE POLICY "usuarios veem categorias despesas" ON public.categorias_despesa
  FOR ALL
  USING (
    empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
    OR empresa_id IN (SELECT id FROM public.empresas WHERE user_id = auth.uid())
  )
  WITH CHECK (
    empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
    OR empresa_id IN (SELECT id FROM public.empresas WHERE user_id = auth.uid())
  );
