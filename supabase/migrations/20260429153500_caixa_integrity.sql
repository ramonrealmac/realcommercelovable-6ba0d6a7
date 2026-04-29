
-- Integridade entre caixa_abertura e caixa_movimento
-- No permite excluso ou alterao do caixa_abertura se houver movimentos vinculados
ALTER TABLE public.caixa_movimento
DROP CONSTRAINT IF EXISTS fk_caixa_movimento_abertura;

ALTER TABLE public.caixa_movimento
ADD CONSTRAINT fk_caixa_movimento_abertura
FOREIGN KEY (caixa_abertura_id)
REFERENCES public.caixa_abertura(caixa_abertura_id)
ON DELETE RESTRICT
ON UPDATE RESTRICT;

-- Integridade entre caixa_movimento e caixa_movimento_item
-- No permite excluso ou alterao do caixa_movimento se houver itens vinculados
ALTER TABLE public.caixa_movimento_item
DROP CONSTRAINT IF EXISTS fk_caixa_movimento_item_movimento;

ALTER TABLE public.caixa_movimento_item
ADD CONSTRAINT fk_caixa_movimento_item_movimento
FOREIGN KEY (caixa_movimento_id)
REFERENCES public.caixa_movimento(caixa_movimento_id)
ON DELETE RESTRICT
ON UPDATE RESTRICT;
