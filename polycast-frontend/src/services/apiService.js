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

  // WebSocket URL
  roomWebSocketUrl = (targetLangs, roomCode, isHost) => {
    const params = new URLSearchParams({ targetLangs, roomCode, isHost });
    return `${this.wsBaseUrl}/ws/room/${roomCode}?${params}`;
  }

  // API Endpoint URLs
  createRoomUrl = () => `${this.baseUrl}/api/create-room`;
  checkRoomUrl = roomCode => `${this.baseUrl}/api/check-room/${roomCode}`;
  generateAudioUrl = () => `${this.baseUrl}/api/generate-audio`;
  getTranslationUrl = (language, text) => `${this.baseUrl}/api/translate/${encodeURIComponent(language)}/${encodeURIComponent(text)}`;

  // Sense candidates for Add Word flow
  getSenseCandidatesUrl = (word, nativeLanguage, targetLanguage) => {
    const params = new URLSearchParams({ word, nativeLanguage, targetLanguage });
    return `${this.baseUrl}/api/dictionary/senses?${params}`;
  }


  // UNIFIED API - Single endpoint for all word data needs
  getUnifiedWordDataUrl = (word, sentenceWithMarkedWord, nativeLanguage, targetLanguage) => {
    const params = new URLSearchParams({ word, sentenceWithMarkedWord, nativeLanguage, targetLanguage });
    return `${this.baseUrl}/api/dictionary/unified?${params}`;
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
