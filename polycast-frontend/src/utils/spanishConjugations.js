// Standardized Spanish conjugation tables for common tenses.
// Each table is person-ordered: yo, tú, él/ella/usted, nosotros, vosotros, ellos/ellas/ustedes
// The values are example endings for regular verbs: -ar, -er, -ir. Use as reference in UI.

export const SPANISH_TENSES = {
  'present': {
    label: 'Presente',
    description: 'Actions happening now or habitual actions.',
    ar: ['-o', '-as', '-a', '-amos', '-áis', '-an'],
    er: ['-o', '-es', '-e', '-emos', '-éis', '-en'],
    ir: ['-o', '-es', '-e', '-imos', '-ís', '-en'],
  },
  'preterite': {
    label: 'Pretérito (indefinido)',
    description: 'Completed past actions.',
    ar: ['-é', '-aste', '-ó', '-amos', '-asteis', '-aron'],
    er: ['-í', '-iste', '-ió', '-imos', '-isteis', '-ieron'],
    ir: ['-í', '-iste', '-ió', '-imos', '-isteis', '-ieron'],
  },
  'imperfect': {
    label: 'Imperfecto',
    description: 'Past ongoing/repeated or background actions.',
    ar: ['-aba', '-abas', '-aba', '-ábamos', '-abais', '-aban'],
    er: ['-ía', '-ías', '-ía', '-íamos', '-íais', '-ían'],
    ir: ['-ía', '-ías', '-ía', '-íamos', '-íais', '-ían'],
  },
  'future': {
    label: 'Futuro',
    description: 'Actions that will happen (attach to infinitive).',
    ar: ['-é', '-ás', '-á', '-emos', '-éis', '-án'],
    er: ['-é', '-ás', '-á', '-emos', '-éis', '-án'],
    ir: ['-é', '-ás', '-á', '-emos', '-éis', '-án'],
  },
  'conditional': {
    label: 'Condicional',
    description: 'Would, hypothetical or polite requests (attach to infinitive).',
    ar: ['-ía', '-ías', '-ía', '-íamos', '-íais', '-ían'],
    er: ['-ía', '-ías', '-ía', '-íamos', '-íais', '-ían'],
    ir: ['-ía', '-ías', '-ía', '-íamos', '-íais', '-ían'],
  },
  'present_subjunctive': {
    label: 'Presente de subjuntivo',
    description: 'Doubt, desire, emotion, recommendations, uncertainty now or future.',
    ar: ['-e', '-es', '-e', '-emos', '-éis', '-en'],
    er: ['-a', '-as', '-a', '-amos', '-áis', '-an'],
    ir: ['-a', '-as', '-a', '-amos', '-áis', '-an'],
  },
  'imperfect_subjunctive': {
    label: 'Imperfecto de subjuntivo',
    description: 'Subjunctive in the past, uncertainty/desire about past events.',
    ar: ['-ara', '-aras', '-ara', '-áramos', '-arais', '-aran'],
    er: ['-iera', '-ieras', '-iera', '-iéramos', '-ierais', '-ieran'],
    ir: ['-iera', '-ieras', '-iera', '-iéramos', '-ierais', '-ieran'],
  },
  'present_perfect': {
    label: 'Pretérito perfecto',
    description: 'Has/have done (he, has, ha, hemos, habéis, han + participle).',
    ar: ['he -ado', 'has -ado', 'ha -ado', 'hemos -ado', 'habéis -ado', 'han -ado'],
    er: ['he -ido', 'has -ido', 'ha -ido', 'hemos -ido', 'habéis -ido', 'han -ido'],
    ir: ['he -ido', 'has -ido', 'ha -ido', 'hemos -ido', 'habéis -ido', 'han -ido'],
  },
};

export const SPANISH_PERSON_LABELS = ['yo', 'tú', 'él/ella/usted', 'nosotros', 'vosotros', 'ellos/ellas/ustedes'];

export function getConjugationTable(key) {
  return SPANISH_TENSES[key] || null;
}

export function listTenses() {
  return Object.keys(SPANISH_TENSES);
}


