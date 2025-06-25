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
    step1: 'Join your instructor\'s room',
    step2: 'Listen as your instructor speaks or plays audio', 
    step3: 'Tap on words in the transcript to save them',
    step4: 'Return to Flashcard Mode to study your saved words',
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
    easy: 'Easy',
    // Mode dropdown
    lectureMode: 'Lecture Mode',
    dictionaryMode: 'Dictionary Mode', 
    flashcardMode: 'Flashcard Mode',
    // Join room
    joinRoom: 'Join Room',
    roomCode: 'Room Code',
    joinButton: 'Join',
    enterRoomCode: 'Enter room code'
  },
  'Spanish': {
    noFlashcardsTitle: 'No Hay Tarjetas Disponibles',
    noFlashcardsMessage: 'Aún no tienes tarjetas para estudiar.',
    instructionsTitle: 'Para agregar tarjetas:',
    step1: 'Únete al aula de tu instructor',
    step2: 'Escucha mientras tu instructor habla o reproduce audio',
    step3: 'Toca palabras en la transcripción para guardarlas',
    step4: 'Regresa al Modo Tarjetas para estudiar tus palabras guardadas',
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
    easy: 'Fácil',
    // Mode dropdown
    lectureMode: 'Modo Conferencia',
    dictionaryMode: 'Modo Diccionario',
    flashcardMode: 'Modo Tarjetas',
    // Join room
    joinRoom: 'Unirse al Aula',
    roomCode: 'Código del Aula',
    joinButton: 'Unirse',
    enterRoomCode: 'Introduce el código del aula'
  },
  'Chinese': {
    noFlashcardsTitle: '没有可用的卡片',
    noFlashcardsMessage: '您还没有要学习的卡片。',
    instructionsTitle: '添加卡片的方法：',
    step1: '加入您老师的教室',
    step2: '听老师讲话或播放音频',
    step3: '点击转录中的单词来保存',
    step4: '返回卡片模式学习您保存的单词',
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
    easy: '简单',
    // Mode dropdown
    lectureMode: '课堂模式',
    dictionaryMode: '词典模式',
    flashcardMode: '卡片模式',
    // Join room
    joinRoom: '加入教室',
    roomCode: '教室代码',
    joinButton: '加入',
    enterRoomCode: '输入教室代码'
  },
  'French': {
    noFlashcardsTitle: 'Aucune Carte Disponible',
    noFlashcardsMessage: "Vous n'avez pas encore de cartes à étudier.",
    instructionsTitle: 'Pour ajouter des cartes :',
    step1: 'Rejoindre la salle de votre instructeur',
    step2: 'Écouter pendant que votre instructeur parle ou joue de l\'audio',
    step3: 'Cliquer sur les mots de la transcription pour les sauvegarder',
    step4: 'Retourner au Mode Cartes pour étudier vos mots sauvegardés',
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
    easy: 'Facile',
    // Mode dropdown
    lectureMode: 'Mode Conférence',
    dictionaryMode: 'Mode Dictionnaire',
    flashcardMode: 'Mode Cartes',
    // Join room
    joinRoom: 'Rejoindre la Salle',
    roomCode: 'Code de Salle',
    joinButton: 'Rejoindre',
    enterRoomCode: 'Entrez le code de la salle'
  },
  'German': {
    noFlashcardsTitle: 'Keine Karten Verfügbar',
    noFlashcardsMessage: 'Sie haben noch keine Karten zum Lernen.',
    instructionsTitle: 'So fügen Sie Karten hinzu:',
    step1: 'Dem Raum Ihres Lehrers beitreten',
    step2: 'Zuhören, während Ihr Lehrer spricht oder Audio abspielt',
    step3: 'Auf Wörter im Transkript klicken, um sie zu speichern',
    step4: 'Zum Karten-Modus zurückkehren, um Ihre gespeicherten Wörter zu lernen',
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
    easy: 'Einfach',
    // Mode dropdown
    lectureMode: 'Vorlesungsmodus',
    dictionaryMode: 'Wörterbuch-Modus',
    flashcardMode: 'Karten-Modus',
    // Join room
    joinRoom: 'Raum Beitreten',
    roomCode: 'Raumcode',
    joinButton: 'Beitreten',
    enterRoomCode: 'Raumcode eingeben'
  },
  'Italian': {
    noFlashcardsTitle: 'Nessuna Carta Disponibile',
    noFlashcardsMessage: 'Non hai ancora carte da studiare.',
    instructionsTitle: 'Per aggiungere carte:',
    step1: 'Unisciti alla stanza del tuo insegnante',
    step2: 'Ascolta mentre il tuo insegnante parla o riproduce audio',
    step3: 'Clicca sulle parole nella trascrizione per salvarle',
    step4: 'Torna alla Modalità Carte per studiare le tue parole salvate',
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
    easy: 'Facile',
    // Mode dropdown
    lectureMode: 'Modalità Lezione',
    dictionaryMode: 'Modalità Dizionario',
    flashcardMode: 'Modalità Carte',
    // Join room
    joinRoom: 'Unisciti alla Stanza',
    roomCode: 'Codice Stanza',
    joinButton: 'Unisciti',
    enterRoomCode: 'Inserisci il codice della stanza'
  },
  'Portuguese': {
    noFlashcardsTitle: 'Nenhum Cartão Disponível',
    noFlashcardsMessage: 'Você ainda não tem cartões para estudar.',
    instructionsTitle: 'Para adicionar cartões:',
    step1: 'Entrar na sala do seu instrutor',
    step2: 'Ouvir enquanto seu instrutor fala ou toca áudio',
    step3: 'Clicar nas palavras da transcrição para salvá-las',
    step4: 'Voltar ao Modo Cartões para estudar suas palavras salvas',
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
    easy: 'Fácil',
    // Mode dropdown
    lectureMode: 'Modo Aula',
    dictionaryMode: 'Modo Dicionário',
    flashcardMode: 'Modo Cartões',
    // Join room
    joinRoom: 'Entrar na Sala',
    roomCode: 'Código da Sala',
    joinButton: 'Entrar',
    enterRoomCode: 'Digite o código da sala'
  }
};

// Get translations for a profile's language
export const getTranslationsForProfile = (profile) => {
  const language = getLanguageForProfile(profile);
  return FLASHCARD_TRANSLATIONS[language] || FLASHCARD_TRANSLATIONS['English'];
};