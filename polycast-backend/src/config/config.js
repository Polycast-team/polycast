require('dotenv').config();
console.log('Loading configuration from config.js...');

const toNumberOr = (value, fallback) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
};

const toStringOr = (value, fallback) => {
    if (typeof value !== 'string') return fallback;
    const trimmed = value.trim();
    return trimmed ? trimmed : fallback;
};

const config = {
    port: parseInt(process.env.PORT, 10) || 8080,

    // Google AI (Gemini) Configuration
    geminiApiKey: process.env.GEMINI_API_KEY,
    geminiChatModel: toStringOr(process.env.GEMINI_CHAT_MODEL, 'gemini-2.0-flash'),

    // Deepgram Configuration
    deepgramApiKey: process.env.DEEPGRAM_API_KEY,

    // OpenAI Configuration (used for realtime voice and TTS)
    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiRealtimeVoiceModel: process.env.OPENAI_REALTIME_MODEL || 'gpt-4o-realtime-preview',
    openaiRealtimeVoiceFormat: process.env.OPENAI_REALTIME_AUDIO_FORMAT || 'mp3',
    openaiRealtimeVadType: toStringOr(process.env.OPENAI_REALTIME_VAD_TYPE, 'server_vad'),
    openaiRealtimeVadThreshold: toNumberOr(process.env.OPENAI_REALTIME_VAD_THRESHOLD, 0.6),
    openaiRealtimeVadSilenceMs: toNumberOr(process.env.OPENAI_REALTIME_VAD_SILENCE_MS, 800),
    openaiRealtimeVadPrefixPaddingMs: toNumberOr(process.env.OPENAI_REALTIME_VAD_PREFIX_MS, 300),
    openaiRealtimeNoiseReduction: toStringOr(process.env.OPENAI_REALTIME_NOISE_REDUCTION, 'near_field'),

    // Redis Configuration
    redisUrl: process.env.REDIS_URL,
};

// Debug log for API key status
console.log('Config deepgramApiKey:', config.deepgramApiKey ? 'CONFIGURED' : 'NOT SET');
console.log('Config geminiApiKey:', config.geminiApiKey ? 'CONFIGURED' : 'NOT SET');
console.log('Config openaiApiKey:', config.openaiApiKey ? 'CONFIGURED' : 'NOT SET');

// Perform validation immediately when the module is loaded
config.validateKeys = function() {
    console.log('Validating API keys...');
    const requiredKeys = ['GEMINI_API_KEY', 'DEEPGRAM_API_KEY'];
    const optionalKeys = ['OPENAI_API_KEY']; // OpenAI now optional (only for TTS)
    const missingRequired = requiredKeys.filter(key => !process.env[key]);
    const missingOptional = optionalKeys.filter(key => !process.env[key]);

    if (missingRequired.length > 0) {
        missingRequired.forEach(key => console.error(`ERROR: ${key} is not set in .env file.`));
        console.error('Application cannot start without required API keys. Please check your .env file.');
        process.exit(1); // Exit the process with an error code
    } else {
        console.log('SUCCESS: Required API keys/config loaded from .env');
    }

    if (missingOptional.length > 0) {
        missingOptional.forEach(key => console.warn(`WARNING: ${key} is not set - some features may be unavailable.`));
    }

    console.log('Key validation complete.');
};

config.validateKeys();

module.exports = config;
