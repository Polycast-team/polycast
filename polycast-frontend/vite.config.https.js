import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
// Need to reference vitest types for config
/// <reference types="vitest" />

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true, // Use Vitest global APIs like describe, test, expect
    environment: 'jsdom', // Simulate browser environment for React testing
    setupFiles: './src/setupTests.js', // Optional: run setup file before tests
  },
  server: {
    host: true,
    https: {
      // Update these paths to your certificate files
      key: fs.readFileSync(process.env.SSL_KEY_PATH || './default-key.pem'),
      cert: fs.readFileSync(process.env.SSL_CERT_PATH || './default-cert.pem')
    },
    allowedHosts: [
        'localhost', 
        '192.168.4.202',
        '*.ngrok-free.app',
        'polycast-frontend.onrender.com'
    ],
    proxy: {
      '/mode': 'http://localhost:8080'
    }
  },
})