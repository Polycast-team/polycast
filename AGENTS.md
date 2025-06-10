# AGENTS.md - Polycast AI Development Guidelines

## Project Overview

Polycast AI is a language learning application featuring:
- **Backend**: Node.js/Express server with PostgreSQL database
- **Frontend**: Lit-based web components with TypeScript  
- **Features**: Real-time voice conversation, word frequency analysis, conjugation lookup, flashcard system, video calling
- **Architecture**: Database-driven (migrated from 116MB JSON files to PostgreSQL)

## Core Development Principles

### 🎯 **Always Follow These Rules:**

1. **Database-First Approach**: All word frequencies and conjugations come from PostgreSQL database, never create/use local JSON files
2. **Language Code Consistency**: Use correct language codes (`en` for English, `sp` for Spanish, `po` for Portuguese) - not ISO codes
3. **Audio Compatibility**: Maintain 24kHz sample rate for OpenAI Realtime API compatibility
4. **Component Architecture**: Use Lit web components with proper TypeScript typing
5. **Performance Focus**: Implement caching, batch API calls, and efficient database queries

### 🚫 **Never Do:**

- Add new JSON files for word/conjugation data (use database APIs)
- Use `es`/`pt` language codes (use `sp`/`po` to match database)
- Change audio sample rates without considering OpenAI compatibility
- Include large binary files in git (use .gitignore)
- Create new abstractions without clear necessity

## Code Style & Architecture

### **TypeScript/Frontend:**
```typescript
// ✅ Good: Proper typing and error handling
export async function getWordFrequency(word: string, language: string): Promise<WordFrequencyResult | null> {
  try {
    const langCode = getLanguageCode(language);
    const response = await fetch(`/api/word-frequency/${langCode}/${encodeURIComponent(word)}`);
    if (!response.ok) throw new Error(`API request failed: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error(`Error looking up word ${word}:`, error);
    return null;
  }
}

// ❌ Bad: No error handling, hardcoded language codes
const data = await fetch(`/api/word-frequency/es/${word}`).then(r => r.json());
```

### **Node.js/Backend:**
```javascript
// ✅ Good: Parameterized queries, proper logging
app.get('/api/word-frequency/:language/:word', async (req, res) => {
  try {
    const { language, word } = req.params;
    console.log(`🔍 Looking up word: "${word}" in language: ${language}`);
    
    const result = await pool.query(
      'SELECT frequency, rank, user_frequency FROM word_frequencies WHERE language = $1 AND word = $2',
      [language.toLowerCase(), word.toLowerCase()]
    );
    
    res.json(result.rows.length > 0 ? result.rows[0] : null);
  } catch (error) {
    console.error('❌ Error looking up word frequency:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// ❌ Bad: SQL injection risk, no error handling
app.get('/api/word/:word', async (req, res) => {
  const result = await pool.query(`SELECT * FROM words WHERE word = '${req.params.word}'`);
  res.json(result.rows[0]);
});
```

## Database Guidelines

### **Language Code Mapping:**
- English: `en`
- Spanish: `sp` (NOT `es`)
- Portuguese: `po` (NOT `pt`)

### **Tables Structure:**
```sql
-- Word frequencies table
word_frequencies (language, word, frequency, rank, user_frequency)

-- Verb conjugations table  
verb_conjugations (infinitive, form, tense, person, mood, translation, language)
```

### **Query Patterns:**
```javascript
// ✅ Batch queries for performance
const placeholders = words.map((_, index) => `$${index + 2}`).join(',');
const result = await pool.query(
  `SELECT word, frequency FROM word_frequencies WHERE language = $1 AND word IN (${placeholders})`,
  [language, ...words]
);

// ❌ Individual queries in loops
for (const word of words) {
  await pool.query('SELECT * FROM word_frequencies WHERE word = $1', [word]);
}
```

## API Design Standards

### **Endpoint Patterns:**
- `/api/word-frequency/:language/:word` - Single word lookup
- `/api/word-range/:language/:startRank/:endRank` - Rank-based batch lookup
- `/api/words-batch` (POST) - Multiple word lookup
- `/api/conjugations/:form` - Verb conjugation lookup

### **Response Format:**
```typescript
// Word frequency response
interface WordFrequencyResult {
  frequency: number;
  userFrequency: number; 
  rank: number;
}

// Conjugation response
interface ConjugationResult {
  infinitive: string;
  form: string;
  tense: string;
  person: string;
  mood: string;
  translation: string;
  language: string;
}
```

## Audio/Voice Integration

### **OpenAI Realtime API Requirements:**
- Input audio format: `pcm16` at 24kHz
- Output audio format: `pcm16` at 24kHz  
- Enable input transcription: `{ model: "whisper-1" }`
- Disable turn detection: `turn_detection: null`

### **Audio Context Setup:**
```typescript
// ✅ Correct: 24kHz for OpenAI compatibility
private inputAudioContext = new AudioContext({sampleRate: 24000});
private outputAudioContext = new AudioContext({sampleRate: 24000});

// ❌ Wrong: 16kHz causes transcription failures
private inputAudioContext = new AudioContext({sampleRate: 16000});
```

## Testing & Validation

### **Required Tests Before Deployment:**
1. **Database API Tests**: Verify all endpoints return correct data for all languages
2. **Audio System Tests**: Confirm 24kHz audio and successful transcription
3. **Language Code Tests**: Ensure `sp`/`po` codes work correctly
4. **Batch Query Tests**: Verify performance of multi-word lookups

### **Test Commands:**
```bash
# Run database tests
node polycast-backend/direct-db-test.js

# Check repository size
git count-objects -vH

# Verify no large files
git ls-files | xargs ls -la | awk '$5 > 1000000'
```

## Performance Guidelines

### **Caching Strategy:**
- Implement Map-based caching for word frequencies
- Cache batch results with composite keys
- Clear cache by language when needed

### **Database Optimization:**
- Use parameterized queries
- Implement batch lookups for multiple words
- Index frequently queried columns (word, language, rank)

## Git & Deployment

### **.gitignore Requirements:**
```gitignore
# Large binaries (prevent repo bloat)
*.exe
ngrok*
*.zip
*.tar.gz

# Generated files
dist/
*.log
node_modules/
```

### **Commit Message Format:**
```
feat: Add new word frequency caching system
fix: Correct language code mapping (es->sp, pt->po)  
perf: Optimize batch word lookup queries
docs: Update API documentation
```

## Troubleshooting Common Issues

### **Audio Transcription Failures:**
- Check sample rate is 24kHz for both input/output
- Verify `input_audio_transcription` is enabled
- Ensure `turn_detection` is set to `null`

### **API 404 Errors:**
- Verify language codes match database (`sp` not `es`)
- Check endpoint exists in server.js
- Confirm database contains data for that language

### **Large Deployment Size:**
- Remove binary files from git history
- Check .gitignore includes large file patterns
- Use `git count-objects -vH` to verify repository size

## Emergency Procedures

### **Database Migration Issues:**
1. Check connection string and credentials
2. Verify table schema matches expected structure
3. Run migration scripts in correct order
4. Test with direct database queries

### **Production Deployment Failures:**
1. Check build logs for TypeScript errors
2. Verify environment variables are set
3. Test API endpoints return expected responses
4. Monitor memory usage and performance

---

**Remember**: This is a language learning app - prioritize accuracy of linguistic data, smooth audio experience, and fast word lookups. Every change should enhance the learning experience. 