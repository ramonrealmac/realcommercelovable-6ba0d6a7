-- Add tipo_antecipacao column to operadora table
ALTER TABLE operadora ADD COLUMN IF NOT EXISTS tipo_antecipacao VARCHAR(50) DEFAULT 'SEM ANTECIPAÇÃO';
