import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { PROFILE_LANGUAGE_MAP, getLanguageForProfile } from '../utils/profileLanguageMapping.js';

function ProfileSelectorScreen({ onProfileSelected, userRole }) {
    const [selectedProfile, setSelectedProfile] = useState('cat');

    const handleSubmit = (event) => {
        event.preventDefault();
        if (selectedProfile) {
            const language = getLanguageForProfile(selectedProfile);
            // For hosts, return an array of languages; for students, return array with one language
            onProfileSelected([language], selectedProfile);
        } else {
            alert('Please select a profile.');
        }
    };

    const handleProfileSelect = (profile) => {
        setSelectedProfile(profile);
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
                <h2 style={{ color: '#fff', marginBottom: 12 }}>Select Your Profile</h2>
                <p style={{ color: '#b3b3e7', marginBottom: 24, fontSize: 14 }}>
                    Each profile corresponds to a target language
                </p>
                
                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: 24 }}>
                        <div style={{ 
                            display: 'grid', 
                            gridTemplateColumns: 'repeat(2, 1fr)', 
                            gap: 12, 
                            marginBottom: 16 
                        }}>
                            {Object.entries(PROFILE_LANGUAGE_MAP).map(([profile, language]) => (
                                <button
                                    key={profile}
                                    type="button"
                                    onClick={() => handleProfileSelect(profile)}
                                    style={{
                                        padding: '16px 12px',
                                        fontSize: 14,
                                        borderRadius: 8,
                                        border: selectedProfile === profile ? '2px solid #10b981' : '1px solid #444',
                                        background: selectedProfile === profile ? '#10b981' : '#444',
                                        color: '#fff',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: 4
                                    }}
                                >
                                    <div style={{ fontWeight: 'bold', textTransform: 'capitalize' }}>
                                        {profile}
                                    </div>
                                    <div style={{ fontSize: 12, opacity: 0.8 }}>
                                        {language}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                    
                    <button 
                        type="submit"
                        style={{ 
                            padding: '12px 32px', 
                            fontSize: 18, 
                            fontWeight: 700, 
                            borderRadius: 8, 
                            background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)', 
                            color: '#fff', 
                            border: 'none', 
                            cursor: 'pointer',
                            width: '100%'
                        }}
                    >
                        Continue
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