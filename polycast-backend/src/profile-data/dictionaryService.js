const pool = require('./pool');

async function listEntries(profileId) {
  const { rows } = await pool.query(
    'SELECT id, word, word_sense_id, translation, definition, frequency, example_sentences_generated, example_for_dictionary, contextual_explanation, in_flashcards, created_at, updated_at FROM dictionary_entries WHERE profile_id=$1 ORDER BY word ASC, updated_at DESC',
    [profileId]
  );
  return rows;
}

async function createEntry(profileId, entry) {
  const {
    word,
    wordSenseId,
    translation,
    definition,
    frequency,
    exampleSentencesGenerated,
    exampleForDictionary,
    contextualExplanation,
    rawUnifiedJson,
    inFlashcards = true,
  } = entry;
  const sql = `INSERT INTO dictionary_entries (
      profile_id, word, word_sense_id, translation, definition, frequency,
      example_sentences_generated, example_for_dictionary, contextual_explanation,
      raw_unified_json, in_flashcards
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    ON CONFLICT (profile_id, word_sense_id) DO UPDATE SET
      translation=EXCLUDED.translation,
      definition=EXCLUDED.definition,
      frequency=EXCLUDED.frequency,
      example_sentences_generated=EXCLUDED.example_sentences_generated,
      example_for_dictionary=EXCLUDED.example_for_dictionary,
      contextual_explanation=EXCLUDED.contextual_explanation,
      raw_unified_json=EXCLUDED.raw_unified_json,
      in_flashcards=EXCLUDED.in_flashcards,
      updated_at=now()
    RETURNING id, word, word_sense_id, translation, definition, frequency, example_sentences_generated, example_for_dictionary, contextual_explanation, in_flashcards, created_at, updated_at`;
  const { rows } = await pool.query(sql, [
    profileId,
    word,
    wordSenseId,
    translation,
    definition,
    frequency,
    exampleSentencesGenerated,
    exampleForDictionary,
    contextualExplanation,
    rawUnifiedJson,
    inFlashcards,
  ]);
  return rows[0];
}

async function deleteEntry(profileId, id) {
  const { rowCount } = await pool.query('DELETE FROM dictionary_entries WHERE id=$1 AND profile_id=$2', [id, profileId]);
  return rowCount > 0;
}

module.exports = {
  listEntries,
  createEntry,
  deleteEntry,
};


