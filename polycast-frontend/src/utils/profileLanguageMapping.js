import {
  resolveLanguageCode,
  describeLanguage,
  getUIStrings,
  getFlashcardStrings,
  getDictionaryStrings,
  getAppStrings,
  getVoiceStrings,
  getErrorStrings,
} from '../i18n/index.js';

const profileLanguageRegistry = new Map();

export const clearProfileLanguageRegistry = () => {
  profileLanguageRegistry.clear();
};

export const registerProfileLanguages = (profileKey, { nativeLanguage, targetLanguage }) => {
  if (!profileKey) throw new Error('profileKey is required when registering profile languages');
  const nativeCode = resolveLanguageCode(nativeLanguage, { context: `profile ${profileKey} native language` });
  const targetCode = resolveLanguageCode(targetLanguage, { context: `profile ${profileKey} target language` });
  profileLanguageRegistry.set(profileKey, { nativeCode, targetCode });
};

function getEntry(profile) {
  if (!profile) {
    throw new Error('Profile identifier is required to resolve languages');
  }
  const entry = profileLanguageRegistry.get(profile);
  if (!entry) {
    throw new Error(`No language data registered for profile "${profile}".`);
  }
  return entry;
}

export const getLanguageCodeForProfile = (profile) => getEntry(profile).targetCode;
export const getNativeLanguageCodeForProfile = (profile) => getEntry(profile).nativeCode;

export const getLanguageForProfile = (profile) => describeLanguage(getLanguageCodeForProfile(profile));
export const getNativeLanguageForProfile = (profile) => describeLanguage(getNativeLanguageCodeForProfile(profile));

export const getRegisteredProfiles = () => Array.from(profileLanguageRegistry.keys());

export const getUITranslationsForProfile = (profile) => {
  const nativeCode = getNativeLanguageCodeForProfile(profile);
  return getUIStrings(nativeCode);
};

export const getFlashcardTranslationsForProfile = (profile) => {
  const nativeCode = getNativeLanguageCodeForProfile(profile);
  return getFlashcardStrings(nativeCode);
};

export const getDictionaryTranslationsForProfile = (profile) => {
  const nativeCode = getNativeLanguageCodeForProfile(profile);
  return getDictionaryStrings(nativeCode);
};

export const getAppTranslationsForProfile = (profile) => {
  const nativeCode = getNativeLanguageCodeForProfile(profile);
  return getAppStrings(nativeCode);
};

export const getVoiceTranslationsForProfile = (profile) => {
  const nativeCode = getNativeLanguageCodeForProfile(profile);
  return getVoiceStrings(nativeCode);
};

export const getErrorTranslationsForProfile = (profile) => {
  const nativeCode = getNativeLanguageCodeForProfile(profile);
  return getErrorStrings(nativeCode);
};
