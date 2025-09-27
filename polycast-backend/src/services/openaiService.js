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

async function sendChatCompletion({ messages, model = 'gpt-5-mini', maxOutputTokens = 1024, temperature = 0.7, verbosity = 'low' }) {
  ensureApiKey();

  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('messages array is required');
  }

  const payload = {
    model,
    messages,
    temperature,
    max_output_tokens: maxOutputTokens,
    response_format: { type: 'text' },
    reasoning: { effort: 'minimal' },
    verbosity,
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
    const text = choice?.message?.content?.reduce
      ? choice.message.content.reduce((acc, block) => acc + (block?.text || ''), '')
      : choice?.message?.content;

    return {
      usage: response?.data?.usage || null,
      stopReason: choice?.finish_reason || null,
      text: typeof text === 'string' ? text : '',
      raw: response?.data,
    };
  } catch (error) {
    const message = error?.response?.data?.error?.message || error.message || 'Failed to reach OpenAI';
    const err = new Error(message);
    err.statusCode = error?.response?.status || 500;
    throw err;
  }
}

async function createRealtimeSession({
  model = 'gpt-realtime',
  voice = 'marin',
  instructions,
  modalities,
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

  if (Array.isArray(modalities) && modalities.length) {
    sessionConfig.session.modalities = modalities;
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
    const message = error?.response?.data?.error?.message || error.message || 'Failed to create realtime client secret';
    const err = new Error(message);
    err.statusCode = error?.response?.status || 500;
    throw err;
  }
}

module.exports = {
  sendChatCompletion,
  createRealtimeSession,
};
