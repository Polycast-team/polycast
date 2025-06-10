import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
    connectionString: 'postgresql://data_5rgr_user:3mDZqEEuOVr3SzkyO1M8UvvAvTdkdNQI@dpg-d0jn3fvfte5s7380vqs0-a.oregon-postgres.render.com/data_5rgr',
    ssl: { rejectUnauthorized: false }
});

async function addColumns() {
    try {
        console.log('Adding mood column...');
        await pool.query('ALTER TABLE verb_conjugations ADD COLUMN IF NOT EXISTS mood VARCHAR(100)');
        console.log('Adding translation column...');
        await pool.query('ALTER TABLE verb_conjugations ADD COLUMN IF NOT EXISTS translation VARCHAR(200)');
        console.log('✅ Columns added successfully');
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

addColumns(); 