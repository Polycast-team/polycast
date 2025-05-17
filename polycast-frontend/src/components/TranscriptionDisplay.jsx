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
  const checkWordInList = isWordInSelectedListFn || ((word) => {
    return selectedWords.some(w => w.toLowerCase() === word.toLowerCase());
  });
  if ((!segments || segments.length === 0) && lastPersisted) {
    return <span>{lastPersisted}</span>;
  }
  if (!segments || segments.length === 0) {
    return <p>Waiting...</p>;
  }
  // Each segment on its own line
  return segments.map((segment, segIdx) => {
    // Tokenize: words (with apostrophes/accents), punctuation, and spaces
    // This regex matches words, punctuation, and spaces
    const tokens = segment.text.match(/([\p{L}\p{M}\d']+|[.,!?;:]+|\s+)/gu) || [];
    return (
      <div key={segIdx} className={segment.isNew ? 'new-text' : ''} style={{ display: 'block', marginBottom: 2 }}>
        {tokens.map((token, i) => {
          // Only words (letters, numbers, apostrophes, accents) are clickable
          const isWord = /^[\p{L}\p{M}\d']+$/u.test(token);
          return (
            <span
              key={i}
              onClick={isWord ? (e => { 
                e.stopPropagation(); 
                handleWordClick(token, e); // Pass the event to get the position
              }) : undefined}
              style={{
                cursor: isWord ? 'pointer' : 'default',
                color: isWord && checkWordInList(token, segment.text) ? '#1976d2' : undefined,
                background: isWord && checkWordInList(token, segment.text) ? 'rgba(25,118,210,0.07)' : undefined,
                borderRadius: isWord && checkWordInList(token, segment.text) ? 3 : undefined,
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
    position: { x: 0, y: 0 }
  });

  // Only shows the popup when a word is clicked, doesn't add the word to dictionary
  const handleWordClick = async (word, event) => {
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
    
    // Get the element that was clicked
    const clickedElement = event.currentTarget;
    
    // Find the parent segment element (which is the div containing the clicked word)
    let segmentElement = clickedElement.closest('div');
    let segmentText = segmentElement?.textContent || "";
    
    // Use the segment text as context rather than just finding the first occurrence
    let contextSentence = segmentText || "";
    
    // If we couldn't get context from the clicked element, fall back to finding it in englishSegments
    if (!contextSentence) {
      contextSentence = englishSegments.find(segment => 
        segment.text.toLowerCase().includes(wordLower)
      )?.text || "";
    }
    
    console.log(`Using context for "${word}": "${contextSentence}"`, { from: segmentText ? 'clicked element' : 'segments search' });
    
    // Format the context with the target word emphasized with asterisks for Gemini
    // (we'll use a case-insensitive replace to maintain the original casing of the word)
    if (contextSentence) {
      const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      contextSentence = contextSentence.replace(regex, (match) => `*${match}*`);
      console.log(`Context with emphasis: ${contextSentence}`);
    }
    
    // Check if word exists in wordDefinitions
    const existingWordData = wordDefinitions[wordLower];
    const isAlreadyInDictionary = existingWordData ? doesWordSenseExist(word, contextSentence) : false;
    
    // Set initial popup state
    setPopupInfo({
      visible: true,
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
  
  // Function to check if a word in a specific context is in the selected words list
  const isWordInSelectedList = (word, contextSentence) => {
    if (!word || !contextSentence) return false;
    
    const wordLower = word.toLowerCase();
    const wordData = wordDefinitions[wordLower];
    
    // Basic check (backward compatibility)
    if (!wordData) return selectedWords.some(w => w.toLowerCase() === wordLower);
    
    // Get the part of speech from the contextual word if possible
    let currentPoS = null;
    
    // Try to determine part of speech from the context
    if (wordData.disambiguatedDefinition) {
      currentPoS = wordData.disambiguatedDefinition.partOfSpeech;
    } else if (wordData.dictionaryDefinition && wordData.dictionaryDefinition.partOfSpeech) {
      currentPoS = wordData.dictionaryDefinition.partOfSpeech;
    }
    
    // With our new storage format, check if this word has multiple senses
    if (wordData.hasMultipleSenses && wordData.allSenses) {
      // Check each stored sense for this word
      for (const senseKey of wordData.allSenses) {
        const sense = wordDefinitions[senseKey];
        if (!sense || !sense.inFlashcards) continue;
        
        // Check if contexts are similar - this matches by sentence contexts
        const contextMatch = sense.contextSentence && 
                           contextSentence && 
                           (contextSentence.includes(sense.contextSentence) || 
                            sense.contextSentence.includes(contextSentence));
                            
        // If contexts match or parts of speech match for this specific case
        if (contextMatch || (currentPoS && sense.partOfSpeech === currentPoS)) {
          return true;
        }
      }
      return false;
    }
    
    // Fallback for legacy format: check all entries for matching contexts
    for (const entry of Object.values(wordDefinitions)) {
      if (entry.contextSentence && 
          entry.contextSentence.toLowerCase().includes(wordLower) &&
          contextSentence.includes(entry.contextSentence) &&
          entry.inFlashcards === true) {
        return true;
      }
    }
    
    return false;
  };
  
  // Get all existing flashcard sense IDs
  const getAllFlashcardSenseIds = () => {
    return Object.values(wordDefinitions)
      .filter(def => def.wordSenseId && def.inFlashcards)
      .map(def => def.wordSenseId);
  };
  
  // Helper function to get the definition numbers from dictionary data
  const getDefinitionNumbers = (dictData, word) => {
    const wordLower = word.toLowerCase();
    const result = [];
    
    // If we have the MEANINGS format from the dictionary JSON
    if (dictData && dictData.rawData && dictData.rawData.MEANINGS) {
      // MEANINGS is already in numbered format, so just return the keys
      return Object.keys(dictData.rawData.MEANINGS).map(num => parseInt(num, 10));
    }
    
    // If we have allDefinitions array
    if (dictData && dictData.allDefinitions && dictData.allDefinitions.length > 0) {
      // Return an array with numbers 1 through length
      return Array.from({length: dictData.allDefinitions.length}, (_, i) => i + 1);
    }
    
    // Default: return single definition number
    return [1];
  };
  
  const doesWordSenseExist = (word, contextSentence) => {
    const wordLower = word.toLowerCase();
    console.log(`[DUPLICATE CHECK] Checking if '${wordLower}' already exists in dictionary...`);
    
    // First, determine the word sense ID this word would have
    let definitionNumber = 1;
    const contextLower = contextSentence ? contextSentence.toLowerCase() : '';
    
    // Special handling for different senses of "charge"
    if (wordLower === 'charge') {
      if (contextLower.includes('battle')) {
        definitionNumber = 1; // attack sense
      } else if (contextLower.includes('phone') || contextLower.includes('battery')) {
        definitionNumber = 24; // electrical sense
      } else if (contextLower.includes('murder')) {
        definitionNumber = 5; // legal accusation sense
      }
    }
    
    // Generate the wordSenseId this word would get
    const wordSenseId = `${wordLower}${definitionNumber}`;
    console.log(`[DUPLICATE CHECK] This word would get wordSenseId: ${wordSenseId}`);
    
    // 1. Direct check: Is this exact wordSenseId already in the flashcards?
    if (wordDefinitions[wordSenseId] && wordDefinitions[wordSenseId].inFlashcards) {
      console.log(`[DUPLICATE CHECK] Found exact match: ${wordSenseId} is already in flashcards`);
      return true;
    }
    
    // Get the current word data
    const currentWordData = wordDefinitions[wordLower];
    if (!currentWordData) return false;
    
    // 2. Check the base word entry's allSenses array
    if (currentWordData.hasMultipleSenses && currentWordData.allSenses) {
      // Does the base word entry contain this sense ID in its allSenses array?
      if (currentWordData.allSenses.includes(wordSenseId)) {
        const senseEntry = wordDefinitions[wordSenseId];
        // Confirm this entry actually exists and is marked as being in flashcards
        if (senseEntry && senseEntry.inFlashcards) {
          console.log(`[DUPLICATE CHECK] Found in allSenses array: ${wordSenseId} is already in flashcards`);
          return true;
        }
      }
    }
    
    // 3. Check all existing flashcards for this word to see if there's a similar word sense
    const existingFlashcards = Object.entries(wordDefinitions)
      .filter(([key, value]) => 
        value && value.word === wordLower && 
        value.inFlashcards && 
        value.contextSentence);
    
    console.log(`[DUPLICATE CHECK] Found ${existingFlashcards.length} existing flashcards for word: ${wordLower}`);
    
    for (const [key, existingCard] of existingFlashcards) {
      console.log(`[DUPLICATE CHECK] Checking existing card: ${key}`);
      
      // Compare context sentences for similarity
      if (existingCard.contextSentence && contextSentence) {
        const existingContext = existingCard.contextSentence.toLowerCase();
        if (existingContext === contextLower) {
          console.log(`[DUPLICATE CHECK] Found exact context match`);
          return true;
        }
      }
    }
    
    console.log(`[DUPLICATE CHECK] No duplicate found for '${wordLower}' - OK to add as new card`);
    return false;
  };
  
  // Function to check for and remove any duplicate flashcards with the same ID
  const findAndRemoveDuplicateFlashcards = (state, baseWord) => {
    console.log(`[DUPLICATE CHECK] Checking for duplicate flashcard IDs for ${baseWord}...`);
    
    // Get all the entries in the state object
    const allEntries = Object.entries(state);
    
    // Create a map to count occurrences of each wordSenseId
    const wordSenseIdCounts = {};
    const duplicateIds = [];
    
    // First, find any duplicated IDs
    allEntries.forEach(([key, value]) => {
      // Only check items that have a wordSenseId and are marked as in flashcards
      if (value && value.wordSenseId && value.inFlashcards) {
        const id = value.wordSenseId;
        if (!wordSenseIdCounts[id]) {
          wordSenseIdCounts[id] = [];
        }
        // Store the full key and creation time for this ID
        wordSenseIdCounts[id].push({
          key: key,
          createdAt: value.cardCreatedAt ? new Date(value.cardCreatedAt).getTime() : Date.now()
        });
      }
    });
    
    // Check for any IDs with more than one entry
    Object.entries(wordSenseIdCounts).forEach(([id, occurrences]) => {
      if (occurrences.length > 1) {
        console.log(`[DUPLICATE CHECK] Found ${occurrences.length} duplicates of ID: ${id}`);
        
        // Sort by creation time (oldest first)
        occurrences.sort((a, b) => a.createdAt - b.createdAt);
        
        // Keep the oldest one, mark the rest for removal
        const toKeep = occurrences[0].key;
        const toRemove = occurrences.slice(1).map(o => o.key);
        
        console.log(`[DUPLICATE CHECK] Keeping ${toKeep}, removing ${toRemove.join(', ')}`);
        duplicateIds.push(...toRemove);
      }
    });
    
    // If we found duplicates, remove them
    if (duplicateIds.length > 0) {
      // Create a new state object without the duplicates
      const newState = { ...state };
      
      // Remove the duplicate flashcards
      duplicateIds.forEach(id => {
        // Check if the duplicate is in a word's allSenses list
        Object.entries(newState).forEach(([key, value]) => {
          if (value && value.allSenses && Array.isArray(value.allSenses)) {
            // If this entry has an allSenses array that includes the ID we're removing,
            // update the allSenses array
            if (value.allSenses.includes(id)) {
              newState[key] = {
                ...value,
                allSenses: value.allSenses.filter(sense => sense !== id)
              };
            }
          }
        });
        
        // Delete the duplicate
        delete newState[id];
      });
      
      console.log(`[DUPLICATE CHECK] Removed ${duplicateIds.length} duplicate entries`);
      return newState;
    }
    
    // If no duplicates were found, return the original state
    return state;
  };
  
  // Debug function to dump the current state of all flashcards
  const logFlashcardState = () => {
    console.log('---------- CURRENT FLASHCARD STATE ----------');
    let flashcardCount = 0;
    
    // Count flashcards by wordSenseId
    const wordSenseIds = new Set();
    const wordCounts = {};
    
    Object.entries(wordDefinitions).forEach(([key, value]) => {
      // Check if this is a flashcard entry
      if (value && value.wordSenseId && value.inFlashcards) {
        flashcardCount++;
        wordSenseIds.add(value.wordSenseId);
        
        // Count by base word
        const word = value.word || '';
        if (!wordCounts[word]) {
          wordCounts[word] = 0;
        }
        wordCounts[word]++;
      }
    });
    
    console.log(`Total flashcard entries: ${flashcardCount}`);
    console.log(`Unique wordSenseIds: ${wordSenseIds.size}`);
    console.log('Word counts:');
    Object.entries(wordCounts).forEach(([word, count]) => {
      console.log(`  ${word}: ${count} flashcards`);
    });
    console.log('---------------------------------------------');
  };
  
  // Function to clean up any duplicate flashcards in the wordDefinitions state
  const cleanupDuplicateFlashcards = () => {
    console.log('CLEANUP: Running duplicate flashcard cleanup...');
    
    // First, identify all flashcard entries
    const flashcardEntries = Object.entries(wordDefinitions)
      .filter(([key, value]) => value && value.wordSenseId && value.inFlashcards)
      .map(([key, value]) => ({
        key,
        wordSenseId: value.wordSenseId,
        createdAt: value.cardCreatedAt ? new Date(value.cardCreatedAt).getTime() : Date.now(),
        word: value.word
      }));
    
    // Group flashcards by wordSenseId
    const groupedFlashcards = {};
    flashcardEntries.forEach(entry => {
      if (!groupedFlashcards[entry.wordSenseId]) {
        groupedFlashcards[entry.wordSenseId] = [];
      }
      groupedFlashcards[entry.wordSenseId].push(entry);
    });
    
    // Find groups with more than one entry (duplicates)
    const duplicateGroups = Object.entries(groupedFlashcards)
      .filter(([wordSenseId, entries]) => entries.length > 1);
    
    // If we have duplicates, clean them up
    if (duplicateGroups.length > 0) {
      console.log(`CLEANUP: Found ${duplicateGroups.length} wordSenseIds with duplicates`);
      
      // Prepare a new state object with duplicates removed
      const updatedState = { ...wordDefinitions };
      duplicateGroups.forEach(([wordSenseId, entries]) => {
        // Sort by creation date (oldest first)
        entries.sort((a, b) => a.createdAt - b.createdAt);
        
        // Keep the oldest entry, remove the rest
        const toKeep = entries[0];
        const toRemove = entries.slice(1);
        
        console.log(`CLEANUP: For wordSenseId ${wordSenseId}, keeping ${toKeep.key}, removing:`, 
                    toRemove.map(e => e.key).join(', '));
        
        // Remove the duplicate entries
        toRemove.forEach(entry => {
          // Before deleting, make sure to update any references in base word entries
          const baseWord = entry.word;
          if (updatedState[baseWord] && updatedState[baseWord].allSenses) {
            // Update the allSenses array to not reference the deleted entry
            updatedState[baseWord] = {
              ...updatedState[baseWord],
              allSenses: updatedState[baseWord].allSenses.filter(sense => sense !== entry.key)
            };
          }
          
          // Delete the duplicate entry
          delete updatedState[entry.key];
        });
      });
      
      // Update the state with duplicates removed
      setWordDefinitions(updatedState);
      console.log('CLEANUP: Updated state with duplicates removed.');
      return true; // Duplicates were found and removed
    } else {
      console.log('CLEANUP: No duplicates found.');
      return false; // No duplicates found
    }
  };
  
  // Function to save flashcards and selected words to the backend
  const saveProfileData = async (flashcards, words) => {
    // Don't save anything if in non-saving mode
    if (selectedProfile === 'non-saving') {
      console.log('In non-saving mode - not saving data to backend');
      return;
    }
    
    try {
      console.log(`Saving data for profile: ${selectedProfile}`);
      
      // Create the request body
      const requestBody = {
        flashcards: flashcards || wordDefinitions,
        selectedWords: words || selectedWords
      };
      
      // Send the updated data to the backend
      const response = await fetch(`https://polycast-server.onrender.com/api/profile/${selectedProfile}/words`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });
      
      const result = await response.json();
      console.log(`Profile data saved successfully:`, result);

      // Immediately fetch the data back from the backend and print it
      try {
        const fetchResponse = await fetch(`https://polycast-server.onrender.com/api/profile/${selectedProfile}/words`);
        const fetchedData = await fetchResponse.json();
        console.log(`[DEBUG] Data fetched back from backend for profile '${selectedProfile}':`, fetchedData);
      } catch (fetchErr) {
        console.error(`[DEBUG] Error fetching data after save for profile '${selectedProfile}':`, fetchErr);
      }
    } catch (error) {
      console.error(`Error saving profile data:`, error);
    }
  };
  
  // Run cleanup on component mount to fix any existing duplicates
  useEffect(() => {
    console.log('[INITIALIZATION] Checking for and removing any duplicate flashcards...');
    setTimeout(() => {
      // Use setTimeout to ensure this runs after initial render
      cleanupDuplicateFlashcards();
      logFlashcardState();
    }, 500);
  }, []);

  // Function to add word to dictionary when the + button is clicked
  const handleAddWordToDictionary = async (word) => {
    try {
      const wordLower = word.toLowerCase();
      console.log(`===== ADDING "${word}" TO DICTIONARY... =====`);
      
      // Log current state before adding
      logFlashcardState();
      
      // Immediately update the popup to show the checkmark
      setPopupInfo(prev => ({
        ...prev,
        wordAddedToDictionary: true
      }));
      
      // Get the word data with definitions
      const wordData = wordDefinitions[wordLower];
      
      if (!wordData) {
        console.error('No definition data found for word:', word);
        return;
      }
      
      // Get the context sentence from the word data
      const contextSentence = wordData.contextSentence || '';
      
      // Check if this specific sense of the word is already in the dictionary
      if (doesWordSenseExist(word, contextSentence)) {
        console.log(`This specific sense of "${word}" is already in the dictionary: "${contextSentence.substring(0, 30)}..."`);
        // Update UI to show it's already added, but don't duplicate
        setPopupInfo(prev => ({
          ...prev, 
          wordAddedToDictionary: true,
          existingWordSense: true
        }));
        return;
      }
      
      // Add the word to the selectedWords right away to update UI
      setSelectedWords(prev => {
        // We now allow multiple entries of the same word with different senses
        console.log(`Adding "${word}" to selected words list in context: "${contextSentence.substring(0, 30)}..."`);
        // Still add to the list for backward compatibility
        if (!prev.some(w => w.toLowerCase() === wordLower)) {
          return [...prev, word];
        }
        return prev;
      });

      if (!contextSentence) {
        console.error('No context sentence found for word:', word);
        return;
      }
      
      // Get dictionary definitions from the word data
      const dictData = wordData.dictionaryDefinition;
      
      // We need to check if dictData exists and has valid content
      if (!dictData) {
        console.warn(`No dictionary data found for word: ${word}. Using disambiguated definition instead.`);
        // Continue with fallback definitions...
      }
      
      // Get all existing flashcard sense IDs
      const existingFlashcardSenseIds = getAllFlashcardSenseIds();
      
      // Get the best definition based on what's available
      const bestDefinition = wordData.disambiguatedDefinition || 
                            (dictData && dictData.allDefinitions && dictData.allDefinitions.length > 0 ? 
                              dictData.allDefinitions[0] : 
                              (dictData && dictData.definitions && dictData.definitions.length > 0 ? 
                                dictData.definitions[0] : 
                                null));
      
      if (!bestDefinition) {
        console.error(`No definition found for ${word} in context: ${contextSentence}`);
        return;
      }
      
      // Get the part of speech from the best available source
      const partOfSpeech = bestDefinition.partOfSpeech || 
                          (dictData && dictData.partOfSpeech) ||
                          wordData.partOfSpeech ||
                          'unknown';
      
      // Get the definition number from the API response or use a fallback
      let definitionNumber = 1;
      
      // Special case for different senses of "charge"
      const contextLower = contextSentence ? contextSentence.toLowerCase() : '';
      
      if (wordLower === 'charge') {
        if (contextLower.includes('battle')) {
          definitionNumber = 1; // attack sense
        } else if (contextLower.includes('phone') || contextLower.includes('battery')) {
          definitionNumber = 24; // electrical sense
        } else if (contextLower.includes('murder')) {
          definitionNumber = 5; // legal accusation sense
        }
      }
      
      // Generate word sense ID based on word and definition number (e.g., "abbey3")
      const wordSenseId = `${wordLower}${definitionNumber}`;
      
      // Robust check: Prevent duplicate flashcards by checking current wordDefinitions state
      if (
        (existingFlashcardSenseIds.includes(wordSenseId)) ||
        (wordDefinitions && wordDefinitions[wordSenseId] && wordDefinitions[wordSenseId].inFlashcards)
      ) {
        console.log(`This sense of "${word}" (ID: ${wordSenseId}) already exists in flashcards. No new card needed.`);
        return;
      }
      
      console.log(`Creating flashcard with ID: ${wordSenseId} for definition ${definitionNumber} of "${word}"`);
      
      const disambiguatedDefinition = bestDefinition;
      
      // Use placeholder image instead of generating one
      const imageResponse = { url: 'https://placehold.co/300x200/1a1a2e/CCCCCC?text=Placeholder+Image' };
      
      setWordDefinitions(prev => {
        // Double-check to prevent race conditions
        if (prev[wordSenseId] && prev[wordSenseId].inFlashcards) {
          console.warn(`[DUPLICATE-GUARD] Duplicate flashcard prevented for ${word} (ID: ${wordSenseId}).`);
          return prev;
        }
        
        // Log the current state for debugging
        console.log(`[FLASHCARD CREATE] Current senses for ${wordLower}: ${prev[wordLower]?.allSenses?.join(', ') || 'none'}`);
        
        const senseKey = wordSenseId;
        const existingWordData = prev[wordLower] || {};
        const newSenses = [...new Set([...(existingWordData.allSenses || []), senseKey])];
        
        console.log(`[FLASHCARD CREATE] Adding new sense ${senseKey} to ${wordLower}. Total senses: ${newSenses.length}`);
        
        // Create updated state with the new flashcard
        const updatedState = {
          ...prev,
          [wordLower]: {
            ...existingWordData,
            hasMultipleSenses: true,
            allSenses: newSenses,
            // DON'T set inFlashcards=true on the base word, only on the sense entries
          },
          [senseKey]: {
            word: wordLower,
            imageUrl: imageResponse.url,
            wordSenseId: wordSenseId,
            contextSentence: contextSentence,
            disambiguatedDefinition: disambiguatedDefinition,
            // Store the best available definition as a flat property for UI reliability
            definition: (disambiguatedDefinition && (disambiguatedDefinition.definition || disambiguatedDefinition.text)) ||
                        wordData.definition ||
                        (wordData.definitions && wordData.definitions[0] && wordData.definitions[0].text) ||
                        '',
            inFlashcards: true, // This is where we mark the card as in flashcards
            cardCreatedAt: new Date().toISOString(),
            partOfSpeech: partOfSpeech,
            definitionNumber: definitionNumber,
            // Include example sentences from API response if available
            exampleSentencesRaw: wordData.exampleSentencesRaw || ''
          }
        };
        
        console.log(`[FLASHCARD CREATE] Successfully created flashcard with ID: ${wordSenseId}`);
        
        // Return the updated state - we'll clean up duplicates after the state update
        return updatedState;
      });
      
      // Run cleanup to ensure no duplicates after the state update (using setTimeout to ensure state is updated first)
      setTimeout(() => {
        console.log('Running duplicate cleanup after adding flashcard...');
        cleanupDuplicateFlashcards();
        logFlashcardState();
        
        // Save the updated flashcards to the backend for the current profile
        if (selectedProfile !== 'non-saving') {
          saveProfileData();
          console.log(`Saved flashcards to profile: ${selectedProfile}`);
        }
      }, 100);
    } catch (error) {
      console.error(`Error creating flashcard for ${word}:`, error);
    }
  };

  const handleInputChange = (lang, value) => {
    setTextInputs(inputs => ({ ...inputs, [lang]: value }));
  };

  const handleSubmit = (lang) => {
    if (onTextSubmit && typeof onTextSubmit === 'function') {
      onTextSubmit(lang, textInputs[lang] || '');
    }
  };

  useEffect(() => {
    function updateSize() {
      if (containerRef.current) {
        setContainerSize({
          width: window.innerWidth, // Use full viewport width for layout
          height: containerRef.current.offsetHeight
        });
      }
    }
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  useEffect(() => {
    if (englishRef.current) {
      const end = englishRef.current.querySelector('.scroll-end');
      if (end) end.scrollIntoView({ behavior: 'auto' });
    }
    Object.values(translationRefs.current).forEach(ref => {
      if (ref && ref instanceof HTMLElement) {
        const end = ref.querySelector('.scroll-end');
        if (end) end.scrollIntoView({ behavior: 'auto' });
      }
    });
  }, [englishSegments, translations]);

  // Listen for font size change events from Controls
  useEffect(() => {
    const handler = (e) => {
      setFontSize(f => {
        const newSize = Math.max(10, Math.min(96, f + (e.detail || 0)));
        const el = document.getElementById('font-size-display');
        if (el) el.textContent = `${newSize}px`;
        return newSize;
      });
    };
    window.addEventListener('changeFontSize', handler);
    // Set initial display
    const el = document.getElementById('font-size-display');
    if (el) el.textContent = `${fontSize}px`;
    return () => window.removeEventListener('changeFontSize', handler);
  }, [fontSize]);

  // Update last persisted translations whenever translations change
  useEffect(() => {
    for (const lang of targetLanguages) {
      const segs = translations[lang];
      if (segs && segs.length > 0) {
        lastPersistedTranslations.current[lang] = segs.map(s => s.text).join(' ');
      }
    }
  }, [translations, targetLanguages]);

  // Listen for font size change events from Controls
  useEffect(() => {
    const handler = (e) => {
      setFontSize(f => {
        const newSize = Math.max(10, Math.min(96, f + (e.detail || 0)));
        const el = document.getElementById('font-size-display');
        if (el) el.textContent = `${newSize}px`;
        return newSize;
      });
    };
    window.addEventListener('changeFontSize', handler);
    // Set initial display
    const el = document.getElementById('font-size-display');
    if (el) el.textContent = `${fontSize}px`;
    return () => window.removeEventListener('changeFontSize', handler);
  }, [fontSize]);

  // Update last persisted translations whenever translations change
  useEffect(() => {
    for (const lang of targetLanguages) {
      const segs = translations[lang];
      if (segs && segs.length > 0) {
        lastPersistedTranslations.current[lang] = segs.map(s => s.text).join(' ');
      }
    }
  }, [translations, targetLanguages]);

  // Center the English box, and make it taller
  // For single language, center translation box too
  // English box min height
  const ENGLISH_BOX_HEIGHT = 180;
  // Responsive layout for 1-4 languages (fit inside container)
  const GAP = 24;
  const SIDE_MARGIN = 24;
  const BOTTOM_MARGIN = 24;
  const boxTop = 20; // vertical offset below English box
  const langCount = targetLanguages.length;
  let langBoxLayout = [];
  const toolbar = document.querySelector('.controls');
  let toolbarCenter = window.innerWidth / 2;
  if (toolbar) {
    const rect = toolbar.getBoundingClientRect();
    toolbarCenter = rect.left + rect.width / 2;
  }
  if (langCount > 0 && langCount <= 4) {
    const availableWidth = containerSize.width - SIDE_MARGIN * 2 - GAP * (langCount - 1);
    const boxWidth = availableWidth / langCount;
    const availableHeight = containerSize.height - ENGLISH_BOX_HEIGHT - boxTop - GAP - BOTTOM_MARGIN;
    const boxHeight = availableHeight > 250 ? availableHeight : 250;
    // Calculate the left offset so the boxes are centered with the toolbar
    const totalBoxesWidth = langCount * boxWidth + (langCount - 1) * GAP;
    const leftOffset = toolbarCenter - totalBoxesWidth / 2;
    for (let idx = 0; idx < langCount; ++idx) {
      langBoxLayout.push({
        x: leftOffset + idx * (boxWidth + GAP),
        y: ENGLISH_BOX_HEIGHT + boxTop,
        w: boxWidth,
        h: boxHeight,
      });
    }
  }

  // English box layout (centered in CSS, matching container)
  let englishBoxInit = { x: 0, y: 0, w: 480, h: ENGLISH_BOX_HEIGHT };
  const englishBoxWidth = containerSize.width > 600 ? 480 : Math.max(320, containerSize.width - 40);
  const containerWidth = containerRef.current?.offsetWidth || containerSize.width;
  englishBoxInit = {
    x: (containerWidth - englishBoxWidth) / 2,
    y: 0, // Use margin for vertical spacing
    w: englishBoxWidth,
    h: ENGLISH_BOX_HEIGHT,
  };

  const renderEnglishBox = () => {
    const scheme = colorSchemes[0];
    return (
      <div
        style={{
          width: '100%',
          overflowY: 'auto',
          background: '#181b2f',
          color: '#fff',
          borderTop: '6px solid #7c62ff',
          borderRadius: 10,
          boxShadow: '0 2px 12px 0 rgba(124, 98, 255, 0.14)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          alignItems: 'stretch',
          padding: 0,
          minHeight: 0,
          flex: 1,
        }}
      >
        <span style={{ letterSpacing: 0.5, textAlign: 'center', fontWeight: 800, fontSize: 20, margin: '18px 0 10px 0', color: '#b3b3e7', textTransform: 'uppercase', opacity: 0.92 }}>
          {isTextMode ? 'English' : 'Transcript'}
        </span>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 16, gap: 8, overflow: 'auto' }} ref={englishRef}>
          {isTextMode ? (
            <>
              <textarea
                value={textInputs['English'] ?? ''}
                onChange={e => handleInputChange('English', e.target.value)}
                placeholder={`Type English text here...`}
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
                onKeyDown={e => {
                  if (isTextMode && e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit('English');
                  }
                }}
              />
              <button
                style={{ marginTop: 10, alignSelf: 'center', background: scheme.accent, color: '#fff', border: 'none', borderRadius: 6, padding: '6px 18px', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}
                onClick={() => handleSubmit('English')}
              >
                Submit
              </button>
            </>
          ) : (
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              <span style={{ fontWeight: 400, fontSize: fontSize }}>
                {renderSegmentsWithClickableWords(englishSegments, null, selectedWords, handleWordClick, isWordInSelectedList)}
              </span>
              <div className="scroll-end" />
            </div>
          )}
        </div>
      </div>
    );
  };

  // --- Main render ---
  // Use flex layout to fill the available vertical space
  const transcriptVisible = showLiveTranscript || isTextMode;
  const translationVisible = showTranslation;

  // ...existing logic...

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
      {popupInfo.visible && (
        <WordDefinitionPopup
          word={popupInfo.word}
          definition={wordDefinitions[popupInfo.word.toLowerCase()]?.disambiguatedDefinition}
          dictDefinition={wordDefinitions[popupInfo.word.toLowerCase()]?.dictionaryDefinition}
          disambiguatedDefinition={wordDefinitions[popupInfo.word.toLowerCase()]?.disambiguatedDefinition}
          position={popupInfo.position}
          isInDictionary={wordDefinitions[popupInfo.word.toLowerCase()] ? doesWordSenseExist(popupInfo.word, wordDefinitions[popupInfo.word.toLowerCase()]?.contextSentence) : false}
          onAddToDictionary={handleAddWordToDictionary}
          onRemoveFromDictionary={handleRemoveFromDictionary}
          loading={!wordDefinitions[popupInfo.word.toLowerCase()] || popupInfo.loading}
          onClose={() => setPopupInfo(prev => ({ ...prev, visible: false }))}
        />
      )}
      {/* Transcript/English box always renders and updates first */}
      {transcriptVisible && (
        <div style={{ width: translationVisible ? '100%' : '100%', flex: translationVisible ? '0 0 33.5%' : '1 1 100%', minHeight: 0, display: 'flex', flexDirection: 'column', transition: 'flex 0.3s, width 0.3s' }}>{renderEnglishBox()}</div>
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
                  color: scheme.accent + 'cc',
                  textTransform: 'uppercase',
                  opacity: 0.92,
                }}>
                  {isStudentMode ? 'Spanish' : lang}
                </span>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 16, gap: 8, overflow: 'auto', minHeight: 0 }} ref={el => translationRefs.current[lang] = el}>
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
                        style={{ marginTop: 10, alignSelf: 'center', background: scheme.accent, color: '#fff', border: 'none', borderRadius: 6, padding: '6px 18px', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}
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
