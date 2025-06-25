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
    noFlashcardsMessage: "You haven't added any words to study yet.",
    instructionsTitle: 'How to add words:',
    methodDictionary: 'From Dictionary: Go to 📚 Dictionary Mode → type English word → click "+ Add Word"',
    methodTranscript: 'From Transcript: Click 🏫 "Join Room" → join a room → click on words in live transcript',
    methodReturn: 'Return here to start studying your collected words',
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
    noFlashcardsMessage: 'Aún no has agregado palabras para estudiar.',
    instructionsTitle: 'Cómo agregar palabras:',
    methodDictionary: 'Desde Diccionario: Ve a 📚 Modo Diccionario → escribe palabra en inglés → haz clic en "+ Agregar Palabra"',
    methodTranscript: 'Desde Transcripción: Haz clic en 🏫 "Unirse al Aula" → únete a un aula → haz clic en palabras en la transcripción en vivo',
    methodReturn: 'Regresa aquí para comenzar a estudiar tus palabras recolectadas',
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
    noFlashcardsMessage: '您还没有添加要学习的单词。',
    instructionsTitle: '如何添加单词：',
    methodDictionary: '从词典：转到 📚 词典模式 → 输入英语单词 → 点击"+ 添加单词"',
    methodTranscript: '从转录：点击 🏫 "加入教室" → 加入房间 → 点击实时转录中的单词',
    methodReturn: '返回这里开始学习您收集的单词',
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
    noFlashcardsMessage: "Vous n'avez pas encore ajouté de mots à étudier.",
    instructionsTitle: 'Comment ajouter des mots :',
    methodDictionary: 'Depuis le Dictionnaire : Allez au 📚 Mode Dictionnaire → tapez un mot anglais → cliquez sur "+ Ajouter Mot"',
    methodTranscript: 'Depuis la Transcription : Cliquez sur 🏫 "Rejoindre Salle" → rejoignez une salle → cliquez sur les mots dans la transcription en direct',
    methodReturn: 'Revenez ici pour commencer à étudier vos mots collectés',
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
    noFlashcardsMessage: 'Sie haben noch keine Wörter zum Lernen hinzugefügt.',
    instructionsTitle: 'Wörter hinzufügen:',
    methodDictionary: 'Aus Wörterbuch: Gehen Sie zu 📚 Wörterbuch-Modus → englisches Wort eingeben → auf "+ Wort Hinzufügen" klicken',
    methodTranscript: 'Aus Transkript: Klicken Sie auf 🏫 "Raum Beitreten" → einem Raum beitreten → auf Wörter im Live-Transkript klicken',
    methodReturn: 'Kehren Sie hierher zurück, um Ihre gesammelten Wörter zu lernen',
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
    noFlashcardsMessage: 'Non hai ancora aggiunto parole da studiare.',
    instructionsTitle: 'Come aggiungere parole:',
    methodDictionary: 'Dal Dizionario: Vai a 📚 Modalità Dizionario → digita parola inglese → clicca "+ Aggiungi Parola"',
    methodTranscript: 'Dalla Trascrizione: Clicca 🏫 "Unisciti Stanza" → unisciti a una stanza → clicca sulle parole nella trascrizione dal vivo',
    methodReturn: 'Torna qui per iniziare a studiare le tue parole raccolte',
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
    noFlashcardsMessage: 'Você ainda não adicionou palavras para estudar.',
    instructionsTitle: 'Como adicionar palavras:',
    methodDictionary: 'Do Dicionário: Vá para 📚 Modo Dicionário → digite palavra em inglês → clique em "+ Adicionar Palavra"',
    methodTranscript: 'Da Transcrição: Clique em 🏫 "Entrar Sala" → entre em uma sala → clique nas palavras na transcrição ao vivo',
    methodReturn: 'Volte aqui para começar a estudar suas palavras coletadas',
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