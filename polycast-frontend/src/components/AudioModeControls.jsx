import React from 'react';
import PropTypes from 'prop-types';
import AudioRecorder from './AudioRecorder';
import HostToolbar from './HostToolbar';

/**
 * Audio mode controls including recorder and toolbar
 */
function AudioModeControls({
  isRecording,
  sendMessage,
  selectedProfile,
  onAudioSent,
  readyState,
  onStartRecording,
  onStopRecording,
  appMode,
  setAppMode,
  toolbarStats,
  roomSetup,
  userRole,
  availableProfiles,
  onProfileChange,
  ui,
  voiceStrings,
  showTBA
}) {
  return (
    <>
      {/* Top toolbar: show in audio mode */}
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
              selectedProfile={selectedProfile}
              onAudioSent={onAudioSent}
            />
          </div>
          <HostToolbar
            showTBA={showTBA}
            readyState={readyState}
            isRecording={isRecording}
            onStartRecording={onStartRecording}
            onStopRecording={onStopRecording}
            appMode={appMode}
            setAppMode={setAppMode}
            toolbarStats={toolbarStats}
            showLiveTranscript={true}
            setShowLiveTranscript={() => {}}
            showTranslation={false}
            setShowTranslation={() => {}}
            roomSetup={roomSetup}
            selectedProfile={selectedProfile}
            setSelectedProfile={onProfileChange}
            availableProfiles={availableProfiles}
            userRole={userRole}
          />
        </div>
      </div>

      {/* Student guidance in audio mode */}
      {roomSetup && !roomSetup.isHost && (
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
    </>
  );
}

AudioModeControls.propTypes = {
  isRecording: PropTypes.bool.isRequired,
  sendMessage: PropTypes.func.isRequired,
  selectedProfile: PropTypes.string,
  onAudioSent: PropTypes.func.isRequired,
  readyState: PropTypes.number,
  onStartRecording: PropTypes.func.isRequired,
  onStopRecording: PropTypes.func.isRequired,
  appMode: PropTypes.string.isRequired,
  setAppMode: PropTypes.func.isRequired,
  toolbarStats: PropTypes.shape({
    newCards: PropTypes.number,
    learningCards: PropTypes.number,
    reviewCards: PropTypes.number
  }),
  roomSetup: PropTypes.shape({
    isHost: PropTypes.bool,
    roomCode: PropTypes.string
  }),
  userRole: PropTypes.string,
  availableProfiles: PropTypes.array,
  onProfileChange: PropTypes.func,
  ui: PropTypes.shape({
    recording: PropTypes.string
  }).isRequired,
  voiceStrings: PropTypes.shape({
    studentLiveBannerPrefix: PropTypes.string,
    studentLiveBannerHighlight: PropTypes.string
  }).isRequired,
  showTBA: PropTypes.func
};

export default AudioModeControls;
