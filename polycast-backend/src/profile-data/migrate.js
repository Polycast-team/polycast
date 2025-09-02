const fs = require('fs');
const path = require('path');
const pool = require('./pool');

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const dir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
    for (const f of files) {
      const sql = fs.readFileSync(path.join(dir, f), 'utf8');
      if (sql.trim()) {
        console.log(`[profile-data:migrate] applying ${f}`);
        await client.query(sql);
      }
    }
    await client.query('COMMIT');
    console.log('[profile-data:migrate] done');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[profile-data:migrate] failed', e);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();


