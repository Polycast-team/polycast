import React, { useState } from 'react';
import PropTypes from 'prop-types';

const MobileLogin = ({ onProfileSelect }) => {
  const [selectedProfile, setSelectedProfile] = useState('non-saving');

  // Available profiles (same as desktop)
  const profiles = [
    { value: 'non-saving', label: 'Non-saving Mode', icon: '🚫' },
    { value: 'cat', label: 'Cat Profile', icon: '🐱' },
    { value: 'dog', label: 'Dog Profile', icon: '🐶' },
    { value: 'mouse', label: 'Mouse Profile', icon: '🐭' },
    { value: 'horse', label: 'Horse Profile', icon: '🐴' },
    { value: 'lizard', label: 'Lizard Profile', icon: '🦎' }
  ];

  const handleLogin = () => {
    onProfileSelect(selectedProfile);
  };

  const selectedProfileData = profiles.find(p => p.value === selectedProfile);

  return (
    <div className="mobile-login">
      <div className="mobile-login-content">
        <div className="mobile-login-header">
          <div className="mobile-login-icon">📚</div>
          <h1 className="mobile-login-title">Welcome to PolyCast</h1>
          <p className="mobile-login-subtitle">Select your study profile to begin</p>
        </div>

        <div className="mobile-login-form">
          <label className="mobile-login-label">
            Choose Your Profile:
          </label>
          
          <div className="mobile-login-dropdown">
            <select 
              className="mobile-login-select"
              value={selectedProfile}
              onChange={(e) => setSelectedProfile(e.target.value)}
            >
              {profiles.map(profile => (
                <option key={profile.value} value={profile.value}>
                  {profile.icon} {profile.label}
                </option>
              ))}
            </select>
          </div>

          <div className="mobile-selected-profile">
            <div className="mobile-selected-icon">{selectedProfileData?.icon}</div>
            <div className="mobile-selected-info">
              <div className="mobile-selected-name">{selectedProfileData?.label}</div>
              <div className="mobile-selected-desc">
                {selectedProfile === 'non-saving' 
                  ? 'Practice mode - progress won\'t be saved'
                  : 'Your personal study profile with saved progress'
                }
              </div>
            </div>
          </div>

          <button 
            className="mobile-login-button"
            onClick={handleLogin}
          >
            <span className="mobile-login-button-icon">🚀</span>
            <span className="mobile-login-button-text">Enter Study Mode</span>
          </button>
        </div>
      </div>
    </div>
  );
};

MobileLogin.propTypes = {
  onProfileSelect: PropTypes.func.isRequired
};

export default MobileLogin;