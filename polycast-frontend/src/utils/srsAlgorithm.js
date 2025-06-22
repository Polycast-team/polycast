/**
 * Spaced Repetition System (SRS) Algorithm
 * Based on SM-2 algorithm with 3 answer buttons: Incorrect, Correct, Easy
 */

import { getSRSSettings } from './srsSettings';

/**
 * Calculate the next review date and update SRS data based on user's answer
 * Simple SRS system with SRS_interval progression
 * @param {Object} card - The flashcard with srsData
 * @param {string} answer - 'incorrect', 'correct', or 'easy'
 * @returns {Object} Updated srsData
 */
export function calculateNextReview(card, answer) {
  const srsData = { ...card.srsData };
  const now = new Date();
  
  // Time intervals mapping: SRS_interval → actual time
  const timeIntervals = {
    1: { minutes: 1 },       // 1 minute
    2: { minutes: 10 },      // 10 minutes
    3: { days: 1 },          // 1 day
    4: { days: 3 },          // 3 days
    5: { days: 7 },          // 1 week
    6: { days: 14 },         // 2 weeks
    7: { days: 30 },         // 1 month
    8: { days: 60 },         // 2 months
    9: { days: 120 }         // 4 months
  };
  
  const updated = { ...srsData };
  updated.lastReviewDate = now.toISOString();
  updated.lastSeen = now.toISOString();
  
  // Handle new card first answer
  if (updated.isNew) {
    updated.isNew = false;
    updated.SRS_interval = 1;
    
    if (answer === 'incorrect') {
      updated.gotWrongThisSession = true;
      updated.SRS_interval = 1;
    } else if (answer === 'correct') {
      updated.gotWrongThisSession = false;
      updated.SRS_interval += 1;
    } else if (answer === 'easy') {
      updated.gotWrongThisSession = false;
      updated.SRS_interval += 2;
    }
  } else {
    // Handle non-new cards
    if (answer === 'incorrect') {
      updated.gotWrongThisSession = true;
      updated.SRS_interval = 1;
    } else if (answer === 'correct') {
      updated.gotWrongThisSession = false;
      updated.SRS_interval += 1;
    } else if (answer === 'easy') {
      updated.gotWrongThisSession = false;
      updated.SRS_interval += 2;
    }
  }
  
  // Cap the interval at maximum
  updated.SRS_interval = Math.min(updated.SRS_interval, 9);
  
  // Calculate next review date
  const interval = timeIntervals[updated.SRS_interval];
  if (interval.minutes) {
    updated.dueDate = addMinutes(now, interval.minutes).toISOString();
    updated.nextReviewDate = updated.dueDate; // Keep for backwards compatibility
  } else {
    updated.dueDate = addDays(now, interval.days).toISOString();
    updated.nextReviewDate = updated.dueDate; // Keep for backwards compatibility
  }
  
  // Set status for display
  if (updated.isNew) {
    updated.status = 'new';
  } else if (updated.gotWrongThisSession) {
    updated.status = 'relearning';
  } else {
    updated.status = 'learning';
  }
  
  // Update counters
  updated.correctCount = (updated.correctCount || 0) + (answer !== 'incorrect' ? 1 : 0);
  updated.incorrectCount = (updated.incorrectCount || 0) + (answer === 'incorrect' ? 1 : 0);
  
  return updated;
}


/**
 * Get cards due for review, sorted by priority
 * @param {Array} allCards - All flashcard objects
 * @param {Object} settings - Review settings (newPerDay, etc.)
 * @param {boolean} includeWaiting - Include learning cards that are waiting (not yet due)
 * @returns {Array} Cards ready for review
 */
