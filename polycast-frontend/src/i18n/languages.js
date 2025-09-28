export const TOP_LANGUAGES = [
  { code: 'en', englishName: 'English', nativeName: 'English' },
  { code: 'zh', englishName: 'Chinese (Simplified)', nativeName: '简体中文' },
  { code: 'es', englishName: 'Spanish', nativeName: 'Español' },
  { code: 'hi', englishName: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'ar', englishName: 'Arabic', nativeName: 'العربية' },
  { code: 'pt', englishName: 'Portuguese', nativeName: 'Português' },
  { code: 'bn', englishName: 'Bengali', nativeName: 'বাংলা' },
  { code: 'ru', englishName: 'Russian', nativeName: 'Русский' },
  { code: 'ja', englishName: 'Japanese', nativeName: '日本語' },
  { code: 'de', englishName: 'German', nativeName: 'Deutsch' },
  { code: 'fr', englishName: 'French', nativeName: 'Français' },
  { code: 'ko', englishName: 'Korean', nativeName: '한국어' },
  { code: 'it', englishName: 'Italian', nativeName: 'Italiano' },
  { code: 'tr', englishName: 'Turkish', nativeName: 'Türkçe' },
  { code: 'vi', englishName: 'Vietnamese', nativeName: 'Tiếng Việt' },
];

export function findLanguageByCode(code) {
  return TOP_LANGUAGES.find((lang) => lang.code === code);
}

export function findLanguageByName(name) {
  if (!name) return undefined;
  const normalised = name.trim().toLowerCase();
  return TOP_LANGUAGES.find((lang) =>
    lang.englishName.toLowerCase() === normalised ||
    lang.nativeName.toLowerCase() === normalised
  );
}

export function assertSupportedLanguage(code, context) {
  const language = findLanguageByCode(code);
  if (!language) {
    throw new Error(`Unsupported language code "${code}"${context ? ` in ${context}` : ''}.`);
  }
  return language;
}
