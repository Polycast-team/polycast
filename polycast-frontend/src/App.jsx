import React, { useState, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import useWebSocket, { ReadyState } from 'react-use-websocket';
import './App.css';

// Components
import TranscriptionDisplay from './components/TranscriptionDisplay';
import DictionaryTable from './components/DictionaryTable';
import FlashcardMode from './components/FlashcardMode';
import FlashcardCalendarModal from './components/shared/FlashcardCalendarModal';
import VideoMode from './components/VideoMode';
import ErrorPopup from './components/ErrorPopup';
import TBAPopup from './components/popups/TBAPopup';
import ModeSelector from './components/ModeSelector';
import AIMode from './components/ai/AIMode';
import SettingsButton from './components/SettingsButton';
import FullscreenIcon from './components/icons/FullscreenIcon';
import AppHeader from './components/AppHeader';
import AudioModeControls from './components/AudioModeControls';
import JoinRoomModal from './components/modals/JoinRoomModal';
import LogoutConfirmModal from './components/modals/LogoutConfirmModal';

// Hooks
import { useFlashcardCalendar } from './hooks/useFlashcardCalendar';
import { useErrorHandler } from './hooks/useErrorHandler';
import { useTBAHandler } from './hooks/useTBAHandler';
import { useWordManagement } from './hooks/useWordManagement';
import { useTranscriptState } from './hooks/useTranscriptState';
import { useRecordingControls } from './hooks/useRecordingControls';
import { useRoomConnection } from './hooks/useRoomConnection';

// Utils and services
import {
  getLanguageForProfile,
  getFlashcardTranslationsForProfile,
  getUITranslationsForProfile,
  getRegisteredProfiles,
  getAppTranslationsForProfile,
  getVoiceTranslationsForProfile,
  getErrorTranslationsForProfile,
} from './utils/profileLanguageMapping.js';
import apiService from './services/apiService.js';

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
  // Loading state - show simple loading message (no fallback prefix needed)
  if (profileLoading) {
    return <div className="app-loading-state">Loading...</div>;
  }

  if (!selectedProfile) throw new Error('App requires a selected profile before rendering');
  if (!Array.isArray(targetLanguages) || targetLanguages.length === 0) {
    throw new Error('App requires at least one target language');
  }

  // Translations
  const flashcardStrings = getFlashcardTranslationsForProfile(selectedProfile);
  const ui = getUITranslationsForProfile(selectedProfile);
  const appStrings = getAppTranslationsForProfile(selectedProfile);
  const voiceStrings = getVoiceTranslationsForProfile(selectedProfile);
  const errorStrings = getErrorTranslationsForProfile(selectedProfile);

  // Profile state
  const [internalSelectedProfile, setSelectedProfile] = useState(selectedProfile);
  useEffect(() => {
    if (selectedProfile && selectedProfile !== internalSelectedProfile) {
      setSelectedProfile(selectedProfile);
    }
  }, [selectedProfile, internalSelectedProfile]);

  // Error and TBA handlers
  const { error: popupError, showError, clearError } = useErrorHandler();
  const { tba: popupTBA, showTBA, clearTBA } = useTBAHandler();

  // Listen for i18n missing translation errors (debug mode)
  useEffect(() => {
    const handleMissingTranslation = (e) => {
      const { message } = e.detail || {};
      if (message) {
        showError(`[DEBUG] ${message}`);
      }
    };
    window.addEventListener('i18n-missing-translation', handleMissingTranslation);
    return () => window.removeEventListener('i18n-missing-translation', handleMissingTranslation);
  }, [showError]);

  // Calculate effective languages
  const profileLanguage = getLanguageForProfile(internalSelectedProfile);
  const registeredProfiles = getRegisteredProfiles();
  if (userRole === 'host' && (!targetLanguages || targetLanguages.length === 0)) {
    throw new Error('Host sessions require at least one target language');
  }
  const effectiveLanguages = userRole === 'host' ? targetLanguages : [profileLanguage];
  const languagesQueryParam = effectiveLanguages.map(encodeURIComponent).join(',');

  // Custom hooks
  const {
    isRecording,
    setIsRecording,
    showNotification,
    notificationOpacity,
    handleStartRecording,
    handleStopRecording,
    onAudioSent
  } = useRecordingControls(roomSetup);

  const {
    fullTranscript,
    currentPartial,
    transcriptBlocks,
    translations,
    initializeTranslations,
    handleTranscriptMessage,
    handleTranslationMessage,
    handleTranslationsBatch,
    handleTranscriptHistory,
    generateStudentTranslation
  } = useTranscriptState(effectiveLanguages);

  const {
    selectedWords,
    setSelectedWords,
    wordDefinitions,
    setWordDefinitions,
    isAddingWordBusy,
    handleAddWord,
    handleAddWordSenses,
    handleRemoveWord,
    reloadServerDictionary
  } = useWordManagement(internalSelectedProfile, fullTranscript, showError);

  const {
    errorMessages,
    setErrorMessages,
    signalLog,
    handleConnectionOpen,
    handleConnectionClose,
    handleConnectionError,
    shouldReconnect,
    getReconnectInterval,
    registerWebrtcSignalHandler,
    unregisterWebrtcSignalHandler,
    handleWebrtcSignal,
    handleRoomError,
    logInfo
  } = useRoomConnection();

  // App mode state
  const [appMode, setAppMode] = useState('dictionary');
  const [showCalendar, setShowCalendar] = useState(false);
  const [toolbarStats, setToolbarStats] = useState({ newCards: 0, learningCards: 0, reviewCards: 0 });
  const [srsSettingsVersion, setSrsSettingsVersion] = useState(0);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showJoinRoomModal, setShowJoinRoomModal] = useState(false);

  // WebSocket URL
  const socketUrl = roomSetup
    ? apiService.roomWebSocketUrl(languagesQueryParam, roomSetup.roomCode, roomSetup.isHost)
    : `${apiService.wsBaseUrl}/ws`;

  // WebSocket connection
  const { sendMessage, lastMessage, readyState } = useWebSocket(socketUrl, {
    skip: !socketUrl,
    onOpen: () => {
      handleConnectionOpen(socketUrl);
      initializeTranslations();
    },
    onClose: handleConnectionClose,
    onError: handleConnectionError,
    shouldReconnect,
    reconnectInterval: getReconnectInterval,
  });

  // Handle incoming WebSocket messages
  useEffect(() => {
    if (lastMessage === null) return;

    try {
      const parsedData = JSON.parse(lastMessage.data);

      if (parsedData.type === 'streaming_transcript') {
        const isFinal = handleTranscriptMessage(parsedData);
        if (isFinal && userRole === 'student' && studentHomeLanguage && parsedData.text) {
          generateStudentTranslation(parsedData.text, studentHomeLanguage);
        }
      } else if (parsedData.type === 'error') {
        console.error('Backend Error:', parsedData.message);
        setErrorMessages(prev => [...prev, `Error: ${parsedData.message}`]);
      } else if (parsedData.type === 'room_error') {
        handleRoomError(parsedData.message, onReset);
      } else if (parsedData.type === 'info') {
        logInfo(parsedData.message);
      } else if (parsedData.type === 'transcript_history') {
        handleTranscriptHistory(parsedData);
      } else if (parsedData.type === 'translation') {
        handleTranslationMessage(parsedData);
      } else if (parsedData.type === 'translations_batch') {
        handleTranslationsBatch(parsedData);
      } else if (
        parsedData.type === 'webrtc_offer' ||
        parsedData.type === 'webrtc_answer' ||
        parsedData.type === 'webrtc_ice'
      ) {
        handleWebrtcSignal(parsedData);
      }
    } catch (e) {
      console.error('Failed to parse message:', lastMessage.data);
    }
  }, [lastMessage]);

  // Mode change handler
  const handleAppModeChange = useCallback((newMode) => {
    if (isRecording && newMode !== 'audio' && newMode !== 'video') {
      setIsRecording(false);
    }

    if ((appMode === 'audio' && newMode === 'video') || (appMode === 'video' && newMode === 'audio')) {
      if (roomSetup && onReset) onReset();
    }

    if (newMode === 'dictionary') {
      reloadServerDictionary();
    }

    setAppMode(newMode);
  }, [appMode, isRecording, roomSetup, onReset, reloadServerDictionary, setIsRecording]);

  // Reload dictionary when entering dictionary mode
  useEffect(() => {
    if (appMode === 'dictionary') reloadServerDictionary();
  }, [appMode, reloadServerDictionary]);

  // Ensure recording stops when leaving streaming modes
  useEffect(() => {
    if (appMode !== 'audio' && appMode !== 'video' && isRecording) {
      setIsRecording(false);
    }
  }, [appMode, isRecording, setIsRecording]);

  // Auto-unmute for hosts in video mode
  useEffect(() => {
    if (appMode === 'video' && roomSetup && roomSetup.isHost) {
      const id = setTimeout(() => setIsRecording(true), 50);
      return () => clearTimeout(id);
    } else if (appMode === 'video' && roomSetup && !roomSetup.isHost) {
      setIsRecording(false);
    }
  }, [appMode, roomSetup, setIsRecording]);

  // Global event listeners
  useEffect(() => {
    const handler = (e) => {
      const detail = e?.detail;
      if (detail === true) setShowCalendar(true);
      else if (detail === false) setShowCalendar(false);
      else setShowCalendar(prev => !prev);
    };
    window.addEventListener('toggleFlashcardCalendar', handler);
    return () => window.removeEventListener('toggleFlashcardCalendar', handler);
  }, []);

  useEffect(() => {
    const onStats = (e) => {
      if (e?.detail) {
        const { newCards = 0, learningCards = 0, reviewCards = 0 } = e.detail;
        setToolbarStats({ newCards, learningCards, reviewCards });
      }
    };
    window.addEventListener('updateToolbarStats', onStats);
    return () => window.removeEventListener('updateToolbarStats', onStats);
  }, []);

  useEffect(() => {
    const open = () => setShowJoinRoomModal(true);
    window.addEventListener('openJoinRoom', open);
    return () => window.removeEventListener('openJoinRoom', open);
  }, []);

  // Track bottom toolbar height
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

  // Calendar queue
  const { queue, reorderQueue } = useFlashcardCalendar([], wordDefinitions, [], internalSelectedProfile, [], 0);

  // Join room handler
  const handleJoinRoom = async (roomCode) => {
    const data = await apiService.fetchJson(apiService.checkRoomUrl(roomCode));
    if (!data.exists) throw new Error(data.message || 'Room not found');
    if (onJoinRoom) {
      onJoinRoom(roomCode);
    } else {
      throw new Error('Join room callback not available');
    }
  };

  // Profile change handler
  const handleProfileChange = (profile) => {
    if (onProfileChange) onProfileChange(profile);
    else setSelectedProfile(profile);
  };

  return (
    <div className="App">
      {/* Global Settings */}
      <SettingsButton onSrsChange={() => setSrsSettingsVersion(v => v + 1)} />

      {/* Fullscreen button */}
      <button
        onClick={() => {
          if (!document.fullscreenElement) document.documentElement.requestFullscreen();
          else document.exitFullscreen();
        }}
        style={{
          position: 'fixed', top: '20px', left: '72px', zIndex: 1001,
          background: 'rgba(35, 35, 58, 0.9)', color: '#f8fafc', border: 'none',
          borderRadius: 8, width: 44, height: 44, padding: 0, fontSize: 20,
          fontWeight: 700, cursor: 'pointer', transition: 'background 0.2s',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          lineHeight: 0, boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
        }}
        aria-label="Toggle Full Screen"
        title="Full Screen (F11)"
      >
        <FullscreenIcon size={20} style={{ display: 'block' }} />
      </button>

      {/* App Header */}
      <AppHeader
        appStrings={appStrings}
        ui={ui}
        errorStrings={errorStrings}
        appMode={appMode}
        roomSetup={roomSetup}
        onHostRoom={onHostRoom}
        onOpenJoinModal={() => setShowJoinRoomModal(true)}
        onReset={onReset}
      />

      {/* Audio Mode Controls */}
      {appMode === 'audio' && (
        <AudioModeControls
          isRecording={isRecording}
          sendMessage={sendMessage}
          selectedProfile={internalSelectedProfile}
          onAudioSent={onAudioSent}
          readyState={readyState}
          onStartRecording={handleStartRecording}
          onStopRecording={handleStopRecording}
          appMode={appMode}
          setAppMode={handleAppModeChange}
          toolbarStats={toolbarStats}
          roomSetup={roomSetup}
          userRole={userRole}
          availableProfiles={registeredProfiles}
          onProfileChange={handleProfileChange}
          ui={ui}
          voiceStrings={voiceStrings}
          showTBA={showTBA}
        />
      )}

      {/* Error messages */}
      {errorMessages.length > 0 && <div className="error-messages" />}

      {/* Notification Pop-up */}
      {showNotification && (
        <div className="notification-popup" style={{ opacity: notificationOpacity }}>
          {appStrings.audioSentNotification}
        </div>
      )}

      {/* Main content area */}
      <div className="display-container">
        {appMode === 'dictionary' ? (
          <DictionaryTable
            wordDefinitions={wordDefinitions}
            selectedProfile={internalSelectedProfile}
            isAddingWordBusy={isAddingWordBusy}
            toolbarStats={toolbarStats}
            onAddWordSenses={handleAddWordSenses}
            onRemoveWord={handleRemoveWord}
            onAddWord={handleAddWord}
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
            onAddWord={handleAddWord}
            showTBA={showTBA}
            registerWebrtcSignalHandler={registerWebrtcSignalHandler}
            unregisterWebrtcSignalHandler={unregisterWebrtcSignalHandler}
          />
        ) : appMode === 'ai' ? (
          <AIMode
            selectedProfile={internalSelectedProfile}
            selectedWords={selectedWords}
            wordDefinitions={wordDefinitions}
            setWordDefinitions={setWordDefinitions}
            onAddWord={handleAddWord}
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
            onAddWord={handleAddWord}
          />
        )}
      </div>

      {/* Modals */}
      <JoinRoomModal
        isOpen={showJoinRoomModal}
        onClose={() => setShowJoinRoomModal(false)}
        onJoin={handleJoinRoom}
        ui={ui}
      />

      <LogoutConfirmModal
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        ui={ui}
        appStrings={appStrings}
      />

      {/* Global components */}
      <ErrorPopup error={popupError} onClose={clearError} />
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
  );
}

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
  }),
  userRole: PropTypes.oneOf(['host', null]),
  studentHomeLanguage: PropTypes.string,
  onJoinRoom: PropTypes.func,
  onHostRoom: PropTypes.func,
  onFlashcardModeChange: PropTypes.func,
  onProfileChange: PropTypes.func
};

export default App;
