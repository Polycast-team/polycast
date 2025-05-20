import React from 'react';
import PropTypes from 'prop-types';
import { ReadyState } from 'react-use-websocket';

/**
 * Component for mode controls, language selection, font size, and recording indicator.
 */
function Controls({ 
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
    translationLockedByHost = false,
    isStudentMode = false,
    selectedProfile,
    setSelectedProfile,
    testPhraseEnabled,
    setTestPhraseEnabled,
}) {
    // Check if we're in host mode (all control functions available) or student mode (view-only)
    const isHostMode = setIsTextMode !== null && onStartRecording !== null;
    const isConnected = readyState === ReadyState.OPEN;

    return (
        <div className="controls">
            {/* Mode Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* New Animal Dropdown */}
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
                </select>
                <label style={{ color: '#ccc', fontSize: 15, fontWeight: 500 }}>Mode:</label>
                <select 
                    value={appMode}
                    onChange={e => setAppMode && setAppMode(e.target.value)}
                    style={{ minWidth: 90, fontSize: 15, padding: '2px 6px', borderRadius: 6 }}
                    disabled={isRecording} // Only disable while recording, allow students to change modes
                >
                    <option value="audio">audio mode</option>
                    <option value="text">text mode</option>
                    <option value="dictionary">dictionary mode</option>
                    <option value="flashcard">flashcard mode</option>
                </select>
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
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 14, fontSize: 15, fontWeight: 500, color: '#ccc', position: 'relative' }}>
  <input
    type="checkbox"
    checked={showTranslation}
    onChange={e => {
      setShowTranslation && setShowTranslation(e.target.checked);
    }}
    disabled={isRecording || (isStudentMode && translationLockedByHost)}
  />
  Show Translation
  {isStudentMode && translationLockedByHost && (
    <span style={{
      color: '#ffb84d',
      fontSize: 13,
      marginLeft: 8,
      fontWeight: 600,
      background: 'rgba(255,184,77,0.07)',
      borderRadius: 4,
      padding: '2px 8px',
      position: 'absolute',
      top: '100%',
      left: 0
    }}>
      (Disabled by teacher)
    </span>
  )}
</label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 14, fontSize: 15, fontWeight: 500, color: '#ccc' }}>
                      <input
                        type="checkbox"
                        checked={testPhraseEnabled}
                        onChange={e => {
                          console.log('Test phrase checkbox clicked, new value:', e.target.checked);
                          // Remove the conditional check - always call the setter directly
                          setTestPhraseEnabled(e.target.checked);
                        }}
                        disabled={isRecording}
                      />
                      Test Phrase
                    </label>
                  </>
                )}
                {/* Add auto-send checkbox in audio mode - host only */}
                {appMode === 'audio' && isHostMode && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 14, fontSize: 15, fontWeight: 500, color: '#ccc' }}>
                    <input
                      type="checkbox"
                      checked={autoSend}
                      onChange={e => {
                        setAutoSend && setAutoSend(e.target.checked);
                      }}
                      disabled={isRecording} // Disable while recording
                    />
                    Auto-send
                  </label>
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
    translationLockedByHost: PropTypes.bool,
    isStudentMode: PropTypes.bool,
    selectedProfile: PropTypes.string.isRequired,
    setSelectedProfile: PropTypes.func.isRequired,
};

export default Controls;
