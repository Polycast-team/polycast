require('dotenv').config();
console.log('Loading configuration from config.js...');

const config = {
    port: parseInt(process.env.PORT, 10) || 8080,

    // Google AI (Gemini) Configuration
    googleApiKey: process.env.GOOGLE_API_KEY,

    // Deepgram Configuration
    deepgramApiKey: process.env.DEEPGRAM_API_KEY,

    // OpenAI Configuration (for TTS only now)
    openaiApiKey: process.env.OPENAI_API_KEY,

    // Redis Configuration
    redisUrl: process.env.REDIS_URL,
};

// Debug log for API key status
console.log('Config deepgramApiKey:', config.deepgramApiKey ? 'CONFIGURED' : 'NOT SET');
console.log('Config googleApiKey:', config.googleApiKey ? 'CONFIGURED' : 'NOT SET');
console.log('Config openaiApiKey:', config.openaiApiKey ? 'CONFIGURED' : 'NOT SET');

// Perform validation immediately when the module is loaded
config.validateKeys = function() {
    console.log('Validating API keys...');
    const requiredKeys = ['GOOGLE_API_KEY', 'DEEPGRAM_API_KEY'];
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
