/**
 * Utility functions for handling word clicks and marking
 */

/**
 * Extract the sentence containing a clicked word and mark the specific instance with tildes
 * @param {string} fullText - The full transcript text
 * @param {string} clickedWord - The word that was clicked
 * @param {number} clickPosition - The character position in the full text where the click occurred
 * @returns {string} The sentence with the clicked word instance marked with tildes
 */
export function markClickedWordInSentence(fullText, clickedWord, clickPosition) {
  if (!fullText || !clickedWord) {
    return `~${clickedWord}~`;
  }

  // Split into sentences
  const sentences = fullText.split(/(?<=[.!?])\s+/);
  
  // Find which sentence contains the click position
  let currentPos = 0;
  let targetSentence = '';
  
  for (const sentence of sentences) {
    const sentenceEnd = currentPos + sentence.length;
    
    if (clickPosition >= currentPos && clickPosition <= sentenceEnd) {
      targetSentence = sentence;
      
      // Find the specific word instance within this sentence
      const relativePosition = clickPosition - currentPos;
      
      // Split sentence into words while preserving positions
      const wordRegex = /(\b[\w']+\b|[^\w\s]+|\s+)/g;
      const tokens = [];
      let match;
      
      while ((match = wordRegex.exec(sentence)) !== null) {
        tokens.push({
          text: match[0],
          start: match.index,
          end: match.index + match[0].length
        });
      }
      
      // Find the clicked word token
      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        
        // Check if this token matches our word and contains the click position
        if (token.text.toLowerCase() === clickedWord.toLowerCase() &&
            relativePosition >= token.start && relativePosition <= token.end) {
          // Mark this specific instance
          tokens[i].text = `~${token.text}~`;
          break;
        }
      }
      
      // Reconstruct the sentence
      targetSentence = tokens.map(t => t.text).join('');
      break;
    }
    
    currentPos = sentenceEnd + 1; // +1 for the space after sentence
  }
  
  // If we didn't find the sentence or couldn't mark it, fall back
  if (!targetSentence || !targetSentence.includes('~')) {
    // Simple fallback: just find first occurrence in any sentence
    for (const sentence of sentences) {
      if (sentence.toLowerCase().includes(clickedWord.toLowerCase())) {
        // Mark the first occurrence
        const regex = new RegExp(`\\b(${clickedWord})\\b`, 'i');
        return sentence.replace(regex, '~$1~');
      }
    }
    
    // Ultimate fallback
    return `~${clickedWord}~`;
  }
  
  return targetSentence;
}

/**
 * Alternative simpler approach when we have the element that was clicked
 * @param {string} sentence - The sentence containing the word
 * @param {string} word - The word to mark
 * @param {number} wordIndex - The index of this specific word occurrence (0 for first, 1 for second, etc.)
 * @returns {string} The sentence with the specific word instance marked
 */
export function markWordByIndex(sentence, word, wordIndex = 0) {
  if (!sentence || !word) {
    return `~${word}~`;
  }
  
  const wordRegex = new RegExp(`\\b${word}\\b`, 'gi');
  let matchCount = 0;
  
  return sentence.replace(wordRegex, (match) => {
    if (matchCount === wordIndex) {
      matchCount++;
      return `~${match}~`;
    }
    matchCount++;
    return match;
  });
}

/**
 * Extract sentence containing a word from full text
 * @param {string} fullText - The full transcript
 * @param {string} word - The word to find
 * @returns {string} The sentence containing the word
 */
export function extractSentenceWithWord(fullText, word) {
  if (!fullText || !word) return '';
  
  // Split by sentence-ending punctuation
  const sentences = fullText.split(/(?<=[.!?])\s+/);
  
  // Find the sentence containing the word (case-insensitive)
  const wordLower = word.toLowerCase();
  const sentence = sentences.find(s => 
    s.toLowerCase().includes(wordLower)
  );
  
  return sentence || fullText.slice(0, 200) + '...'; // Fallback to first 200 chars
}