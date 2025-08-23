/**
 * Frontend configuration
 * Loads environment variables and provides fallbacks
 */

const config = {
  // API Configuration
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
  wsBaseUrl: import.meta.env.VITE_WS_BASE_URL,
  
  // Development flag
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
  
  // App metadata
  appName: 'Polycast',
  version: import.meta.env.VITE_APP_VERSION || '1.0.0'
};

// Debug logging in development
if (config.isDevelopment) {
  console.log('Frontend Config:', {
    apiBaseUrl: config.apiBaseUrl,
    wsBaseUrl: config.wsBaseUrl,
    environment: config.isDevelopment ? 'development' : 'production'
  });
}

export default config;