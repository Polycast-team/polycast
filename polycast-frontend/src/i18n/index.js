import TRANSLATIONS from './translations.js';
import { TOP_LANGUAGES, findLanguageByCode, findLanguageByName, assertSupportedLanguage } from './languages.js';

const FALLBACK_PREFIX = '[fallback:en] ';
const FALLBACK_EVENT = '[i18n-fallback]';

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

function wrapFunctionWithFallback(fn, languageCode, path) {
  return (...args) => {
    console.warn(`${FALLBACK_EVENT} Missing translation for ${path} in ${languageCode}; using English.`);
    const value = fn(...args);
    return `${FALLBACK_PREFIX}${value}`;
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

  console.warn(`${FALLBACK_EVENT} Missing translation for ${path} in ${languageCode}; using English.`);
  return `${FALLBACK_PREFIX}${english}`;
}

export function translate(languageCode, path, ...args) {
  const value = translateValue(languageCode, path);
  if (typeof value === 'function') {
    return value(...args);
  }
  return value;
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
        final[key] = wrapFunctionWithFallback(TRANSLATIONS.en.dictionary[key], languageCode, `dictionary.${key}`);
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

export function noteFallbackUsed(value) {
  return typeof value === 'string' && value.startsWith(FALLBACK_PREFIX);
}

