import React, { useState } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import AppRouter from './AppRouter.jsx'
import LanguageSelectorScreen from './components/LanguageSelectorScreen.jsx';
import './components/RoomSelectionScreen.css'; // Import styles
import './index.css'

function Main() {
  const [roomSetup, setRoomSetup] = useState(null);
  const [selectedLanguages, setSelectedLanguages] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Host flow: clicking Host should immediately create a room and advance to language selection
  const handleHostClick = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch('https://polycast-server.onrender.com/api/create-room', {
        method: 'POST'
      });
      if (!response.ok) {
        throw new Error(`Failed to create room: ${response.statusText}`);
      }
      const data = await response.json();
      setRoomSetup({ isHost: true, roomCode: data.roomCode });
    } catch (err) {
      setError(`Failed to create room: ${err.message}`);
      setIsLoading(false);
    }
  };

  // Step 1: Choose Host or Join as Student
  if (!roomSetup) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#23243a' }}>
        <h1 style={{ color: '#f7f7fa', marginBottom: 12 }}>PolyCast</h1>
        <div style={{ background: '#23243a', borderRadius: 16, boxShadow: '0 4px 18px 0 rgba(60, 60, 90, 0.09)', padding: 36, minWidth: 320, maxWidth: 420, textAlign: 'center' }}>
          <h2 style={{ color: '#fff', marginBottom: 24 }}>Choose Your Role</h2>
          <button onClick={handleHostClick} disabled={isLoading} style={{ margin: '0 0 18px 0', padding: '12px 32px', fontSize: 18, fontWeight: 700, borderRadius: 8, background: 'linear-gradient(90deg, #5f72ff 0%, #9a5cff 100%)', color: '#fff', border: 'none', cursor: 'pointer' }}>
            {isLoading ? 'Creating Room...' : 'Host'}
          </button>
          <div style={{ margin: '18px 0', color: '#b3b3e7', fontWeight: 600 }}>or</div>
          <div>
            <p style={{ color: '#fff', marginBottom: '12px' }}>Enter a 5-digit room code to join as a student</p>
            <form onSubmit={(e) => {
              e.preventDefault();
              const input = e.target.elements.roomCode;
              const roomCode = input.value;
              
              // Clean the room code
              const cleanedRoomCode = roomCode.replace(/[^0-9]/g, '').trim();
              
              // Validation
              if (cleanedRoomCode.length !== 5) {
                setError('Room code must be 5 digits');
                return;
              }
              
              setIsLoading(true);
              setError('');
              
              // Check if room exists
              fetch(`https://polycast-server.onrender.com/api/check-room/${cleanedRoomCode}`)
                .then(response => response.json())
                .then(data => {
                  if (!data.exists) {
                    throw new Error(data.message || 'Room not found');
                  }
                  
                  // Set room setup for student
                  setRoomSetup({ 
                    isHost: false, 
                    roomCode: cleanedRoomCode 
                  });
                })
                .catch(err => {
                  console.error('Error joining room:', err);
                  setError(`Failed to join room: ${err.message || 'Room not found. Please check the code and try again.'}`);
                  setIsLoading(false);
                });
            }}>
              <div className="student-join-row" style={{ display: 'flex', alignItems: 'center', gap: '20px', marginTop: '8px' }}>
                <input
                  name="roomCode"
                  type="text"
                  placeholder="5-digit room code"
                  maxLength={5}
                  required
                  disabled={isLoading}
                  style={{
                    flex: '1 1 120px',
                    fontSize: '1.1rem',
                    padding: '0.6rem 1rem',
                    borderRadius: '4px',
                    border: '1px solid #444',
                    background: '#fff'
                  }}
                />
                <button
                  type="submit"
                  disabled={isLoading}
                  style={{
                    fontSize: '1.1rem',
                    padding: '0.6rem 1.3rem',
                    backgroundColor: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  {isLoading ? 'Joining...' : 'Join Room'}
                </button>
              </div>
            </form>
          </div>
          {error && <div style={{ color: '#dc2626', marginTop: 12 }}>{error}</div>}
        </div>
      </div>
    );
  }

  // Step 2: Language selection (only for hosts)
  if (roomSetup.isHost && !selectedLanguages) {
    return <LanguageSelectorScreen onLanguageSelected={setSelectedLanguages} />;
  }

  // Step 3: Main app
  return (
    <AppRouter
      targetLanguages={selectedLanguages || ['English']} // Default for students
      onReset={() => {
        setRoomSetup(null);
        setSelectedLanguages(null);
      }}
      roomSetup={roomSetup}
    />
  );
}


ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Main />
  </React.StrictMode>,
)
