/**
 * Card sorting and categorization utilities for SRS
 */

/**
 * Separates cards into seen and new categories
 * @param {Array} allCards - All available cards
 * @returns {Object} Object with seenCards and newCards arrays
 */
export function categorizeCards(allCards) {
  const seenCards = [];
  const newCards = [];
  
  allCards.forEach(card => {
    if (card.srsData?.isNew) {
      newCards.push(card);
    } else if (card.srsData) {
      seenCards.push(card);
    }
  });
  
  // Sort seen cards by due date (earliest first)
  seenCards.sort((a, b) => {
    const dateA = new Date(a.srsData.dueDate || a.srsData.nextReviewDate);
    const dateB = new Date(b.srsData.dueDate || b.srsData.nextReviewDate);
    return dateA - dateB;
  });
  
  // Sort new cards by frequency (most common first, i.e., higher numbers first)
  newCards.sort((a, b) => {
    const freqA = a.frequency || 3; // Default to neutral if no frequency
    const freqB = b.frequency || 3;
    return freqB - freqA;
  });
  
  return { seenCards, newCards };
}

/**
 * Gets cards that are due for review
 * @param {Array} seenCards - Cards that have been seen before
 * @param {Date} currentDate - Current date/time (defaults to now)
 * @returns {Array} Cards that are due or overdue
 */
export function getDueSeenCards(seenCards, currentDate = new Date()) {
  return seenCards.filter(card => {
    const dueDate = new Date(card.srsData.dueDate || card.srsData.nextReviewDate);
    return dueDate <= currentDate;
  });
}

/**
 * Builds a session queue from due cards and new cards
 * @param {Array} dueSeenCards - Seen cards that are due for review
 * @param {Array} newCards - Available new cards (already sorted by frequency)
 * @param {Number} newCardLimit - Maximum new cards to include
 * @returns {Array} Session queue with due cards first, then new cards
 */
export function buildSessionQueue(dueSeenCards, newCards, newCardLimit = 5) {
  const newCardsToInclude = newCards.slice(0, newCardLimit);
  return [...dueSeenCards, ...newCardsToInclude];
}

/**
 * Updates card arrays when a new card is seen for the first time
 * @param {Object} card - The card that was just reviewed
 * @param {Array} seenCards - Current seen cards array
 * @param {Array} newCards - Current new cards array
 * @returns {Object} Updated arrays { seenCards, newCards }
 */
export function updateCardArrays(card, seenCards, newCards) {
  if (!card.srsData?.isNew) {
    // Card is already in seen cards, just update it
    const updatedSeenCards = seenCards.map(c => 
      c.key === card.key ? card : c
    );
    
    // Re-sort by due date
    updatedSeenCards.sort((a, b) => {
      const dateA = new Date(a.srsData.dueDate || a.srsData.nextReviewDate);
      const dateB = new Date(b.srsData.dueDate || b.srsData.nextReviewDate);
      return dateA - dateB;
    });
    
    return { seenCards: updatedSeenCards, newCards };
  }
  
  // Card was new, now it's been seen
  // Remove from new cards
  const updatedNewCards = newCards.filter(c => c.key !== card.key);
  
  // Add to seen cards (it should already have a dueDate from being answered)
  const updatedSeenCards = [...seenCards, card];
  
  // Sort seen cards by due date
  updatedSeenCards.sort((a, b) => {
    const dateA = new Date(a.srsData.dueDate || a.srsData.nextReviewDate);
    const dateB = new Date(b.srsData.dueDate || b.srsData.nextReviewDate);
    return dateA - dateB;
  });
  
  return { seenCards: updatedSeenCards, newCards: updatedNewCards };
}