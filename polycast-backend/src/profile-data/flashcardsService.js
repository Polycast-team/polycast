const pool = require('./pool');

async function ensureFlashcard(profileId, dictionaryEntryId) {
  const sql = `INSERT INTO flashcards(profile_id, dictionary_entry_id)
               VALUES($1,$2)
               ON CONFLICT (profile_id, dictionary_entry_id) DO UPDATE SET updated_at=now()
               RETURNING *`;
  const { rows } = await pool.query(sql, [profileId, dictionaryEntryId]);
  return rows[0];
}

async function listDue(profileId, now = new Date()) {
  const { rows } = await pool.query(
    'SELECT * FROM flashcards WHERE profile_id=$1 AND (due_at IS NULL OR due_at <= $2) ORDER BY due_at NULLS FIRST, updated_at DESC LIMIT 200',
    [profileId, now]
  );
  return rows;
}

async function updateStudyInterval(id, profileId, { studyIntervalLevel, dueAt, correct, incorrect }) {
  const { rows } = await pool.query(
    `UPDATE flashcards
     SET study_interval_level=COALESCE($1, study_interval_level),
         due_at=COALESCE($2, due_at),
         last_reviewed_at=now(),
         correct_count=COALESCE($3, 0) + correct_count,
         incorrect_count=COALESCE($4, 0) + incorrect_count,
         updated_at=now()
     WHERE id=$5 AND profile_id=$6
     RETURNING *`,
    [studyIntervalLevel, dueAt, correct, incorrect, id, profileId]
  );
  return rows[0];
}

module.exports = {
  ensureFlashcard,
  listDue,
  updateStudyInterval,
};


