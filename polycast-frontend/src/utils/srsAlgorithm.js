/**
 * Spaced Repetition System (SRS) Algorithm
 * Based on SM-2 algorithm with 3 answer buttons: Incorrect, Correct, Easy
 */

import { getSRSSettings } from './srsSettings';

/**
 * Calculate the next review date and update SRS data based on user's answer
 * Simple SRS: new → 10min → 1day → 3days → 7days → 14days → 30days...
 * Any incorrect answer resets to 10 minutes
 * @param {Object} card - The flashcard with srsData
 * @param {string} answer - 'incorrect', 'correct', or 'easy'
 * @returns {Object} Updated srsData
 */
export function calculateNextReview(card, answer) {
  const srsData = { ...card.srsData };
  const now = new Date();
  
  // Simple progression: 10min → 1day → 3days → 7days → 14days → 30days...
  const intervals = [10, 1, 3, 7, 14, 30, 60, 120]; // first is minutes, rest are days
  
  const updated = { ...srsData };
  updated.lastReviewDate = now.toISOString();
  
  if (answer === 'incorrect') {
    // Any incorrect answer resets to 10 minutes
    updated.status = 'learning';
    updated.intervalIndex = 0;
    updated.interval = intervals[0];
    updated.lapses = (updated.lapses || 0) + 1;
    updated.nextReviewDate = addMinutes(now, intervals[0]).toISOString();
    updated.incorrectCount = (updated.incorrectCount || 0) + 1;
  } else if (answer === 'correct') {
    const currentIndex = updated.intervalIndex || 0;
    const nextIndex = Math.min(currentIndex + 1, intervals.length - 1);
    
    updated.status = nextIndex === 0 ? 'learning' : 'review';
    updated.intervalIndex = nextIndex;
    updated.interval = intervals[nextIndex];
    updated.correctCount = (updated.correctCount || 0) + 1;
    
    if (nextIndex === 0) {
      // 10 minutes
      updated.nextReviewDate = addMinutes(now, intervals[nextIndex]).toISOString();
    } else {
      // Days
      updated.nextReviewDate = addDays(now, intervals[nextIndex]).toISOString();
    }
  } else if (answer === 'easy') {
    // Easy skips ahead more aggressively
    const currentIndex = updated.intervalIndex || 0;
    const nextIndex = Math.min(currentIndex + 2, intervals.length - 1);
    
    updated.status = 'review';
    updated.intervalIndex = nextIndex;
    updated.interval = intervals[nextIndex];
    updated.correctCount = (updated.correctCount || 0) + 1;
    updated.nextReviewDate = addDays(now, intervals[nextIndex]).toISOString();
  }
  
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
    const dueDate = new Date(card.srsData.nextReviewDate);
    return dueDate <= now && card.srsData.status !== 'new';
  });
  
  // Learning cards that are waiting (not yet due but in learning phase)
  const waitingLearningCards = cardsWithSRS.filter(card => {
    const dueDate = new Date(card.srsData.nextReviewDate);
    return dueDate > now && 
           (card.srsData.status === 'learning' || card.srsData.status === 'relearning') &&
           (dueDate - now) < (24 * 60 * 60 * 1000); // Due within 24 hours
  });
  
  const newCards = cardsWithSRS.filter(card => card.srsData.status === 'new');
  
  // Sort strictly due cards by priority: relearning > learning > review
  const relearning = strictlyDueCards.filter(c => c.srsData.status === 'relearning');
  const learning = strictlyDueCards.filter(c => c.srsData.status === 'learning');
  const review = strictlyDueCards.filter(c => c.srsData.status === 'review');
  
  // Base queue: priority cards + new cards (limited)
  const baseQueue = [
    ...relearning,
    ...learning,
    ...review,
    ...newCards.slice(0, maxNew)
  ];
  
  // If we're including waiting cards (when no other cards available), add them
  if (includeWaiting && baseQueue.length === 0) {
    // Sort waiting cards by how close they are to being due
    const sortedWaitingCards = waitingLearningCards.sort((a, b) => {
      return new Date(a.srsData.nextReviewDate) - new Date(b.srsData.nextReviewDate);
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
    
    const dueDate = new Date(card.srsData.nextReviewDate);
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
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
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
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  
  if (diffMins < 60) return `${diffMins} min`;
  if (diffHours < 24) return `${diffHours} hours`;
  if (diffDays === 1) return 'Tomorrow';
  return `${diffDays} days`;
}