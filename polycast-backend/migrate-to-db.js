#!/usr/bin/env node
/**
 * Migration script to move JSON data to PostgreSQL database
 * Run with: npm run migrate
 */

import pkg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const { Pool } = pkg;

// Setup __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://data_5rgr_user:3mDZqEEuOVr3SzkyO1M8UvvAvTdkdNQI@dpg-d0jn3fvfte5s7380vqs0-a.oregon-postgres.render.com/data_5rgr',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000
});

async function createTables() {
    console.log('🏗️ Creating database tables...');
    
    try {
        // Create word_frequencies table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS word_frequencies (
                id SERIAL PRIMARY KEY,
                language VARCHAR(10) NOT NULL,
                word VARCHAR(100) NOT NULL,
                frequency DECIMAL(4,2) NOT NULL,
                rank INTEGER NOT NULL,
                user_frequency INTEGER NOT NULL,
                tier VARCHAR(20) NOT NULL,
                UNIQUE(language, word)
            )
        `);

        // Create verb_conjugations table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS verb_conjugations (
                id SERIAL PRIMARY KEY,
                infinitive VARCHAR(200) NOT NULL,
                form VARCHAR(200) NOT NULL,
                tense VARCHAR(100),
                person VARCHAR(50),
                language VARCHAR(10) DEFAULT 'es'
            )
        `);

        // Create indexes for performance
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_word_freq_lang_word ON word_frequencies(language, word)
        `);
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_word_freq_lang_rank ON word_frequencies(language, rank)
        `);
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_conjugations_form ON verb_conjugations(form)
        `);

        console.log('✅ Database tables created successfully');
    } catch (error) {
        console.error('❌ Error creating database tables:', error);
        throw error;
    }
}

async function migrateTierData() {
    console.log('🚀 Starting wordfreq data migration...');
    
    const languages = ['english', 'spanish', 'portuguese'];
    const tiers = ['core', 'extended', 'complete'];
    
    let totalWords = 0;
    
    try {
        // Clear existing data
        console.log('🧹 Clearing existing word frequency data...');
        await pool.query('DELETE FROM word_frequencies');
        
        for (const language of languages) {
            const langCode = language.substring(0, 2); // en, es, pt
            console.log(`\n📚 Processing ${language} (${langCode})...`);
            
            for (const tier of tiers) {
                const filePath = path.join(__dirname, '..', 'polycast-frontend', 'public', 'wordfreq-tiers', `${language}-${tier}.json`);
                
                if (!fs.existsSync(filePath)) {
                    console.log(`⚠️ File not found: ${filePath}`);
                    continue;
                }
                
                console.log(`  📥 Loading ${tier} tier...`);
                
                try {
                    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                    
                    if (data.lookup) {
                        // New format with lookup object
                        const entries = Object.entries(data.lookup);
                        console.log(`    Processing ${entries.length} words...`);
                        
                        // Batch insert for better performance
                        const batchSize = 1000;
                        for (let i = 0; i < entries.length; i += batchSize) {
                            const batch = entries.slice(i, i + batchSize);
                            
                            const values = [];
                            const placeholders = [];
                            let paramIndex = 1;
                            
                            batch.forEach(([word, wordData]) => {
                                const typedWordData = wordData;
                                placeholders.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5})`);
                                values.push(
                                    langCode,
                                    word.toLowerCase(),
                                    typedWordData.frequency,
                                    typedWordData.rank,
                                    typedWordData.user_frequency,
                                    tier
                                );
                                paramIndex += 6;
                            });
                            
                            if (values.length > 0) {
                                const query = `
                                    INSERT INTO word_frequencies (language, word, frequency, rank, user_frequency, tier)
                                    VALUES ${placeholders.join(', ')}
                                    ON CONFLICT (language, word) DO NOTHING
                                `;
                                
                                await pool.query(query, values);
                                console.log(`    ✅ Inserted batch ${Math.floor(i / batchSize) + 1} (${batch.length} words)`);
                            }
                        }
                        
                        totalWords += entries.length;
                        console.log(`    ✅ Completed ${tier} tier: ${entries.length} words`);
                        
                    } else {
                        console.log(`    ⚠️ Old format detected, skipping ${tier} tier`);
                    }
                    
                } catch (error) {
                    console.error(`    ❌ Error processing ${tier} tier:`, error.message);
                }
            }
        }
        
        console.log(`\n✅ Migration complete! Total words migrated: ${totalWords.toLocaleString()}`);
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    }
}

