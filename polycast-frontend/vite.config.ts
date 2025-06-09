import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    
    // In production, use process.env directly; in development, use loadEnv
    const geminiApiKey = process.env.GEMINI_API_KEY || env.GEMINI_API_KEY;
    
    // Debug logging for build process
    console.log('🔧 Vite Build Debug:');
    console.log('  Mode:', mode);
    console.log('  process.env.GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? 'SET' : 'NOT SET');
    console.log('  env.GEMINI_API_KEY:', env.GEMINI_API_KEY ? 'SET' : 'NOT SET');
    console.log('  Final geminiApiKey:', geminiApiKey ? 'SET' : 'NOT SET');
    
    return {
      define: {
        'process.env.GEMINI_API_KEY': JSON.stringify(geminiApiKey)
      },
      server: {
        allowedHosts: ['7e2c-89-187-182-174.ngrok-free.app']
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
