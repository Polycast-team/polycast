import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import './FlashcardMode.css';
import { calculateNextReview, formatNextReviewTime } from '../utils/srsAlgorithm';
import { useFlashcardSession } from '../hooks/useFlashcardSession';
import { useFlashcardSRS } from '../hooks/useFlashcardSRS';
import { useFlashcardCalendar } from '../hooks/useFlashcardCalendar';
import { playFlashcardAudio } from '../utils/flashcardAudio';
import FlashcardCalendarModal from './shared/FlashcardCalendarModal';
import ErrorPopup from './ErrorPopup';
import { useErrorHandler } from '../hooks/useErrorHandler';

const FlashcardMode = ({ selectedWords, wordDefinitions, setWordDefinitions, englishSegments, targetLanguages, selectedProfile }) => {
  // Local UI state
  const [showCalendar, setShowCalendar] = useState(false);
  const [audioState, setAudioState] = useState({ loading: false, error: null });
  const [currentAudio, setCurrentAudio] = useState(null);
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
    calendarUpdateTrigger
  } = sessionData;
  
  // Use shared SRS hook
  const { markCard } = useFlashcardSRS(
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
  
  // Calculate button times for SRS preview
  const buttonTimes = useMemo(() => {
    if (!currentCard) return { incorrect: { time: '' }, correct: { time: '' }, easy: { time: '' } };
    
    const incorrectResult = calculateNextReview(currentCard, 'incorrect');
    const correctResult = calculateNextReview(currentCard, 'correct');
    const easyResult = calculateNextReview(currentCard, 'easy');
    
    return {
      incorrect: {
        time: formatNextReviewTime(incorrectResult.nextReviewDate)
      },
      correct: {
        time: formatNextReviewTime(correctResult.nextReviewDate)
      },
      easy: {
        time: formatNextReviewTime(easyResult.nextReviewDate)
      }
    };
  }, [currentCard]);
  
  // Audio playback handler
  const handlePlayAudio = async () => {
    if (!currentCard) return;
    await playFlashcardAudio(currentCard.word, currentAudio, setCurrentAudio, setAudioState);
  };
  
  // Show completion screen
  if (isSessionComplete) {
    return (
      <div className="flashcard-container">
        <div className="flashcard-header">
          <button className="back-button" onClick={() => window.location.reload()}>
            ← Back to Main
          </button>
          <div className="header-title">Study Complete</div>
        </div>
        
        <div className="completion-state">
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
          
          <button className="done-button" onClick={() => window.location.reload()}>
            Return to Main
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
    <div className="flashcard-container">
      {/* Header */}
      <div className="flashcard-header">
        <button className="back-button" onClick={() => window.location.reload()}>
          ← Back to Main
        </button>
        <button 
          className="calendar-button" 
          onClick={() => setShowCalendar(true)}
          style={{
            background: 'none',
            border: '1px solid #2196f3',
            borderRadius: '6px',
            padding: '8px 12px',
            fontSize: '14px',
            color: '#2196f3',
            cursor: 'pointer',
            marginLeft: 'auto',
            marginRight: '20px'
          }}
        >
          📅 Calendar
        </button>
        <div style={{color: 'red', fontSize: '10px'}}>V2.0-HC</div>
        <div className="header-stats">
          <div className="header-progress">
            <span style={{color: '#5f72ff'}}>New: {headerStats.newCards}</span> • 
            <span style={{color: '#ef4444', marginLeft: '4px'}}>Learning: {headerStats.learningCards}</span> • 
            <span style={{color: '#10b981', marginLeft: '4px'}}>Review: {headerStats.reviewCards}</span>
          </div>
          <div className="header-accuracy">
            {headerStats.accuracy}% • {headerStats.cardsReviewed} done
          </div>
        </div>
      </div>

      {/* Card Container */}
      <div className="desktop-card-container">
        <div 
          className="desktop-flashcard"
          onClick={() => setIsFlipped(!isFlipped)}
          style={{
            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            transition: 'transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            cursor: 'pointer'
          }}
        >
          {/* Front of Card */}
          <div className="desktop-card-front">
            <div className="desktop-card-content">
              {currentCard.exampleSentencesGenerated ? (
                (() => {
                  const parts = currentCard.exampleSentencesGenerated.split('//').map(s => s.trim()).filter(s => s.length > 0);
                  const sentenceIndex = ((interval - 1) % 5) * 2;
                  const englishSentence = parts[sentenceIndex] || parts[0] || 'No example available';
                  const nativeTranslation = parts[sentenceIndex + 1] || parts[1] || '';
                  const clozeSentence = englishSentence.replace(/~[^~]+~/g, '_____');
                  const exampleNumber = ((interval - 1) % 5) + 1;
                  
                  return (
                    <div className="desktop-card-content">
                      <div className="desktop-example-label">
                        Example {exampleNumber}:
                      </div>
                      <div className="desktop-card-sentence">
                        {clozeSentence}
                      </div>
                      {nativeTranslation && (
                        <div 
                          className="desktop-card-translation"
                          dangerouslySetInnerHTML={{ 
                            __html: nativeTranslation.replace(/~([^~]+)~/g, '<span class="highlighted-word">$1</span>') 
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
                    {defNumber && <span className="def-number">#{defNumber}</span>}
                  </div>
                  <div className="desktop-card-prompt">
                    Click to see definition
                  </div>
                </div>
              )}
            </div>
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
                    return `<span class="highlighted-word">${word}</span>`;
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