/**
 * In-memory dictionary cache service
 * Provides instant lookups for previously translated words
 */
class DictionaryCacheService {
  constructor() {
    this.cache = new Map();
    console.log('[DictionaryCache] Initialized');
  }

  /**
   * Get a cached translation
   * @param {string} word - The word to look up
   * @param {string} targetLanguage - The language of the word
   * @returns {Object|null} Cached translation data or null if not found
   */
  get(word, targetLanguage) {
    const key = this._makeKey(word, targetLanguage);
    const cached = this.cache.get(key);

    if (cached) {
      console.log(`[DictionaryCache] HIT: ${word} (${targetLanguage})`);
      return cached;
    }

    return null;
  }

  /**
   * Store a translation in cache
   * @param {string} word - The word
   * @param {string} targetLanguage - The language of the word
   * @param {Object} data - Translation data { translation, definition, partOfSpeech, etc. }
   */
  set(word, targetLanguage, data) {
    const key = this._makeKey(word, targetLanguage);
    this.cache.set(key, data);
    console.log(`[DictionaryCache] CACHED: ${word} (${targetLanguage}) - Total entries: ${this.cache.size}`);
  }

  /**
   * Create a cache key from word and language
   * @private
   */
  _makeKey(word, targetLanguage) {
    return `${word.toLowerCase().trim()}_${(targetLanguage || 'en').toLowerCase()}`;
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getStats() {
    return {
      size: this.cache.size,
      entries: this.cache.size,
    };
  }

  /**
   * Clear the cache
   */
  clear() {
    this.cache.clear();
    console.log('[DictionaryCache] Cleared');
  }
}

// Export singleton instance
module.exports = new DictionaryCacheService();
