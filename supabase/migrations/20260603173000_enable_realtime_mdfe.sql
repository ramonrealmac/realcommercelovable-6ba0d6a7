-- Migration: 20260603173000_enable_realtime_mdfe.sql
-- Habilita o realtime no Supabase para as tabelas de manifesto e eventos fiscais de forma segura e idempotente

DO $$
BEGIN
  -- Habilita realtime para fiscal_mdf_manifesto
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_publication_rel pr 
    JOIN pg_publication p ON p.oid = pr.prpubid 
    JOIN pg_class c ON c.oid = pr.prrelid 
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE p.pubname = 'supabase_realtime' 
      AND n.nspname = 'public' 
      AND c.relname = 'fiscal_mdf_manifesto'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.fiscal_mdf_manifesto;
  END IF;

  -- Habilita realtime para fiscal_evento
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_publication_rel pr 
    JOIN pg_publication p ON p.oid = pr.prpubid 
    JOIN pg_class c ON c.oid = pr.prrelid 
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE p.pubname = 'supabase_realtime' 
      AND n.nspname = 'public' 
      AND c.relname = 'fiscal_evento'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.fiscal_evento;
  END IF;
END $$;

-- Registra a nova versão
INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias)
VALUES (
  '1.16.18',
  'Habilitação do Realtime no MDF-e e Eventos Fiscais',
  '• Habilitada a publicação de alterações em tempo real no Supabase para a tabela fiscal_mdf_manifesto e fiscal_evento, garantindo que o status seja atualizado automaticamente no frontend assim que o worker processar a emissão.' || chr(10) ||
  '• Implementado fluxo automático para geração e abertura do DAMDFE (PDF) no navegador do usuário imediatamente após a autorização fiscal.',
  'Antigravity',
  'Desenvolvimento',
  ARRAY['PostgreSQL', 'Supabase Realtime', 'React', 'ACBrLib']
);
