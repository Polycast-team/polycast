/**
 * Hardcoded cards for non-saving mode
 * Organized into separate new and review card arrays
 */

// Array of new flashcards (never been studied) - 10 cards
export const getNewCards = () => {
  return [
    {
      key: 'good1',
      word: 'good',
      wordSenseId: 'good1',
      partOfSpeech: 'adjective',
      definition: 'Having the required qualities; of a high standard',
      inFlashcards: true,
      frequency: 10, // Most common
      exampleSentencesGenerated: 'This is a ~good~ book to read. // Este es un ~buen~ libro para leer. // She is a ~good~ student. // Ella es una ~buena~ estudiante. // Have a ~good~ day! // ¡Que tengas un ~buen~ día!',
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
      frequency: 9,
      exampleSentencesGenerated: 'Please drink more ~water~ to stay hydrated. // Por favor, bebe más ~agua~ para mantenerte hidratado. // The ~water~ in the lake is crystal clear. // El ~agua~ del lago está cristalina. // She filled the glass with cold ~water~. // Llenó el vaso con ~agua~ fría.',
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
      key: 'time1',
      word: 'time',
      wordSenseId: 'time1',
      partOfSpeech: 'noun',
      definition: 'The indefinite continued progress of existence',
      inFlashcards: true,
      frequency: 9,
      exampleSentencesGenerated: 'What ~time~ is it now? // ¿Qué ~hora~ es ahora? // We had a great ~time~ at the party. // La pasamos muy bien en la fiesta. // ~Time~ flies when you are having fun. // El ~tiempo~ vuela cuando te diviertes.',
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
      key: 'house1',
      word: 'house',
      wordSenseId: 'house1',
      partOfSpeech: 'noun',
      definition: 'A building for human habitation',
      inFlashcards: true,
      frequency: 8,
      exampleSentencesGenerated: 'They bought a new ~house~ last year. // Compraron una ~casa~ nueva el año pasado. // The ~house~ has three bedrooms. // La ~casa~ tiene tres dormitorios. // She painted the ~house~ blue. // Pintó la ~casa~ de azul.',
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
      key: 'love1',
      word: 'love',
      wordSenseId: 'love1',
      partOfSpeech: 'verb',
      definition: 'To feel deep affection for someone or something',
      inFlashcards: true,
      frequency: 8,
      exampleSentencesGenerated: 'I ~love~ spending time with my family. // ~Amo~ pasar tiempo con mi familia. // They ~love~ watching movies together. // Les ~encanta~ ver películas juntos. // She loves to ~love~ and be loved. // A ella le encanta ~amar~ y ser amada.',
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
      key: 'school1',
      word: 'school',
      wordSenseId: 'school1',
      partOfSpeech: 'noun',
      definition: 'An institution for educating children',
      inFlashcards: true,
      frequency: 8,
      exampleSentencesGenerated: 'The children go to ~school~ every day. // Los niños van a la ~escuela~ todos los días. // She teaches at the local ~school~. // Ella enseña en la ~escuela~ local. // ~School~ starts at 8 AM. // La ~escuela~ comienza a las 8 AM.',
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
      key: 'car1',
      word: 'car',
      wordSenseId: 'car1',
      partOfSpeech: 'noun',
      definition: 'A motor vehicle with four wheels',
      inFlashcards: true,
      frequency: 7,
      exampleSentencesGenerated: 'He drives his ~car~ to work. // Él maneja su ~carro~ al trabajo. // The ~car~ is parked outside. // El ~carro~ está estacionado afuera. // They bought a new ~car~. // Compraron un ~carro~ nuevo.',
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
      key: 'happy1',
      word: 'happy',
      wordSenseId: 'happy1',
      partOfSpeech: 'adjective',
      definition: 'Feeling or showing pleasure or contentment',
      inFlashcards: true,
      frequency: 7,
      exampleSentencesGenerated: 'She feels very ~happy~ about her new job. // Se siente muy ~feliz~ por su nuevo trabajo. // The children are ~happy~ to see their grandparents. // Los niños están ~felices~ de ver a sus abuelos. // I am ~happy~ to help you with this project. // Estoy ~feliz~ de ayudarte con este proyecto.',
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
      key: 'friend1',
      word: 'friend',
      wordSenseId: 'friend1',
      partOfSpeech: 'noun',
      definition: 'A person you like and know well',
      inFlashcards: true,
      frequency: 7,
      exampleSentencesGenerated: 'She is my best ~friend~. // Ella es mi mejor ~amiga~. // I met my ~friend~ at the cafe. // Me encontré con mi ~amigo~ en el café. // Good ~friends~ are hard to find. // Los buenos ~amigos~ son difíciles de encontrar.',
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
      key: 'learn1',
      word: 'learn',
      wordSenseId: 'learn1',
      partOfSpeech: 'verb',
      definition: 'To acquire knowledge or skill through study or experience',
      inFlashcards: true,
      frequency: 6,
      exampleSentencesGenerated: 'I want to ~learn~ Spanish this year. // Quiero ~aprender~ español este año. // Children ~learn~ quickly. // Los niños ~aprenden~ rápidamente. // She loves to ~learn~ new things. // A ella le encanta ~aprender~ cosas nuevas.',
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

// Array of review flashcards (have been studied before) - 6 cards
export const getReviewCards = () => {
  return [
    {
      key: 'eat1',
      word: 'eat',
      wordSenseId: 'eat1',
      partOfSpeech: 'verb',
      definition: 'To consume food',
      inFlashcards: true,
      frequency: 9,
      exampleSentencesGenerated: 'I ~eat~ breakfast every morning at seven. // ~Como~ desayuno todas las mañanas a las siete. // They ~eat~ dinner together as a family. // Ellos ~cenan~ juntos como familia. // She likes to ~eat~ healthy foods. // A ella le gusta ~comer~ alimentos saludables.',
      srsData: {
        isNew: false,
        gotWrongThisSession: false,
        SRS_interval: 3,
        status: 'review',
        correctCount: 2,
        incorrectCount: 0,
        dueDate: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // Overdue by 2 hours
        lastSeen: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
        lastReviewDate: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
        nextReviewDate: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
      }
    },
    {
      key: 'run1',
      word: 'run',
      wordSenseId: 'run1',
      partOfSpeech: 'verb',
      definition: 'To move quickly on foot',
      inFlashcards: true,
      frequency: 7,
      exampleSentencesGenerated: 'I like to ~run~ in the morning for exercise. // Me gusta ~correr~ por la mañana para hacer ejercicio. // She decided to ~run~ to catch the bus. // Decidió ~correr~ para alcanzar el autobús. // They ~run~ together every weekend. // Ellos ~corren~ juntos todos los fines de semana.',
      srsData: {
        isNew: false,
        gotWrongThisSession: false,
        SRS_interval: 2,
        status: 'learning',
        correctCount: 1,
        incorrectCount: 0,
        dueDate: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // Due in 5 minutes
        lastSeen: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        lastReviewDate: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        nextReviewDate: new Date(Date.now() + 5 * 60 * 1000).toISOString()
      }
    },
    {
      key: 'food1',
      word: 'food',
      wordSenseId: 'food1',
      partOfSpeech: 'noun',
      definition: 'Any nutritious substance that people or animals eat',
      inFlashcards: true,
      frequency: 8,
      exampleSentencesGenerated: 'The ~food~ at this restaurant is delicious. // La ~comida~ en este restaurante está deliciosa. // We need to buy ~food~ for dinner. // Necesitamos comprar ~comida~ para la cena. // Healthy ~food~ is important. // La ~comida~ saludable es importante.',
      srsData: {
        isNew: false,
        gotWrongThisSession: false,
        SRS_interval: 2,
        status: 'learning',
        correctCount: 1,
        incorrectCount: 0,
        dueDate: new Date(Date.now() + 45 * 60 * 1000).toISOString(), // Due in 45 minutes
        lastSeen: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
        lastReviewDate: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
        nextReviewDate: new Date(Date.now() + 45 * 60 * 1000).toISOString()
      }
    },
    {
      key: 'book1',
      word: 'book',
      wordSenseId: 'book1',
      partOfSpeech: 'noun',
      definition: 'A written work published in printed or electronic form',
      inFlashcards: true,
      frequency: 7,
      exampleSentencesGenerated: 'I read a fascinating ~book~ about space exploration. // Leí un ~libro~ fascinante sobre exploración espacial. // She bought a new ~book~ from the bookstore. // Compró un ~libro~ nuevo en la librería. // The ~book~ on the table belongs to my sister. // El ~libro~ sobre la mesa pertenece a mi hermana.',
      srsData: {
        isNew: false,
        gotWrongThisSession: false,
        SRS_interval: 2,
        status: 'learning',
        correctCount: 1,
        incorrectCount: 0,
        dueDate: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(), // Due in 3 hours
        lastSeen: new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString(),
        lastReviewDate: new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString(),
        nextReviewDate: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString()
      }
    },
    {
      key: 'work1',
      word: 'work',
      wordSenseId: 'work1',
      partOfSpeech: 'verb',
      definition: 'To be engaged in physical or mental activity',
      inFlashcards: true,
      frequency: 7,
      exampleSentencesGenerated: 'I ~work~ at a technology company. // ~Trabajo~ en una empresa de tecnología. // They ~work~ hard every day. // Ellos ~trabajan~ duro todos los días. // She loves her ~work~. // Ella ama su ~trabajo~.',
      srsData: {
        isNew: false,
        gotWrongThisSession: false,
        SRS_interval: 3,
        status: 'review',
        correctCount: 2,
        incorrectCount: 0,
        dueDate: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(), // Due in 6 hours
        lastSeen: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
        lastReviewDate: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
        nextReviewDate: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString()
      }
    },
    {
      key: 'walk1',
      word: 'walk',
      wordSenseId: 'walk1',
      partOfSpeech: 'verb',
      definition: 'To move at a regular pace by lifting and setting down each foot in turn',
      inFlashcards: true,
      frequency: 8,
      exampleSentencesGenerated: 'I like to ~walk~ in the park every evening. // Me gusta ~caminar~ en el parque todas las noches. // They ~walk~ to school together. // Ellos ~caminan~ juntos a la escuela. // She decided to ~walk~ instead of taking the bus. // Decidió ~caminar~ en lugar de tomar el autobús.',
      srsData: {
        isNew: false,
        gotWrongThisSession: false,
        SRS_interval: 4,
        status: 'review',
        correctCount: 3,
        incorrectCount: 0,
        dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(), // Due in 1 day
        lastSeen: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        lastReviewDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        nextReviewDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString()
      }
    }
  ];
};

// Maintain backward compatibility by combining both arrays
export const getHardcodedCards = () => {
  const newCards = getNewCards();
  const reviewCards = getReviewCards();
  
  // Sort new cards by frequency (highest first)
  newCards.sort((a, b) => (b.frequency || 5) - (a.frequency || 5));
  
  // Sort review cards by due date (earliest first)
  reviewCards.sort((a, b) => {
    const dateA = new Date(a.srsData.dueDate || a.srsData.nextReviewDate);
    const dateB = new Date(b.srsData.dueDate || b.srsData.nextReviewDate);
    return dateA - dateB;
  });
  
  return [...reviewCards, ...newCards];
};