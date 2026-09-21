-- Migration: 20260921183000_add_desconto_excedido_to_empresa.sql
-- Description: Adds desconto_excedido column to public.empresa table.
-- Values: 'B' = BLOQUEIA NO PEDIDO, 'L' = EXIGE LIBERAÇÃO

ALTER TABLE public.empresa 
  ADD COLUMN IF NOT EXISTS desconto_excedido character varying(1) NOT NULL DEFAULT 'B';

COMMENT ON COLUMN public.empresa.desconto_excedido IS 'Comportamento para desconto excedido: B = BLOQUEIA NO PEDIDO, L = EXIGE LIBERAÇÃO';
