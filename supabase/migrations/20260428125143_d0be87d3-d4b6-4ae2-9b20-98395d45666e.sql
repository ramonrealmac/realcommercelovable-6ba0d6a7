INSERT INTO public.estado (estado_id, nm_estado, excluido) VALUES
('AC','ACRE',false),('AL','ALAGOAS',false),('AP','AMAPA',false),('AM','AMAZONAS',false),
('BA','BAHIA',false),('CE','CEARA',false),('DF','DISTRITO FEDERAL',false),('ES','ESPIRITO SANTO',false),
('GO','GOIAS',false),('MA','MARANHAO',false),('MT','MATO GROSSO',false),('MS','MATO GROSSO DO SUL',false),
('MG','MINAS GERAIS',false),('PA','PARA',false),('PB','PARAIBA',false),('PR','PARANA',false),
('PE','PERNAMBUCO',false),('PI','PIAUI',false),('RJ','RIO DE JANEIRO',false),('RN','RIO GRANDE DO NORTE',false),
('RS','RIO GRANDE DO SUL',false),('RO','RONDONIA',false),('RR','RORAIMA',false),('SC','SANTA CATARINA',false),
('SP','SAO PAULO',false),('SE','SERGIPE',false),('TO','TOCANTINS',false)
ON CONFLICT (estado_id) DO UPDATE SET nm_estado = EXCLUDED.nm_estado;