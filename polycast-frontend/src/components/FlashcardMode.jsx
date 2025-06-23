import React, { useState, useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import './FlashcardMode.css';
import { calculateNextReview, getDueCards, getReviewStats, formatNextReviewTime } from '../utils/srsAlgorithm';
import { getSRSSettings } from '../utils/srsSettings';
import { getHardcodedCards } from '../utils/hardcodedCards';
import ErrorPopup from './ErrorPopup';
import { useErrorHandler } from '../hooks/useErrorHandler';

const FlashcardMode = ({ selectedWords, wordDefinitions, setWordDefinitions, englishSegments, targetLanguages, selectedProfile }) => {
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
  const [showCalendar, setShowCalendar] = useState(false);
  const [processedCards, setProcessedCards] = useState([]); // Track cards processed in current session
  const [calendarUpdateTrigger, setCalendarUpdateTrigger] = useState(0); // Force calendar re-render
  const [audioState, setAudioState] = useState({ loading: false, error: null });
  const [currentAudio, setCurrentAudio] = useState(null);
  const { error: popupError, showError, clearError } = useErrorHandler();
  
  // Refs for tracking
  const processingCardRef = useRef(false);
  const lastCardProcessedTime = useRef(Date.now());
  
  // Stable date for new cards - only calculate once
  const nowDateRef = useRef(new Date().toISOString());

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

  // Initialize SRS data and get due cards
  useEffect(() => {
    const initializeDailyLimits = async () => {
      const today = new Date().toDateString();
      
      if (selectedProfile === 'non-saving') {
        // Non-saving mode: don't persist daily limits at all
        setTodaysNewCards(0);
      } else {
        // Profile mode: use database for daily limits
        try {
          const response = await fetch(`https://polycast-server.onrender.com/api/profile/${selectedProfile}/srs-daily`);
          if (response.ok) {
            const dailyData = await response.json();
            
            // Reset count if it's a new day
            if (dailyData.date !== today) {
              setTodaysNewCards(0);
              // Save reset to database
              await fetch(`https://polycast-server.onrender.com/api/profile/${selectedProfile}/srs-daily`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date: today, newCardsToday: 0 })
              });
            } else {
              setTodaysNewCards(dailyData.newCardsToday || 0);
            }
          } else {
            // First time or error - initialize
            setTodaysNewCards(0);
            await fetch(`https://polycast-server.onrender.com/api/profile/${selectedProfile}/srs-daily`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ date: today, newCardsToday: 0 })
            });
          }
        } catch (error) {
          console.error('Error loading daily SRS data:', error);
          showError(`Database connection failed for profile "${selectedProfile}". Cannot load SRS data. Please check your connection and try again.`);
          setTodaysNewCards(0);
        }
      }
    };
    
    initializeDailyLimits();
  }, [selectedProfile]); // Re-run when profile changes
  
  // Separate effect for due cards that depends on todaysNewCards
  useEffect(() => {
    console.log(`[DESKTOP] Starting study session for ${selectedProfile} with ${availableCards.length} flashcards`);
    
    // Get due cards using SRS algorithm with current settings
    const currentSettings = getSRSSettings();
    const maxNewToday = Math.max(0, currentSettings.newCardsPerDay - todaysNewCards);
    let due = getDueCards(availableCards, { newPerDay: maxNewToday }, false);
    
    // If no cards are strictly due, include waiting learning cards
    if (due.length === 0) {
      due = getDueCards(availableCards, { newPerDay: maxNewToday }, true);
    }
    
    console.log(`[CARD ORDER] Due cards:`, due);
    setDueCards(due);
    setCurrentDueIndex(0);
    setIsFlipped(false);
  }, [availableCards, wordDefinitions, todaysNewCards]); // Re-run when dependencies change

  // Calculate future due dates for calendar - using useMemo for proper reactivity
  const calendarData = React.useMemo(() => {
    const today = new Date();
    const nextWeekDays = [];
    
    console.log(`[CALENDAR DEBUG] Building calendar from ${today.toDateString()} for 8 days`);
    
    // Get all cards with current session updates
    const currentCards = [];
    
    // Add cards from current session (dueCards) with their updated state
    dueCards.forEach(card => {
      currentCards.push(card);
    });
    
    // Add processed cards (cards that were answered and removed from session)
    processedCards.forEach(card => {
      currentCards.push(card);
    });
    
    // Add cards from wordDefinitions (for non-saving mode) or availableCards
    if (selectedProfile === 'non-saving') {
      // For non-saving mode, use availableCards but exclude those already in dueCards or processedCards
      availableCards.forEach(card => {
        const alreadyInSession = dueCards.some(sessionCard => 
          sessionCard.key === card.key || sessionCard.wordSenseId === card.wordSenseId
        );
        const alreadyProcessed = processedCards.some(processedCard => 
          processedCard.key === card.key || processedCard.wordSenseId === card.wordSenseId
        );
        if (!alreadyInSession && !alreadyProcessed) {
          currentCards.push(card);
        }
      });
    } else {
      // For other profiles, use updated wordDefinitions data
      Object.entries(wordDefinitions).forEach(([key, value]) => {
        if (value && value.wordSenseId && value.inFlashcards) {
          const alreadyInSession = dueCards.some(sessionCard => 
            sessionCard.key === key || sessionCard.wordSenseId === value.wordSenseId
          );
          const alreadyProcessed = processedCards.some(processedCard => 
            processedCard.key === key || processedCard.wordSenseId === value.wordSenseId
          );
          if (!alreadyInSession && !alreadyProcessed) {
            currentCards.push({ ...value, key });
          }
        }
      });
    }
    
    for (let i = 0; i < 8; i++) { // Extended to 8 days to catch more future cards
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      date.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      // Find cards due on this day using current session data
      const cardsForDay = currentCards.filter(card => {
        if (!card.srsData) return false;
        
        const dueDate = new Date(card.srsData.dueDate || card.srsData.nextReviewDate);
        
        // Compare just the date parts, ignoring time
        const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
        const dayDateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const isInRange = dueDateOnly.getTime() === dayDateOnly.getTime();
        
        // Debug logging for date filtering
        if (card.word === 'eat' || i >= 6) { // Log for eat card or last few days
          console.log(`[DATE DEBUG] Day ${i} (${dayDateOnly.toDateString()}): Card "${card.word}" due ${dueDateOnly.toDateString()}, match: ${isInRange}`);
        }
        
        return isInRange;
      });
      
      nextWeekDays.push({
        date,
        cards: cardsForDay,
        dayName: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : date.toLocaleDateString('en-US', { weekday: 'short' }),
        dateStr: date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })
      });
    }
    
    return nextWeekDays;
  }, [dueCards, wordDefinitions, availableCards, selectedProfile, processedCards, calendarUpdateTrigger]);

  // Calculate button times for SRS preview
  const buttonTimes = React.useMemo(() => {
    if (!dueCards[currentDueIndex]) return { incorrect: { time: '', debugDate: '' }, correct: { time: '', debugDate: '' }, easy: { time: '', debugDate: '' } };
    
    const currentCard = dueCards[currentDueIndex];
    const incorrectResult = calculateNextReview(currentCard, 'incorrect');
    const correctResult = calculateNextReview(currentCard, 'correct');
    const easyResult = calculateNextReview(currentCard, 'easy');
    
    return {
      incorrect: {
        time: formatNextReviewTime(incorrectResult.nextReviewDate),
        debugDate: new Date(incorrectResult.nextReviewDate).toLocaleString()
      },
      correct: {
        time: formatNextReviewTime(correctResult.nextReviewDate),
        debugDate: new Date(correctResult.nextReviewDate).toLocaleString()
      },
      easy: {
        time: formatNextReviewTime(easyResult.nextReviewDate),
        debugDate: new Date(easyResult.nextReviewDate).toLocaleString()
      }
    };
  }, [dueCards, currentDueIndex]);

  // Calculate header stats
  const headerStats = React.useMemo(() => {
    const newCards = dueCards.filter(card => card.srsData.isNew).length;
    const learningCards = dueCards.filter(card => card.srsData.gotWrongThisSession && !card.srsData.isNew).length;
    const reviewCards = dueCards.filter(card => !card.srsData.isNew && !card.srsData.gotWrongThisSession).length;
    const accuracy = stats.cardsReviewed > 0 ? Math.round((stats.correctAnswers / stats.cardsReviewed) * 100) : 100;
    
    return {
      newCards,
      learningCards,
      reviewCards,
      cardsReviewed: stats.cardsReviewed,
      accuracy
    };
  }, [dueCards, stats]);

  // Audio playback handler
  const handlePlayAudio = async () => {
    const currentCard = dueCards[currentDueIndex];
    if (!currentCard) return;

    const word = currentCard.word;
    setAudioState({ loading: true, error: null });

    try {
      // Stop any currently playing audio
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      }

      const response = await fetch('https://polycast-server.onrender.com/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: word })
      });

      if (!response.ok) {
        throw new Error(`TTS request failed: ${response.statusText}`);
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      audio.onplay = () => setAudioState({ loading: false, error: null });
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        setCurrentAudio(null);
      };
      audio.onerror = () => {
        setAudioState({ loading: false, error: 'Audio playback failed' });
        URL.revokeObjectURL(audioUrl);
        setCurrentAudio(null);
      };

      setCurrentAudio(audio);
      await audio.play();
    } catch (error) {
      console.error('TTS Error:', error);
      setAudioState({ loading: false, error: 'Failed to generate audio' });
    }
  };

  // Card marking function (reused from mobile)
  const markCard = useCallback((answer) => {
    if (!dueCards[currentDueIndex]) return;
    if (processingCardRef.current) return;
    
    const currentCard = dueCards[currentDueIndex];
    
    // Stop any currently playing audio when marking a card
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
    lastCardProcessedTime.current = Date.now();
    
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
      const isNowNew = updatedSrsData.isNew;
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
      
      // Add the updated card to processedCards so it appears in calendar with new due date
      setProcessedCards(prev => [...prev, updatedCard]);
      setCalendarUpdateTrigger(prev => prev + 1); // Force calendar re-render
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
        
        // Auto-refresh queue if no cards left but there might be more due
        if (newDueCards.length === 0) {
          setTimeout(() => {
            const updatedAvailableCards = [];
            Object.entries(wordDefinitions).forEach(([key, value]) => {
              const cardToCheck = updatedCard.key === key ? updatedCard : value;
              if (cardToCheck && cardToCheck.wordSenseId && cardToCheck.inFlashcards) {
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
          }, 100);
        } else {
          // Clear processing flag after card state is updated
          processingCardRef.current = false;
        }
      }, 200);
    }, 200);
  }, [dueCards, currentDueIndex, setWordDefinitions, todaysNewCards, selectedProfile, srsSettings, currentAudio]);

  // Calendar Modal Component
  const CalendarModal = () => {
    // Debug: Log when calendar data changes
    React.useEffect(() => {
      console.log('[CALENDAR DEBUG] Calendar data updated:', calendarData.map(day => ({
        day: day.dayName,
        cardCount: day.cards.length,
        cards: day.cards.map(c => `${c.word} (due: ${new Date(c.srsData.dueDate || c.srsData.nextReviewDate).toLocaleString()})`)
      })));
      
      console.log('[CALENDAR DEBUG] Current processedCards:', processedCards.map(c => ({
        word: c.word,
        dueDate: new Date(c.srsData.dueDate || c.srsData.nextReviewDate).toLocaleString()
      })));
      
      console.log('[CALENDAR DEBUG] Current dueCards:', dueCards.map(c => ({
        word: c.word,
        dueDate: new Date(c.srsData.dueDate || c.srsData.nextReviewDate).toLocaleString()
      })));
      
      console.log('[CALENDAR DEBUG] Update trigger:', calendarUpdateTrigger);
    }, [calendarData, processedCards, dueCards, calendarUpdateTrigger]);
    
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
            <h3 style={{ margin: 0, fontSize: '18px', color: '#333' }}>📅 Next 8 Days</h3>
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
  const timeSinceLastProcess = Date.now() - lastCardProcessedTime.current;
  if (dueCards.length === 0 && timeSinceLastProcess > 1000) {
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
              <div className="summary-number">{stats.cardsReviewed}</div>
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

  const currentCard = dueCards[currentDueIndex];
  if (!currentCard) return null;

  const baseWord = currentCard.word || currentCard.wordSenseId?.replace(/\d+$/, '');
  const defNumber = currentCard.definitionNumber || currentCard.wordSenseId?.match(/\d+$/)?.[0] || '';
  const interval = currentCard?.srsData?.interval || 1;

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
              <div className="desktop-card-word">
                {baseWord}
                {defNumber && <span className="def-number">#{defNumber}</span>}
              </div>
              <div className="desktop-card-prompt">
                Click to see definition
              </div>
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
      {showCalendar && <CalendarModal />}

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