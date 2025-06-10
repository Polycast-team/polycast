/**
 * Database-powered wordfreq service
 * Uses backend APIs instead of loading JSON files
 */

// Cache for recent word lookups to avoid redundant API calls
const wordCache = new Map<string, { frequency: number; userFrequency: number; rank?: number }>();
const batchCache = new Map<string, Map<string, { frequency: number; userFrequency: number; rank: number }>>();

// Currently supported languages
const SUPPORTED_LANGUAGES = ['english', 'spanish', 'portuguese'];

// Convert language name to API code
function getLanguageCode(language: string): string {
  const langMap: { [key: string]: string } = {
    'english': 'en',
    'spanish': 'sp', 
    'portuguese': 'po'
  };
  return langMap[language.toLowerCase()] || language.toLowerCase().substring(0, 2);
}

// Cache key generator
function getCacheKey(word: string, language: string): string {
  return `${getLanguageCode(language)}_${word.toLowerCase()}`;
}

// Convert internal 1-10 decimal scale to user-friendly 1-5 scale
export function convertToUserScale(internalFreq: number): number {
  if (internalFreq <= 2.0) {
    return 1; // Rare
  } else if (internalFreq <= 4.0) {
    return 2; // Uncommon
  } else if (internalFreq <= 6.0) {
    return 3; // Neutral
  } else if (internalFreq <= 8.0) {
    return 4; // Common
  } else {
    return 5; // Very common/basic
  }
}

// Main word frequency lookup function - now uses database API
export async function getWordFrequency(word: string, language: string): Promise<{ frequency: number; userFrequency: number; rank?: number } | null> {
  const langCode = getLanguageCode(language);
  const wordKey = word.toLowerCase();
  const cacheKey = getCacheKey(word, language);
  
  if (!SUPPORTED_LANGUAGES.includes(language.toLowerCase())) {
    console.warn(`Language ${language} not supported for wordfreq`);
    return null;
  }

  // Check cache first
  if (wordCache.has(cacheKey)) {
    console.log(`🎯 Cache hit for word: ${word}`);
    return wordCache.get(cacheKey)!;
  }

  try {
    console.log(`🔍 Looking up word: "${word}" in language: ${language}`);
    
    const response = await fetch(`/api/word-frequency/${langCode}/${encodeURIComponent(wordKey)}`);
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result) {
      // Cache the result
      wordCache.set(cacheKey, result);
      console.log(`✅ Found word: ${word} with frequency: ${result.frequency}, rank: ${result.rank}`);
      return result;
    } else {
      console.log(`❌ Word not found: ${word}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error looking up word ${word}:`, error);
    return null;
  }
}

// Get words by rank range - now uses database API
export async function getWordsByRankRange(
  language: string, 
  startRank: number, 
  endRank: number
): Promise<Array<{ word: string; frequency: number; rank: number; userFrequency: number }> | null> {
  const langCode = getLanguageCode(language);
  
  if (!SUPPORTED_LANGUAGES.includes(language.toLowerCase())) {
    console.warn(`Language ${language} not supported for wordfreq`);
    return null;
  }

  // Check batch cache
  const batchKey = `${langCode}_${startRank}_${endRank}`;
  if (batchCache.has(batchKey)) {
    console.log(`🎯 Batch cache hit for range: ${startRank}-${endRank}`);
    const cachedData = batchCache.get(batchKey)!;
    return Array.from(cachedData.entries()).map(([word, data]) => ({
      word,
      frequency: data.frequency,
      rank: data.rank,
      userFrequency: data.userFrequency
    }));
  }

  try {
    console.log(`📊 Getting word range: ${startRank}-${endRank} for ${language}`);
    
    // Use backend service URL for deployed environment
    const backendHost = window.location.hostname === 'localhost' ? '' : 'https://polycast-server.onrender.com';
    const response = await fetch(`${backendHost}/api/word-range/${langCode}/${startRank}/${endRank}`);
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    
    const words = await response.json();
    
    // Cache the batch result
    const batchCacheData = new Map<string, { frequency: number; userFrequency: number; rank: number }>();
    words.forEach((wordData: any) => {
      batchCacheData.set(wordData.word, {
        frequency: wordData.frequency,
        userFrequency: wordData.userFrequency,
        rank: wordData.rank
      });
      
      // Also cache individual words
      const cacheKey = getCacheKey(wordData.word, language);
      wordCache.set(cacheKey, {
        frequency: wordData.frequency,
        userFrequency: wordData.userFrequency,
        rank: wordData.rank
      });
    });
    batchCache.set(batchKey, batchCacheData);
    
    console.log(`✅ Found ${words.length} words in range ${startRank}-${endRank}`);
    return words;
  } catch (error) {
    console.error(`❌ Error getting word range ${startRank}-${endRank}:`, error);
    return null;
  }
}

