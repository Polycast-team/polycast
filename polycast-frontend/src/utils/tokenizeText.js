// Shared tokenizer for splitting text into words, punctuation, and spaces
// Keeps Unicode letters and diacritics intact for accurate word detection
export function tokenizeText(text = '') {
  if (!text) return [];
  return text.match(/([\p{L}\p{M}\d']+|[.,!?;:]+|\s+)/gu) || [];
}

export default tokenizeText;
