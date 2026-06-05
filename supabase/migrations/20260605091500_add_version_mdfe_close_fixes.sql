-- Migration: 20260605091500_add_version_mdfe_close_fixes.sql
-- Registra a versão contendo a correção dos erros de encerramento de MDF-e (dtEnc e nProt) no worker fiscal

INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias)
VALUES (
  '1.16.19',
  'Correção no Encerramento de MDF-e',
  'Implementado correções no processamento de encerramento do MDF-e pelo worker:' || chr(10) || chr(10) ||
  '• Formatação de Data: Ajustado dtEnc para formato brasileiro (DD/MM/YYYY) para evitar erro de data inválida na ACBrLib.' || chr(10) ||
  '• Protocolo de Autorização (nProt): Integrada busca automática do protocolo de autorização do MDF-e a partir do banco de dados para inclusão no INI de encerramento, resolvendo falha de validação da SEFAZ.' || chr(10) ||
  '• Prefixos de Seções ACBr: Normalizado o prefixo para "MDFe" garantindo gravação correta de parâmetros na seção da DLL e resolução de schemas XSD.',
  'Antigravity',
  'Desenvolvimento',
  ARRAY['Node.js', 'ACBrLib', 'Supabase', 'PostgreSQL']
);
