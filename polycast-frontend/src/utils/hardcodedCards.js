/**
 * Hardcoded cards for non-saving mode
 * Shared between MobileFlashcardMode and MobileProfileSelector
 */

export const getHardcodedCards = () => {
  return [
    {
      key: 'run1',
      word: 'run',
      wordSenseId: 'run1',
      partOfSpeech: 'verb',
      definition: 'To move quickly on foot',
      inFlashcards: true,
      frequency: 7, // Common word (1-10 scale, 10 = most common)
      exampleSentencesGenerated: 'I like to ~run~ in the morning for exercise. // Me gusta ~correr~ por la mañana para hacer ejercicio. // She decided to ~run~ to catch the bus. // Decidió ~correr~ para alcanzar el autobús. // They ~run~ together every weekend. // Ellos ~corren~ juntos todos los fines de semana. // The dog loves to ~run~ in the park. // Al perro le encanta ~correr~ en el parque. // He can ~run~ very fast. // Él puede ~correr~ muy rápido.',
      srsData: {
        isNew: false,
        gotWrongThisSession: false,
        SRS_interval: 2,
        status: 'learning',
        correctCount: 1,
        incorrectCount: 0,
        dueDate: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // Due in 5 minutes
        lastSeen: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // Reviewed 5 minutes ago
        lastReviewDate: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        nextReviewDate: new Date(Date.now() + 5 * 60 * 1000).toISOString()
      }
    },
    {
      key: 'eat1',
      word: 'eat',
      wordSenseId: 'eat1',
      partOfSpeech: 'verb',
      definition: 'To consume food',
      inFlashcards: true,
      frequency: 9, // Core/basic vocabulary (1-10 scale, 10 = most common)
      exampleSentencesGenerated: 'I ~eat~ breakfast every morning at seven. // ~Como~ desayuno todas las mañanas a las siete. // They ~eat~ dinner together as a family. // Ellos ~cenan~ juntos como familia. // She likes to ~eat~ healthy foods. // A ella le gusta ~comer~ alimentos saludables. // We usually ~eat~ lunch at noon. // Normalmente ~comemos~ el almuerzo al mediodía. // The children ~eat~ too much candy. // Los niños ~comen~ demasiados dulces.',
      srsData: {
        isNew: false,
        gotWrongThisSession: false,
        SRS_interval: 3,
        status: 'review',
        correctCount: 2,
        incorrectCount: 0,
        dueDate: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // Overdue by 2 hours
        lastSeen: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(), // Reviewed 26 hours ago
        lastReviewDate: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
        nextReviewDate: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
      }
    },
    {
      key: 'book1',
      word: 'book',
      wordSenseId: 'book1',
      partOfSpeech: 'noun',
      definition: 'A written work published in printed or electronic form',
      inFlashcards: true,
      frequency: 7, // Common word (1-10 scale, 10 = most common)
      exampleSentencesGenerated: 'I read a fascinating ~book~ about space exploration. // Leí un ~libro~ fascinante sobre exploración espacial. // She bought a new ~book~ from the bookstore. // Compró un ~libro~ nuevo en la librería. // The ~book~ on the table belongs to my sister. // El ~libro~ sobre la mesa pertenece a mi hermana. // He wrote his first ~book~ last year. // Escribió su primer ~libro~ el año pasado. // This ~book~ has over 500 pages. // Este ~libro~ tiene más de 500 páginas.',
      srsData: {
        isNew: false,
        gotWrongThisSession: false,
        SRS_interval: 2,
        status: 'learning',
        correctCount: 1,
        incorrectCount: 0,
        dueDate: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(), // Due in 3 hours
        lastSeen: new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString(), // Reviewed 7 hours ago
        lastReviewDate: new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString(),
        nextReviewDate: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString()
      }
    },
    {
      key: 'happy1',
      word: 'happy',
      wordSenseId: 'happy1',
      partOfSpeech: 'adjective',
      definition: 'Feeling or showing pleasure or contentment',
      inFlashcards: true,
      frequency: 7, // Common word (1-10 scale, 10 = most common)
      exampleSentencesGenerated: 'She feels very ~happy~ about her new job. // Se siente muy ~feliz~ por su nuevo trabajo. // The children are ~happy~ to see their grandparents. // Los niños están ~felices~ de ver a sus abuelos. // I am ~happy~ to help you with this project. // Estoy ~feliz~ de ayudarte con este proyecto. // They look ~happy~ together in the photo. // Se ven ~felices~ juntos en la foto. // We were ~happy~ to receive your invitation. // Estuvimos ~felices~ de recibir tu invitación.',
      srsData: {
        isNew: true,
        gotWrongThisSession: false,
        SRS_interval: 1,
        status: 'new',
        correctCount: 0,
        incorrectCount: 0,
        dueDate: null,
        lastSeen: null,
        lastReviewDate: null,
        nextReviewDate: new Date().toISOString()
      }
    },
    {
      key: 'water1',
      word: 'water',
      wordSenseId: 'water1',
      partOfSpeech: 'noun',
      definition: 'A clear liquid essential for life',
      inFlashcards: true,
      frequency: 9, // Core/basic vocabulary (1-10 scale, 10 = most common)
      exampleSentencesGenerated: 'Please drink more ~water~ to stay hydrated. // Por favor, bebe más ~agua~ para mantenerte hidratado. // The ~water~ in the lake is crystal clear. // El ~agua~ del lago está cristalina. // She filled the glass with cold ~water~. // Llenó el vaso con ~agua~ fría. // Plants need ~water~ and sunlight to grow. // Las plantas necesitan ~agua~ y luz solar para crecer. // The bottle contains filtered ~water~. // La botella contiene ~agua~ filtrada.',
      srsData: {
        isNew: true,
        gotWrongThisSession: false,
        SRS_interval: 1,
        status: 'new',
        correctCount: 0,
        incorrectCount: 0,
        dueDate: null,
        lastSeen: null,
        lastReviewDate: null,
        nextReviewDate: new Date().toISOString()
      }
    }
  ];
};