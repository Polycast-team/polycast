CREATE TABLE IF NOT EXISTS dictionary_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  word TEXT NOT NULL,
  word_sense_id TEXT NOT NULL,
  translation TEXT,
  definition TEXT,
  frequency INT,
  example_sentences_generated TEXT,
  example_for_dictionary TEXT,
  contextual_explanation TEXT,
  raw_unified_json JSONB,
  in_flashcards BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(profile_id, word_sense_id)
);

CREATE INDEX IF NOT EXISTS idx_dictionary_entries_profile_id ON dictionary_entries(profile_id);
CREATE INDEX IF NOT EXISTS idx_dictionary_entries_profile_word ON dictionary_entries(profile_id, word);


