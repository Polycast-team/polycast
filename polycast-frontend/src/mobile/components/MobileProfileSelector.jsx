import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { getHardcodedCards } from '../../utils/hardcodedCards';
import { categorizeCards, getDueSeenCards } from '../../utils/cardSorting';
import { getSRSSettings } from '../../utils/srsSettings';

const MobileProfileSelector = ({ selectedProfile: initialProfile, onStartStudying, onBack }) => {
  const [selectedProfile, setSelectedProfile] = useState(initialProfile || 'non-saving');
  const [wordDefinitions, setWordDefinitions] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showNewCards, setShowNewCards] = useState(false);
  const [showDueCards, setShowDueCards] = useState(false);

  // Available profiles (same as desktop)
  const profiles = [
    { value: 'non-saving', label: 'Non-saving Mode', icon: '🚫' },
    { value: 'cat', label: 'Cat Profile', icon: '🐱' },
    { value: 'dog', label: 'Dog Profile', icon: '🐶' },
    { value: 'mouse', label: 'Mouse Profile', icon: '🐭' },
    { value: 'horse', label: 'Horse Profile', icon: '🐴' },
    { value: 'lizard', label: 'Lizard Profile', icon: '🦎' }
  ];

  // Fetch profile data when profile changes
  useEffect(() => {
    const fetchProfileData = async () => {
      if (selectedProfile === 'non-saving') {
        setWordDefinitions({});
        return;
      }

      setIsLoading(true);
      setError('');
      
      try {
        console.log(`[MOBILE] Fetching data for profile: ${selectedProfile}`);
        const response = await fetch(`https://polycast-server.onrender.com/api/profile/${selectedProfile}/words`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch profile data: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!data || typeof data !== 'object') {
          throw new Error('Invalid response format from server');
        }
        
        if (!data.flashcards || typeof data.flashcards !== 'object') {
          throw new Error('No flashcards data received from server');
        }
        
        const flashcards = data.flashcards;
        setWordDefinitions(flashcards);
        
        console.log(`[MOBILE] Loaded ${Object.keys(flashcards).length} flashcards for profile: ${selectedProfile}`);
      } catch (err) {
        console.error(`Error fetching profile data for ${selectedProfile}:`, err);
        setError(`Failed to load profile: ${err.message}`);
        setWordDefinitions({});
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfileData();
  }, [selectedProfile]);

  // Get available cards for profile selector (initial state)
  const getAvailableCards = () => {
    if (selectedProfile === 'non-saving') {
      // For profile selector, show initial state (all cards as new)
      // Filter out test cards that are already in learning state
      return getHardcodedCards().filter(card => card.srsData.isNew);
    }
    
    const cards = [];
    Object.entries(wordDefinitions).forEach(([key, value]) => {
      if (value && value.wordSenseId && value.inFlashcards) {
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
            nextReviewDate: new Date().toISOString()
          };
        }
        cards.push(cardWithSRS);
      }
    });
    return cards;
  };

  // Get categorized cards for display
  const getCategorizedCards = () => {
    const allCards = getAvailableCards();
    const { seenCards, newCards } = categorizeCards(allCards);
    
    // For preview, show ALL seen cards (both due and future), not just currently due ones
    // This lets users see the full order they'll encounter
    const allSeenCardsSorted = seenCards; // Already sorted by due date in categorizeCards
    
    return { newCards, dueCards: allSeenCardsSorted, seenCards };
  };

  // Count available flashcards
  const availableCards = getAvailableCards();
  const flashcardCount = availableCards.length;

  const selectedProfileData = profiles.find(p => p.value === selectedProfile);

  const handleStartStudying = () => {
    if (flashcardCount > 0) {
      // For non-saving mode, pass empty wordDefinitions since hardcoded cards are created in flashcard mode
      const dataToPass = selectedProfile === 'non-saving' ? {} : wordDefinitions;
      onStartStudying(selectedProfile, dataToPass);
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = date - now;
    
    if (diffMs <= 0) return 'Due now';
    
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    if (diffDays === 0) {
      const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
      if (diffHours === 0) {
        const diffMins = Math.floor(diffMs / (60 * 1000));
        return `${diffMins}m`;
      }
      return `${diffHours}h`;
    }
    return `${diffDays}d`;
  };

  // Calculate when a new card will be introduced based on its position in queue
  const getIntroductionDate = (cardIndex) => {
    const srsSettings = getSRSSettings();
    const newCardsPerDay = srsSettings.newCardsPerDay || 5;
    const daysFromToday = Math.floor(cardIndex / newCardsPerDay);
    const today = new Date();
    const introDate = new Date(today);
    introDate.setDate(today.getDate() + daysFromToday);
    
    if (daysFromToday === 0) return 'Today';
    if (daysFromToday === 1) return 'Tomorrow';
    
    // Format as "Mon 6/24" 
    const options = { weekday: 'short', month: 'numeric', day: 'numeric' };
    return introDate.toLocaleDateString('en-US', options);
  };

  // Card list component
  const CardList = ({ cards, title, type }) => (
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
        maxWidth: '90vw',
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
          <h3 style={{ margin: 0, fontSize: '18px', color: '#333' }}>{title}</h3>
          <button 
            onClick={() => {
              setShowNewCards(false);
              setShowDueCards(false);
            }}
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
          {cards.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
              No {type} cards
            </div>
          ) : (
            cards.map((card, index) => (
              <div key={card.key || card.wordSenseId || index} style={{
                padding: '12px 15px',
                margin: '5px 0',
                backgroundColor: '#f8f9fa',
                borderRadius: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '16px', color: '#333' }}>
                    {card.word}
                  </div>
                  <div style={{ fontSize: '14px', color: '#666', marginTop: '2px' }}>
                    {card.definition || 'No definition'}
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontSize: '12px', color: '#888' }}>
                  {type === 'new' ? (
                    <div>
                      <div>Freq: {card.frequency || 5}</div>
                      <div style={{ marginTop: '2px', fontWeight: 'bold', color: '#2196f3' }}>
                        {getIntroductionDate(index)}
                      </div>
                      <div style={{ marginTop: '1px' }}>#{index + 1}</div>
                    </div>
                  ) : (
                    <div>
                      <div>Due: {formatDate(card.srsData?.dueDate || card.srsData?.nextReviewDate)}</div>
                      <div style={{ marginTop: '2px' }}>#{index + 1}</div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="mobile-profile-selector">
      {/* Back Button */}
      <div className="mobile-profile-back">
        <button className="mobile-back-btn" onClick={onBack}>
          ← Change Profile
        </button>
      </div>

      {/* Profile Selection */}
      <div className="mobile-profile-section">
        <label className="mobile-label">
          📚 Select Your Study Profile:
        </label>
        <div className="mobile-profile-dropdown">
          <select 
            className="mobile-profile-select"
            value={selectedProfile}
            onChange={(e) => setSelectedProfile(e.target.value)}
            disabled={isLoading}
          >
            {profiles.map(profile => (
              <option key={profile.value} value={profile.value}>
                {profile.icon} {profile.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="mobile-loading">
          <div className="mobile-spinner"></div>
          <div className="mobile-loading-text">Loading {selectedProfile} profile...</div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="mobile-error">
          <div className="mobile-error-icon">⚠️</div>
          <div className="mobile-error-text">{error}</div>
          <button 
            className="mobile-retry-button"
            onClick={() => setSelectedProfile(selectedProfile)}
          >
            Retry Loading
          </button>
        </div>
      )}

      {/* Profile Info Card */}
      {!isLoading && !error && (
        <div className="mobile-profile-card">
          <div className="mobile-profile-header">
            <div className="mobile-profile-icon">
              {selectedProfileData?.icon}
            </div>
            <div className="mobile-profile-info">
              <div className="mobile-profile-name">
                {selectedProfileData?.label}
              </div>
              <div className="mobile-flashcard-count">
                {flashcardCount} flashcard{flashcardCount !== 1 ? 's' : ''} available
                {selectedProfile === 'non-saving' && <span style={{color: 'red', fontSize: '10px'}}> (HC)</span>}
              </div>
            </div>
          </div>
          
          {flashcardCount > 0 ? (
            <div className="mobile-profile-actions">
              <div className="mobile-profile-stats">
                <div className="mobile-stat">
                  <div className="mobile-stat-number">{flashcardCount}</div>
                  <div className="mobile-stat-label">Cards</div>
                </div>
                <div className="mobile-stat">
                  <div className="mobile-stat-number">
                    {availableCards.filter(card => 
                      card && card.srsData && card.srsData.isNew
                    ).length}
                  </div>
                  <div className="mobile-stat-label">New</div>
                </div>
                <div className="mobile-stat">
                  <div className="mobile-stat-number">
                    {availableCards.filter(card => 
                      card && card.srsData && !card.srsData.isNew
                    ).length}
                  </div>
                  <div className="mobile-stat-label">Due</div>
                </div>
              </div>
              
              <button 
                className="mobile-start-button"
                onClick={handleStartStudying}
              >
                <div className="mobile-start-button-content">
                  <span className="mobile-start-icon">🚀</span>
                  <span className="mobile-start-text">Start Studying</span>
                </div>
              </button>
              
              {/* Card Order Buttons */}
              <div style={{ 
                display: 'flex', 
                gap: '10px', 
                marginTop: '15px',
                justifyContent: 'space-between'
              }}>
                <button 
                  onClick={() => setShowNewCards(true)}
                  style={{
                    flex: 1,
                    padding: '12px 8px',
                    backgroundColor: '#e3f2fd',
                    border: '1px solid #2196f3',
                    borderRadius: '8px',
                    color: '#1976d2',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <span>📝</span>
                  <span>New Cards Order</span>
                </button>
                
                <button 
                  onClick={() => setShowDueCards(true)}
                  style={{
                    flex: 1,
                    padding: '12px 8px',
                    backgroundColor: '#fff3e0',
                    border: '1px solid #ff9800',
                    borderRadius: '8px',
                    color: '#f57c00',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <span>⏰</span>
                  <span>Review Cards Order</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="mobile-empty-state">
              <div className="mobile-empty-icon">📖</div>
              <div className="mobile-empty-title">No Flashcards Available</div>
              <div className="mobile-empty-text">
                {selectedProfile === 'non-saving' 
                  ? 'Switch to the desktop version to create flashcards, then return here to study.'
                  : `No flashcards found in the ${selectedProfile} profile. Use the desktop version to add words and create your study deck.`
                }
              </div>
              {selectedProfile !== 'non-saving' && (
                <div className="mobile-empty-suggestion">
                  💡 Try switching profiles or adding words on desktop first.
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* Card List Modals */}
      {showNewCards && (() => {
        const { newCards } = getCategorizedCards();
        return (
          <CardList 
            cards={newCards} 
            title={`New Cards (${newCards.length}) - Sorted by Frequency`}
            type="new"
          />
        );
      })()}
      
      {showDueCards && (() => {
        const { dueCards } = getCategorizedCards();
        return (
          <CardList 
            cards={dueCards} 
            title={`Review Cards (${dueCards.length}) - Sorted by Due Date`}
            type="due"
          />
        );
      })()}
    </div>
  );
};

MobileProfileSelector.propTypes = {
  selectedProfile: PropTypes.string,
  onStartStudying: PropTypes.func.isRequired,
  onBack: PropTypes.func.isRequired
};

export default MobileProfileSelector;