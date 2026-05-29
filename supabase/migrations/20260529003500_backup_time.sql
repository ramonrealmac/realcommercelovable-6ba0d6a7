-- Add backup_time, system_folder_path, and supabase_folder_path columns to sys_config table
ALTER TABLE sys_config ADD COLUMN IF NOT EXISTS backup_time TEXT NOT NULL DEFAULT '03:00';
ALTER TABLE sys_config ADD COLUMN IF NOT EXISTS system_folder_path TEXT NOT NULL DEFAULT '';
ALTER TABLE sys_config ADD COLUMN IF NOT EXISTS supabase_folder_path TEXT NOT NULL DEFAULT '';
