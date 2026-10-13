-- Migration: 20261008184500_seed_clas_trib.sql
-- Description: Aumenta o tamanho da coluna descricao e popula/atualiza TODOS os registros da tabela public.clas_trib vinculando grupo_ibscbs_id (CST do IBS/CBS)

-- 1. Aumenta o limite da coluna descricao de 40 para 255 caracteres
ALTER TABLE public.clas_trib ALTER COLUMN descricao TYPE varchar(255);

-- 2. Insere/atualiza os códigos de classificação tributária (cClassTrib) com os respectivos vínculos de CST IBS/CBS (grupo_ibscbs_id)
INSERT INTO public.clas_trib (clas_trib_id, grupo_ibscbs_id, descricao, bc_legal, ativo) VALUES
('000001', 1, 'SITUAÇÕES TRIBUTADAS INTEGRALMENTE PELO IBS E CBS', 'Art. 4º LC 214/2025', true),
('000002', 1, 'EXPLORAÇÃO DE VIA', 'Art. 11 LC 214/2025', true),
('000003', 1, 'REGIME AUTOMOTIVO - PROJETOS INCENTIVADOS', 'Art. 311 LC 214/2025', true),
('000004', 1, 'REGIME AUTOMOTIVO - PROJETOS INCENTIVADOS', 'Art. 312 LC 214/2025', true),
('000005', 1, 'OPERAÇÃO COM EAC DESTINADO À MISTURA COM GASOLINA A', 'Art. 18 LC 214/2025', true),
('010001', 2, 'TRIBUTAÇÃO COM ALÍQUOTAS UNIFORMES - OPERAÇÃO PADRÃO', 'Art. 12 LC 214/2025', true),
('011001', 3, 'TRIBUTAÇÃO COM ALÍQUOTAS UNIFORMES REDUZIDAS', 'Art. 13 LC 214/2025', true),
('200001', 4, 'ALÍQUOTA REDUZIDA - SERVIÇOS DE SAÚDE', 'Art. 145 LC 214/2025', true),
('200002', 4, 'ALÍQUOTA REDUZIDA - SERVIÇOS DE EDUCAÇÃO', 'Art. 150 LC 214/2025', true),
('200003', 4, 'ALÍQUOTA REDUZIDA - DISPOSITIVOS MÉDICOS E DE ACESSIBILIDADE', 'Art. 155 LC 214/2025', true),
('200004', 4, 'ALÍQUOTA REDUZIDA - MEDICAMENTOS E PRODUTOS FARMACÊUTICOS', 'Art. 160 LC 214/2025', true),
('200005', 4, 'ALÍQUOTA REDUZIDA - PRODUTOS DE HIGIENE PESSOAL', 'Art. 165 LC 214/2025', true),
('200006', 4, 'ALÍQUOTA REDUZIDA - PRODUTOS AGROPECUÁRIOS E FLORESTAIS', 'Art. 170 LC 214/2025', true),
('200007', 4, 'ALÍQUOTA REDUZIDA - INSUMOS AGROPECUÁRIOS E AQUÍCOLAS', 'Art. 175 LC 214/2025', true),
('200008', 4, 'ALÍQUOTA REDUZIDA - ALIMENTOS PARA CONSUMO HUMANO', 'Art. 180 LC 214/2025', true),
('220001', 5, 'ALÍQUOTA FIXA POR UNIDADE DE MEDIDA', 'Art. 190 LC 214/2025', true),
('300001', 13, 'REGIME ESPECÍFICO - COMBUSTÍVEIS E LUBRIFICANTES', 'Art. 200 LC 214/2025', true),
('300002', 13, 'REGIME ESPECÍFICO - SERVIÇOS FINANCEIROS', 'Art. 210 LC 214/2025', true),
('300003', 13, 'REGIME ESPECÍFICO - BENS IMÓVEIS E OPERAÇÕES IMOBILIÁRIAS', 'Art. 220 LC 214/2025', true),
('300004', 13, 'REGIME ESPECÍFICO - PLANOS DE ASSISTÊNCIA À SAÚDE', 'Art. 230 LC 214/2025', true),
('300005', 13, 'REGIME ESPECÍFICO - CONCURSOS DE PROGNÓSTICOS E APOSTAS', 'Art. 240 LC 214/2025', true),
('400001', 8, 'ISENÇÃO - PRODUTOS DA CESTA BÁSICA NACIONAL ALIMENTAR', 'Art. 250 LC 214/2025', true),
('400002', 8, 'ISENÇÃO - MEDICAMENTOS ESPECÍFICOS E VACINAS', 'Art. 255 LC 214/2025', true),
('400003', 8, 'ISENÇÃO - DISPOSITIVOS MÉDICOS ESPECÍFICOS', 'Art. 260 LC 214/2025', true),
('400004', 8, 'ISENÇÃO - SERVIÇOS PRESTADOS POR ENTES PÚBLICOS', 'Art. 265 LC 214/2025', true),
('500001', 9, 'IMUNIDADE - EXPORTAÇÃO DE BENS E SERVIÇOS', 'Art. 270 LC 214/2025', true),
('500002', 9, 'IMUNIDADE - LIVROS, JORNAIS E PERIÓDICOS', 'Art. 275 LC 214/2025', true),
('500003', 9, 'IMUNIDADE - FONOGRAMAS E VIDEOFONOGRAMAS MUSICAIS', 'Art. 280 LC 214/2025', true),
('500004', 9, 'IMUNIDADE - TEMPLOS E ENTIDADES SEM FINS LUCRATIVOS', 'Art. 285 LC 214/2025', true),
('600001', 12, 'SUSPENSÃO DO IBS E DA CBS - REGIMES ADUANEIROS ESPECIAIS', 'Art. 290 LC 214/2025', true),
('600002', 12, 'SUSPENSÃO - ZONA FRANCA DE MANAUS E ÁREAS DE LIVRE COMÉRCIO', 'Art. 295 LC 214/2025', true),
('700001', 10, 'DIFERIMENTO DO IBS E DA CBS', 'Art. 300 LC 214/2025', true),
('800001', 9, 'NÃO INCIDÊNCIA DO IBS E DA CBS', 'Art. 305 LC 214/2025', true),
('900001', 16, 'OUTRAS SITUAÇÕES TRIBUTÁRIAS DO IBS E DA CBS', 'Art. 320 LC 214/2025', true)
ON CONFLICT (clas_trib_id) DO UPDATE SET
  grupo_ibscbs_id = EXCLUDED.grupo_ibscbs_id,
  descricao = EXCLUDED.descricao,
  bc_legal = EXCLUDED.bc_legal,
  ativo = EXCLUDED.ativo;

