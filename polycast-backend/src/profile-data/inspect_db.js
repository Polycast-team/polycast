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
      const senses = await pool.query(
        `SELECT id, word, sense_key, study_interval_level, due_at, created_at, gemini_unified_text
         FROM word_senses WHERE profile_id=$1 ORDER BY created_at DESC LIMIT 100`,
        [p.id]
      );
      console.log(`  Word senses (${senses.rowCount}):`);
      senses.rows.forEach(r => {
        console.log(`    • ${r.word} (${r.sense_key}) id=${r.id} level=${r.study_interval_level} due=${r.due_at} created=${r.created_at}`);
        const preview = (r.gemini_unified_text||'').split('\n')[0];
        console.log(`      unified_first_line=${preview}`);
      });
    }
  } catch (e) {
    console.error('inspect_db error:', e);
  } finally {
    await pool.end();
  }
}

run();


