import { useMemo } from 'react';

/**
 * Shared hook for flashcard calendar functionality
 * Calculates upcoming due dates for the next 8 days
 */
export function useFlashcardCalendar(
  dueCards,
  wordDefinitions,
  availableCards,
  selectedProfile,
  processedCards,
  calendarUpdateTrigger
) {
  // Calculate future due dates for calendar - using useMemo for proper reactivity
  const calendarData = useMemo(() => {
    const today = new Date();
    const nextWeekDays = [];
    
    // Building calendar for next 8 days
    
    // Get all cards with current session updates
    const currentCards = [];
    
    // Add cards from current session (dueCards) with their updated state
    dueCards.forEach(card => {
      currentCards.push(card);
    });
    
    // Add processed cards (cards that were answered and removed from session)
    processedCards.forEach(card => {
      currentCards.push(card);
    });
    
    // Add cards from wordDefinitions (for non-saving mode) or availableCards
    if (selectedProfile === 'non-saving') {
      // For non-saving mode, use availableCards but exclude those already in dueCards or processedCards
      availableCards.forEach(card => {
        const alreadyInSession = dueCards.some(sessionCard => 
          sessionCard.key === card.key || sessionCard.wordSenseId === card.wordSenseId
        );
        const alreadyProcessed = processedCards.some(processedCard => 
          processedCard.key === card.key || processedCard.wordSenseId === card.wordSenseId
        );
        if (!alreadyInSession && !alreadyProcessed) {
          currentCards.push(card);
        }
      });
    } else {
      // For other profiles, use updated wordDefinitions data
      Object.entries(wordDefinitions).forEach(([key, value]) => {
        if (value && value.wordSenseId && value.inFlashcards) {
          const alreadyInSession = dueCards.some(sessionCard => 
            sessionCard.key === key || sessionCard.wordSenseId === value.wordSenseId
          );
          const alreadyProcessed = processedCards.some(processedCard => 
            processedCard.key === key || processedCard.wordSenseId === value.wordSenseId
          );
          if (!alreadyInSession && !alreadyProcessed) {
            currentCards.push({ ...value, key });
          }
        }
      });
    }
    
    for (let i = 0; i < 8; i++) { // Extended to 8 days to catch more future cards
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      date.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      // Find cards due on this day using current session data
      const cardsForDay = currentCards.filter(card => {
        if (!card.srsData) return false;
        
        const dueDate = new Date(card.srsData.dueDate || card.srsData.nextReviewDate);
        
        // Compare just the date parts, ignoring time
        const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
        const dayDateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const isInRange = dueDateOnly.getTime() === dayDateOnly.getTime();
        
        // Check if card is due on this specific day
        
        return isInRange;
      });
      
      nextWeekDays.push({
        date,
        cards: cardsForDay,
        dayName: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : date.toLocaleDateString('en-US', { weekday: 'short' }),
        dateStr: date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })
      });
    }
    
    return nextWeekDays;
  }, [dueCards, wordDefinitions, availableCards, selectedProfile, processedCards, calendarUpdateTrigger]);

  return {
    calendarData
  };
}