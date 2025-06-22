import React, { useState, useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import { calculateNextReview, getDueCards, getReviewStats, formatNextReviewTime } from '../../utils/srsAlgorithm';
import { getSRSSettings } from '../../utils/srsSettings';
import { getHardcodedCards } from '../../utils/hardcodedCards';
import { TouchGestureHandler } from '../utils/touchGestures';
import ErrorPopup from '../../components/ErrorPopup';
import { useErrorHandler } from '../../hooks/useErrorHandler';

const MobileFlashcardMode = ({ 
  selectedProfile, 
  wordDefinitions, 
  setWordDefinitions, 
  onBack 
}) => {
  const [currentDueIndex, setCurrentDueIndex] = useState(0);
  const [dueCards, setDueCards] = useState([]);
  const [todaysNewCards, setTodaysNewCards] = useState(0);
  const [sessionCounts, setSessionCounts] = useState({ newCount: 0, learningCount: 0, reviewCount: 0 });
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
  const [showCalendar, setShowCalendar] = useState(false);
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

  // Use shared hardcoded cards for non-saving mode

  // Process the wordDefinitions to extract all word senses and initialize SRS data
  const availableCards = React.useMemo(() => {
    // For non-saving mode, use hardcoded cards
    if (selectedProfile === 'non-saving') {
      const hardcodedCards = getHardcodedCards();
      return hardcodedCards;
    }

    // For other profiles, process actual wordDefinitions
    const cards = [];
    Object.entries(wordDefinitions).forEach(([key, value]) => {
      if (value && value.wordSenseId && value.inFlashcards) {
        // Initialize SRS data if it doesn't exist
        const cardWithSRS = { ...value, key };
        
        // Ensure frequency field exists (use wordFrequency if available)
        if (!cardWithSRS.frequency && cardWithSRS.wordFrequency) {
          cardWithSRS.frequency = cardWithSRS.wordFrequency;
        }
        
        if (!cardWithSRS.srsData) {
          cardWithSRS.srsData = {
            isNew: true,
            gotWrongThisSession: false,
            SRS_interval: 1,
            status: 'new',
            correctCount: 0,
            incorrectCount: 0,
            dueDate: null,
            lastSeen: null,
            lastReviewDate: null,
            nextReviewDate: nowDateRef.current // Due now
          };
        } else {
          // Migrate old SRS data format to new format
          const srs = cardWithSRS.srsData;
          if (srs.interval !== undefined && srs.SRS_interval === undefined) {
            // Old format detected, migrate to new format
            srs.SRS_interval = srs.interval === 0 ? 1 : Math.min(srs.interval, 9);
            srs.isNew = srs.status === 'new';
            srs.gotWrongThisSession = false;
            srs.correctCount = srs.repetitions || 0;
            srs.incorrectCount = srs.lapses || 0;
            srs.dueDate = srs.dueDate || srs.nextReviewDate;
            srs.lastSeen = srs.lastReviewDate;
          }
        }
        cards.push(cardWithSRS);
      }
    });
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
      return;
    }
    
    const currentSettings = getSRSSettings();
    const maxNewToday = Math.max(0, currentSettings.newCardsPerDay - todaysNewCards);
    
    let due = getDueCards(availableCards, { newPerDay: maxNewToday }, false);
    
    if (due.length === 0) {
      due = getDueCards(availableCards, { newPerDay: maxNewToday }, true);
    }
    
    // Log card order with frequency values
    console.log('[CARD ORDER] Due cards:', due.map(card => ({
      word: card.word,
      frequency: card.frequency || 5, // 1-10 scale, 10 = most common
      isNew: card.srsData?.isNew,
      dueDate: card.srsData?.dueDate || card.srsData?.nextReviewDate
    })));
    
    setDueCards(due);
    setCurrentDueIndex(0);
    setCompletedSteps(0); // Reset progress when cards change
    
    // Initialize session counts based on our simple SRS system
    const newCards = due.filter(card => card.srsData?.isNew).length;
    const learningCards = due.filter(card => 
      card.srsData?.gotWrongThisSession && !card.srsData?.isNew
    ).length;
    const reviewCards = due.filter(card => 
      !card.srsData?.isNew && !card.srsData?.gotWrongThisSession
    ).length;
    
    setSessionCounts({
      newCount: newCards,
      learningCount: learningCards,
      reviewCount: reviewCards
    });
  }, [availableCards, todaysNewCards]);

  // Get SRS statistics
  const srsStats = React.useMemo(() => getReviewStats(availableCards), [availableCards]);

  // Calculate accuracy inline for headerStats
  const headerStats = React.useMemo(() => {
    const accuracy = stats.cardsReviewed > 0 ? Math.round((stats.correctAnswers / stats.cardsReviewed) * 100) : 0;
    return {
      accuracy,
      cardsReviewed: stats.cardsReviewed,
      newCards: sessionCounts.newCount,
      learningCards: sessionCounts.learningCount,
      reviewCards: sessionCounts.reviewCount
    };
  }, [stats.cardsReviewed, stats.correctAnswers, sessionCounts.newCount, sessionCounts.learningCount, sessionCounts.reviewCount]);

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
      return { 
        incorrect: { time: '1 min', debugDate: 'N/A' }, 
        correct: { time: '10 min', debugDate: 'N/A' }, 
        easy: { time: '4 days', debugDate: 'N/A' } 
      };
    }
    
    const currentCard = dueCards[currentDueIndex];
    const incorrectResult = calculateNextReview(currentCard, 'incorrect');
    const correctResult = calculateNextReview(currentCard, 'correct');
    const easyResult = calculateNextReview(currentCard, 'easy');
    
    // Log SRS states for debugging
    console.log(`[SRS] Card "${currentCard.word}" (${currentCard.srsData.status}):`, {
      current: {
        status: currentCard.srsData.status,
        isNew: currentCard.srsData.isNew,
        gotWrongThisSession: currentCard.srsData.gotWrongThisSession,
        SRS_interval: currentCard.srsData.SRS_interval,
        frequency: currentCard.frequency
      },
      ifIncorrect: {
        status: incorrectResult.status,
        gotWrongThisSession: incorrectResult.gotWrongThisSession,
        SRS_interval: incorrectResult.SRS_interval,
        nextReview: formatNextReviewTime(incorrectResult.dueDate || incorrectResult.nextReviewDate)
      },
      ifCorrect: {
        status: correctResult.status,
        gotWrongThisSession: correctResult.gotWrongThisSession,
        SRS_interval: correctResult.SRS_interval,
        nextReview: formatNextReviewTime(correctResult.dueDate || correctResult.nextReviewDate)
      },
      ifEasy: {
        status: easyResult.status,
        gotWrongThisSession: easyResult.gotWrongThisSession,
        SRS_interval: easyResult.SRS_interval,
        nextReview: formatNextReviewTime(easyResult.dueDate || easyResult.nextReviewDate)
      }
    });
    
    // Helper function to format date for debugging
    const formatDebugDate = (dateString) => {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        hour: date.getHours() === 0 && date.getMinutes() === 0 ? undefined : 'numeric',
        minute: date.getHours() === 0 && date.getMinutes() === 0 ? undefined : '2-digit'
      });
    };

    return {
      incorrect: {
        time: formatNextReviewTime(incorrectResult.dueDate || incorrectResult.nextReviewDate),
        debugDate: formatDebugDate(incorrectResult.dueDate || incorrectResult.nextReviewDate)
      },
      correct: {
        time: formatNextReviewTime(correctResult.dueDate || correctResult.nextReviewDate),
        debugDate: formatDebugDate(correctResult.dueDate || correctResult.nextReviewDate)
      },
      easy: {
        time: formatNextReviewTime(easyResult.dueDate || easyResult.nextReviewDate),
        debugDate: formatDebugDate(easyResult.dueDate || easyResult.nextReviewDate)
      }
    };
  }, [dueCards, currentDueIndex]);

  // Handle card flipping
  const flipCard = useCallback(() => {
    const now = Date.now();
    setIsFlipped(prev => !prev);
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
    } else {
      // Back side - handle drag for swiping
      dragStartPos.current = { x: clientX, y: clientY };
      lastTouchPos.current = { x: clientX, y: clientY };
      lastTouchTime.current = now;
      isDragging.current = false; // Will become true in touchmove/mousemove
    }
  }, [isFlipped]);

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
      const colorIntensity = Math.min(1, Math.abs(deltaX) / 200); // Adjusted for new threshold
      
      setDragState({
        isDragging: true,
        deltaX,
        deltaY: 0,
        rotation,
        opacity,
        colorIntensity
      });
      
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
          // Don't show error for AbortError (interrupted by pause) - this is expected when swiping
          if (err.name !== 'AbortError' && !err.message.includes('interrupted')) {
            showError(`Failed to play audio: ${err.message}`);
          }
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
    const srsInterval = currentCard?.srsData?.SRS_interval || 1;
    const sentenceIndex = ((srsInterval - 1) % 5) * 2;
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
        const srsInterval = currentCard?.srsData?.SRS_interval || 1;
        const sentenceIndex = ((srsInterval - 1) % 5) * 2;
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
    
    // Stop any currently playing audio when swiping away a card
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setCurrentAudio(null);
      setAudioState({ loading: false, error: null });
    }
    
    // Log user's response
    console.log(`[USER RESPONSE] User clicked "${answer}" for card "${currentCard.word}"`);
    
    // Set processing flag to prevent useEffect from running
    processingCardRef.current = true;
    
    // Mark when we processed this card
    setLastCardProcessedTime(Date.now());
    
    // Show visual feedback
    showAnswerFeedback(answer, currentCard);
    
    // Calculate next review using SRS algorithm
    const updatedSrsData = calculateNextReview(currentCard, answer);
    
    // Log the result of the SRS calculation
    console.log(`[SRS RESULT] Card "${currentCard.word}" updated:`, {
      from: {
        status: currentCard.srsData.status,
        isNew: currentCard.srsData.isNew,
        gotWrongThisSession: currentCard.srsData.gotWrongThisSession,
        SRS_interval: currentCard.srsData.SRS_interval
      },
      to: {
        status: updatedSrsData.status,
        isNew: updatedSrsData.isNew,
        gotWrongThisSession: updatedSrsData.gotWrongThisSession,
        SRS_interval: updatedSrsData.SRS_interval,
        nextReview: formatNextReviewTime(updatedSrsData.nextReviewDate)
      }
    });
    
    // Update session counts based on card transitions
    setSessionCounts(prevCounts => {
      const newCounts = { ...prevCounts };
      
      // Current card state
      const wasNew = currentCard.srsData.isNew;
      const wasLearning = currentCard.srsData.gotWrongThisSession && !wasNew;
      const wasReview = !wasNew && !currentCard.srsData.gotWrongThisSession;
      
      // New card state after answer
      const isNowNew = updatedSrsData.isNew; // Should always be false after answering
      const isNowLearning = updatedSrsData.gotWrongThisSession && !isNowNew;
      const isNowReview = !isNowNew && !updatedSrsData.gotWrongThisSession;
      
      // Decrement the old category
      if (wasNew) newCounts.newCount = Math.max(0, newCounts.newCount - 1);
      else if (wasLearning) newCounts.learningCount = Math.max(0, newCounts.learningCount - 1);
      else if (wasReview) newCounts.reviewCount = Math.max(0, newCounts.reviewCount - 1);
      
      // Only increment if the card is still due today (not graduated to tomorrow or later)
      const now = new Date();
      const updatedDueDate = new Date(updatedSrsData.nextReviewDate);
      const stillDueToday = (updatedDueDate - now) < (24 * 60 * 60 * 1000);
      
      if (stillDueToday) {
        // Increment the new category
        if (isNowNew) newCounts.newCount += 1; // This should never happen
        else if (isNowLearning) newCounts.learningCount += 1;
        else if (isNowReview) newCounts.reviewCount += 1;
      }
      
      return newCounts;
    });
    
    // Update the card in wordDefinitions with new SRS data
    const updatedCard = {
      ...currentCard,
      srsData: updatedSrsData
    };
    
    // Prepare all state updates to happen together
    const now = new Date();
    const updatedDueDate = new Date(updatedSrsData.dueDate || updatedSrsData.nextReviewDate);
    
    // Check if card is still due today (within next few hours, not full 24 hours)
    // Cards with intervals like "1 day", "3 days" should be removed from today's session
    const todayMidnight = new Date(now);
    todayMidnight.setHours(23, 59, 59, 999); // End of today
    const stillDueToday = updatedDueDate <= todayMidnight;
    
    // Debug logging to see what's happening
    console.log(`[SESSION DEBUG] Card "${currentCard.word}" - Due: ${updatedDueDate.toLocaleString()}, Today ends: ${todayMidnight.toLocaleString()}, Still due today: ${stillDueToday}, SRS_interval: ${updatedSrsData.SRS_interval}`);
    
    // Calculate new due cards array
    let newDueCards;
    let newDueIndex;
    
    if (stillDueToday && (updatedSrsData.SRS_interval <= 2)) {
      // Only keep in queue if due today AND still in minute-based intervals (1-2)
      // Move card to end of queue for re-review later today
      console.log(`[SESSION DEBUG] Keeping card "${currentCard.word}" in today's session`);
      newDueCards = [...dueCards];
      newDueCards.splice(currentDueIndex, 1);
      newDueCards.push(updatedCard);
      newDueIndex = currentDueIndex >= newDueCards.length ? 0 : currentDueIndex;
    } else {
      // Remove card from today's queue (graduated to tomorrow or later)
      console.log(`[SESSION DEBUG] Removing card "${currentCard.word}" from today's session`);
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
      // Don't auto-refresh if card graduated to day+ intervals - user should be done for today
      const cardGraduated = updatedSrsData.SRS_interval >= 3;
      if (newDueCards.length === 0 && !cardGraduated) {
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
          
          console.log(`[SESSION DEBUG] Auto-refreshing queue: found ${refreshedDueCards.length} cards`);
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
  }, [dueCards, currentDueIndex, setWordDefinitions, todaysNewCards, selectedProfile, srsSettings, showAnswerFeedback, currentAudio]);

  // Direct touch end handler (works for both touch and mouse)
  const handleDirectTouchEnd = useCallback((e) => {
    if (!isFlipped && touchStartPos.current) {
      // Front side - handle tap for flipping
      const now = Date.now();
      const touchDuration = now - touchStartTime.current;
      
      if (touchDuration < 500) { // Increased timeout for mouse clicks
        if (now - lastTapTime.current >= 100) {
          e.preventDefault();
          e.stopPropagation();
          flipCard();
        }
      }
      
      touchStartPos.current = null;
    } else if (isFlipped && dragStartPos.current) {
      // Back side - handle swipe completion
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
        
        if (shouldTriggerSwipe) {
          // Determine answer: negative deltaX = left swipe = incorrect, positive deltaX = right swipe = correct
          if (dragState.deltaX < 0) {
            markCard('incorrect');
          } else {
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
          setDragState({ isDragging: false, deltaX: 0, deltaY: 0, opacity: 1 });
        }
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

  // Calculate future due dates for calendar
  const getCalendarData = () => {
    const today = new Date();
    const nextWeekDays = [];
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      date.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      // Find cards due on this day
      const cardsForDay = availableCards.filter(card => {
        if (!card.srsData) return false;
        
        const dueDate = new Date(card.srsData.dueDate || card.srsData.nextReviewDate);
        return dueDate >= date && dueDate <= endOfDay;
      });
      
      nextWeekDays.push({
        date,
        cards: cardsForDay,
        dayName: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : date.toLocaleDateString('en-US', { weekday: 'short' }),
        dateStr: date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })
      });
    }
    
    return nextWeekDays;
  };

  // Calendar Modal Component
  const CalendarModal = () => {
    const calendarData = getCalendarData();
    
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.8)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          maxWidth: '95vw',
          maxHeight: '80vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{
            padding: '15px 20px',
            borderBottom: '1px solid #eee',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#f8f9fa'
          }}>
            <h3 style={{ margin: 0, fontSize: '18px', color: '#333' }}>📅 Next 7 Days</h3>
            <button 
              onClick={() => setShowCalendar(false)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: '#666'
              }}
            >
              ×
            </button>
          </div>
          <div style={{
            overflow: 'auto',
            padding: '10px'
          }}>
            {calendarData.map((day, index) => (
              <div key={index} style={{
                padding: '12px 15px',
                margin: '5px 0',
                backgroundColor: day.cards.length > 0 ? '#f0f9ff' : '#f8f9fa',
                borderRadius: '8px',
                borderLeft: `4px solid ${day.cards.length > 0 ? '#2196f3' : '#e5e7eb'}`
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: day.cards.length > 0 ? '8px' : '0'
                }}>
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '16px', color: '#333' }}>
                      {day.dayName}
                    </div>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      {day.dateStr}
                    </div>
                  </div>
                  <div style={{
                    backgroundColor: day.cards.length > 0 ? '#2196f3' : '#9ca3af',
                    color: 'white',
                    borderRadius: '12px',
                    padding: '4px 8px',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}>
                    {day.cards.length} cards
                  </div>
                </div>
                {day.cards.length > 0 && (
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    {day.cards.slice(0, 3).map(card => card.word).join(', ')}
                    {day.cards.length > 3 && ` +${day.cards.length - 3} more`}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

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

  return (
    <div className="mobile-flashcard-mode">
      {/* Header */}
      <div className="mobile-flashcard-header">
        <button className="mobile-back-btn" onClick={onBack}>
          ← Back
        </button>
        <button 
          className="mobile-calendar-btn" 
          onClick={() => setShowCalendar(true)}
          style={{
            background: 'none',
            border: '1px solid #2196f3',
            borderRadius: '6px',
            padding: '4px 8px',
            fontSize: '14px',
            color: '#2196f3',
            cursor: 'pointer'
          }}
        >
          📅
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
          style={{
            transform: dragState.isDragging 
              ? `translateX(${dragState.deltaX}px) rotateZ(${dragState.rotation || 0}deg)`
              : (isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'),
            opacity: dragState.opacity,
            transition: dragState.isDragging ? 'none' : 'transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.2s ease',
            // Add proportional color feedback: deltaX < 0 (left) = red (incorrect), deltaX > 0 (right) = green (correct)
            boxShadow: dragState.colorIntensity > 0 
              ? dragState.deltaX < 0 
                ? `0 0 ${30 * dragState.colorIntensity}px rgba(239, 68, 68, ${dragState.colorIntensity}), 0 0 ${60 * dragState.colorIntensity}px rgba(239, 68, 68, ${dragState.colorIntensity * 0.5})` // Left = red (incorrect)
                : `0 0 ${30 * dragState.colorIntensity}px rgba(34, 197, 94, ${dragState.colorIntensity}), 0 0 ${60 * dragState.colorIntensity}px rgba(34, 197, 94, ${dragState.colorIntensity * 0.5})`  // Right = green (correct)
              : undefined,
            // Add proportional background color overlay
            backgroundColor: dragState.colorIntensity > 0 
              ? dragState.deltaX < 0 
                ? `rgba(239, 68, 68, ${dragState.colorIntensity * 0.1})` // Left = red background (incorrect)
                : `rgba(34, 197, 94, ${dragState.colorIntensity * 0.1})`  // Right = green background (correct)
              : undefined
          }}
        >
          {/* Front of Card */}
          <div 
            className="mobile-card-front"
            style={dragState.isDragging ? { display: 'none' } : {}}
          >
            {currentCard.exampleSentencesGenerated ? (
              (() => {
                const parts = currentCard.exampleSentencesGenerated.split('//').map(s => s.trim()).filter(s => s.length > 0);
                const sentenceIndex = ((interval - 1) % 5) * 2;
                const englishSentence = parts[sentenceIndex] || parts[0] || 'No example available';
                const nativeTranslation = parts[sentenceIndex + 1] || parts[1] || '';
                const clozeSentence = englishSentence.replace(/~[^~]+~/g, '_____');
                
                return (
                  <div className="mobile-card-content">
                    <div className="mobile-card-sentence">
                      {clozeSentence}
                    </div>
                    {nativeTranslation && (
                      <div 
                        className="mobile-card-translation"
                        dangerouslySetInnerHTML={{ 
                          __html: nativeTranslation.replace(/~([^~]+)~/g, '<span class="mobile-highlighted-word">$1</span>') 
                        }}
                      />
                    )}
                    <div className="mobile-card-hint">
                      Tap to reveal answer
                    </div>
                  </div>
                );
              })()
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
              {currentCard.exampleSentencesGenerated ? (
                (() => {
                  const parts = currentCard.exampleSentencesGenerated.split('//').map(s => s.trim()).filter(s => s.length > 0);
                  const sentenceIndex = ((interval - 1) % 5) * 2;
                  const englishSentence = parts[sentenceIndex] || parts[0] || 'No example available';
                  const highlightedSentence = englishSentence.replace(/~([^~]+)~/g, (match, word) => {
                    return `<span class="mobile-highlighted-word">${word}</span>`;
                  });
                  const exampleNumber = ((interval - 1) % 5) + 1;
                  
                  return (
                    <div className="mobile-card-answer">
                      <div className="mobile-example-label">
                        Example {exampleNumber}:
                      </div>
                      <div 
                        className="mobile-example-sentence"
                        dangerouslySetInnerHTML={{ __html: highlightedSentence }}
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
                  );
                })()
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
          <div className="mobile-btn-time">
            {buttonTimes.incorrect.time}
            <div style={{fontSize: '0.7rem', fontStyle: 'italic', opacity: 0.7, marginTop: '2px'}}>
              {buttonTimes.incorrect.debugDate}
            </div>
          </div>
        </button>
        
        <button 
          className="mobile-answer-btn mobile-correct-btn"
          onClick={() => markCard('correct')}
          disabled={!isFlipped}
        >
          <div className="mobile-btn-emoji">✓</div>
          <div className="mobile-btn-label">Correct</div>
          <div className="mobile-btn-time">
            {buttonTimes.correct.time}
            <div style={{fontSize: '0.7rem', fontStyle: 'italic', opacity: 0.7, marginTop: '2px'}}>
              {buttonTimes.correct.debugDate}
            </div>
          </div>
        </button>
        
        <button 
          className="mobile-answer-btn mobile-easy-btn"
          onClick={() => markCard('easy')}
          disabled={!isFlipped}
        >
          <div className="mobile-btn-emoji">⭐</div>
          <div className="mobile-btn-label">Easy</div>
          <div className="mobile-btn-time">
            {buttonTimes.easy.time}
            <div style={{fontSize: '0.7rem', fontStyle: 'italic', opacity: 0.7, marginTop: '2px'}}>
              {buttonTimes.easy.debugDate}
            </div>
          </div>
        </button>
      </div>

      {/* Answer Feedback Overlay */}
      {answerFeedback.show && (
        <div className={`mobile-answer-feedback mobile-answer-feedback-${answerFeedback.type}`}>
          {answerFeedback.text}
        </div>
      )}

      {/* Calendar Modal */}
      {showCalendar && <CalendarModal />}

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