// Profile to language mapping
export const PROFILE_LANGUAGE_MAP = {
  'non-saving': 'English',
  'cat': 'Spanish',
  'dog': 'French', 
  'mouse': 'German',
  'horse': 'Italian',
  'lizard': 'Portuguese',
  'shirley': 'Chinese'
};

// Get language for a profile
export const getLanguageForProfile = (profile) => {
  return PROFILE_LANGUAGE_MAP[profile] || 'English';
};

// Get all available profiles
export const getAvailableProfiles = () => {
  return Object.keys(PROFILE_LANGUAGE_MAP);
};

// Check if profile exists
export const isValidProfile = (profile) => {
  return profile in PROFILE_LANGUAGE_MAP;
};