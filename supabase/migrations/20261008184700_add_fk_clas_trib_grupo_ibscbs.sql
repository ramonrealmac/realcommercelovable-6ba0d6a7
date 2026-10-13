-- Migration: 20261008184700_add_fk_clas_trib_grupo_ibscbs.sql
-- Description: Adiciona a constraint de chave estrangeira entre public.clas_trib(grupo_ibscbs_id) e public.ibscbs(ibscbs_id)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_clas_trib_grupo_ibscbs' AND table_name = 'clas_trib'
  ) THEN
    ALTER TABLE public.clas_trib 
    ADD CONSTRAINT fk_clas_trib_grupo_ibscbs 
    FOREIGN KEY (grupo_ibscbs_id) REFERENCES public.ibscbs(ibscbs_id) 
    ON DELETE SET NULL;
  END IF;
END $$;
