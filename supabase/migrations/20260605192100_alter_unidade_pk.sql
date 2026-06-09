-- Alter public.unidade primary key to (unidade_id, empresa_id)

-- 1. Drop existing foreign key on public.produto that references public.unidade
ALTER TABLE public.produto DROP CONSTRAINT IF EXISTS fk_produto_unidade;

-- 2. Drop existing primary key and unique constraints on public.unidade
ALTER TABLE public.unidade DROP CONSTRAINT IF EXISTS unidade_pk;
ALTER TABLE public.unidade DROP CONSTRAINT IF EXISTS unidade_pe;

-- 3. Add the new composite primary key on public.unidade
ALTER TABLE public.unidade ADD CONSTRAINT unidade_pk PRIMARY KEY (unidade_id, empresa_id);

-- 4. Clean up any invalid/orphaned references in public.produto (where the unit doesn't exist for the product's company)
UPDATE public.produto p
SET unidade_id = NULL
WHERE unidade_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.unidade u
    WHERE u.unidade_id = p.unidade_id
      AND u.empresa_id = p.empresa_id
  );

-- 5. Recreate the foreign key constraint on public.produto pointing to the composite primary key of public.unidade
ALTER TABLE public.produto
  ADD CONSTRAINT fk_produto_unidade
  FOREIGN KEY (unidade_id, empresa_id)
  REFERENCES public.unidade (unidade_id, empresa_id);
