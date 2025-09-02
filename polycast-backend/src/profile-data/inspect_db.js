require('dotenv').config();
const pool = require('./pool');

async function run() {
  try {
    console.log('Database URL (redacted):', (process.env.DATABASE_URL || '').replace(/:[^:@/]+@/, '://****@'));
    const profiles = await pool.query(
      `SELECT id, username, native_language, target_language, created_at, updated_at FROM profiles ORDER BY created_at DESC`
    );
    console.log(`\nProfiles (${profiles.rowCount}):`);
    for (const p of profiles.rows) {
      console.log(`- ${p.username} [${p.id}] native=${p.native_language} target=${p.target_language} created=${p.created_at}`);
      const dict = await pool.query(
        `SELECT id, word, word_sense_id, translation, definition, frequency, example_sentences_generated, example_for_dictionary, contextual_explanation, in_flashcards, created_at, raw_unified_json
         FROM dictionary_entries WHERE profile_id=$1 ORDER BY created_at DESC LIMIT 50`,
        [p.id]
      );
      console.log(`  Dictionary entries (${dict.rowCount}):`);
      dict.rows.forEach(r => {
        console.log(`    • ${r.word} (${r.word_sense_id}) id=${r.id} in_flashcards=${r.in_flashcards} created=${r.created_at}`);
        console.log(`      definition=${(r.definition||'').slice(0,160)}`);
        console.log(`      example_for_dictionary=${(r.example_for_dictionary||'').slice(0,160)}`);
        console.log(`      frequency=${r.frequency} translation=${(r.translation||'').slice(0,80)}`);
        if (r.raw_unified_json) {
          try {
            const preview = JSON.stringify(r.raw_unified_json).slice(0,200);
            console.log(`      raw_unified_json=${preview}${preview.length===200?'...':''}`);
          } catch (_) {}
        }
      });
      const cards = await pool.query(
        `SELECT id, dictionary_entry_id, study_interval_level, due_at, correct_count, incorrect_count FROM flashcards WHERE profile_id=$1 ORDER BY updated_at DESC LIMIT 50`,
        [p.id]
      );
      console.log(`  Flashcards (${cards.rowCount}):`);
      cards.rows.forEach(c => {
        console.log(`    • id=${c.id} dict=${c.dictionary_entry_id} level=${c.study_interval_level} due=${c.due_at} correct=${c.correct_count} incorrect=${c.incorrect_count}`);
      });
    }
  } catch (e) {
    console.error('inspect_db error:', e);
  } finally {
    await pool.end();
  }
}

run();


