import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { calculateNextReview, formatNextReviewTime } from '../../utils/srsAlgorithm';
import { useFlashcardSession } from '../../hooks/useFlashcardSession';
import { useFlashcardSRS } from '../../hooks/useFlashcardSRS';
import { useFlashcardCalendar } from '../../hooks/useFlashcardCalendar';
import { playFlashcardAudio } from '../../utils/flashcardAudio';
import FlashcardCalendarModal from '../../components/shared/FlashcardCalendarModal';
import ErrorPopup from '../../components/ErrorPopup';
import { useErrorHandler } from '../../hooks/useErrorHandler';

const MobileFlashcardMode = ({ 
  selectedProfile, 
  wordDefinitions, 
  setWordDefinitions, 
  onBack 
}) => {
  // Local UI state
  const [showCalendar, setShowCalendar] = useState(false);
  const [swipeAnimation, setSwipeAnimation] = useState('');
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [dragState, setDragState] = useState({ isDragging: false, deltaX: 0, deltaY: 0, opacity: 1 });
  const [cardEntryAnimation, setCardEntryAnimation] = useState('');
  const [answerFeedback, setAnswerFeedback] = useState({ show: false, type: '', text: '' });
  const [audioState, setAudioState] = useState({ loading: false, error: null });
  const [currentAudio, setCurrentAudio] = useState(null);
  const [hasAutoPlayedThisFlip, setHasAutoPlayedThisFlip] = useState(false);
  const { error: popupError, showError, clearError } = useErrorHandler();
  
  // Use shared session hook
  const sessionData = useFlashcardSession(selectedProfile, wordDefinitions);
  const {
    currentCard,
    isFlipped,
    setIsFlipped,
    dueCards,
    currentDueIndex,
    headerStats,
    sessionDuration,
    isSessionComplete,
    processedCards,
    calendarUpdateTrigger,
    completedSteps,
    totalSteps,
    progressPercentage
  } = sessionData;
  
  // Use shared SRS hook
  const { markCard: markCardBase } = useFlashcardSRS(
    sessionData,
    setWordDefinitions,
    selectedProfile,
    currentAudio,
    setCurrentAudio,
    setAudioState
  );
  
  // Use shared calendar hook
  const { calendarData } = useFlashcardCalendar(
    dueCards,
    wordDefinitions,
    sessionData.availableCards,
    selectedProfile,
    processedCards,
    calendarUpdateTrigger
  );
  
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
  
  // Audio caching for current session only (no database storage)
  const audioCache = useRef(new Map());

  // Calculate button times based on current card
  const buttonTimes = useMemo(() => {
    if (!currentCard) {
      return { 
        incorrect: { time: '1 min', debugDate: 'N/A' }, 
        correct: { time: '10 min', debugDate: 'N/A' }, 
        easy: { time: '4 days', debugDate: 'N/A' } 
      };
    }
    
    const incorrectResult = calculateNextReview(currentCard, 'incorrect');
    const correctResult = calculateNextReview(currentCard, 'correct');
    const easyResult = calculateNextReview(currentCard, 'easy');
    
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
        time: formatNextReviewTime(incorrectResult.nextReviewDate),
        debugDate: formatDebugDate(incorrectResult.nextReviewDate)
      },
      correct: {
        time: formatNextReviewTime(correctResult.nextReviewDate),
        debugDate: formatDebugDate(correctResult.nextReviewDate)
      },
      easy: {
        time: formatNextReviewTime(easyResult.nextReviewDate),
        debugDate: formatDebugDate(easyResult.nextReviewDate)
      }
    };
  }, [currentCard]);

  // Handle card flipping
  const flipCard = useCallback(() => {
    const now = Date.now();
    setIsFlipped(prev => !prev);
    lastTapTime.current = now;
  }, [setIsFlipped]);

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

  // Get sentence-specific cache key
  const getSentenceCacheKey = useCallback((card) => {
    if (!card) return null;
    const interval = card?.srsData?.SRS_interval || 1;
    const sentenceNumber = ((interval - 1) % 5) + 1; // 1-5 instead of 0-4
    return `${card.key}_sentence_${sentenceNumber}`;
  }, []);

  // Generate audio for specific sentence (no database caching)
  const generateAudioForSentence = useCallback(async (text, cacheKey) => {
    if (!text || !cacheKey) return null;
    
    // Check in-memory cache first
    const cachedAudio = audioCache.current.get(cacheKey);
    if (cachedAudio) {
      return cachedAudio;
    }
    
    try {
      // Always generate fresh audio - no database lookup
      const generateResponse = await fetch('https://polycast-server.onrender.com/api/generate-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: text.replace(/<[^>]*>/g, ''), // Strip HTML tags
          cardKey: cacheKey, // Use sentence-specific key but don't expect backend caching
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
      
      // Cache in memory for this session only
      audioCache.current.set(cacheKey, audioData.audioUrl);
      
      return audioData.audioUrl;
      
    } catch (error) {
      console.error('Audio generation error:', error);
      throw error;
    }
  }, [selectedProfile]);

  // Generate and play audio for current sentence (mobile specific implementation)
  const generateAndPlayAudio = useCallback(async (text, card) => {
    if (!text || !card) return;
    
    const cacheKey = getSentenceCacheKey(card);
    if (!cacheKey) return;
    
    setAudioState(prev => {
      if (prev.loading) return prev; // Already loading, skip
      return { loading: true, error: null };
    });
    
    try {
      const audioUrl = await generateAudioForSentence(text, cacheKey);
      
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
  }, [getSentenceCacheKey, generateAudioForSentence, showError]);

  // Pre-generate audio for upcoming cards in study session
  const preGenerateAudioForSession = useCallback(async (cards) => {
    if (!cards || cards.length === 0) return;
    
    // Pre-generate audio for next few cards
    
    // Generate audio for next 5 cards concurrently
    const audioPromises = cards.slice(0, 5).map(async (card) => {
      if (!card.exampleSentencesGenerated) return;
      
      const interval = card?.srsData?.SRS_interval || 1;
      const sentenceIndex = ((interval - 1) % 5) * 2;
      const parts = card.exampleSentencesGenerated.split('//').map(s => s.trim()).filter(s => s.length > 0);
      const englishSentence = parts[sentenceIndex] || parts[0] || '';
      
      if (englishSentence) {
        const cacheKey = getSentenceCacheKey(card);
        if (cacheKey) {
          try {
            await generateAudioForSentence(englishSentence, cacheKey);
            // Audio pre-generated successfully
          } catch (error) {
            // Skip failed pre-generation (will generate on-demand)
          }
        }
      }
    });
    
    await Promise.allSettled(audioPromises);
    // Pre-generation completed
  }, [getSentenceCacheKey, generateAudioForSentence]);

  // Play audio button handler
  const handlePlayAudio = useCallback(() => {
    if (!currentCard || !currentCard.exampleSentencesGenerated) return;
    
    const parts = currentCard.exampleSentencesGenerated.split('//').map(s => s.trim()).filter(s => s.length > 0);
    const srsInterval = currentCard?.srsData?.SRS_interval || 1;
    const sentenceIndex = ((srsInterval - 1) % 5) * 2;
    const englishSentence = parts[sentenceIndex] || parts[0] || '';
    
    if (englishSentence) {
      // Reset the auto-play flag so manual plays don't affect auto-play
      generateAndPlayAudio(englishSentence, currentCard);
    }
  }, [currentCard, generateAndPlayAudio]);

  // Reset auto-play flag when card changes OR when flipped to front
  useEffect(() => {
    if (!isFlipped) {
      setHasAutoPlayedThisFlip(false);
    }
  }, [currentDueIndex, isFlipped]);

  // Pre-generate audio when entering flashcard mode
  useEffect(() => {
    if (dueCards.length > 0) {
      preGenerateAudioForSession(dueCards);
    }
  }, [dueCards, preGenerateAudioForSession]);

  // Auto-play audio when card is flipped (only once per flip)
  useEffect(() => {
    if (isFlipped && currentCard && !hasAutoPlayedThisFlip) {
      if (currentCard.exampleSentencesGenerated) {
        setHasAutoPlayedThisFlip(true); // Mark as played immediately to prevent duplicates
        
        const parts = currentCard.exampleSentencesGenerated.split('//').map(s => s.trim()).filter(s => s.length > 0);
        const srsInterval = currentCard?.srsData?.SRS_interval || 1;
        const sentenceIndex = ((srsInterval - 1) % 5) * 2;
        const englishSentence = parts[sentenceIndex] || parts[0] || '';
        
        if (englishSentence) {
          // Small delay to let the flip animation finish
          setTimeout(() => {
            generateAndPlayAudio(englishSentence, currentCard);
          }, 300);
        }
      }
    }
  }, [isFlipped, currentCard, hasAutoPlayedThisFlip, generateAndPlayAudio]);

  // Clear audio cache when component unmounts or profile changes
  useEffect(() => {
    return () => {
      audioCache.current.clear();
    };
  }, [selectedProfile]);

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

  // Wrap markCard with mobile-specific visual feedback
  const markCard = useCallback((answer) => {
    if (!currentCard) return;
    
    // Show visual feedback first
    showAnswerFeedback(answer, currentCard);
    
    // Add mobile-specific animations
    // Trigger entry animation for next card after marking
    const originalMarkCard = () => markCardBase(answer);
    
    // Add animation handling
    setTimeout(() => {
      originalMarkCard();
      // Trigger entry animation for next card if there is one  
      if (dueCards.length > 1 || (dueCards.length === 1 && answer !== 'easy')) {
        setTimeout(() => {
          setCardEntryAnimation('card-enter');
          setTimeout(() => setCardEntryAnimation(''), 400);
        }, 300);
      }
    }, 100);
  }, [currentCard, markCardBase, showAnswerFeedback, dueCards.length]);

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
    if (!currentCard || !isFlipped) return;
    markCard('easy');
  }, [currentCard, isFlipped, markCard]);

  // Removed gestureCallbacks - using direct touch handlers instead

  // Initialize gesture handler (disabled - using direct touch handlers)
  useEffect(() => {
    // Gesture handler disabled in favor of direct touch handlers
    return () => {};
  }, []);

  // Show completion screen
  if (isSessionComplete) {
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
              <div className="mobile-summary-number">{sessionData.stats.cardsReviewed}</div>
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

  if (!currentCard) return null;

  const baseWord = currentCard.word || currentCard.wordSenseId?.replace(/\d+$/, '');
  const defNumber = currentCard.definitionNumber || currentCard.wordSenseId?.match(/\d+$/)?.[0] || '';
  const interval = currentCard?.srsData?.SRS_interval || 1;

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
            {(() => {
              if (!currentCard.exampleSentencesGenerated) {
                throw new Error(`Card "${currentCard.word || 'unknown'}" is missing exampleSentencesGenerated field. All flashcards must have proper ~word~ markup data.`);
              }
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
            })()}
          </div>

          {/* Back of Card */}
          <div 
            className="mobile-card-back"
            style={dragState.isDragging ? { transform: 'rotateY(0deg)' } : {}}
          >
            <div className="mobile-card-content">
              {(() => {
                if (!currentCard.exampleSentencesGenerated) {
                  throw new Error(`Card "${currentCard.word || 'unknown'}" is missing exampleSentencesGenerated field. All flashcards must have proper ~word~ markup data.`);
                }
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
              })()}
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
      <FlashcardCalendarModal 
        calendarData={calendarData}
        showCalendar={showCalendar}
        setShowCalendar={setShowCalendar}
        processedCards={processedCards}
        dueCards={dueCards}
        calendarUpdateTrigger={calendarUpdateTrigger}
      />

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