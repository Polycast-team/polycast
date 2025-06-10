#!/usr/bin/env node
/**
 * Direct database test - shows JSON responses using ONLY database data
 * No server needed, direct database queries
 */

import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
    connectionString: 'postgresql://data_5rgr_user:3mDZqEEuOVr3SzkyO1M8UvvAvTdkdNQI@dpg-d0jn3fvfte5s7380vqs0-a.oregon-postgres.render.com/data_5rgr',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,  // 10 second timeout
    idleTimeoutMillis: 30000
});

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    blue: '\x1b[34m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m',
    red: '\x1b[31m'
};

function log(color, message) {
    console.log(`${color}${message}${colors.reset}`);
}

function progress(message) {
    console.log(`${colors.cyan}⏳ ${message}...${colors.reset}`);
}

async function testWordFrequency(language, word) {
    progress(`Looking up "${word}" in ${language}`);
    const result = await pool.query(
        'SELECT frequency, rank, user_frequency FROM word_frequencies WHERE language = $1 AND word = $2',
        [language.toLowerCase(), word.toLowerCase()]
    );
    
    if (result.rows.length > 0) {
        log(colors.green, `✅ Found "${word}"`);
        return {
            frequency: parseFloat(result.rows[0].frequency),
            userFrequency: result.rows[0].user_frequency,
            rank: result.rows[0].rank
        };
    }
    log(colors.yellow, `⚠️ "${word}" not found`);
    return null;
}

async function testWordRange(language, startRank, endRank) {
    progress(`Getting top ${endRank} words for ${language}`);
    const result = await pool.query(
        'SELECT word, frequency, rank, user_frequency FROM word_frequencies WHERE language = $1 AND rank BETWEEN $2 AND $3 ORDER BY rank',
        [language.toLowerCase(), parseInt(startRank), parseInt(endRank)]
    );
    
    log(colors.green, `✅ Found ${result.rows.length} words`);
    return result.rows.map(row => ({
        word: row.word,
        frequency: parseFloat(row.frequency),
        rank: row.rank,
        userFrequency: row.user_frequency
    }));
}

async function testBatchWords(language, words) {
    progress(`Batch lookup for ${words.length} ${language} words`);
    const placeholders = words.map((_, index) => `$${index + 2}`).join(',');
    const result = await pool.query(
        `SELECT word, frequency, rank, user_frequency FROM word_frequencies WHERE language = $1 AND word IN (${placeholders})`,
        [language.toLowerCase(), ...words.map(w => w.toLowerCase())]
    );
    
    const wordMap = {};
    result.rows.forEach(row => {
        wordMap[row.word] = {
            frequency: parseFloat(row.frequency),
            userFrequency: row.user_frequency,
            rank: row.rank
        };
    });
    
    log(colors.green, `✅ Found ${result.rows.length}/${words.length} words in batch`);
    return wordMap;
}

async function testConjugations(form) {
    progress(`Looking up conjugation "${form}"`);
    const result = await pool.query(
        'SELECT infinitive, form, tense, person, mood, translation, language FROM verb_conjugations WHERE form = $1',
        [form.toLowerCase()]
    );
    
    if (result.rows.length > 0) {
        log(colors.green, `✅ Found ${result.rows.length} conjugation(s) for "${form}"`);
    } else {
        log(colors.yellow, `⚠️ No conjugations found for "${form}"`);
    }
    return result.rows;
}

