import React from 'react';
import PropTypes from 'prop-types';
import { ReadyState } from 'react-use-websocket';
import { getTranslationsForProfile } from '../utils/profileLanguageMapping';


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
    autoSend,
    setAutoSend,
    showNoiseLevel,
    setShowNoiseLevel,
    showLiveTranscript,
    setShowLiveTranscript,
    showTranslation,
    setShowTranslation,
    selectedProfile,
    setSelectedProfile,
    userRole,
    roomSetup,
}) {
    // Check if we're in host mode (all control functions available) or student mode (view-only)
    const isHostMode = setIsTextMode !== null && onStartRecording !== null;
    const isConnected = readyState === ReadyState.OPEN;
    const t = getTranslationsForProfile(selectedProfile);

    return (
        <div className="controls">
            {/* Mode Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Profile Dropdown - only show for hosts */}
                {userRole === 'host' && (
                  <>
                    <label style={{ color: '#ccc', fontSize: 15, fontWeight: 500 }}>Profile:</label>
                    <select
                      value={selectedProfile}
                      onChange={e => {
      console.log('Dropdown changed to:', e.target.value);
      setSelectedProfile && setSelectedProfile(e.target.value);
    }}
                      style={{ minWidth: 110, fontSize: 15, padding: '2px 6px', borderRadius: 6, marginRight: 12 }}
                      aria-label="Profile Selection Dropdown"
                    >
                      <option value="non-saving">non-saving</option>
                      <option value="cat">cat</option>
                      <option value="dog">dog</option>
                      <option value="mouse">mouse</option>
                      <option value="horse">horse</option>
                      <option value="lizard">lizard</option>
                      <option value="shirley">shirley</option>
                    </select>
                  </>
                )}
                <label style={{ color: '#ccc', fontSize: 15, fontWeight: 500 }}>Mode:</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {/* Show transcript button only when not in audio mode, when user is student, and when in a room */}
                    {appMode !== 'audio' && userRole === 'student' && roomSetup && (
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
                            title="View Transcript"
                        >
                            📝 Transcript
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
                            title="Dictionary Mode"
                        >
                            📚 {t.dictionaryMode}
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
                            title="Flashcard Mode"
                        >
                            🔄 {t.flashcardMode}
                        </button>
                    )}
                </div>
                {/* Only show the live transcript and translation checkboxes in audio mode */}
                {appMode === 'audio' && (
                  <>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 14, fontSize: 15, fontWeight: 500, color: '#ccc' }}>
                      <input
                        type="checkbox"
                        checked={showLiveTranscript}
                        onChange={e => {
                          setShowLiveTranscript && setShowLiveTranscript(e.target.checked);
                        }}
                        disabled={isRecording}
                      />
                      Show Transcript
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 14, fontSize: 15, fontWeight: 500, color: '#ccc' }}>
                      <input
                        type="checkbox"
                        checked={showTranslation}
                        onChange={e => {
                          setShowTranslation && setShowTranslation(e.target.checked);
                        }}
                        disabled={isRecording}
                      />
                      Show Translation
                    </label>
                  </>
                )}
                {/* Add auto-send toggle button in audio mode - host only */}
                {appMode === 'audio' && isHostMode && (
                  <button
                    onClick={() => {
                      setAutoSend && setAutoSend(!autoSend);
                    }}
                    disabled={isRecording} // Disable while recording
                    style={{
                      marginLeft: 14,
                      padding: '8px 12px',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: '500',
                      backgroundColor: autoSend ? '#ff4444' : '#666',
                      color: 'white',
                      cursor: isRecording ? 'not-allowed' : 'pointer',
                      opacity: isRecording ? 0.6 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'background-color 0.2s ease'
                    }}
                  >
                    <span style={{ fontSize: '16px' }}>🎙️</span>
                    Auto-send
                  </button>
                )}
                {/* Add show noise levels checkbox in audio mode */}
                {appMode === 'audio' && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 14, fontSize: 15, fontWeight: 500, color: '#ccc' }}>
                    <input
                      type="checkbox"
                      checked={showNoiseLevel}
                      onChange={e => {
                        setShowNoiseLevel && setShowNoiseLevel(e.target.checked);
                      }}
                    />
                    Show Noise Levels
                  </label>
                )}
            </div>
            
            {/* Flashcard controls - only show in flashcard mode */}
            {appMode === 'flashcard' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 20 }}>
                <button 
                  onClick={() => window.location.reload()}
                  style={{
                    background: '#3f3969', color: 'white', border: 'none', padding: '6px 12px',
                    borderRadius: '6px', cursor: 'pointer', fontSize: '13px'
                  }}
                >
                  {t.backToMain}
                </button>
                
                <button 
                  onClick={() => {
                    showTBA('Flashcard calendar is not yet implemented. This will be available in a future update.');
                    // We'll need to pass this function down from App.jsx
                    // window.dispatchEvent(new CustomEvent('showFlashcardCalendar'));
                  }}
                  style={{
                    background: 'none', border: '1px solid #2196f3', borderRadius: '6px',
                    padding: '6px 10px', fontSize: '13px', color: '#2196f3', cursor: 'pointer'
                  }}
                >
                  {t.calendar}
                </button>
                
                <div style={{ color: '#ccc', fontSize: '12px' }}>
                  <span style={{color: '#5f72ff'}}>{t.new}: 5</span> • 
                  <span style={{color: '#ef4444', marginLeft: '4px'}}>{t.learning}: 0</span> • 
                  <span style={{color: '#10b981', marginLeft: '4px'}}>{t.review}: 1</span>
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
    autoSend: PropTypes.bool,
    setAutoSend: PropTypes.func,
    showNoiseLevel: PropTypes.bool,
    setShowNoiseLevel: PropTypes.func,
    showLiveTranscript: PropTypes.bool.isRequired,
    setShowLiveTranscript: PropTypes.func,
    showTranslation: PropTypes.bool.isRequired,
    setShowTranslation: PropTypes.func,
    selectedProfile: PropTypes.string.isRequired,
    setSelectedProfile: PropTypes.func.isRequired,
    userRole: PropTypes.string,
    roomSetup: PropTypes.object,
};

export default Controls;
