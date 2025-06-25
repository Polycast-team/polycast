import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import './FlashcardMode.css';
import MobileProfileSelector from '../mobile/components/MobileProfileSelector.jsx';
import MobileFlashcardMode from '../mobile/components/MobileFlashcardMode.jsx';
import '../mobile/styles/mobile.css';
import '../mobile/styles/mobile-profile.css';
import '../mobile/styles/mobile-flashcards.css';
import { shouldUseMobileApp } from '../utils/deviceDetection.js';
import { useErrorHandler } from '../hooks/useErrorHandler';
import ErrorPopup from './ErrorPopup';

const FlashcardMode = ({ selectedWords, wordDefinitions, setWordDefinitions, englishSegments, targetLanguages, selectedProfile }) => {
  // State for mobile UI mode
  const [currentMode, setCurrentMode] = useState('profile'); // 'profile' or 'flashcards'
  const { error: popupError, showError, clearError } = useErrorHandler();
  const isActuallyMobile = shouldUseMobileApp(); // Detect if we're on an actual mobile device

  // Handle starting study session
  const handleStartStudying = useCallback((profile, flashcards) => {
    console.log(`[FLASHCARD] Starting study session for ${profile} with ${Object.keys(flashcards).length} flashcards`);
    setCurrentMode('flashcards');
  }, []);

  // Handle updating word definitions from flashcard mode
  const handleSetWordDefinitions = useCallback((newDefinitions) => {
    setWordDefinitions(newDefinitions);
    
    // Save to backend if not in non-saving mode
    if (selectedProfile !== 'non-saving') {
      setTimeout(async () => {
        try {
          await fetch(`https://polycast-server.onrender.com/api/profile/${selectedProfile}/words`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              flashcards: newDefinitions,
              selectedWords: Object.keys(newDefinitions)
            })
          });
          console.log(`[FLASHCARD] Saved SRS updates for profile: ${selectedProfile}`);
        } catch (error) {
          console.error('Error saving SRS updates:', error);
          showError(`Failed to save progress for profile "${selectedProfile}". Your study progress may be lost. Please check your connection.`);
        }
      }, 500);
    }
  }, [selectedProfile, showError, setWordDefinitions]);

  // Handle returning to profile selection
  const handleBackToProfile = useCallback(() => {
    setCurrentMode('profile');
  }, []);

  // Handle going back to main app (only for desktop)
  const handleBackToMain = useCallback(() => {
    // This will trigger going back to the main app
    if (window.location) {
      window.location.reload();
    }
  }, []);

  return (
    <div className="mobile-app">
      <div className="mobile-header">
        <h1 className="mobile-title">PolyCast</h1>
        <div className="mobile-subtitle">
          {currentMode === 'profile' ? 'Flashcard Study' : 'Study Session'}
        </div>
      </div>

      <div className="mobile-content">
        {currentMode === 'profile' ? (
          <MobileProfileSelector 
            selectedProfile={selectedProfile}
            onStartStudying={handleStartStudying}
            onBack={!isActuallyMobile ? handleBackToMain : null} // Only show back button on desktop
          />
        ) : currentMode === 'flashcards' ? (
          <MobileFlashcardMode
            selectedProfile={selectedProfile}
            wordDefinitions={wordDefinitions}
            setWordDefinitions={handleSetWordDefinitions}
            onBack={handleBackToProfile}
          />
        ) : null}
      </div>

      {/* Only show footer on actual mobile devices */}
      {isActuallyMobile && (
        <div className="mobile-footer">
          <div className="mobile-footer-text">
            PolyCast Mobile • For full features, use desktop version
          </div>
        </div>
      )}

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