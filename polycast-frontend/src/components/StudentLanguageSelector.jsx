import React, { useState } from 'react';
import PropTypes from 'prop-types';

function StudentLanguageSelector({ onLanguageSelected }) {
    const [selectedLanguage, setSelectedLanguage] = useState('');

    // Common languages for quick selection
    const commonLanguages = [
        'Spanish', 'French', 'German', 'Italian', 'Portuguese', 
        'Chinese', 'Japanese', 'Korean', 'Arabic', 'Russian',
        'Hindi', 'Dutch', 'Swedish', 'Norwegian', 'Polish'
    ];

    const handleSubmit = (event) => {
        event.preventDefault();
        if (selectedLanguage.trim()) {
            onLanguageSelected([selectedLanguage.trim()]);
        } else {
            alert('Please select or enter your home language.');
        }
    };

    const handleQuickSelect = (language) => {
        setSelectedLanguage(language);
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
                <h2 style={{ color: '#fff', marginBottom: 12 }}>Select Your Home Language</h2>
                <p style={{ color: '#b3b3e7', marginBottom: 24, fontSize: 14 }}>
                    This will be used for your flashcards and translations
                </p>
                
                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: 24 }}>
                        <label style={{ color: '#fff', display: 'block', marginBottom: 8 }}>
                            Quick Select:
                        </label>
                        <div style={{ 
                            display: 'grid', 
                            gridTemplateColumns: 'repeat(3, 1fr)', 
                            gap: 8, 
                            marginBottom: 16 
                        }}>
                            {commonLanguages.slice(0, 12).map(lang => (
                                <button
                                    key={lang}
                                    type="button"
                                    onClick={() => handleQuickSelect(lang)}
                                    style={{
                                        padding: '8px 12px',
                                        fontSize: 12,
                                        borderRadius: 4,
                                        border: selectedLanguage === lang ? '2px solid #10b981' : '1px solid #444',
                                        background: selectedLanguage === lang ? '#10b981' : '#444',
                                        color: '#fff',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {lang}
                                </button>
                            ))}
                        </div>
                    </div>
                    
                    <div style={{ marginBottom: 24 }}>
                        <label style={{ color: '#fff', display: 'block', marginBottom: 8 }}>
                            Or type your language:
                        </label>
                        <input
                            type="text"
                            value={selectedLanguage}
                            onChange={(e) => setSelectedLanguage(e.target.value)}
                            placeholder="Enter your home language..."
                            style={{
                                width: '100%',
                                padding: '12px',
                                fontSize: 16,
                                borderRadius: 4,
                                border: '1px solid #444',
                                background: '#fff',
                                color: '#000',
                                boxSizing: 'border-box'
                            }}
                            required
                        />
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

StudentLanguageSelector.propTypes = {
    onLanguageSelected: PropTypes.func.isRequired,
};

export default StudentLanguageSelector;