CREATE TABLE IF NOT EXISTS flashcards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  dictionary_entry_id UUID NOT NULL REFERENCES dictionary_entries(id) ON DELETE CASCADE,
  study_interval_level INT NOT NULL DEFAULT 1,
  due_at TIMESTAMPTZ,
  last_reviewed_at TIMESTAMPTZ,
  correct_count INT NOT NULL DEFAULT 0,
  incorrect_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(profile_id, dictionary_entry_id)
);

CREATE INDEX IF NOT EXISTS idx_flashcards_profile_due ON flashcards(profile_id, due_at);


