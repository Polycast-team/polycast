import { useState, useEffect, useRef, useMemo } from 'react';
import { getDueCards } from '../utils/srsAlgorithm';
import { getSRSSettings } from '../utils/srsSettings';
import { getHardcodedCards } from '../utils/hardcodedCards';

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
    // For non-saving mode, use hardcoded cards
    if (selectedProfile === 'non-saving') {
      const hardcodedCards = getHardcodedCards();
      return hardcodedCards;
    }

    // For other profiles, process actual wordDefinitions
    const cards = [];
    Object.entries(wordDefinitions).forEach(([key, value]) => {
      if (value && value.wordSenseId && value.inFlashcards) {
        // Initialize SRS data if it doesn't exist
        const cardWithSRS = { ...value, key };
        
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
    return cards;
  }, [wordDefinitions, selectedProfile]);
  
  // Initialize SRS data and get due cards - separated into its own effect
  useEffect(() => {
    const initializeDailyLimits = async () => {
      const today = new Date().toDateString();
      
      if (selectedProfile === 'non-saving') {
        // Non-saving mode: don't persist daily limits at all
        setTodaysNewCards(0);
      } else {
        // Profile mode: use database for daily limits
        try {
          const response = await fetch(`https://polycast-server.onrender.com/api/profile/${selectedProfile}/srs-daily`);
          if (response.ok) {
            const dailyData = await response.json();
            
            // Reset count if it's a new day
            if (dailyData.date !== today) {
              setTodaysNewCards(0);
              // Save reset to database
              await fetch(`https://polycast-server.onrender.com/api/profile/${selectedProfile}/srs-daily`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date: today, newCardsToday: 0 })
              });
            } else {
              setTodaysNewCards(dailyData.newCardsToday || 0);
            }
          } else {
            // First time or error - initialize
            setTodaysNewCards(0);
            await fetch(`https://polycast-server.onrender.com/api/profile/${selectedProfile}/srs-daily`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ date: today, newCardsToday: 0 })
            });
          }
        } catch (error) {
          console.error('Error loading daily SRS data:', error);
          setTodaysNewCards(0);
        }
      }
    };
    
    initializeDailyLimits();
  }, [selectedProfile]);
  
  // Separate effect for due cards that depends on todaysNewCards
  useEffect(() => {
    console.log(`[FLASHCARD SESSION] Starting study session for ${selectedProfile} with ${availableCards.length} flashcards`);
    
    // Get due cards using SRS algorithm with current settings
    const currentSettings = getSRSSettings();
    const maxNewToday = Math.max(0, currentSettings.newCardsPerDay - todaysNewCards);
    let due = getDueCards(availableCards, { newPerDay: maxNewToday }, false);
    
    // If no cards are strictly due, include waiting learning cards
    if (due.length === 0) {
      due = getDueCards(availableCards, { newPerDay: maxNewToday }, true);
    }
    
    console.log(`[CARD ORDER] Due cards:`, due);
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
  const isSessionComplete = dueCards.length === 0 && timeSinceLastProcess > 1000;
  
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