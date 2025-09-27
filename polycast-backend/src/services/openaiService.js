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

const FALLBACK_MODELS = ['gpt-5', 'gpt-4o-mini', 'gpt-4o'];

function buildFallbackChain(requestedModel = 'gpt-5-mini') {
  const chain = [requestedModel, ...FALLBACK_MODELS];
  return chain.filter((model, idx) => model && chain.indexOf(model) === idx);
}

function normalizeMessages(messages = []) {
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

  return cleanedMessages;
}

function isModelUnavailable(statusCode, message = '') {
  if (!message && !statusCode) return false;
  const normalizedMessage = String(message);
  if (statusCode === 404) return true;
  if (statusCode === 403 && /access/i.test(normalizedMessage)) return true;
  if (statusCode === 400 && /model/i.test(normalizedMessage) && /(does not exist|not available|unknown|invalid)/i.test(normalizedMessage)) {
    return true;
  }
  return /(does not exist|not available|unknown model|You do not have access)/i.test(normalizedMessage);
}

async function callChatCompletion({ messages, model, temperature, maxOutputTokens }) {
  const payload = {
    model,
    messages,
    temperature,
    max_output_tokens: maxOutputTokens,
  };

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
}

async function sendChatCompletion({ messages, model = 'gpt-5-mini', maxOutputTokens = 1024, temperature = 0.7 }) {
  ensureApiKey();
  const cleanedMessages = normalizeMessages(messages);
  const modelsToTry = buildFallbackChain(model);

  let lastError = null;

  for (const candidate of modelsToTry) {
    try {
      const result = await callChatCompletion({
        messages: cleanedMessages,
        model: candidate,
        temperature,
        maxOutputTokens,
      });

      return { ...result, modelUsed: candidate };
    } catch (error) {
      const details = error?.response?.data;
      const message = details?.error?.message || error.message || '';
      const statusCode = error?.response?.status || error?.statusCode;

      console.error(`[OpenAI] chat error for model ${candidate}:`, details || message);

      if (isModelUnavailable(statusCode, message) && candidate !== modelsToTry[modelsToTry.length - 1]) {
        lastError = error;
        continue;
      }

      const err = new Error(message || 'Failed to reach OpenAI');
      err.statusCode = statusCode || 500;
      err.details = details;
      throw err;
    }
  }

  if (lastError) {
    const details = lastError?.response?.data;
    const message = details?.error?.message || lastError.message || 'Failed to reach OpenAI';
    const err = new Error(message);
    err.statusCode = lastError?.response?.status || lastError?.statusCode || 500;
    err.details = details;
    throw err;
  }

  const unexpectedError = new Error('OpenAI chat request failed with no additional information');
  unexpectedError.statusCode = 500;
  throw unexpectedError;
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
