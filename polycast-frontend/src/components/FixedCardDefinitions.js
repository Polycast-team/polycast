// This file contains fixed versions of key flashcard-related functions
// to resolve definition display issues and build failures

/**
 * Helper function to check if a word sense already exists in flashcards
 * @param {string} word - The word to check
 * @param {string} contextSentence - Context in which word appears
 * @param {number|null} definitionNumber - Optional definition number to match
 * @returns {boolean} - True if word sense exists, false otherwise
 */
export function doesWordSenseExist(wordDefinitions, word, contextSentence, definitionNumber = null) {
  if (!word || !contextSentence) return false;
  
  const wordLower = word.toLowerCase();
  
  // Check if this word has multiple senses
  const wordEntry = wordDefinitions[wordLower];
  if (wordEntry && wordEntry.hasMultipleSenses && Array.isArray(wordEntry.allSenses)) {
    for (const senseId of wordEntry.allSenses) {
      const sense = wordDefinitions[senseId];
      if (!sense || !sense.inFlashcards) continue;
      
      // If we're looking for a specific definition number and it matches
      if (definitionNumber !== null && sense.definitionNumber === definitionNumber) {
        return true;
      }
      
      // Check if the contexts are similar
      if (sense.contextSentence && contextSentence) {
        const sentenceA = sense.contextSentence.toLowerCase();
        const sentenceB = contextSentence.toLowerCase();
        if (sentenceA.includes(sentenceB) || sentenceB.includes(sentenceA)) {
          return true;
        }
      }
    }
  }
  
  // Generic check for any flashcard with the same word and similar context
  for (const [key, entry] of Object.entries(wordDefinitions)) {
    // Skip entries that aren't flashcards or are for different words
    if (!entry || !entry.inFlashcards) continue;
    if (entry.word && entry.word !== wordLower) continue;
    
    // If this is a wordSenseId entry like "charge24" check the definition number
    if (definitionNumber !== null && entry.definitionNumber === definitionNumber) {
      return true;
    }
    
    // Check if contexts are similar
    if (entry.contextSentence && contextSentence) {
      const entryContext = entry.contextSentence.toLowerCase();
      const currentContext = contextSentence.toLowerCase();
      
      // If one context contains the other, they're likely the same
      if (entryContext.includes(currentContext) || currentContext.includes(entryContext)) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Create a valid flashcard entry with proper definition storage
 * @param {string} wordLower - Lowercase word
 * @param {string} wordSenseId - Unique ID for this word sense
 * @param {string} contextSentence - Context sentence where word appears
 * @param {object|string} definition - Definition object or string
 * @param {string} partOfSpeech - Part of speech
 * @param {number} definitionNumber - Definition number
 * @returns {object} - Properly formatted flashcard entry
 */
export function createFlashcardEntry(wordLower, wordSenseId, contextSentence, definition, partOfSpeech, definitionNumber) {
  // Normalize definition to ensure it's stored in a consistent format
  const definitionText = typeof definition === 'string' 
    ? definition 
    : (definition?.definition || definition?.text || JSON.stringify(definition));
    
  // No placeholder image
  return {
    word: wordLower,
    imageUrl: null,
    wordSenseId: wordSenseId,
    contextSentence: contextSentence,
    // Store definitions in multiple formats to ensure compatibility
    disambiguatedDefinition: { 
      definition: definitionText,
      text: definitionText,
      partOfSpeech: partOfSpeech
    },
    definition: definitionText,
    text: definitionText, // Legacy field needed by FlashcardMode
    exampleSentence: contextSentence,
    inFlashcards: true,
    cardCreatedAt: new Date().toISOString(),
    partOfSpeech: partOfSpeech,
    definitionNumber: definitionNumber
  };
}

// Export a simple test function to verify imports are working
export function testModule() {
  return 'FlashcardDefinitions module loaded successfully';
}

/**
 * Fetch example sentence pairs from backend Gemini route.
 * @param {object} params
 * @param {string} params.word
 * @param {string} params.sentenceWithTilde
 * @param {string} params.targetLanguage
 * @param {string} params.nativeLanguage
 * @returns {Promise<string>} exampleSentencesGenerated joined with ' // '
 */
export async function fetchExamplePairs({ word, sentenceWithTilde, targetLanguage, nativeLanguage }) {
  // Lazy import config to avoid circular imports
  const { default: config } = await import('../config/config.js');
  const url = `${config.apiBaseUrl}/api/examples`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ word, sentenceWithTilde, targetLanguage, nativeLanguage })
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Examples API failed: ${response.status} ${text}`);
  }
  const data = await response.json();
  return data.exampleSentencesGenerated;
}
