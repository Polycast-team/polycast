import React, { useState, useCallback } from 'react';
import MobileProfileSelector from './components/MobileProfileSelector.jsx';
import MobileFlashcardMode from './components/MobileFlashcardMode.jsx';
import './styles/mobile.css';
import './styles/mobile-login.css';
import './styles/mobile-profile.css';
import './styles/mobile-flashcards.css';

const MobileApp = () => {
  const [currentMode, setCurrentMode] = useState('profile'); // 'profile' or 'flashcards'
  const [selectedProfile, setSelectedProfile] = useState('non-saving');
  const [wordDefinitions, setWordDefinitions] = useState({});


  // Handle starting study session
  const handleStartStudying = useCallback((profile, flashcards) => {
    console.log(`[MOBILE] Starting study session for ${profile} with ${Object.keys(flashcards).length} flashcards`);
    setSelectedProfile(profile);
    setWordDefinitions(flashcards);
    setCurrentMode('flashcards');
  }, []);

  // Handle updating word definitions from flashcard mode
  const handleSetWordDefinitions = (newDefinitions) => {
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
          console.log(`[MOBILE] Saved SRS updates for profile: ${selectedProfile}`);
        } catch (error) {
          console.error('Error saving SRS updates:', error);
          alert(`ERROR: Failed to save progress for profile "${selectedProfile}". Your study progress may be lost. Please check your connection.`);
        }
      }, 500);
    }
  };

  // Handle returning to profile selection
  const handleBackToProfile = () => {
    setCurrentMode('profile');
  };

  return (
    <div className="mobile-app">
      <div className="mobile-header">
        <h1 className="mobile-title">PolyCast</h1>
        <div className="mobile-subtitle">
          {currentMode === 'profile' ? 'Mobile Flashcards' : 'Study Session'}
        </div>
      </div>

      <div className="mobile-content">
        {currentMode === 'profile' ? (
          <MobileProfileSelector 
            selectedProfile={selectedProfile}
            onStartStudying={handleStartStudying}
            onBack={null} // No back button needed since this is now the first screen
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

      {/* Mobile Footer */}
      <div className="mobile-footer">
        <div className="mobile-footer-text">
          PolyCast Mobile • For full features, use desktop version
        </div>
      </div>
    </div>
  );
};

export default MobileApp;