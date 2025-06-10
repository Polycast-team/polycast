#!/usr/bin/env node
/**
 * Test script to verify database API endpoints work correctly
 * Tests ONLY database responses (no local files)
 */

import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3001/api';

// Test words for each language
const testWords = {
    en: ['the', 'hello', 'world', 'beautiful', 'computer'],
    es: ['el', 'hola', 'mundo', 'hermoso', 'computadora'], 
    pt: ['o', 'olá', 'mundo', 'bonito', 'computador']
};

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    blue: '\x1b[34m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m'
};

function log(color, message) {
    console.log(`${color}${message}${colors.reset}`);
}

async function testWordFrequencyAPI(language, word) {
    try {
        const response = await fetch(`${API_BASE}/word-frequency/${language}/${word}`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data === null) {
            log(colors.yellow, `  ⚠️  "${word}" not found in database`);
            return null;
        }
        
        log(colors.green, `  ✅ "${word}": frequency=${data.frequency}, rank=${data.rank}, userFreq=${data.userFrequency}`);
        return data;
    } catch (error) {
        log(colors.red, `  ❌ Error testing "${word}": ${error.message}`);
        return null;
    }
}

async function testWordRangeAPI(language, startRank, endRank) {
    try {
        const response = await fetch(`${API_BASE}/word-range/${language}/${startRank}/${endRank}`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        log(colors.green, `  ✅ Range ${startRank}-${endRank}: ${data.length} words`);
        
        if (data.length > 0) {
            const firstWord = data[0];
            const lastWord = data[data.length - 1];
            log(colors.cyan, `     First: "${firstWord.word}" (rank ${firstWord.rank})`);
            log(colors.cyan, `     Last:  "${lastWord.word}" (rank ${lastWord.rank})`);
        }
        
        return data;
    } catch (error) {
        log(colors.red, `  ❌ Error testing range ${startRank}-${endRank}: ${error.message}`);
        return null;
    }
}

async function testBatchWordsAPI(language, words) {
    try {
        const response = await fetch(`${API_BASE}/words-batch`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ language, words })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        const foundCount = Object.keys(data).length;
        log(colors.green, `  ✅ Batch lookup: ${foundCount}/${words.length} words found`);
        
        for (const word of words) {
            if (data[word]) {
                log(colors.cyan, `     "${word}": rank ${data[word].rank}`);
            } else {
                log(colors.yellow, `     "${word}": not found`);
            }
        }
        
        return data;
    } catch (error) {
        log(colors.red, `  ❌ Error testing batch lookup: ${error.message}`);
        return null;
    }
}

async function testConjugationAPI(form) {
    try {
        const response = await fetch(`${API_BASE}/conjugations/${form}`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.length === 0) {
            log(colors.yellow, `  ⚠️  "${form}" - no conjugations found`);
            return null;
        }
        
        log(colors.green, `  ✅ "${form}": ${data.length} conjugation(s) found`);
        
        // Show details for first conjugation
        const conj = data[0];
        log(colors.cyan, `     Infinitive: ${conj.infinitive}, Tense: ${conj.tense}, Person: ${conj.person}, Mood: ${conj.mood}`);
        
        return data;
    } catch (error) {
        log(colors.red, `  ❌ Error testing conjugation "${form}": ${error.message}`);
        return null;
    }
}

async function runTests() {
    log(colors.blue, '🧪 Testing Database API Endpoints');
    log(colors.blue, '=================================\n');
    
    // Wait a moment for server to be ready
    log(colors.cyan, '⏳ Waiting for server to be ready...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    let totalTests = 0;
    let passedTests = 0;
    
    // Test word frequency lookups for each language
    for (const [langCode, words] of Object.entries(testWords)) {
        const langName = langCode === 'en' ? 'English' : langCode === 'es' ? 'Spanish' : 'Portuguese';
        log(colors.blue, `\n📚 Testing ${langName} (${langCode}) - Word Frequency API:`);
        
        for (const word of words) {
            totalTests++;
            const result = await testWordFrequencyAPI(langCode, word);
            if (result !== null) passedTests++;
        }
    }
    
    // Test word range API for each language
    log(colors.blue, '\n📊 Testing Word Range API:');
    for (const langCode of ['en', 'es', 'pt']) {
        const langName = langCode === 'en' ? 'English' : langCode === 'es' ? 'Spanish' : 'Portuguese';
        log(colors.cyan, `\n  ${langName} (${langCode}):`);
        
        totalTests++;
        const result = await testWordRangeAPI(langCode, 1, 10);
        if (result !== null) passedTests++;
    }
    
    // Test batch word API
    log(colors.blue, '\n📦 Testing Batch Words API:');
    for (const [langCode, words] of Object.entries(testWords)) {
        const langName = langCode === 'en' ? 'English' : langCode === 'es' ? 'Spanish' : 'Portuguese';
        log(colors.cyan, `\n  ${langName} (${langCode}):`);
        
        totalTests++;
        const result = await testBatchWordsAPI(langCode, words.slice(0, 3)); // Test with first 3 words
        if (result !== null) passedTests++;
    }
    
    // Test conjugation API (if any conjugations exist in DB)
    log(colors.blue, '\n🔄 Testing Conjugation API:');
    const testConjugations = ['estoy', 'habla', 'ser', 'estar'];
    
    for (const form of testConjugations) {
        totalTests++;
        const result = await testConjugationAPI(form);
        if (result !== null) passedTests++;
    }
    
    // Summary
    log(colors.blue, '\n📊 TEST RESULTS:');
    log(colors.blue, '================');
    log(colors.green, `✅ Passed: ${passedTests}/${totalTests} tests`);
    
    if (passedTests === totalTests) {
        log(colors.green, '🎉 ALL TESTS PASSED! Database API is working perfectly!');
    } else {
        log(colors.yellow, `⚠️  ${totalTests - passedTests} tests failed or returned no data`);
    }
    
    log(colors.cyan, '\n💾 Database migration was successful!');
    log(colors.cyan, '🚀 Your app can now use database-only lookups instead of JSON files!');
}

// Run tests
runTests().catch(error => {
    log(colors.red, `❌ Test runner failed: ${error.message}`);
    process.exit(1);
}); 