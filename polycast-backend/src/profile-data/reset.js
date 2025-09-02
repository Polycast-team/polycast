// DANGER: This script deletes ALL data from profile-related tables.
// Intended for one-time use to get a fresh start.
// Run with: node src/profile-data/reset.js

const pool = require('./pool');

async function run() {
  const client = await pool.connect();
  try {
    console.warn('[RESET] About to TRUNCATE tables: flashcards, dictionary_entries, profiles');
    await client.query('BEGIN');
    // Order doesn’t matter with CASCADE, but list children first for clarity
    await client.query('TRUNCATE TABLE flashcards RESTART IDENTITY CASCADE');
    await client.query('TRUNCATE TABLE dictionary_entries RESTART IDENTITY CASCADE');
    await client.query('TRUNCATE TABLE profiles RESTART IDENTITY CASCADE');
    await client.query('COMMIT');
    console.log('[RESET] Done. All profile-related data cleared.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[RESET] Failed:', e);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();


