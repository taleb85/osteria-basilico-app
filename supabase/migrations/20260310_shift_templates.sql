-- Run this SQL in the Supabase SQL Editor to enable Week Templates
-- Table: shift_templates
CREATE TABLE IF NOT EXISTS public.shift_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,          -- e.g. "default"
  data        jsonb NOT NULL DEFAULT '[]',   -- array of template entries
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- Allow all authenticated users to read templates
ALTER TABLE public.shift_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read"
  ON public.shift_templates FOR SELECT
  TO authenticated USING (true);

-- Only managers/admins can write templates (adjust based on your RLS setup)
CREATE POLICY "Allow authenticated write"
  ON public.shift_templates FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- Auto-update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_shift_templates_updated_at
  BEFORE UPDATE ON public.shift_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
