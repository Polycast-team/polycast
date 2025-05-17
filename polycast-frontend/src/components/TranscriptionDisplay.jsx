import React, { useRef, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import WordDefinitionPopup from './WordDefinitionPopup';

// Helper function to render segments
const renderSegments = (segments, lastPersisted) => {
  if ((!segments || segments.length === 0) && lastPersisted) {
    // Show the last persisted translation if segments are empty
    return <span>{lastPersisted}</span>;
  }
  if (!segments || segments.length === 0) {
    return <p>Waiting...</p>; // Display placeholder if no segments and nothing persisted
  }
  return segments.map((segment, index) => (
    <span key={index} className={segment.isNew ? 'new-text' : ''}>
      {index > 0 ? ' ' : ''}{segment.text}
    </span>
  ));
};

// Helper function to render segments as lines (audio mode)
const renderSegmentsStacked = (segments, lastPersisted) => {
  if ((!segments || segments.length === 0) && lastPersisted) {
    return <span>{lastPersisted}</span>;
  }
  if (!segments || segments.length === 0) {
    return <p>Waiting...</p>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      {segments.map((segment, index) => (
        <span key={index} className={segment.isNew ? 'new-text' : ''} style={{ marginBottom: 2 }}>
          {segment.text}
        </span>
      ))}
    </div>
  );
};

// Helper function to render all historical segments for a language
const renderHistoryStacked = (segments) => {
  if (!segments || segments.length === 0) {
    return <p>Waiting...</p>;
  }
  // Show only the last 10 segments (instead of previous 3)
  const visibleSegments = segments.slice(-10);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      {visibleSegments.map((segment, index) => (
        <span key={index} className={segment.isNew ? 'new-text' : ''} style={{ marginBottom: 2 }}>
          {segment.text}
        </span>
      ))}
    </div>
  );
};

