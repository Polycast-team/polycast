-- Ensure profiles table exists and has required columns
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add missing columns if they don't exist
-- Ensure id column and PK exist
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS id UUID;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'profiles' AND constraint_type = 'PRIMARY KEY'
  ) THEN
    -- backfill id values if null
    UPDATE profiles SET id = uuid_generate_v4() WHERE id IS NULL;
    ALTER TABLE profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);
  END IF;
END$$;

ALTER TABLE profiles ALTER COLUMN id SET NOT NULL;
ALTER TABLE profiles ALTER COLUMN id SET DEFAULT uuid_generate_v4();

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS native_language TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS target_language TEXT;

-- Basic NOT NULL constraints if possible (skip if existing rows violate)
-- You can enforce later after backfilling: ALTER TABLE ... ALTER COLUMN ... SET NOT NULL;