export function getDueCards(allCards, overrides = {}, includeWaiting = false) {
  const now = new Date();
  const srsSettings = getSRSSettings();
  const maxNew = overrides.newPerDay !== undefined ? overrides.newPerDay : srsSettings.newCardsPerDay;
  
  // Filter cards that have srsData
  const cardsWithSRS = allCards.filter(card => card.srsData);
  
  // Separate cards by status and due date
  const strictlyDueCards = cardsWithSRS.filter(card => {
    const dueDate = new Date(card.srsData.dueDate || card.srsData.nextReviewDate);
    return dueDate <= now && card.srsData.status !== 'new';
  });
  
  // Learning cards that are waiting (not yet due but in learning phase)
  const waitingLearningCards = cardsWithSRS.filter(card => {
    const dueDate = new Date(card.srsData.dueDate || card.srsData.nextReviewDate);
    return dueDate > now && 
           (card.srsData.status === 'learning' || card.srsData.status === 'relearning') &&
           (dueDate - now) < (24 * 60 * 60 * 1000); // Due within 24 hours
  });
  
  // Get new cards, sorted by frequency if available
  const newCards = cardsWithSRS.filter(card => card.srsData.status === 'new');
  newCards.sort((a, b) => {
    const freqA = a.frequency || 5; // Default to neutral if no frequency (1-10 scale)
    const freqB = b.frequency || 5;
    return freqB - freqA; // Higher frequency value = more common = higher priority
  });
  
  // Sort due cards by due date (earliest first)
  strictlyDueCards.sort((a, b) => {
    const dateA = new Date(a.srsData.dueDate || a.srsData.nextReviewDate);
    const dateB = new Date(b.srsData.dueDate || b.srsData.nextReviewDate);
    return dateA - dateB;
  });
  
  // Base queue: due cards first (sorted by date), then new cards (sorted by frequency)
  const baseQueue = [
    ...strictlyDueCards,
    ...newCards.slice(0, maxNew)
  ];
  
  // If we're including waiting cards (when no other cards available), add them
  if (includeWaiting && baseQueue.length === 0) {
    // Sort waiting cards by how close they are to being due
    const sortedWaitingCards = waitingLearningCards.sort((a, b) => {
      const dateA = new Date(a.srsData.dueDate || a.srsData.nextReviewDate);
      const dateB = new Date(b.srsData.dueDate || b.srsData.nextReviewDate);
      return dateA - dateB;
    });
    return sortedWaitingCards;
  }
  
  return baseQueue;
}

/**
 * Get statistics for today's reviews
 * @param {Array} allCards - All flashcard objects
 * @returns {Object} Statistics object
 */
export function getReviewStats(allCards) {
  const now = new Date();
  const cardsWithSRS = allCards.filter(card => card.srsData);
  
  const stats = {
    new: 0,
    learning: 0,
    review: 0,
    relearning: 0,
    dueToday: 0,
    total: cardsWithSRS.length
  };
  
  cardsWithSRS.forEach(card => {
    const status = card.srsData.status;
    stats[status]++;
    
    const dueDate = new Date(card.srsData.dueDate || card.srsData.nextReviewDate);
    if (dueDate <= now) {
      stats.dueToday++;
    }
  });
  
  return stats;
}

// Helper functions
function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}

function addDays(date, days) {
  const targetDate = new Date(date);
  targetDate.setDate(targetDate.getDate() + days);
  // Set to beginning of day (midnight) so it's available anytime that day
  targetDate.setHours(0, 0, 0, 0);
  return targetDate;
}

/**
 * Format the next review time for display
 * @param {string} nextReviewDate - ISO date string
 * @returns {string} Human-readable time until next review
 */
export function formatNextReviewTime(nextReviewDate) {
  const now = new Date();
  const reviewDate = new Date(nextReviewDate);
  const diffMs = reviewDate - now;
  
  if (diffMs <= 0) return 'Now';
  
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
  
  // Calculate days more accurately for midnight-based scheduling
  // If the review date is set to midnight, count full calendar days
  const todayMidnight = new Date(now);
  todayMidnight.setHours(0, 0, 0, 0);
  const reviewMidnight = new Date(reviewDate);
  reviewMidnight.setHours(0, 0, 0, 0);
  const diffDays = Math.round((reviewMidnight - todayMidnight) / (24 * 60 * 60 * 1000));
  
  // Show clean intervals that match SRS_interval mapping
  // Handle edge cases where times might be slightly off due to processing time
  if (diffMins <= 1) return '1 min';
  if (diffMins >= 9 && diffMins <= 11) return '10 min';
  if (diffMins < 60) {
    // For other minute values, round to nearest interval
    if (diffMins < 5) return '1 min';
    else return '10 min';
  }
  
  // For days, check from largest to smallest intervals
  if (diffDays >= 120) return '4 months';
  if (diffDays >= 60) return '2 months';
  if (diffDays >= 30) return '1 month';
  if (diffDays >= 14) return '2 weeks';
  if (diffDays >= 7) return '1 week';
  if (diffDays >= 3) return '3 days';
  if (diffDays >= 1) return '1 day';
  
  // Should never get here, but just in case
  return '1 day';
}