import React, { useState, useEffect } from 'react';
import './styles/mobile.css';

const MobileApp = () => {
  const [selectedProfile, setSelectedProfile] = useState('non-saving');
  const [wordDefinitions, setWordDefinitions] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Available profiles (same as desktop)
  const profiles = [
    { value: 'non-saving', label: 'Non-saving Mode' },
    { value: 'cat', label: 'Cat Profile' },
    { value: 'dog', label: 'Dog Profile' },
    { value: 'mouse', label: 'Mouse Profile' },
    { value: 'horse', label: 'Horse Profile' },
    { value: 'lizard', label: 'Lizard Profile' }
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
        const response = await fetch(`https://polycast-server.onrender.com/api/profile/${selectedProfile}/words`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch profile data: ${response.statusText}`);
        }
        
        const data = await response.json();
        setWordDefinitions(data.flashcards || {});
        
        console.log(`[MOBILE] Loaded ${Object.keys(data.flashcards || {}).length} flashcards for profile: ${selectedProfile}`);
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

  // Count available flashcards
  const flashcardCount = Object.values(wordDefinitions).filter(def => 
    def && def.wordSenseId && def.inFlashcards
  ).length;

  return (
    <div className="mobile-app">
      <div className="mobile-header">
        <h1 className="mobile-title">PolyCast</h1>
        <div className="mobile-subtitle">Mobile Flashcards</div>
      </div>

      <div className="mobile-content">
        {/* Profile Selection */}
        <div className="mobile-profile-section">
          <label className="mobile-label">Select Profile:</label>
          <select 
            className="mobile-profile-select"
            value={selectedProfile}
            onChange={(e) => setSelectedProfile(e.target.value)}
            disabled={isLoading}
          >
            {profiles.map(profile => (
              <option key={profile.value} value={profile.value}>
                {profile.label}
              </option>
            ))}
          </select>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="mobile-loading">
            <div className="mobile-spinner"></div>
            <div>Loading profile...</div>
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
              Retry
            </button>
          </div>
        )}

        {/* Profile Info */}
        {!isLoading && !error && (
          <div className="mobile-profile-info">
            <div className="mobile-profile-card">
              <div className="mobile-profile-name">
                {profiles.find(p => p.value === selectedProfile)?.label}
              </div>
              <div className="mobile-flashcard-count">
                {flashcardCount} flashcard{flashcardCount !== 1 ? 's' : ''} available
              </div>
              
              {flashcardCount > 0 ? (
                <button className="mobile-start-button">
                  Start Studying
                </button>
              ) : (
                <div className="mobile-empty-state">
                  <div className="mobile-empty-icon">📚</div>
                  <div className="mobile-empty-text">
                    No flashcards found for this profile.
                    {selectedProfile === 'non-saving' 
                      ? ' Switch to the desktop version to create flashcards.'
                      : ' Use the desktop version to add words to this profile.'
                    }
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
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