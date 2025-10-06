// Registry of conjugation tables per language.
// Only languages with productive verbal conjugation paradigms are included.

// Spanish (full common set)
export const SPANISH_TENSES = {
  present: {
    label: 'Presente',
    description: 'Actions happening now or habitual actions.',
    ar: ['-o','-as','-a','-amos','-áis','-an'],
    er: ['-o','-es','-e','-emos','-éis','-en'],
    ir: ['-o','-es','-e','-imos','-ís','-en'],
  },
  preterite: {
    label: 'Pretérito (indefinido)',
    description: 'Completed past actions.',
    ar: ['-é','-aste','-ó','-amos','-asteis','-aron'],
    er: ['-í','-iste','-ió','-imos','-isteis','-ieron'],
    ir: ['-í','-iste','-ió','-imos','-isteis','-ieron'],
  },
  imperfect: {
    label: 'Imperfecto',
    description: 'Past ongoing/repeated or background actions.',
    ar: ['-aba','-abas','-aba','-ábamos','-abais','-aban'],
    er: ['-ía','-ías','-ía','-íamos','-íais','-ían'],
    ir: ['-ía','-ías','-ía','-íamos','-íais','-ían'],
  },
  future: {
    label: 'Futuro',
    description: 'Actions that will happen (attach to infinitive).',
    ar: ['-é','-ás','-á','-emos','-éis','-án'],
    er: ['-é','-ás','-á','-emos','-éis','-án'],
    ir: ['-é','-ás','-á','-emos','-éis','-án'],
  },
  conditional: {
    label: 'Condicional',
    description: 'Would, hypothetical or polite requests (attach to infinitive).',
    ar: ['-ía','-ías','-ía','-íamos','-íais','-ían'],
    er: ['-ía','-ías','-ía','-íamos','-íais','-ían'],
    ir: ['-ía','-ías','-ía','-íamos','-íais','-ían'],
  },
  present_subjunctive: {
    label: 'Presente de subjuntivo',
    description: 'Doubt, desire, emotion, recommendations, uncertainty now/future.',
    ar: ['-e','-es','-e','-emos','-éis','-en'],
    er: ['-a','-as','-a','-amos','-áis','-an'],
    ir: ['-a','-as','-a','-amos','-áis','-an'],
  },
  imperfect_subjunctive: {
    label: 'Imperfecto de subjuntivo',
    description: 'Subjunctive in the past, uncertainty/desire about past events.',
    ar: ['-ara','-aras','-ara','-áramos','-arais','-aran'],
    er: ['-iera','-ieras','-iera','-iéramos','-ierais','-ieran'],
    ir: ['-iera','-ieras','-iera','-iéramos','-ierais','-ieran'],
  },
  present_perfect: {
    label: 'Pretérito perfecto',
    description: 'Has/have done (he, has, ha, hemos, habéis, han + participle).',
    ar: ['he -ado','has -ado','ha -ado','hemos -ado','habéis -ado','han -ado'],
    er: ['he -ido','has -ido','ha -ido','hemos -ido','habéis -ido','han -ido'],
    ir: ['he -ido','has -ido','ha -ido','hemos -ido','habéis -ido','han -ido'],
  },
};
export const SPANISH_PERSON_LABELS = ['yo','tú','él/ella/usted','nosotros','vosotros','ellos/ellas/ustedes'];

// French
export const FRENCH_TENSES = {
  present: { label: 'Présent', description: 'Actions now / habits.', er: ['-e','-es','-e','-ons','-ez','-ent'], ir: ['-is','-is','-it','-issons','-issez','-issent'], re: ['-s','-s','-','-ons','-ez','-ent'] },
  passe_compose: { label: 'Passé composé', description: 'Completed past with aux + participle.', er: ['ai -é','as -é','a -é','avons -é','avez -é','ont -é'], ir: ['ai -i','as -i','a -i','avons -i','avez -i','ont -i'], re: ['ai -u','as -u','a -u','avons -u','avez -u','ont -u'] },
  imparfait: { label: 'Imparfait', description: 'Ongoing/repeated past.', er: ['-ais','-ais','-ait','-ions','-iez','-aient'], ir: ['-issais','-issais','-issait','-issions','-issiez','-issaient'], re: ['-ais','-ais','-ait','-ions','-iez','-aient'] },
  futur: { label: 'Futur', description: 'Will do (infinitive + endings).', common: ['-ai','-as','-a','-ons','-ez','-ont'] },
};
export const FRENCH_PERSON_LABELS = ['je','tu','il/elle/on','nous','vous','ils/elles'];

