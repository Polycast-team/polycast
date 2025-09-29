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
import {
  getLanguageForProfile,
  getFlashcardTranslationsForProfile,
  getNativeLanguageForProfile,
  getUITranslationsForProfile,
  getRegisteredProfiles,
  getAppTranslationsForProfile,
  getVoiceTranslationsForProfile,
  getErrorTranslationsForProfile,
} from './utils/profileLanguageMapping.js';
import { getAppStrings } from './i18n/index.js';
import TBAPopup from './components/popups/TBAPopup';
import { useTBAHandler } from './hooks/useTBAHandler';
import apiService from './services/apiService.js';
import authClient from './services/authClient.js';
import { createFlashcardEntry } from './components/FixedCardDefinitions';
import { extractSentenceWithWord, markClickedWordInSentence } from './utils/wordClickUtils';
import ModeSelector from './components/ModeSelector';
import AIMode from './components/ai/AIMode';
import SettingsButton from './components/SettingsButton';



// App now receives an array of target languages and room setup as props
function App({
  targetLanguages,
  selectedProfile,
  currentProfile,
  profileLoading,
  onReset,
  roomSetup,
  userRole,
  studentHomeLanguage,
  onJoinRoom,
  onHostRoom,
  onFlashcardModeChange,
  onProfileChange,
}) {
  // Debug logging
  console.log('App component received props:', { targetLanguages, selectedProfile, currentProfile, roomSetup, userRole, studentHomeLanguage });

  const fallbackAppStrings = getAppStrings('en');

  if (profileLoading) {
    const interimAppStrings = selectedProfile
      ? getAppTranslationsForProfile(selectedProfile)
      : {
          ...fallbackAppStrings,
          loadingProfile: `[fallback:en] ${fallbackAppStrings.loadingProfile}`,
        };
    if (!selectedProfile) {
      console.warn('[i18n-fallback] Displaying loading screen using English while profile selects.');
    }
    return (
      <div className="app-loading-state">
        {interimAppStrings.loadingProfile}
      </div>
    );
  }

  if (!selectedProfile) {
    throw new Error('App requires a selected profile before rendering');
  }

  if (!Array.isArray(targetLanguages) || targetLanguages.length === 0) {
    throw new Error('App requires at least one target language');
  }

  // Get translations for this profile's language
  const flashcardStrings = getFlashcardTranslationsForProfile(selectedProfile);
  const ui = getUITranslationsForProfile(selectedProfile);
  const appStrings = getAppTranslationsForProfile(selectedProfile);
  const voiceStrings = getVoiceTranslationsForProfile(selectedProfile);
  const errorStrings = getErrorTranslationsForProfile(selectedProfile);

  const [internalSelectedProfile, setSelectedProfile] = React.useState(selectedProfile);

  useEffect(() => {
    if (selectedProfile && selectedProfile !== internalSelectedProfile) {
      setSelectedProfile(selectedProfile);
    }
  }, [selectedProfile, internalSelectedProfile]);
  
  // Join Room state for students
  const [showJoinRoomModal, setShowJoinRoomModal] = useState(false);
  const [joinRoomCode, setJoinRoomCode] = useState('');
  const [joinRoomError, setJoinRoomError] = useState('');
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  
  // Function to fetch profile data from backend
  const fetchProfileData = useCallback(async (profile) => {
    if (!profile) {
      throw new Error('Cannot fetch profile data without a profile identifier');
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
    const currentProfile = internalSelectedProfile;
    fetchProfileData(currentProfile);
  }, [internalSelectedProfile, fetchProfileData]);
  // Use host-selected languages for WebSocket communication; students use their profile language
  const profileLanguage = getLanguageForProfile(internalSelectedProfile);
  const registeredProfiles = getRegisteredProfiles();
  if (userRole === 'host' && (!targetLanguages || targetLanguages.length === 0)) {
    throw new Error('Host sessions require at least one target language');
  }

  const effectiveLanguages = userRole === 'host' ? targetLanguages : [profileLanguage];
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
  const [transcriptBlocks, setTranscriptBlocks] = useState([]); // [{speaker:'host'|'student', lines: string[], partial: string}]
  const [translations, setTranslations] = useState({}); // Structure: { lang: [{ text: string, isNew: boolean }] }
  const [errorMessages, setErrorMessages] = useState([]); 
  
  // Default to dictionary mode for all users
  const [appMode, setAppMode] = useState('dictionary'); // Options: 'audio', 'dictionary', 'flashcard', 'video', 'ai'
  const [selectedWords, setSelectedWords] = useState([]); // Profile-scoped selected words
  const [wordDefinitions, setWordDefinitions] = useState({}); // Profile-scoped word definitions
  const [showNotification, setShowNotification] = useState(false);
  const [notificationOpacity, setNotificationOpacity] = useState(1);
  const [isAddingWordBusy, setIsAddingWordBusy] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [toolbarStats, setToolbarStats] = useState({ newCards: 0, learningCards: 0, reviewCards: 0 });
  const [signalLog, setSignalLog] = useState([]); // recent signaling/debug events
  const [srsSettingsVersion, setSrsSettingsVersion] = useState(0);
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

  // Load dictionary from server after login (no localStorage)
  useEffect(() => {
    const token = authClient.getToken && authClient.getToken();
    if (!token) {
      // Skip server dictionary fetch if not authenticated to avoid 401 noise
      return;
    }
    async function loadServerDictionary() {
      try {
        const rows = await apiService.fetchJson(`${apiService.baseUrl}/api/dictionary`);
        const map = {};
        (rows || []).forEach(r => {
          // Reconstruct display fields from gemini_unified_json if available
          const u = r.gemini_unified_json || {};
          const isNewFromDb = !r.due_at; // Persisted notion: no due_at means never reviewed
          map[r.sense_key] = {
            dbId: r.id,
            word: r.word,
            wordSenseId: r.sense_key,
            translation: u.translation || '',
            definition: u.definition || '',
            frequency: u.frequency || 5,
            exampleSentencesGenerated: u.exampleSentencesGenerated || '',
            exampleForDictionary: u.exampleForDictionary || '',
            contextualExplanation: u.definition || '',
            inFlashcards: true,
            srsData: {
              // Map DB SRS to client shape based on persisted fields
              status: isNewFromDb ? 'new' : 'review',
              isNew: isNewFromDb,
              gotWrongThisSession: false,
              SRS_interval: r.study_interval_level || 1,
              dueDate: r.due_at || null,
              nextReviewDate: r.due_at || null,
            }
          };
        });
        setWordDefinitions(map);
        setSelectedWords(Array.from(new Set((rows || []).map(r => r.word))));
      } catch (e) {
        console.error('Failed to load server dictionary:', e);
      }
    }
    loadServerDictionary();
  }, []);

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
    const nativeLanguage = getNativeLanguageForProfile(internalSelectedProfile);
    const targetLanguage = getLanguageForProfile(internalSelectedProfile);
    
    // Extract sentence and mark the word with tildes
    let sentence = extractSentenceWithWord(fullTranscript || '', wordLower);
    if (!sentence || !sentence.trim()) {
      console.debug('[handleAddWord] No transcript context found; falling back to word only.');
      sentence = wordLower;
    }

    // For Add Word flow, we mark the first occurrence since user is adding from menu
    const wordRegex = new RegExp(`\\b(${wordLower})\\b`, 'i');
    let sentenceWithMarkedWord = sentence.replace(
      wordRegex,
      '~$1~'
    );

    if (!sentenceWithMarkedWord.includes('~')) {
      sentenceWithMarkedWord = `~${wordLower}~`;
    }

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

      // Persist to server, then update local state with dbId
      console.log('sending');
      const saved = await apiService.postJson(`${apiService.baseUrl}/api/dictionary`, {
        word: wordLower,
        senseKey: wordSenseId,
        geminiUnifiedText: unifiedData.rawText || '',
        geminiUnifiedJson: unifiedData || null,
        studyIntervalLevel: 1,
        dueAt: null,
      });
      try {
        const all = await apiService.fetchJson(`${apiService.baseUrl}/api/dictionary`);
        console.log('server dictionary after save:', all);
      } catch (e) {
        console.warn('failed to fetch server dictionary after save:', e);
      }

      // No separate flashcards; SRS fields live on the wordsense row now

      setWordDefinitions((prev) => ({ ...prev, [wordSenseId]: { ...enriched, dbId: saved?.id } }));
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
    const nativeLanguage = getNativeLanguageForProfile(internalSelectedProfile);
    const targetLanguage = getLanguageForProfile(internalSelectedProfile);
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
        
        // Persist to server
        let saved = null;
        try {
          saved = await apiService.postJson(`${apiService.baseUrl}/api/dictionary`, {
            word: wordLower,
            senseKey: wordSenseId,
            geminiUnifiedText: unifiedData.rawText || '',
            geminiUnifiedJson: unifiedData || null,
            studyIntervalLevel: 1,
            dueAt: null,
          });
        } catch (e) {
          console.warn('Failed to persist wordsense:', e);
        }

        const enriched = {
          ...entry,
          translation: unifiedData.translation || sense?.translation || '',
          example: unifiedData.exampleForDictionary || sense?.example || '',
          contextSentence: sentenceWithMarkedWord,
          frequency: unifiedData.frequency || Math.max(1, Math.min(10, Number(sense?.frequency) || 5)),
          exampleSentencesGenerated: unifiedData.exampleSentencesGenerated || '',
          dbId: saved?.id
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
      setJoinRoomError(errorStrings.joinRoomCodeLength);
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
      setSignalLog(prev => [`ws: open ${socketUrl}`, ...prev].slice(0, 10));
      // Reset reconnection attempts on successful connection
      setReconnectAttempts(0);
      
      // Initialize translation state with empty arrays for selected languages
      const initialTranslations = {};
      targetLanguages.forEach(lang => { initialTranslations[lang] = []; }); // Init with empty arrays
      setTranslations(initialTranslations);
    },
    onClose: () => {
      console.log('WebSocket connection closed');
      setSignalLog(prev => ['ws: close', ...prev].slice(0, 10));
    },
    onError: (event) => {
      console.error('WebSocket error:', event);
      setSignalLog(prev => [`ws: error ${event?.type || ''}`, ...prev].slice(0, 10));
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
          
          const speaker = parsedData.speaker || 'host';

          // Maintain grouped transcript blocks by speaker
          setTranscriptBlocks(prev => {
            const blocks = [...prev];
            const last = blocks[blocks.length - 1];
            if (!last || last.speaker !== speaker) {
              blocks.push({ speaker, lines: [], partial: '' });
            }
            const idx = blocks.length - 1;
            if (parsedData.isInterim) {
              blocks[idx].partial = parsedData.text || '';
            } else {
              const text = parsedData.text || '';
              if (text.trim()) blocks[idx].lines.push(text);
              blocks[idx].partial = '';
            }
            return blocks.slice(-100); // cap history
          });

          // Keep legacy concatenated transcript for compatibility
          if (parsedData.isInterim) {
            setCurrentPartial(parsedData.text);
          } else {
            setFullTranscript(prev => {
              const newText = prev + (prev && !prev.endsWith(' ') ? ' ' : '') + parsedData.text;
              console.log('[Frontend] Updated full transcript, new length:', newText.length);
              return newText;
            });
            setCurrentPartial('');
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
          setSignalLog(prev => [`info: ${parsedData.message}`, ...prev].slice(0, 10));
        } else if (parsedData.type === 'transcript_history') {
          // Handle transcript history for newly joined students
          console.log('[Frontend] Received transcript_history:', parsedData.data);
          const lines = (parsedData.data || []).map((item) => item && item.text).filter(Boolean);
          if (lines.length > 0) {
            setTranscriptBlocks([{ speaker: 'host', lines, partial: '' }]);
            setFullTranscript(lines.join(' '));
            setCurrentPartial('');
          }
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
          try {
            const summary = parsedData.type === 'webrtc_ice'
              ? `ice: ${parsedData?.candidate?.candidate?.slice(0, 28) || 'candidate'}`
              : `${parsedData.type.replace('webrtc_', '')}`;
            setSignalLog(prev => [`rtc: ${summary}`, ...prev].slice(0, 10));
          } catch (_) {}
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
    } else if (newMode === 'ai') {
      console.log('Setting mode to AI chat');
      setAppMode('ai');
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
    internalSelectedProfile,
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
      {/* Debug overlay removed */}
      {/* Global Settings - upper left */}
      <SettingsButton onSrsChange={() => setSrsSettingsVersion(v => v + 1)} />
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
          left: '72px',
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
          {appStrings.appName}
        </h1>
        
        {/* Right side spacer only; colored room pill moved to top-right header */}
        <div style={{ width: '200px' }} />
      </div>
      {/* Top toolbar: show in audio mode (available pre-room too) */}
      {appMode === 'audio' && (
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
                selectedProfile={internalSelectedProfile}
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
                selectedProfile={internalSelectedProfile}
                setSelectedProfile={profile => {
                  console.log('Profile switched to:', profile);
                  if (onProfileChange) {
                    onProfileChange(profile);
                  } else {
                    setSelectedProfile(profile);
                  }
                }}
                availableProfiles={registeredProfiles}
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
          {voiceStrings.studentLiveBannerPrefix}
          {' • '}
          <span style={{ color: '#ffb84d' }}>{voiceStrings.studentLiveBannerHighlight}</span>
        </div>
      )}
      
      {/* Header right: logout + host/join controls */}
      <div style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 100, display: 'flex', gap: '8px', alignItems: 'center' }}>
        <button
          onClick={() => { try { authClient.clearToken(); } catch {}; window.location.assign('/'); }}
          style={{ padding: '8px 12px', fontSize: 14, borderRadius: 4, background: '#ef4444', color: '#fff', border: 'none', cursor: 'pointer' }}
          title={appStrings.logout}
        >
          {appStrings.logout}
        </button>
        {(appMode === 'video' || appMode === 'audio') && !roomSetup && (
          <>
            <button
              onClick={async () => {
                // Preserve current mode; ask parent to host and update props in place
                try { await onHostRoom?.(); }
                catch (e) { alert(errorStrings.createRoomFailed(e?.message || e)); }
              }}
              style={{ padding: '8px 16px', fontSize: 14, borderRadius: 4, background: '#3b82f6', color: '#fff', border: 'none', cursor: 'pointer' }}
            >
              {appStrings.hostCall}
            </button>
            <button
              onClick={() => setShowJoinRoomModal(true)}
              style={{ padding: '8px 16px', fontSize: 14, borderRadius: 4, background: '#10b981', color: '#fff', border: 'none', cursor: 'pointer' }}
            >
              {appStrings.joinCall}
            </button>
          </>
        )}

        {appMode === 'video' && roomSetup && (
          <>
            <div 
              className="room-info-display" 
              style={{
                color: '#fff',
                fontSize: 14,
                fontWeight: 600,
                padding: '8px 12px',
                borderRadius: 8,
                background: roomSetup.isHost ? 'rgba(59, 130, 246, 0.6)' : 'rgba(16, 185, 129, 0.6)',
                marginRight: 8,
              }}
            >
              {roomSetup.isHost ? `${ui.room}: ${roomSetup.roomCode}` : `${ui.student} • ${ui.room}: ${roomSetup.roomCode}`}
            </div>
            <button onClick={onReset} style={{ padding: '8px 16px', fontSize: 14, borderRadius: 4, background: '#444', color: '#fff', border: 'none', cursor: 'pointer' }}>{appStrings.endCall}</button>
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
          {appStrings.audioSentNotification}
        </div>
      )}
      <div className="display-container">
        {appMode === 'dictionary' ? (
          <DictionaryTable 
            wordDefinitions={wordDefinitions}
            selectedProfile={internalSelectedProfile}
            isAddingWordBusy={isAddingWordBusy}
            toolbarStats={toolbarStats}
            onAddWordSenses={handleAddWordSenses}
            onRemoveWord={async (wordSenseId, word) => {
              console.log(`Removing word from dictionary: ${word} (${wordSenseId})`);
              try {
                // Get the word entry from wordSenseId
                const wordEntry = wordDefinitions[wordSenseId];
                if (!wordEntry) {
                  console.warn(`Could not find entry for sense ID: ${wordSenseId}`);
                  return;
                }
                
                const wordLower = wordEntry.word.toLowerCase();
                // Persist delete if this entry exists in DB
                if (wordEntry.dbId) {
                  try {
                    await apiService.fetchJson(`${apiService.baseUrl}/api/dictionary/${wordEntry.dbId}`, { method: 'DELETE' });
                  } catch (e) { console.warn('Server delete failed:', e); }
                }
                
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
            key={`flashcard-${srsSettingsVersion}`}
            selectedWords={selectedWords}
            wordDefinitions={wordDefinitions}
            setWordDefinitions={setWordDefinitions}
            fullTranscript={fullTranscript}
            targetLanguages={effectiveLanguages}
            selectedProfile={internalSelectedProfile}
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
            transcriptBlocks={transcriptBlocks}
            translations={translations}
            targetLanguages={effectiveLanguages}
            selectedProfile={internalSelectedProfile}
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
        ) : appMode === 'ai' ? (
          <AIMode
            selectedProfile={internalSelectedProfile}
            selectedWords={selectedWords}
            wordDefinitions={wordDefinitions}
            setWordDefinitions={setWordDefinitions}
            onAddWord={(word) => {
              console.log(`Add from popup (AI mode): ${word}`);
              handleAddWord(word);
            }}
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
        selectedProfile={internalSelectedProfile}
      />

    </div>
  )
}

// Update PropTypes
App.propTypes = {
    targetLanguages: PropTypes.arrayOf(PropTypes.string).isRequired,
    selectedProfile: PropTypes.string,
    currentProfile: PropTypes.shape({
        id: PropTypes.number,
        username: PropTypes.string,
        native_language: PropTypes.string,
        target_language: PropTypes.string,
    }),
    profileLoading: PropTypes.bool.isRequired,
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
