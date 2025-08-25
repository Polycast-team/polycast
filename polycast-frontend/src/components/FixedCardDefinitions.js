// This file contains fixed versions of key flashcard-related functions
// to resolve definition display issues and build failures

/**
 * Helper function to check if a word sense already exists in flashcards
 * @param {string} word - The word to check
 * @param {string} contextSentence - Context in which word appears
 * @param {number|null} definitionNumber - Optional definition number to match
 * @returns {boolean} - True if word sense exists, false otherwise
 */
// Removed unused doesWordSenseExist helper

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
// Removed unused testModule helper

