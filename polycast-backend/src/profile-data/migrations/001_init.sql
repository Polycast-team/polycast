CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Base profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  native_language TEXT NOT NULL,
  target_language TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles (username);

-- New consolidated word_senses table (replaces dictionary_entries + flashcards)
CREATE TABLE IF NOT EXISTS word_senses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  word TEXT NOT NULL,
  sense_key TEXT NOT NULL, -- unique per profile (formerly word_sense_id)
  gemini_unified_text TEXT NOT NULL, -- exact raw 7-line Gemini response
  gemini_unified_json JSONB,         -- optional parsed representation for UI convenience
  study_interval_level INT NOT NULL DEFAULT 1,
  due_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(profile_id, sense_key)
);

CREATE INDEX IF NOT EXISTS idx_word_senses_profile_word ON word_senses(profile_id, word);
CREATE INDEX IF NOT EXISTS idx_word_senses_profile_due ON word_senses(profile_id, due_at);

