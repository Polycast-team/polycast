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
import ErrorPopup from './components/ErrorPopup';
import { useErrorHandler } from './hooks/useErrorHandler';
import { getLanguageForProfile, getTranslationsForProfile } from './utils/profileLanguageMapping.js';

// App now receives an array of target languages and room setup as props
function App({ targetLanguages, selectedProfile, onReset, roomSetup, userRole, studentHomeLanguage, onJoinRoom, onFlashcardModeChange, onProfileChange }) {
  // Debug logging
  console.log('App component received props:', { targetLanguages, selectedProfile, roomSetup, userRole, studentHomeLanguage });
  
  // Get translations for this profile's language
  const t = getTranslationsForProfile(selectedProfile);
  
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

  // Construct the WebSocket URL for Render backend, including room information
  const wsBaseUrl = `wss://polycast-server.onrender.com`;
  // Only connect to WebSocket if we have room setup (for hosts or students who joined a room)
  const socketUrl = roomSetup ? `${wsBaseUrl}/?targetLangs=${languagesQueryParam}&roomCode=${roomSetup.roomCode}&isHost=${roomSetup.isHost}` : null;
  console.log("Constructed WebSocket URL:", socketUrl);

  const [messageHistory, setMessageHistory] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [englishSegments, setEnglishSegments] = useState([
    { text: "Testing this now. I will charge my phone", isNew: false },
    { text: "i will charge into battle", isNew: false }
  ]); 
  const [translations, setTranslations] = useState({}); // Structure: { lang: [{ text: string, isNew: boolean }] }
  const [errorMessages, setErrorMessages] = useState([]); 
  const [showLiveTranscript, setShowLiveTranscript] = useState(true); 
  const [showTranslation, setShowTranslation] = useState(false); 
  // Students start in flashcard mode, hosts start in audio mode
  const [appMode, setAppMode] = useState(() => {
    // If student not in a room, start in flashcard mode
    if (userRole === 'student' && !roomSetup) {
      return 'flashcard';
    }
    // Otherwise start in audio mode (hosts or students in rooms)
    return 'audio';
  }); // Options: 'audio', 'dictionary', 'flashcard'
  const [selectedWords, setSelectedWords] = useState([]); // Selected words for dictionary
  const [wordDefinitions, setWordDefinitions] = useState({}); // Cache for word definitions
  const [showNotification, setShowNotification] = useState(false);
  const [notificationOpacity, setNotificationOpacity] = useState(1);
  const [autoSend, setAutoSend] = useState(roomSetup && roomSetup.isHost ? false : true); // Off by default for host, on for students
  const [showNoiseLevel, setShowNoiseLevel] = useState(false); // Controls visibility of noise level display
  const notificationTimeoutRef = useRef(null);
  const isRecordingRef = useRef(isRecording); // Ref to track recording state in handlers
  const { error: popupError, showError, clearError } = useErrorHandler();

  // Ensure mutual exclusivity between transcript and translation checkboxes
  useEffect(() => {
    if (!showLiveTranscript && !showTranslation) {
      setShowTranslation(true);
    }
  }, [showLiveTranscript, showTranslation]);

  // Don't trigger mobile mode for flashcard mode anymore - we'll use mobile UI on desktop instead

  // Update refs when state changes
  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);

  // Listen for spacebar in audio mode (hosts only)
  useEffect(() => {
    let spacebarPressed = false;
    // Only add listeners in audio mode and only for hosts (not students)
    if (appMode !== 'audio') return;
    if (roomSetup && !roomSetup.isHost) return; // Skip for students

    const handleKeyDown = (event) => {
      // Only allow spacebar to start recording if autoSend is OFF
      if (!autoSend && event.code === 'Space' && !isRecordingRef.current && !spacebarPressed) {
        event.preventDefault();
        spacebarPressed = true;
        setIsRecording(true);
      }
    };
    const handleKeyUp = (event) => {
      // Only allow spacebar to stop recording if autoSend is OFF
      if (!autoSend && event.code === 'Space' && isRecordingRef.current) {
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
  }, [appMode, roomSetup, autoSend]); // Add autoSend to dependencies

  // Manage isRecording state based on autoSend for hosts in audio mode
  useEffect(() => {
    if (appMode === 'audio' && roomSetup && roomSetup.isHost) {
      if (autoSend) {
        setIsRecording(true);
      } else {
        // If autoSend is turned off, stop recording
        setIsRecording(false);
      }
    }
  }, [autoSend, appMode, roomSetup]);

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

  // Ensure recording stops if appMode changes from 'audio'
  useEffect(() => {
    if (appMode !== 'audio' && isRecording) {
      setIsRecording(false);
    }
  }, [appMode, isRecording]);

  // Auto-switch modes for students based on room status
  useEffect(() => {
    if (userRole === 'student') {
      if (roomSetup) {
        // Student joined a room → switch to audio mode (transcript view)
        if (appMode === 'flashcard') {
          setAppMode('audio');
        }
      } else {
        // Student not in a room → switch to flashcard mode
        if (appMode === 'audio') {
          setAppMode('flashcard');
        }
      }
    }
  }, [roomSetup, userRole, appMode]);

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
      const response = await fetch(`https://polycast-server.onrender.com/api/check-room/${cleanedRoomCode}`);
      const data = await response.json();
      
      if (!data.exists) {
        throw new Error(data.message || 'Room not found');
      }
      
      // Join the room by updating the app state
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
      // Use the correct GET endpoint: /api/translate/:language/:text
      const encodedText = encodeURIComponent(englishText);
      const encodedLanguage = encodeURIComponent(targetLanguage);
      const response = await fetch(`https://polycast-server.onrender.com/api/translate/${encodedLanguage}/${encodedText}`);
      
      if (response.ok) {
        const translationData = await response.json();
        console.log(`Received ${targetLanguage} translation:`, translationData);
        
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
      } else {
        console.error(`Failed to translate to ${targetLanguage}:`, response.statusText);
      }
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
        if (parsedData.type === 'recognized') {
          // Replace any existing interim segment with the final one
          setEnglishSegments(prevSegments => [
            // Find the index of the last segment (which might be an interim one)
            // Keep all segments *except* the last one if it was interim, then add final.
            // OR simpler: just mark all as old and add final.
            ...prevSegments.map(seg => ({ ...seg, isNew: false })),
            { text: parsedData.data, isNew: true }
          ]);
          
          // For students: generate their own translation when receiving host's transcript
          if (userRole === 'student' && studentHomeLanguage && parsedData.data) {
            console.log(`Student generating ${studentHomeLanguage} translation for: "${parsedData.data}"`);
            generateStudentTranslation(parsedData.data, studentHomeLanguage);
          }
        } else if (parsedData.type === 'recognizing_interim') { 
           // Only update if toggle is on
           if (showLiveTranscript) {
             setEnglishSegments([{ text: parsedData.data, isNew: false }]); 
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

  // Handle app mode changes from dropdown menu
  const handleAppModeChange = useCallback((newMode) => {
    console.log(`Mode change requested: ${appMode} → ${newMode}`);
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
    }
  }, [appMode]);

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
              {roomSetup?.isHost ? `Room: ${roomSetup?.roomCode || 'Not Connected'}` : `Student • Room: ${roomSetup?.roomCode || 'Not Connected'}`}
            </div>
          )}
        </div>
      </div>
      <div className="controls-container" style={{ marginBottom: 4 }}>
        {/* Main Toolbar */}
        <div className="main-toolbar" style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'stretch', marginBottom: 0 }}>
          {/* Recording indicator for audio mode */}
          {appMode === 'audio' && isRecording && (
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
            {/* Audio recorder for hosts in audio mode */}
            {appMode === 'audio' && roomSetup && roomSetup.isHost && (
              <AudioRecorder
                sendMessage={sendMessage}
                isRecording={isRecording}
                onAudioSent={onAudioSent}
                autoSend={autoSend}
                onSetRecording={setIsRecording}
              />
            )}
          </div>
          <Controls
            readyState={readyState}
            isRecording={isRecording}
            onStartRecording={roomSetup && roomSetup.isHost ? handleStartRecording : null}
            onStopRecording={roomSetup && roomSetup.isHost ? handleStopRecording : null}
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
            roomSetup={roomSetup}
            selectedProfile={selectedProfile || internalSelectedProfile}
            setSelectedProfile={profile => {
              console.log('Profile switched to:', profile);
              if (onProfileChange) {
                onProfileChange(profile);
              } else {
                // Fallback for when no callback is provided
                setSelectedProfile(profile);
              }
            }}
            userRole={userRole}
          />
          {/* User instructions for hosts in audio mode */}
          {appMode === 'audio' && roomSetup && roomSetup.isHost && (
            <div style={{
              marginTop: -45,
              marginBottom: 0,
              width: '100%',
              textAlign: 'center',
              color: '#ffb84d',
              fontWeight: 600,
              fontSize: '1.05rem',
              letterSpacing: 0.1,
              textShadow: '0 1px 2px #2228',
              opacity: 0.96,
              userSelect: 'none',
            }}>
              Hold Spacebar to record.  Release Spacebar to send.
            </div>
          )}
          {/* User instructions for students in audio mode */}
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
        </div>
      </div>
      
      {/* Header with room buttons - positioned above toolbar */}
      <div style={{ 
        position: 'absolute', 
        top: '20px', 
        right: '20px', 
        zIndex: 100,
        display: 'flex',
        gap: '8px',
        alignItems: 'center'
      }}>
        {/* Show role indicator only for students */}
        {roomSetup && !roomSetup.isHost && (
          <div style={{ 
            fontSize: 14, 
            color: '#fff', 
            marginRight: 16,
            background: 'rgba(0,0,0,0.3)',
            padding: '8px 12px',
            borderRadius: 4
          }}>
            <span>Student</span>
          </div>
        )}
        
        {/* Join Room button - only for students not in a room */}
        {userRole === 'student' && !roomSetup && (
          <button 
            onClick={() => setShowJoinRoomModal(true)}
            style={{
              padding: '8px 16px',
              fontSize: 14,
              borderRadius: 4,
              background: '#10b981',
              color: '#fff',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            {t.joinRoom}
          </button>
        )}
        
        {/* Exit Room button - only for students in a room */}
        {roomSetup && !roomSetup.isHost && (
          <button 
            onClick={onReset}
            style={{
              padding: '8px 16px',
              fontSize: 14,
              borderRadius: 4,
              background: '#444',
              color: '#fff',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Exit Room
          </button>
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
                        const errorText = await response.text();
                        throw new Error(`Server responded with status: ${response.status}. ${errorText}`);
                      }
                      
                      console.log(`Saved updated flashcards to profile: ${selectedProfile}`);
                    } catch (error) {
                      console.error(`Error saving profile data: ${error.message}`);
                      
                      // Revert frontend state if backend save failed
                      console.log('Backend save failed, reverting deletion...');
                      setWordDefinitions(prev => ({
                        ...prev,
                        [wordSenseId]: wordEntry // Restore the deleted entry
                      }));
                      
                      // Restore word to selectedWords if needed
                      if (isLastSenseOfWord) {
                        setSelectedWords(prev => [...prev, word]);
                      }
                      
                      // Show user-friendly error
                      showError(`Failed to delete "${word}" from dictionary. Please check your connection and try again.`);
                    }
                  }, 100);
                }
              } catch (error) {
                console.error(`Error removing word from dictionary: ${error}`);
                showError(`Failed to delete "${word}" from dictionary. Please try again.`);
              }
            }}
            onAddWord={async (word) => {
              console.log(`Adding word to dictionary: ${word}`);
              try {
                // Use the profile-specific add-word endpoint
                const currentProfile = selectedProfile || internalSelectedProfile;
                const response = await fetch(`https://polycast-server.onrender.com/api/profile/${currentProfile}/add-word`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({ word: word })
                });
                
                if (response.status === 409) {
                  // Duplicate word
                  const errorData = await response.json();
                  throw new Error(errorData.message || `"${word}" is already in your dictionary!`);
                }
                
                if (!response.ok) {
                  const errorData = await response.json();
                  throw new Error(errorData.details || `Failed to add "${word}"`);
                }
                
                const data = await response.json();
                console.log(`Successfully added "${word}" to profile ${currentProfile}:`, data);
                
                // Add to wordDefinitions
                setWordDefinitions(prev => ({
                  ...prev,
                  [data.wordSenseId]: data
                }));
                
                // Add to selectedWords
                setSelectedWords(prev => {
                  if (!prev.includes(word)) {
                    return [...prev, word];
                  }
                  return prev;
                });
                
              } catch (error) {
                console.error(`Error adding word "${word}":`, error);
                throw error; // Re-throw to let DictionaryTable handle the error display
              }
            }}
          />
        ) : appMode === 'flashcard' ? (
          <FlashcardMode 
            selectedWords={selectedWords}
            wordDefinitions={wordDefinitions}
            setWordDefinitions={setWordDefinitions}
            englishSegments={englishSegments}
            targetLanguages={effectiveLanguages}
            selectedProfile={selectedProfile || internalSelectedProfile}
          />
        ) : (
          <TranscriptionDisplay 
            englishSegments={englishSegments} 
            translations={translations} 
            targetLanguages={effectiveLanguages} 
            showLiveTranscript={showLiveTranscript}
            showTranslation={showTranslation}
            isStudentMode={roomSetup && !roomSetup.isHost}
            studentHomeLanguage={studentHomeLanguage}
            selectedWords={selectedWords}
            setSelectedWords={setSelectedWords}
            wordDefinitions={wordDefinitions}
            setWordDefinitions={setWordDefinitions}
            selectedProfile={selectedProfile}
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
            <h2 style={{ color: '#fff', marginBottom: 24 }}>{t.joinRoom}</h2>
            <p style={{ color: '#b3b3e7', marginBottom: 24, fontSize: 14 }}>
              {t.enterRoomCode}
            </p>
            
            <input
              type="text"
              value={joinRoomCode}
              onChange={(e) => setJoinRoomCode(e.target.value)}
              placeholder={t.roomCode}
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
                Cancel
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
                {isJoiningRoom ? t.joinButton + '...' : t.joinButton}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Popup */}
      <ErrorPopup error={popupError} onClose={clearError} />
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
    userRole: PropTypes.oneOf(['host', 'student']),
    studentHomeLanguage: PropTypes.string,
    onJoinRoom: PropTypes.func,
    onFlashcardModeChange: PropTypes.func
};

export default App