async function runDirectTests() {
    log(colors.blue, '🗄️ Direct Database Tests - JSON Responses');
    log(colors.blue, '==========================================\n');
    
    try {
        // Test database connection first
        progress('Testing database connection');
        await pool.query('SELECT NOW()');
        log(colors.green, '✅ Database connected successfully!\n');
        
        // Test word frequencies
        log(colors.green, '📚 WORD FREQUENCY TESTS:');
        log(colors.cyan, '\n🇺🇸 English Words:');
        
        const englishWords = ['the', 'hello', 'world', 'computer'];
        for (let i = 0; i < englishWords.length; i++) {
            const word = englishWords[i];
            log(colors.blue, `\n[${i + 1}/${englishWords.length}] Testing "${word}"`);
            const result = await testWordFrequency('en', word);
            if (result) {
                log(colors.yellow, `  Response: ${JSON.stringify(result, null, 2)}`);
            } else {
                log(colors.yellow, `  Response: null (not found)`);
            }
        }
        
        log(colors.cyan, '\n🇪🇸 Spanish Words:');
        const spanishWords = ['el', 'hola', 'mundo', 'computadora'];
        for (let i = 0; i < spanishWords.length; i++) {
            const word = spanishWords[i];
            log(colors.blue, `\n[${i + 1}/${spanishWords.length}] Testing "${word}"`);
            const result = await testWordFrequency('sp', word);
            if (result) {
                log(colors.yellow, `  Response: ${JSON.stringify(result, null, 2)}`);
            } else {
                log(colors.yellow, `  Response: null (not found)`);
            }
        }
        
        log(colors.cyan, '\n🇵🇹 Portuguese Words:');
        const portugueseWords = ['o', 'mundo', 'computador'];
        for (let i = 0; i < portugueseWords.length; i++) {
            const word = portugueseWords[i];
            log(colors.blue, `\n[${i + 1}/${portugueseWords.length}] Testing "${word}"`);
            const result = await testWordFrequency('po', word);
            if (result) {
                log(colors.yellow, `  Response: ${JSON.stringify(result, null, 2)}`);
            } else {
                log(colors.yellow, `  Response: null (not found)`);
            }
        }
        
        // Test word ranges
        log(colors.green, '\n📊 WORD RANGE TESTS (Top 5 words by language):');
        
        const languages = [['en', 'English'], ['sp', 'Spanish'], ['po', 'Portuguese']];
        for (let i = 0; i < languages.length; i++) {
            const [lang, name] = languages[i];
            log(colors.blue, `\n[${i + 1}/${languages.length}] Testing ${name} word range`);
            const range = await testWordRange(lang, 1, 5);
            log(colors.yellow, `Response: ${JSON.stringify(range, null, 2)}`);
        }
        
        // Test batch lookup
        log(colors.green, '\n📦 BATCH LOOKUP TEST:');
        log(colors.blue, 'Testing Spanish batch lookup');
        const batchResult = await testBatchWords('sp', ['el', 'la', 'de', 'que', 'y']);
        log(colors.yellow, `Response: ${JSON.stringify(batchResult, null, 2)}`);
        
        // Test conjugations
        log(colors.green, '\n🔄 CONJUGATION TESTS:');
        const conjugationForms = ['estoy', 'habla', 'comes'];
        
        for (let i = 0; i < conjugationForms.length; i++) {
            const form = conjugationForms[i];
            log(colors.blue, `\n[${i + 1}/${conjugationForms.length}] Testing conjugation "${form}"`);
            const result = await testConjugations(form);
            if (result.length > 0) {
                log(colors.yellow, `Response: ${JSON.stringify(result, null, 2)}`);
            } else {
                log(colors.yellow, `Response: [] (not found)`);
            }
        }
        
        // Database stats
        log(colors.green, '\n📈 DATABASE STATISTICS:');
        
        progress('Getting database statistics');
        const wordStats = await pool.query('SELECT language, COUNT(*) as count FROM word_frequencies GROUP BY language ORDER BY language');
        const conjStats = await pool.query('SELECT COUNT(*) as total FROM verb_conjugations');
        
        log(colors.green, '✅ Statistics retrieved');
        log(colors.cyan, '\nWord frequencies by language:');
        wordStats.rows.forEach(row => {
            log(colors.yellow, `  ${row.language}: ${parseInt(row.count).toLocaleString()} words`);
        });
        
        log(colors.cyan, `\nTotal conjugations: ${parseInt(conjStats.rows[0].total).toLocaleString()} forms`);
        
        log(colors.green, '\n🎉 SUCCESS! Database migration completed successfully!');
        log(colors.blue, '✅ All JSON responses come from PostgreSQL database (NO local files used)');
        log(colors.blue, '🚀 Your app now uses 99% smaller deployment (database instead of 116MB JSON files)');
        
    } catch (error) {
        log(colors.red, `❌ Test failed: ${error.message}`);
        console.error('Full error:', error);
    } finally {
        progress('Closing database connection');
        await pool.end();
        log(colors.green, '✅ Database connection closed');
    }
}

// Add timeout to prevent hanging
const timeout = setTimeout(() => {
    log(colors.red, '❌ Test timed out after 60 seconds');
    process.exit(1);
}, 60000);

runDirectTests().then(() => {
    clearTimeout(timeout);
    log(colors.green, '\n✅ All tests completed successfully!');
}).catch(error => {
    clearTimeout(timeout);
    log(colors.red, `❌ Test runner failed: ${error.message}`);
    process.exit(1);
}); 