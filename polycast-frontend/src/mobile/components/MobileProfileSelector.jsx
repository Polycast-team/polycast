import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

const MobileProfileSelector = ({ onProfileSelect, onStartStudying }) => {
  const [selectedProfile, setSelectedProfile] = useState('non-saving');
  const [wordDefinitions, setWordDefinitions] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

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
        onProfileSelect(selectedProfile, {});
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
        const flashcards = data.flashcards || {};
        
        setWordDefinitions(flashcards);
        onProfileSelect(selectedProfile, flashcards);
        
        console.log(`[MOBILE] Loaded ${Object.keys(flashcards).length} flashcards for profile: ${selectedProfile}`);
      } catch (err) {
        console.error(`Error fetching profile data for ${selectedProfile}:`, err);
        setError(`Failed to load profile: ${err.message}`);
        setWordDefinitions({});
        onProfileSelect(selectedProfile, {});
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfileData();
  }, [selectedProfile, onProfileSelect]);

  // Count available flashcards
  const flashcardCount = Object.values(wordDefinitions).filter(def => 
    def && def.wordSenseId && def.inFlashcards
  ).length;

  const selectedProfileData = profiles.find(p => p.value === selectedProfile);

  const handleStartStudying = () => {
    if (flashcardCount > 0) {
      onStartStudying(selectedProfile, wordDefinitions);
    }
  };

  return (
    <div className="mobile-profile-selector">
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
                    {Object.values(wordDefinitions).filter(def => 
                      def && def.srsData && def.srsData.status === 'new'
                    ).length}
                  </div>
                  <div className="mobile-stat-label">New</div>
                </div>
                <div className="mobile-stat">
                  <div className="mobile-stat-number">
                    {Object.values(wordDefinitions).filter(def => 
                      def && def.srsData && (def.srsData.status === 'learning' || def.srsData.status === 'review')
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
    </div>
  );
};

MobileProfileSelector.propTypes = {
  onProfileSelect: PropTypes.func.isRequired,
  onStartStudying: PropTypes.func.isRequired
};

export default MobileProfileSelector;