import React, { useState, useCallback } from 'react';
import MobileProfileSelector from './components/MobileProfileSelector.jsx';
import MobileFlashcardMode from './components/MobileFlashcardMode.jsx';
import ErrorPopup from '../components/ErrorPopup';
import { useErrorHandler } from '../hooks/useErrorHandler';
import './styles/mobile.css';
import './styles/mobile-login.css';
import './styles/mobile-profile.css';
import './styles/mobile-flashcards.css';

// Role Selection Component
const MobileRoleSelector = ({ onRoleSelected }) => {
  return (
    <div className="mobile-role-selector">
      <div className="mobile-role-section">
        <h2 style={{ 
          textAlign: 'center', 
          color: '#fff', 
          marginBottom: '24px',
          fontSize: '1.5rem'
        }}>
          Choose Your Role
        </h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <button 
            onClick={() => onRoleSelected('host')}
            style={{
              padding: '16px 32px',
              fontSize: '18px',
              fontWeight: '700',
              borderRadius: '8px',
              background: 'linear-gradient(90deg, #5f72ff 0%, #9a5cff 100%)',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              width: '100%',
              minHeight: '60px'
            }}
          >
            Host
          </button>
          
          <div style={{ 
            textAlign: 'center', 
            color: '#b3b3e7', 
            fontWeight: '600',
            margin: '8px 0'
          }}>
            or
          </div>
          
          <button 
            onClick={() => onRoleSelected('student')}
            style={{
              padding: '16px 32px',
              fontSize: '18px',
              fontWeight: '700',
              borderRadius: '8px',
              background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              width: '100%',
              minHeight: '60px'
            }}
          >
            Student
          </button>
        </div>
        
        <div style={{ 
          marginTop: '20px', 
          textAlign: 'center', 
          color: '#888',
          fontSize: '14px',
          lineHeight: '1.4'
        }}>
          <div>📱 Mobile mode is optimized for flashcard study</div>
          <div>💻 Use desktop for hosting sessions</div>
        </div>
      </div>
    </div>
  );
};

const MobileApp = () => {
  const [currentMode, setCurrentMode] = useState('role-selection'); // 'role-selection', 'profile', or 'flashcards'
  const [selectedProfile, setSelectedProfile] = useState('joshua');
  const [wordDefinitions, setWordDefinitions] = useState({});
  const { error: popupError, showError, clearError } = useErrorHandler();


  // Handle starting study session
  const handleStartStudying = useCallback((profile, flashcards) => {
    console.log(`[MOBILE] Starting study session for ${profile} with ${Object.keys(flashcards).length} flashcards`);
    setSelectedProfile(profile);
    setWordDefinitions(flashcards);
    setCurrentMode('flashcards');
  }, []);

  // Handle updating word definitions from flashcard mode
  const handleSetWordDefinitions = useCallback((newDefinitions) => {
    setWordDefinitions(newDefinitions);
    
    // Backend persistence disabled; local-only for now. Re-enable for Firebase later.
  }, [selectedProfile, showError]);

  // Handle role selection (Host or Student)
  const handleRoleSelection = useCallback((role) => {
    console.log(`[MOBILE] Selected role: ${role}`);
    if (role === 'student') {
      setCurrentMode('profile');
    } else {
      // For hosts, show a message that mobile mode is for flashcards only
      showError('Mobile mode is designed for flashcard study. Please use the desktop version to host sessions.');
    }
  }, [showError]);

  // Handle returning to role selection
  const handleBackToRoles = useCallback(() => {
    setCurrentMode('role-selection');
  }, []);

  // Handle returning to profile selection
  const handleBackToProfile = useCallback(() => {
    setCurrentMode('profile');
  }, []);

  return (
    <div className="mobile-app">
      <div className="mobile-header">
        <h1 className="mobile-title">PolyCast</h1>
        <div className="mobile-subtitle">
          {currentMode === 'role-selection' ? 'Welcome' : 
           currentMode === 'profile' ? 'Mobile Flashcards' : 'Study Session'}
        </div>
      </div>

      <div className="mobile-content">
        {currentMode === 'role-selection' ? (
          <MobileRoleSelector onRoleSelected={handleRoleSelection} />
        ) : currentMode === 'profile' ? (
          <MobileProfileSelector 
            selectedProfile={selectedProfile}
            onStartStudying={handleStartStudying}
            onBack={handleBackToRoles}
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

      {/* Error Popup */}
      <ErrorPopup error={popupError} onClose={clearError} />
    </div>
  );
};

export default MobileApp;