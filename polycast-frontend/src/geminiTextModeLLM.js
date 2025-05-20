// geminiTextModeLLM.js
// Minimal Gemini LLM fetcher for text mode translation (client-side, for demo/dev only)
// In production, use a backend proxy to keep API keys secure!

// IMPORTANT: You must set your Gemini API key in your environment or via secure means. Do NOT hardcode in production!
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

/**
 * Call Gemini API to translate text using a custom prompt.
 * @param {string} prompt - The full prompt for Gemini.
 * @returns {Promise<string>} The translation result.
 */
export async function fetchGeminiTranslation(prompt) {
  if (!GEMINI_API_KEY) throw new Error('Gemini API key is missing. Set VITE_GEMINI_API_KEY in your .env');
  const body = {
    contents: [{ parts: [{ text: prompt }] }]
  };
  const url = `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
  const data = await res.json();
  // Gemini's response format: data.candidates[0].content.parts[0].text
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
}
