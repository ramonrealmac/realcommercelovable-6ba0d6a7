-- Migration: 20260617140000_add_empresa_usuario_fkeys.sql
-- Descrição: Adiciona chaves estrangeiras que faltavam nas tabelas empresa_usuario e perfil_usuario.
-- Isso é necessário para o Supabase (PostgREST) conseguir fazer o JOIN entre profiles e empresa_usuario,
-- que é usado na tela de Usuários (UsuarioForm.tsx) para listar os usuários da empresa.

-- Clean up orphaned records that were left behind because there was no cascading delete previously
DELETE FROM public.empresa_usuario WHERE user_id NOT IN (SELECT id FROM public.profiles);
DELETE FROM public.perfil_usuario WHERE user_id NOT IN (SELECT id FROM public.profiles);

ALTER TABLE public.empresa_usuario
  ADD CONSTRAINT empresa_usuario_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.empresa_usuario
  ADD CONSTRAINT empresa_usuario_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(empresa_id) ON DELETE CASCADE;

ALTER TABLE public.perfil_usuario
  ADD CONSTRAINT perfil_usuario_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.perfil_usuario
  ADD CONSTRAINT perfil_usuario_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(empresa_id) ON DELETE CASCADE;
