import apiService from './apiService';

// Helper to POST JSON to AI endpoints with auth handled by apiService
async function postAI(path, body) {
  const url = `${apiService.baseUrl}/api${path}`;
  return apiService.postJson(url, body);
}

export const aiService = {
  sendChat: async ({ messages, prompt, systemPrompt, temperature, maxTokens }) => {
    return postAI('/ai/chat', {
      messages,
      prompt,
      systemPrompt,
      temperature,
      maxTokens,
    });
  },

  createVoiceSession: async ({ voice, instructions }) => {
    return postAI('/ai/voice/session', {
      voice,
      instructions,
    });
  },
};

export default aiService;