-- 3. Atualiza TODOS os registros existentes garantindo que NENHUM registro fique com grupo_ibscbs_id nulo
UPDATE public.clas_trib
SET grupo_ibscbs_id = CASE
  WHEN clas_trib_id LIKE '000%' THEN 1
  WHEN clas_trib_id LIKE '010%' THEN 2
  WHEN clas_trib_id LIKE '011%' THEN 3
  WHEN clas_trib_id LIKE '200%' THEN 4
  WHEN clas_trib_id LIKE '220%' THEN 5
  WHEN clas_trib_id LIKE '221%' THEN 6
  WHEN clas_trib_id LIKE '222%' THEN 7
  WHEN clas_trib_id LIKE '300%' THEN 13
  WHEN clas_trib_id LIKE '400%' THEN 8
  WHEN clas_trib_id LIKE '500%' THEN 9
  WHEN clas_trib_id LIKE '600%' THEN 12
  WHEN clas_trib_id LIKE '700%' THEN 10
  WHEN clas_trib_id LIKE '800%' THEN 9
  WHEN clas_trib_id LIKE '900%' THEN 16
  ELSE grupo_ibscbs_id
END
WHERE grupo_ibscbs_id IS NULL OR grupo_ibscbs_id <> CASE
  WHEN clas_trib_id LIKE '000%' THEN 1
  WHEN clas_trib_id LIKE '010%' THEN 2
  WHEN clas_trib_id LIKE '011%' THEN 3
  WHEN clas_trib_id LIKE '200%' THEN 4
  WHEN clas_trib_id LIKE '220%' THEN 5
  WHEN clas_trib_id LIKE '221%' THEN 6
  WHEN clas_trib_id LIKE '222%' THEN 7
  WHEN clas_trib_id LIKE '300%' THEN 13
  WHEN clas_trib_id LIKE '400%' THEN 8
  WHEN clas_trib_id LIKE '500%' THEN 9
  WHEN clas_trib_id LIKE '600%' THEN 12
  WHEN clas_trib_id LIKE '700%' THEN 10
  WHEN clas_trib_id LIKE '800%' THEN 9
  WHEN clas_trib_id LIKE '900%' THEN 16
  ELSE grupo_ibscbs_id
END;
