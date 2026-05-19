-- Auto-populate xhr_pedido on INSERT if not provided
CREATE OR REPLACE FUNCTION public.tr_set_hr_pedido()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.xhr_pedido IS NULL THEN
    NEW.xhr_pedido := to_char(NEW.xdt_pedido AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI:SS');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_hr_pedido
  BEFORE INSERT ON public.pedido
  FOR EACH ROW
  EXECUTE FUNCTION public.tr_set_hr_pedido();

-- Backfill existing orders missing xhr_pedido
UPDATE public.pedido
SET xhr_pedido = to_char(xdt_pedido AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI:SS')
WHERE xhr_pedido IS NULL AND xdt_pedido IS NOT NULL;