const axios = require('axios');
const config = require('../config/config');

const OPENAI_BASE_URL = 'https://api.openai.com/v1';

function ensureApiKey() {
  if (!config.openaiApiKey) {
    const error = new Error('OpenAI API key is not configured');
    error.statusCode = 500;
    throw error;
  }
}

async function sendChatCompletion(params = {}) {
  return sendChatWithFallback(params, { fallbackUsed: false });
}

async function sendChatWithFallback({
  messages,
  model = 'gpt-5-mini',
  maxOutputTokens = 1024,
  temperature = 0.7,
}, { fallbackUsed }) {
  ensureApiKey();

  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('messages array is required');
  }

  const normalizedMessages = messages.map((message = {}) => {
    const role = message.role || 'user';
    const rawContent = message.content ?? '';

    const contentParts = Array.isArray(rawContent)
      ? rawContent
      : [{ type: 'text', text: String(rawContent) }];

    const formatted = contentParts.map((part) => {
      if (typeof part === 'string') {
        return { type: 'text', text: part };
      }
      if (part?.type === 'text') {
        return { type: 'text', text: String(part.text ?? '') };
      }
      return { type: 'text', text: String(part?.text ?? '') };
    });

    return { role, content: formatted };
  });

  const cleanedMessages = normalizedMessages.filter((msg) =>
    Array.isArray(msg.content) && msg.content.some((part) => part.text.trim().length > 0)
  );

  if (cleanedMessages.length === 0) {
    throw new Error('messages array is empty after normalization');
  }

  const payload = {
    model,
    messages: cleanedMessages,
    temperature,
    max_output_tokens: maxOutputTokens,
  };

  try {
    const response = await axios.post(`${OPENAI_BASE_URL}/chat/completions`, payload, {
      headers: {
        Authorization: `Bearer ${config.openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 60_000,
    });

    const choice = response?.data?.choices?.[0];
    const text = Array.isArray(choice?.message?.content)
      ? choice.message.content.map((block) => block?.text || '').join('')
      : choice?.message?.content;

    return {
      usage: response?.data?.usage || null,
      stopReason: choice?.finish_reason || null,
      text: typeof text === 'string' ? text : '',
      raw: response?.data,
    };
  } catch (error) {
    const details = error?.response?.data;
    const message = details?.error?.message || error.message || 'Failed to reach OpenAI';
    const statusCode = error?.response?.status || 500;

    console.error('[OpenAI] chat error payload:', details || message);

    const missingModel = typeof message === 'string'
      && /model .* (does not exist|unknown|not available)/i.test(message);

    if (!fallbackUsed && model === 'gpt-5-mini' && missingModel) {
      console.warn('[OpenAI] Falling back to gpt-5 for chat completion');
      return sendChatWithFallback({ messages, model: 'gpt-5', maxOutputTokens, temperature }, { fallbackUsed: true });
    }

    const err = new Error(message);
    err.statusCode = statusCode;
    err.details = details;
    throw err;
  }
}

async function createRealtimeSession({
  model = 'gpt-realtime',
  voice = 'marin',
  instructions,
  outputModalities,
  temperature = 0.7,
} = {}) {
  ensureApiKey();

  const sessionConfig = {
    session: {
      type: 'realtime',
      model,
      temperature,
    },
  };

  if (voice) {
    sessionConfig.session.audio = {
      output: { voice },
    };
  }

  if (instructions) {
    sessionConfig.session.instructions = instructions;
  }

  if (Array.isArray(outputModalities) && outputModalities.length) {
    sessionConfig.session.output_modalities = outputModalities;
  }

  try {
    const response = await axios.post(`${OPENAI_BASE_URL}/realtime/client_secrets`, sessionConfig, {
      headers: {
        Authorization: `Bearer ${config.openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 15_000,
    });

    return response.data;
  } catch (error) {
    const details = error?.response?.data;
    const message = details?.error?.message || error.message || 'Failed to create realtime client secret';
    const statusCode = error?.response?.status || 500;

    console.error('[OpenAI] realtime error payload:', details || message);

    const err = new Error(message);
    err.statusCode = statusCode;
    err.details = details;
    throw err;
  }
}

module.exports = {
  sendChatCompletion,
  createRealtimeSession,
};
