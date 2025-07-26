const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config/config');

class PopupGeminiService {
  constructor() {    
    this.genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
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
}

// Export singleton instance
module.exports = new PopupGeminiService();