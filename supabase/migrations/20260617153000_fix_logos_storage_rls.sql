-- Migration: 20260617153000_fix_logos_storage_rls.sql
-- Descrição: Cria o bucket 'logos' caso não exista e ajusta as políticas de RLS para permitir upload de logomarcas.

-- Cria o bucket se não existir
INSERT INTO storage.buckets (id, name, public) 
VALUES ('logos', 'logos', true) 
ON CONFLICT (id) DO UPDATE SET public = true;

-- Permite acesso público para visualizar as logos
CREATE POLICY "Public Access for logos" ON storage.objects FOR SELECT USING (bucket_id = 'logos');

-- Permite que usuários autenticados façam upload no bucket logos
CREATE POLICY "Auth Upload for logos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'logos');

-- Permite que usuários autenticados atualizem logos
CREATE POLICY "Auth Update for logos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'logos');

-- Permite que usuários autenticados deletem logos
CREATE POLICY "Auth Delete for logos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'logos');
