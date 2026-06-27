-- Migration: 20260626094000_add_empresa_id_to_fiscal_regra.sql
-- Description: Adiciona o campo empresa_id e a chave estrangeira na tabela fiscal_regra, e registra a versão 1.18.4 do sistema

-- 1. Ajustes de Esquema
ALTER TABLE public.fiscal_regra 
ADD COLUMN IF NOT EXISTS empresa_id integer DEFAULT 1 NOT NULL;

-- Adiciona a FK para a tabela empresa se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_fiscal_regra_empresa' AND table_name = 'fiscal_regra'
  ) THEN
    ALTER TABLE public.fiscal_regra 
    ADD CONSTRAINT fk_fiscal_regra_empresa FOREIGN KEY (empresa_id) REFERENCES public.empresa(empresa_id);
  END IF;
END $$;

-- 2. Registro da Versão
INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias, created_at)
VALUES (
  '1.18.4',
  'Gestão Fiscal por Empresa e Filtros de Regra',
  'Adicionado o campo empresa_id na tabela fiscal_regra com FK para empresa. Ajustada a tela de Regras Fiscais e CFOP para associar novos cadastros à Empresa Matriz (compartilhamento de regras com filiais). Implementada a filtragem dos seletores de CFOP, Tipo de Operação e Grupo Tributário no form de regras fiscais para listar apenas registros pertencentes à Matriz ou filiais. Alterado o campo CST/CSOSN na aba ICMS para combo box, exibindo opções de CSOSN para empresas do Simples Nacional e opções de CST para regime normal, carregados a partir da tabela icms.',
  'Antigravity',
  'Produção',
  ARRAY['React', 'TypeScript', 'PostgreSQL', 'Supabase'],
  now()
)
ON CONFLICT (versao) DO UPDATE 
SET titulo = EXCLUDED.titulo,
    detalhes = EXCLUDED.detalhes,
    autor = EXCLUDED.autor,
    fase = EXCLUDED.fase,
    tecnologias = EXCLUDED.tecnologias,
    created_at = EXCLUDED.created_at;