// Helper: render a segment with clickable words
const renderSegmentsWithClickableWords = (segments, lastPersisted, selectedWords, handleWordClick, isWordInSelectedListFn) => {
  // Default implementation if no function is provided
  const checkWordInList = isWordInSelectedListFn || ((word, segmentIndex, wordIndex) => {
    return selectedWords.some(w => 
      w.word.toLowerCase() === word.toLowerCase() &&
      w.segmentIndex === segmentIndex &&
      w.wordIndex === wordIndex
    );
  });
  
  if ((!segments || segments.length === 0) && lastPersisted) {
    return <span>{lastPersisted}</span>;
  }
  if (!segments || segments.length === 0) {
    return <p>Waiting...</p>;
  }
  
  return segments.map((segment, segIdx) => {
    const tokens = segment.text.match(/([\p{L}\p{M}\d']+|[.,!?;:]+|\s+)/gu) || [];
    return (
      <div key={segIdx} className={segment.isNew ? 'new-text' : ''} style={{ display: 'block', marginBottom: 2 }}>
        {tokens.map((token, tokenIndex) => {
          const isWord = /^[\p{L}\p{M}\d']+$/u.test(token);
          const isSelected = isWord && checkWordInList(token, segIdx, tokenIndex);
          
          return (
            <span
              key={`${segIdx}-${tokenIndex}`}
              onClick={isWord ? (e) => { 
                e.stopPropagation();
                handleWordClick(token, e, segIdx, tokenIndex);
              } : undefined}
              style={{
                cursor: isWord ? 'pointer' : 'default',
                color: isSelected ? '#1976d2' : undefined,
                background: isSelected ? 'rgba(25,118,210,0.07)' : undefined,
                borderRadius: isSelected ? 3 : undefined,
                transition: 'color 0.2s',
                userSelect: 'text',
              }}
            >
              {token}
            </span>
          );
        })}
      </div>
    );
  });
};

// Assign a unique color scheme for each language box
const colorSchemes = [
  { bg: '#2d2a3a', fg: '#fff', accent: '#7c62ff' }, // deep purple
  { bg: '#1b3a4b', fg: '#fff', accent: '#4ad991' }, // teal blue
  { bg: '#4a2c2a', fg: '#fff', accent: '#ffb86b' }, // brown-orange
  { bg: '#2a4a3a', fg: '#fff', accent: '#72e0b2' }, // green
  { bg: '#4a2a4a', fg: '#fff', accent: '#e072e0' }, // purple-pink
  { bg: '#2a3a4a', fg: '#fff', accent: '#72aee0' }, // blue
];

// Utility to get window size
function useWindowSize() {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  useEffect(() => {
    const handleResize = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return size;
}

/**
 * Displays the received transcription and multiple translation texts in a split-screen style layout.
 */
const TranscriptionDisplay = ({ 
  englishSegments, 
  targetLanguages, 
  translations, 
  showLiveTranscript, 
  showTranslation, 
  isTextMode, 
  onTextSubmit, 
  textInputs, 
  setTextInputs,
  selectedWords,
  setSelectedWords,
  wordDefinitions,
  setWordDefinitions,
  isStudentMode = false,
  // Add setter for transcript segments if available
  setEnglishSegments = null,
  // Add profile management props
  selectedProfile = 'non-saving'
}) => {
  const englishRef = useRef(null);
  const translationRefs = useRef({});
  const [fontSize, setFontSize] = useState(isTextMode ? 18 : 30); // Font size: default to 30 in audio mode
  useEffect(() => {
    // Update font size default when mode changes
    setFontSize(isTextMode ? 18 : 30);
    
    // Auto-fill the text input with specific text when in text mode
    if (isTextMode) {
      setTextInputs(prev => ({
        ...prev,
        'English': "Testing this now. I will charge my phone\n\ni will charge into battle\n\ni will charge him with murder"
      }));
    }
  }, [isTextMode, setTextInputs]);
  
  // Add default transcript content regardless of mode
  useEffect(() => {
    // Create demo transcript text
    const demoText1 = "Testing this now. I will charge my phone";
    const demoText2 = "i will charge into battle";
    const demoText3 = "i will charge him with murder";
    
    // Override the segments directly in the component
    if (englishSegments.length === 0 || (englishSegments.length === 1 && englishSegments[0].text === "Waiting...")) {
      const segments = [
        { text: demoText1, isNew: false },
        { text: demoText2, isNew: false },
        { text: demoText3, isNew: false }
      ];
      
      // Use the englishSegments.splice hack to modify the array in place without a setter
      if (englishSegments.splice) {
        englishSegments.splice(0, englishSegments.length, ...segments);
      }
    }
  }, [englishSegments]);
  const containerRef = useRef(null);
  const [containerSize, setContainerSize] = useState({ width: 1200, height: 600 });
  const [langBoxStates, setLangBoxStates] = useState([]);
  const lastPersistedTranslations = useRef({});
  
  // State for word definition popup
  const [popupInfo, setPopupInfo] = useState({
    visible: false,
    word: '',
    position: { x: 0, y: 0 },
    segmentIndex: -1,
    wordIndex: -1,
    contextSentence: ''
  });

  // Only shows the popup when a word is clicked, doesn't add the word to dictionary
  const handleWordClick = async (word, event, segmentIndex, wordIndex) => {
    if (!event) return;
    
    const wordLower = word.toLowerCase();
    
    // Calculate position for popup
    const rect = event.currentTarget.getBoundingClientRect();
    
    // Position popup right next to the word
    const viewportWidth = window.innerWidth;
    const popupWidth = 380; // Match width from CSS
    
    // Calculate optimal position to avoid going off screen
    const spaceOnRight = viewportWidth - rect.right;
    const fitsOnRight = spaceOnRight >= popupWidth + 10;
    
    // Position to the right if there's room, otherwise to the left
    const xPos = fitsOnRight ? rect.right + 5 : rect.left - popupWidth - 5;
    
    // Try to get the segment text from the provided segmentIndex if available
    let contextSentence = "";
    if (segmentIndex !== undefined && englishSegments[segmentIndex]) {
      contextSentence = englishSegments[segmentIndex].text;
      console.log(`Using segment at index ${segmentIndex} for context`);
    } 
    
    // Fallback to the old method if we couldn't get the segment
    if (!contextSentence) {
      const clickedElement = event.currentTarget;
      const segmentElement = clickedElement.closest('div');
      contextSentence = segmentElement?.textContent || "";
      
      // If we still don't have context, try to find it in englishSegments
      if (!contextSentence) {
        contextSentence = englishSegments.find(segment => 
          segment.text.toLowerCase().includes(wordLower)
        )?.text || "";
      }
      console.log(`Fell back to DOM-based context for "${word}"`);
    }
    
    console.log(`Using context for "${word}": "${contextSentence}"`);
    
    // Format the context with the target word emphasized with asterisks for Gemini
    if (contextSentence) {
      const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      contextSentence = contextSentence.replace(regex, (match) => `*${match}*`);
      console.log(`Context with emphasis: ${contextSentence}`);
    }
    
    // Check if word exists in wordDefinitions
    const existingWordData = wordDefinitions[wordLower];
    const isAlreadyInDictionary = existingWordData ? doesWordSenseExist(word, contextSentence) : false;
    
    // Set initial popup state with position information
    setPopupInfo({
      visible: true,
      segmentIndex,
      wordIndex,
      contextSentence,
      word: word,
      position: {
        x: Math.max(5, Math.min(viewportWidth - popupWidth - 5, xPos)), // Keep on screen
        y: rect.top - 5 // Position slightly above the word
      },
      loading: true, // Set loading state while we fetch definitions
      contextSentence: contextSentence, // Store context for reference
      wordAddedToDictionary: isAlreadyInDictionary // Set to true if already in dictionary
    });
    
    try {
      // Step 1: Fetch Gemini definition with context
      const apiUrl = `https://polycast-server.onrender.com/api/dictionary/${encodeURIComponent(word)}?context=${encodeURIComponent(contextSentence)}`;
      console.log(`Fetching definition for "${word}" with context, from: ${apiUrl}`);
      
      const geminiFetch = fetch(apiUrl)
        .then(res => res.json())
        .then(data => {
          console.log(`Received definition for "${word}":`, data);
          return data;
        })
        .catch(err => {
          console.error(`Error fetching definition for ${word}:`, err);
          return null;
        });
      
      // Step 2: Fetch dictionary definition from JSON files
      const firstLetter = word.charAt(0).toLowerCase();
      const dictUrl = `https://polycast-server.onrender.com/api/local-dictionary/${encodeURIComponent(firstLetter)}/${encodeURIComponent(word.toUpperCase())}?context=${encodeURIComponent(contextSentence)}`;
      
      console.log(`Fetching dictionary definition for "${word}" from: ${dictUrl}`);
      
      const dictFetch = fetch(dictUrl)
        .then(res => res.json())
        .then(dictData => {
          console.log(`Received dictionary definition for "${word}":`, dictData);
          return dictData;
        })
        .catch(err => {
          console.error(`Error fetching dictionary definition for ${word}:`, err);
          return null;
        });
      
      // Wait for both fetches to complete
      const [geminiData, dictData] = await Promise.all([geminiFetch, dictFetch]);
      
      // Step 3: If we have multiple definitions, disambiguate using Gemini
      let disambiguatedDefinition = null;
      
      if (dictData && dictData.allDefinitions && dictData.allDefinitions.length > 1) {
        // Use the disambiguation API to find the correct sense
        try {
          console.log(`Disambiguating definition for "${word}" in context: "${contextSentence}"`);
          
          const disambiguationResponse = await fetch('https://polycast-server.onrender.com/api/disambiguate-word', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              word: word,
              contextSentence: contextSentence,
              definitions: dictData.allDefinitions
            })
          }).then(res => res.json());
          
          console.log(`Disambiguation result:`, disambiguationResponse);
          disambiguatedDefinition = disambiguationResponse.disambiguatedDefinition;
        } catch (error) {
          console.error(`Error disambiguating definition for ${word}:`, error);
          // Fall back to first definition if disambiguation fails
          disambiguatedDefinition = dictData.allDefinitions[0];
        }
      } else if (dictData && dictData.allDefinitions && dictData.allDefinitions.length === 1) {
        // Only one definition, no need to disambiguate
        disambiguatedDefinition = dictData.allDefinitions[0];
      }
      
      // Update the wordDefinitions state with all the data
      setWordDefinitions(prev => ({
        ...prev,
        [wordLower]: {
          ...geminiData, // Gemini API definition
          dictionaryDefinition: dictData, // Full dictionary data
          disambiguatedDefinition: disambiguatedDefinition, // The most relevant definition
          contextSentence: contextSentence // Save the context for flashcards
        }
      }));
      
      // Update popup info to remove loading state
      setPopupInfo(prev => ({
        ...prev,
        loading: false
      }));
    } catch (error) {
      console.error(`Error processing definitions for ${word}:`, error);
      
      // Update popup info to remove loading state even on error
      setPopupInfo(prev => ({
        ...prev,
        loading: false
      }));
    }
  };
  
  const handleAddToDictionary = async (word, definition, translation, partOfSpeech, definitionNumber, contextSentence) => {
    const wordLower = word.toLowerCase();
    const wordSenseId = `${wordLower}${definitionNumber}`;
    
    // Get the position information from the popup
    const { segmentIndex, wordIndex } = popupInfo;
    
    // Check if this word sense already exists in the dictionary
    const existingWordData = wordDefinitions[wordLower];
    const isAlreadyInDictionary = existingWordData && existingWordData[wordSenseId];
    
    // Update the word in the dictionary
    setWordDefinitions(prev => ({
      ...prev,
      [wordLower]: {
        ...(prev[wordLower] || {}),
        [wordSenseId]: {
          word: word,
          definition: definition,
          translation: translation,
          partOfSpeech: partOfSpeech,
          definitionNumber: definitionNumber,
          contextSentence: contextSentence,
          inFlashcards: true,
          cardCreatedAt: new Date().toISOString(),
          wordSenseId: wordSenseId
        },
        // Mark that this word has been added to the dictionary
        inDictionary: true,
        // Keep track of all senses of this word
        allSenses: [...new Set([
          ...(prev[wordLower]?.allSenses || []),
          wordSenseId
        ])],
        // Mark that this word has multiple senses if there are multiple senses
        hasMultipleSenses: (prev[wordLower]?.allSenses?.length || 0) >= 1
      }
    }));
    
    // Add to selected words with position information
    const wordWithPosition = {
      word: word,
      segmentIndex,
      wordIndex,
      wordSenseId
    };
    
    setSelectedWords(prev => {
      // Check if this exact position is already selected
      const isAlreadySelected = prev.some(w => 
        w.word === word && 
        w.segmentIndex === segmentIndex && 
        w.wordIndex === wordIndex
      );
      
      if (isAlreadySelected) {
        return prev; // Already selected, no change needed
      }
      
      // Add the new word with position information
      return [...prev, wordWithPosition];
    });
    
    // Close the popup
    setPopupInfo(prev => ({ ...prev, visible: false }));

  // Function to check if a word at a specific position is in the selected words list
  const isWordInSelectedList = (word, segmentIndex, wordIndex) => {
    if (!word || segmentIndex === undefined || wordIndex === undefined) return false;
    
    const wordLower = word.toLowerCase();
    
    // Check if any selected word matches the word, segment index, and word index
    return selectedWords.some(entry => {
      // If entry is an object (new format), check all fields
      if (typeof entry === 'object' && entry !== null) {
        return entry.word.toLowerCase() === wordLower && 
               entry.segmentIndex === segmentIndex &&
               entry.wordIndex === wordIndex;
      }
      // Fallback for legacy string format (shouldn't happen with our updates)
      return false;
    });
  };

  // Render the word definition popup if visible
  const renderWordDefinitionPopup = () => {
    if (!popupInfo.visible) return null;
    
    const wordLower = popupInfo.word.toLowerCase();
    const wordData = wordDefinitions[wordLower];
    
    // Check if this specific instance of the word is already in the dictionary
    const isThisInstanceInDictionary = isWordInSelectedList(
      popupInfo.word, 
      popupInfo.segmentIndex, 
      popupInfo.wordIndex
    );
    
    return (
      <WordDefinitionPopup
        word={popupInfo.word}
        definition={wordData}
        dictDefinition={wordData}
        position={popupInfo.position}
        onClose={() => setPopupInfo(prev => ({ ...prev, visible: false }))}
        onAddToDictionary={() => {
          // Pass the context sentence to the add function
          handleAddToDictionary(
            popupInfo.word,
            wordData?.definition || '',
            wordData?.translation || '',
            wordData?.partOfSpeech || '',
            wordData?.definitionNumber || 1,
            popupInfo.contextSentence,
            popupInfo.segmentIndex,
            popupInfo.wordIndex
          );
        }}
        isInDictionary={isThisInstanceInDictionary}
      />
    );
  };

  // Render the main component
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: 'calc(100vh - 244px)',
        margin: '20px auto 0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '0 24px 24px',
        overflow: 'hidden',
        boxSizing: 'border-box',
        gap: 0,
      }}
    >
      {/* Word Definition Popup */}
      {renderWordDefinitionPopup()}
      {/* Transcript/English box always renders and updates first */}
      {transcriptVisible && (
        <div style={{ 
          width: translationVisible ? '100%' : '100%', 
          flex: translationVisible ? '0 0 33.5%' : '1 1 100%', 
          minHeight: 0, 
          display: 'flex', 
          flexDirection: 'column', 
          transition: 'flex 0.3s, width 0.3s' 
        }}>
          {renderEnglishBox()}
        </div>
      )}
      {/* Language boxes fill the remaining space */}
      {translationVisible && (
        <div
          style={{
            width: '100%',
            display: 'flex',
            justifyContent: langCount === 1 ? 'center' : 'flex-start',
            flex: '1 1 66.5%',
            alignItems: 'stretch',
            minHeight: 0,
            gap: 24,
            boxSizing: 'border-box',
            marginTop: 24,
          }}
        >
          {targetLanguages.map((lang, idx) => {
            const scheme = colorSchemes[(idx + 1) % colorSchemes.length];
            const layout = langBoxLayout[idx] || { x: 0, y: 0, w: 320, h: 250 };
            
            // For student mode, always use Spanish translations if available regardless of language label
            const segments = isStudentMode && lang === 'Spanish' 
              ? (translations['Spanish'] || translations[Object.keys(translations)[0]] || []) 
              : (translations[lang] || []);
              
            return (
              <div
                key={lang}
                style={{
                  flex: 1,
                  minWidth: 0,
                  minHeight: 0,
                  maxHeight: '100%',
                  overflow: 'hidden',
                  margin: 0,
                  background: scheme.bg,
                  color: scheme.fg,
                  borderTop: `4px solid ${scheme.accent}`,
                  borderRadius: 12,
                  boxShadow: '0 2px 12px 0 rgba(124, 98, 255, 0.07)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-start',
                  alignItems: 'stretch',
                  padding: 0,
                }}
              >
                <span style={{
                  letterSpacing: 0.5,
                  textAlign: 'center',
                  fontWeight: 800,
                  fontSize: 20,
                  margin: '18px 0 10px 0',
                  color: `${scheme.accent}cc`,
                  textTransform: 'uppercase',
                  opacity: 0.92,
                }}>
                  {isStudentMode ? 'Spanish' : lang}
                </span>
                <div 
                  style={{ 
                    flex: 1, 
                    display: 'flex', 
                    flexDirection: 'column', 
                    padding: 16, 
                    gap: 8, 
                    overflow: 'auto', 
                    minHeight: 0 
                  }} 
                  ref={el => (translationRefs.current[lang] = el)}
                >
                  {isTextMode ? (
                    <>
                      <textarea
                        value={textInputs[lang] ?? ''}
                        style={{
                          width: '100%',
                          height: '100%',
                          flex: 1,
                          fontSize: fontSize,
                          borderRadius: 6,
                          border: `1.5px solid ${scheme.accent}`,
                          padding: 8,
                          resize: 'none',
                          background: scheme.bg,
                          color: scheme.fg,
                          boxSizing: 'border-box',
                          minHeight: 80,
                        }}
                        onChange={e => handleInputChange(lang, e.target.value)}
                        onKeyDown={e => {
                          if (isTextMode && e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSubmit(lang);
                          }
                        }}
                      />
                      <button
                        style={{ 
                          marginTop: 10, 
                          alignSelf: 'center', 
                          background: scheme.accent, 
                          color: '#fff', 
                          border: 'none', 
                          borderRadius: 6, 
                          padding: '6px 18px', 
                          fontWeight: 700, 
                          fontSize: 16, 
                          cursor: 'pointer' 
                        }}
                        onClick={() => handleSubmit(lang)}
                      >
                        Submit
                      </button>
                    </>
                  ) : (
                    <span style={{ fontWeight: 400, fontSize: fontSize }}>
                      {renderHistoryStacked(segments)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

TranscriptionDisplay.propTypes = {
  englishSegments: PropTypes.arrayOf(PropTypes.shape({
    text: PropTypes.string.isRequired,
    isNew: PropTypes.bool
  })),
  targetLanguages: PropTypes.arrayOf(PropTypes.string).isRequired,
  translations: PropTypes.object.isRequired,
  showLiveTranscript: PropTypes.bool,
  showTranslation: PropTypes.bool,
  isTextMode: PropTypes.bool.isRequired,
  onTextSubmit: PropTypes.func,
  textInputs: PropTypes.object.isRequired,
  setTextInputs: PropTypes.func.isRequired,
  selectedWords: PropTypes.array.isRequired,
  setSelectedWords: PropTypes.func.isRequired,
  wordDefinitions: PropTypes.object.isRequired,
  setWordDefinitions: PropTypes.func.isRequired,
  isStudentMode: PropTypes.bool
};

TranscriptionDisplay.defaultProps = {
  englishSegments: [],
  translations: {},
  showLiveTranscript: true,
  showTranslation: true,
  isTextMode: false,
  onTextSubmit: null
};

export default TranscriptionDisplay;
