import React from 'react';
import PropTypes from 'prop-types';

/**
 * App header with logo and room controls
 */
function AppHeader({
  appStrings,
  ui,
  errorStrings,
  appMode,
  roomSetup,
  onHostRoom,
  onOpenJoinModal,
  onReset
}) {
  return (
    <>
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

        {/* Right side spacer */}
        <div style={{ width: '200px' }} />
      </div>

      {/* Header right: host/join controls and room code display */}
      <div style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 100, display: 'flex', gap: '8px', alignItems: 'center' }}>
        {(appMode === 'video' || appMode === 'audio') && !roomSetup && (
          <>
            <button
              onClick={async () => {
                try { await onHostRoom?.(); }
                catch (e) { alert(errorStrings.createRoomFailed(e?.message || e)); }
              }}
              style={{ padding: '8px 16px', fontSize: 14, borderRadius: 4, background: '#3b82f6', color: '#fff', border: 'none', cursor: 'pointer' }}
            >
              {appMode === 'audio' ? (appStrings.hostRoom || 'Host room') : appStrings.hostCall}
            </button>
            <button
              onClick={onOpenJoinModal}
              style={{ padding: '8px 16px', fontSize: 14, borderRadius: 4, background: '#10b981', color: '#fff', border: 'none', cursor: 'pointer' }}
            >
              {appMode === 'audio' ? ui.joinRoom : appStrings.joinCall}
            </button>
          </>
        )}

        {/* Show room pill in top-right when in video OR when hosting in audio (live) */}
        {((appMode === 'video' && roomSetup) || (appMode === 'audio' && roomSetup && roomSetup.isHost)) && (
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
            <button
              onClick={onReset}
              style={{ padding: '8px 16px', fontSize: 14, borderRadius: 4, background: '#444', color: '#fff', border: 'none', cursor: 'pointer' }}
            >
              {appMode === 'audio' ? ui.exitRoom : appStrings.endCall}
            </button>
          </>
        )}
      </div>
    </>
  );
}

AppHeader.propTypes = {
  appStrings: PropTypes.shape({
    appName: PropTypes.string,
    hostRoom: PropTypes.string,
    hostCall: PropTypes.string,
    joinCall: PropTypes.string,
    endCall: PropTypes.string
  }).isRequired,
  ui: PropTypes.shape({
    joinRoom: PropTypes.string,
    room: PropTypes.string,
    student: PropTypes.string,
    exitRoom: PropTypes.string
  }).isRequired,
  errorStrings: PropTypes.shape({
    createRoomFailed: PropTypes.func
  }).isRequired,
  appMode: PropTypes.string.isRequired,
  roomSetup: PropTypes.shape({
    isHost: PropTypes.bool,
    roomCode: PropTypes.string
  }),
  onHostRoom: PropTypes.func,
  onOpenJoinModal: PropTypes.func,
  onReset: PropTypes.func
};

export default AppHeader;
