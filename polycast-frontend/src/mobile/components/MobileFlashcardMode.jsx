import React, { useState, useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import { calculateNextReview, getDueCards, getReviewStats, formatNextReviewTime } from '../../utils/srsAlgorithm';
import { getSRSSettings } from '../../utils/srsSettings';
import { TouchGestureHandler } from '../utils/touchGestures';
import ErrorPopup from '../../components/ErrorPopup';
import { useErrorHandler } from '../../hooks/useErrorHandler';

const MobileFlashcardMode = ({ 
  selectedProfile, 
  wordDefinitions, 
  setWordDefinitions, 
  onBack 
}) => {
  console.log(`[MOBILE DEBUG] MobileFlashcardMode loaded - version with hardcoded cards - ${new Date().toISOString()}`);
  const [currentDueIndex, setCurrentDueIndex] = useState(0);
  const [dueCards, setDueCards] = useState([]);
  const [todaysNewCards, setTodaysNewCards] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [srsSettings] = useState(getSRSSettings());
  const [stats, setStats] = useState({
    cardsReviewed: 0,
    correctAnswers: 0,
    sessionStartTime: new Date()
  });
  const [swipeAnimation, setSwipeAnimation] = useState('');
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [dragState, setDragState] = useState({ isDragging: false, deltaX: 0, deltaY: 0, opacity: 1 });
  const [cardEntryAnimation, setCardEntryAnimation] = useState('');
  const [answerFeedback, setAnswerFeedback] = useState({ show: false, type: '', text: '' });
  const [audioState, setAudioState] = useState({ loading: false, error: null });
  const [currentAudio, setCurrentAudio] = useState(null);
  const [hasAutoPlayedThisFlip, setHasAutoPlayedThisFlip] = useState(false);
  const { error: popupError, showError, clearError } = useErrorHandler();
  
  // Refs for gesture handling
  const cardContainerRef = useRef(null);
  const gestureHandlerRef = useRef(null);
  const isProcessingTap = useRef(false);
  const lastTapTime = useRef(0);
  const touchStartPos = useRef(null);
  const touchStartTime = useRef(0);
  const lastTouchPos = useRef(null);
  const lastTouchTime = useRef(0);
  const isDragging = useRef(false);
  const dragStartPos = useRef(null);
  const hasPlayedAudioForCard = useRef(null);
  
  // Stable date for new cards - only calculate once
  const nowDateRef = useRef(new Date().toISOString());

  // Get hardcoded cards for non-saving mode
  const getHardcodedCards = () => {
    return [
      {
        key: 'run1',
        word: 'run',
        wordSenseId: 'run1',
        partOfSpeech: 'verb',
        definition: 'To move quickly on foot',
        inFlashcards: true,
        exampleSentencesGenerated: 'I like to ~run~ in the morning for exercise. // Me gusta ~correr~ por la mañana para hacer ejercicio. // She decided to ~run~ to catch the bus. // Decidió ~correr~ para alcanzar el autobús. // They ~run~ together every weekend. // Ellos ~corren~ juntos todos los fines de semana. // The dog loves to ~run~ in the park. // Al perro le encanta ~correr~ en el parque. // He can ~run~ very fast. // Él puede ~correr~ muy rápido.',
        srsData: {
          status: 'new',
          interval: 0,
          easeFactor: 2.5,
          correctCount: 0,
          incorrectCount: 0,
          lastReviewDate: null,
          nextReviewDate: new Date().toISOString(),
          currentStep: 0
        }
      },
      {
        key: 'eat1',
        word: 'eat',
        wordSenseId: 'eat1',
        partOfSpeech: 'verb',
        definition: 'To consume food',
        inFlashcards: true,
        exampleSentencesGenerated: 'I ~eat~ breakfast every morning at seven. // ~Como~ desayuno todas las mañanas a las siete. // They ~eat~ dinner together as a family. // Ellos ~cenan~ juntos como familia. // She likes to ~eat~ healthy foods. // A ella le gusta ~comer~ alimentos saludables. // We usually ~eat~ lunch at noon. // Normalmente ~comemos~ el almuerzo al mediodía. // The children ~eat~ too much candy. // Los niños ~comen~ demasiados dulces.',
        srsData: {
          status: 'new',
          interval: 0,
          easeFactor: 2.5,
          correctCount: 0,
          incorrectCount: 0,
          lastReviewDate: null,
          nextReviewDate: new Date().toISOString(),
          currentStep: 0
        }
      },
      {
        key: 'book1',
        word: 'book',
        wordSenseId: 'book1',
        partOfSpeech: 'noun',
        definition: 'A written work published in printed or electronic form',
        inFlashcards: true,
        exampleSentencesGenerated: 'I read a fascinating ~book~ about space exploration. // Leí un ~libro~ fascinante sobre exploración espacial. // She bought a new ~book~ from the bookstore. // Compró un ~libro~ nuevo en la librería. // The ~book~ on the table belongs to my sister. // El ~libro~ sobre la mesa pertenece a mi hermana. // He wrote his first ~book~ last year. // Escribió su primer ~libro~ el año pasado. // This ~book~ has over 500 pages. // Este ~libro~ tiene más de 500 páginas.',
        srsData: {
          status: 'new',
          interval: 0,
          easeFactor: 2.5,
          correctCount: 0,
          incorrectCount: 0,
          lastReviewDate: null,
          nextReviewDate: new Date().toISOString(),
          currentStep: 0
        }
      },
      {
        key: 'happy1',
        word: 'happy',
        wordSenseId: 'happy1',
        partOfSpeech: 'adjective',
        definition: 'Feeling or showing pleasure or contentment',
        inFlashcards: true,
        exampleSentencesGenerated: 'She feels very ~happy~ about her new job. // Se siente muy ~feliz~ por su nuevo trabajo. // The children are ~happy~ to see their grandparents. // Los niños están ~felices~ de ver a sus abuelos. // I am ~happy~ to help you with this project. // Estoy ~feliz~ de ayudarte con este proyecto. // They look ~happy~ together in the photo. // Se ven ~felices~ juntos en la foto. // We were ~happy~ to receive your invitation. // Estuvimos ~felices~ de recibir tu invitación.',
        srsData: {
          status: 'new',
          interval: 0,
          easeFactor: 2.5,
          correctCount: 0,
          incorrectCount: 0,
          lastReviewDate: null,
          nextReviewDate: new Date().toISOString(),
          currentStep: 0
        }
      },
      {
        key: 'water1',
        word: 'water',
        wordSenseId: 'water1',
        partOfSpeech: 'noun',
        definition: 'A clear liquid essential for life',
        inFlashcards: true,
        exampleSentencesGenerated: 'Please drink more ~water~ to stay hydrated. // Por favor, bebe más ~agua~ para mantenerte hidratado. // The ~water~ in the lake is crystal clear. // El ~agua~ del lago está cristalina. // She filled the glass with cold ~water~. // Llenó el vaso con ~agua~ fría. // Plants need ~water~ and sunlight to grow. // Las plantas necesitan ~agua~ y luz solar para crecer. // The bottle contains filtered ~water~. // La botella contiene ~agua~ filtrada.',
        srsData: {
          status: 'new',
          interval: 0,
          easeFactor: 2.5,
          correctCount: 0,
          incorrectCount: 0,
          lastReviewDate: null,
          nextReviewDate: new Date().toISOString(),
          currentStep: 0
        }
      }
    ];
  };

  // Process the wordDefinitions to extract all word senses and initialize SRS data
  const availableCards = React.useMemo(() => {
    console.log(`[MOBILE DEBUG] Selected profile is: "${selectedProfile}"`);
    // For non-saving mode, use hardcoded cards
    if (selectedProfile === 'non-saving') {
      const hardcodedCards = getHardcodedCards();
      console.log(`[MOBILE DEBUG] Using hardcoded cards for non-saving mode:`, hardcodedCards);
      console.log(`[MOBILE DEBUG] First card example:`, hardcodedCards[0]?.exampleSentencesGenerated);
      return hardcodedCards;
    }

    // For other profiles, process actual wordDefinitions
    const cards = [];
    Object.entries(wordDefinitions).forEach(([key, value]) => {
      if (value && value.wordSenseId && value.inFlashcards) {
        // Initialize SRS data if it doesn't exist
        const cardWithSRS = { ...value, key };
        if (!cardWithSRS.srsData) {
          cardWithSRS.srsData = {
            status: 'new',
            interval: 0,
            easeFactor: 2.5,
            correctCount: 0,
            incorrectCount: 0,
            lastReviewDate: null,
            nextReviewDate: nowDateRef.current, // Due now
            currentStep: 0
          };
        }
        cards.push(cardWithSRS);
      }
    });
    console.log(`[MOBILE DEBUG] Processed cards with SRS data:`, cards);
    return cards;
  }, [wordDefinitions, selectedProfile]);

  // Initialize daily limits and due cards
  useEffect(() => {
    const initializeDailyLimits = async () => {
      const today = new Date().toDateString();
      
      if (selectedProfile === 'non-saving') {
        setTodaysNewCards(0);
      } else {
        try {
          const response = await fetch(`https://polycast-server.onrender.com/api/profile/${selectedProfile}/srs-daily`);
          if (response.ok) {
            const dailyData = await response.json();
            
            if (dailyData.date !== today) {
              setTodaysNewCards(0);
              await fetch(`https://polycast-server.onrender.com/api/profile/${selectedProfile}/srs-daily`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date: today, newCardsToday: 0 })
              });
            } else {
              setTodaysNewCards(dailyData.newCardsToday || 0);
            }
          } else {
            setTodaysNewCards(0);
            await fetch(`https://polycast-server.onrender.com/api/profile/${selectedProfile}/srs-daily`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ date: today, newCardsToday: 0 })
            });
          }
        } catch (error) {
          console.error('Error loading daily SRS data:', error);
          setTodaysNewCards(0);
        }
      }
    };

    initializeDailyLimits();
  }, [selectedProfile]);

  // Flag to prevent useEffect from running during card processing
  const processingCardRef = useRef(false);

  // Update due cards when dependencies change
  useEffect(() => {
    // Skip if we're in the middle of processing a card
    if (processingCardRef.current) {
      console.log(`[MOBILE DEBUG] Skipping due cards update - processing card`);
      return;
    }
    
    console.log(`[MOBILE DEBUG] Available cards:`, availableCards.length, availableCards);
    const currentSettings = getSRSSettings();
    const maxNewToday = Math.max(0, currentSettings.newCardsPerDay - todaysNewCards);
    console.log(`[MOBILE DEBUG] Max new cards today:`, maxNewToday, `(total: ${currentSettings.newCardsPerDay}, used: ${todaysNewCards})`);
    
    let due = getDueCards(availableCards, { newPerDay: maxNewToday }, false);
    console.log(`[MOBILE DEBUG] Due cards (strict):`, due.length, due);
    
    if (due.length === 0) {
      due = getDueCards(availableCards, { newPerDay: maxNewToday }, true);
      console.log(`[MOBILE DEBUG] Due cards (fallback):`, due.length, due);
    }
    
    setDueCards(due);
    setCurrentDueIndex(0);
    setCompletedSteps(0); // Reset progress when cards change
  }, [availableCards, todaysNewCards]);

  // Get SRS statistics
  const srsStats = React.useMemo(() => getReviewStats(availableCards), [availableCards]);

  // Calculate card counts for Anki-style progress (memoized for toolbar stability)
  const cardCounts = React.useMemo(() => {
    const newCards = dueCards.filter(card => card.srsData?.status === 'new').length;
    const learningCards = dueCards.filter(card => 
      card.srsData?.status === 'learning' || card.srsData?.status === 'relearning'
    ).length;
    const reviewCards = dueCards.filter(card => card.srsData?.status === 'review').length;
    
    return { newCards, learningCards, reviewCards };
  }, [dueCards]);

  // Calculate accuracy inline for headerStats
  const headerStats = React.useMemo(() => {
    const accuracy = stats.cardsReviewed > 0 ? Math.round((stats.correctAnswers / stats.cardsReviewed) * 100) : 0;
    return {
      accuracy,
      cardsReviewed: stats.cardsReviewed,
      newCards: cardCounts.newCards,
      learningCards: cardCounts.learningCards,
      reviewCards: cardCounts.reviewCards
    };
  }, [stats.cardsReviewed, stats.correctAnswers, cardCounts.newCards, cardCounts.learningCards, cardCounts.reviewCards]);

  // Calculate total mathematical steps (assuming all correct answers) - memoized for stability
  const totalSteps = React.useMemo(() => {
    let steps = 0;
    dueCards.forEach(card => {
      const status = card.srsData?.status;
      const currentStep = card.srsData?.currentStep || 0;
      
      if (status === 'new') {
        // New card: 1 step to learning + learning steps to review
        steps += 1 + srsSettings.learningSteps.length;
      } else if (status === 'learning') {
        // Learning card: remaining learning steps to review
        steps += srsSettings.learningSteps.length - currentStep;
      } else if (status === 'relearning') {
        // Relearning card: remaining relearning steps to review
        steps += srsSettings.relearningSteps.length - currentStep;
      } else if (status === 'review') {
        // Review card: 1 step to complete
        steps += 1;
      }
    });
    return steps;
  }, [dueCards, srsSettings]);

  // Track completed steps for progress bar
  const [completedSteps, setCompletedSteps] = useState(0);
  
  // Track when we're in the middle of processing a card to prevent premature completion
  const [lastCardProcessedTime, setLastCardProcessedTime] = useState(0);

  // Stable progress calculation to prevent progress bar flashing
  const progressPercentage = React.useMemo(() => {
    return totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;
  }, [completedSteps, totalSteps]);

  // Calculate button times based on current card
  const buttonTimes = React.useMemo(() => {
    if (!dueCards.length || !dueCards[currentDueIndex]) {
      return { incorrect: '1 min', correct: '10 min', easy: '4 days' };
    }
    
    const currentCard = dueCards[currentDueIndex];
    return {
      incorrect: formatNextReviewTime(calculateNextReview(currentCard, 'incorrect').nextReviewDate),
      correct: formatNextReviewTime(calculateNextReview(currentCard, 'correct').nextReviewDate),
      easy: formatNextReviewTime(calculateNextReview(currentCard, 'easy').nextReviewDate)
    };
  }, [dueCards, currentDueIndex]);

  // Handle card flipping
  const flipCard = useCallback(() => {
    const now = Date.now();
    console.log(`[MOBILE DEBUG] Flipping card from ${isFlipped} to ${!isFlipped}`);
    // Use function form to ensure immediate update
    setIsFlipped(prev => {
      console.log(`[MOBILE DEBUG] Flip state changing from ${prev} to ${!prev}`);
      return !prev;
    });
    lastTapTime.current = now;
  }, [isFlipped]);

  // Direct touch start handler (works for both touch and mouse)
  const handleDirectTouchStart = useCallback((e) => {
    // Get coordinates from either touch or mouse event
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const now = Date.now();
    
    if (!isFlipped) {
      // Front side - handle tap for flipping
      touchStartPos.current = { x: clientX, y: clientY };
      touchStartTime.current = now;
      console.log('[DIRECT TOUCH] Touch/click start recorded for flip');
    } else {
      // Back side - handle drag for swiping
      dragStartPos.current = { x: clientX, y: clientY };
      lastTouchPos.current = { x: clientX, y: clientY };
      lastTouchTime.current = now;
      isDragging.current = false; // Will become true in touchmove/mousemove
      console.log('[DIRECT DRAG] Touch/click start recorded for drag at:', clientX, clientY);
    }
  }, [isFlipped]);

  // RAF throttling for smooth drag updates
  const rafRef = useRef(null);
  const pendingDragState = useRef(null);
  
  // Direct touch move handler for dragging (works for both touch and mouse)
  const handleDirectTouchMove = useCallback((e) => {
    if (!isFlipped || !dragStartPos.current) return;
    
    // Get coordinates from either touch or mouse event
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const now = Date.now();
    
    const deltaX = clientX - dragStartPos.current.x;
    const deltaY = clientY - dragStartPos.current.y;
    
    // Only track horizontal movement
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 5) {
      isDragging.current = true;
      lastTouchPos.current = { x: clientX, y: clientY };
      lastTouchTime.current = now;
      
      const rotation = deltaX * 0.1;
      const opacity = Math.max(0.3, 1 - (Math.abs(deltaX) / 200));
      const colorIntensity = Math.min(1, Math.abs(deltaX) / 200);
      
      // Store pending state
      pendingDragState.current = {
        isDragging: true,
        deltaX,
        deltaY: 0,
        rotation,
        opacity,
        colorIntensity
      };
      
      // Throttle state updates using RAF
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(() => {
          if (pendingDragState.current) {
            setDragState(pendingDragState.current);
          }
          rafRef.current = null;
        });
      }
      
      e.preventDefault(); // Prevent scrolling
    }
  }, [isFlipped]);

  // Generate and play audio for the current sentence
  const generateAndPlayAudio = useCallback(async (text, cardKey) => {
    // Check loading state directly from ref to avoid dependency issues
    if (!text) return;
    
    setAudioState(prev => {
      if (prev.loading) return prev; // Already loading, skip
      return { loading: true, error: null };
    });
    
    try {
      // First, check if audio already exists in backend
      const checkResponse = await fetch(`https://polycast-server.onrender.com/api/audio/${encodeURIComponent(cardKey)}`);
      
      let audioUrl;
      if (checkResponse.ok) {
        // Audio already exists
        const audioData = await checkResponse.json();
        if (!audioData || !audioData.audioUrl) {
          throw new Error('Invalid audio data received from server');
        }
        audioUrl = audioData.audioUrl;
      } else {
        // Generate new audio
        const generateResponse = await fetch('https://polycast-server.onrender.com/api/generate-audio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            text: text.replace(/<[^>]*>/g, ''), // Strip HTML tags
            cardKey: cardKey,
            profile: selectedProfile
          })
        });
        
        if (!generateResponse.ok) {
          throw new Error('Failed to generate audio');
        }
        
        const audioData = await generateResponse.json();
        if (!audioData || !audioData.audioUrl) {
          throw new Error('Invalid audio data generated by server');
        }
        audioUrl = audioData.audioUrl;
      }
      
      // Play the audio
      setCurrentAudio(prevAudio => {
        if (prevAudio) {
          prevAudio.pause();
          prevAudio.currentTime = 0;
        }
        
        const audio = new Audio(audioUrl);
        
        audio.onended = () => {
          setAudioState({ loading: false, error: null });
        };
        
        audio.onerror = () => {
          setAudioState({ loading: false, error: null });
          showError('Failed to play audio');
        };
        
        audio.play().then(() => {
          setAudioState({ loading: false, error: null });
        }).catch(err => {
          console.error('Audio play error:', err);
          setAudioState({ loading: false, error: null });
          showError(`Failed to play audio: ${err.message}`);
        });
        
        return audio;
      });
      
    } catch (error) {
      console.error('Audio generation error:', error);
      setAudioState({ loading: false, error: null });
      showError(`Failed to generate audio: ${error.message}`);
    }
  }, [selectedProfile, showError]);

  // Play audio button handler
  const handlePlayAudio = useCallback(() => {
    const currentCard = dueCards[currentDueIndex];
    if (!currentCard || !currentCard.exampleSentencesGenerated) return;
    
    const parts = currentCard.exampleSentencesGenerated.split('//').map(s => s.trim()).filter(s => s.length > 0);
    const interval = currentCard?.srsData?.interval || 1;
    const sentenceIndex = ((interval - 1) % 5) * 2;
    const englishSentence = parts[sentenceIndex] || parts[0] || '';
    
    if (englishSentence) {
      // Reset the auto-play flag so manual plays don't affect auto-play
      generateAndPlayAudio(englishSentence, currentCard.key);
    }
  }, [dueCards, currentDueIndex, generateAndPlayAudio]);

  // Reset auto-play flag when card changes OR when flipped to front
  useEffect(() => {
    if (!isFlipped) {
      setHasAutoPlayedThisFlip(false);
    }
  }, [currentDueIndex, isFlipped]);

  // Auto-play audio when card is flipped (only once per flip)
  useEffect(() => {
    if (isFlipped && dueCards.length > 0 && !hasAutoPlayedThisFlip) {
      const currentCard = dueCards[currentDueIndex];
      
      if (currentCard && currentCard.exampleSentencesGenerated) {
        setHasAutoPlayedThisFlip(true); // Mark as played immediately to prevent duplicates
        
        const parts = currentCard.exampleSentencesGenerated.split('//').map(s => s.trim()).filter(s => s.length > 0);
        const interval = currentCard?.srsData?.interval || 1;
        const sentenceIndex = ((interval - 1) % 5) * 2;
        const englishSentence = parts[sentenceIndex] || parts[0] || '';
        
        if (englishSentence) {
          // Small delay to let the flip animation finish
          setTimeout(() => {
            generateAndPlayAudio(englishSentence, currentCard.key);
          }, 300);
        }
      }
    }
  }, [isFlipped, dueCards, currentDueIndex, hasAutoPlayedThisFlip]);

  // Simple click handler for flipping (fallback for mouse clicks)
  const handleCardClick = useCallback((e) => {
    if (!isFlipped && !isDragging.current) {
      console.log('[CARD CLICK] Simple click detected - flipping card');
      e.preventDefault();
      e.stopPropagation();
      flipCard();
    }
  }, [isFlipped, flipCard]);

  // Show answer feedback with SRS timing
  const showAnswerFeedback = useCallback((answer, currentCard) => {
    if (!currentCard) return;
    
    // Calculate what the next review time would be for this answer
    const updatedSrsData = calculateNextReview(currentCard, answer);
    const timeText = formatNextReviewTime(updatedSrsData.nextReviewDate);
    
    const feedbackData = {
      correct: { type: 'correct', text: timeText },
      incorrect: { type: 'incorrect', text: timeText },
      easy: { type: 'easy', text: timeText }
    };
    
    const feedback = feedbackData[answer];
    if (feedback) {
      setAnswerFeedback({ show: true, ...feedback });
      setTimeout(() => {
        setAnswerFeedback({ show: false, type: '', text: '' });
      }, 1000); // Show for 1 second
    }
  }, []);

  // Handle answer selection
  const markCard = useCallback((answer) => {
    if (dueCards.length === 0) return;
    
    const currentCard = dueCards[currentDueIndex];
    if (!currentCard) return;
    
    // Set processing flag to prevent useEffect from running
    processingCardRef.current = true;
    
    // Mark when we processed this card
    setLastCardProcessedTime(Date.now());
    
    // Show visual feedback
    showAnswerFeedback(answer, currentCard);
    
    // Calculate next review using SRS algorithm
    const updatedSrsData = calculateNextReview(currentCard, answer);
    
    // Update the card in wordDefinitions with new SRS data
    const updatedCard = {
      ...currentCard,
      srsData: updatedSrsData
    };
    
    // Prepare all state updates to happen together
    const now = new Date();
    const updatedDueDate = new Date(updatedSrsData.nextReviewDate);
    const stillDueToday = (updatedDueDate - now) < (24 * 60 * 60 * 1000);
    
    // Calculate new due cards array
    let newDueCards;
    let newDueIndex;
    
    if (stillDueToday && updatedSrsData.status !== 'review') {
      // Move card to end of queue
      newDueCards = [...dueCards];
      newDueCards.splice(currentDueIndex, 1);
      newDueCards.push(updatedCard);
      newDueIndex = currentDueIndex >= newDueCards.length ? 0 : currentDueIndex;
    } else {
      // Remove card from today's queue
      newDueCards = dueCards.filter((_, index) => index !== currentDueIndex);
      newDueIndex = currentDueIndex >= newDueCards.length && newDueCards.length > 0 ? newDueCards.length - 1 : currentDueIndex;
    }
    
    // Batch all state updates together to prevent UI flashing
    setWordDefinitions(prev => ({
      ...prev,
      [currentCard.key]: updatedCard
    }));
    
    setStats(prev => ({
      ...prev,
      cardsReviewed: prev.cardsReviewed + 1,
      correctAnswers: answer !== 'incorrect' ? prev.correctAnswers + 1 : prev.correctAnswers
    }));

    setCompletedSteps(prev => prev + 1);
    
    // Update new cards count if necessary
    if (currentCard.srsData.status === 'new') {
      const newCount = todaysNewCards + 1;
      setTodaysNewCards(newCount);
      
      if (selectedProfile !== 'non-saving') {
        const today = new Date().toDateString();
        fetch(`https://polycast-server.onrender.com/api/profile/${selectedProfile}/srs-daily`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: today, newCardsToday: newCount })
        }).catch(error => {
          console.error('Error saving daily SRS count:', error);
        });
      }
    }
    
    // Single timeout for all card transition logic
    setTimeout(() => {
      // Reset flip state first, then update cards
      setIsFlipped(false);
      
      // Small delay to ensure flip completes before changing cards
      setTimeout(() => {
        setDueCards(newDueCards);
        setCurrentDueIndex(newDueIndex);
        
        // Trigger entry animation for next card if there is one
        if (newDueCards.length > 0) {
          setCardEntryAnimation('card-enter');
          setTimeout(() => setCardEntryAnimation(''), 400);
        }
      }, 50);
      
      // Handle queue refresh if needed (less frequent operation)
      if (newDueCards.length === 0) {
        setTimeout(() => {
          // Clear processing flag before refresh
          processingCardRef.current = false;
          
          const updatedAvailableCards = [];
          Object.entries(wordDefinitions).forEach(([key, value]) => {
            if (value && value.wordSenseId && value.inFlashcards) {
              const cardToCheck = key === currentCard.key ? updatedCard : value;
              updatedAvailableCards.push({ ...cardToCheck, key });
            }
          });
          
          const maxNewForRefresh = Math.max(0, srsSettings.newCardsPerDay - todaysNewCards);
          let refreshedDueCards = getDueCards(updatedAvailableCards, { newPerDay: maxNewForRefresh }, false);
          
          if (refreshedDueCards.length === 0) {
            refreshedDueCards = getDueCards(updatedAvailableCards, { newPerDay: maxNewForRefresh }, true);
          }
          
          setDueCards(refreshedDueCards);
          setCurrentDueIndex(0);
          
          if (refreshedDueCards.length > 0) {
            setCardEntryAnimation('card-enter');
            setTimeout(() => setCardEntryAnimation(''), 400);
          }
        }, 100);
      } else {
        // Clear processing flag after card state is updated
        processingCardRef.current = false;
      }
    }, 200);
  }, [dueCards, currentDueIndex, setWordDefinitions, todaysNewCards, selectedProfile, srsSettings, showAnswerFeedback]);

  // Direct touch end handler (works for both touch and mouse)
  const handleDirectTouchEnd = useCallback((e) => {
    if (!isFlipped && touchStartPos.current) {
      // Front side - handle tap for flipping
      const now = Date.now();
      const touchDuration = now - touchStartTime.current;
      
      if (touchDuration < 500) { // Increased timeout for mouse clicks
        if (now - lastTapTime.current < 100) {
          console.log('[DIRECT TOUCH] Ignored - too soon after last tap');
        } else {
          console.log('[DIRECT TOUCH] Quick tap/click detected - executing flip');
          e.preventDefault();
          e.stopPropagation();
          flipCard();
        }
      }
      
      touchStartPos.current = null;
    } else if (isFlipped && dragStartPos.current) {
      // Back side - handle swipe completion
      console.log('[DIRECT DRAG] Touch end - isDragging:', isDragging.current, 'dragState:', dragState);
      
      if (isDragging.current) {
        // Calculate velocity based on recent movement
        let velocity = 0;
        if (lastTouchPos.current && lastTouchTime.current && dragStartPos.current) {
          const now = Date.now();
          const timeDiff = now - lastTouchTime.current;
          
          // Only use recent movement for velocity (within last 150ms)
          if (timeDiff < 150 && timeDiff > 10) {
            // Calculate velocity based on total movement, not just recent
            const totalDistanceX = Math.abs(dragState.deltaX);
            const totalTime = now - (lastTouchTime.current - timeDiff);
            velocity = totalDistanceX / (totalTime / 1000);
            console.log('[DIRECT MOMENTUM] Velocity:', velocity, 'px/s', 'totalDistance:', totalDistanceX, 'totalTime:', totalTime);
          }
        }
        
        // Check for auto-swipe with balanced thresholds
        const distanceThreshold = 60; // Distance threshold unchanged
        const largeDistanceThreshold = 120; // Large distance threshold for no-velocity swipes
        const velocityThreshold = 300; // Easier - reduced from 400
        const hasSignificantDistance = Math.abs(dragState.deltaX) > distanceThreshold;
        const hasLargeDistance = Math.abs(dragState.deltaX) > largeDistanceThreshold;
        const hasSignificantMomentum = velocity > velocityThreshold;
        
        // Trigger if: (distance + velocity) OR large distance alone OR very high velocity
        const shouldTriggerSwipe = (hasSignificantDistance && velocity > 60) || hasLargeDistance || velocity > 450;
        
        console.log('[DIRECT AUTO-SWIPE] Distance:', Math.abs(dragState.deltaX), 'Velocity:', velocity, 'hasDistance:', hasSignificantDistance, 'hasMomentum:', hasSignificantMomentum, 'shouldTrigger:', shouldTriggerSwipe);
        
        if (shouldTriggerSwipe) {
          console.log('[DIRECT AUTO-SWIPE] Triggering swipe!');
          
          // Determine answer: negative deltaX = left swipe = incorrect, positive deltaX = right swipe = correct
          if (dragState.deltaX < 0) {
            console.log('[DIRECT AUTO-SWIPE] Left swipe (deltaX < 0) = Incorrect');
            markCard('incorrect');
          } else {
            console.log('[DIRECT AUTO-SWIPE] Right swipe (deltaX > 0) = Correct');
            markCard('correct');
          }
          
          // Animate off screen
          const finalX = dragState.deltaX > 0 ? window.innerWidth + 100 : -window.innerWidth - 100;
          setDragState(prev => ({
            ...prev,
            deltaX: finalX,
            opacity: 0
          }));
          
          // Reset after animation
          setTimeout(() => {
            setDragState({ isDragging: false, deltaX: 0, deltaY: 0, opacity: 1 });
            setCardEntryAnimation('card-enter');
            setTimeout(() => setCardEntryAnimation(''), 400);
          }, 300);
        } else {
          console.log('[DIRECT DRAG] Not enough distance/momentum - resetting');
          setDragState({ isDragging: false, deltaX: 0, deltaY: 0, opacity: 1 });
        }
      }
      
      // Clean up any pending RAF
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      
      // Reset drag tracking
      dragStartPos.current = null;
      lastTouchPos.current = null;
      lastTouchTime.current = 0;
      isDragging.current = false;
    }
  }, [flipCard, isFlipped, dragState, markCard]);

  // Navigation functions removed - no longer needed since cards progress by answering only

  // Quick action for easy marking
  const quickMarkEasy = useCallback(() => {
    if (dueCards.length === 0 || !isFlipped) return;
    markCard('easy');
  }, [dueCards.length, isFlipped, markCard]);

  // Removed gestureCallbacks - using direct touch handlers instead

  // Initialize gesture handler (disabled - using direct touch handlers)
  useEffect(() => {
    // Gesture handler disabled in favor of direct touch handlers
    return () => {};
  }, []);

  // Calculate session stats
  const sessionDuration = Math.floor((new Date() - stats.sessionStartTime) / 1000 / 60);

  // Only show completion if no cards AND enough time has passed since last processing
  const timeSinceLastProcess = Date.now() - lastCardProcessedTime;
  if (dueCards.length === 0 && timeSinceLastProcess > 1000) {
    return (
      <div className="mobile-flashcard-mode">
        <div className="mobile-flashcard-header">
          <button className="mobile-back-btn" onClick={onBack}>
            ← Back
          </button>
          <div className="mobile-header-title">Study Complete</div>
        </div>
        
        <div className="mobile-empty-study-state">
          <div className="mobile-empty-icon">🎉</div>
          <h2>Great work!</h2>
          <p>You've completed all cards for today.</p>
          
          <div className="mobile-session-summary">
            <div className="mobile-summary-stat">
              <div className="mobile-summary-number">{stats.cardsReviewed}</div>
              <div className="mobile-summary-label">Cards Reviewed</div>
            </div>
            <div className="mobile-summary-stat">
              <div className="mobile-summary-number">{headerStats.accuracy}%</div>
              <div className="mobile-summary-label">Accuracy</div>
            </div>
            <div className="mobile-summary-stat">
              <div className="mobile-summary-number">{sessionDuration}</div>
              <div className="mobile-summary-label">Minutes</div>
            </div>
          </div>
          
          <button className="mobile-done-button" onClick={onBack}>
            Return to Profiles
          </button>
        </div>
      </div>
    );
  }

  const currentCard = dueCards[currentDueIndex];
  if (!currentCard) return null;

  const baseWord = currentCard.word || currentCard.wordSenseId?.replace(/\d+$/, '');
  const defNumber = currentCard.definitionNumber || currentCard.wordSenseId?.match(/\d+$/)?.[0] || '';
  const interval = currentCard?.srsData?.interval || 1;
  
  // Memoize expensive style calculations
  const cardStyle = React.useMemo(() => {
    const baseStyle = {
      transform: dragState.isDragging 
        ? `translateX(${dragState.deltaX}px) rotateZ(${dragState.rotation || 0}deg)`
        : (isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'),
      opacity: dragState.opacity,
      transition: dragState.isDragging ? 'none' : 'transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.2s ease'
    };
    
    if (dragState.colorIntensity > 0) {
      const isLeft = dragState.deltaX < 0;
      const color = isLeft ? '239, 68, 68' : '34, 197, 94';
      const intensity = dragState.colorIntensity;
      
      baseStyle.boxShadow = `0 0 ${30 * intensity}px rgba(${color}, ${intensity}), 0 0 ${60 * intensity}px rgba(${color}, ${intensity * 0.5})`;
      baseStyle.backgroundColor = `rgba(${color}, ${intensity * 0.1})`;
    }
    
    return baseStyle;
  }, [dragState.isDragging, dragState.deltaX, dragState.rotation, dragState.opacity, dragState.colorIntensity, isFlipped]);
  
  // Memoize parsed example content
  const parsedExampleContent = React.useMemo(() => {
    if (!currentCard?.exampleSentencesGenerated) return null;
    
    const parts = currentCard.exampleSentencesGenerated
      .split('//')
      .map(s => s.trim())
      .filter(s => s.length > 0);
      
    const sentenceIndex = ((interval - 1) % 5) * 2;
    const englishSentence = parts[sentenceIndex] || parts[0] || 'No example available';
    const nativeTranslation = parts[sentenceIndex + 1] || parts[1] || '';
    const clozeSentence = englishSentence.replace(/~[^~]+~/g, '_____');
    const highlightedSentence = englishSentence.replace(/~([^~]+)~/g, '<span class="mobile-highlighted-word">$1</span>');
    const exampleNumber = ((interval - 1) % 5) + 1;
    
    return { 
      englishSentence, 
      nativeTranslation, 
      clozeSentence, 
      highlightedSentence,
      exampleNumber 
    };
  }, [currentCard?.exampleSentencesGenerated, interval]);

  return (
    <div className="mobile-flashcard-mode">
      {/* Header */}
      <div className="mobile-flashcard-header">
        <button className="mobile-back-btn" onClick={onBack}>
          ← Back
        </button>
        <div style={{color: 'red', fontSize: '10px'}}>V2.0-HC</div>
        <div className="mobile-header-stats">
          <div className="mobile-header-progress">
            <span style={{color: '#5f72ff'}}>New: {headerStats.newCards}</span> • 
            <span style={{color: '#ef4444', marginLeft: '4px'}}>Learning: {headerStats.learningCards}</span> • 
            <span style={{color: '#10b981', marginLeft: '4px'}}>Review: {headerStats.reviewCards}</span>
          </div>
          <div className="mobile-header-accuracy">
            {headerStats.accuracy}% • {headerStats.cardsReviewed} done
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mobile-progress-container">
        <div 
          className="mobile-progress-bar"
          style={{ 
            width: `${progressPercentage}%` 
          }}
        />
      </div>

      {/* Card Container */}
      <div className="mobile-card-container" ref={cardContainerRef}>
        <div 
          className={`mobile-flashcard ${swipeAnimation} ${cardEntryAnimation}`}
          onTouchStart={handleDirectTouchStart}
          onTouchMove={handleDirectTouchMove}
          onTouchEnd={handleDirectTouchEnd}
          onMouseDown={handleDirectTouchStart}
          onMouseMove={handleDirectTouchMove}
          onMouseUp={handleDirectTouchEnd}
          onMouseLeave={handleDirectTouchEnd}
          onClick={handleCardClick}
          style={cardStyle}
        >
          {/* Front of Card */}
          <div 
            className="mobile-card-front"
            style={dragState.isDragging ? { display: 'none' } : {}}
          >
            {parsedExampleContent ? (
              <div className="mobile-card-content">
                <div className="mobile-card-sentence">
                  {parsedExampleContent.clozeSentence}
                </div>
                {parsedExampleContent.nativeTranslation && (
                  <div 
                    className="mobile-card-translation"
                    dangerouslySetInnerHTML={{ 
                      __html: parsedExampleContent.nativeTranslation.replace(/~([^~]+)~/g, '<span class="mobile-highlighted-word">$1</span>') 
                    }}
                  />
                )}
                <div className="mobile-card-hint">
                  Tap to reveal answer
                </div>
              </div>
            ) : (
              <div className="mobile-card-content">
                <div className="mobile-card-word">
                  {baseWord}
                  {defNumber && <span className="mobile-definition-number">({defNumber})</span>}
                </div>
                <div className="mobile-card-pos">{currentCard.partOfSpeech || 'word'}</div>
                <div className="mobile-card-hint">
                  Tap to see definition
                </div>
              </div>
            )}
          </div>

          {/* Back of Card */}
          <div 
            className="mobile-card-back"
            style={dragState.isDragging ? { transform: 'rotateY(0deg)' } : {}}
          >
            <div className="mobile-card-content">
              {parsedExampleContent ? (
                <div className="mobile-card-answer">
                  <div className="mobile-example-label">
                    Example {parsedExampleContent.exampleNumber}:
                  </div>
                  <div 
                    className="mobile-example-sentence"
                    dangerouslySetInnerHTML={{ __html: parsedExampleContent.highlightedSentence }}
                  />
                  {currentCard.disambiguatedDefinition && (
                    <div className="mobile-card-definition">
                      {currentCard.disambiguatedDefinition.definition}
                    </div>
                  )}
                  <button 
                    className="mobile-audio-btn"
                    onClick={handlePlayAudio}
                    disabled={audioState.loading}
                  >
                    {audioState.loading ? '🔄' : '🔊'} Play Audio
                  </button>
                </div>
              ) : (
                <div className="mobile-card-answer">
                  <div className="mobile-card-word-large">
                    {baseWord}
                  </div>
                  {currentCard.disambiguatedDefinition && (
                    <div className="mobile-card-definition">
                      {currentCard.disambiguatedDefinition.definition}
                    </div>
                  )}
                  <button 
                    className="mobile-audio-btn"
                    onClick={handlePlayAudio}
                    disabled={audioState.loading}
                  >
                    {audioState.loading ? '🔄' : '🔊'} Play Audio
                  </button>
                </div>
              )}
            </div>
            
          </div>
        </div>
        
        {/* Quick Actions Overlay */}
        {showQuickActions && isFlipped && (
          <div className="mobile-quick-actions-overlay">
            <div className="mobile-quick-action-hint">
              <div className="mobile-quick-hint-text">Quick Actions:</div>
              <div className="mobile-quick-hint-item">↓ Swipe down for Easy</div>
              <div className="mobile-quick-hint-item">← → Swipe for answers</div>
            </div>
          </div>
        )}
        
        {/* Gesture Hints */}
        <div className="mobile-gesture-hints">
          {isFlipped && (
            <div className="mobile-gesture-hint mobile-gesture-down">
              <span>↓</span>
            </div>
          )}
        </div>
      </div>

      {/* Answer Buttons - Always visible */}
      <div className="mobile-answer-buttons">
        <button 
          className="mobile-answer-btn mobile-incorrect-btn"
          onClick={() => markCard('incorrect')}
          disabled={!isFlipped}
        >
          <div className="mobile-btn-emoji">❌</div>
          <div className="mobile-btn-label">Incorrect</div>
          <div className="mobile-btn-time">{buttonTimes.incorrect}</div>
        </button>
        
        <button 
          className="mobile-answer-btn mobile-correct-btn"
          onClick={() => markCard('correct')}
          disabled={!isFlipped}
        >
          <div className="mobile-btn-emoji">✓</div>
          <div className="mobile-btn-label">Correct</div>
          <div className="mobile-btn-time">{buttonTimes.correct}</div>
        </button>
        
        <button 
          className="mobile-answer-btn mobile-easy-btn"
          onClick={() => markCard('easy')}
          disabled={!isFlipped}
        >
          <div className="mobile-btn-emoji">⭐</div>
          <div className="mobile-btn-label">Easy</div>
          <div className="mobile-btn-time">{buttonTimes.easy}</div>
        </button>
      </div>

      {/* Answer Feedback Overlay */}
      {answerFeedback.show && (
        <div className={`mobile-answer-feedback mobile-answer-feedback-${answerFeedback.type}`}>
          {answerFeedback.text}
        </div>
      )}

      {/* Error Popup */}
      <ErrorPopup error={popupError} onClose={clearError} />
    </div>
  );
};

MobileFlashcardMode.propTypes = {
  selectedProfile: PropTypes.string.isRequired,
  wordDefinitions: PropTypes.object.isRequired,
  setWordDefinitions: PropTypes.func.isRequired,
  onBack: PropTypes.func.isRequired
};

export default MobileFlashcardMode;