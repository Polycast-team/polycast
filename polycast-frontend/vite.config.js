import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// Need to reference vitest types for config
/// <reference types="vitest" />

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true, // Use Vitest global APIs like describe, test, expect
    environment: 'jsdom', // Simulate browser environment for React testing
    setupFiles: './src/setupTests.js', // Optional: run setup file before tests
    // You might want to configure CSS handling if your components import CSS
    // css: true,
  },
  server: {
    host: true,
    allowedHosts: [
        'localhost', 
        '*.ngrok-free.app', // Wildcard for any ngrok free tier host
        'polycast-frontend.onrender.com'
        // Add the specific current one just in case wildcard fails:
        // '5cb0-207-45-83-227.ngrok-free.app' 
    ],
    proxy: {
      '/mode': 'http://localhost:8080'
    }
  },
})
