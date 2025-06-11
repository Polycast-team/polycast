export interface WordPopupData {
  word: string;
  sentence: string;
  translation: string;
  definition: string;
  partOfSpeech: string;
  lemmatizedWord?: string;
  displayWord?: string;
  x: number;
  y: number;
  targetWidth: number;
}

export interface TranscriptMessage {
  speaker: 'user' | 'model' | 'partner';
  text: string;
  id: string;
}

export interface DictionaryEntry {
  word: string;
  translation: string;
  definition: string;
  partOfSpeech: string;
  sentenceContext: string;
  frequency: number | null;
  rank: number | null;
  dateAdded: number;
}

export interface FlashcardExampleSentence {
  english: string;
  portugueseTranslation: string;
}

export interface Flashcard {
  id: string;
  originalWordKey: string;
  dictionaryEntry: DictionaryEntry;
  exampleSentences: FlashcardExampleSentence[];
  status: 'new' | 'learning' | 'review';
  correctCount: number;
  incorrectCount: number;
  interval: number;
  easeFactor: number;
  dueDate: number;
  lastReviewed: number;
  learningStep: number;
}

export interface EvaluationSuggestion {
  category: string;
  description: string;
}

export interface EvaluationData {
  improvementAreas: EvaluationSuggestion[];
  cefrLevel: string;
}
