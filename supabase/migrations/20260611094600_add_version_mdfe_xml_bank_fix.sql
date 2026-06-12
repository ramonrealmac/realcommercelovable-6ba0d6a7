-- Migration: 20260611094600_add_version_mdfe_xml_bank_fix.sql
-- Registra a versão contendo a correção da geração das tags de pagamento e dados bancários no XML do MDF-e

INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias)
VALUES (
  '1.16.26',
  'MDF-e: Correção de Tags Bancárias Vazias (infBanc / infPag) no XML',
  'Corrigida a geração do arquivo INI / XML de MDF-e para evitar rejeições de schema da SEFAZ:' || chr(10) || chr(10) ||
  '• Tratamento Strict de Dados Bancários: O nó infBanc agora só é gerado no INI (e consequentemente no XML) se houver dados bancários 100% preenchidos e válidos (codBanco e codAgencia preenchidos, ou chave PIX válida, ou CNPJ da IPEF).' || chr(10) ||
  '• Eliminação de Tags Vazias: Garantido que tags como <codBanco> e <codAgencia> nunca sejam enviadas vazias ou abertas sem valor para a SEFAZ.' || chr(10) ||
  '• Opcionalidade de infPag: Em manifestos com múltiplos documentos fiscais, a tag infPag e seus filhos só serão gerados se houver real preenchimento de frete/pagamento (vl_contrato > 0 ou dados bancários/PIX presentes), sanando rejeições automáticas.',
  'Antigravity',
  'Desenvolvimento',
  ARRAY['React', 'TypeScript', 'Supabase', 'PostgreSQL']
);