// Italian
export const ITALIAN_TENSES = {
  presente: { label: 'Presente', description: 'Actions now / habits.', are: ['-o','-i','-a','-iamo','-ate','-ano'], ere: ['-o','-i','-e','-iamo','-ete','-ono'], ire: ['-o','-i','-e','-iamo','-ite','-ono'] },
  passato_prossimo: { label: 'Passato prossimo', description: 'Completed past with aux + participle.', are: ['ho -ato','hai -ato','ha -ato','abbiamo -ato','avete -ato','hanno -ato'], ere: ['ho -uto','hai -uto','ha -uto','abbiamo -uto','avete -uto','hanno -uto'], ire: ['ho -ito','hai -ito','ha -ito','abbiamo -ito','avete -ito','hanno -ito'] },
  imperfetto: { label: 'Imperfetto', description: 'Ongoing/repeated past.', are: ['-avo','-avi','-ava','-avamo','-avate','-avano'], ere: ['-evo','-evi','-eva','-evamo','-evate','-evano'], ire: ['-ivo','-ivi','-iva','-ivamo','-ivate','-ivano'] },
  futuro: { label: 'Futuro', description: 'Will do.', are: ['-erò','-erai','-erà','-eremo','-erete','-eranno'], ere: ['-erò','-erai','-erà','-eremo','-erete','-eranno'], ire: ['-irò','-irai','-irà','-iremo','-irete','-iranno'] },
};
export const ITALIAN_PERSON_LABELS = ['io','tu','lui/lei','noi','voi','loro'];

// Portuguese
export const PORTUGUESE_TENSES = {
  presente: { label: 'Presente', description: 'Actions now / habits.', ar: ['-o','-as','-a','-amos','-ais','-am'], er: ['-o','-es','-e','-emos','-eis','-em'], ir: ['-o','-es','-e','-imos','-is','-em'] },
  preterito_perfeito: { label: 'Pretérito perfeito', description: 'Completed past.', ar: ['-ei','-aste','-ou','-ámos','-astes','-aram'], er: ['-i','-este','-eu','-emos','-estes','-eram'], ir: ['-i','-iste','-iu','-imos','-istes','-iram'] },
  imperfeito: { label: 'Pretérito imperfeito', description: 'Ongoing/repeated past.', ar: ['-ava','-avas','-ava','-ávamos','-áveis','-avam'], er: ['-ia','-ias','-ia','-íamos','-íeis','-iam'], ir: ['-ia','-ias','-ia','-íamos','-íeis','-iam'] },
  futuro: { label: 'Futuro', description: 'Will do.', common: ['-ei','-ás','-á','-emos','-eis','-ão'] },
};
export const PORTUGUESE_PERSON_LABELS = ['eu','tu','ele/ela/você','nós','vós','eles/elas/vocês'];

// German (regular reference)
export const GERMAN_TENSES = {
  präsens: { label: 'Präsens', description: 'Present.', regular: ['-e','-st','-t','-en','-t','-en'] },
  präteritum: { label: 'Präteritum (weak)', description: 'Simple past (regular).', regular: ['-te','-test','-te','-ten','-tet','-ten'] },
};
export const GERMAN_PERSON_LABELS = ['ich','du','er/sie/es','wir','ihr','sie/Sie'];

// Russian (simplified reference)
export const RUSSIAN_TENSES = {
  present: { label: 'Настоящее', description: 'Present (1st conj.).', common: ['-ю/-у','-ешь','-ет','-ем','-ете','-ют/-ут'] },
  past: { label: 'Прошедшее', description: 'Past (gender/number).', forms: ['-л (m)','-ла (f)','-ло (n)','-ли (pl)'] },
};
export const RUSSIAN_PERSON_LABELS = ['я','ты','он/она/оно','мы','вы','они'];

// Turkish (simplified)
export const TURKISH_TENSES = {
  present: { label: 'Geniş zaman', description: 'Aorist/present.', common: ['-(A)rım','-(A)rsın','-(A)r','-(A)rız','-(A)rsınız','-(A)rlar'] },
  past: { label: 'Di’li geçmiş', description: 'Simple past.', common: ['-dim','-din','-di','-dik','-diniz','-diler'] },
};
export const TURKISH_PERSON_LABELS = ['ben','sen','o','biz','siz','onlar'];

// Japanese/Korean (no person tables; show tense labels only)
export const JAPANESE_TENSES = {
  polite: { label: 'ます形 (polite present)', description: 'Polite non-past.' },
  past: { label: 'ました形 (polite past)', description: 'Polite past.' },
};
export const KOREAN_TENSES = {
  present: { label: '현재', description: 'Non-past.' },
  past: { label: '과거', description: 'Past.' },
  future: { label: '미래', description: 'Future (probable).' },
};

export const CONJUGATION_REGISTRY = {
  es: { tenses: SPANISH_TENSES, persons: SPANISH_PERSON_LABELS },
  fr: { tenses: FRENCH_TENSES, persons: FRENCH_PERSON_LABELS },
  it: { tenses: ITALIAN_TENSES, persons: ITALIAN_PERSON_LABELS },
  pt: { tenses: PORTUGUESE_TENSES, persons: PORTUGUESE_PERSON_LABELS },
  de: { tenses: GERMAN_TENSES, persons: GERMAN_PERSON_LABELS },
  ru: { tenses: RUSSIAN_TENSES, persons: RUSSIAN_PERSON_LABELS },
  tr: { tenses: TURKISH_TENSES, persons: TURKISH_PERSON_LABELS },
  ja: { tenses: JAPANESE_TENSES, persons: null },
  ko: { tenses: KOREAN_TENSES, persons: null },
};

export function hasConjugationTables(languageCode) {
  return !!CONJUGATION_REGISTRY[languageCode];
}

export function getConjugationBundle(languageCode) {
  return CONJUGATION_REGISTRY[languageCode] || null;
}


