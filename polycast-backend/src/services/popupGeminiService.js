const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config/config');

class PopupGeminiService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(config.geminiApiKey);
    // Configure Gemini with thinking off
    this.model = this.genAI.getGenerativeModel({
      model: config.geminiChatModel,
      generationConfig: {
        temperature: 0.1,
        topK: 1,
        topP: 0.1,
        maxOutputTokens: 512,
      }
    });
  }

  /**
   * QUICK LOOKUP: Return a single-line translation + concise explanation for the marked instance
   * Output format: "TRANSLATION//EXPLANATION"
   */
  async getQuickSenseSummary(word, sentenceWithMarkedWord, nativeLanguage = 'English', targetLanguage = 'English') {
    try {
      const prompt = `You are helping a language learner quickly understand a word in context.

Inputs:
- headword: "${word}"
- sentence with the clicked instance marked: "${sentenceWithMarkedWord}"
- nativeLanguage: ${nativeLanguage}
- targetLanguage (language of the sentence/headword): ${targetLanguage}

Task:
Analyze the ~marked~ instance of the headword in the sentence and return EXACTLY ONE LINE:
[TRANSLATION in ${nativeLanguage}]//[CONCISE ${nativeLanguage} EXPLANATION of the meaning in THIS SENTENCE (<= 15 words)]

Rules:
- Focus on the ~marked~ instance only
- No extra text, no labels, no code fences
- Output exactly one line with "//" as separator`;

      if (process.env.LOG_GEMINI === 'true') {
        console.log('[QuickSense] Full prompt sent to Gemini:');
        console.log(prompt);
      }

      const result = await this.model.generateContent(prompt);
      const text = (await result.response.text()).trim();

      if (process.env.LOG_GEMINI === 'true') {
        console.log('[QuickSense] Full response from Gemini:');
        console.log(text);
      }

      const parts = text.split('//').map(s => s.trim());
      const translation = parts[0] || word;
      const explanation = parts[1] || '';
      return { translation, definition: explanation };
    } catch (error) {
      console.error('[PopupGeminiService] Error in getQuickSenseSummary:', error);
      return { translation: word, definition: '' };
    }
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

      if (process.env.LOG_GEMINI === 'true') {
        console.log('[UnifiedWordData] Full prompt sent to Gemini:');
        console.log(prompt);
      }

      const result = await this.model.generateContent(prompt);
      const text = (await result.response.text()).trim();

      if (process.env.LOG_GEMINI === 'true') {
        console.log('[UnifiedWordData] Full response from Gemini:');
        console.log(text);
      }

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
        example: examples[0]?.target || `~${word}~`,
        rawText: text
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
