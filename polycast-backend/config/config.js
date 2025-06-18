console.log('Loading configuration from config.js...'); // Add log for debugging

const config = {
    port: parseInt(process.env.PORT, 10) || 8080,

    // Google AI (Gemini) Configuration
    googleApiKey: process.env.GOOGLE_API_KEY,

    // OpenAI Whisper Configuration
    openaiApiKey: process.env.OPENAI_API_KEY,
};

// Debug log for OpenAI API Key
console.log('Config openaiApiKey:', config.openaiApiKey ? config.openaiApiKey.slice(0, 8) + '...' : 'NOT SET');

// Perform validation immediately when the module is loaded
config.validateKeys = function() {
    console.log('Validating API keys...'); // Add log for debugging
    let keysLoaded = true;
    if (!this.googleApiKey) {
        console.warn('WARNING: GOOGLE_API_KEY is not set in .env file.');
        keysLoaded = false;
    }
    if (!this.openaiApiKey) {
        console.warn('WARNING: OPENAI_API_KEY is not set in .env file.');
        keysLoaded = false;
    }
    if (keysLoaded) {
        console.log('SUCCESS: Required API keys/config loaded from .env');
    } else {
        console.error('ERROR: One or more required API keys/configs are missing in .env! Check .env file.');
    }
    console.log('Key validation complete.'); // Add log for debugging
};

config.validateKeys();

module.exports = config;
