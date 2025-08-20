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
   * UNIFIED API: Get complete word data including definition, translation, frequency, and 5 example pairs
   * @param {string} word - The headword to define
   * @param {string} sentenceWithMarkedWord - Sentence with the clicked instance marked with tildes
   * @param {string} nativeLanguage - Language for translation and definition
   * @param {string} targetLanguage - Language for example sentences
   * @returns {Promise<Object>} Complete word data for both popup and flashcards
   */
  async getUnifiedWordData(word, sentenceWithMarkedWord, nativeLanguage = 'English', targetLanguage = 'English') {
    try {
      const prompt = `You are helping a language learner understand a word in context and create flashcard study materials.

Inputs:
- headword: "${word}"
- sentence with the clicked instance marked: "${sentenceWithMarkedWord}"
- nativeLanguage (for translation and definition): ${nativeLanguage}
- targetLanguage (for all example sentences): ${targetLanguage}

The sentence has tildes ~around~ the specific instance of the word that was clicked. This indicates which usage to define if the word appears multiple times or in different forms.

Task: Analyze the ~marked~ instance of the headword in the given sentence and produce study materials for THIS SPECIFIC SENSE only.

Output EXACTLY 7 lines in this format:
TRANSLATION: [translation in ${nativeLanguage}]
DEFINITION: [concise definition in ${nativeLanguage}, max 15 words]
FREQUENCY: [1-10 rating]
EXAMPLE1: [${targetLanguage} sentence with ~word~] // [${nativeLanguage} translation with ~palabra~]
EXAMPLE2: [${targetLanguage} sentence with ~word~] // [${nativeLanguage} translation with ~palabra~]
EXAMPLE3: [${targetLanguage} sentence with ~word~] // [${nativeLanguage} translation with ~palabra~]
EXAMPLE4: [${targetLanguage} sentence with ~word~] // [${nativeLanguage} translation with ~palabra~]
EXAMPLE5: [${targetLanguage} sentence with ~word~] // [${nativeLanguage} translation with ~palabra~]

Rules:
1. Focus on the EXACT sense/meaning of the ~marked~ instance in the given sentence
2. Frequency scale (1-10) for THIS SPECIFIC SENSE in contemporary general usage:
   • 10: Most basic function words (the, be, have, do, say, get, make, go, know, take)
   • 9: Essential everyday words (want, see, come, think, look, give, use, find, tell, ask)
   • 8: Very common daily words (work, try, need, feel, become, leave, put, mean, keep, let)
   • 7: Common general words (run, bring, happen, write, provide, sit, stand, lose, pay, meet)
   • 6: Moderately common (decide, develop, carry, break, receive, agree, support, hit, produce, eat)
   • 5: General but less frequent (contain, establish, define, benefit, combine, announce, examine, confirm, deny, emerge)
   • 4: Uncommon/formal (comprise, undertake, constitute, render, cease, endeavor, facilitate, adhere, allocate, ascertain)
   • 3: Academic/specialized (delineate, substantiate, reconcile, circumvent, corroborate, disseminate, extrapolate, mitigate, perpetuate, scrutinize)
   • 2: Rare/technical/literary (adjudicate, ameliorate, epitomize, ubiquitous, sanguine, penultimate, antediluvian, perspicacious, pusillanimous, verisimilitude)
   • 1: Extremely rare/archaic (tergiversate, callipygian, defenestration, sesquipedalian, hippopotomonstrosesquippedaliophobia, floccinaucinihilipilification, honorificabilitudinitatibus, antidisestablishmentarianism, pneumonoultramicroscopicsilicovolcanoconiosis, supercalifragilisticexpialidocious)
   When uncertain, err slightly LOWER rather than higher.
3. Each example sentence must:
   - Use the SAME sense/meaning as the ~marked~ instance in the original sentence
   - Include the word EXACTLY ONCE wrapped in tildes ~like this~
   - Be different contexts but same meaning
   - Be natural and idiomatic in both languages
4. The word may be inflected (conjugated/declined) but preserve the same sense
5. Wrap the translated word with tildes in the ${nativeLanguage} translations too
6. If the ~marked~ word is part of a phrasal verb or idiom (e.g., "give ~up~"), treat the entire phrase as the unit to define

No extra text, no commentary, no code fences, exactly 7 lines starting with the labels shown.`;

      console.log('[UnifiedWordData] Full prompt sent to Gemini:');
      console.log(prompt);

      const result = await this.model.generateContent(prompt);
      const text = (await result.response.text()).trim();

      console.log('[UnifiedWordData] Full response from Gemini:');
      console.log(text);

      // Parse the structured response
      const lines = text.split('\n').map(line => line.trim()).filter(line => line);
      
      if (lines.length < 7) {
        throw new Error(`Gemini returned insufficient data: expected 7 lines, got ${lines.length}`);
      }

      // Extract basic fields
      const translation = lines[0].replace(/^TRANSLATION:\s*/i, '').trim();
      const definition = lines[1].replace(/^DEFINITION:\s*/i, '').trim();
      const frequency = parseInt(lines[2].replace(/^FREQUENCY:\s*/i, '').trim()) || 5;

      // Parse example sentences
      const examples = [];
      for (let i = 3; i < 8 && i < lines.length; i++) {
        const line = lines[i].replace(/^EXAMPLE\d:\s*/i, '').trim();
        const parts = line.split('//').map(s => s.trim());
        if (parts.length >= 2) {
          examples.push({
            target: parts[0],
            native: parts[1]
          });
        }
      }

      // Ensure we have 5 examples (fill with defaults if needed)
      while (examples.length < 5) {
        examples.push({
          target: `~${word}~`,
          native: `~${word}~`
        });
      }

      // Format for different uses
      const exampleSentencesGenerated = examples
        .map(ex => `${ex.target} // ${ex.native}`)
        .join(' // ');

      return {
        word: word,
        translation: translation,
        definition: definition,
        frequency: Math.max(1, Math.min(10, frequency)),
        examples: examples,
        exampleSentencesGenerated: exampleSentencesGenerated,
        exampleForDictionary: examples[0]?.target || `~${word}~`,
        // Additional fields for compatibility
        contextualExplanation: definition,
        example: examples[0]?.target || `~${word}~`
      };

    } catch (error) {
      console.error('[PopupGeminiService] Error in getUnifiedWordData:', error);
      
      // Return fallback data
      return {
        word: word,
        translation: word,
        definition: 'Definition unavailable',
        frequency: 5,
        examples: Array(5).fill({ target: `~${word}~`, native: `~${word}~` }),
        exampleSentencesGenerated: Array(5).fill(`~${word}~ // ~${word}~`).join(' // '),
        exampleForDictionary: `~${word}~`,
        contextualExplanation: 'Definition unavailable',
        example: `~${word}~`,
        error: error.message
      };
    }
  }

  /**
   * DEPRECATED - Use getUnifiedWordData instead
   * Get the single best contextual sense for a headword within a sentence.
   * Returns { definitionNumber, translation, definition, example, frequency } | null
   */
  async getContextualSense(word, context, nativeLanguage = 'English', targetLanguage = 'English') {
    try {
      const sentence = this.extractSentence(word, context);
      const exampleLine = nativeLanguage === 'Spanish' && targetLanguage === 'English'
        ? '[1]//agua//un líquido claro esencial para la vida//~Water~ is essential for life.//8'
        : '[1]//TRANSLATION in ' + nativeLanguage + '//CONCISE DEFINITION in ' + nativeLanguage + '//Example in ' + targetLanguage + ' with ~word~//8';

      const prompt = `You are selecting the SINGLE best meaning of a headword as used in a specific sentence.

Inputs:
- headword: "${word}"
- sentence: "${sentence}"
- nativeLanguage (for translation and definition): ${nativeLanguage}
- targetLanguage (for example sentence): ${targetLanguage}

Task:
- Choose the ONE meaning that fits this sentence. Do NOT produce stylistic/register variants or minor nuance splits.
- Only output ONE line, using this strict format:
[1]//[NATIVE LANGUAGE TRANSLATION]//[CONCISE NATIVE LANGUAGE DEFINITION]//[TARGET LANGUAGE EXAMPLE SENTENCE WITH THE TARGET-LANGUAGE EQUIVALENT OF THE WORD WRAPPED IN TILDES ~like this~]//[FREQUENCY 1-10]

Example output (format only; do not reuse text):
${exampleLine}

Rules:
- Use ${nativeLanguage} for translation and concise definition.
- Use ${targetLanguage} for the example sentence.
- Ensure the example includes the target-language equivalent of the headword and that it is wrapped with tildes ~like this~.
- The target word must appear EXACTLY ONCE in the example sentence (i.e., the ~word~ markup appears once and only once).
- Frequency (1-10) should reflect contemporary general usage for THIS SENSE:
  • 9-10: basic function words or senses used constantly in everyday speech
  • 7-8: very common everyday vocabulary/senses
  • 5-6: moderately common; general but not everyday
  • 3-4: uncommon/academic/less frequent
  • 1-2: rare/technical/literary (e.g., "soliloquy" ≈ 2/10)
  When uncertain, err slightly LOWER rather than higher.
- Always include the frequency as the last field. If you truly cannot estimate, use 5.
- No extra commentary, no code fences, exactly one line. Be conservative; pick the single best fit.`;

      console.log('[ContextualSense] Full prompt sent to Gemini:');
      console.log(prompt);

      const result = await this.model.generateContent(prompt);
      const text = (await result.response.text()).trim();

      console.log('[ContextualSense] Full response from Gemini:');
      console.log(text);

      const parts = text.split('//').map(s => s.trim());
      let translation = '', definition = '', example = '', freq = '5';
      if (parts.length >= 5) {
        // With leading definition number
        translation = parts[1];
        definition = parts[2];
        example = parts[3];
        freq = parts[4];
      } else if (parts.length === 4) {
        // Without leading number – be lenient
        translation = parts[0];
        definition = parts[1];
        example = parts[2];
        freq = parts[3];
      } else if (parts.length === 3) {
        // Very lenient: no number and no frequency
        translation = parts[0];
        definition = parts[1];
        example = parts[2];
        freq = '5';
      } else {
        throw new Error('Bad format from Gemini for contextual sense');
      }
      return {
        definitionNumber: 1,
        translation: translation || '',
        definition: definition || '',
        example: example || '',
        frequency: Math.max(1, Math.min(10, parseInt(freq, 10) || 5))
      };
    } catch (err) {
      console.error('[PopupGeminiService] Error getting contextual sense:', err);
      return null;
    }
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
   * DEPRECATED - Use getUnifiedWordData instead
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
   * DEPRECATED - Use getUnifiedWordData instead (it includes all example pairs)
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
      const prompt = `You are writing study flashcards.\n\nTask:\n- The learner is studying the word "${word}" as used in this sentence (target language with tildes around the word): ${sentenceWithTilde}\n- Determine the exact sense of "${word}" from this sentence and keep that SAME meaning in all outputs.\n\nProduce:\n- 5 example sentences in ${targetLanguage} using the SAME SENSE of "${word}" as in the given sentence.\n- For each, produce a corresponding translation in ${nativeLanguage}.\n- Alternate them and separate every item with ' // ' exactly like this:\n  Target1 // Native1 // Target2 // Native2 // Target3 // Native3 // Target4 // Native4 // Target5 // Native5\n- In BOTH languages, wrap the target word (or its inflected form) in tildes: ~like this~.\n- Each sentence in BOTH languages must contain the target word (or its inflected form) EXACTLY ONCE (one and only one ~...~ per sentence).\n- Keep grammar natural; vary contexts, but do not change the meaning/sense from the original sentence.\n- If the original uses a phrasal/multiword expression, preserve the same expression/sense.\n\nFormatting rules (strict):\n- Return exactly ONE line, no commentary, no code fences.\n- Use exactly ' // ' as the separator between the 10 items.\n- Include exactly 10 items (5 target, 5 native), alternating target/native.\n- Ensure the target word is wrapped with ~ in BOTH languages in every item.`;

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

  /**
   * Get up to 5 sense candidates for a headword.
   * Returns array of { definitionNumber, translation, definition, example, frequency }
   */
  async getSenseCandidates(word, nativeLanguage = 'English', targetLanguage = 'English') {
    try {
      const exampleBlock = nativeLanguage === 'Spanish' && targetLanguage === 'English'
        ? '1//adiós//expresión usada al despedirse//~Goodbye~, see you tomorrow.//9\n2//cobrar//pedir o recibir dinero por un servicio//They will ~charge~ a fee.//7'
        : '1//TRANSLATION in ' + nativeLanguage + '//CONCISE DEFINITION in ' + nativeLanguage + '//Example in ' + targetLanguage + ' with ~word~//9';

      const prompt = `You are helping a language learner choose the correct senses of a headword written in the TARGET LANGUAGE.\n\nInputs:\n- headword: "${word}"\n- nativeLanguage (for translation and definition text): ${nativeLanguage}\n- targetLanguage (the language of the headword AND the example sentences): ${targetLanguage}\n\nLanguage check (STRICT, but diacritics tolerant):\n- If the headword is a valid word in ${targetLanguage} even when typed WITHOUT its diacritics/accents, treat it as ${targetLanguage}.\n- Only if the headword clearly does NOT belong to ${targetLanguage}, return EXACTLY this text and nothing else: WRONG LANGUAGE\n\nTask:\n1) Decide how many COMPLETELY DIFFERENT senses "${word}" has in modern usage. A word like "bank" (financial institution vs river bank) has multiple senses. A word like "study" (school vs research vs memorize) has only ONE sense. Only create multiple entries if the word has entirely different meanings that would require separate dictionary entries — NOT for register or minor nuance differences. If in doubt, use only ONE sense. Do not return more than FIVE lines.\n\n2) For each sense, output EXACTLY ONE line using THIS FORMAT (mandatory):\n[DEFINITION NUMBER]//[NATIVE LANGUAGE TRANSLATION]//[CONCISE NATIVE LANGUAGE DEFINITION]//[TARGET LANGUAGE EXAMPLE SENTENCE WITH THE EXACT HEADWORD STRING WRAPPED IN TILDES ~like this~ (NO SYNONYMS OR VARIANTS)]//[FREQUENCY 1-10]\n\nExample outputs (format only; do not reuse text):\n${exampleBlock}\n\nFrequency guidance (for THIS SENSE, in contemporary general usage):\n- 9-10: basic function words or senses used constantly in everyday speech\n- 7-8: very common everyday vocabulary/senses\n- 5-6: moderately common; general but not everyday\n- 3-4: uncommon/academic/less frequent\n- 1-2: rare/technical/literary (e.g., "soliloquy" ≈ 2/10)\nWhen uncertain, err slightly LOWER rather than higher.\n\nExample sentence constraint:\n- The target-language headword must appear EXACTLY ONCE in each example (the ~word~ markup appears one time and only one time).\n\nFormat rules (must follow):\n- Return ONLY lines, no extra commentary, no bullets, no code fences.\n- Include ALL FIVE fields. If unsure about frequency, put 5.\n- The example sentence MUST contain the EXACT headword string "${word}" in ${targetLanguage}, wrapped with tildes. Do NOT substitute synonyms.\n- Use ${nativeLanguage} for translation and definition.`;

      console.log('[Senses] Full prompt sent to Gemini:');
      console.log(prompt);

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = (response.text() || '').trim();

      console.log('[Senses] Full response from Gemini:');
      console.log(text);

      // Handle language mismatch sentinel
      if (text.toUpperCase().trim() === 'WRONG LANGUAGE') {
        return [{ wrongLanguage: true }];
      }

      // Extract only lines; cap to 5
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean).slice(0, 5);
      const senses = [];
      for (let i = 0; i < lines.length; i++) {
        const raw = lines[i];
        const parts = raw.split('//').map(s => s.trim());
        if (parts.length < 4) continue; // need at least number+3 fields OR 4 fields without number

        // Attempt to parse with optional missing frequency and optional missing number
        let numPart = parts[0];
        let translation = '', definition = '', example = '', freqPart = undefined;

        const parsedNum = parseInt(String(numPart).replace(/[^0-9]/g, ''), 10);
        if (!isNaN(parsedNum)) {
          // Has leading number
          translation = parts[1] || '';
          definition = parts[2] || '';
          example = parts[3] || '';
          freqPart = parts[4]; // may be undefined
        } else {
          // No number; treat first as translation
          translation = parts[0] || '';
          definition = parts[1] || '';
          example = parts[2] || '';
          freqPart = parts[3];
        }

        const frequency = Math.max(1, Math.min(10, parseInt(freqPart, 10) || 5));
        const definitionNumber = !isNaN(parsedNum) ? parsedNum : (i + 1);

        senses.push({
          definitionNumber,
          translation,
          definition,
          example,
          frequency,
        });
      }
      return senses;
    } catch (error) {
      console.error('[PopupGeminiService] Error getting sense candidates:', error);
      return [];
    }
  }
}

// Export singleton instance
module.exports = new PopupGeminiService();