-- Migration: 20260903130000_add_nr_transferencia.sql
-- Descrição: Adiciona coluna nr_transferencia por filial de origem e trigger sequencial automática

ALTER TABLE public.transferencia ADD COLUMN IF NOT EXISTS nr_transferencia bigint;

-- Atualizar registros legados caso existam sem número
UPDATE public.transferencia 
SET nr_transferencia = transferencia_id 
WHERE nr_transferencia IS NULL OR nr_transferencia = 0;

-- Função trigger para gerar o número sequencial de transferência por Filial de Origem
CREATE OR REPLACE FUNCTION public.fn_generate_nr_transferencia()
RETURNS trigger AS $$
DECLARE
  v_max_nr bigint;
BEGIN
  IF NEW.nr_transferencia IS NULL OR NEW.nr_transferencia = 0 THEN
    SELECT COALESCE(MAX(nr_transferencia), 0) + 1
    INTO v_max_nr
    FROM public.transferencia
    WHERE empresa_origem_id = NEW.empresa_origem_id;

    NEW.nr_transferencia := v_max_nr;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_generate_nr_transferencia ON public.transferencia;

CREATE TRIGGER tr_generate_nr_transferencia
BEFORE INSERT ON public.transferencia
FOR EACH ROW
EXECUTE FUNCTION public.fn_generate_nr_transferencia();
