import React, { useState } from 'react';
import MobileProfileSelector from './components/MobileProfileSelector.jsx';
import './styles/mobile.css';
import './styles/mobile-profile.css';

const MobileApp = () => {
  const [currentMode, setCurrentMode] = useState('profile'); // 'profile' or 'flashcards'
  const [selectedProfile, setSelectedProfile] = useState('non-saving');
  const [wordDefinitions, setWordDefinitions] = useState({});

  // Handle profile selection
  const handleProfileSelect = (profile, flashcards) => {
    setSelectedProfile(profile);
    setWordDefinitions(flashcards);
  };

  // Handle starting study session
  const handleStartStudying = (profile, flashcards) => {
    console.log(`[MOBILE] Starting study session for ${profile} with ${Object.keys(flashcards).length} flashcards`);
    setCurrentMode('flashcards');
    // TODO: Phase 3 - Navigate to MobileFlashcardMode
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
            onProfileSelect={handleProfileSelect}
            onStartStudying={handleStartStudying}
          />
        ) : currentMode === 'flashcards' ? (
          <div className="mobile-flashcard-placeholder">
            <div className="mobile-placeholder-content">
              <h2>🚧 Flashcard Mode Coming Soon</h2>
              <p>Phase 3 will add the mobile flashcard interface here.</p>
              <p><strong>Profile:</strong> {selectedProfile}</p>
              <p><strong>Cards:</strong> {Object.keys(wordDefinitions).length}</p>
              <button 
                className="mobile-back-button"
                onClick={handleBackToProfile}
              >
                ← Back to Profiles
              </button>
            </div>
          </div>
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