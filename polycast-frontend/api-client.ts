// Frontend API client to communicate with backend services
const API_BASE_URL = '/openai-proxy'; // Vite proxy will forward to backend

export class OpenAIVoiceSession {
  // Mock implementation for compatibility
  // TODO: Implement WebSocket connection to backend
  constructor() {
    console.log('OpenAI Voice Session - Frontend stub');
  }

  async start() {
    // TODO: Start WebSocket connection to backend
    console.log('OpenAI Voice Session start - Frontend stub');
  }

  async stop() {
    // TODO: Stop WebSocket connection to backend
    console.log('OpenAI Voice Session stop - Frontend stub');
  }
}

// API functions that call the backend
export async function fetchWordDetailsFromApi(word: string, sentence: string, targetLanguage: string, nativeLanguage: string) {
  try {
    const response = await fetch('/api/word-details', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ word, sentence, targetLanguage, nativeLanguage }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching word details:', error);
    throw error;
  }
}

export async function fetchWordFrequencyFromApi(word: string, targetLanguage: string) {
  try {
    const response = await fetch('/api/word-frequency', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ word, targetLanguage }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching word frequency:', error);
    throw error;
  }
}

export async function fetchExampleSentencesFromApi(word: string, targetLanguage: string, nativeLanguage: string) {
  try {
    const response = await fetch('/api/example-sentences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ word, targetLanguage, nativeLanguage }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching example sentences:', error);
    throw error;
  }
}

export async function fetchEvaluationFromApi(transcript: string, targetLanguage: string, nativeLanguage: string) {
  try {
    const response = await fetch('/api/evaluation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ transcript, targetLanguage, nativeLanguage }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching evaluation:', error);
    throw error;
  }
} 