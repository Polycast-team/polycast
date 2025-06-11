import pkg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const { Pool } = pkg;

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env.local') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
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