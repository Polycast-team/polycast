-- Table to enforce global uniqueness of generated practice sentences
CREATE TABLE IF NOT EXISTS practice_sentences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sentence TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique index on lowercase sentence to prevent duplicates differing only by case/spacing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'uniq_practice_sentences_lower_sentence'
  ) THEN
    CREATE UNIQUE INDEX uniq_practice_sentences_lower_sentence
      ON practice_sentences ((lower(trim(both FROM sentence))));
  END IF;
END$$;


