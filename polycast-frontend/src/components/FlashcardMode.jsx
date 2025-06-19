import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import './FlashcardMode.css';
import { calculateNextReview, getDueCards, getReviewStats, formatNextReviewTime } from '../utils/srsAlgorithm';

const FlashcardMode = ({ selectedWords, wordDefinitions, setWordDefinitions, englishSegments, targetLanguages }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  // SRS: Track today's review session
  const [todaysNewCards, setTodaysNewCards] = useState(0);
  const [dueCards, setDueCards] = useState([]);
  const [currentDueIndex, setCurrentDueIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState({
    cardsReviewed: 0,
    correctAnswers: 0,
    history: []
  });
  const [wordImages, setWordImages] = useState({});
  const [imageLoading, setImageLoading] = useState({});
  const [generatedSentences, setGeneratedSentences] = useState({});
  const [viewedCards, setViewedCards] = useState({});
  const [cardAnimation, setCardAnimation] = useState('');
  
  // Reference to track which cards have been processed to avoid infinite re-renders
  const processedCardsRef = useRef('');
  
  // Track card views - a card can be in one of 4 spaced repetition stages
  // 1: First time seen today
  // 2: Second viewing today
  // 3: Third viewing today
  // 4: Will be shown tomorrow
  
  // Process the wordDefinitions to extract all word senses - use useMemo to avoid recalculation on every render
  const availableCards = React.useMemo(() => {
    const cards = [];
    Object.entries(wordDefinitions).forEach(([key, value]) => {
      if (value && value.wordSenseId && value.inFlashcards) {
        cards.push({ ...value, key }); // Include the full card data
      }
    });
    return cards;
  }, [wordDefinitions]);

  // Initialize SRS data and get due cards
  useEffect(() => {
    // Get today's date for tracking new cards
    const today = new Date().toDateString();
    const storedDate = localStorage.getItem('srsLastDate');
    const storedCount = parseInt(localStorage.getItem('srsNewCardsToday') || '0');
    
    // Reset count if it's a new day
    if (storedDate !== today) {
      localStorage.setItem('srsLastDate', today);
      localStorage.setItem('srsNewCardsToday', '0');
      setTodaysNewCards(0);
    } else {
      setTodaysNewCards(storedCount);
    }
    
    // Get due cards using SRS algorithm
    const due = getDueCards(availableCards, { newPerDay: 5 - storedCount });
    setDueCards(due);
    setCurrentDueIndex(0);
  }, [availableCards]);
  
  const cardContainerRef = useRef(null);
  
  // Clean up duplicate flashcards when component mounts
  useEffect(() => {
    // Create a map to count occurrences of each word
    const wordCounts = {};
    const seenIds = new Set();
    const duplicates = [];
    
    console.log('[FLASHCARDS] Checking for duplicate flashcards on mount...');
    
    // Find flashcards with the same word
    Object.entries(wordDefinitions).forEach(([key, value]) => {
      if (value && value.wordSenseId && value.inFlashcards) {
        const id = value.wordSenseId;
        
        // If we've seen this ID before, it's a duplicate
        if (seenIds.has(id)) {
          console.log(`[FLASHCARDS] Found duplicate ID: ${id}`);
          duplicates.push(id);
        } else {
          seenIds.add(id);
          
          // Also track by word to detect potential word duplicates
          const word = value.word;
          if (!wordCounts[word]) {
            wordCounts[word] = [];
          }
          wordCounts[word].push({
            id: key,
            data: value,
            createdAt: value.cardCreatedAt ? new Date(value.cardCreatedAt).getTime() : Date.now()
          });
        }
      }
    });
    
    // Log our findings
    if (duplicates.length > 0) {
      console.log(`[FLASHCARDS] Found ${duplicates.length} duplicate IDs that need cleanup`);
    } else {
      console.log('[FLASHCARDS] No duplicate IDs found');
    }
    
    // Only log words with multiple instances for debugging
    Object.entries(wordCounts).forEach(([word, instances]) => {
      if (instances.length > 1) {
        console.log(`[FLASHCARDS] Word '${word}' has ${instances.length} different senses:`);
        instances.forEach(instance => {
          console.log(`  - ${instance.id}: ${instance.data.disambiguatedDefinition?.definition || 'No definition'} (${instance.data.partOfSpeech || 'unknown'})`); 
        });
      }
    });
  }, [wordDefinitions]);
  
  // Handle key presses for navigation and flipping
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (showStats) return; // Disable keyboard navigation when viewing stats
      if (availableCards.length === 0) return; // No cards to navigate
      
      if (e.code === 'Space') {
        // Flip card on spacebar
        e.preventDefault();
        setIsFlipped(prev => !prev);
      } else if (e.code === 'ArrowRight' || e.code === 'ArrowDown') {
        // Next card
        e.preventDefault();
        if (isFlipped) {
          // Get the current sense ID
          const currentSenseId = availableCards[currentIndex];
          const currentCardData = wordDefinitions[currentSenseId];
          
          // The basic word without the definition number
          const baseWord = currentCardData?.word || currentSenseId.replace(/\d+$/, '');
          
          // Track this card as reviewed before moving to next
          setStats(prev => ({
            ...prev,
            cardsReviewed: prev.cardsReviewed + 1,
            history: [...prev.history, {
              wordSenseId: currentSenseId,
              word: baseWord, // Store the base word for better readability in stats
              date: new Date().toISOString()
            }]
          }));
        }
        setIsFlipped(false);
        setCurrentIndex(prev => (prev + 1) % availableCards.length);
      } else if (e.code === 'ArrowLeft' || e.code === 'ArrowUp') {
        // Previous card
        e.preventDefault();
        setIsFlipped(false);
        setCurrentIndex(prev => 
          prev === 0 ? availableCards.length - 1 : prev - 1
        );
      } else if (e.key === '1') {
        // Mark as incorrect
        if (isFlipped) {
          markCard('incorrect');
        }
      } else if (e.key === '2') {
        // Mark as correct
        if (isFlipped) {
          markCard('correct');
        }
      } else if (e.key === '3') {
        // Mark as easy
        if (isFlipped) {
          markCard('easy');
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, isFlipped, availableCards, showStats, wordDefinitions]);
  
  const markCard = (answer) => {
    if (dueCards.length === 0) return;
    
    const currentCard = dueCards[currentDueIndex];
    if (!currentCard) return;
    
    // Calculate next review using SRS algorithm
    const updatedSrsData = calculateNextReview(currentCard, answer);
    
    // Update the card in wordDefinitions with new SRS data
    setWordDefinitions(prev => ({
      ...prev,
      [currentCard.key]: {
        ...currentCard,
        srsData: updatedSrsData
      }
    }));
    
    // Update stats
    setStats(prev => ({
      ...prev,
      cardsReviewed: prev.cardsReviewed + 1,
      correctAnswers: answer !== 'incorrect' ? prev.correctAnswers + 1 : prev.correctAnswers,
      history: [...prev.history, {
        wordSenseId: currentCard.wordSenseId,
        word: currentCard.word,
        date: new Date().toISOString(),
        correct: answer !== 'incorrect',
        answer: answer
      }]
    }));
    
    // If this was a new card, increment today's count
    if (currentCard.srsData.status === 'new') {
      const newCount = todaysNewCards + 1;
      setTodaysNewCards(newCount);
      localStorage.setItem('srsNewCardsToday', newCount.toString());
    }
    
    // Move to next card
    setCardAnimation('slide-out-left');
    setTimeout(() => {
      setIsFlipped(false);
      
      // Move to next due card or finish session
      if (currentDueIndex < dueCards.length - 1) {
        setCurrentDueIndex(prev => prev + 1);
      } else {
        // Session complete - refresh due cards
        const newDueCards = getDueCards(availableCards, { newPerDay: 5 - todaysNewCards });
        setDueCards(newDueCards);
        setCurrentDueIndex(0);
      }
      
      setCardAnimation('slide-in-right');
      setTimeout(() => setCardAnimation(''), 300);
    }, 300);
  };

  // Get SRS statistics
  const srsStats = React.useMemo(() => getReviewStats(availableCards), [availableCards]);
  
  const flipCard = () => {
    setIsFlipped(prev => !prev);
  };
  
  const nextCard = () => {
    if (availableCards.length === 0) return;
    
    if (isFlipped) {
      // Get the current sense ID and data
      const currentSenseId = availableCards[currentIndex];
      const currentCardData = wordDefinitions[currentSenseId];
      
      // The basic word without the definition number
      const baseWord = currentCardData?.word || currentSenseId.replace(/\d+$/, '');
      
      // Track this card as reviewed before moving to next
      setStats(prev => ({
        ...prev,
        cardsReviewed: prev.cardsReviewed + 1,
        history: [...prev.history, {
          wordSenseId: currentSenseId,
          word: baseWord, // Store base word for readability
          date: new Date().toISOString()
        }]
      }));
    }
    
    // Trigger slide animation for manual navigation
    setCardAnimation('slide-out-left');
    setTimeout(() => {
      setIsFlipped(false);
      setCurrentIndex(prev => (prev + 1) % availableCards.length);
      setCardAnimation('slide-in-right');
      setTimeout(() => setCardAnimation(''), 300);
    }, 300);
  };
  
  const prevCard = () => {
    // Trigger slide animation for previous navigation (reverse direction)
    setCardAnimation('slide-out-right');
    setTimeout(() => {
      setIsFlipped(false);
      setCurrentIndex(prev => 
        prev === 0 ? availableCards.length - 1 : prev - 1
      );
      setCardAnimation('slide-in-left');
      setTimeout(() => setCardAnimation(''), 300);
    }, 300);
  };
  
  // Load images for all cards once when the component mounts or availableCards changes significantly
  useEffect(() => {
    if (availableCards.length === 0) return;
    
    // Create image map (no default images)
    const newImageMap = {};
    
    // Cards start without images
    availableCards.forEach(senseId => {
      newImageMap[senseId] = null;
    });
    
    // Set all images at once
    setWordImages(newImageMap);
    
  }, [availableCards.length]); // Only re-run if the number of available cards changes
  
  // Calculate stats for the visualization
  const calculatedStats = {
    totalCards: availableCards.length,
    reviewedPercentage: stats.cardsReviewed > 0 
      ? Math.round((stats.cardsReviewed / availableCards.length) * 100) 
      : 0,
    correctPercentage: stats.cardsReviewed > 0 
      ? Math.round((stats.correctAnswers / stats.cardsReviewed) * 100) 
      : 0,
    dayStats: calculateDayStats(stats.history)
  };
  
  // Helper to calculate daily stats for the chart
  function calculateDayStats(history) {
    if (!history.length) return [];
    
    const days = {};
    const now = new Date();
    
    // Initialize last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      days[dateKey] = { date: dateKey, count: 0, correct: 0 };
    }
    
    // Fill with actual data
    history.forEach(item => {
      const dateKey = item.date.split('T')[0];
      if (days[dateKey]) {
        days[dateKey].count++;
        if (item.correct) {
          days[dateKey].correct++;
        }
      }
    });
    
    return Object.values(days);
  }
  
  // Helper to get frequency label based on rating
  const getFrequencyLabel = (rating) => {
    const ratings = {
      '1': 'Extremely Common',
      '2': 'Very Common',
      '3': 'Moderately Common',
      '4': 'Somewhat Uncommon',
      '5': 'Rare/Specialized'
    };
    return ratings[rating] || 'Unknown';
  };
  
  return (
    <div className="flashcard-mode">
      {availableCards.length === 0 ? (
        <div className="flashcard-empty-state">
          <div className="empty-state-icon">📚</div>
          <h2>No Flashcards Yet</h2>
          <p>Click on words in the transcript and select "Add to Flashcards" to create flashcards for study.</p>
        </div>
      ) : showStats ? (
        <div className="stats-container">
          <div className="stats-header">
            <h2>Flashcard Statistics</h2>
            <button 
              className="close-stats-button"
              onClick={() => setShowStats(false)}
            >
              Back to Flashcards
            </button>
          </div>
          
          <div className="stats-summary">
            <div className="stat-card">
              <div className="stat-value">{calculatedStats.totalCards}</div>
              <div className="stat-label">Total Cards</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.cardsReviewed}</div>
              <div className="stat-label">Cards Reviewed</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{calculatedStats.correctPercentage}%</div>
              <div className="stat-label">Accuracy</div>
            </div>
          </div>
          
          <div className="stats-chart">
            <h3>Daily Activity</h3>
            <div className="chart-container">
              {calculatedStats.dayStats.map((day, index) => (
                <div key={index} className="chart-bar-container">
                  <div className="chart-date-label">{formatShortDate(day.date)}</div>
                  <div className="chart-bar-wrapper">
                    <div 
                      className="chart-bar" 
                      style={{ height: `${(day.count / Math.max(...calculatedStats.dayStats.map(d => d.count || 1))) * 100}%` }}
                    >
                      <div 
                        className="chart-bar-correct" 
                        style={{ height: `${day.count > 0 ? (day.correct / day.count) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                  <div className="chart-value-label">{day.count}</div>
                </div>
              ))}
            </div>
            <div className="chart-legend">
              <div className="legend-item">
                <div className="legend-color legend-total"></div>
                <div>Total Reviews</div>
              </div>
              <div className="legend-item">
                <div className="legend-color legend-correct"></div>
                <div>Correct</div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="flashcard-header">
            <button 
              className="flashcard-stats-button" 
              onClick={() => setShowStats(true)}
            >
              View Stats ({stats.cardsReviewed} reviewed)
            </button>
            <div className="card-count">
              <div>Card {currentDueIndex + 1} of {dueCards.length} due</div>
              <div style={{ fontSize: '12px', color: '#999' }}>
                New: {srsStats.new} | Learning: {srsStats.learning} | Review: {srsStats.review}
              </div>
            </div>
          </div>
          
          {/* Get the current due card data */}
          {(() => {
            if (!dueCards.length) return (
              <div className="flashcard-empty-state">
                <div className="empty-state-icon">🎉</div>
                <h2>All Done!</h2>
                <p>You've reviewed all cards due today. Come back tomorrow for more!</p>
                <div style={{ marginTop: '20px', fontSize: '14px', color: '#999' }}>
                  Total cards: {availableCards.length} | Tomorrow: {srsStats.total - srsStats.dueToday} due
                </div>
              </div>
            );
            
            const currentCardData = dueCards[currentDueIndex];
            const currentSenseId = currentCardData?.wordSenseId;
            
            if (!currentCardData) {
              console.warn(`No data found for flashcard with ID: ${currentSenseId}`);
              return null;
            }
            
            // The basic word without the definition number
            const baseWord = currentCardData.word || currentSenseId.replace(/\d+$/, '');
            
            // Get definition number for display
            const defNumber = currentCardData.definitionNumber || 
                             currentSenseId.match(/\d+$/)?.[0] || '';
            // Get interval for display (for example sentences)
            const interval = currentCardData?.srsData?.interval || 1;
            return (
              <div 
                ref={cardContainerRef}
                className={`flashcard-container ${cardAnimation}`}
              >
                <div 
                  className={`flashcard ${isFlipped ? 'flipped' : ''}`}
                  onClick={flipCard}
                >
                  <div className="flashcard-front">
                    <div className="flashcard-content">
                      {currentCardData.exampleSentencesGenerated ? (
                        (() => {
                          // Parse the sentences and translations (English1//NativeLanguage1//English2//NativeLanguage2//etc)
                          const parts = currentCardData.exampleSentencesGenerated.split('//').map(s => s.trim()).filter(s => s.length > 0);
                          
                          // Calculate which sentence to show based on interval (looping after 5)
                          const sentenceIndex = ((interval - 1) % 5) * 2; // *2 because each sentence has English + native language
                          const englishSentence = parts[sentenceIndex] || parts[0] || 'No example available';
                          const nativeTranslation = parts[sentenceIndex + 1] || parts[1] || '';
                          
                          // Create cloze version by replacing ~word~ with _____
                          const clozeSentence = englishSentence.replace(/~[^~]+~/g, '_____');
                          
                          return (
                            <div style={{
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'center',
                              alignItems: 'center',
                              height: '100%',
                              padding: '20px',
                              textAlign: 'center'
                            }}>
                              <div style={{ 
                                fontSize: '22px', 
                                lineHeight: '1.4', 
                                marginBottom: '30px',
                                fontWeight: '500',
                                color: '#fff',
                                maxWidth: '90%'
                              }}>
                                {clozeSentence}
                              </div>
                              {nativeTranslation && (
                                <div style={{ 
                                  fontSize: '18px', 
                                  fontStyle: 'italic',
                                  color: '#a0a0a0',
                                  lineHeight: '1.3',
                                  maxWidth: '85%'
                                }}>
                                  {nativeTranslation}
                                </div>
                              )}
                            </div>
                          );
                        })()
                      ) : (
                        <>
                          <div className="flashcard-word-container">
                            <div className="flashcard-word">
                              {baseWord}
                              {defNumber && <span className="definition-number">({defNumber})</span>}
                            </div>
                          </div>
                          <div className="flashcard-pos">{currentCardData.partOfSpeech || 'verb'}</div>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flashcard-back">
                    <div className="flashcard-content">
                      
                      {/* Display the full sentence with highlighted word */}
                      <div className="flashcard-generated-examples">
                        {currentCardData.exampleSentencesGenerated ? (
                          (() => {
                            // Parse the sentences and translations (English1//NativeLanguage1//English2//NativeLanguage2//etc)
                            const parts = currentCardData.exampleSentencesGenerated.split('//').map(s => s.trim()).filter(s => s.length > 0);
                            
                            // Calculate which sentence to show based on interval (looping after 5)
                            const sentenceIndex = ((interval - 1) % 5) * 2; // *2 because each sentence has English + native language
                            const englishSentence = parts[sentenceIndex] || parts[0] || 'No example available';
                            
                            // Create highlighted version by replacing ~word~ with bold yellow word
                            const highlightedSentence = englishSentence.replace(/~([^~]+)~/g, (match, word) => {
                              return `<span style="font-weight: bold; color: #e3e36b;">${word}</span>`;
                            });
                            
                            const exampleNumber = ((interval - 1) % 5) + 1;
                            
                            return (
                              <div style={{ 
                                backgroundColor: '#2a2a3e', 
                                padding: '15px', 
                                borderRadius: '8px', 
                                marginBottom: '15px',
                                fontSize: '16px',
                                lineHeight: '1.6'
                              }}>
                                <div style={{ 
                                  color: '#e3e36b', 
                                  fontSize: '14px', 
                                  marginBottom: '8px',
                                  fontWeight: 'bold'
                                }}>
                                  Example {exampleNumber}:
                                </div>
                                <div 
                                  dangerouslySetInnerHTML={{ __html: highlightedSentence }}
                                  style={{
                                    fontSize: '18px',
                                    lineHeight: '1.6'
                                  }}
                                />
                              </div>
                            );
                          })()
                        ) : (
                          <div style={{ 
                            color: '#888', 
                            fontStyle: 'italic',
                            textAlign: 'center',
                            marginBottom: '15px'
                          }}>
                            Generating examples...
                          </div>
                        )}
                      </div>
                      
                       {/* SRS Answer buttons */}
                       <div className="answer-feedback-buttons">
                         <button 
                           className="feedback-btn incorrect-btn" 
                           onClick={(e) => {
                             e.stopPropagation(); // Prevent card flip
                             markCard('incorrect');
                           }}
                         >
                           <div>❌ Incorrect</div>
                           <div className="next-review-time">{formatNextReviewTime(calculateNextReview(currentCardData, 'incorrect').nextReviewDate)}</div>
                         </button>
                         <button 
                           className="feedback-btn correct-btn" 
                           onClick={(e) => {
                             e.stopPropagation(); // Prevent card flip
                             markCard('correct');
                           }}
                         >
                           <div>✓ Correct</div>
                           <div className="next-review-time">{formatNextReviewTime(calculateNextReview(currentCardData, 'correct').nextReviewDate)}</div>
                         </button>
                         <button 
                           className="feedback-btn easy-btn" 
                           onClick={(e) => {
                             e.stopPropagation(); // Prevent card flip
                             markCard('easy');
                           }}
                           style={{
                             background: 'linear-gradient(45deg, #4CAF50, #45a049)',
                             marginLeft: '10px'
                           }}
                         >
                           <div>⭐ Easy</div>
                           <div className="next-review-time">{formatNextReviewTime(calculateNextReview(currentCardData, 'easy').nextReviewDate)}</div>
                         </button>
                       </div>
                     </div>
                   </div>
                 </div>
               </div>
             );
           })()}
          
           <div className="flashcard-controls bottom-controls">
             <button className="nav-btn prev-btn" onClick={prevCard}>
               ← Previous
             </button>
             
             <div className="spacer"></div>
             
             <button className="nav-btn next-btn" onClick={nextCard}>
               Next →
             </button>
           </div>
         </>
       )}
     </div>
   );
};

// Helper to format date to short form (e.g., "Mon 5")
function formatShortDate(dateStr) {
  const date = new Date(dateStr);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return `${days[date.getDay()]} ${date.getDate()}`;
}

FlashcardMode.propTypes = {
  selectedWords: PropTypes.arrayOf(PropTypes.string).isRequired,
  wordDefinitions: PropTypes.object.isRequired,
  setWordDefinitions: PropTypes.func.isRequired,
  englishSegments: PropTypes.arrayOf(PropTypes.object),
  targetLanguages: PropTypes.arrayOf(PropTypes.string)
};

export default FlashcardMode;
