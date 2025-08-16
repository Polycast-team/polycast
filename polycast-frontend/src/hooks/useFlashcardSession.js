import { useState, useEffect, useRef, useMemo } from 'react';
import { getDueCards } from '../utils/srsAlgorithm';
import { getSRSSettings } from '../utils/srsSettings';

/**
 * Shared hook for managing flashcard session state
 * Used by both desktop and mobile flashcard components
 */
export function useFlashcardSession(selectedProfile, wordDefinitions) {
  // Core session state
  const [currentDueIndex, setCurrentDueIndex] = useState(0);
  const [dueCards, setDueCards] = useState([]);
  const [todaysNewCards, setTodaysNewCards] = useState(0);
  const [sessionCounts, setSessionCounts] = useState({ 
    newCount: 0, 
    learningCount: 0, 
    reviewCount: 0 
  });
  const [isFlipped, setIsFlipped] = useState(false);
  const [processedCards, setProcessedCards] = useState([]);
  const [calendarUpdateTrigger, setCalendarUpdateTrigger] = useState(0);
  
  // Session statistics
  const [stats, setStats] = useState({
    cardsReviewed: 0,
    correctAnswers: 0,
    sessionStartTime: new Date()
  });
  
  // Refs for tracking
  const processingCardRef = useRef(false);
  const lastCardProcessedTime = useRef(Date.now());
  const nowDateRef = useRef(new Date().toISOString());
  
  // Process the wordDefinitions to extract all word senses and initialize SRS data
  const availableCards = useMemo(() => {
    // Process actual wordDefinitions (non-saving mode will be empty until user adds)
    const cards = [];
    const totalWords = Object.keys(wordDefinitions).length;
    let wordsWithFlashcards = 0;
    let wordsWithoutFlashcards = 0;
    
    Object.entries(wordDefinitions).forEach(([key, value]) => {
      if (value && value.wordSenseId) {
        if (value.inFlashcards) {
          wordsWithFlashcards++;
        } else {
          wordsWithoutFlashcards++;
        }
      }
      
      // TEMPORARY FIX: Include all words with definitions, not just those marked inFlashcards
      if (value && value.wordSenseId) {
        // Initialize SRS data if it doesn't exist
        const cardWithSRS = { ...value, key };
        // Do not synthesize example sentences here (strict removal)
        
        // Ensure frequency field exists (use wordFrequency if available)
        if (!cardWithSRS.frequency && cardWithSRS.wordFrequency) {
          cardWithSRS.frequency = cardWithSRS.wordFrequency;
        }
        
        if (!cardWithSRS.srsData) {
          cardWithSRS.srsData = {
            isNew: true,
            gotWrongThisSession: false,
            SRS_interval: 1,
            status: 'new',
            correctCount: 0,
            incorrectCount: 0,
            dueDate: null,
            lastSeen: null,
            lastReviewDate: null,
            nextReviewDate: nowDateRef.current // Due now
          };
        } else {
          // Migrate old SRS data format to new format
          const srs = cardWithSRS.srsData;
          if (srs.interval !== undefined && srs.SRS_interval === undefined) {
            // Old format detected, migrate to new format
            srs.SRS_interval = srs.interval === 0 ? 1 : Math.min(srs.interval, 9);
            srs.isNew = srs.status === 'new';
            srs.gotWrongThisSession = false;
            srs.correctCount = srs.repetitions || 0;
            srs.incorrectCount = srs.lapses || 0;
            srs.dueDate = srs.dueDate || srs.nextReviewDate;
            srs.lastSeen = srs.lastReviewDate;
          }
        }
        
        cards.push(cardWithSRS);
      }
    });
    
    console.log(`[DEBUG] Profile ${selectedProfile}: ${totalWords} total words, ${wordsWithFlashcards} with inFlashcards=true, ${wordsWithoutFlashcards} without inFlashcards, ${cards.length} final cards`);
    
    return cards;
  }, [wordDefinitions, selectedProfile]);
  
  // Initialize SRS data and get due cards - separated into its own effect
  useEffect(() => {
    const initializeDailyLimits = async () => {
      const today = new Date().toDateString();
      // Persistence disabled for now; set local counters only.
      // TODO: Integrate Firebase and re-enable per-profile daily limits.
      setTodaysNewCards(0);
    };
    
    initializeDailyLimits();
  }, [selectedProfile]);
  
  // Separate effect for due cards that depends on todaysNewCards
  useEffect(() => {
    console.log(`[FLASHCARD SESSION] Starting study session for ${selectedProfile} with ${availableCards.length} flashcards`);
    
    // Get due cards using SRS algorithm with current settings
    const currentSettings = getSRSSettings();
    const maxNewToday = Math.max(0, currentSettings.newCardsPerDay - todaysNewCards);
    console.log(`[DEBUG] SRS settings: newCardsPerDay=${currentSettings.newCardsPerDay}, todaysNewCards=${todaysNewCards}, maxNewToday=${maxNewToday}`);
    
    let due = getDueCards(availableCards, { newPerDay: maxNewToday }, false);
    console.log(`[DEBUG] First pass: ${due.length} due cards found (strict mode)`);
    
    // If no cards are strictly due, include waiting learning cards
    if (due.length === 0) {
      due = getDueCards(availableCards, { newPerDay: maxNewToday }, true);
      console.log(`[DEBUG] Second pass: ${due.length} due cards found (include waiting)`);
    }
    
    console.log(`[CARD ORDER] Final due cards:`, due);
    setDueCards(due);
    setCurrentDueIndex(0);
    setIsFlipped(false);
  }, [availableCards, wordDefinitions, todaysNewCards, selectedProfile]);
  
  // Calculate header stats
  const headerStats = useMemo(() => {
    const newCards = dueCards.filter(card => card.srsData.isNew).length;
    const learningCards = dueCards.filter(card => card.srsData.gotWrongThisSession && !card.srsData.isNew).length;
    const reviewCards = dueCards.filter(card => !card.srsData.isNew && !card.srsData.gotWrongThisSession).length;
    const accuracy = stats.cardsReviewed > 0 ? Math.round((stats.correctAnswers / stats.cardsReviewed) * 100) : 100;
    
    return {
      newCards,
      learningCards,
      reviewCards,
      cardsReviewed: stats.cardsReviewed,
      accuracy
    };
  }, [dueCards, stats]);
  
  // Get current card
  const currentCard = dueCards[currentDueIndex] || null;
  
  // Session duration
  const sessionDuration = Math.floor((new Date() - stats.sessionStartTime) / 1000 / 60);
  
  // Check if session is complete
  const timeSinceLastProcess = Date.now() - lastCardProcessedTime.current;
  // Only consider session complete if cards were actually reviewed (not just empty from start)
  const isSessionComplete = dueCards.length === 0 && timeSinceLastProcess > 1000 && stats.cardsReviewed > 0;
  
  return {
    // State
    currentDueIndex,
    setCurrentDueIndex,
    dueCards,
    setDueCards,
    todaysNewCards,
    setTodaysNewCards,
    sessionCounts,
    setSessionCounts,
    isFlipped,
    setIsFlipped,
    processedCards,
    setProcessedCards,
    calendarUpdateTrigger,
    setCalendarUpdateTrigger,
    stats,
    setStats,
    
    // Refs
    processingCardRef,
    lastCardProcessedTime,
    
    // Computed values
    availableCards,
    headerStats,
    currentCard,
    sessionDuration,
    isSessionComplete
  };
}