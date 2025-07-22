import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import './FlashcardMode.css';
import MobileProfileSelector from '../mobile/components/MobileProfileSelector.jsx';
import { shouldUseMobileApp } from '../utils/deviceDetection.js';
import { useErrorHandler } from '../hooks/useErrorHandler';
import ErrorPopup from './ErrorPopup';
import { calculateNextReview, formatNextReviewTime } from '../utils/srsAlgorithm';
import { useFlashcardSession } from '../hooks/useFlashcardSession';
import { useFlashcardSRS } from '../hooks/useFlashcardSRS';
import { useFlashcardCalendar } from '../hooks/useFlashcardCalendar';
import FlashcardCalendarModal from './shared/FlashcardCalendarModal';
import { getTranslationsForProfile } from '../utils/profileLanguageMapping';
import '../mobile/styles/mobile-flashcards.css';

const FlashcardMode = ({ selectedWords, wordDefinitions, setWordDefinitions, englishSegments, targetLanguages, selectedProfile }) => {
  // Get translations for this profile's language
  const t = getTranslationsForProfile(selectedProfile);
  
  // State for UI mode - desktop starts in flashcards, mobile starts in profile selection
  const [currentMode, setCurrentMode] = useState(() => {
    return shouldUseMobileApp() ? 'profile' : 'flashcards';
  });
  const [showCalendar, setShowCalendar] = useState(false);
  const [dragState, setDragState] = useState({ isDragging: false, deltaX: 0, deltaY: 0, opacity: 1 });
  const [cardEntryAnimation, setCardEntryAnimation] = useState('');
  const [answerFeedback, setAnswerFeedback] = useState({ show: false, type: '', text: '' });
  const [audioState, setAudioState] = useState({ loading: false, error: null });
  const [currentAudio, setCurrentAudio] = useState(null);
  const [hasAutoPlayedThisFlip, setHasAutoPlayedThisFlip] = useState(false);
  const { error: popupError, showError, clearError } = useErrorHandler();
  const isActuallyMobile = shouldUseMobileApp();

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
  const isDragging = useRef(false);
  const dragStartPos = useRef(null);
  const lastTouchPos = useRef(null);
  const lastTouchTime = useRef(0);
  const touchStartPos = useRef(null);
  const touchStartTime = useRef(0);
  const lastTapTime = useRef(0);
  
  // Audio caching for current session only (no database storage)
  const audioCache = useRef(new Map());

  // Handle starting study session (only used on mobile)
  const handleStartStudying = useCallback((profile, flashcards) => {
    console.log(`[FLASHCARD] Starting study session for ${profile} with ${Object.keys(flashcards).length} flashcards`);
    setCurrentMode('flashcards');
  }, []);

  // Handle returning to profile selection
  const handleBackToProfile = useCallback(() => {
    setCurrentMode('profile');
  }, []);

  // Handle going back to main app (only for desktop)
  const handleBackToMain = useCallback(() => {
    if (window.location) {
      window.location.reload();
    }
  }, []);

  // Calculate button times for SRS preview
  const buttonTimes = useMemo(() => {
    if (!currentCard) {
      return { 
        incorrect: { time: '1 min' }, 
        correct: { time: '10 min' }, 
        easy: { time: '4 days' } 
      };
    }
    
    const incorrectResult = calculateNextReview(currentCard, 'incorrect');
    const correctResult = calculateNextReview(currentCard, 'correct');
    const easyResult = calculateNextReview(currentCard, 'easy');
    
    return {
      incorrect: { time: formatNextReviewTime(incorrectResult.nextReviewDate) },
      correct: { time: formatNextReviewTime(correctResult.nextReviewDate) },
      easy: { time: formatNextReviewTime(easyResult.nextReviewDate) }
    };
  }, [currentCard]);

  // Handle card flipping
  const flipCard = useCallback(() => {
    setIsFlipped(prev => !prev);
    lastTapTime.current = Date.now();
  }, [setIsFlipped]);

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

  // Generate and play audio for current sentence
  const generateAndPlayAudio = useCallback(async (text, card) => {
    if (!text || !card) return;
    
    const cacheKey = getSentenceCacheKey(card);
    if (!cacheKey) return;
    
    setAudioState(prev => {
      if (prev.loading) return prev;
      return { loading: true, error: null };
    });
    
    try {
      const audioUrl = await generateAudioForSentence(text, cacheKey);
      
      setCurrentAudio(prevAudio => {
        if (prevAudio) {
          prevAudio.pause();
          prevAudio.currentTime = 0;
        }
        
        const audio = new Audio(audioUrl);
        audio.onended = () => setAudioState({ loading: false, error: null });
        audio.onerror = () => {
          setAudioState({ loading: false, error: null });
          showError('Failed to play audio');
        };
        
        audio.play().then(() => {
          setAudioState({ loading: false, error: null });
        }).catch(err => {
          console.error('Audio play error:', err);
          setAudioState({ loading: false, error: null });
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
    if (!currentCard) return;
    
    let textToPlay = '';
    
    if (currentCard.exampleSentencesGenerated) {
      // Use generated examples if available
      const parts = currentCard.exampleSentencesGenerated.split('//').map(s => s.trim()).filter(s => s.length > 0);
      const srsInterval = currentCard?.srsData?.SRS_interval || 1;
      const sentenceIndex = ((srsInterval - 1) % 5) * 2;
      textToPlay = parts[sentenceIndex] || parts[0] || '';
    } else if (currentCard.contextSentence) {
      // Fallback to context sentence
      textToPlay = currentCard.contextSentence;
    } else if (currentCard.example) {
      // Fallback to example
      textToPlay = currentCard.example;
    } else {
      // Last resort: just the word
      textToPlay = currentCard.word;
    }
    
    if (textToPlay) {
      generateAndPlayAudio(textToPlay, currentCard);
    }
  }, [currentCard, generateAndPlayAudio]);

  // Show answer feedback
  const showAnswerFeedback = useCallback((answer, currentCard) => {
    if (!currentCard) return;
    
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
      }, 1000);
    }
  }, []);

  // Wrap markCard with visual feedback
  const markCard = useCallback((answer) => {
    if (!currentCard) return;
    
    showAnswerFeedback(answer, currentCard);
    
    setTimeout(() => {
      markCardBase(answer);
      if (dueCards.length > 1 || (dueCards.length === 1 && answer !== 'easy')) {
        setTimeout(() => {
          setCardEntryAnimation('card-enter');
          setTimeout(() => setCardEntryAnimation(''), 400);
        }, 300);
      }
    }, 100);
  }, [currentCard, markCardBase, showAnswerFeedback, dueCards.length]);

  // Handle card click for flipping
  const handleCardClick = useCallback((e) => {
    if (!isFlipped && !isDragging.current) {
      e.preventDefault();
      e.stopPropagation();
      flipCard();
    }
  }, [isFlipped, flipCard]);

  // Auto-play audio when card is flipped
  useEffect(() => {
    if (!isFlipped) {
      setHasAutoPlayedThisFlip(false);
    }
  }, [currentDueIndex, isFlipped]);

  // Pre-generate audio when study session starts
  useEffect(() => {
    if (currentMode === 'flashcards' && dueCards.length > 0) {
      preGenerateAudioForSession(dueCards);
    }
  }, [currentMode, dueCards, preGenerateAudioForSession]);

  // Auto-play audio when card is flipped (with correct sentence)
  useEffect(() => {
    if (isFlipped && currentCard && !hasAutoPlayedThisFlip) {
      setHasAutoPlayedThisFlip(true);
      
      let textToPlay = '';
      
      if (currentCard.exampleSentencesGenerated) {
        // Use generated examples if available
        const parts = currentCard.exampleSentencesGenerated.split('//').map(s => s.trim()).filter(s => s.length > 0);
        const srsInterval = currentCard?.srsData?.SRS_interval || 1;
        const sentenceIndex = ((srsInterval - 1) % 5) * 2;
        textToPlay = parts[sentenceIndex] || parts[0] || '';
      } else if (currentCard.contextSentence) {
        // Fallback to context sentence
        textToPlay = currentCard.contextSentence;
      } else if (currentCard.example) {
        // Fallback to example
        textToPlay = currentCard.example;
      } else {
        // Last resort: just the word
        textToPlay = currentCard.word;
      }
      
      if (textToPlay) {
        setTimeout(() => {
          generateAndPlayAudio(textToPlay, currentCard);
        }, 300);
      }
    }
  }, [isFlipped, currentCard, hasAutoPlayedThisFlip, generateAndPlayAudio]);

  // Clear audio cache when switching profiles or modes
  useEffect(() => {
    return () => {
      audioCache.current.clear();
    };
  }, [selectedProfile, currentMode]);

  // Show completion screen
  if (currentMode === 'flashcards' && isSessionComplete) {
    return (
      <div className="flashcard-completion">
        <div className="completion-content">
          <div className="completion-icon">🎉</div>
          <h2>{t.sessionComplete}</h2>
          <p>You've completed all cards for today.</p>
          
          <div className="session-summary">
            <div className="summary-stat">
              <div className="summary-number">{sessionData.stats.cardsReviewed}</div>
              <div className="summary-label">{t.cardsReviewed}</div>
            </div>
            <div className="summary-stat">
              <div className="summary-number">{headerStats.accuracy}%</div>
              <div className="summary-label">{t.accuracy}</div>
            </div>
            <div className="summary-stat">
              <div className="summary-number">{sessionDuration}</div>
              <div className="summary-label">{t.minutes}</div>
            </div>
          </div>
          
          <button className="completion-back-button" onClick={handleBackToProfile}>
            {t.returnToProfiles}
          </button>
        </div>
      </div>
    );
  }

  // Profile selection mode (only for actual mobile devices)
  if (currentMode === 'profile') {
    return (
      <div className="flashcard-profile-wrapper">
        <MobileProfileSelector 
          selectedProfile={selectedProfile}
          onStartStudying={handleStartStudying}
          onBack={!isActuallyMobile ? handleBackToMain : null}
        />
        <ErrorPopup error={popupError} onClose={clearError} />
      </div>
    );
  }

  // Flashcard study mode - show message if no cards available
  if (!currentCard) {
    return (
      <div className="flashcard-study-container">
        <div className="desktop-card-container">
          <div className="no-flashcards-message">
            <div className="no-flashcards-icon">📚</div>
            <h2>{t.noFlashcardsTitle}</h2>
            <p>{t.noFlashcardsMessage}</p>
            <div className="no-flashcards-instructions">
              <p><strong>{t.instructionsTitle}</strong></p>
              <ol>
                <li>{t.methodDictionary}</li>
                <li>{t.methodTranscript}</li>
                <li>{t.methodReturn}</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const baseWord = currentCard.word || currentCard.wordSenseId?.replace(/\d+$/, '');
  const defNumber = currentCard.definitionNumber || currentCard.wordSenseId?.match(/\d+$/)?.[0] || '';
  const interval = currentCard?.srsData?.SRS_interval || 1;

  return (
    <div className="flashcard-study-container">
      {/* Card Container */}
      <div className="desktop-card-container" ref={cardContainerRef}>
        <div 
          className={`desktop-flashcard ${cardEntryAnimation}`}
          onClick={handleCardClick}
          style={{
            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            transition: 'transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
          }}
        >
          {/* Front of Card */}
          <div className="desktop-card-front">
            {(() => {
              if (!currentCard.exampleSentencesGenerated) {
                throw new Error(`Card "${currentCard.word || 'unknown'}" is missing exampleSentencesGenerated field. Backend must generate proper ~word~ markup data. No fallback UI allowed.`);
              }
              const parts = currentCard.exampleSentencesGenerated.split('//').map(s => s.trim()).filter(s => s.length > 0);
              const sentenceIndex = ((interval - 1) % 5) * 2;
              const englishSentence = parts[sentenceIndex] || parts[0] || 'No example available';
              const nativeTranslation = parts[sentenceIndex + 1] || parts[1] || '';
              const clozeSentence = englishSentence.replace(/~[^~]+~/g, '_____');
              
              return (
                <div className="desktop-card-content">
                  <div className="desktop-card-sentence">
                    {clozeSentence}
                  </div>
                  {nativeTranslation && (
                    <div 
                      className="desktop-card-translation"
                      dangerouslySetInnerHTML={{ 
                        __html: nativeTranslation.replace(/~([^~]+)~/g, '<span class="desktop-highlighted-word">$1</span>') 
                      }}
                    />
                  )}
                  <div className="desktop-card-hint">
                    {t.clickToReveal}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Back of Card */}
          <div className="desktop-card-back">
            <div className="desktop-card-content">
              {(() => {
                if (!currentCard.exampleSentencesGenerated) {
                  throw new Error(`Card "${currentCard.word || 'unknown'}" is missing exampleSentencesGenerated field. Backend must generate proper ~word~ markup data. No fallback UI allowed.`);
                }
                const parts = currentCard.exampleSentencesGenerated.split('//').map(s => s.trim()).filter(s => s.length > 0);
                const sentenceIndex = ((interval - 1) % 5) * 2;
                const englishSentence = parts[sentenceIndex] || parts[0] || 'No example available';
                const highlightedSentence = englishSentence.replace(/~([^~]+)~/g, (match, word) => {
                  return `<span class="desktop-highlighted-word">${word}</span>`;
                });
                
                return (
                  <div className="desktop-card-answer">
                    <div 
                      className="desktop-example-sentence"
                      dangerouslySetInnerHTML={{ __html: highlightedSentence }}
                    />
                    <button 
                      className="desktop-audio-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlayAudio();
                      }}
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
      </div>

      {/* Answer Buttons */}
      <div className="desktop-answer-buttons">
        <button 
          className="desktop-answer-btn desktop-incorrect-btn"
          onClick={() => markCard('incorrect')}
          disabled={!isFlipped}
        >
          <div className="desktop-btn-emoji">❌</div>
          <div className="desktop-btn-label">{t.again}</div>
          <div className="desktop-btn-time">
            {buttonTimes.incorrect.time}
          </div>
        </button>
        
        <button 
          className="desktop-answer-btn desktop-correct-btn"
          onClick={() => markCard('correct')}
          disabled={!isFlipped}
        >
          <div className="desktop-btn-emoji">✓</div>
          <div className="desktop-btn-label">{t.good}</div>
          <div className="desktop-btn-time">
            {buttonTimes.correct.time}
          </div>
        </button>
        
        <button 
          className="desktop-answer-btn desktop-easy-btn"
          onClick={() => markCard('easy')}
          disabled={!isFlipped}
        >
          <div className="desktop-btn-emoji">⭐</div>
          <div className="desktop-btn-label">{t.easy}</div>
          <div className="desktop-btn-time">
            {buttonTimes.easy.time}
          </div>
        </button>
      </div>

      {/* Answer Feedback Overlay */}
      {answerFeedback.show && (
        <div className={`desktop-answer-feedback desktop-answer-feedback-${answerFeedback.type}`}>
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

FlashcardMode.propTypes = {
  selectedWords: PropTypes.array,
  wordDefinitions: PropTypes.object.isRequired,
  setWordDefinitions: PropTypes.func.isRequired,
  englishSegments: PropTypes.array,
  targetLanguages: PropTypes.array,
  selectedProfile: PropTypes.string.isRequired
};

export default FlashcardMode;