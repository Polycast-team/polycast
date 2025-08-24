import React, { useState, useCallback, useEffect, useRef } from 'react';
import PropTypes from 'prop-types'; // Add PropTypes import
import useWebSocket, { ReadyState } from 'react-use-websocket';
import config from './config/config.js';
import './App.css'

// Import planned components (will be created next)
import AudioRecorder from './components/AudioRecorder';
import HostToolbar from './components/HostToolbar';

import TranscriptionDisplay from './components/TranscriptionDisplay';
import DictionaryTable from './components/DictionaryTable';
import FlashcardMode from './components/FlashcardMode';
import FlashcardCalendarModal from './components/shared/FlashcardCalendarModal';
import { useFlashcardCalendar } from './hooks/useFlashcardCalendar';
import VideoMode from './components/VideoMode';
import ErrorPopup from './components/ErrorPopup';
import { useErrorHandler } from './hooks/useErrorHandler';
import { getLanguageForProfile, getTranslationsForProfile, getNativeLanguageForProfile, getUITranslationsForProfile } from './utils/profileLanguageMapping.js';
import TBAPopup from './components/popups/TBAPopup';
import { useTBAHandler } from './hooks/useTBAHandler';
import apiService from './services/apiService.js';
import { createFlashcardEntry } from './components/FixedCardDefinitions';
import { extractSentenceWithWord, markClickedWordInSentence } from './utils/wordClickUtils';
import ModeSelector from './components/ModeSelector';



