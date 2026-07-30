-- Migration to fix plano_conta gaps and duplicate codes
-- First, align the auto-increment sequence with the maximum existing ID
SELECT setval('public.plano_conta_plano_id_seq', COALESCE((SELECT MAX(plano_conta_id) FROM public.plano_conta), 1));

-- 1. Insert missing intermediate level 3 accounts (Sintéticas)
INSERT INTO public.plano_conta (empresa_id, conta, nome, tp_conta, tp_natureza, nivel, excluido) VALUES
(5, '1.02.001', 'RECEITAS FINANCEIRAS', 'S', 'R', 3, false),
(5, '1.09.001', 'OUTRAS RECEITAS', 'S', 'R', 3, false),
(5, '2.01.001', 'CUSTOS OPERACIONAIS', 'S', 'D', 3, false),
(5, '2.02.001', 'DESPESAS COM PESSOAL', 'S', 'D', 3, false),
(5, '2.03.001', 'DESPESAS ADMINISTRATIVAS', 'S', 'D', 3, false),
(5, '2.04.001', 'DESPESAS COM VENDAS', 'S', 'D', 3, false),
(5, '2.05.001', 'DESPESAS FINANCEIRAS', 'S', 'D', 3, false),
(5, '2.06.001', 'IMPOSTOS E CONTRIBUIÇÕES', 'S', 'D', 3, false),
(5, '2.09.001', 'OUTRAS DESPESAS', 'S', 'D', 3, false);

-- 2. Update duplicate classification codes for Level 4 accounts (Analíticas)
-- Vendas
UPDATE public.plano_conta SET conta = '1.01.001.001' WHERE plano_conta_id = 5;
UPDATE public.plano_conta SET conta = '1.01.001.002' WHERE plano_conta_id = 6;
UPDATE public.plano_conta SET conta = '1.01.001.003' WHERE plano_conta_id = 4;

-- Receitas Financeiras
UPDATE public.plano_conta SET conta = '1.02.001.001' WHERE plano_conta_id = 9;
UPDATE public.plano_conta SET conta = '1.02.001.002' WHERE plano_conta_id = 8;

-- Outras Receitas
UPDATE public.plano_conta SET conta = '1.09.001.001' WHERE plano_conta_id = 11;

-- Custos
UPDATE public.plano_conta SET conta = '2.01.001.001' WHERE plano_conta_id = 14;
UPDATE public.plano_conta SET conta = '2.01.001.002' WHERE plano_conta_id = 15;
UPDATE public.plano_conta SET conta = '2.01.001.003' WHERE plano_conta_id = 16;

-- Pessoal
UPDATE public.plano_conta SET conta = '2.02.001.001' WHERE plano_conta_id = 18;
UPDATE public.plano_conta SET conta = '2.02.001.002' WHERE plano_conta_id = 19;
UPDATE public.plano_conta SET conta = '2.02.001.003' WHERE plano_conta_id = 20;

-- Despesas Administrativas
UPDATE public.plano_conta SET conta = '2.03.001.001' WHERE plano_conta_id = 22;
UPDATE public.plano_conta SET conta = '2.03.001.002' WHERE plano_conta_id = 23;
UPDATE public.plano_conta SET conta = '2.03.001.003' WHERE plano_conta_id = 24;
UPDATE public.plano_conta SET conta = '2.03.001.004' WHERE plano_conta_id = 25;
UPDATE public.plano_conta SET conta = '2.03.001.005' WHERE plano_conta_id = 26;
UPDATE public.plano_conta SET conta = '2.03.001.006' WHERE plano_conta_id = 27;
UPDATE public.plano_conta SET conta = '2.03.001.007' WHERE plano_conta_id = 28;
UPDATE public.plano_conta SET conta = '2.03.001.008' WHERE plano_conta_id = 29;
UPDATE public.plano_conta SET conta = '2.03.001.009' WHERE plano_conta_id = 30;

-- Despesas com Vendas
UPDATE public.plano_conta SET conta = '2.04.001.001' WHERE plano_conta_id = 32;
UPDATE public.plano_conta SET conta = '2.04.001.002' WHERE plano_conta_id = 33;
UPDATE public.plano_conta SET conta = '2.04.001.003' WHERE plano_conta_id = 34;

-- Despesas Financeiras
UPDATE public.plano_conta SET conta = '2.05.001.001' WHERE plano_conta_id = 36;
UPDATE public.plano_conta SET conta = '2.05.001.002' WHERE plano_conta_id = 37;
UPDATE public.plano_conta SET conta = '2.05.001.003' WHERE plano_conta_id = 38;
UPDATE public.plano_conta SET conta = '2.05.001.004' WHERE plano_conta_id = 39;

-- Impostos
UPDATE public.plano_conta SET conta = '2.06.001.001' WHERE plano_conta_id = 41;
UPDATE public.plano_conta SET conta = '2.06.001.002' WHERE plano_conta_id = 42;
UPDATE public.plano_conta SET conta = '2.06.001.003' WHERE plano_conta_id = 43;
UPDATE public.plano_conta SET conta = '2.06.001.004' WHERE plano_conta_id = 44;

-- Outras Despesas
UPDATE public.plano_conta SET conta = '2.09.001.001' WHERE plano_conta_id = 46;
UPDATE public.plano_conta SET conta = '2.09.001.002' WHERE plano_conta_id = 47;
UPDATE public.plano_conta SET conta = '2.09.001.003' WHERE plano_conta_id = 48;
UPDATE public.plano_conta SET conta = '2.09.001.004' WHERE plano_conta_id = 49;
