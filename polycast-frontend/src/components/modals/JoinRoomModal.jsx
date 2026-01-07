import React, { useState } from 'react';
import PropTypes from 'prop-types';

/**
 * Modal for joining a room with a room code
 */
function JoinRoomModal({ isOpen, onClose, onJoin, ui }) {
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  if (!isOpen) return null;

  const handleJoin = async () => {
    const cleanedRoomCode = roomCode.replace(/[^0-9]/g, '').trim();

    if (cleanedRoomCode.length !== 5) {
      setError(ui.joinRoomCodeLength || 'Room code must be 5 digits');
      return;
    }

    setIsJoining(true);
    setError('');

    try {
      await onJoin(cleanedRoomCode);
      // Reset state on successful join
      setRoomCode('');
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to join room');
    } finally {
      setIsJoining(false);
    }
  };

  const handleClose = () => {
    setRoomCode('');
    setError('');
    onClose();
  };

  return (
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
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value)}
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

        {error && (
          <div style={{ color: '#dc2626', marginBottom: 16, fontSize: 14 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button
            onClick={handleClose}
            disabled={isJoining}
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
            onClick={handleJoin}
            disabled={isJoining}
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
            {isJoining ? ui.joinButton + '...' : ui.joinButton}
          </button>
        </div>
      </div>
    </div>
  );
}

JoinRoomModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onJoin: PropTypes.func.isRequired,
  ui: PropTypes.shape({
    joinRoom: PropTypes.string,
    enterRoomCode: PropTypes.string,
    roomCode: PropTypes.string,
    cancel: PropTypes.string,
    joinButton: PropTypes.string,
    joinRoomCodeLength: PropTypes.string
  }).isRequired
};

export default JoinRoomModal;
