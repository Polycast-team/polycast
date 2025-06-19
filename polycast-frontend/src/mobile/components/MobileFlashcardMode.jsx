import React, { useState, useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import { calculateNextReview, getDueCards, getReviewStats, formatNextReviewTime } from '../../utils/srsAlgorithm';
import { getSRSSettings } from '../../utils/srsSettings';
import { TouchGestureHandler } from '../utils/touchGestures';

const MobileFlashcardMode = ({ 
  selectedProfile, 
  wordDefinitions, 
  setWordDefinitions, 
  onBack 
}) => {
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
  
  // Refs for gesture handling
  const cardContainerRef = useRef(null);
  const gestureHandlerRef = useRef(null);

  // Process the wordDefinitions to extract all word senses
  const availableCards = React.useMemo(() => {
    const cards = [];
    Object.entries(wordDefinitions).forEach(([key, value]) => {
      if (value && value.wordSenseId && value.inFlashcards) {
        cards.push({ ...value, key });
      }
    });
    return cards;
  }, [wordDefinitions]);

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

  // Update due cards when dependencies change
  useEffect(() => {
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
  }, [availableCards, todaysNewCards]);

  // Get SRS statistics
  const srsStats = React.useMemo(() => getReviewStats(availableCards), [availableCards]);

  // Handle card flipping
  const flipCard = useCallback(() => {
    setIsFlipped(prev => !prev);
  }, []);

  // Enhanced navigation with animations
  const goToNextCard = useCallback(() => {
    if (dueCards.length === 0) return;
    setSwipeAnimation('slide-out-left');
    setTimeout(() => {
      setIsFlipped(false);
      setCurrentDueIndex(prev => (prev + 1) % dueCards.length);
      setSwipeAnimation('slide-in-right');
      setTimeout(() => setSwipeAnimation(''), 300);
    }, 200);
  }, [dueCards.length]);

  const goToPrevCard = useCallback(() => {
    if (dueCards.length === 0) return;
    setSwipeAnimation('slide-out-right');
    setTimeout(() => {
      setIsFlipped(false);
      setCurrentDueIndex(prev => prev === 0 ? dueCards.length - 1 : prev - 1);
      setSwipeAnimation('slide-in-left');
      setTimeout(() => setSwipeAnimation(''), 300);
    }, 200);
  }, [dueCards.length]);

  // Quick action for easy marking
  const quickMarkEasy = useCallback(() => {
    if (dueCards.length === 0 || !isFlipped) return;
    markCard('easy');
  }, [dueCards.length, isFlipped]);

  // Gesture callbacks
  const gestureCallbacks = useCallback({
    onSwipe: (e, gesture) => {
      e.preventDefault();
      
      switch (gesture.direction) {
        case 'right':
          // Swipe right: Previous card
          goToPrevCard();
          break;
        case 'left':
          // Swipe left: Next card
          goToNextCard();
          break;
        case 'up':
          // Swipe up: Flip card
          if (!isFlipped) {
            flipCard();
          }
          break;
        case 'down':
          // Swipe down: Mark as easy (if card is flipped)
          if (isFlipped) {
            quickMarkEasy();
          }
          break;
      }
    },
    onTap: (e, point) => {
      // Tap to flip card
      flipCard();
    },
    onLongPress: (e, point) => {
      // Long press to show quick actions
      if (isFlipped) {
        setShowQuickActions(true);
        setTimeout(() => setShowQuickActions(false), 2000);
      }
    }
  }, [goToNextCard, goToPrevCard, flipCard, quickMarkEasy, isFlipped]);

  // Initialize gesture handler
  useEffect(() => {
    if (!cardContainerRef.current) return;

    gestureHandlerRef.current = new TouchGestureHandler(
      cardContainerRef.current,
      gestureCallbacks
    );

    return () => {
      if (gestureHandlerRef.current) {
        gestureHandlerRef.current.destroy();
      }
    };
  }, [gestureCallbacks]);

  // Handle answer selection
  const markCard = (answer) => {
    if (dueCards.length === 0) return;
    
    const currentCard = dueCards[currentDueIndex];
    if (!currentCard) return;
    
    // Calculate next review using SRS algorithm
    const updatedSrsData = calculateNextReview(currentCard, answer);
    
    // Update the card in wordDefinitions with new SRS data
    const updatedCard = {
      ...currentCard,
      srsData: updatedSrsData
    };
    
    setWordDefinitions(prev => ({
      ...prev,
      [currentCard.key]: updatedCard
    }));
    
    // Update stats
    setStats(prev => ({
      ...prev,
      cardsReviewed: prev.cardsReviewed + 1,
      correctAnswers: answer !== 'incorrect' ? prev.correctAnswers + 1 : prev.correctAnswers
    }));
    
    // If this was a new card, increment today's count
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
    
    // Move to next card with animation
    setTimeout(() => {
      setIsFlipped(false);
      
      // Update due cards list
      const now = new Date();
      const updatedDueDate = new Date(updatedSrsData.nextReviewDate);
      const stillDueToday = (updatedDueDate - now) < (24 * 60 * 60 * 1000);
      
      if (stillDueToday && updatedSrsData.status !== 'review') {
        // Move card to end of queue
        const newDueCards = [...dueCards];
        newDueCards.splice(currentDueIndex, 1);
        newDueCards.push(updatedCard);
        setDueCards(newDueCards);
        
        if (currentDueIndex >= newDueCards.length) {
          setCurrentDueIndex(0);
        }
      } else {
        // Remove card from today's queue
        const newDueCards = dueCards.filter((_, index) => index !== currentDueIndex);
        setDueCards(newDueCards);
        
        if (currentDueIndex >= newDueCards.length && newDueCards.length > 0) {
          setCurrentDueIndex(newDueCards.length - 1);
        }
      }
      
      // Refresh due cards if queue is empty
      if (dueCards.length <= 1) {
        setTimeout(() => {
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
        }, 500);
      }
    }, 200);
  };


  // Calculate session stats
  const sessionDuration = Math.floor((new Date() - stats.sessionStartTime) / 1000 / 60);
  const accuracy = stats.cardsReviewed > 0 ? Math.round((stats.correctAnswers / stats.cardsReviewed) * 100) : 0;

  if (dueCards.length === 0) {
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
              <div className="mobile-summary-number">{accuracy}%</div>
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
        <div className="mobile-header-stats">
          <div className="mobile-header-progress">
            {currentDueIndex + 1} of {dueCards.length}
          </div>
          <div className="mobile-header-accuracy">
            {accuracy}% • {stats.cardsReviewed} done
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mobile-progress-container">
        <div 
          className="mobile-progress-bar"
          style={{ 
            width: `${((currentDueIndex + 1) / dueCards.length) * 100}%` 
          }}
        />
      </div>

      {/* Card Container */}
      <div className="mobile-card-container" ref={cardContainerRef}>
        <div 
          className={`mobile-flashcard ${isFlipped ? 'flipped' : ''} ${swipeAnimation}`}
        >
          {/* Front of Card */}
          <div className="mobile-card-front">
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
                      <div className="mobile-card-translation">
                        {nativeTranslation.replace(/~([^~]+)~/g, (match, word) => word)}
                      </div>
                    )}
                    <div className="mobile-card-hint">
                      Tap or swipe up to reveal • Swipe left/right to navigate
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
                  Tap or swipe up to see definition • Swipe left/right to navigate
                </div>
              </div>
            )}
          </div>

          {/* Back of Card */}
          <div className="mobile-card-back">
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
              <div className="mobile-quick-hint-item">← → Swipe for navigation</div>
            </div>
          </div>
        )}
        
        {/* Gesture Hints */}
        <div className="mobile-gesture-hints">
          <div className="mobile-gesture-hint mobile-gesture-left">
            <span>‹</span>
          </div>
          <div className="mobile-gesture-hint mobile-gesture-right">
            <span>›</span>
          </div>
          {!isFlipped && (
            <div className="mobile-gesture-hint mobile-gesture-up">
              <span>↑</span>
            </div>
          )}
          {isFlipped && (
            <div className="mobile-gesture-hint mobile-gesture-down">
              <span>↓</span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Dots */}
      <div className="mobile-nav-dots">
        <button 
          className="mobile-nav-btn mobile-prev-btn"
          onClick={goToPrevCard}
          disabled={dueCards.length <= 1}
        >
          ‹
        </button>
        <div className="mobile-dots">
          {dueCards.slice(0, Math.min(5, dueCards.length)).map((_, index) => (
            <div 
              key={index}
              className={`mobile-dot ${index === currentDueIndex ? 'active' : ''}`}
            />
          ))}
          {dueCards.length > 5 && <div className="mobile-dots-more">...</div>}
        </div>
        <button 
          className="mobile-nav-btn mobile-next-btn"
          onClick={goToNextCard}
          disabled={dueCards.length <= 1}
        >
          ›
        </button>
      </div>

      {/* Answer Buttons */}
      {isFlipped && (
        <div className="mobile-answer-buttons">
          <button 
            className="mobile-answer-btn mobile-incorrect-btn"
            onClick={() => markCard('incorrect')}
          >
            <div className="mobile-btn-emoji">❌</div>
            <div className="mobile-btn-label">Incorrect</div>
            <div className="mobile-btn-time">1 min</div>
          </button>
          
          <button 
            className="mobile-answer-btn mobile-correct-btn"
            onClick={() => markCard('correct')}
          >
            <div className="mobile-btn-emoji">✓</div>
            <div className="mobile-btn-label">Correct</div>
            <div className="mobile-btn-time">
              {formatNextReviewTime(calculateNextReview(currentCard, 'correct').nextReviewDate)}
            </div>
          </button>
          
          <button 
            className="mobile-answer-btn mobile-easy-btn"
            onClick={() => markCard('easy')}
          >
            <div className="mobile-btn-emoji">⭐</div>
            <div className="mobile-btn-label">Easy</div>
            <div className="mobile-btn-time">
              {formatNextReviewTime(calculateNextReview(currentCard, 'easy').nextReviewDate)}
            </div>
          </button>
        </div>
      )}
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