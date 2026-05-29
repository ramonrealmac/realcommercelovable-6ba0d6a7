-- Create sys_config table for database connection details and backup parameters
CREATE TABLE IF NOT EXISTS sys_config (
    id UUID PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
    db_server_host TEXT NOT NULL DEFAULT 'localhost',
    db_server_port TEXT NOT NULL DEFAULT '5432',
    db_name TEXT NOT NULL DEFAULT 'postgres',
    db_port TEXT NOT NULL DEFAULT '5432',
    db_version TEXT NOT NULL DEFAULT '1.15.0',
    backup_folder_path TEXT NOT NULL DEFAULT '',
    backup_periodicity TEXT NOT NULL DEFAULT 'manual',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    -- Constraint to enforce a single settings row
    CONSTRAINT only_one_row CHECK (id = '00000000-0000-0000-0000-000000000000'::uuid)
);

-- Create sys_backup_log table for tracking backup histories
CREATE TABLE IF NOT EXISTS sys_backup_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    backup_type TEXT NOT NULL, -- 'system' or 'database'
    status TEXT NOT NULL,      -- 'success', 'failed', 'pending', 'in_progress'
    file_name TEXT,
    file_size_bytes BIGINT,
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Index for querying backup logs by type and completion date
CREATE INDEX IF NOT EXISTS idx_sys_backup_log_type_completed 
ON sys_backup_log (backup_type, completed_at DESC);

-- Enable RLS (Row Level Security) if needed or just keep open for admin
ALTER TABLE sys_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE sys_backup_log ENABLE ROW LEVEL SECURITY;

-- Simple policies (allow all authenticated/admin actions or anonymous in local mode)
CREATE POLICY "Allow read/write sys_config for all users" ON sys_config 
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow read/write sys_backup_log for all users" ON sys_backup_log 
    FOR ALL USING (true) WITH CHECK (true);

-- Insert initial default configuration row
INSERT INTO sys_config (id, db_server_host, db_server_port, db_name, db_port, db_version, backup_folder_path, backup_periodicity)
VALUES ('00000000-0000-0000-0000-000000000000'::uuid, 'localhost', '5432', 'postgres', '5432', '1.15.0', '', 'manual')
ON CONFLICT (id) DO NOTHING;
