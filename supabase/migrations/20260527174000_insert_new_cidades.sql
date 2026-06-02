-- Migration: 20260527174000_insert_new_cidades.sql
-- Insere as novas cidades solicitadas com seus respectivos códigos IBGE e UFs no banco de dados

INSERT INTO public.cidade (descricao, estado_id, cd_ibge)
SELECT v.descricao, v.estado_id, v.cd_ibge
FROM (VALUES
  ('ANAPU', 'PA', '1500851'),
  ('ITAPECURU MIRIM', 'MA', '2105409'),
  ('GUIMARÃES', 'MA', '2104907'),
  ('BOM JESUS', 'PI', '2201908'),
  ('VITÓRIA DO MEARIM', 'MA', '2113504'),
  ('PINDARÉ MIRIM', 'MA', '2108501'),
  ('MARANHÃOZINHO', 'MA', '2106373'),
  ('PAULO RAMOS', 'MA', '2108105'),
  ('IMPERATRIZ', 'MA', '2105300'),
  ('PINHEIRO', 'MA', '2108600'),
  ('PIRAPEMAS', 'MA', '2108808'),
  ('CANAÃ DOS CARAJÁS', 'PA', '1502154'),
  ('MARACAÇUMÉ', 'MA', '2106324'),
  ('IPATINGA', 'MG', '3131304'),
  ('MATINHA', 'MA', '2106506'),
  ('HUMBERTO DE CAMPOS', 'MA', '2105003'),
  ('ICATU', 'MA', '2105102'),
  ('PAULINO NEVES', 'MA', '2108055'),
  ('PRESIDENTE VARGAS', 'MA', '2109301'),
  ('ESPERANTINA', 'PI', '2203706'),
  ('PIO XII', 'MA', '2108709'),
  ('MATA ROMA', 'MA', '2106407'),
  ('LAGOAÇU', 'MA', '2105961'),
  ('BREU BRANCO', 'PA', '1501784'),
  ('LAGO DOS RODRIGUES', 'MA', '2105946'),
  ('GOVERNADOR NUNES FREIRE', 'MA', '2104675'),
  ('LAGO VERDE', 'MA', '2105904')
) AS v(descricao, estado_id, cd_ibge)
WHERE NOT EXISTS (
  SELECT 1 FROM public.cidade c WHERE c.cd_ibge = v.cd_ibge
);

-- Ativa as cidades caso elas existam mas estejam marcadas como excluídas
UPDATE public.cidade
SET excluido = false
WHERE cd_ibge IN (
  '1500851', '2105409', '2104907', '2201908', '2113504',
  '2108501', '2106373', '2108105', '2105300', '2108600',
  '2108808', '1502154', '2106324', '3131304', '2106506',
  '2105003', '2105102', '2108055', '2109301', '2203706',
  '2108709', '2106407', '2105961', '1501784', '2105946',
  '2104675', '2105904'
);
