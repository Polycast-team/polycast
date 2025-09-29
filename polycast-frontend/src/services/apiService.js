import config from '../config/config.js';
import authClient from './authClient.js';

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

  // QUICK LOOKUP - translation + concise explanation only
  getQuickWordDataUrl = (word, sentenceWithMarkedWord, nativeLanguage, targetLanguage) => {
    const params = new URLSearchParams({ word, sentenceWithMarkedWord, nativeLanguage, targetLanguage });
    return `${this.baseUrl}/api/dictionary/quick?${params}`;
  }

  // Helper methods for common API patterns
  async fetchJson(url, options = {}) {
    const token = authClient.getToken?.();
    const auth = token ? { Authorization: `Bearer ${token}` } : {};
    const response = await fetch(url, {
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...auth,
        ...options.headers
      },
      ...options
    });
    
    if (!response.ok) {
      let message = `HTTP ${response.status}`;
      try {
        const text = await response.text();
        if (text) {
          try {
            const data = JSON.parse(text);
            message = data?.error || data?.message || message;
          } catch (_) {
            message = text || message;
          }
        }
      } catch (_) {
        // ignore and keep default message
      }
      throw new Error(message);
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