async function migrateConjugationData() {
    console.log('\n🔄 Starting conjugation data migration...');
    
    const conjugationFile = path.join(__dirname, '..', 'polycast-frontend', 'public', 'Conjugations', 'Spanish', 'Spanish Conjugations.json');
    
    if (!fs.existsSync(conjugationFile)) {
        console.log('⚠️ Spanish conjugations file not found, skipping...');
        return;
    }
    
    try {
        // Clear existing conjugation data
        console.log('🧹 Clearing existing conjugation data...');
        await pool.query('DELETE FROM verb_conjugations');
        
        console.log('📥 Loading Spanish conjugations...');
        const data = JSON.parse(fs.readFileSync(conjugationFile, 'utf8'));
        
        let totalConjugations = 0;
        const batchSize = 1000;
        let batch = [];
        
        // Process conjugation data
        for (const [infinitive, conjugationData] of Object.entries(data)) {
            if (typeof conjugationData === 'object' && conjugationData !== null) {
                for (const [tense, tenseData] of Object.entries(conjugationData)) {
                    if (typeof tenseData === 'object' && tenseData !== null) {
                        for (const [person, form] of Object.entries(tenseData)) {
                            if (typeof form === 'string' && form.trim() !== '') {
                                batch.push({
                                    infinitive: infinitive,
                                    form: form.toLowerCase(),
                                    tense: tense,
                                    person: person,
                                    language: 'es'
                                });
                                
                                if (batch.length >= batchSize) {
                                    await insertConjugationBatch(batch);
                                    totalConjugations += batch.length;
                                    console.log(`    ✅ Inserted ${totalConjugations.toLocaleString()} conjugations...`);
                                    batch = [];
                                }
                            }
                        }
                    }
                }
            }
        }
        
        // Insert remaining batch
        if (batch.length > 0) {
            await insertConjugationBatch(batch);
            totalConjugations += batch.length;
        }
        
        console.log(`✅ Conjugation migration complete! Total conjugations: ${totalConjugations.toLocaleString()}`);
        
    } catch (error) {
        console.error('❌ Conjugation migration failed:', error);
        throw error;
    }
}

async function insertConjugationBatch(batch) {
    const values = [];
    const placeholders = [];
    let paramIndex = 1;
    
    batch.forEach(conj => {
        placeholders.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4})`);
        values.push(
            conj.infinitive,
            conj.form,
            conj.tense,
            conj.person,
            conj.language
        );
        paramIndex += 5;
    });
    
    const query = `
        INSERT INTO verb_conjugations (infinitive, form, tense, person, language)
        VALUES ${placeholders.join(', ')}
    `;
    
    await pool.query(query, values);
}

async function checkMigrationResults() {
    console.log('\n📊 Checking migration results...');
    
    try {
        // Check word frequencies
        const wordCountResult = await pool.query('SELECT language, COUNT(*) as count FROM word_frequencies GROUP BY language ORDER BY language');
        console.log('\nWord frequencies by language:');
        wordCountResult.rows.forEach(row => {
            console.log(`  ${row.language}: ${parseInt(row.count).toLocaleString()} words`);
        });
        
        const totalWords = await pool.query('SELECT COUNT(*) as total FROM word_frequencies');
        console.log(`  Total: ${parseInt(totalWords.rows[0].total).toLocaleString()} words`);
        
        // Check conjugations
        const conjugationCount = await pool.query('SELECT COUNT(*) as total FROM verb_conjugations');
        console.log(`\nConjugations: ${parseInt(conjugationCount.rows[0].total).toLocaleString()} forms`);
        
        // Sample lookups
        console.log('\n🔍 Sample lookups:');
        const sampleWord = await pool.query('SELECT * FROM word_frequencies WHERE word = $1 AND language = $2', ['hello', 'en']);
        if (sampleWord.rows.length > 0) {
            const word = sampleWord.rows[0];
            console.log(`  "hello" (en): frequency=${word.frequency}, rank=${word.rank}, user_frequency=${word.user_frequency}`);
        }
        
        const sampleConjugation = await pool.query('SELECT * FROM verb_conjugations WHERE form = $1 LIMIT 1', ['habla']);
        if (sampleConjugation.rows.length > 0) {
            const conj = sampleConjugation.rows[0];
            console.log(`  "habla": infinitive=${conj.infinitive}, tense=${conj.tense}, person=${conj.person}`);
        }
        
    } catch (error) {
        console.error('❌ Error checking results:', error);
    }
}

async function main() {
    console.log('🗄️ Database Migration Script');
    console.log('============================');
    
    try {
        // Test database connection
        await pool.query('SELECT NOW()');
        console.log('✅ Database connection successful');
        
        // Run migrations
        await createTables();
        await migrateTierData();
        await migrateConjugationData();
        await checkMigrationResults();
        
        console.log('\n🎉 Migration completed successfully!');
        console.log('You can now remove the JSON files from public/ directory to save space.');
        
    } catch (error) {
        console.error('\n❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Run migration if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

// Also run main() directly for testing
main().catch(console.error); 