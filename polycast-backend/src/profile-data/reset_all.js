// DANGER: Drops and recreates the public schema, then runs migrations.
// Use only when you want a brand-new database schema and data.
// Run: node src/profile-data/reset_all.js

const { spawn } = require('child_process');
const pool = require('./pool');

async function resetSchema() {
  const client = await pool.connect();
  try {
    console.warn('[RESET-ALL] Dropping and recreating public schema (CASCADE)');
    await client.query('BEGIN');
    await client.query('DROP SCHEMA IF EXISTS public CASCADE');
    await client.query('CREATE SCHEMA public');
    await client.query('GRANT ALL ON SCHEMA public TO public');
    // Recreate needed extensions
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await client.query('COMMIT');
    console.log('[RESET-ALL] Schema recreated');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[RESET-ALL] Failed to reset schema:', e);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

async function runMigrations() {
  console.log('[RESET-ALL] Running migrations...');
  await new Promise((resolve, reject) => {
    const p = spawn(process.execPath, ['src/profile-data/migrate.js'], {
      stdio: 'inherit',
    });
    p.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error('Migration process exited with code ' + code));
    });
  });
  console.log('[RESET-ALL] Migrations complete');
}

(async () => {
  await resetSchema();
  await runMigrations();
})();


