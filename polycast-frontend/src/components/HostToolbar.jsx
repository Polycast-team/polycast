import React from 'react';
import PropTypes from 'prop-types';
import { ReadyState } from 'react-use-websocket';
import { getUITranslationsForProfile } from '../utils/profileLanguageMapping';

// Minimalist line icons (SVG) with transparent background
const iconColor = '#a0a0b8';





/**
 * Toolbar component for host/live mode.
 * Contains profile selection, recording controls, and font size controls.
 */
function HostToolbar({ 
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
    selectedProfile,
    setSelectedProfile,
    availableProfiles,
    userRole,
    roomSetup,
    toolbarStats,
}) {
    // Check if we're in host mode (all control functions available) or student mode (view-only)
    const isHostMode = setIsTextMode !== null && onStartRecording !== null;
    const isConnected = readyState === ReadyState.OPEN;
    const ui = getUITranslationsForProfile(selectedProfile);
    const profileOptions = availableProfiles && availableProfiles.length ? availableProfiles : null;

    if (roomSetup?.isHost && !profileOptions) {
        throw new Error('HostToolbar requires availableProfiles when hosting a room');
    }

    return (
        <div className="controls">
            {/* Mode Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Profile Dropdown - only show for hosts */}
                {roomSetup?.isHost && profileOptions && (
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
                      {profileOptions.map((profile) => (
                        <option key={profile} value={profile}>{profile}</option>
                      ))}
                    </select>
                  </>
                )}
                <label style={{ color: '#ccc', fontSize: 15, fontWeight: 500 }}>{ui.mode}:</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
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
                    {isRecording ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                        <rect x="6" y="6" width="12" height="12" rx="1" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                        <path d="M12 3a4 4 0 0 0-4 4v5a4 4 0 1 0 8 0V7a4 4 0 0 0-4-4z" />
                        <path d="M19 11a7 7 0 0 1-14 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        <path d="M12 18v3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    )}
                    {isRecording ? ui.stopRecording : ui.record}
                  </button>
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
            </div>
        </div>
    );
}

HostToolbar.propTypes = {
    readyState: PropTypes.number.isRequired,
    isRecording: PropTypes.bool.isRequired,
    onStartRecording: PropTypes.func,
    onStopRecording: PropTypes.func,
    isTextMode: PropTypes.bool,
    setIsTextMode: PropTypes.func,
    appMode: PropTypes.string.isRequired,
    setAppMode: PropTypes.func,
    showLiveTranscript: PropTypes.bool.isRequired,
    selectedProfile: PropTypes.string.isRequired,
    setSelectedProfile: PropTypes.func.isRequired,
    availableProfiles: PropTypes.arrayOf(PropTypes.string),
    userRole: PropTypes.string,
    roomSetup: PropTypes.object,
    toolbarStats: PropTypes.shape({
        newCards: PropTypes.number,
        learningCards: PropTypes.number,
        reviewCards: PropTypes.number,
    }),
};

export default HostToolbar;
