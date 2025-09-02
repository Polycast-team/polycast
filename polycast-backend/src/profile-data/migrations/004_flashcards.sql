-- Ensure base table exists
CREATE TABLE IF NOT EXISTS flashcards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
);

-- Ensure required columns exist (idempotent)
ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS profile_id UUID;
ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS dictionary_entry_id UUID;
ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS study_interval_level INT;
ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ;
ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS last_reviewed_at TIMESTAMPTZ;
ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS correct_count INT;
ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS incorrect_count INT;
ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Set defaults where appropriate
ALTER TABLE flashcards ALTER COLUMN study_interval_level SET DEFAULT 1;
ALTER TABLE flashcards ALTER COLUMN correct_count SET DEFAULT 0;
ALTER TABLE flashcards ALTER COLUMN incorrect_count SET DEFAULT 0;
ALTER TABLE flashcards ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE flashcards ALTER COLUMN updated_at SET DEFAULT now();

-- Ensure NOT NULLs where reasonable (skip if incompatible with legacy rows)
-- You may enforce stricter constraints in a later cleanup migration

-- Ensure unique pair (profile_id, dictionary_entry_id)
CREATE UNIQUE INDEX IF NOT EXISTS flashcards_profile_dict_uniq
  ON flashcards(profile_id, dictionary_entry_id);

-- Ensure FKs exist (use DO blocks for idempotency)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'flashcards' AND constraint_type = 'FOREIGN KEY' AND constraint_name = 'flashcards_profile_fk'
  ) THEN
    ALTER TABLE flashcards
      ADD CONSTRAINT flashcards_profile_fk FOREIGN KEY (profile_id)
      REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'flashcards' AND constraint_type = 'FOREIGN KEY' AND constraint_name = 'flashcards_dict_fk'
  ) THEN
    ALTER TABLE flashcards
      ADD CONSTRAINT flashcards_dict_fk FOREIGN KEY (dictionary_entry_id)
      REFERENCES dictionary_entries(id) ON DELETE CASCADE;
  END IF;
END$$;

-- Helpful index
CREATE INDEX IF NOT EXISTS idx_flashcards_profile_due ON flashcards(profile_id, due_at);


