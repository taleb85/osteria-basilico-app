-- Add requester_email to holiday_requests for automatic reply mailto
ALTER TABLE holiday_requests ADD COLUMN IF NOT EXISTS requester_email text;
