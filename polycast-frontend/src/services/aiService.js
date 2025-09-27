import apiService from './apiService.js';

export async function sendAiChatRequest({ messages, systemPrompt, temperature, verbosity, model, maxOutputTokens } = {}) {
  return apiService.sendAiChat({
    messages,
    systemPrompt,
    temperature,
    verbosity,
    model,
    maxOutputTokens,
  });
}

export async function createRealtimeVoiceSession({ voice, instructions, modalities, temperature } = {}) {
  return apiService.createRealtimeVoiceSession({ voice, instructions, modalities, temperature });
}

export default {
  sendAiChatRequest,
  createRealtimeVoiceSession,
};
