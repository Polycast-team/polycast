import TRANSLATIONS from './translations.js';
import { TOP_LANGUAGES, findLanguageByCode, findLanguageByName, assertSupportedLanguage } from './languages.js';

function deepGet(source, path) {
  if (!source) return undefined;
  const segments = path.split('.');
  let current = source;
  for (const segment of segments) {
    if (current == null) return undefined;
    current = current[segment];
  }
  return current;
}

// Emit a custom event for missing translations so ErrorPopup can display them
function emitMissingTranslationError(languageCode, path) {
  const message = `Missing translation: "${path}" for language "${languageCode}"`;
  console.error(`[i18n] ${message}`);

  // Dispatch custom event that ErrorPopup can listen to
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('i18n-missing-translation', {
      detail: { languageCode, path, message }
    }));
  }
}

function wrapFunctionWithFallback(fn, languageCode, path) {
  return (...args) => {
    emitMissingTranslationError(languageCode, path);
    return fn(...args); // Return value without prefix - error is shown in popup
  };
}

function translateValue(languageCode, path) {
  const bundle = TRANSLATIONS[languageCode];
  const direct = deepGet(bundle, path);
  if (direct !== undefined) return direct;

  const english = deepGet(TRANSLATIONS.en, path);
  if (english === undefined) {
    throw new Error(`Missing base English translation for path "${path}".`);
  }

  if (typeof english === 'function') {
    return wrapFunctionWithFallback(english, languageCode, path);
  }

  emitMissingTranslationError(languageCode, path);
  return english; // Return English value without prefix - error is shown in popup
}

export function translate(languageCode, path, ...args) {
  const value = translateValue(languageCode, path);
  if (typeof value === 'function') {
    return value(...args);
  }
  // Strip any emoji/pictograph characters from returned strings
  return removeEmojis(value);
}

function buildSection(languageCode, section, keys) {
  const result = {};
  keys.forEach((key) => {
    result[key] = translate(languageCode, `${section}.${key}`);
  });
  return result;
}

const UI_KEYS = Object.keys(TRANSLATIONS.en.ui);
const FLASHCARD_KEYS = Object.keys(TRANSLATIONS.en.flashcard);
const VOICE_KEYS = Object.keys(TRANSLATIONS.en.voice);
const APP_KEYS = Object.keys(TRANSLATIONS.en.app);
const LOGIN_KEYS = Object.keys(TRANSLATIONS.en.login);
const REGISTER_KEYS = Object.keys(TRANSLATIONS.en.register);
const ERROR_KEYS = Object.keys(TRANSLATIONS.en.errors);

export function getUIStrings(languageCode) {
  return buildSection(languageCode, 'ui', UI_KEYS);
}

export function getFlashcardStrings(languageCode) {
  return buildSection(languageCode, 'flashcard', FLASHCARD_KEYS);
}

export function getVoiceStrings(languageCode) {
  return buildSection(languageCode, 'voice', VOICE_KEYS);
}

export function getAppStrings(languageCode) {
  return buildSection(languageCode, 'app', APP_KEYS);
}

export function getLoginStrings(languageCode) {
  return buildSection(languageCode, 'login', LOGIN_KEYS);
}

export function getRegisterStrings(languageCode) {
  return buildSection(languageCode, 'register', REGISTER_KEYS);
}

export function getErrorStrings(languageCode) {
  return buildSection(languageCode, 'errors', ERROR_KEYS);
}

export function getDictionaryStrings(languageCode) {
  const result = { ...TRANSLATIONS.en.dictionary };
  const languageDictionary = TRANSLATIONS[languageCode]?.dictionary;
  if (languageDictionary) {
    Object.keys(languageDictionary).forEach((key) => {
      result[key] = languageDictionary[key];
    });
  }
  const final = {};
  Object.entries(result).forEach(([key, value]) => {
    if (typeof value === 'function') {
      if (languageDictionary && typeof languageDictionary[key] === 'function') {
        final[key] = languageDictionary[key];
      } else if (typeof TRANSLATIONS.en.dictionary[key] === 'function') {
        // Use English function but emit error for missing translation
        final[key] = (...args) => {
          emitMissingTranslationError(languageCode, `dictionary.${key}`);
          return TRANSLATIONS.en.dictionary[key](...args);
        };
      } else {
        throw new Error(`Dictionary translation for ${key} must be a function.`);
      }
    } else {
      final[key] = translate(languageCode, `dictionary.${key}`);
    }
  });
  return final;
}

export function resolveLanguageCode(input, { context } = {}) {
  if (!input) {
    throw new Error(`Language value missing${context ? ` (${context})` : ''}.`);
  }

  if (findLanguageByCode(input)) return input;
  const match = findLanguageByName(input);
  if (match) return match.code;

  throw new Error(`Unsupported language "${input}"${context ? ` (${context})` : ''}.`);
}

export function describeLanguage(code) {
  const language = assertSupportedLanguage(code);
  return language.englishName;
}

export function getLanguageOptions() {
  return TOP_LANGUAGES.map(({ code, englishName, nativeName }) => ({ code, englishName, nativeName }));
}

// Deprecated - fallbacks no longer use prefix, errors are shown via events
export function noteFallbackUsed(value) {
  return false;
}

// Remove emoji/pictograph characters globally from UI strings
const EMOJI_REGEX = /[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
function removeEmojis(input) {
  if (typeof input !== 'string') return input;
  return input.replace(EMOJI_REGEX, '').trim();
}

