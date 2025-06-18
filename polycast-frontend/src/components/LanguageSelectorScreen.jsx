import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';

function LanguageSelectorScreen({ onLanguageSelected }) {
    const [numLanguages, setNumLanguages] = useState(1); // Default to 1 language
    // Initialize languages array based on numLanguages
    const [languages, setLanguages] = useState(Array(1).fill('')); 

    const handleNumChange = (event) => {
        const count = parseInt(event.target.value, 10) || 0;
        const newCount = Math.max(0, Math.min(4, count)); // Clamp between 0 and 4
        setNumLanguages(newCount);
        // Adjust the languages array size, preserving existing values
        setLanguages(prevLangs => {
            const newLangs = Array(newCount).fill('');
            for (let i = 0; i < Math.min(prevLangs.length, newCount); i++) {
                newLangs[i] = prevLangs[i] || ''; // Keep existing values
            }
            return newLangs;
        });
    };

    const handleLanguageChange = (index, event) => {
        const newLanguages = [...languages];
        newLanguages[index] = event.target.value;
        setLanguages(newLanguages);
    };

    const handleSubmit = (event) => {
        event.preventDefault();
        const validLanguages = languages.map(lang => lang.trim()).filter(lang => lang !== '');
        if (numLanguages === 0) {
            // Host selected 0 languages - just English transcript
            onLanguageSelected([]);
        } else if (validLanguages.length === numLanguages) {
            onLanguageSelected(validLanguages);
        } else {
            alert('Please fill in all target language fields.');
        }
    };

    return (
        <div className="language-selector-screen">
            <h1>Polycast Setup</h1>
            <form onSubmit={handleSubmit}>
                <div>
                    <label htmlFor="num-languages">Number of Display Languages (0-4): </label>
                    <input 
                        type="number"
                        id="num-languages"
                        value={numLanguages}
                        onChange={handleNumChange}
                        min="0"
                        max="4"
                    />
                </div>

                {languages.map((lang, index) => (
                    <div key={index}>
                        <label htmlFor={`language-input-${index}`}>Display Language {index + 1}:</label>
                        <input 
                            type="text"
                            id={`language-input-${index}`}
                            value={lang}
                            onChange={(e) => handleLanguageChange(index, e)}
                            placeholder={`Enter language ${index + 1}...`}
                            required // Ensure fields are filled
                        />
                    </div>
                ))}
                
                <button type="submit">Start Session</button>
            </form>
            <style>{`
                .language-selector-screen {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 100vh;
                    font-family: sans-serif;
                }
                .language-selector-screen form {
                    display: flex;
                    flex-direction: column;
                    gap: 15px; /* Increased gap */
                    align-items: stretch; /* Align items stretch */
                    min-width: 300px; /* Wider form */
                }
                .language-selector-screen form div {
                     display: flex; /* Use flex for label/input pairs */
                     justify-content: space-between; /* Space label and input */
                     align-items: center; /* Align items vertically */
                     gap: 10px;
                 }
                 .language-selector-screen label {
                      white-space: nowrap; /* Prevent label wrapping */
                 }
                 .language-selector-screen input {
                     padding: 8px;
                     font-size: 1rem;
                     flex-grow: 1; /* Allow input to grow */
                 }
                .language-selector-screen input[type="number"] {
                     flex-grow: 0; /* Don't grow number input */
                     width: 50px;
                 }
                .language-selector-screen button {
                    padding: 10px 20px;
                    font-size: 1rem;
                    cursor: pointer;
                    margin-top: 10px; /* Add margin above button */
                    align-self: center; /* Center button */
                }
            `}</style>
        </div>
    );
}

LanguageSelectorScreen.propTypes = {
    onLanguageSelected: PropTypes.func.isRequired,
};

export default LanguageSelectorScreen; 