// Batch word lookup for better performance when looking up multiple words
export async function getWordsBatch(words: string[], language: string): Promise<{ [word: string]: { frequency: number; userFrequency: number; rank: number } } | null> {
  const langCode = getLanguageCode(language);
  
  if (!SUPPORTED_LANGUAGES.includes(language.toLowerCase())) {
    console.warn(`Language ${language} not supported for wordfreq`);
    return null;
  }

  if (!Array.isArray(words) || words.length === 0) {
    return {};
  }

  // Filter out words already in cache
  const wordsToLookup = words.filter(word => {
    const cacheKey = getCacheKey(word, language);
    return !wordCache.has(cacheKey);
  });

  // Get cached words
  const result: { [word: string]: { frequency: number; userFrequency: number; rank: number } } = {};
  words.forEach(word => {
    const cacheKey = getCacheKey(word, language);
    if (wordCache.has(cacheKey)) {
      const cached = wordCache.get(cacheKey)!;
      if (cached.rank !== undefined) {
        result[word] = {
          frequency: cached.frequency,
          userFrequency: cached.userFrequency,
          rank: cached.rank
        };
      }
    }
  });

  // If all words were cached, return early
  if (wordsToLookup.length === 0) {
    console.log(`🎯 All ${words.length} words found in cache`);
    return result;
  }

  try {
    console.log(`📦 Batch lookup for ${wordsToLookup.length} words in ${language}`);
    
    // Use backend service URL for deployed environment
    const backendHost = window.location.hostname === 'localhost' ? '' : 'https://polycast-server.onrender.com';
    const response = await fetch(`${backendHost}/api/words-batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        language: langCode,
        words: wordsToLookup
      })
    });
    
    if (!response.ok) {
      throw new Error(`Batch API request failed: ${response.status}`);
    }
    
    const batchResult = await response.json();
    
    // Cache and merge results
    Object.entries(batchResult).forEach(([word, data]: [string, any]) => {
      const cacheKey = getCacheKey(word, language);
      wordCache.set(cacheKey, data);
      result[word] = data;
    });
    
    console.log(`✅ Batch lookup complete: ${Object.keys(batchResult).length}/${wordsToLookup.length} words found`);
    return result;
  } catch (error) {
    console.error(`❌ Error in batch word lookup:`, error);
    return null;
  }
}

// Get conjugation information for a verb form
export async function getConjugation(form: string): Promise<Array<{ infinitive: string; tense: string; person: string }> | null> {
  try {
    console.log(`🔄 Looking up conjugation: "${form}"`);
    
    // Use backend service URL for deployed environment
    const backendHost = window.location.hostname === 'localhost' ? '' : 'https://polycast-server.onrender.com';
    const response = await fetch(`${backendHost}/api/conjugations/${encodeURIComponent(form.toLowerCase())}`);
    
    if (!response.ok) {
      throw new Error(`Conjugation API request failed: ${response.status}`);
    }
    
    const result = await response.json();
    
    console.log(`✅ Found ${result.length} conjugation matches for: ${form}`);
    return result;
  } catch (error) {
    console.error(`❌ Error looking up conjugation for ${form}:`, error);
    return null;
  }
}

// Preload core vocabulary for a language (now loads common words proactively)
export async function preloadCoreLanguage(language: string): Promise<boolean> {
  console.log(`🚀 Preloading core vocabulary for ${language}...`);
  
  try {
    // Load the most common 1000 words
    const coreWords = await getWordsByRankRange(language, 1, 1000);
    
    if (coreWords && coreWords.length > 0) {
      console.log(`✅ Preloaded ${coreWords.length} core words for ${language}`);
      return true;
    } else {
      console.warn(`⚠️ No core words found for ${language}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error preloading core vocabulary for ${language}:`, error);
    return false;
  }
}

// Get cache statistics
export function getCacheStats(): { 
  individualWords: number; 
  batchEntries: number;
  languages: string[];
} {
  const languages = new Set<string>();
  
  // Extract languages from cache keys
  wordCache.forEach((_, key) => {
    const lang = key.split('_')[0];
    languages.add(lang);
  });
  
  return {
    individualWords: wordCache.size,
    batchEntries: batchCache.size,
    languages: Array.from(languages)
  };
}

// Clear cache for memory management
export function clearCache(): void {
  wordCache.clear();
  batchCache.clear();
  console.log(`🧹 Cleared all wordfreq caches`);
}

// Clear cache for a specific language
export function clearLanguageCache(language: string): void {
  const langCode = getLanguageCode(language);
  
  // Remove individual word cache entries for this language
  const keysToDelete: string[] = [];
  wordCache.forEach((_, key) => {
    if (key.startsWith(`${langCode}_`)) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach(key => wordCache.delete(key));
  
  // Remove batch cache entries for this language
  const batchKeysToDelete: string[] = [];
  batchCache.forEach((_, key) => {
    if (key.startsWith(`${langCode}_`)) {
      batchKeysToDelete.push(key);
    }
  });
  batchKeysToDelete.forEach(key => batchCache.delete(key));
  
  console.log(`🧹 Cleared cache for ${language} (${keysToDelete.length} words, ${batchKeysToDelete.length} batches)`);
}

// Legacy compatibility functions (these now just call the new implementations)
export function getLoadingStatus(language: string): { core: boolean; extended: boolean; complete: boolean } {
  // Since we're using database, all tiers are always "loaded"
  return { core: true, extended: true, complete: true };
}