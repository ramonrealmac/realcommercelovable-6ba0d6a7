-- Excluir os registros filhos primeiro para evitar erros de restrição de chave estrangeira (caso ON DELETE CASCADE não esteja configurado)
DELETE FROM fiscal_mdf_veiculo
WHERE mdf_manifesto_id IN (
    SELECT mdf_manifesto_id FROM fiscal_mdf_manifesto WHERE numero >= 5 AND numero <= 10
);

DELETE FROM fiscal_mdf_condutor
WHERE mdf_manifesto_id IN (
    SELECT mdf_manifesto_id FROM fiscal_mdf_manifesto WHERE numero >= 5 AND numero <= 10
);

DELETE FROM fiscal_mdf_documento
WHERE mdf_manifesto_id IN (
    SELECT mdf_manifesto_id FROM fiscal_mdf_manifesto WHERE numero >= 5 AND numero <= 10
);

DELETE FROM fiscal_mdf_carrega
WHERE mdf_manifesto_id IN (
    SELECT mdf_manifesto_id FROM fiscal_mdf_manifesto WHERE numero >= 5 AND numero <= 10
);

DELETE FROM fiscal_mdf_descarrega
WHERE mdf_manifesto_id IN (
    SELECT mdf_manifesto_id FROM fiscal_mdf_manifesto WHERE numero >= 5 AND numero <= 10
);

-- Agora excluir os MDF-es
DELETE FROM fiscal_mdf_manifesto
WHERE numero >= 5 AND numero <= 10;

-- Voltar o sequencial no config_nfe e no fiscal_config_item (que é o que a tela de MDF-e lê)
UPDATE config_nfe SET n_mdfe = 2;

UPDATE fiscal_config_item
SET sequencia = COALESCE((SELECT MAX(numero) FROM fiscal_mdf_manifesto WHERE empresa_id = fiscal_config_item.empresa_id AND numero < 900), 0) + 1
WHERE modelo = '58';
