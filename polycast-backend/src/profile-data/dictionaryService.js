const pool = require('./pool');

async function listEntries(profileId) {
  const { rows } = await pool.query(
    `SELECT id, word, sense_key, gemini_unified_text, gemini_unified_json,
            study_interval_level, due_at, created_at, updated_at
     FROM word_senses
     WHERE profile_id=$1
     ORDER BY word ASC, updated_at DESC`,
    [profileId]
  );
  return rows;
}

async function createEntry(profileId, entry) {
  const {
    word,
    senseKey,
    geminiUnifiedText,
    geminiUnifiedJson,
    studyIntervalLevel = 1,
    dueAt = null,
  } = entry;
  const sql = `INSERT INTO word_senses (
      profile_id, word, sense_key, gemini_unified_text, gemini_unified_json, study_interval_level, due_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7)
    ON CONFLICT (profile_id, sense_key) DO UPDATE SET
      gemini_unified_text=EXCLUDED.gemini_unified_text,
      gemini_unified_json=EXCLUDED.gemini_unified_json,
      updated_at=now()
    RETURNING id, word, sense_key, gemini_unified_text, gemini_unified_json, study_interval_level, due_at, created_at, updated_at`;
  const { rows } = await pool.query(sql, [
    profileId,
    word,
    senseKey,
    geminiUnifiedText,
    geminiUnifiedJson,
    studyIntervalLevel,
    dueAt,
  ]);
  return rows[0];
}

async function deleteEntry(profileId, id) {
  const { rowCount } = await pool.query('DELETE FROM word_senses WHERE id=$1 AND profile_id=$2', [id, profileId]);
  return rowCount > 0;
}

async function updateSrs(profileId, id, { studyIntervalLevel, dueAt }) {
  const { rows } = await pool.query(
    `UPDATE word_senses
     SET study_interval_level=COALESCE($1, study_interval_level),
         due_at=COALESCE($2, due_at),
         updated_at=now()
     WHERE id=$3 AND profile_id=$4
     RETURNING id, word, sense_key, gemini_unified_text, gemini_unified_json, study_interval_level, due_at, created_at, updated_at`,
    [studyIntervalLevel, dueAt, id, profileId]
  );
  return rows[0];
}

module.exports = {
  listEntries,
  createEntry,
  deleteEntry,
  updateSrs,
};


