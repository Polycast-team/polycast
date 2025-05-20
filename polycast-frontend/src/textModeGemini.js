// textModeGemini.js
// Gemini prompt builder for text mode translation in Polycast

/**
 * Build a prompt for Gemini to translate a speech-to-text transcript from a base language to a target language.
 * The prompt should instruct Gemini to preserve meaning and naturalness in the target language.
 *
 * @param {string} sourceLang - The ISO code or name of the base language (e.g. 'EN', 'ES', 'ZH', 'MY').
 * @param {string} targetLang - The ISO code or name of the target language.
 * @param {string} sourceText - The text to translate.
 * @returns {string} The prompt for Gemini.
 */
export function buildGeminiPrompt(sourceLang, targetLang, sourceText) {
  return `You are a professional translator. Translate the following speech-to-text transcript from ${langName(sourceLang)} to ${langName(targetLang)}. Preserve the original meaning and make the translation sound natural in ${langName(targetLang)}.\n\nTranscript: "${sourceText}"\n\nTranslation:`;
}

// Helper: map language code to readable name
function langName(code) {
  switch (code.toUpperCase()) {
    case 'EN': return 'English';
    case 'ES': return 'Spanish';
    case 'ZH': return 'Chinese';
    case 'MY': return 'Burmese';
    default: return code;
  }
}
