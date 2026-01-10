import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import './WordDefinitionPopup.css';

const WordDefinitionPopup = ({ word, definition, dictDefinition, disambiguatedDefinition, position, onClose, onAddToDictionary, onRemoveFromDictionary, isInDictionary, loading, nativeLanguage = 'English' }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  // Add local state to track when a word is added, so we can show checkmark immediately
  const [localAdded, setLocalAdded] = useState(false);
  // Create ref for popup container
  const popupRef = useRef(null);

  // Handle click outside to close the popup
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (popupRef.current && !popupRef.current.contains(event.target)) {
        onClose();
      }
    };

    // Add event listener
    document.addEventListener('mousedown', handleClickOutside);
    
    // Clean up the event listener on component unmount
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  if (!word) return null;

  // Use either external or local state to determine if word is in dictionary
  const isWordInDictionary = isInDictionary || localAdded;
  
  // Ensure definition data exists and handle all possible dictionary response formats
  const partOfSpeech = definition?.partOfSpeech || 
                        (definition?.meanings && definition.meanings[0] && definition.meanings[0].partOfSpeech) ||
                        disambiguatedDefinition?.partOfSpeech ||
                        '';
  
  const fullDefinition = definition?.definition ||
                         (definition?.meanings && definition.meanings[0] && definition.meanings[0].definition) ||
                         '';
  
  const examples = definition?.examples || [];
  
  // Look for translations in multiple possible locations in the API response
  const translation = definition?.translation || 
                     (definition?.translations && definition.translations[nativeLanguage.toLowerCase()]) ||
                     (definition?.translations && definition.translations[nativeLanguage]) ||
                     '';
  
  // Get the contextual explanation from the API response (in target language)
  // Check for both contextualExplanation (old format) and definition (quick API format)
  const contextualExplanation = definition?.contextualExplanation ||
                               definition?.definition ||
                               disambiguatedDefinition?.contextualExplanation ||
                               '';
  
  // Format dictionary definition - prefer disambiguated definition if available
  let dictPartOfSpeech = '';
  let dictFullDefinition = '';
  let allDefinitions = [];
  
  if (disambiguatedDefinition) {
    // Use the disambiguated definition from Gemini
    dictPartOfSpeech = disambiguatedDefinition.partOfSpeech || '';
    dictFullDefinition = disambiguatedDefinition.definition || '';
  } else if (dictDefinition) {
    // If we have dictionary data but no disambiguated definition yet,
    // check if it has allDefinitions property (new format)
    if (dictDefinition.allDefinitions && dictDefinition.allDefinitions.length > 0) {
      // Use the first definition
      const firstDef = dictDefinition.allDefinitions[0];
      dictPartOfSpeech = firstDef.partOfSpeech || '';
      dictFullDefinition = firstDef.definition || '';
      allDefinitions = dictDefinition.allDefinitions;
    } 
    // Legacy format support
    else if (dictDefinition.rawData && dictDefinition.rawData.MEANINGS) {
      // Get the first meaning key
      const firstMeaningKey = Object.keys(dictDefinition.rawData.MEANINGS || {})[0];
      if (firstMeaningKey) {
        const meaning = dictDefinition.rawData.MEANINGS[firstMeaningKey];
        dictPartOfSpeech = meaning[0] || ''; // First element is part of speech
        dictFullDefinition = meaning[1] || ''; // Second element is definition
      }
    }
  }
  
  // Calculate positioning to be right next to the clicked word
  const viewportWidth = window.innerWidth;
  const popupWidth = 380; // Match width from CSS
  
  // Calculate optimal position to avoid going off screen
  const spaceOnRight = viewportWidth - position.x;
  const fitsOnRight = spaceOnRight >= popupWidth + 10;
  
  // Position to the right if there's room, otherwise to the left
  const xPos = fitsOnRight ? position.x + 5 : position.x - popupWidth - 5;
  
  // Calculate vertical position - ensure popup is positioned lower in the viewport
  // to avoid tooltip being cut off at the top
  const viewportHeight = window.innerHeight;
  const popupHeight = 300; // Approximate height
  const yPos = Math.min(position.y + 60, viewportHeight - popupHeight - 10);
  const finalLeft = Math.max(5, Math.min(viewportWidth - popupWidth - 5, xPos));

  return (
    <div
      ref={popupRef}
      className="word-definition-popup"
      style={{
        top: `${yPos}px`,
        left: `${finalLeft}px`,
      }}
    >
      {/* Close button */}
      <button className="popup-close-btn" onClick={onClose}>×</button>
      
      <div className="dict-content">
        {loading ? (
          <div className="dict-loading">
            <div className="dict-loading-spinner"></div>
            <div className="dict-loading-text">Finding the right definition...</div>
          </div>
        ) : (
          <>
            <div className="dict-english-side">
              <div className="dict-word-row">
                <div className="dict-word-display">{word}</div>
                {!isWordInDictionary && (
                  <>
                    <div 
                      className="dict-add-btn"
                      onClick={() => {
                        // Immediately update local state to show checkmark
                        setLocalAdded(true);
                        // Call the external handler
                        onAddToDictionary && onAddToDictionary(word);
                      }}
                      onMouseEnter={() => setShowTooltip(true)}
                      onMouseLeave={() => setShowTooltip(false)}
                    >
                      +
                    </div>
                    {showTooltip && (
                      <div className="dict-tooltip-container">
                        <div className="dict-tooltip">Add to Dictionary</div>
                      </div>
                    )}
                  </>
                )}
                {isWordInDictionary && (
                  <div 
                    className="dict-added-indicator dict-remove-btn"
                    onClick={() => {
                      // Call handler to remove from dictionary
                      setLocalAdded(false);
                      onRemoveFromDictionary && onRemoveFromDictionary(word);
                    }}
                    onMouseEnter={() => setShowTooltip(true)}
                    onMouseLeave={() => setShowTooltip(false)}
                    >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    {showTooltip && (
                      <div className="dict-tooltip-container">
                        <div className="dict-tooltip">Remove from Dictionary</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {partOfSpeech && (
                <div className="dict-part-of-speech">{partOfSpeech}</div>
              )}
              {dictPartOfSpeech && dictPartOfSpeech !== partOfSpeech && (
                <div className="dict-part-of-speech dict-local">{dictPartOfSpeech}</div>
              )}
            </div>
            
            <div className="dict-spanish-side">
              {translation && (
                <div className="dict-translation">{translation}</div>
              )}
              
              {contextualExplanation && (
                <div className="dict-section">
                  <div className="dict-section-title">
                    {nativeLanguage === 'Chinese' ? '语境含义' : 
                     nativeLanguage === 'Spanish' ? 'Significado en contexto' :
                     nativeLanguage === 'French' ? 'Sens en contexte' :
                     nativeLanguage === 'German' ? 'Bedeutung im Kontext' :
                     nativeLanguage === 'Italian' ? 'Significato nel contesto' :
                     nativeLanguage === 'Portuguese' ? 'Significado no contexto' :
                     'Contextual Meaning'}
                  </div>
                  <div className="dict-full-definition dict-local">{contextualExplanation}</div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};


WordDefinitionPopup.propTypes = {
  word: PropTypes.string,
  definition: PropTypes.object,
  dictDefinition: PropTypes.object,
  disambiguatedDefinition: PropTypes.object,
  position: PropTypes.shape({
    x: PropTypes.number.isRequired,
    y: PropTypes.number.isRequired
  }).isRequired,
  onClose: PropTypes.func.isRequired,
  onAddToDictionary: PropTypes.func,
  onRemoveFromDictionary: PropTypes.func,
  isInDictionary: PropTypes.bool,
  loading: PropTypes.bool,
  nativeLanguage: PropTypes.string
};

WordDefinitionPopup.defaultProps = {
  isInDictionary: false,
  onAddToDictionary: () => console.log('Default onAddToDictionary called - no handler provided'),
  onRemoveFromDictionary: () => console.log('Default onRemoveFromDictionary called - no handler provided')
};

export default WordDefinitionPopup;
