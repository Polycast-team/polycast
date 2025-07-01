import React, { useRef, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import WordDefinitionPopup from './WordDefinitionPopup';
import { getLanguageForProfile } from '../utils/profileLanguageMapping';

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
  selectedWords,
  setSelectedWords,
  wordDefinitions,
  setWordDefinitions,
  isStudentMode = false,
  studentHomeLanguage,
  // Add setter for transcript segments if available
  setEnglishSegments = null,
  // Add profile management props
  selectedProfile = 'non-saving'
}) => {
  const englishRef = useRef(null);
  const translationRefs = useRef({});
  const [fontSize, setFontSize] = useState(30); // Font size: default to 30
  
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
    
    // Log the selectedWords array whenever a word is clicked
    console.log('🔴🔴🔴 SELECTED WORDS WHEN CLICKING', word, '🔴🔴🔴');
    console.log('📋 SELECTED WORDS ARRAY:', JSON.stringify(selectedWords));
    console.log('📋 SELECTED WORDS COUNT:', selectedWords.length);
    
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
      // Step 1: Fetch Gemini definition with context and target language
      const profileLanguage = getLanguageForProfile(selectedProfile);
      const apiUrl = `https://polycast-server.onrender.com/api/dictionary/${encodeURIComponent(word)}?context=${encodeURIComponent(contextSentence)}&targetLanguage=${encodeURIComponent(profileLanguage)}`;
      console.log(`Fetching definition for "${word}" with context and language ${profileLanguage}, from: ${apiUrl}`);
      
      const geminiFetch = fetch(apiUrl)
        .then(res => res.json())
        .then(data => {
          console.log(`[API DEBUG] Received definition for "${word}":`, data);
          console.log(`[API DEBUG] Profile Language used in API call: "${profileLanguage}"`);
          console.log(`[API DEBUG] API Response structure:`, {
            translation: data?.translation,
            translations: data?.translations,
            contextualExplanation: data?.contextualExplanation
          });
          return data;
        })
        .catch(err => {
          console.error(`Error fetching definition for ${word}:`, err);
          return null;
        });
      
      // Step 2: Fetch dictionary definition from JSON files
      const firstLetter = word.charAt(0).toLowerCase();
      const dictUrl = `https://polycast-server.onrender.com/api/local-dictionary/${encodeURIComponent(firstLetter)}/${encodeURIComponent(word.toUpperCase())}?context=${encodeURIComponent(contextSentence)}&targetLanguage=${encodeURIComponent(profileLanguage)}`;
      
      console.log(`Fetching dictionary definition for "${word}" with language ${profileLanguage} from: ${dictUrl}`);
      
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
              definitions: dictData.allDefinitions,
              targetLanguage: profileLanguage
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
    
    // Check all entries for this word with proper word sense IDs
    const matchingSenseIds = Object.entries(wordDefinitions)
      .filter(([key, entry]) => 
        entry && 
        entry.word && 
        entry.word.toLowerCase() === wordLower && 
        entry.inFlashcards &&
        entry.wordSenseId)
      .map(([key, entry]) => entry);
      
    if (matchingSenseIds.length > 0) {
      for (const sense of matchingSenseIds) {
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
      // Only return false if we found word matches but no context matches
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
    
    // Special handling for different senses of words based on context
    if (wordLower === 'charge') {
      if (contextLower.includes('battle')) {
        definitionNumber = 1; // attack sense
      } else if (contextLower.includes('phone') || contextLower.includes('battery')) {
        definitionNumber = 24; // electrical sense
      } else if (contextLower.includes('murder')) {
        definitionNumber = 5; // legal accusation sense
      }
    }
    
    // Generate a proper word sense ID
    const wordSenseId = `${wordLower}${definitionNumber}`;
    
    // 1. Direct check - is there an entry with this exact sense ID?
    const directMatch = wordDefinitions[wordSenseId];
    if (directMatch && directMatch.inFlashcards) {
      console.log(`[DUPLICATE CHECK] Direct match: ${wordSenseId} already exists as a flashcard`);
      return true;
    }
    
    // 2. Check all existing flashcards for this word to see if there's a similar word sense
    const existingFlashcards = Object.entries(wordDefinitions)
      .filter(([key, value]) => 
        value && value.word && value.word.toLowerCase() === wordLower && 
        value.inFlashcards && 
        value.contextSentence);
    
    // Check if any existing flashcard has a very similar context
    for (const [key, card] of existingFlashcards) {
      if (card.contextSentence && 
         (card.contextSentence.includes(contextSentence) || 
          contextSentence.includes(card.contextSentence))) {
        console.log(`[DUPLICATE CHECK] Similar context found: ${card.wordSenseId} has similar context`);
        return true;
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
      // Note: TranscriptionDisplay is used within App component, so we'll let App handle the error popup
      throw new Error(`Failed to save profile data. Your progress may be lost. Please check your connection and try again.`);
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
        let updated = prev;
        if (!prev.some(w => w.toLowerCase() === wordLower)) {
          updated = [...prev, word];
          return updated;
        }
        return prev;
      });

      if (!contextSentence) {
        console.error('No context sentence found for word:', word);
        return;
      }
      
      // Get all existing flashcard sense IDs
      const existingFlashcardSenseIds = getAllFlashcardSenseIds();
            
      // Use the definition data directly from the popup (no more 2-stage approach)
      console.log(`[FLASHCARD CREATE] Creating flashcard directly from popup data for word: ${word}`);
      
      // Check if we have the basic definition data from when the word was clicked
      if (!wordData.definition && !wordData.disambiguatedDefinition) {
        console.error(`No definition data available for ${word} in popup`);
        
        // Show error message to user
        setPopupInfo(prev => ({
          ...prev,
          showPopup: true,
          error: true,
          popupMessage: `Could not add "${word}" to flashcards. Definition data not available. Try clicking the word again.`,
        }));
        return;
      }
      
      // Extract definition data from the popup
      const definitionData = wordData.disambiguatedDefinition || wordData;
      const definition = definitionData.definition || wordData.definition || '';
      const translation = definitionData.translation || wordData.translation || '';
      const partOfSpeech = definitionData.partOfSpeech || wordData.partOfSpeech || 'unknown';
      const definitionNumber = definitionData.definitionNumber || wordData.definitionNumber || 1;
      
      // Create a simple word sense ID
      const safeWordSenseId = `${wordLower}_${definitionNumber}`;
      console.log(`[FLASHCARD CREATE] Using word sense ID: ${safeWordSenseId}`);
      
      // Check for duplicates
      if (wordDefinitions[safeWordSenseId] && wordDefinitions[safeWordSenseId].inFlashcards) {
        console.warn(`[DUPLICATE-GUARD] Duplicate flashcard prevented for ${word} (ID: ${safeWordSenseId}).`);
        
        setPopupInfo(prev => ({
          ...prev,
          showPopup: true,
          error: true,
          popupMessage: `"${word}" is already in your flashcards.`,
        }));
        return;
      }
      
      // Create the flashcard with data from the popup
      setWordDefinitions(prev => {
        // Create a new flashcard object using popup data
        const newFlashcard = {
          // Basic word information
          word: wordLower,
          wordSenseId: safeWordSenseId,
          contextSentence: contextSentence,
          inFlashcards: true,
          cardCreatedAt: new Date().toISOString(),
          
          // Definition data from popup
          definition: definition,
          translation: translation,
          partOfSpeech: partOfSpeech,
          definitionNumber: definitionNumber,
          
          // Use existing example data if available, otherwise use context
          exampleSentencesRaw: wordData.exampleSentencesRaw || wordData.example || contextSentence,
          example: wordData.example || contextSentence,
          
          // Frequency ratings from Gemini (1-10 scale, 10 = most common)
          wordFrequency: wordData.wordFrequency || 5,
          definitionFrequency: wordData.definitionFrequency || 5,
          frequency: wordData.wordFrequency || 5, // Use wordFrequency for SRS sorting
          
          // SRS (Spaced Repetition System) fields
          srsData: {
            isNew: true,
            gotWrongThisSession: false,
            SRS_interval: 1,
            status: 'new',
            correctCount: 0,
            incorrectCount: 0,
            dueDate: null, // New cards don't have due dates yet
            lastSeen: null, // Never reviewed yet
            lastReviewDate: null, // Keep for backwards compatibility
            nextReviewDate: new Date().toISOString() // Keep for backwards compatibility
          }
        };
        
        console.log(`[FLASHCARD CREATE] Successfully created flashcard with popup data:`, newFlashcard);
        
        // Return the updated state with the new flashcard
        return {
          ...prev,
          [safeWordSenseId]: newFlashcard
        };
      });
      
      // Background Gemini call for example sentences (happens independently)
      setTimeout(async () => {
        try {
          console.log(`[BACKGROUND GEMINI] Generating example sentences for "${word}"`);
          
          // Get the native language (student's home language or profile language)
          const nativeLanguage = (isStudentMode && studentHomeLanguage) ? studentHomeLanguage : getLanguageForProfile(selectedProfile);
          
          // Create the prompt for example sentences with translations
          const examplePrompt = `Rate "${word}" frequency (1-10) and create 5 example sentences in context: ${definition}

Frequency scale: 1=extremely rare, 10=ubiquitous. Most words are 1-3, very few are 9-10.

Create exactly 5 English sentences with "${word}" surrounded by ~ characters, each followed by ${nativeLanguage} translation. IMPORTANT: Put ~ symbols around the target word in BOTH the English sentence AND the ${nativeLanguage} translation.

Output format (no other text):
[number]//[English sentence with ~${word}~]//[${nativeLanguage} translation with ~target word~]//[English sentence with ~${word}~]//[${nativeLanguage} translation with ~target word~]//[English sentence with ~${word}~]//[${nativeLanguage} translation with ~target word~]//[English sentence with ~${word}~]//[${nativeLanguage} translation with ~target word~]//[English sentence with ~${word}~]//[${nativeLanguage} translation with ~target word~]

Example output:
6//I need to ~call~ my mom tonight//Necesito ~llamar~ a mi mamá esta noche//Can you ~call~ me back later?//¿Puedes ~devolverme la llamada~ más tarde?//She didn't ~call~ yesterday//Ella no ~llamó~ ayer//Let's ~call~ it a day//~Terminemos~ por hoy//The teacher will ~call~ your name//El maestro ~dirá~ tu nombre

START NOW:`;

          // Make the API call to generate example sentences
          const response = await fetch('https://polycast-server.onrender.com/api/dictionary/generate-examples', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              word: wordLower,
              definition: definition,
              prompt: examplePrompt
            })
          });

          if (response.ok) {
            // Get the raw text response (no JSON parsing needed)
            let exampleSentences = await response.text();
            
            // Parse frequency rating from the front of the response
            let frequencyRating = 3; // Default fallback
            
            // Clean up any preamble text and extract frequency
            // Look for pattern: number//sentence with ~word~
            const frequencyMatch = exampleSentences.match(/^.*?(\d+)\/\/.*?~[^~]+~/);
            if (frequencyMatch) {
              frequencyRating = parseInt(frequencyMatch[1]) || 3;
              // Remove everything before the frequency number
              const frequencyIndex = exampleSentences.indexOf(frequencyMatch[1] + '//');
              if (frequencyIndex >= 0) {
                exampleSentences = exampleSentences.substring(frequencyIndex + (frequencyMatch[1] + '//').length);
                console.log(`[BACKGROUND GEMINI] Extracted frequency: ${frequencyRating}, cleaned response starts with: ${exampleSentences.substring(0, 50)}...`);
              }
            } else {
              // Fallback: look for the first occurrence of a sentence with ~ characters (old behavior)
              const firstTildeMatch = exampleSentences.match(/[^.!?]*~[^~]+~[^\/]*\/\/[^\/]*\/\//);
              if (firstTildeMatch) {
                const startIndex = exampleSentences.indexOf(firstTildeMatch[0]);
                if (startIndex > 0) {
                  exampleSentences = exampleSentences.substring(startIndex);
                  console.log(`[BACKGROUND GEMINI] No frequency found, cleaned preamble, now starts with: ${exampleSentences.substring(0, 50)}...`);
                }
              }
            }
            
            console.log(`[BACKGROUND GEMINI] Generated examples for "${word}":`, exampleSentences);
            console.log(`[BACKGROUND GEMINI] Response length: ${exampleSentences.length}, type: ${typeof exampleSentences}`);
            
            // Update the flashcard with the generated examples and frequency
            setWordDefinitions(prev => {
              if (prev[safeWordSenseId]) {
                return {
                  ...prev,
                  [safeWordSenseId]: {
                    ...prev[safeWordSenseId],
                    exampleSentencesGenerated: exampleSentences,
                    frequencyRating: frequencyRating,
                    generatedAt: new Date().toISOString()
                  }
                };
              }
              return prev;
            });
            
            // Save updated data if needed
            if (selectedProfile !== 'non-saving') {
              setTimeout(() => saveProfileData(), 500);
            }
          } else {
            const errorText = await response.text();
            console.error(`[BACKGROUND GEMINI] Failed to generate examples for "${word}". Status: ${response.status}, Error:`, errorText);
          }
        } catch (error) {
          console.error(`[BACKGROUND GEMINI] Error generating examples for "${word}":`, error);
        }
      }, 200);
      
      // Run cleanup to ensure no duplicates after the state update
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
      throw new Error(`Failed to create flashcard for "${word}". Please try again.`);
    }
  };

  // Function to remove a word from the dictionary/flashcards
  const handleRemoveWordFromDictionary = (word) => {
    try {
      const wordLower = word.toLowerCase();
      console.log(`Removing word from dictionary: ${wordLower}`);
      
      // Get the word data from the current state (same as creation logic)
      const wordData = wordDefinitions[wordLower];
      
      if (!wordData) {
        console.error('No word data found for:', wordLower);
        return;
      }
      
      // Get the definition number from the word data (matching creation logic)
      const definitionData = wordData.disambiguatedDefinition || wordData;
      const definitionNumber = definitionData.definitionNumber || wordData.definitionNumber || 1;
      
      // Generate the specific wordSenseId for this instance (must match creation format)
      const wordSenseId = `${wordLower}_${definitionNumber}`;
      console.log(`Determined wordSenseId: ${wordSenseId} based on definition number: ${definitionNumber}`);
      
      // Only remove the specific wordSenseId that was clicked
      const senseIdsToRemove = [wordSenseId];
      
      // Check if this is the last sense for this word
      const otherSensesForSameWord = Object.entries(wordDefinitions)
        .filter(([key, entry]) => 
          entry && entry.word && entry.word.toLowerCase() === wordLower &&
          entry.wordSenseId && entry.wordSenseId !== wordSenseId &&
          entry.inFlashcards);
      
      const isLastSenseOfWord = otherSensesForSameWord.length === 0;
      console.log(`This ${isLastSenseOfWord ? 'is' : 'is not'} the last sense of the word '${wordLower}'`);
      
      // Remove from wordDefinitions
      setWordDefinitions(prev => {
        const updated = { ...prev };
        
        // Remove only the specific sense entry
        if (updated[wordSenseId]) {
          delete updated[wordSenseId];
          console.log(`Removed sense entry: ${wordSenseId}`);
        } else {
          console.warn(`Could not find entry with ID: ${wordSenseId}`);
        }
        
        // Close the popup since we've removed the word
        setPopupInfo(prevPopup => ({
          ...prevPopup,
          visible: false
        }));
        
        return updated;
      });
      
      // Only remove the word from selectedWords if this is the last sense of the word
      if (isLastSenseOfWord) {
        console.log('🔴🔴🔴 SELECTED WORDS BEFORE REMOVING', wordLower, '🔴🔴🔴');
        console.log('📋 SELECTED WORDS BEFORE REMOVAL:', JSON.stringify(selectedWords));
        
        setSelectedWords(prev => {
          const updated = prev.filter(selectedWord => selectedWord.toLowerCase() !== wordLower);
          console.log('🔵🔵🔵 SELECTED WORDS AFTER REMOVING', wordLower, '🔵🔵🔵');
          console.log('📋 SELECTED WORDS AFTER REMOVAL:', JSON.stringify(updated));
          return updated;
        });
        console.log(`Removed '${wordLower}' from selectedWords as it was the last sense`); 
      } else {
        console.log(`Kept '${wordLower}' in selectedWords as other senses remain`);
        console.log('🟢🟢🟢 SELECTED WORDS (UNCHANGED):', JSON.stringify(selectedWords));
      }
      
      // Save the updated state to the backend
      if (selectedProfile !== 'non-saving') {
        setTimeout(() => {
          saveProfileData();
          console.log(`Saved updated flashcards to profile: ${selectedProfile}`);
        }, 100);
      }
    } catch (error) {
      console.error(`Error removing word from dictionary: ${error}`);
      throw new Error(`Failed to remove word from dictionary. Please try again.`);
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
          Transcript
        </span>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 16, gap: 8, overflow: 'auto' }} ref={englishRef}>
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            <span style={{ fontWeight: 400, fontSize: fontSize }}>
              {renderSegmentsWithClickableWords(englishSegments, null, selectedWords, handleWordClick, isWordInSelectedList)}
            </span>
            <div className="scroll-end" />
          </div>
        </div>
      </div>
    );
  };

  // --- Main render ---
  // Use flex layout to fill the available vertical space
  const transcriptVisible = showLiveTranscript;
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
      {popupInfo.visible && (() => {
        const profileLanguage = getLanguageForProfile(selectedProfile);
        console.log(`[POPUP LANG DEBUG] Selected Profile: "${selectedProfile}", Mapped Language: "${profileLanguage}"`);
        console.log(`[POPUP LANG DEBUG] Word being looked up: "${popupInfo.word}"`);
        console.log(`[POPUP LANG DEBUG] Word definition data:`, wordDefinitions[popupInfo.word.toLowerCase()]);
        
        return (
          <WordDefinitionPopup 
            word={popupInfo.word}
            definition={wordDefinitions[popupInfo.word.toLowerCase()]}
            dictDefinition={wordDefinitions[popupInfo.word.toLowerCase()]?.dictionaryDefinition}
            disambiguatedDefinition={wordDefinitions[popupInfo.word.toLowerCase()]?.disambiguatedDefinition}
            position={popupInfo.position}
            isInDictionary={wordDefinitions[popupInfo.word.toLowerCase()] ? doesWordSenseExist(popupInfo.word, wordDefinitions[popupInfo.word.toLowerCase()]?.contextSentence) : false}
            onAddToDictionary={handleAddWordToDictionary}
            onRemoveFromDictionary={handleRemoveWordFromDictionary}
            loading={!wordDefinitions[popupInfo.word.toLowerCase()] || popupInfo.loading}
            nativeLanguage={profileLanguage}
            onClose={() => setPopupInfo(prev => ({ ...prev, visible: false }))}
          />
        );
      })()}
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
            
            // For student mode, use the profile's language translations
            const profileLanguage = getLanguageForProfile(selectedProfile);
            const segments = isStudentMode && lang === profileLanguage 
              ? (translations[profileLanguage] || translations[Object.keys(translations)[0]] || []) 
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
                  {isStudentMode ? (studentHomeLanguage || 'Student Language') : lang}
                </span>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 16, gap: 8, overflow: 'auto', minHeight: 0 }} ref={el => translationRefs.current[lang] = el}>
                  <span style={{ fontWeight: 400, fontSize: fontSize }}>
                    {renderHistoryStacked(segments)}
                  </span>
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
  selectedWords: PropTypes.array.isRequired,
  setSelectedWords: PropTypes.func.isRequired,
  wordDefinitions: PropTypes.object.isRequired,
  setWordDefinitions: PropTypes.func.isRequired,
  isStudentMode: PropTypes.bool,
  studentHomeLanguage: PropTypes.string,
  selectedProfile: PropTypes.string
};

TranscriptionDisplay.defaultProps = {
  englishSegments: [],
  translations: {},
  showLiveTranscript: true,
  showTranslation: true,
};

export default TranscriptionDisplay;
