-- Add proficiency level to profiles (1-5), default existing to 3
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS proficiency_level INT NOT NULL DEFAULT 3;

-- Ensure value is within 1..5 by constraint (if not already present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_proficiency_level_chk'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_proficiency_level_chk CHECK (proficiency_level BETWEEN 1 AND 5);
  END IF;
END$$;


