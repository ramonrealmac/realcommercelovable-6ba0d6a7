
-- Fix security definer views by setting security_invoker
ALTER VIEW public.vw_pedidos_completos SET (security_invoker = on);
ALTER VIEW public.vw_produtos_disponiveis SET (security_invoker = on);
