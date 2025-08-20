import React from 'react';
import PropTypes from 'prop-types';
import { ReadyState } from 'react-use-websocket';
import { getTranslationsForProfile, getUITranslationsForProfile } from '../utils/profileLanguageMapping';


/**
 * Component for mode controls, language selection, font size, and recording indicator.
 */
function Controls({ 
    showTBA,
    readyState,
    isRecording, 
    onStartRecording,
    onStopRecording,
    isTextMode,
    setIsTextMode,
    appMode,
    setAppMode,
    showLiveTranscript,
    setShowLiveTranscript,
    showTranslation,
    setShowTranslation,
    selectedProfile,
    setSelectedProfile,
    userRole,
    roomSetup,
    toolbarStats,
}) {
    // Check if we're in host mode (all control functions available) or student mode (view-only)
    const isHostMode = setIsTextMode !== null && onStartRecording !== null;
    const isConnected = readyState === ReadyState.OPEN;
    const t = getTranslationsForProfile(selectedProfile);
    const ui = getUITranslationsForProfile(selectedProfile);

    return (
        <div className="controls">
            {/* Mode Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Profile Dropdown - only show for hosts */}
                {userRole === 'host' && (
                  <>
                    <label style={{ color: '#ccc', fontSize: 15, fontWeight: 500 }}>{ui.profile}:</label>
                    <select
                      value={selectedProfile}
                      onChange={e => {
      console.log('Dropdown changed to:', e.target.value);
      setSelectedProfile && setSelectedProfile(e.target.value);
    }}
                      style={{ minWidth: 110, fontSize: 15, padding: '2px 6px', borderRadius: 6, marginRight: 12 }}
                      aria-label="Profile Selection Dropdown"
                    >
                      <option value="cat">cat</option>
                      <option value="dog">dog</option>
                      <option value="mouse">mouse</option>
                      <option value="horse">horse</option>
                      <option value="lizard">lizard</option>
                      <option value="shirley">shirley</option>
                      <option value="joshua">joshua</option>
                      <option value="tyson">tyson</option>
                    </select>
                  </>
                )}
                <label style={{ color: '#ccc', fontSize: 15, fontWeight: 500 }}>{ui.mode}:</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {/* Show transcript button when not in audio mode */}
                    {appMode !== 'audio' && (
                        <button
                            onClick={() => setAppMode && setAppMode('audio')}
                            disabled={isRecording}
                            style={{
                                background: '#3f3969',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                padding: '6px 12px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                            title={ui.transcript}
                        >
                            📝 {ui.transcript}
                        </button>
                    )}
                    
                    {/* Show video button only when not in video mode */}
                    {appMode !== 'video' && (
                        <button
                            onClick={() => setAppMode && setAppMode('video')}
                            disabled={isRecording}
                            style={{
                                background: '#3f3969',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                padding: '6px 12px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                            title={ui.video}
                        >
                            🎥 {ui.video}
                        </button>
                    )}

                    {/* Show dictionary button only when not in dictionary mode */}
                    {appMode !== 'dictionary' && (
                        <button
                            onClick={() => setAppMode && setAppMode('dictionary')}
                            disabled={isRecording}
                            style={{
                                background: '#3f3969',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                padding: '6px 12px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                            title={ui.dictionaryMode}
                        >
                            📚 {ui.dictionaryMode}
                        </button>
                    )}
                    
                    {/* Show flashcard button only when not in flashcard mode */}
                    {appMode !== 'flashcard' && (
                        <button
                            onClick={() => setAppMode && setAppMode('flashcard')}
                            disabled={isRecording}
                            style={{
                                background: '#3f3969',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                padding: '6px 12px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                            title={ui.flashcardMode}
                        >
                            🔄 {ui.flashcardMode}
                        </button>
                    )}
                </div>
                {/* Transcript/Translation toggles hidden for now */}
                {/* Add Record/Stop button in audio mode - host only */}
                {appMode === 'audio' && isHostMode && (
                  <button
                    onClick={() => {
                      if (isRecording) {
                        onStopRecording && onStopRecording();
                      } else {
                        onStartRecording && onStartRecording();
                      }
                    }}
                    style={{
                      marginLeft: 14,
                      padding: '8px 16px',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: '500',
                      backgroundColor: isRecording ? '#ff4444' : '#4CAF50',
                      color: 'white',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'background-color 0.2s ease'
                    }}
                  >
                    <span style={{ fontSize: '16px' }}>{isRecording ? '⏹️' : '🎙️'}</span>
                    {isRecording ? ui.stopRecording : ui.record}
                  </button>
                )}
            </div>
            
            {/* Flashcard controls - only show in flashcard mode */}
            {(appMode === 'flashcard' || appMode === 'dictionary') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 20 }}>
                <button 
                  onClick={() => window.location.reload()}
                  style={{
                    background: '#3f3969', color: 'white', border: 'none', padding: '6px 12px',
                    borderRadius: '6px', cursor: 'pointer', fontSize: '13px'
                  }}
                >
                  {ui.backToMain}
                </button>
                
                <button 
                  onClick={() => window.dispatchEvent(new CustomEvent('toggleFlashcardCalendar', { detail: true }))}
                  style={{
                    background: 'none', border: '1px solid #2196f3', borderRadius: '6px',
                    padding: '6px 10px', fontSize: '13px', color: '#2196f3', cursor: 'pointer'
                  }}
                >
                  {ui.calendar}
                </button>
                
                <div style={{ color: '#ccc', fontSize: '12px' }}>
                  <span style={{color: '#5f72ff'}}>{ui.new}: {toolbarStats?.newCards ?? 0}</span> • 
                  <span style={{color: '#ef4444', marginLeft: '4px'}}>{ui.learning}: {toolbarStats?.learningCards ?? 0}</span> • 
                  <span style={{color: '#10b981', marginLeft: '4px'}}>{ui.review}: {toolbarStats?.reviewCards ?? 0}</span>
                </div>
              </div>
            )}
            
            {/* Font size controls - available to both hosts and students */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 18 }}>
                <button
                    onClick={() => window.dispatchEvent(new CustomEvent('changeFontSize', { detail: -2 }))}
                    style={{
                        background: '#23233a', color: '#fff', border: 'none', borderRadius: 6, width: 34, height: 34,
                        fontSize: 24, fontWeight: 700, boxShadow: '0 2px 8px #0002', cursor: 'pointer', transition: 'background 0.2s',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                    aria-label="Decrease font size"
                >
                    <span style={{ position: 'relative', top: -2 }}>–</span>
                </button>
                <span id="font-size-display" style={{ color: '#aaa', fontSize: 17, fontWeight: 500, minWidth: 44, textAlign: 'center' }}></span>
                <button
                    onClick={() => window.dispatchEvent(new CustomEvent('changeFontSize', { detail: 2 }))}
                    style={{
                        background: '#23233a', color: '#fff', border: 'none', borderRadius: 6, width: 34, height: 34,
                        fontSize: 24, fontWeight: 700, boxShadow: '0 2px 8px #0002', cursor: 'pointer', transition: 'background 0.2s',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                    aria-label="Increase font size"
                >
                    <span style={{ position: 'relative', top: -2 }}>+</span>
                </button>
                {/* Full Screen Button */}
                <button
                    onClick={() => {
                        if (!document.fullscreenElement) {
                            document.documentElement.requestFullscreen();
                        } else {
                            document.exitFullscreen();
                        }
                    }}
                    style={{
                        background: '#23233a', color: '#fff', border: 'none', borderRadius: 6, width: 40, height: 34,
                        fontSize: 22, fontWeight: 700, boxShadow: '0 2px 8px #0002', cursor: 'pointer', transition: 'background 0.2s',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 18
                    }}
                    aria-label="Toggle Full Screen"
                    title="Full Screen (F11)"
                >
                    <span style={{ fontSize: 18 }}>⛶</span>
                </button>
            </div>
        </div>
    );
}

Controls.propTypes = {
    readyState: PropTypes.number.isRequired,
    isRecording: PropTypes.bool.isRequired,
    onStartRecording: PropTypes.func,
    onStopRecording: PropTypes.func,
    isTextMode: PropTypes.bool,
    setIsTextMode: PropTypes.func,
    appMode: PropTypes.string.isRequired,
    setAppMode: PropTypes.func,
    showLiveTranscript: PropTypes.bool.isRequired,
    setShowLiveTranscript: PropTypes.func,
    showTranslation: PropTypes.bool.isRequired,
    setShowTranslation: PropTypes.func,
    selectedProfile: PropTypes.string.isRequired,
    setSelectedProfile: PropTypes.func.isRequired,
    userRole: PropTypes.string,
    roomSetup: PropTypes.object,
    toolbarStats: PropTypes.shape({
        newCards: PropTypes.number,
        learningCards: PropTypes.number,
        reviewCards: PropTypes.number,
    }),
};

export default Controls;
