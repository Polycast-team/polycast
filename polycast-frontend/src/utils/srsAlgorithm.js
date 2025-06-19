/**
 * Spaced Repetition System (SRS) Algorithm
 * Based on SM-2 algorithm with 3 answer buttons: Incorrect, Correct, Easy
 */

import { getSRSSettings } from './srsSettings';

/**
 * Calculate the next review date and update SRS data based on user's answer
 * @param {Object} card - The flashcard with srsData
 * @param {string} answer - 'incorrect', 'correct', or 'easy'
 * @returns {Object} Updated srsData
 */
export function calculateNextReview(card, answer) {
  const srsData = { ...card.srsData };
  const now = new Date();
  const settings = getSRSSettings();
  
  // Handle different card states
  switch (srsData.status) {
    case 'new':
      return handleNewCard(srsData, answer, now, settings);
    case 'learning':
      return handleLearningCard(srsData, answer, now, settings);
    case 'review':
      return handleReviewCard(srsData, answer, now, settings);
    case 'relearning':
      return handleRelearningCard(srsData, answer, now, settings);
    default:
      console.error('Unknown card status:', srsData.status);
      return srsData;
  }
}

/**
 * Handle a new card being reviewed for the first time
 */
function handleNewCard(srsData, answer, now, settings) {
  const updated = { ...srsData };
  updated.lastReviewDate = now.toISOString();
  
  switch (answer) {
    case 'incorrect':
      // Stay in learning mode, review again in 1 minute (immediate review)
      updated.status = 'learning';
      updated.interval = 0;
      updated.currentStep = 0;
      updated.nextReviewDate = addMinutes(now, 1).toISOString();
      break;
      
    case 'correct':
      // Move to learning mode, start at first step
      updated.status = 'learning';
      updated.interval = 0;
      updated.repetitions = 1;
      updated.currentStep = 0;
      updated.nextReviewDate = addMinutes(now, settings.learningSteps[0]).toISOString();
      break;
      
    case 'easy':
      // Graduate immediately to review mode
      updated.status = 'review';
      updated.interval = settings.easyInterval;
      updated.repetitions = 1;
      updated.easeFactor = settings.startingEase + 0.1; // Slightly increase ease for easy cards
      updated.nextReviewDate = addDays(now, settings.easyInterval).toISOString();
      break;
  }
  
  return updated;
}

/**
 * Handle a card in learning phase (just started learning)
 */
function handleLearningCard(srsData, answer, now, settings) {
  const updated = { ...srsData };
  updated.lastReviewDate = now.toISOString();
  const currentStep = updated.currentStep || 0;
  
  switch (answer) {
    case 'incorrect':
      // Reset to beginning of learning phase with 1 minute review
      updated.repetitions = 0;
      updated.lapses++;
      updated.currentStep = 0;
      updated.nextReviewDate = addMinutes(now, 1).toISOString();
      break;
      
    case 'correct':
      if (currentStep < settings.learningSteps.length - 1) {
        // Move to next learning step
        updated.currentStep = currentStep + 1;
        updated.repetitions++;
        updated.nextReviewDate = addMinutes(now, settings.learningSteps[currentStep + 1]).toISOString();
      } else {
        // Completed all learning steps, graduate to review mode
        updated.status = 'review';
        updated.interval = settings.graduatingInterval;
        updated.repetitions++;
        updated.easeFactor = settings.startingEase;
        updated.nextReviewDate = addDays(now, settings.graduatingInterval).toISOString();
        delete updated.currentStep;
      }
      break;
      
    case 'easy':
      // Graduate immediately with longer interval
      updated.status = 'review';
      updated.interval = settings.easyInterval;
      updated.repetitions++;
      updated.easeFactor = settings.startingEase + 0.1;
      updated.nextReviewDate = addDays(now, settings.easyInterval).toISOString();
      delete updated.currentStep;
      break;
  }
  
  return updated;
}

/**
 * Handle a card in review phase (main spaced repetition)
 */
function handleReviewCard(srsData, answer, now, settings) {
  const updated = { ...srsData };
  updated.lastReviewDate = now.toISOString();
  
  switch (answer) {
    case 'incorrect':
      // Move to relearning phase
      updated.status = 'relearning';
      updated.lapses++;
      updated.repetitions = 0;
      updated.currentStep = 0;
      updated.interval = Math.max(settings.minimumInterval, Math.round(updated.interval * settings.lapseMultiplier));
      updated.easeFactor = Math.max(1.3, updated.easeFactor - 0.2);
      updated.nextReviewDate = addMinutes(now, settings.relearningSteps[0]).toISOString();
      break;
      
    case 'correct':
      // Continue with spaced repetition
      updated.repetitions++;
      updated.interval = Math.min(settings.maximumInterval, Math.round(updated.interval * updated.easeFactor));
      updated.nextReviewDate = addDays(now, updated.interval).toISOString();
      break;
      
    case 'easy':
      // Increase interval more and boost ease factor
      updated.repetitions++;
      updated.interval = Math.min(settings.maximumInterval, Math.round(updated.interval * updated.easeFactor * settings.easyBonus));
      updated.easeFactor = Math.min(2.5, updated.easeFactor + 0.15);
      updated.nextReviewDate = addDays(now, updated.interval).toISOString();
      break;
  }
  
  return updated;
}

/**
 * Handle a card being relearned after forgetting
 */
function handleRelearningCard(srsData, answer, now, settings) {
  const updated = { ...srsData };
  updated.lastReviewDate = now.toISOString();
  const currentStep = updated.currentStep || 0;
  
  switch (answer) {
    case 'incorrect':
      // Reset to beginning of relearning with 1 minute immediate review
      updated.currentStep = 0;
      updated.nextReviewDate = addMinutes(now, 1).toISOString();
      break;
      
    case 'correct':
      if (currentStep < settings.relearningSteps.length - 1) {
        // Move to next relearning step
        updated.currentStep = currentStep + 1;
        updated.nextReviewDate = addMinutes(now, settings.relearningSteps[currentStep + 1]).toISOString();
      } else {
        // Graduate back to review with reduced interval
        updated.status = 'review';
        updated.interval = Math.max(settings.minimumInterval, Math.floor(updated.interval * settings.lapseMultiplier));
        updated.repetitions = 1;
        updated.nextReviewDate = addDays(now, updated.interval).toISOString();
        delete updated.currentStep;
      }
      break;
      
    case 'easy':
      // Graduate back to review with less penalty
      updated.status = 'review';
      updated.interval = Math.max(settings.minimumInterval, Math.floor(updated.interval * 0.7));
      updated.repetitions = 1;
      updated.nextReviewDate = addDays(now, updated.interval).toISOString();
      delete updated.currentStep;
      break;
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