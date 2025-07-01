import React, { useState } from 'react';
import PropTypes from 'prop-types';

function RoomSelectionScreen({ onRoomSetup }) {
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleStudentSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // Clean the room code (remove any whitespace and non-digit characters)
    const cleanedRoomCode = roomCode.replace(/[^0-9]/g, '').trim();
    
    // Basic validation for room code format (5 digits)
    if (cleanedRoomCode.length !== 5) {
      setError('Room code must be 5 digits');
      return;
    }
    
    setIsLoading(true);
    
    try {
      console.log(`Attempting to join room: ${cleanedRoomCode}`);
      
      // Check if room exists
      const response = await fetch(`https://polycast-server.onrender.com/api/check-room/${cleanedRoomCode}`);
      const data = await response.json();
      
      if (!response.ok || !data.exists) {
        console.log('Room check response:', { status: response.status, data });
        throw new Error(data.message || 'Room not found');
      }
      
      onRoomSetup({ 
        isHost: false, 
        roomCode: cleanedRoomCode 
      });
    } catch (err) {
      console.error('Error joining room:', err);
      setError(`Failed to join room: ${err.message || 'Room not found. Please check the code and try again.'}`);
      setIsLoading(false);
    }
  };

  return (
    <div className="student-join-container">
      <p>Enter a 5-digit room code to join as a student</p>
      <form onSubmit={handleStudentSubmit} className="student-join-form">
        <div className="student-join-row">
          <input
            type="text"
            placeholder="5-digit room code"
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
            {isLoading ? 'Joining...' : 'Join Room'}
          </button>
        </div>
      </form>
      {error && <div className="error-message">{error}</div>}
    </div>
  );
}

RoomSelectionScreen.propTypes = {
  onRoomSetup: PropTypes.func.isRequired
};

export default RoomSelectionScreen;
