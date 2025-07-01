// textModeLLM.js
// Dedicated service for text mode translation using Gemini API (Google Generative AI)
// Uses the same Gemini API key as llmService.js, but logic is fully separate from audio mode.

const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config/config');

let genAI;
let model;

function initializeLLM() {
    if (!config.googleApiKey) {
        throw new Error('Google API Key (GOOGLE_API_KEY) is not configured in .env');
    }
    if (!genAI) {
        console.log('[TextMode LLM] Initializing Google Generative AI...');
        genAI = new GoogleGenerativeAI(config.googleApiKey);
        model = genAI.getGenerativeModel({
            model: 'gemini-2.0-flash-lite',
        });
        console.log('[TextMode LLM] Google Generative AI initialized.');
    }
}

/**
 * Translate text to multiple target languages using a context-aware interpreter prompt.
 * @param {string} sourceText - The text to translate.
 * @param {string} sourceLang - The language code or name of the source text.
 * @param {Array<string>} targetLangs - Array of target language codes/names.
 * @returns {Promise<object>} Object mapping each target language to its translation, plus the sourceLang to the original text.
 */
async function translateTextBatch(sourceText, sourceLang, targetLangs) {
    initializeLLM();
    const results = {};
    for (const lang of targetLangs) {
        // Always translate, even if lang === 'English' or sourceLang === 'English'
        if (lang === sourceLang) {
            results[lang] = sourceText;
            continue;
        }
        const prompt = `This is text in ${sourceLang}. Translate this to ${lang} as if you were an interpreter. Try to make this a faithful translation, but if there are errors or a direct translation wouldn't make sense in ${lang}, do your best to make it make sense. Otherwise, stay as close to the original meaning as possible. Only output your translation without other preamble; again, ONLY output the translation.\n\nInput: \"${sourceText}\"`;
        try {
            const result = await model.generateContent({ contents: [{ parts: [{ text: prompt }] }] });
            const translation = result.response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
            results[lang] = translation;
        } catch (err) {
            console.error(`[TextModeLLM] Translation error for ${lang}:`, err);
            results[lang] = '[Translation failed]';
        }
    }
    return results;
}

module.exports = {
    translateTextBatch,
};
