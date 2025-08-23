import { useCallback } from 'react';
import { calculateNextReview, formatNextReviewTime, getDueCards } from '../utils/srsAlgorithm';
import { getSRSSettings } from '../utils/srsSettings';

/**
 * Shared hook for SRS (Spaced Repetition System) functionality
 * Handles card marking, progress tracking, and queue management
 */
export function useFlashcardSRS(
  sessionData,
  setWordDefinitions,
  selectedProfile,
  currentAudio,
  setCurrentAudio,
  setAudioState
) {
  const {
    dueCards,
    setDueCards,
    currentDueIndex,
    setCurrentDueIndex,
    todaysNewCards,
    setTodaysNewCards,
    setSessionCounts,
    setStats,
    setIsFlipped,
    setProcessedCards,
    setCalendarUpdateTrigger,
    processingCardRef,
    lastCardProcessedTime
  } = sessionData;

  const srsSettings = getSRSSettings();

  // Card marking function
  const markCard = useCallback((answer) => {
    if (!dueCards[currentDueIndex]) return;
    if (processingCardRef.current) return;
    
    const currentCard = dueCards[currentDueIndex];
    
    // Stop any currently playing audio when marking a card
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setCurrentAudio(null);
      setAudioState({ loading: false, error: null });
    }
    
    // Log user's response
    console.log(`[USER RESPONSE] User clicked "${answer}" for card "${currentCard.word}"`);
    
    // Set processing flag to prevent useEffect from running
    processingCardRef.current = true;
    
    // Mark when we processed this card
    lastCardProcessedTime.current = Date.now();
    
    // Calculate next review using SRS algorithm
    const updatedSrsData = calculateNextReview(currentCard, answer);
    
    // Log the result of the SRS calculation
    console.log(`[SRS RESULT] Card "${currentCard.word}" updated:`, {
      from: {
        status: currentCard.srsData.status,
        isNew: currentCard.srsData.isNew,
        gotWrongThisSession: currentCard.srsData.gotWrongThisSession,
        SRS_interval: currentCard.srsData.SRS_interval
      },
      to: {
        status: updatedSrsData.status,
        isNew: updatedSrsData.isNew,
        gotWrongThisSession: updatedSrsData.gotWrongThisSession,
        SRS_interval: updatedSrsData.SRS_interval,
        nextReview: formatNextReviewTime(updatedSrsData.nextReviewDate)
      }
    });
    
    // Update session counts based on card transitions
    setSessionCounts(prevCounts => {
      const newCounts = { ...prevCounts };
      
      // Current card state
      const wasNew = currentCard.srsData.isNew;
      const wasLearning = currentCard.srsData.gotWrongThisSession && !wasNew;
      const wasReview = !wasNew && !currentCard.srsData.gotWrongThisSession;
      
      // New card state after answer
      const isNowNew = updatedSrsData.isNew;
      const isNowLearning = updatedSrsData.gotWrongThisSession && !isNowNew;
      const isNowReview = !isNowNew && !updatedSrsData.gotWrongThisSession;
      
      // Decrement the old category
      if (wasNew) newCounts.newCount = Math.max(0, newCounts.newCount - 1);
      else if (wasLearning) newCounts.learningCount = Math.max(0, newCounts.learningCount - 1);
      else if (wasReview) newCounts.reviewCount = Math.max(0, newCounts.reviewCount - 1);
      
      // Only increment if the card is still due today (not graduated to tomorrow or later)
      const now = new Date();
      const updatedDueDate = new Date(updatedSrsData.nextReviewDate);
      const stillDueToday = (updatedDueDate - now) < (24 * 60 * 60 * 1000);
      
      if (stillDueToday) {
        // Increment the new category
        if (isNowNew) newCounts.newCount += 1; // This should never happen
        else if (isNowLearning) newCounts.learningCount += 1;
        else if (isNowReview) newCounts.reviewCount += 1;
      }
      
      return newCounts;
    });
    
    // Update the card in wordDefinitions with new SRS data
    const updatedCard = {
      ...currentCard,
      srsData: updatedSrsData
    };
    
    // Prepare all state updates to happen together
    const now = new Date();
    const updatedDueDate = new Date(updatedSrsData.dueDate || updatedSrsData.nextReviewDate);
    
    // Check if card is still due today (within next few hours, not full 24 hours)
    // Cards with intervals like "1 day", "3 days" should be removed from today's session
    const todayMidnight = new Date(now);
    todayMidnight.setHours(23, 59, 59, 999); // End of today
    const stillDueToday = updatedDueDate <= todayMidnight;
    
    // Debug logging to see what's happening
    console.log(`[SESSION DEBUG] Card "${currentCard.word}" - Due: ${updatedDueDate.toLocaleString()}, Today ends: ${todayMidnight.toLocaleString()}, Still due today: ${stillDueToday}, SRS_interval: ${updatedSrsData.SRS_interval}`);
    
    // Calculate new due cards array
    let newDueCards;
    let newDueIndex;
    
    if (stillDueToday && (updatedSrsData.SRS_interval <= 2)) {
      // Only keep in queue if due today AND still in minute-based intervals (1-2)
      // Move card to end of queue for re-review later today
      console.log(`[SESSION DEBUG] Keeping card "${currentCard.word}" in today's session`);
      newDueCards = [...dueCards];
      newDueCards.splice(currentDueIndex, 1);
      newDueCards.push(updatedCard);
      newDueIndex = currentDueIndex >= newDueCards.length ? 0 : currentDueIndex;
    } else {
      // Remove card from today's queue (graduated to tomorrow or later)
      console.log(`[SESSION DEBUG] Removing card "${currentCard.word}" from today's session`);
      newDueCards = dueCards.filter((_, index) => index !== currentDueIndex);
      newDueIndex = currentDueIndex >= newDueCards.length && newDueCards.length > 0 ? newDueCards.length - 1 : currentDueIndex;
      
      // Add the updated card to processedCards so it appears in calendar with new due date
      setProcessedCards(prev => [...prev, updatedCard]);
      setCalendarUpdateTrigger(prev => prev + 1); // Force calendar re-render
    }
    
    // Batch all state updates together to prevent UI flashing
    setWordDefinitions(prev => ({
      ...prev,
      [currentCard.key]: updatedCard
    }));
    
    setStats(prev => ({
      ...prev,
      cardsReviewed: prev.cardsReviewed + 1,
      correctAnswers: answer !== 'incorrect' ? prev.correctAnswers + 1 : prev.correctAnswers
    }));
    
    // Update new cards count if necessary
    if (currentCard.srsData.status === 'new') {
      const newCount = todaysNewCards + 1;
      setTodaysNewCards(newCount);
      
      // TODO: Re-enable when SRS daily endpoints are deployed to production
      // if (selectedProfile !== 'non-saving') {
      //   const today = new Date().toDateString();
      //   fetch(`https://polycast-server.onrender.com/api/profile/${selectedProfile}/srs-daily`, {
      //     method: 'POST',
      //     headers: { 'Content-Type': 'application/json' },
      //     body: JSON.stringify({ date: today, newCardsToday: newCount })
      //   }).catch(error => {
      //     console.error('Error saving daily SRS count:', error);
      //   });
      // }
    }
    
    // Single timeout for all card transition logic
    setTimeout(() => {
      // Reset flip state first, then update cards
      setIsFlipped(false);
      
      // Small delay to ensure flip completes before changing cards
      setTimeout(() => {
        setDueCards(newDueCards);
        setCurrentDueIndex(newDueIndex);
        
        // Auto-refresh queue if no cards left but there might be more due
        if (newDueCards.length === 0) {
          setTimeout(() => {
            const updatedAvailableCards = [];
            Object.entries(setWordDefinitions._currentValue || {}).forEach(([key, value]) => {
              const cardToCheck = updatedCard.key === key ? updatedCard : value;
              if (cardToCheck && cardToCheck.wordSenseId && cardToCheck.inFlashcards) {
                updatedAvailableCards.push({ ...cardToCheck, key });
              }
            });
            
            const maxNewForRefresh = Math.max(0, srsSettings.newCardsPerDay - todaysNewCards);
            let refreshedDueCards = getDueCards(updatedAvailableCards, { newPerDay: maxNewForRefresh }, false);
            
            if (refreshedDueCards.length === 0) {
              refreshedDueCards = getDueCards(updatedAvailableCards, { newPerDay: maxNewForRefresh }, true);
            }
            
            console.log(`[SESSION DEBUG] Auto-refreshing queue: found ${refreshedDueCards.length} cards`);
            setDueCards(refreshedDueCards);
            setCurrentDueIndex(0);
          }, 100);
        } else {
          // Clear processing flag after card state is updated
          processingCardRef.current = false;
        }
      }, 200);
    }, 200);
  }, [
    dueCards, 
    currentDueIndex, 
    setWordDefinitions, 
    todaysNewCards, 
    selectedProfile, 
    srsSettings, 
    currentAudio,
    setCurrentAudio,
    setAudioState,
    setDueCards,
    setCurrentDueIndex,
    setTodaysNewCards,
    setSessionCounts,
    setStats,
    setIsFlipped,
    setProcessedCards,
    setCalendarUpdateTrigger,
    processingCardRef,
    lastCardProcessedTime
  ]);

  return {
    markCard
  };
}