import React, { useState, useCallback, useEffect, useRef } from 'react';
import PropTypes from 'prop-types'; // Add PropTypes import
import useWebSocket, { ReadyState } from 'react-use-websocket';
import './App.css'

// Import planned components (will be created next)
import AudioRecorder from './components/AudioRecorder';
import Controls from './components/Controls';

import TranscriptionDisplay from './components/TranscriptionDisplay';
import DictionaryTable from './components/DictionaryTable';
import FlashcardMode from './components/FlashcardMode';

// App now receives an array of target languages and room setup as props
function App({ targetLanguages, onReset, roomSetup }) {
  // Step 1: Add selectedProfile state
  const [selectedProfile, setSelectedProfile] = React.useState('non-saving');
  
  // Function to fetch profile data from backend
  const fetchProfileData = useCallback(async (profile) => {
    if (profile === 'non-saving') {
      // Clear existing data for non-saving mode
      setWordDefinitions({});
      setSelectedWords([]);
      console.log('Switched to non-saving mode. Cleared flashcards and highlighted words.');
      return;
    }
    
    try {
      console.log(`Fetching data for profile: ${profile}`);
      const response = await fetch(`https://polycast-server.onrender.com/api/profile/${profile}/words`);
      const data = await response.json();
      
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
    }
  }, []);
  
  // Fetch profile data when selectedProfile changes
  useEffect(() => {
    fetchProfileData(selectedProfile);
  }, [selectedProfile, fetchProfileData]);
  // For students, always use Spanish regardless of what the host selected
  const effectiveLanguages = roomSetup && !roomSetup.isHost ? ['Spanish'] : targetLanguages;
  const languagesQueryParam = effectiveLanguages.map(encodeURIComponent).join(',');

  // Construct the WebSocket URL for Render backend, including room information
  const wsBaseUrl = `wss://polycast-server.onrender.com`;
  const socketUrl = `${wsBaseUrl}/?targetLangs=${languagesQueryParam}&roomCode=${roomSetup.roomCode}&isHost=${roomSetup.isHost}`;
  console.log("Constructed WebSocket URL:", socketUrl);

  const [messageHistory, setMessageHistory] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  // Start with an empty transcript
  const [englishSegments, setEnglishSegments] = useState([]);
  const [translations, setTranslations] = useState({}); // Structure: { lang: [{ text: string, isNew: boolean }] }
  // Test Phrase toggle state
  const [testPhraseEnabled, setTestPhraseEnabled] = useState(false);
  
  // Handle test phrase toggle changes
  useEffect(() => {
    console.log('Test phrase enabled changed to:', testPhraseEnabled);
    
    // If test phrase is disabled, make sure to remove any test phrases from the transcript
    if (!testPhraseEnabled) {
      setEnglishSegments(prevSegments => {
        // Filter out any segments that match test phrases
        return prevSegments.filter(seg => !TEST_PHRASE_SEGMENTS.some(tp => tp.text === seg.text));
      });
    }
  }, [testPhraseEnabled]);
  // The test phrase content
  const TEST_PHRASE_SEGMENTS = [
    { text: "Testing this now. I will charge my phone", isNew: false },
    { text: "i will charge into battle", isNew: false }
  ];
  
  // Clean any test phrases from the transcript on component mount
  useEffect(() => {
    console.log('App component mounted - cleaning transcript');
    // Ensure no test phrases are in the transcript by default
    setEnglishSegments(prevSegments => {
      // Filter out any test phrases that might be there initially
      const filteredSegments = prevSegments.filter(seg => 
        !TEST_PHRASE_SEGMENTS.some(tp => tp.text === seg.text)
      );
      console.log('Initial transcript cleanup:', 
        prevSegments.length - filteredSegments.length, 
        'test phrases removed');
      return filteredSegments;
    });
  }, []);
  const [errorMessages, setErrorMessages] = useState([]); 
  const [showLiveTranscript, setShowLiveTranscript] = useState(true); 
  const [showTranslation, setShowTranslation] = useState(true); 
  const [appMode, setAppMode] = useState('audio'); // Options: 'audio', 'text', 'dictionary', 'flashcard'
  const [selectedWords, setSelectedWords] = useState([]); // Selected words for dictionary
  const [wordDefinitions, setWordDefinitions] = useState({}); // Cache for word definitions
  const [modeError, setModeError] = useState(null);
  const [textInputs, setTextInputs] = useState({}); // Lifted state
  const [showNotification, setShowNotification] = useState(false);
  const [notificationOpacity, setNotificationOpacity] = useState(1);
  const [autoSend, setAutoSend] = useState(roomSetup && roomSetup.isHost ? false : true); // Off by default for host, on for students
  const [showNoiseLevel, setShowNoiseLevel] = useState(false); // Controls visibility of noise level display
  const notificationTimeoutRef = useRef(null);
  const modeRef = useRef(appMode === 'text');
  const isRecordingRef = useRef(isRecording); // Ref to track recording state in handlers

  // Ensure mutual exclusivity between transcript and translation checkboxes
  useEffect(() => {
    if (!showLiveTranscript && !showTranslation) {
      setShowTranslation(true);
    }
  }, [showLiveTranscript, showTranslation]);



  // Update refs when state changes
  useEffect(() => { modeRef.current = appMode === 'text'; }, [appMode]);
  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);


  // --- FIX: Only listen for spacebar in audio mode ---
  useEffect(() => {
    let spacebarPressed = false;
    if (appMode !== 'audio') return; // Only add listeners in audio mode

    const handleKeyDown = (event) => {
      if (event.code === 'Space' && !isRecordingRef.current && !spacebarPressed) {
        event.preventDefault();
        spacebarPressed = true;
        setIsRecording(true);
      }
    };
    const handleKeyUp = (event) => {
      if (event.code === 'Space' && isRecordingRef.current) {
        event.preventDefault();
        spacebarPressed = false;
        setIsRecording(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [appMode]);

  // Add Page Up/Page Down recording hotkeys
  useEffect(() => {
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
  }, []);

  // Backend base URL for /mode endpoints
  const BACKEND_HTTP_BASE = 'https://polycast-server.onrender.com';

  // Fetch mode from backend
  const fetchMode = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_HTTP_BASE}/mode`);
      const debugInfo = {
        url: res.url,
        status: res.status,
        statusText: res.statusText,
        headers: Object.fromEntries(res.headers.entries()),
        mode: 'fetchMode',
        frontendLocation: window.location.href,
        userAgent: navigator.userAgent,
        time: new Date().toISOString(),
      };
      let data;
      try {
        data = await res.json();
      } catch (jsonErr) {
        setModeError(`Could not fetch mode: JSON parse error (${jsonErr.message}). Debug: ${JSON.stringify(debugInfo)}`);
        throw jsonErr;
      }
      // Only update appMode if not currently in dictionary or flashcard mode
      setAppMode(current => (
        current === 'dictionary' || current === 'flashcard'
          ? current
          : (data.isTextMode ? 'text' : 'audio')
      ));
      modeRef.current = data.isTextMode;
    } catch (err) {
      setModeError(`Could not fetch mode: ${err && err.message ? err.message : err}. Debug: ${JSON.stringify({
        mode: 'fetchMode',
        error: err && err.stack ? err.stack : err,
        frontendLocation: window.location.href,
        userAgent: navigator.userAgent,
        time: new Date().toISOString(),
        backendUrl: `${BACKEND_HTTP_BASE}/mode`,
      })}`);
      console.error('Failed to fetch mode:', err);
    }
  }, []);

  // Update mode on backend
  const updateMode = useCallback(async (value) => {
    const previousMode = modeRef.current;
    
    // For dictionary mode, we just update the local state without backend call
    if (value === 'dictionary') {
      setAppMode('dictionary');
      return;
    }
    
    setAppMode(value === 'text' ? 'text' : 'audio'); // Optimistically update UI
    setModeError(null);

    // Clear text inputs when switching from text to audio mode
    if (value !== 'text' && previousMode) { 
      setTextInputs({});
    }

    try {
      const res = await fetch(`${BACKEND_HTTP_BASE}/mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isTextMode: value === 'text' })
      });
      const debugInfo = {
        url: res.url,
        status: res.status,
        statusText: res.statusText,
        headers: Object.fromEntries(res.headers.entries()),
        requestBody: { isTextMode: value === 'text' },
        mode: 'updateMode',
        frontendLocation: window.location.href,
        userAgent: navigator.userAgent,
        time: new Date().toISOString(),
      };
      if (!res.ok) {
        setModeError(`Could not update mode: HTTP ${res.status} ${res.statusText}. Debug: ${JSON.stringify(debugInfo)}`);
        throw new Error('Failed to update mode: ' + res.status);
      }
      let data;
      try {
        data = await res.json();
      } catch (jsonErr) {
        setModeError(`Could not update mode: JSON parse error (${jsonErr.message}). Debug: ${JSON.stringify(debugInfo)}`);
        throw jsonErr;
      }
      setAppMode(data.isTextMode ? 'text' : 'audio');
      modeRef.current = data.isTextMode;
    } catch (err) {
      setModeError(`Could not update mode: ${err && err.message ? err.message : err}. Debug: ${JSON.stringify({
        mode: 'updateMode',
        error: err && err.stack ? err.stack : err,
        frontendLocation: window.location.href,
        userAgent: navigator.userAgent,
        time: new Date().toISOString(),
        backendUrl: `${BACKEND_HTTP_BASE}/mode`,
        requestBody: { isTextMode: value === 'text' }
      })}`);
      setAppMode(previousMode ? 'text' : 'audio'); // Revert UI if error
      console.error('Failed to update mode:', err);
    }
  }, []);

  // On mount, fetch initial mode
  useEffect(() => { fetchMode(); }, [fetchMode]);

  // Poll mode every 5s to keep in sync
  useEffect(() => {
    const interval = setInterval(fetchMode, 5000);
    return () => clearInterval(interval);
  }, [fetchMode]);

  // --- FIX: Prevent text submission error in text mode ---
  // (No code needed here, but ensure isTextMode is derived from appMode === 'text')

  // Track reconnection attempts and invalid room state
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [invalidRoom, setInvalidRoom] = useState(false); // Track if room was rejected
  const maxReconnectAttempts = 3; // Limit reconnection attempts
  
  const { sendMessage, lastMessage, readyState } = useWebSocket(socketUrl, {
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

  // Handle incoming messages
  useEffect(() => {
    if (lastMessage !== null) {
      let parsedData;
      try {
        parsedData = JSON.parse(lastMessage.data);
        console.log('Received parsed message:', parsedData);

        // Check message type and update state accordingly
        if (parsedData.type === 'recognized') {
          // Replace any existing interim segment with the final one
          setEnglishSegments(prevSegments => {
            // ALWAYS filter out any test phrases from existing segments
            // This ensures we don't accumulate test phrases inadvertently
            const cleanSegments = prevSegments.filter(seg => 
              !TEST_PHRASE_SEGMENTS.some(tp => tp.text === seg.text)
            );
            
            // Normal update logic - mark all as old and add the new segment
            const updatedRegularSegments = [
              ...cleanSegments.map(seg => ({ ...seg, isNew: false })),
              { text: parsedData.data, isNew: true }
            ];
            
            // Only add test phrases if the checkbox is checked
            return testPhraseEnabled 
              ? [...TEST_PHRASE_SEGMENTS, ...updatedRegularSegments]
              : updatedRegularSegments;
          });
        } else if (parsedData.type === 'recognizing_interim') { 
           // Only update if toggle is on
           if (showLiveTranscript) {
             setEnglishSegments(prevSegments => {
               // ALWAYS start with a clean slate for interim updates
               // Create the new segments array with the interim segment
               const interimSegments = [{ text: parsedData.data, isNew: false }];
               
               // Add test phrases ONLY if the checkbox is explicitly checked
               return testPhraseEnabled
                 ? [...TEST_PHRASE_SEGMENTS, ...interimSegments]
                 : interimSegments;
             });
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
          // Update textInputs in text mode
          if (appMode === 'text') {
            setTextInputs(inputs => ({
              ...inputs,
              [parsedData.lang]: parsedData.data
            }));
          }
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
        } else {
            console.warn('Received unknown message type:', parsedData.type);
        }

      } catch (e) {
        console.error('Failed to parse message or unknown message format:', lastMessage.data);
        // Add raw message to history if parsing fails
        // setMessageHistory((prev) => prev.concat(lastMessage));
      }
    }
  }, [lastMessage, showLiveTranscript]); // Update dependency array

  // Listen for toggleLiveTranscript event from Controls
  useEffect(() => {
    function handler(e) { setShowLiveTranscript(!!e.detail); }
    window.addEventListener('toggleLiveTranscript', handler);
    return () => window.removeEventListener('toggleLiveTranscript', handler);
  }, []);

  // Provide a global getter for Controls to read the toggle state
  useEffect(() => {
    window.showLiveTranscript = () => showLiveTranscript;
    return () => { delete window.showLiveTranscript; };
  }, [showLiveTranscript]);

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

  // Pass mode state and update logic to Controls
  const handleSetIsTextMode = useCallback((value) => {
    updateMode(value); // Update backend and local state
  }, [updateMode]);

  const setIsTextMode = useCallback((value) => {
    setAppMode(value ? 'text' : 'audio');
  }, []);

  // Handle app mode changes from dropdown menu
  const handleAppModeChange = useCallback((newMode) => {
    if (newMode === 'dictionary') {
      // Just update local state for dictionary mode
      setAppMode('dictionary');
    } else if (newMode === 'flashcard') {
      // Just update local state for flashcard mode
      setAppMode('flashcard');
    } else {
      // Call updateMode for audio/text modes to sync with backend
      updateMode(newMode);
    }
  }, [updateMode]);

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

  return (
    <div className="App">
      {/* Remove the iguana overlay for audio mode 
       - Code removed to fix lint errors, originally showed an iguana overlay
       - when in audio mode with conditional rendering based on iguanaLoading
       - and iguanaImageUrl states.
      */}
      {/* Big Polycast Title */}
      <h1
        className="polycast-title"
        style={{
          color: '#fff',
          fontSize: '3rem',
          fontWeight: 900,
          letterSpacing: '0.06em',
          textAlign: 'center',
          margin: '24px 0 12px 0',
          textShadow: '0 4px 24px #0008',
          cursor: 'pointer', // Show pointer
          transition: 'opacity 0.2s',
        }}
        onClick={() => typeof onReset === 'function' && onReset()}
        onMouseOver={e => (e.currentTarget.style.opacity = 0.85)}
        onMouseOut={e => (e.currentTarget.style.opacity = 1)}
      >
        Polycast
      </h1>
      {roomSetup && (
        <div 
          className="room-info-display" 
          style={{
            color: '#fff',
            textAlign: 'center',
            marginBottom: '15px',
            fontSize: '1rem',
            fontWeight: 600,
            padding: '4px 12px',
            borderRadius: '6px',
            background: roomSetup.isHost ? 'rgba(59, 130, 246, 0.6)' : 'rgba(16, 185, 129, 0.6)',
            display: 'inline-block',
            position: 'relative',
            left: '50%',
            transform: 'translateX(-50%)',
          }}
        >
          {roomSetup.isHost ? 'Host' : 'Student'} • Room: {roomSetup.roomCode}
        </div>
      )}
      <div className="controls-container" style={{ marginBottom: 4 }}>
        {/* Main Toolbar */}
        <div className="main-toolbar" style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'stretch', marginBottom: 0 }}>
          {/* Absolutely positioned Recording indicator in circled space */}
          {appMode !== 'text' && isRecording && (
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
              Recording...
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {/* Pass sendMessage down to components that need to send audio - only for hosts */}
            {appMode === 'audio' && roomSetup && roomSetup.isHost && (
              <AudioRecorder
                sendMessage={sendMessage}
                isRecording={isRecording}
                onAudioSent={onAudioSent}
              />
            )}
            <Controls
              readyState={readyState}
              isRecording={isRecording}
              onStartRecording={roomSetup && roomSetup.isHost ? handleStartRecording : null}
              onStopRecording={roomSetup && roomSetup.isHost ? handleStopRecording : null}
              isTextMode={appMode === 'text'}
              setIsTextMode={roomSetup && roomSetup.isHost ? setIsTextMode : null}
              appMode={appMode}
              setAppMode={handleAppModeChange}
              autoSend={autoSend}
              setAutoSend={roomSetup && roomSetup.isHost ? setAutoSend : null}
              showNoiseLevel={showNoiseLevel}
              setShowNoiseLevel={roomSetup && roomSetup.isHost ? setShowNoiseLevel : null}
              showLiveTranscript={showLiveTranscript}
              setShowLiveTranscript={(checked) => {
                setShowLiveTranscript(checked);
                if (!checked && !showTranslation) setShowTranslation(true);
              }}
              showTranslation={showTranslation}
              setShowTranslation={(checked) => {
                setShowTranslation(checked);
                if (!checked && !showLiveTranscript) setShowLiveTranscript(true);
              }}
              selectedProfile={selectedProfile}
              setSelectedProfile={profile => {
                setSelectedProfile(profile);
                console.log('Profile switched to:', profile);
              }}
              testPhraseEnabled={testPhraseEnabled}
              setTestPhraseEnabled={setTestPhraseEnabled}
            />
          </div>
          {appMode === 'audio' && roomSetup && !roomSetup.isHost && (
            <div style={{
              marginTop: -45,
              marginBottom: 0,
              width: '100%',
              textAlign: 'center',
              color: '#10b981',  /* Green for student mode */
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
        </div>
      </div>
      {/* Remove the floating Recording indicator entirely */}
      {modeError && (
        <div style={{ color: 'red', fontWeight: 500, marginBottom: 8 }}>
          {modeError}
        </div>
      )}
      {errorMessages.length > 0 && (
        <div className="app-container">
          <div className="top-bar">
            <div className="app-title">
              <h1>PolyCast</h1>
              {roomSetup && (
                <div className="room-info">
                  <span className="room-label">{roomSetup.isHost ? 'Host' : 'Student'}</span>
                  <span className="room-code">Room: {roomSetup.roomCode}</span>
                </div>
              )}
            </div>
            <button onClick={onReset} className="reset-button">
              Exit Room
            </button>
          </div>
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
                
                // Save the updated state to the backend
                if (selectedProfile !== 'non-saving') {
                  setTimeout(async () => {
                    try {
                      
                      // Save the updated flashcards to the backend
                      const response = await fetch(`https://polycast-server.onrender.com/api/profile/${selectedProfile}/words`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                          flashcards: wordDefinitions, 
                          selectedWords: updatedSelectedWords 
                        })
                      });
                      
                      if (!response.ok) {
                        throw new Error(`Server responded with status: ${response.status}`);
                      }
                      
                      console.log(`Saved updated flashcards to profile: ${selectedProfile}`);
                    } catch (error) {
                      console.error(`Error saving profile data: ${error.message}`);
                    }
                  }, 100);
                }
              } catch (error) {
                console.error(`Error removing word from dictionary: ${error}`);
              }
            }}
          />
        ) : appMode === 'flashcard' ? (
          <FlashcardMode 
            selectedWords={selectedWords}
            wordDefinitions={wordDefinitions}
            englishSegments={englishSegments}
          />
        ) : (
          <TranscriptionDisplay 
            // Only add test phrases to the displayed transcript when checkbox is checked
            englishSegments={testPhraseEnabled ? [...TEST_PHRASE_SEGMENTS, ...englishSegments] : englishSegments} 
            translations={translations} 
            targetLanguages={effectiveLanguages} 
            showLiveTranscript={showLiveTranscript}
            showTranslation={showTranslation}
            isTextMode={appMode === 'text'}
            isStudentMode={roomSetup && !roomSetup.isHost}
            forceKey={`transcript-${testPhraseEnabled ? 'with-test' : 'no-test'}`} // Force re-render when test phrase changes
            onTextSubmit={(lang, text) => {
              // Send text submission for translation to backend
              sendMessage(JSON.stringify({ type: 'text_submit', lang, text }));
            }}
            textInputs={textInputs}
            setTextInputs={setTextInputs}
            selectedWords={selectedWords}
            setSelectedWords={setSelectedWords}
            wordDefinitions={wordDefinitions}
            setWordDefinitions={setWordDefinitions}
            selectedProfile={selectedProfile}
          />
        )}
      </div>
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
    }).isRequired
};

// Define backend port in a config object or hardcode if simple
const config = {
    backendPort: 8080
};

export default App;
