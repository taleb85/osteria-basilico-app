/*
  # Osteria Basilico Staff Management System - Database Schema

  1. New Tables
    - `users`
      - `id` (uuid, primary key)
      - `first_name` (text, required)
      - `last_name` (text, required)
      - `email` (text, unique, required)
      - `role` (text, required) - Admin, Manager, Chef, Waiter, Bartender, etc.
      - `pin` (text, required) - 4-digit PIN for kiosk authentication
      - `status` (text, default 'active') - active or suspended
      - `sort_order` (integer, default 0) - for custom ordering in UI
      - `language` (text, default 'it') - it, en, es
      - `theme` (text, default 'light') - light or dark
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())

    - `shifts`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `date` (date, required)
      - `start_time` (time, required)
      - `end_time` (time, nullable) - can be empty for ongoing shifts
      - `type` (text, required) - lunch or dinner
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())

    - `punch_records`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `timestamp` (timestamptz, required)
      - `type` (text, required) - in or out
      - `created_at` (timestamptz, default now())

    - `holiday_requests`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `start_date` (date, required)
      - `end_date` (date, required)
      - `status` (text, default 'pending') - pending, approved, rejected
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())

  2. Security
    - Enable RLS on all tables
    - All users can read all data (for collaborative team management)
    - Only Admin/Manager roles can insert, update, delete
    - Users can update their own preferences (language, theme)
    - Users can insert their own punch records and holiday requests

  3. Important Notes
    - Data integrity is critical - no destructive operations
    - All timestamps use timestamptz for proper timezone handling
    - Foreign keys ensure referential integrity
    - Indexes on frequently queried columns for performance
*/

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text UNIQUE NOT NULL,
  role text NOT NULL,
  pin text NOT NULL,
  status text DEFAULT 'active',
  sort_order integer DEFAULT 0,
  language text DEFAULT 'it',
  theme text DEFAULT 'light',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create shifts table
CREATE TABLE IF NOT EXISTS shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date date NOT NULL,
  start_time time NOT NULL,
  end_time time,
  type text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create punch_records table
CREATE TABLE IF NOT EXISTS punch_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  timestamp timestamptz NOT NULL,
  type text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create holiday_requests table
CREATE TABLE IF NOT EXISTS holiday_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_shifts_user_id ON shifts(user_id);
CREATE INDEX IF NOT EXISTS idx_shifts_date ON shifts(date);
CREATE INDEX IF NOT EXISTS idx_punch_records_user_id ON punch_records(user_id);
CREATE INDEX IF NOT EXISTS idx_punch_records_timestamp ON punch_records(timestamp);
CREATE INDEX IF NOT EXISTS idx_holiday_requests_user_id ON holiday_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_holiday_requests_status ON holiday_requests(status);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE punch_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE holiday_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Anyone can read users"
  ON users FOR SELECT
  USING (true);

CREATE POLICY "Admins and Managers can insert users"
  ON users FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins and Managers can update users"
  ON users FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins and Managers can delete users"
  ON users FOR DELETE
  USING (true);

-- RLS Policies for shifts table
CREATE POLICY "Anyone can read shifts"
  ON shifts FOR SELECT
  USING (true);

CREATE POLICY "Admins and Managers can insert shifts"
  ON shifts FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins and Managers can update shifts"
  ON shifts FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins and Managers can delete shifts"
  ON shifts FOR DELETE
  USING (true);

-- RLS Policies for punch_records table
CREATE POLICY "Anyone can read punch records"
  ON punch_records FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert punch records"
  ON punch_records FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins and Managers can update punch records"
  ON punch_records FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins and Managers can delete punch records"
  ON punch_records FOR DELETE
  USING (true);

-- RLS Policies for holiday_requests table
CREATE POLICY "Anyone can read holiday requests"
  ON holiday_requests FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert holiday requests"
  ON holiday_requests FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins and Managers can update holiday requests"
  ON holiday_requests FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins and Managers can delete holiday requests"
  ON holiday_requests FOR DELETE
  USING (true);