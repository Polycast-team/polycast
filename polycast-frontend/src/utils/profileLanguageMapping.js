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

// Translations for flashcard interface
export const FLASHCARD_TRANSLATIONS = {
  'English': {
    noFlashcardsTitle: 'No Flashcards Available',
    noFlashcardsMessage: "You don't have any flashcards to study yet.",
    instructionsTitle: 'To add flashcards:',
    step1: 'Switch to Audio Mode',
    step2: 'Listen to content or speak into the microphone', 
    step3: 'Click on words in the transcript to save them',
    step4: 'Return to Flashcard Mode to study',
    clickToReveal: 'Click to reveal answer',
    sessionComplete: 'Session Complete!',
    cardsReviewed: 'Cards Reviewed',
    accuracy: 'Accuracy',
    minutes: 'Minutes',
    returnToProfiles: 'Return to Profiles',
    backToMain: '← Back to Main',
    calendar: '📅 Calendar',
    new: 'New',
    learning: 'Learning', 
    review: 'Review',
    again: 'Again',
    hard: 'Hard',
    good: 'Good',
    easy: 'Easy'
  },
  'Spanish': {
    noFlashcardsTitle: 'No Hay Tarjetas Disponibles',
    noFlashcardsMessage: 'Aún no tienes tarjetas para estudiar.',
    instructionsTitle: 'Para agregar tarjetas:',
    step1: 'Cambiar a Modo Audio',
    step2: 'Escuchar contenido o hablar al micrófono',
    step3: 'Hacer clic en palabras de la transcripción para guardarlas',
    step4: 'Regresar al Modo Tarjetas para estudiar',
    clickToReveal: 'Haz clic para revelar la respuesta',
    sessionComplete: '¡Sesión Completada!',
    cardsReviewed: 'Tarjetas Revisadas',
    accuracy: 'Precisión',
    minutes: 'Minutos',
    returnToProfiles: 'Regresar a Perfiles',
    backToMain: '← Regresar al Inicio',
    calendar: '📅 Calendario',
    new: 'Nuevas',
    learning: 'Aprendiendo',
    review: 'Repasar',
    again: 'Otra vez',
    hard: 'Difícil',
    good: 'Bien',
    easy: 'Fácil'
  },
  'Chinese': {
    noFlashcardsTitle: '没有可用的卡片',
    noFlashcardsMessage: '您还没有要学习的卡片。',
    instructionsTitle: '添加卡片的方法：',
    step1: '切换到音频模式',
    step2: '听内容或对着麦克风说话',
    step3: '点击转录中的单词来保存',
    step4: '返回卡片模式学习',
    clickToReveal: '点击显示答案',
    sessionComplete: '学习完成！',
    cardsReviewed: '已复习卡片',
    accuracy: '准确率',
    minutes: '分钟',
    returnToProfiles: '返回配置文件',
    backToMain: '← 返回主页',
    calendar: '📅 日历',
    new: '新卡片',
    learning: '学习中',
    review: '复习',
    again: '重来',
    hard: '困难',
    good: '良好',
    easy: '简单'
  },
  'French': {
    noFlashcardsTitle: 'Aucune Carte Disponible',
    noFlashcardsMessage: "Vous n'avez pas encore de cartes à étudier.",
    instructionsTitle: 'Pour ajouter des cartes :',
    step1: 'Passer en Mode Audio',
    step2: 'Écouter du contenu ou parler dans le microphone',
    step3: 'Cliquer sur les mots de la transcription pour les sauvegarder',
    step4: 'Retourner au Mode Cartes pour étudier',
    clickToReveal: 'Cliquer pour révéler la réponse',
    sessionComplete: 'Session Terminée !',
    cardsReviewed: 'Cartes Révisées',
    accuracy: 'Précision',
    minutes: 'Minutes',
    returnToProfiles: 'Retour aux Profils',
    backToMain: '← Retour au Menu',
    calendar: '📅 Calendrier',
    new: 'Nouvelles',
    learning: 'Apprentissage',
    review: 'Révision',
    again: 'Encore',
    hard: 'Difficile',
    good: 'Bien',
    easy: 'Facile'
  },
  'German': {
    noFlashcardsTitle: 'Keine Karten Verfügbar',
    noFlashcardsMessage: 'Sie haben noch keine Karten zum Lernen.',
    instructionsTitle: 'So fügen Sie Karten hinzu:',
    step1: 'Zum Audio-Modus wechseln',
    step2: 'Inhalte anhören oder ins Mikrofon sprechen',
    step3: 'Auf Wörter im Transkript klicken, um sie zu speichern',
    step4: 'Zum Karten-Modus zurückkehren zum Lernen',
    clickToReveal: 'Klicken Sie, um die Antwort zu zeigen',
    sessionComplete: 'Sitzung Abgeschlossen!',
    cardsReviewed: 'Karten Überprüft',
    accuracy: 'Genauigkeit',
    minutes: 'Minuten',
    returnToProfiles: 'Zu Profilen Zurückkehren',
    backToMain: '← Zurück zum Hauptmenü',
    calendar: '📅 Kalender',
    new: 'Neu',
    learning: 'Lernen',
    review: 'Wiederholen',
    again: 'Nochmal',
    hard: 'Schwer',
    good: 'Gut',
    easy: 'Einfach'
  },
  'Italian': {
    noFlashcardsTitle: 'Nessuna Carta Disponibile',
    noFlashcardsMessage: 'Non hai ancora carte da studiare.',
    instructionsTitle: 'Per aggiungere carte:',
    step1: 'Passa alla Modalità Audio',
    step2: 'Ascolta contenuti o parla nel microfono',
    step3: 'Clicca sulle parole nella trascrizione per salvarle',
    step4: 'Torna alla Modalità Carte per studiare',
    clickToReveal: 'Clicca per rivelare la risposta',
    sessionComplete: 'Sessione Completata!',
    cardsReviewed: 'Carte Ripassate',
    accuracy: 'Precisione',
    minutes: 'Minuti',
    returnToProfiles: 'Torna ai Profili',
    backToMain: '← Torna al Menu',
    calendar: '📅 Calendario',
    new: 'Nuove',
    learning: 'Apprendimento',
    review: 'Ripasso',
    again: 'Ancora',
    hard: 'Difficile',
    good: 'Bene',
    easy: 'Facile'
  },
  'Portuguese': {
    noFlashcardsTitle: 'Nenhum Cartão Disponível',
    noFlashcardsMessage: 'Você ainda não tem cartões para estudar.',
    instructionsTitle: 'Para adicionar cartões:',
    step1: 'Mudar para Modo Áudio',
    step2: 'Ouvir conteúdo ou falar no microfone',
    step3: 'Clicar nas palavras da transcrição para salvá-las',
    step4: 'Voltar ao Modo Cartões para estudar',
    clickToReveal: 'Clique para revelar a resposta',
    sessionComplete: 'Sessão Completa!',
    cardsReviewed: 'Cartões Revisados',
    accuracy: 'Precisão',
    minutes: 'Minutos',
    returnToProfiles: 'Voltar aos Perfis',
    backToMain: '← Voltar ao Menu',
    calendar: '📅 Calendário',
    new: 'Novos',
    learning: 'Aprendendo',
    review: 'Revisar',
    again: 'Novamente',
    hard: 'Difícil',
    good: 'Bom',
    easy: 'Fácil'
  }
};

// Get translations for a profile's language
export const getTranslationsForProfile = (profile) => {
  const language = getLanguageForProfile(profile);
  return FLASHCARD_TRANSLATIONS[language] || FLASHCARD_TRANSLATIONS['English'];
};