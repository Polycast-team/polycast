const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config/config');

class PopupGeminiService {
  constructor() {    
    this.genAI = new GoogleGenerativeAI(config.geminiApiKey);
    // Configure Gemini 2.5 Flash Lite with thinking off
    this.model = this.genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash-lite',
      generationConfig: {
        temperature: 0.1,
        topK: 1,
        topP: 0.1,
        maxOutputTokens: 512,
      }
    });
  }

  /**
   * Extract the sentence containing the target word from the full context
   * @param {string} word - The target word
   * @param {string} context - The full transcript or paragraph
   * @returns {string} The sentence containing the word
   */
  extractSentence(word, context) {
    if (!context) return '';
    
    // Split by sentence-ending punctuation
    const sentences = context.split(/(?<=[.!?])\s+/);
    
    // Find the sentence containing the word (case-insensitive)
    const wordLower = word.toLowerCase();
    const sentence = sentences.find(s => 
      s.toLowerCase().includes(wordLower)
    );
    
    return sentence || context.slice(0, 200) + '...'; // Fallback to first 200 chars
  }

  /**
   * Get contextual definition for a word using Gemini
   * @param {string} word - The word to define
   * @param {string} context - The full context/transcript
   * @param {string} targetLanguage - The language for translations (e.g., 'Spanish', 'English')
   * @returns {Promise<Object>} Formatted definition object for the popup
   */
  async getContextualDefinition(word, context, targetLanguage = 'English') {
    try {
      // Extract the specific sentence containing the word
      const sentence = this.extractSentence(word, context);
      
      // Create the prompt for Gemini
      const prompt = `You are a language teacher helping a student understand a word in context.

Word: "${word}"
Sentence: "${sentence}"
Target Language: ${targetLanguage}

Provide a JSON response with these exact fields:
{
  "translation": "Translation of '${word}' to ${targetLanguage}",
  "contextualExplanation": "A simple explanation IN ${targetLanguage} (max 10 words) of what '${word}' means in this specific sentence"
}

Rules:
- Keep the contextualExplanation very short and simple
- Use ${targetLanguage} for BOTH fields
- Focus on the specific meaning in this context
- Do not include any text outside the JSON`;

      // Call Gemini
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*?\}/);
      if (!jsonMatch) {
        throw new Error('Could not extract JSON from Gemini response');
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      // Return formatted response matching WordDefinitionPopup expectations
      return {
        word: word,
        translation: parsed.translation || '',
        contextualExplanation: parsed.contextualExplanation || '',
        sentence: sentence,
        targetLanguage: targetLanguage
      };
      
    } catch (error) {
      console.error('[PopupGeminiService] Error getting definition:', error);
      
      // Return fallback response
      return {
        word: word,
        translation: word,
        contextualExplanation: 'Definition unavailable',
        sentence: this.extractSentence(word, context),
        targetLanguage: targetLanguage,
        error: error.message
      };
    }
  }

  /**
   * Generate five example sentence pairs using the SAME SENSE as in the input sentence.
   * Returns a single line string of 10 items separated by " // ":
   * Target1 // Native1 // Target2 // Native2 // ... // Target5 // Native5
   * The target word (or inflected form) must be wrapped with tildes in BOTH languages.
   *
   * @param {string} word
   * @param {string} sentenceWithTilde - Original sentence in target language with ~word~ markup
   * @param {string} targetLanguage
   * @param {string} nativeLanguage
   * @returns {Promise<string>}
   */
  async generateExamplePairs(word, sentenceWithTilde, targetLanguage = 'English', nativeLanguage = 'Spanish') {
    try {
      const prompt = `You are writing study flashcards.\n\nTask:\n- The learner is studying the word "${word}" as used in this sentence (target language with tildes around the word): ${sentenceWithTilde}\n- Determine the exact sense of "${word}" from this sentence and keep that SAME meaning in all outputs.\n\nProduce:\n- 5 example sentences in ${targetLanguage} using the SAME SENSE of "${word}" as in the given sentence.\n- For each, produce a corresponding translation in ${nativeLanguage}.\n- Alternate them and separate every item with ' // ' exactly like this:\n  Target1 // Native1 // Target2 // Native2 // Target3 // Native3 // Target4 // Native4 // Target5 // Native5\n- In BOTH languages, wrap the target word (or its inflected form) in tildes: ~like this~.\n- Keep grammar natural; vary contexts, but do not change the meaning/sense from the original sentence.\n- If the original uses a phrasal/multiword expression, preserve the same expression/sense.\n\nFormatting rules (strict):\n- Return exactly ONE line, no commentary, no code fences.\n- Use exactly ' // ' as the separator between the 10 items.\n- Include exactly 10 items (5 target, 5 native), alternating target/native.\n- Ensure the target word is wrapped with ~ in BOTH languages in every item.`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text().trim();

      const segments = text.split('//').map(s => s.trim()).filter(Boolean);
      if (segments.length < 10) {
        throw new Error('Gemini did not return the required 10 items.');
      }
      return segments.slice(0, 10).join(' // ');
    } catch (error) {
      console.error('[PopupGeminiService] Error generating example pairs:', error);
      // Provide minimal fallback with the original sentence duplicated
      const fallback = Array.from({ length: 5 }).flatMap(() => [
        sentenceWithTilde || `~${word}~`,
        sentenceWithTilde || `~${word}~`
      ]).slice(0, 10).join(' // ');
      return fallback;
    }
  }
}

// Export singleton instance
module.exports = new PopupGeminiService();