-- Add reason column to holiday_requests for optional motivation (e.g. "Visita medica", "Ferie estive")
ALTER TABLE holiday_requests ADD COLUMN IF NOT EXISTS reason text;
