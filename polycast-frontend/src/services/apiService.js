import config from '../config/config.js';

/**
 * API Service Layer
 * Centralizes all API calls and URL construction
 */

class ApiService {
  constructor() {
    this.baseUrl = config.apiBaseUrl;
    this.wsBaseUrl = config.wsBaseUrl;
  }

  // API Endpoint URLs
  createRoomUrl = () => `${this.baseUrl}/api/create-room`;
  // checkRoomUrl = roomCode => `${this.baseUrl}/api/check-room/${roomCode}`;
  generateAudioUrl = () => `${this.baseUrl}/api/generate-audio`;





  // Dictionary API
  getDictionaryDefinition(word, context, targetLanguage) {
    const params = new URLSearchParams({
      context: context,
      targetLanguage: targetLanguage
    });
    return `${this.baseUrl}/api/dictionary/${encodeURIComponent(word)}?${params}`;
  }

  getLocalDictionary(firstLetter, word, context, targetLanguage) {
    const params = new URLSearchParams({
      context: context,
      targetLanguage: targetLanguage
    });
    return `${this.baseUrl}/api/local-dictionary/${encodeURIComponent(firstLetter)}/${encodeURIComponent(word.toUpperCase())}?${params}`;
  }

  // Word disambiguation
  getDisambiguationUrl() {
    return `${this.baseUrl}/api/disambiguate-word`;
  }

  // Example generation
  getExamplesUrl() {
    return `${this.baseUrl}/api/dictionary/generate-examples`;
  }

  // Profile API
  getProfileWordsUrl(profile) {
    return `${this.baseUrl}/api/profile/${profile}/words`;
  }

  // Translation API
  getTranslationUrl(language, text) {
    return `${this.baseUrl}/api/translate/${encodeURIComponent(language)}/${encodeURIComponent(text)}`;
  }

  // WebSocket URLs
  getRoomWebSocketUrl(roomCode, userRole) {
    const params = new URLSearchParams({ role: userRole });
    return `${this.wsBaseUrl}/ws/room/${roomCode}?${params}`;
  }




  // Helper methods for common API patterns
  async fetchJson(url, options = {}) {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  }

  async postJson(url, data) {
    return this.fetchJson(url, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
}

// Export a singleton instance
export default new ApiService();