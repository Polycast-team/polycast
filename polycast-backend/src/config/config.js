require('dotenv').config();
console.log('Loading configuration from config.js...');

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
    console.log('Validating API keys...');
    const requiredKeys = ['GOOGLE_API_KEY', 'OPENAI_API_KEY'];
    const missingKeys = requiredKeys.filter(key => !process.env[key]);

    if (missingKeys.length > 0) {
        missingKeys.forEach(key => console.error(`ERROR: ${key} is not set in .env file.`));
        console.error('Application cannot start without required API keys. Please check your .env file.');
        process.exit(1); // Exit the process with an error code
    } else {
        console.log('SUCCESS: Required API keys/config loaded from .env');
    }
    console.log('Key validation complete.');
};

config.validateKeys();

module.exports = config;