// App now receives an array of target languages and room setup as props
function App({ targetLanguages, selectedProfile, onReset, roomSetup, userRole, studentHomeLanguage, onJoinRoom, onHostRoom, onFlashcardModeChange, onProfileChange }) {
  // Debug logging
  console.log('App component received props:', { targetLanguages, selectedProfile, roomSetup, userRole, studentHomeLanguage });
  
  // Get translations for this profile's language
  const t = getTranslationsForProfile(selectedProfile);
  const ui = getUITranslationsForProfile(selectedProfile);
  
  // Step 1: Use selectedProfile from props, with fallback to non-saving
  const [internalSelectedProfile, setSelectedProfile] = React.useState(selectedProfile || 'non-saving');
  
  // Join Room state for students
  const [showJoinRoomModal, setShowJoinRoomModal] = useState(false);
  const [joinRoomCode, setJoinRoomCode] = useState('');
  const [joinRoomError, setJoinRoomError] = useState('');
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  
  // Function to fetch profile data from backend
  const fetchProfileData = useCallback(async (profile) => {
    if (profile === 'non-saving') {
      // In non-saving mode, keep current (localStorage-backed) state as-is
      console.log('Non-saving mode: using local state/localStorage for dictionary data.');
      return;
    }
    
    // TODO: Add room creation logic via POST /api/create-room when switching to host mode
    // TODO: Generate unique 5-digit room code and store in backend
    // TODO: Create room state management for tracking participants
    // TODO: Handle room persistence across server restarts with Redis
    // For now, all profiles use localStorage data
    return;

    try {
      console.log(`Fetching data for profile: ${profile}`);
      // const response = await fetch(`https://polycast-server.onrender.com/api/profile/${profile}/words`);
      // const data = await response.json();
      
      // Log the received data
      console.log('Received profile data:', data);
      
      // Get flashcards from the data
      const flashcards = data.flashcards || {};
      
      // Update wordDefinitions state
      setWordDefinitions(flashcards);
      
      // Derive selectedWords from the flashcards
      // Extract unique words from flashcard entries
      const uniqueWords = new Set();
      Object.values(flashcards).forEach(entry => {
        if (entry && entry.word && entry.inFlashcards) {
          uniqueWords.add(entry.word);
        }
      });
      
      // Convert the Set to an Array
      const derivedSelectedWords = Array.from(uniqueWords);
      
      // Update selectedWords state
      setSelectedWords(derivedSelectedWords);
      
      // Log the updated state for verification
      console.log(`Updated wordDefinitions with ${Object.keys(flashcards).length} flashcards`);
      console.log(`Updated selectedWords with ${derivedSelectedWords.length} words derived from flashcards:`, 
        derivedSelectedWords);
    } catch (error) {
      console.error(`Error fetching profile data for ${profile}:`, error);
      showError(`Failed to load profile data for "${profile}". Please check your connection and try again.`);
    }
  }, []);
  
  // Fetch profile data when selectedProfile changes
  useEffect(() => {
    const currentProfile = selectedProfile || internalSelectedProfile;
    fetchProfileData(currentProfile);
  }, [selectedProfile, internalSelectedProfile, fetchProfileData]);
  // Use host-selected languages for WebSocket communication, fallback to profile language for students
  const profileLanguage = getLanguageForProfile(selectedProfile || internalSelectedProfile);
  const effectiveLanguages = userRole === 'host' ? (targetLanguages || []) : [profileLanguage];
  const languagesQueryParam = effectiveLanguages.map(encodeURIComponent).join(',');
  
  console.log('Effective languages for WebSocket:', effectiveLanguages);
  console.log('WebSocket URL will use languages:', languagesQueryParam);

  // WebSocket connection setup
  // TODO: Add room-specific WebSocket routing: ws://localhost:8080/ws/room/:roomCode with room parameters
  // TODO: Parse room code from roomSetup and validate room exists before connecting
  // TODO: Include targetLangs, roomCode, and isHost parameters in WebSocket URL for room management
  // Always provide a websocket endpoint so students can stream without a room
  const socketUrl = roomSetup
    ? apiService.roomWebSocketUrl(languagesQueryParam, roomSetup.roomCode, roomSetup.isHost)
    : `${apiService.wsBaseUrl}/ws`;
  console.log("Constructed WebSocket URL:", socketUrl);

  const [isRecording, setIsRecording] = useState(false);
  const [fullTranscript, setFullTranscript] = useState('');
  const [currentPartial, setCurrentPartial] = useState(''); 
  const [translations, setTranslations] = useState({}); // Structure: { lang: [{ text: string, isNew: boolean }] }
  const [errorMessages, setErrorMessages] = useState([]); 
  
  // Students start in flashcard mode, hosts start in audio mode
  const [appMode, setAppMode] = useState('audio'); // Options: 'audio', 'dictionary', 'flashcard', 'video'
  const [selectedWords, setSelectedWords] = useState([]); // Profile-scoped selected words
  const [wordDefinitions, setWordDefinitions] = useState({}); // Profile-scoped word definitions
  const [showNotification, setShowNotification] = useState(false);
  const [notificationOpacity, setNotificationOpacity] = useState(1);
  const [isAddingWordBusy, setIsAddingWordBusy] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [toolbarStats, setToolbarStats] = useState({ newCards: 0, learningCards: 0, reviewCards: 0 });
  // Auto-send functionality removed - using manual Record/Stop button instead
  const notificationTimeoutRef = useRef(null);
  const isRecordingRef = useRef(isRecording); // Ref to track recording state in handlers
  const { error: popupError, showError, clearError } = useErrorHandler();
  const {tba: popupTBA, showTBA, clearTBA} = useTBAHandler();
  // WebRTC signaling dispatch with queueing to avoid race with VideoMode mount
  const webrtcSignalHandlerRef = useRef(null);
  const pendingWebrtcSignalsRef = useRef([]);


  // Toggle behavior disabled while translation UI is hidden

  // Update refs when state changes
  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);

  // Add Page Up/Page Down recording hotkeys (only for hosts)
  useEffect(() => {
    // Only add hotkeys for hosts (not students)
    if (roomSetup && !roomSetup.isHost) return;

    function handlePageKey(e) {
      if (e.repeat) return; // Prevent holding key from triggering repeatedly
      if (e.key === "PageUp") {
        e.preventDefault();
        handleStartRecording && handleStartRecording();
      }
      if (e.key === "PageDown") {
        e.preventDefault();
        handleStopRecording && handleStopRecording();
      }
    }
    window.addEventListener("keydown", handlePageKey);
    return () => window.removeEventListener("keydown", handlePageKey);
  }, [roomSetup]); // Reverted dependencies

  // Load and migrate profile-scoped dictionary/flashcards when profile changes
  useEffect(() => {
    const profile = selectedProfile || internalSelectedProfile;
    if (!profile) return;
    try {
      const swKey = `pc_selectedWords_${profile}`;
      const wdKey = `pc_wordDefinitions_${profile}`;

      // Migrate from legacy global keys if present
      const legacySW = localStorage.getItem('pc_selectedWords');
      const legacyWD = localStorage.getItem('pc_wordDefinitions');

      if (!localStorage.getItem(swKey) && legacySW) {
        localStorage.setItem(swKey, legacySW);
        try { localStorage.removeItem('pc_selectedWords'); } catch {}
      }
      if (!localStorage.getItem(wdKey) && legacyWD) {
        localStorage.setItem(wdKey, legacyWD);
        try { localStorage.removeItem('pc_wordDefinitions'); } catch {}
      }

      // Read scoped values
      const storedSW = localStorage.getItem(swKey);
      const storedWD = localStorage.getItem(wdKey);

      const parsedSW = storedSW ? JSON.parse(storedSW) : [];
      const parsedWD = storedWD ? JSON.parse(storedWD) : {};

      // Clean broken entries for safety
      const cleanedWD = {};
      Object.entries(parsedWD || {}).forEach(([key, entry]) => {
        if (!entry || !entry.wordSenseId) return;
        if (!entry.exampleSentencesGenerated) return;
        cleanedWD[key] = entry;
      });

      setSelectedWords(Array.isArray(parsedSW) ? parsedSW : []);
      setWordDefinitions(cleanedWD);

      // Persist cleaned snapshot back to scoped storage if changed
      try { localStorage.setItem(wdKey, JSON.stringify(cleanedWD)); } catch {}
    } catch (e) {
      console.warn('Failed to load/migrate profile-scoped dictionary data:', e);
      setSelectedWords([]);
      setWordDefinitions({});
    }
  }, [selectedProfile, internalSelectedProfile]);

  // Persist dictionary state to profile-scoped localStorage
  useEffect(() => {
    const profile = selectedProfile || internalSelectedProfile;
    if (!profile) return;
    try { localStorage.setItem(`pc_selectedWords_${profile}`, JSON.stringify(selectedWords)); } catch {}
  }, [selectedWords, selectedProfile, internalSelectedProfile]);
  useEffect(() => {
    const profile = selectedProfile || internalSelectedProfile;
    if (!profile) return;
    try { localStorage.setItem(`pc_wordDefinitions_${profile}`, JSON.stringify(wordDefinitions)); } catch {}
  }, [wordDefinitions, selectedProfile, internalSelectedProfile]);

  // Global listener to open/close the flashcard calendar from any mode
  useEffect(() => {
    const handler = (e) => {
      const detail = e && e.detail;
      if (detail === true) setShowCalendar(true);
      else if (detail === false) setShowCalendar(false);
      else setShowCalendar(prev => !prev);
    };
    window.addEventListener('toggleFlashcardCalendar', handler);
    return () => window.removeEventListener('toggleFlashcardCalendar', handler);
  }, []);

  // Listen for live toolbar stats from FlashcardMode
  useEffect(() => {
    const onStats = (e) => {
      if (e && e.detail) {
        const { newCards = 0, learningCards = 0, reviewCards = 0 } = e.detail;
        setToolbarStats({ newCards, learningCards, reviewCards });
      }
    };
    window.addEventListener('updateToolbarStats', onStats);
    return () => window.removeEventListener('updateToolbarStats', onStats);
  }, []);

  // One-time cleanup: remove any flashcard entries missing exampleSentencesGenerated
  useEffect(() => {
    try {
      const entries = wordDefinitions || {};
      const hasBroken = Object.values(entries).some(e => e && e.inFlashcards && !e.exampleSentencesGenerated);
      if (!hasBroken) return;
      const cleaned = {};
      Object.entries(entries).forEach(([key, entry]) => {
        if (entry && (!entry.inFlashcards || entry.exampleSentencesGenerated)) {
          cleaned[key] = entry;
        }
      });
      setWordDefinitions(cleaned);
      const uniqueWords = Array.from(new Set(Object.values(cleaned).filter(e => e && e.inFlashcards).map(e => e.word)));
      setSelectedWords(uniqueWords);
    } catch {}
  }, []);

  // Local handler to add a word to dictionary (flashcard entry in local state)
  const handleAddWord = useCallback(async (word) => {
    const wordLower = (word || '').toLowerCase();
    const nativeLanguage = getNativeLanguageForProfile(selectedProfile || internalSelectedProfile);
    const targetLanguage = getLanguageForProfile(selectedProfile || internalSelectedProfile);
    
    // Extract sentence and mark the word with tildes
    const sentence = extractSentenceWithWord(fullTranscript || '', wordLower);
    // For Add Word flow, we mark the first occurrence since user is adding from menu
    const sentenceWithMarkedWord = sentence.replace(
      new RegExp(`\\b(${wordLower})\\b`, 'i'),
      '~$1~'
    );

    console.log(`🎯 [handleAddWord] Using UNIFIED API for word: "${wordLower}"`);
    console.log(`🎯 [handleAddWord] Sentence with marked word:`, sentenceWithMarkedWord);

    const requestUrl = apiService.getUnifiedWordDataUrl(
      wordLower,
      sentenceWithMarkedWord,
      nativeLanguage,
      targetLanguage
    );
    console.log(`🌐 [handleAddWord] Unified API Request URL:`, requestUrl);

    try {
      setIsAddingWordBusy(true);
      
      // Single unified API call for all word data
      const unifiedData = await apiService.fetchJson(requestUrl);
      console.log(`🌐 [handleAddWord] Unified API Response:`, unifiedData);

      // Count existing senses for numbering
      const existingSenses = Object.values(wordDefinitions).filter(
        (e) => e && e.inFlashcards && e.word === wordLower
      );
      const definitionNumber = existingSenses.length + 1;
      const wordSenseId = `${wordLower}-${Date.now()}`;

      // Create flashcard entry using unified data
      const entry = createFlashcardEntry(
        wordLower,
        wordSenseId,
        unifiedData.exampleForDictionary || unifiedData.example || '',
        unifiedData.definition || wordLower,
        '',
        definitionNumber
      );

      // Enrich with all unified data
      const enriched = {
        ...entry,
        translation: unifiedData.translation || '',
        example: unifiedData.exampleForDictionary || unifiedData.example || '',
        contextSentence: unifiedData.exampleForDictionary || unifiedData.example || '', // For compatibility
        frequency: unifiedData.frequency || 5,
        exampleSentencesGenerated: unifiedData.exampleSentencesGenerated || ''
      };

      console.log(`📝 [handleAddWord] Final entry structure from unified API:`, enriched);
      console.log(`📝 [handleAddWord] Entry has required fields:`, {
        inFlashcards: !!enriched.inFlashcards,
        wordSenseId: !!enriched.wordSenseId,
        word: !!enriched.word
      });

      setWordDefinitions((prev) => ({ ...prev, [wordSenseId]: enriched }));
      setSelectedWords((prev) => (prev.includes(wordLower) ? prev : [...prev, wordLower]));
      
      console.log(`✅ [handleAddWord] Successfully added word using unified API: ${wordLower}`);
      return enriched;
    } catch (err) {
      console.error('Unified API failed:', err);
      showError(`Failed to add word: ${err.message}`);
      return null;
    } finally { 
      setIsAddingWordBusy(false); 
    }
  }, [wordDefinitions, fullTranscript, selectedProfile, internalSelectedProfile, showError]);

  // New: add multiple senses at once (from AddWordPopup)
  const handleAddWordSenses = useCallback((word, senses) => {
    const wordLower = (word || '').toLowerCase();
    const nativeLanguage = getNativeLanguageForProfile(selectedProfile || internalSelectedProfile);
    const targetLanguage = getLanguageForProfile(selectedProfile || internalSelectedProfile);
    const contextSentence = fullTranscript || '';

    const baseCount = Object.values(wordDefinitions).filter(
      (e) => e && e.inFlashcards && e.word === wordLower
    ).length;

    setIsAddingWordBusy(true);
    const promises = senses.map(async (sense, idx) => {
      const definitionNumber = baseCount + idx + 1;
      const wordSenseId = `${wordLower}-${Date.now()}-${idx}`;
      
      // Use the unified API to get complete word data including examples
      const sentenceWithMarkedWord = sense?.example || `~${wordLower}~`;
      
      try {
        const url = apiService.getUnifiedWordDataUrl(
          wordLower,
          sentenceWithMarkedWord,
          nativeLanguage,
          targetLanguage
        );
        
        const unifiedData = await apiService.fetchJson(url);
        
        // Create enriched entry with unified data
        const entry = createFlashcardEntry(
          wordLower,
          wordSenseId,
          sentenceWithMarkedWord,
          unifiedData.definition || sense?.definition || wordLower,
          '',
          definitionNumber
        );
        
        const enriched = {
          ...entry,
          translation: unifiedData.translation || sense?.translation || '',
          example: unifiedData.exampleForDictionary || sense?.example || '',
          contextSentence: sentenceWithMarkedWord,
          frequency: unifiedData.frequency || Math.max(1, Math.min(10, Number(sense?.frequency) || 5)),
          exampleSentencesGenerated: unifiedData.exampleSentencesGenerated || ''
        };
        
        setWordDefinitions((prev) => ({ ...prev, [wordSenseId]: enriched }));
      } catch (err) {
        console.error('Failed to get unified word data for sense:', err);
        // Fallback to basic entry without examples
        const entry = createFlashcardEntry(
          wordLower,
          wordSenseId,
          sense?.example || '',
          sense?.definition || wordLower,
          '',
          definitionNumber
        );
        
        const enriched = {
          ...entry,
          translation: sense?.translation || '',
          example: sense?.example || '',
          contextSentence: sense?.example || '',
          frequency: Math.max(1, Math.min(10, Number(sense?.frequency) || 5)),
          exampleSentencesGenerated: ''
        };
        
        setWordDefinitions((prev) => ({ ...prev, [wordSenseId]: enriched }));
      }
    });
    
    setSelectedWords((prev) => (prev.includes(wordLower) ? prev : [...prev, wordLower]));
    Promise.allSettled(promises).finally(() => setIsAddingWordBusy(false));
  }, [wordDefinitions, fullTranscript, selectedProfile, internalSelectedProfile]);

  // Ensure recording stops when leaving modes that support streaming
  useEffect(() => {
    if (appMode !== 'audio' && appMode !== 'video' && isRecording) {
      setIsRecording(false);
    }
  }, [appMode, isRecording]);

  // Auto-unmute when entering Video mode (host only)
  useEffect(() => {
    if (appMode === 'video' && roomSetup && roomSetup.isHost) {
      const id = setTimeout(() => setIsRecording(true), 50);
      return () => clearTimeout(id);
    } else if (appMode === 'video' && roomSetup && !roomSetup.isHost) {
      // Ensure students are muted on entry
      setIsRecording(false);
    }
  }, [appMode, roomSetup]);

  // No role-based auto mode switching

  // Join Room handler for students
  const handleJoinRoom = async () => {
    const cleanedRoomCode = joinRoomCode.replace(/[^0-9]/g, '').trim();

    if (cleanedRoomCode.length !== 5) {
      setJoinRoomError(t.enterRoomCode + ' (5 digits)');
      return;
    }

    setIsJoiningRoom(true);
    setJoinRoomError('');

    try {
      const data = await apiService.fetchJson(apiService.checkRoomUrl(cleanedRoomCode));
      console.log('Join room response:', data);

      if (!data.exists) {
        throw new Error(data.message || 'Room not found');
      }

      if (onJoinRoom) {
        onJoinRoom(cleanedRoomCode);
        setShowJoinRoomModal(false);
        setJoinRoomCode('');
        setJoinRoomError('');
      } else {
        throw new Error('Join room callback not available');
      }
    } catch (error) {
      console.error('Error joining room:', error);
      setJoinRoomError(`Failed to join room: ${error.message}`);
    } finally {
      setIsJoiningRoom(false);
    }
  };

  // Track reconnection attempts and invalid room state
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [invalidRoom, setInvalidRoom] = useState(false); // Track if room was rejected
  const maxReconnectAttempts = 3; // Limit reconnection attempts
  
  const { sendMessage, lastMessage, readyState } = useWebSocket(socketUrl, {
    // Skip connection if no socketUrl (for students not in a room)
    skip: !socketUrl,
    onOpen: () => {
      console.log('WebSocket connection opened with URL:', socketUrl);
      // Reset reconnection attempts on successful connection
      setReconnectAttempts(0);
      
      // Initialize translation state with empty arrays for selected languages
      const initialTranslations = {};
      targetLanguages.forEach(lang => { initialTranslations[lang] = []; }); // Init with empty arrays
      setTranslations(initialTranslations);
    },
    onClose: () => {
      console.log('WebSocket connection closed');
    },
    onError: (event) => {
      console.error('WebSocket error:', event);
      setErrorMessages(prev => [...prev, `WebSocket error: ${event.type}`]);
    },
    // Only reconnect if we haven't exceeded max attempts and the room is not invalid
    shouldReconnect: (closeEvent) => {
      // Don't reconnect if we know the room is invalid
      if (invalidRoom) {
        console.log('Not reconnecting because room was rejected');
        return false;
      }
      
      const shouldReconnect = reconnectAttempts < maxReconnectAttempts;
      if (shouldReconnect) {
        setReconnectAttempts(prev => prev + 1);
        console.log(`WebSocket reconnect attempt ${reconnectAttempts + 1}/${maxReconnectAttempts}`);
      } else if (reconnectAttempts >= maxReconnectAttempts) {
        console.log(`WebSocket reconnection stopped after ${maxReconnectAttempts} attempts`);
      }
      return shouldReconnect;
    },
    reconnectInterval: (attemptNumber) => Math.min(3000 * Math.pow(1.5, attemptNumber), 30000), // Exponential backoff with 30s max
  });

  // Function for students to generate their own translations
  const generateStudentTranslation = async (englishText, targetLanguage) => {
    try {
      const data = await apiService.fetchJson(apiService.getTranslationUrl(targetLanguage, englishText));
      console.log(`Received ${targetLanguage} translation:`, data);
      const translationData = data; 
      // Update translations state with the student's translation
      setTranslations(prevTranslations => {
        const newTranslations = { ...prevTranslations };
        const currentLangSegments = newTranslations[targetLanguage] || [];
        const updatedSegments = [
          ...currentLangSegments.map(seg => ({ ...seg, isNew: false })),
          { text: translationData.translation || translationData.data, isNew: true }
        ];
        newTranslations[targetLanguage] = updatedSegments.slice(-3);
        return newTranslations;
        });
    } catch (error) {
      console.error(`Error generating ${targetLanguage} translation:`, error);
    }
  };

  // Handle incoming messages
  useEffect(() => {
    if (lastMessage !== null) {
      let parsedData;
      try {
        parsedData = JSON.parse(lastMessage.data);
        console.log('Received parsed message:', parsedData);

        // Check message type and update state accordingly
        if (parsedData.type === 'streaming_transcript') {
          console.log('[Frontend] Received streaming_transcript:', {
            text: parsedData.text?.substring(0, 50),
            isInterim: parsedData.isInterim,
            fullLength: parsedData.text?.length
          });
          
          if (parsedData.isInterim) {
            // Update partial transcript with interim results
            setCurrentPartial(parsedData.text);
          } else {
            // Append finalized text and clear partial
            setFullTranscript(prev => {
              const newText = prev + (prev && !prev.endsWith(' ') ? ' ' : '') + parsedData.text;
              console.log('[Frontend] Updated full transcript, new length:', newText.length);
              return newText;
            });
            setCurrentPartial('');
            
            // For students: generate their own translation when receiving host's final transcript
            if (userRole === 'student' && studentHomeLanguage && parsedData.text) {
              console.log(`Student generating ${studentHomeLanguage} translation for: "${parsedData.text}"`);
              generateStudentTranslation(parsedData.text, studentHomeLanguage);
            }
          }
        } else if (parsedData.type === 'error') {
          console.error('Backend Error:', parsedData.message);
          setErrorMessages(prev => [...prev, `Error: ${parsedData.message}`]);
        } else if (parsedData.type === 'room_error') {
          console.error('Room Error:', parsedData.message);
          setErrorMessages(prev => [...prev, `Room Error: ${parsedData.message}`]);
          // Set invalid room flag to prevent reconnection attempts
          setInvalidRoom(true);
          
          // Optionally, alert the user and redirect to the home page after a timeout
          alert(`Room error: ${parsedData.message}`);
          setTimeout(() => onReset(), 1000); // Go back to home screen after 1 second
        } else if (parsedData.type === 'info') {
          console.log('Backend Info:', parsedData.message);
          // Optionally display info messages somewhere
        } else if (parsedData.type === 'translation') {
          // Handle single translation (non-batch)
          setTranslations(prevTranslations => {
            const newTranslations = { ...prevTranslations };
            const lang = parsedData.lang;
            const currentLangSegments = newTranslations[lang] || [];
            // Only keep the most recent 3 segments
            const updatedSegments = [
              ...currentLangSegments.map(seg => ({ ...seg, isNew: false })),
              { text: parsedData.data, isNew: true }
            ];
            newTranslations[lang] = updatedSegments.slice(-3);
            return newTranslations;
          });
        } else if (parsedData.type === 'translations_batch') {
          console.log('Received Translation Batch:', parsedData.data);
          // Update multiple translations
          setTranslations(prevTranslations => {
            const newTranslations = { ...prevTranslations };
            for (const lang in parsedData.data) {
              if (parsedData.data.hasOwnProperty(lang)) {
                const currentLangSegments = newTranslations[lang] || [];
                const updatedSegments = [
                  ...currentLangSegments.map(seg => ({ ...seg, isNew: false })),
                  { text: parsedData.data[lang], isNew: true }
                ];
                newTranslations[lang] = updatedSegments.slice(-3);
              }
            }
            return newTranslations;
          });
        } else if (
          parsedData.type === 'webrtc_offer' ||
          parsedData.type === 'webrtc_answer' ||
          parsedData.type === 'webrtc_ice'
        ) {
          const handler = webrtcSignalHandlerRef.current;
          if (handler) {
            try { handler(parsedData); } catch (e) { console.warn('Failed to handle webrtc signal via handler:', e); }
          } else {
            pendingWebrtcSignalsRef.current.push(parsedData);
          }
        } else {
            console.warn('Received unknown message type:', parsedData.type);
        }

      } catch (e) {
        console.error('Failed to parse message or unknown message format:', lastMessage.data);
        // Add raw message to history if parsing fails
        // setMessageHistory((prev) => prev.concat(lastMessage));
      }
    }
  }, [lastMessage]); // Update dependency array

  

  // Handlers for recording controls (passed down to components that need to send audio)
  const handleStartRecording = useCallback(() => {
    console.log('APP: Start Recording');
    setIsRecording(true);
  }, [targetLanguages]);

  const handleStopRecording = useCallback(() => {
    console.log('APP: Stop Recording');
    setIsRecording(false);
  }, []);

  const onAudioSent = useCallback(() => {
    console.log("Audio chunk sent");
    setShowNotification(true);
    setNotificationOpacity(1); // Ensure it's fully visible initially

    // Clear any existing timeout
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
    }

    // Set new timeout for fade and hide
    notificationTimeoutRef.current = setTimeout(() => {
      setNotificationOpacity(0); // Start fading out
      notificationTimeoutRef.current = setTimeout(() => {
        setShowNotification(false); // Hide after fade
      }, 1000); // Fade duration
    }, 1000); // Initial display duration
  }, []);

  // Handle app mode changes from dropdown menu
  const handleAppModeChange = useCallback((newMode) => {
    console.log(`Mode change requested: ${appMode} → ${newMode}`);
    
    // Automatically stop recording when switching modes
    if (isRecording && newMode !== 'audio' && newMode !== 'video') {
      console.log('Automatically stopping recording due to mode change');
      setIsRecording(false);
    }
    
    if (newMode === 'dictionary') {
      // Just update local state for dictionary mode
      console.log('Setting mode to dictionary (local only)');
      setAppMode('dictionary');
    } else if (newMode === 'flashcard') {
      // Just update local state for flashcard mode
      console.log('Setting mode to flashcard (local only)');
      setAppMode('flashcard');
    } else if (newMode === 'audio') {
      // Just update local state for audio mode
      console.log('Setting mode to audio (local only)');
      setAppMode('audio');
    } else if (newMode === 'video') {
      // Update to video mode
      console.log('Setting mode to video (local only)');
      setAppMode('video');
    }
  }, [appMode, isRecording]);

  // Get connection status string
  const connectionStatus = {
    [ReadyState.CONNECTING]: 'Connecting',
    [ReadyState.OPEN]: 'Connected',
    [ReadyState.CLOSING]: 'Closing',
    [ReadyState.CLOSED]: 'Closed',
    [ReadyState.UNINSTANTIATED]: 'Uninstantiated',
  }[readyState];

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
    };
  }, []);

  // Calendar queue (available globally so it works in both dictionary and flashcard modes)
  const { queue, reorderQueue } = useFlashcardCalendar(
    [],
    wordDefinitions,
    [],
    selectedProfile || internalSelectedProfile,
    [],
    0
  );

  // Open join modal when classroom tapped from toolbar
  useEffect(() => {
    const open = () => setShowJoinRoomModal(true);
    window.addEventListener('openJoinRoom', open);
    return () => window.removeEventListener('openJoinRoom', open);
  }, []);

  // Track bottom toolbar height to keep transcript 10px above it
  useEffect(() => {
    const el = () => document.getElementById('pc-bottom-toolbar');
    function updateVar() {
      const h = el()?.offsetHeight || 72;
      document.documentElement.style.setProperty('--bottom-toolbar-h', `${h}px`);
    }
    updateVar();
    window.addEventListener('resize', updateVar);
    const mo = new MutationObserver(updateVar);
    const node = el();
    if (node) mo.observe(node, { attributes: true, childList: true, subtree: true });
    const id = setInterval(updateVar, 250);
    return () => { window.removeEventListener('resize', updateVar); mo.disconnect(); clearInterval(id); };
  }, []);

  return (
    <div className="App">
      {/* Fullscreen button - upper left corner for all modes */}
      <button
        onClick={() => {
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
          } else {
            document.exitFullscreen();
          }
        }}
        style={{
          position: 'fixed',
          top: '20px',
          left: '20px',
          zIndex: 1001,
          background: 'rgba(35, 35, 58, 0.9)',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          width: 44,
          height: 44,
          fontSize: 20,
          fontWeight: 700,
          cursor: 'pointer',
          transition: 'background 0.2s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
        }}
        aria-label="Toggle Full Screen"
        title="Full Screen (F11)"
      >
        <span>⛶</span>
      </button>

      {/* Header container with logo and room code */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        margin: '24px 24px 12px 24px',
        width: 'calc(100% - 48px)'
      }}>
        {/* Left spacer for balance */}
        <div style={{ width: '200px' }}></div>
        
        {/* Centered logo */}
        <h1
          className="polycast-title"
          style={{
            color: '#fff',
            fontSize: '3rem',
            fontWeight: 900,
            letterSpacing: '0.06em',
            textShadow: '0 4px 24px #0008',
            cursor: 'pointer',
            transition: 'opacity 0.2s',
            margin: 0,
            flex: '0 0 auto',
          }}
          onClick={() => window.location.reload()}
          onMouseOver={e => (e.currentTarget.style.opacity = 0.85)}
          onMouseOut={e => (e.currentTarget.style.opacity = 1)}
        >
          Polycast
        </h1>
        
        {/* Right side - room code or spacer */}
        <div style={{ width: '200px', display: 'flex', justifyContent: 'flex-end' }}>
          {roomSetup && (
            <div 
              className="room-info-display" 
              style={{
                color: '#fff',
                fontSize: '1rem',
                fontWeight: 600,
                padding: '8px 16px',
                borderRadius: '8px',
                background: roomSetup.isHost ? 'rgba(59, 130, 246, 0.6)' : 'rgba(16, 185, 129, 0.6)',
              }}
            >
              {roomSetup?.isHost ? `${ui.room}: ${roomSetup?.roomCode || '—'}` : `${ui.student} • ${ui.room}: ${roomSetup?.roomCode || '—'}`}
            </div>
          )}
        </div>
      </div>
      {/* Top toolbar: show only for host in audio mode */}
      {appMode === 'audio' && roomSetup && roomSetup.isHost && (
        <div className="controls-container" style={{ marginBottom: 4 }}>
          <div className="main-toolbar" style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'stretch', marginBottom: 0 }}>
            {isRecording && (
              <div style={{
                position: 'absolute',
                top: 100,
                left: '50%',
                transform: 'translateX(-50%)',
                color: '#ff5733',
                fontWeight: 'bold',
                fontSize: '1.1rem',
                textShadow: '0 1px 3px #fff',
                pointerEvents: 'none',
                letterSpacing: 0.2,
                opacity: 0.98,
                zIndex: 2,
              }}>
                {ui.recording}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <AudioRecorder
                sendMessage={sendMessage}
                isRecording={isRecording}
                onAudioSent={onAudioSent}
              />
            </div>
            <HostToolbar
              showTBA={showTBA}
              readyState={readyState}
              isRecording={isRecording}
              onStartRecording={handleStartRecording}
              onStopRecording={handleStopRecording}
              appMode={appMode}
              setAppMode={handleAppModeChange}
              toolbarStats={toolbarStats}
              showLiveTranscript={true}
              setShowLiveTranscript={() => {}}
              showTranslation={false}
              setShowTranslation={() => {}}
              roomSetup={roomSetup}
              selectedProfile={selectedProfile || internalSelectedProfile}
              setSelectedProfile={profile => {
                console.log('Profile switched to:', profile);
                if (onProfileChange) {
                  onProfileChange(profile);
                } else {
                  setSelectedProfile(profile);
                }
              }}
              userRole={userRole}
            />
          </div>
        </div>
      )}

      {/* Student guidance in audio mode (no toolbar) */}
      {appMode === 'audio' && roomSetup && !roomSetup.isHost && (
        <div style={{
          marginTop: -45,
          marginBottom: 0,
          width: '100%',
          textAlign: 'center',
          color: '#10b981',
          fontWeight: 600,
          fontSize: '1.05rem',
          letterSpacing: 0.1,
          textShadow: '0 1px 2px #2228',
          opacity: 0.96,
          userSelect: 'none',
        }}>
          Viewing host's transcription in real-time • <span style={{ color: '#ffb84d' }}>Click words to add to dictionary</span>
        </div>
      )}
      
      {/* Header right: video call host/join controls and role indicator */}
      <div style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 100, display: 'flex', gap: '8px', alignItems: 'center' }}>
        {appMode === 'video' && !roomSetup && (
          <>
            <button
              onClick={async () => {
                try {
                  const data = await apiService.postJson(apiService.createRoomUrl(), {});
                  if (data && data.roomCode) {
                    // Become host for this call
                    if (typeof window !== 'undefined' && window.history && window.history.replaceState) {
                      try { window.history.replaceState({}, '', '/'); } catch {}
                    }
                    // Simulate host selection flow: we don't have setter here, but we can reload props
                    // Prefer: notify parent via onJoinRoom-like host setter. As a fallback, reload.
                    if (onJoinRoom) {
                      // Use parent to set room as student if needed; but here we need host
                      // No direct host setter passed, so fallback to full reload with a hint
                      console.log('Room created. Please navigate back to landing to enter as host if not auto-connected.');
                    }
                    // Store a hint for Main to pick up (optional)
                    try { sessionStorage.setItem('pc_pendingHostRoom', data.roomCode); } catch {}
                    // Soft navigation: we rely on current session props update from Main on next mount
                    window.location.reload();
                  }
                } catch (e) {
                  alert('Failed to create room: ' + (e?.message || e));
                }
              }}
              style={{ padding: '8px 16px', fontSize: 14, borderRadius: 4, background: '#3b82f6', color: '#fff', border: 'none', cursor: 'pointer' }}
            >
              Host call
            </button>
            <button
              onClick={() => setShowJoinRoomModal(true)}
              style={{ padding: '8px 16px', fontSize: 14, borderRadius: 4, background: '#10b981', color: '#fff', border: 'none', cursor: 'pointer' }}
            >
              Join call
            </button>
          </>
        )}

        {appMode === 'video' && roomSetup && (
          <>
            <div style={{ fontSize: 14, color: '#fff', marginRight: 8, background: 'rgba(0,0,0,0.3)', padding: '8px 12px', borderRadius: 4 }}>
              {roomSetup.isHost ? `Host • ${ui.room}: ${roomSetup.roomCode}` : `${ui.student} • ${ui.room}: ${roomSetup.roomCode}`}
            </div>
            <button onClick={onReset} style={{ padding: '8px 16px', fontSize: 14, borderRadius: 4, background: '#444', color: '#fff', border: 'none', cursor: 'pointer' }}>End call</button>
          </>
        )}
      </div>
      
      {/* Error messages */}
      {errorMessages.length > 0 && (
        <div className="error-messages">
          {/* Error content would go here */}
        </div>
      )}
      {/* Notification Pop-up */} 
      {showNotification && (
        <div 
          className="notification-popup" 
          style={{ opacity: notificationOpacity }}
        >
          Audio sent for transcription
        </div>
      )}
      <div className="display-container">
        {appMode === 'dictionary' ? (
          <DictionaryTable 
            wordDefinitions={wordDefinitions}
            selectedProfile={selectedProfile || internalSelectedProfile}
            isAddingWordBusy={isAddingWordBusy}
            toolbarStats={toolbarStats}
            onAddWordSenses={handleAddWordSenses}
            onRemoveWord={(wordSenseId, word) => {
              console.log(`Removing word from dictionary: ${word} (${wordSenseId})`);
              try {
                // Get the word entry from wordSenseId
                const wordEntry = wordDefinitions[wordSenseId];
                if (!wordEntry) {
                  console.warn(`Could not find entry for sense ID: ${wordSenseId}`);
                  return;
                }
                
                const wordLower = wordEntry.word.toLowerCase();
                
                // Only remove the specific wordSenseId that was clicked
                const senseIdsToRemove = [wordSenseId];
                console.log(`Removing only the specific sense: ${wordSenseId}`);
                
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
                  
                  // Remove all sense entries for this word
                  senseIdsToRemove.forEach(senseId => {
                    if (updated[senseId]) {
                      delete updated[senseId];
                      console.log(`Removed sense entry: ${senseId}`);
                    }
                  });
                  
                  return updated;
                });
                
                // Only remove the word from selectedWords if this is the last sense of the word
                let updatedSelectedWords = [...selectedWords];
                if (isLastSenseOfWord) {
                  setSelectedWords(prev => {
                    return prev.filter(selectedWord => selectedWord.toLowerCase() !== wordLower);
                  });
                  updatedSelectedWords = selectedWords.filter(w => w.toLowerCase() !== wordLower);
                  console.log(`Removed '${wordLower}' from selectedWords as it was the last sense`); 
                } else {
                  console.log(`Kept '${wordLower}' in selectedWords as other senses remain`);
                }
                
                // Save to backend disabled (local-only).
                // Re-enable when Firebase persistence is implemented.
              } catch (error) {
                console.error(`Error removing word from dictionary: ${error}`);
                showError(`Failed to delete "${word}" from dictionary. Please try again.`);
              }
            }}
            onAddWord={(word) => {
              console.log(`Adding word to dictionary (local): ${word}`);
              handleAddWord(word);
            }}
          />
        ) : appMode === 'flashcard' ? (
          <FlashcardMode 
            selectedWords={selectedWords}
            wordDefinitions={wordDefinitions}
            setWordDefinitions={setWordDefinitions}
            fullTranscript={fullTranscript}
            targetLanguages={effectiveLanguages}
            selectedProfile={selectedProfile || internalSelectedProfile}
          />
        ) : appMode === 'video' ? (
          <VideoMode
            sendMessage={sendMessage}
            isRecording={isRecording}
            onStartRecording={handleStartRecording}
            onStopRecording={handleStopRecording}
            roomSetup={roomSetup}
            fullTranscript={fullTranscript}
            currentPartial={currentPartial}
            translations={translations}
            targetLanguages={effectiveLanguages}
            selectedProfile={selectedProfile || internalSelectedProfile}
            studentHomeLanguage={studentHomeLanguage}
            selectedWords={selectedWords}
            setSelectedWords={setSelectedWords}
            wordDefinitions={wordDefinitions}
            setWordDefinitions={setWordDefinitions}
            onAddWord={(word) => {
              console.log(`Add from popup (video mode): ${word}`);
              handleAddWord(word);
            }}
            showTBA={showTBA}
            registerWebrtcSignalHandler={(handler) => {
              webrtcSignalHandlerRef.current = handler;
              const q = pendingWebrtcSignalsRef.current;
              pendingWebrtcSignalsRef.current = [];
              q.forEach((msg) => { try { handler(msg); } catch (e) { console.warn('Failed delivering pending signal:', e); } });
            }}
            unregisterWebrtcSignalHandler={() => { webrtcSignalHandlerRef.current = null; }}
          />
        ) : (
          <TranscriptionDisplay 
            showTBA={showTBA}
            fullTranscript={fullTranscript}
            currentPartial={currentPartial}
            translations={translations} 
            targetLanguages={effectiveLanguages} 
            showLiveTranscript={true}
            showTranslation={false}
            isStudentMode={roomSetup && !roomSetup.isHost}
            studentHomeLanguage={studentHomeLanguage}
            selectedWords={selectedWords}
            setSelectedWords={setSelectedWords}
            wordDefinitions={wordDefinitions}
            setWordDefinitions={setWordDefinitions}
            selectedProfile={selectedProfile}
            onAddWord={(word) => {
              console.log(`Add from popup (local): ${word}`);
              handleAddWord(word);
            }}
          />
        )}
      </div>
      
      {/* Join Room Modal */}
      {showJoinRoomModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: '#23243a',
            borderRadius: 16,
            padding: 36,
            minWidth: 400,
            textAlign: 'center',
            boxShadow: '0 4px 18px 0 rgba(60, 60, 90, 0.2)'
          }}>
            <h2 style={{ color: '#fff', marginBottom: 24 }}>{ui.joinRoom}</h2>
            <p style={{ color: '#b3b3e7', marginBottom: 24, fontSize: 14 }}>
              {ui.enterRoomCode}
            </p>
            
            <input
              type="text"
              value={joinRoomCode}
              onChange={(e) => setJoinRoomCode(e.target.value)}
              placeholder={ui.roomCode}
              maxLength={5}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: 18,
                borderRadius: 4,
                border: '1px solid #444',
                background: '#fff',
                color: '#000',
                textAlign: 'center',
                boxSizing: 'border-box',
                marginBottom: 16
              }}
            />
            
            {joinRoomError && (
              <div style={{ color: '#dc2626', marginBottom: 16, fontSize: 14 }}>
                {joinRoomError}
              </div>
            )}
            
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                onClick={() => {
                  setShowJoinRoomModal(false);
                  setJoinRoomCode('');
                  setJoinRoomError('');
                }}
                disabled={isJoiningRoom}
                style={{
                  padding: '12px 24px',
                  fontSize: 16,
                  borderRadius: 4,
                  background: '#444',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                {ui.cancel}
              </button>
              <button
                onClick={handleJoinRoom}
                disabled={isJoiningRoom}
                style={{
                  padding: '12px 24px',
                  fontSize: 16,
                  borderRadius: 4,
                  background: '#10b981',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                {isJoiningRoom ? ui.joinButton + '...' : ui.joinButton}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Popup */}
      <ErrorPopup error={popupError} onClose={clearError} />
      {/* Flashcard Calendar Modal (global) */}
      <FlashcardCalendarModal
        showCalendar={showCalendar}
        setShowCalendar={setShowCalendar}
        queue={queue}
        onReorder={reorderQueue}
      />
      <TBAPopup tba={popupTBA} onClose={clearTBA} />

      {/* Mode Selector */}
      <ModeSelector
        appMode={appMode}
        onModeChange={handleAppModeChange}
        userRole={userRole}
        roomSetup={roomSetup}
        selectedProfile={selectedProfile || internalSelectedProfile}
      />

    </div>
  )
}

// Update PropTypes
App.propTypes = {
    targetLanguages: PropTypes.arrayOf(PropTypes.string).isRequired,
    onReset: PropTypes.func,
    roomSetup: PropTypes.shape({
        isHost: PropTypes.bool.isRequired,
        roomCode: PropTypes.string.isRequired
    }), // Made optional for students not in a room
    userRole: PropTypes.oneOf(['host', null]),
    studentHomeLanguage: PropTypes.string,
    onJoinRoom: PropTypes.func,
    onHostRoom: PropTypes.func,
    onFlashcardModeChange: PropTypes.func
};

export default App