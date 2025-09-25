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

  requestVoiceResponse: async ({ messages, voice, temperature, systemPrompt }) => {
    return postAI('/ai/voice/respond', {
      messages,
      voice,
      temperature,
      systemPrompt,
    });
  },
};

export default aiService;
