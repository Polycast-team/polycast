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
import '../mobile/styles/mobile-flashcards.css';

const FlashcardMode = ({ selectedWords, wordDefinitions, setWordDefinitions, englishSegments, targetLanguages, selectedProfile }) => {
  // State for UI mode
  const [currentMode, setCurrentMode] = useState('profile'); // 'profile' or 'flashcards'
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

  // Handle starting study session
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

  // Generate and play audio
  const generateAndPlayAudio = useCallback(async (text, cardKey) => {
    if (!text) return;
    
    setAudioState(prev => {
      if (prev.loading) return prev;
      return { loading: true, error: null };
    });
    
    try {
      const checkResponse = await fetch(`https://polycast-server.onrender.com/api/audio/${encodeURIComponent(cardKey)}`);
      
      let audioUrl;
      if (checkResponse.ok) {
        const audioData = await checkResponse.json();
        if (!audioData || !audioData.audioUrl) {
          throw new Error('Invalid audio data received from server');
        }
        audioUrl = audioData.audioUrl;
      } else {
        const generateResponse = await fetch('https://polycast-server.onrender.com/api/generate-audio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            text: text.replace(/<[^>]*>/g, ''),
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
  }, [selectedProfile, showError]);

  // Play audio button handler
  const handlePlayAudio = useCallback(() => {
    if (!currentCard || !currentCard.exampleSentencesGenerated) return;
    
    const parts = currentCard.exampleSentencesGenerated.split('//').map(s => s.trim()).filter(s => s.length > 0);
    const srsInterval = currentCard?.srsData?.SRS_interval || 1;
    const sentenceIndex = ((srsInterval - 1) % 5) * 2;
    const englishSentence = parts[sentenceIndex] || parts[0] || '';
    
    if (englishSentence) {
      generateAndPlayAudio(englishSentence, currentCard.key);
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

  useEffect(() => {
    if (isFlipped && currentCard && !hasAutoPlayedThisFlip) {
      if (currentCard.exampleSentencesGenerated) {
        setHasAutoPlayedThisFlip(true);
        
        const parts = currentCard.exampleSentencesGenerated.split('//').map(s => s.trim()).filter(s => s.length > 0);
        const srsInterval = currentCard?.srsData?.SRS_interval || 1;
        const sentenceIndex = ((srsInterval - 1) % 5) * 2;
        const englishSentence = parts[sentenceIndex] || parts[0] || '';
        
        if (englishSentence) {
          setTimeout(() => {
            generateAndPlayAudio(englishSentence, currentCard.key);
          }, 300);
        }
      }
    }
  }, [isFlipped, currentCard, hasAutoPlayedThisFlip, generateAndPlayAudio]);

  // Show completion screen
  if (currentMode === 'flashcards' && isSessionComplete) {
    return (
      <div className="flashcard-completion">
        <div className="completion-content">
          <div className="completion-icon">🎉</div>
          <h2>Great work!</h2>
          <p>You've completed all cards for today.</p>
          
          <div className="session-summary">
            <div className="summary-stat">
              <div className="summary-number">{sessionData.stats.cardsReviewed}</div>
              <div className="summary-label">Cards Reviewed</div>
            </div>
            <div className="summary-stat">
              <div className="summary-number">{headerStats.accuracy}%</div>
              <div className="summary-label">Accuracy</div>
            </div>
            <div className="summary-stat">
              <div className="summary-number">{sessionDuration}</div>
              <div className="summary-label">Minutes</div>
            </div>
          </div>
          
          <button className="completion-back-button" onClick={handleBackToProfile}>
            Return to Profiles
          </button>
        </div>
      </div>
    );
  }

  // Profile selection mode
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

  // Flashcard study mode - extract just the card and buttons
  if (!currentCard) return null;

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
            {currentCard.exampleSentencesGenerated ? (
              (() => {
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
                      Click to reveal answer
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="desktop-card-content">
                <div className="desktop-card-word">
                  {baseWord}
                  {defNumber && <span className="desktop-definition-number">#{defNumber}</span>}
                </div>
                <div className="desktop-card-hint">
                  Click to see definition
                </div>
              </div>
            )}
          </div>

          {/* Back of Card */}
          <div className="desktop-card-back">
            <div className="desktop-card-content">
              {currentCard.exampleSentencesGenerated ? (
                (() => {
                  const parts = currentCard.exampleSentencesGenerated.split('//').map(s => s.trim()).filter(s => s.length > 0);
                  const sentenceIndex = ((interval - 1) % 5) * 2;
                  const englishSentence = parts[sentenceIndex] || parts[0] || 'No example available';
                  const highlightedSentence = englishSentence.replace(/~([^~]+)~/g, (match, word) => {
                    return `<span class="desktop-highlighted-word">${word}</span>`;
                  });
                  const exampleNumber = ((interval - 1) % 5) + 1;
                  
                  return (
                    <div className="desktop-card-answer">
                      <div className="desktop-example-label">
                        Example {exampleNumber}:
                      </div>
                      <div 
                        className="desktop-example-sentence"
                        dangerouslySetInnerHTML={{ __html: highlightedSentence }}
                      />
                      {currentCard.disambiguatedDefinition && (
                        <div className="desktop-card-definition">
                          {currentCard.disambiguatedDefinition.definition}
                        </div>
                      )}
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
                })()
              ) : (
                <div className="desktop-card-answer">
                  <div className="desktop-card-word-large">
                    {baseWord}
                  </div>
                  {currentCard.disambiguatedDefinition && (
                    <div className="desktop-card-definition">
                      {currentCard.disambiguatedDefinition.definition}
                    </div>
                  )}
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
              )}
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
          <div className="desktop-btn-label">Incorrect</div>
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
          <div className="desktop-btn-label">Correct</div>
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
          <div className="desktop-btn-label">Easy</div>
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