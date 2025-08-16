import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { validateCredentials } from '../../utils/profileLanguageMapping.js';

const MobileLogin = ({ onProfileSelect }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const handleCredentialLogin = (event) => {
    event.preventDefault();
    setLoginError('');
    
    const result = validateCredentials(username, password);
    if (result.ok) {
      onProfileSelect(result.profileKey);
    } else {
      setLoginError(result.error);
    }
  };

  return (
    <div className="mobile-login">
      <div className="mobile-login-content">
        <div className="mobile-login-header">
          <div className="mobile-login-icon">📚</div>
          <h1 className="mobile-login-title">Welcome to PolyCast</h1>
          <p className="mobile-login-subtitle">Enter your credentials to begin</p>
          <div style={{color: 'red', fontSize: '12px', marginTop: '8px'}}>DEBUG: Version 2.0 - Hardcoded Cards</div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleCredentialLogin} className="mobile-login-form" style={{ marginBottom: '20px' }}>
          <label className="mobile-login-label">
            Login:
          </label>
          
          <div style={{ marginBottom: '12px' }}>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mobile-login-select"
              placeholder="Username"
              required
            />
          </div>
          
          <div style={{ marginBottom: '12px' }}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mobile-login-select"
              placeholder="Password"
              required
            />
          </div>
          
          {loginError && (
            <div style={{ 
              color: '#ef4444', 
              fontSize: '12px', 
              marginBottom: '12px',
              padding: '8px',
              backgroundColor: '#2d1b1b',
              borderRadius: '6px',
              border: '1px solid #444'
            }}>
              {loginError}
            </div>
          )}
          
          <button 
            type="submit"
            className="mobile-login-button"
            style={{ marginBottom: '16px' }}
          >
            <span className="mobile-login-button-icon">🔐</span>
            <span className="mobile-login-button-text">Login</span>
          </button>
        </form>


      </div>
    </div>
  );
};

MobileLogin.propTypes = {
  onProfileSelect: PropTypes.func.isRequired
};

export default MobileLogin;