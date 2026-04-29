-- Enable Row Level Security for the 'banco' table
ALTER TABLE "public"."banco" ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to prevent conflicts
DROP POLICY IF EXISTS "Auth can read banco" ON public.banco;
DROP POLICY IF EXISTS "Auth can insert banco" ON public.banco;
DROP POLICY IF EXISTS "Auth can update banco" ON public.banco;

-- Policy: Allow authenticated users to select from 'banco'
CREATE POLICY "Auth can read banco" ON public.banco 
FOR SELECT TO authenticated USING (true);

-- Policy: Allow authenticated users to insert into 'banco'
CREATE POLICY "Auth can insert banco" ON public.banco 
FOR INSERT TO authenticated WITH CHECK (true);

-- Policy: Allow authenticated users to update 'banco'
CREATE POLICY "Auth can update banco" ON public.banco 
FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
