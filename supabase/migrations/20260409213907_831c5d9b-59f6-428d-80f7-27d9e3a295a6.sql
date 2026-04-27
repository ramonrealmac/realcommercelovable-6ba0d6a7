
-- Renomear tabela subgrupo_produto -> produto_subgrupo
ALTER TABLE public.subgrupo_produto RENAME TO produto_subgrupo;

-- Renomear colunas na tabela produto_subgrupo
ALTER TABLE public.produto_subgrupo RENAME COLUMN subgrupo_id TO produto_subgrupo_id;
ALTER TABLE public.produto_subgrupo RENAME COLUMN grupo_id TO produto_grupo_id;

-- Renomear coluna na tabela produto_grupo
ALTER TABLE public.produto_grupo RENAME COLUMN grupo_id TO produto_grupo_id;

-- Renomear colunas na tabela produto
ALTER TABLE public.produto RENAME COLUMN grupo_id TO produto_grupo_id;
ALTER TABLE public.produto RENAME COLUMN subgrupo_id TO produto_subgrupo_id;
