import React, { useState } from 'react';
import PropTypes from 'prop-types';
import apiService from '../services/apiService';
import { getUIStrings } from '../i18n/index.js';
import { getNativeLanguageCodeForProfile } from '../utils/profileLanguageMapping.js';

function RoomSelectionScreen({ onRoomSetup, selectedProfile }) {
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const ui = getUIStrings(getNativeLanguageCodeForProfile(selectedProfile));

  const handleStudentSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // Clean the room code (remove any whitespace and non-digit characters)
    const cleanedRoomCode = roomCode.replace(/[^0-9]/g, '').trim();
    
    // Basic validation for room code format (5 digits)
    if (cleanedRoomCode.length !== 5) {
      setError(ui?.errors?.joinRoomCodeLength || 'Room code must be 5 digits.');
      return;
    }
    
    setIsLoading(true);
    
    try {
      console.log(`Attempting to join room: ${cleanedRoomCode}`);

      const data = await apiService.fetchJson(apiService.checkRoomUrl(cleanedRoomCode));
      
      onRoomSetup({ 
        isHost: false, 
        roomCode: cleanedRoomCode 
      });
    } catch (err) {
      console.error('Error joining room:', err);
      setError(ui?.errors?.createRoomFailed ? ui.errors.createRoomFailed(err.message) : `Failed to join room: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="student-join-container">
      <p>{ui?.enterRoomCode || 'Enter room code'}</p>
      <form onSubmit={handleStudentSubmit} className="student-join-form">
        <div className="student-join-row">
          <input
            type="text"
            placeholder={ui?.enterRoomCode || 'Enter room code'}
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value)}
            maxLength={5}
            required
            disabled={isLoading}
          />
          <button 
            type="submit" 
            className="room-btn student-btn"
            disabled={isLoading}
          >
            {isLoading ? (ui?.joining || 'Joining...') : (ui?.joinRoom || 'Join Room')}
          </button>
        </div>
      </form>
      {error && <div className="error-message">{error}</div>}
    </div>
  );
}

RoomSelectionScreen.propTypes = {
  onRoomSetup: PropTypes.func.isRequired,
  selectedProfile: PropTypes.string,
};

export default RoomSelectionScreen;
