import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { PROFILE_LANGUAGE_MAP, getLanguageForProfile, validateCredentials } from '../utils/profileLanguageMapping.js';

function ProfileSelectorScreen({ onProfileSelected, userRole }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loginError, setLoginError] = useState('');

    const handleLogin = (event) => {
        event.preventDefault();
        setLoginError('');
        
        const result = validateCredentials(username, password);
        if (result.ok) {
            const language = getLanguageForProfile(result.profileKey);
            onProfileSelected([language], result.profileKey);
        } else {
            setLoginError(result.error);
        }
    };

    return (
        <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            minHeight: '100vh', 
            background: '#23243a',
            padding: '20px'
        }}>
            <div style={{ 
                background: '#23243a', 
                borderRadius: 16, 
                boxShadow: '0 4px 18px 0 rgba(60, 60, 90, 0.09)', 
                padding: 36, 
                minWidth: 400, 
                maxWidth: 500, 
                textAlign: 'center' 
            }}>
                <h2 style={{ color: '#fff', marginBottom: 12 }}>Welcome to PolyCast</h2>
                
                {/* Login Form */}
                <form onSubmit={handleLogin} style={{ marginBottom: 32 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 500, marginBottom: 16, color: '#fff' }}>
                        Login
                    </h3>
                    
                    <div style={{ marginBottom: 16 }}>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '12px',
                                fontSize: 14,
                                borderRadius: 8,
                                border: '1px solid #444',
                                background: '#333',
                                color: '#fff',
                                outline: 'none',
                                boxSizing: 'border-box'
                            }}
                            placeholder="Username"
                            required
                        />
                    </div>
                    
                    <div style={{ marginBottom: 16 }}>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '12px',
                                fontSize: 14,
                                borderRadius: 8,
                                border: '1px solid #444',
                                background: '#333',
                                color: '#fff',
                                outline: 'none',
                                boxSizing: 'border-box'
                            }}
                            placeholder="Password"
                            required
                        />
                    </div>
                    
                    {loginError && (
                        <div style={{ 
                            color: '#ef4444', 
                            fontSize: 12, 
                            marginBottom: 16,
                            padding: '8px',
                            backgroundColor: '#2d1b1b',
                            borderRadius: 6,
                            border: '1px solid #444'
                        }}>
                            {loginError}
                        </div>
                    )}
                    
                    <button 
                        type="submit"
                        style={{ 
                            padding: '12px 24px', 
                            fontSize: 16, 
                            fontWeight: 600, 
                            borderRadius: 8, 
                            background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)', 
                            color: '#fff', 
                            border: 'none', 
                            cursor: 'pointer',
                            width: '100%',
                            marginBottom: 16
                        }}
                    >
                        Login
                    </button>
                </form>
                

            </div>
        </div>
    );
}

ProfileSelectorScreen.propTypes = {
    onProfileSelected: PropTypes.func.isRequired,
    userRole: PropTypes.string.isRequired,
};

export default ProfileSelectorScreen;