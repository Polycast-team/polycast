/**
 * SRS Settings Management
 * Handles user preferences for spaced repetition system
 */

// Default SRS settings
export const DEFAULT_SRS_SETTINGS = {
  // Daily limits
  newCardsPerDay: 5,
  maxReviewsPerDay: 100,
  
  // Learning steps (in minutes) - simplified
  learningSteps: [10], // Just 10 minutes, then go to review
  relearningSteps: [10], // 10 min, then back to review
  
  // Graduation settings
  graduatingInterval: 1, // Days after learning steps
  easyInterval: 4, // Days for "easy" button on new cards
  
  // Ease factor settings
  startingEase: 2.5,
  easyBonus: 1.3, // Multiplier for easy button
  hardFactor: 1.2, // Multiplier for hard button (not implemented yet)
  
  // Penalties
  lapseMultiplier: 0.5, // New interval = old interval * this when failed
  minimumInterval: 1, // Minimum days between reviews
  
  // Advanced settings
  maximumInterval: 36500, // Maximum days (100 years)
  burySiblings: false, // Bury related cards until next day
  
  // UI preferences
  showNextReviewTime: true,
  showProgress: true,
  autoPlayAudio: false
};

/**
 * Get current SRS settings from localStorage
 * @returns {Object} Current settings merged with defaults
 */
export function getSRSSettings() {
  try {
    const stored = localStorage.getItem('srsSettings');
    if (stored) {
      const parsed = JSON.parse(stored);
      // Merge with defaults to ensure all properties exist
      return { ...DEFAULT_SRS_SETTINGS, ...parsed };
    }
  } catch (error) {
    console.warn('Error loading SRS settings:', error);
  }
  
  return { ...DEFAULT_SRS_SETTINGS };
}

/**
 * Save SRS settings to localStorage
 * @param {Object} settings - Settings object to save
 */
export function saveSRSSettings(settings) {
  try {
    // Validate settings before saving
    const validatedSettings = validateSettings(settings);
    localStorage.setItem('srsSettings', JSON.stringify(validatedSettings));
    return true;
  } catch (error) {
    console.error('Error saving SRS settings:', error);
    return false;
  }
}

/**
 * Validate settings to ensure they're within reasonable bounds
 * @param {Object} settings - Settings to validate
 * @returns {Object} Validated settings
 */
function validateSettings(settings) {
  const validated = { ...settings };
  
  // Validate daily limits
  validated.newCardsPerDay = Math.max(0, Math.min(50, validated.newCardsPerDay || 5));
  validated.maxReviewsPerDay = Math.max(10, Math.min(1000, validated.maxReviewsPerDay || 100));
  
  // Validate learning steps
  if (!Array.isArray(validated.learningSteps) || validated.learningSteps.length === 0) {
    validated.learningSteps = [1, 10];
  }
  validated.learningSteps = validated.learningSteps.map(step => Math.max(1, Math.min(10080, step))); // 1 min to 1 week
  
  // Validate relearning steps
  if (!Array.isArray(validated.relearningSteps) || validated.relearningSteps.length === 0) {
    validated.relearningSteps = [10];
  }
  validated.relearningSteps = validated.relearningSteps.map(step => Math.max(1, Math.min(10080, step)));
  
  // Validate intervals
  validated.graduatingInterval = Math.max(1, Math.min(30, validated.graduatingInterval || 1));
  validated.easyInterval = Math.max(2, Math.min(30, validated.easyInterval || 4));
  
  // Validate ease factors
  validated.startingEase = Math.max(1.3, Math.min(5.0, validated.startingEase || 2.5));
  validated.easyBonus = Math.max(1.1, Math.min(2.0, validated.easyBonus || 1.3));
  validated.hardFactor = Math.max(1.0, Math.min(1.5, validated.hardFactor || 1.2));
  
  // Validate penalties
  validated.lapseMultiplier = Math.max(0.1, Math.min(1.0, validated.lapseMultiplier || 0.5));
  validated.minimumInterval = Math.max(1, Math.min(10, validated.minimumInterval || 1));
  validated.maximumInterval = Math.max(365, Math.min(36500, validated.maximumInterval || 36500));
  
  return validated;
}

/**
 * Reset settings to defaults
 */
export function resetSRSSettings() {
  localStorage.removeItem('srsSettings');
  return { ...DEFAULT_SRS_SETTINGS };
}

/**
 * Get a specific setting value
 * @param {string} key - Setting key
 * @param {*} defaultValue - Default value if setting doesn't exist
 * @returns {*} Setting value
 */
export function getSetting(key, defaultValue = null) {
  const settings = getSRSSettings();
  return settings[key] !== undefined ? settings[key] : defaultValue;
}

/**
 * Update a specific setting
 * @param {string} key - Setting key
 * @param {*} value - New value
 * @returns {boolean} Success status
 */
export function updateSetting(key, value) {
  const settings = getSRSSettings();
  settings[key] = value;
  return saveSRSSettings(settings);
}

/**
 * Export settings for backup
 * @returns {string} JSON string of current settings
 */
export function exportSettings() {
  const settings = getSRSSettings();
  return JSON.stringify(settings, null, 2);
}

/**
 * Import settings from backup
 * @param {string} jsonString - JSON string of settings
 * @returns {boolean} Success status
 */
export function importSettings(jsonString) {
  try {
    const settings = JSON.parse(jsonString);
    return saveSRSSettings(settings);
  } catch (error) {
    console.error('Error importing settings:', error);
    return false;
  }
}