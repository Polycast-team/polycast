-- Ensure profiles table exists and has required columns
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add missing columns if they don't exist
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS native_language TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS target_language TEXT;

-- Basic NOT NULL constraints if possible (skip if existing rows violate)
-- You can enforce later after backfilling: ALTER TABLE ... ALTER COLUMN ... SET NOT NULL;


