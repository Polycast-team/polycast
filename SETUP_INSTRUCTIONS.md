# Polycast AI Setup Instructions

## Issue: API Key Not Found

The error "An API Key must be set when running in a browser" occurs because the GEMINI_API_KEY environment variable isn't properly configured.

### For Local Development:

1. Create a `.env.local` file in the `polycast-frontend/` directory:
   ```
   GEMINI_API_KEY=your_actual_gemini_api_key_here
   ```

2. Get your API key from: https://aistudio.google.com/app/apikey

### For Render Deployment:

1. In your Render dashboard, go to your service settings
2. Add Environment Variable:
   - **Key:** `GEMINI_API_KEY`
   - **Value:** Your actual Gemini API key

## Issue: WebSocket Connection Failed

The error "WebSocket connection to 'wss://polycast-frontend.onrender.com/openai-proxy' failed" occurs because the frontend is trying to connect to services that aren't running.

### Solutions:

**Option 1: Run Backend Services**
- Deploy your `polycast-backend` as a separate Render service
- Update the Vite proxy configuration to point to your backend service URL

**Option 2: Disable Features Temporarily**
- Comment out the OpenAI voice session initialization
- Comment out the signaling server connection
- Focus on getting the basic Gemini AI chat working first

## Current Architecture Issues:

1. **Frontend and Backend are mixed** - The Vite proxy is trying to connect to localhost services
2. **Environment variables** - Need to be set in Render's environment, not just in files
3. **WebSocket services** - Need to be deployed separately or configured correctly

## Quick Fix for Testing:

1. Set the `GEMINI_API_KEY` in Render environment variables
2. Comment out the WebSocket connections in `index.tsx` temporarily
3. Test the basic AI chat functionality first
4. Then add back the voice and video features once the base works 