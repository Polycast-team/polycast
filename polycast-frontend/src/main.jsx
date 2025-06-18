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
          <button onClick={handleHostClick} disabled={isLoading} style={{ margin: '0 0 18px 0', padding: '12px 32px', fontSize: 18, fontWeight: 700, borderRadius: 8, background: 'linear-gradient(90deg, #5f72ff 0%, #9a5cff 100%)', color: '#fff', border: 'none', cursor: 'pointer', width: '100%' }}>
            {isLoading ? 'Creating Room...' : 'Host'}
          </button>
          <div style={{ margin: '18px 0', color: '#b3b3e7', fontWeight: 600 }}>or</div>
          <button onClick={() => setRoomSetup({ isHost: false, needsLanguageSelection: true })} disabled={isLoading} style={{ margin: '0', padding: '12px 32px', fontSize: 18, fontWeight: 700, borderRadius: 8, background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)', color: '#fff', border: 'none', cursor: 'pointer', width: '100%' }}>
            Student
          </button>
          {error && <div style={{ color: '#dc2626', marginTop: 12 }}>{error}</div>}
        </div>
      </div>
    );
  }

  // Step 2: Language selection
  if (roomSetup && !selectedLanguages) {
    if (roomSetup.isHost) {
      // Host selects display languages (0-4)
      return <LanguageSelectorScreen onLanguageSelected={setSelectedLanguages} />;
    } else if (roomSetup.needsLanguageSelection) {
      // Student selects home language (1 only) - placeholder for now
      // TODO: Create student language selector
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#23243a' }}>
          <h2 style={{ color: '#fff', marginBottom: 24 }}>Select Your Home Language</h2>
          <p style={{ color: '#b3b3e7', marginBottom: 24 }}>This will be used for your flashcards and translations</p>
          <button onClick={() => setSelectedLanguages(['Spanish'])} style={{ padding: '12px 32px', fontSize: 18, fontWeight: 700, borderRadius: 8, background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)', color: '#fff', border: 'none', cursor: 'pointer' }}>
            Spanish (Temporary)
          </button>
        </div>
      );
    }
  }

  // Step 3: Main app
  return (
    <AppRouter
      targetLanguages={selectedLanguages || ['English']} // Default fallback
      onReset={() => {
        setRoomSetup(null);
        setSelectedLanguages(null);
      }}
      roomSetup={roomSetup?.isHost ? roomSetup : null} // Only pass room setup for hosts
      userRole={roomSetup?.isHost ? 'host' : 'student'}
      studentHomeLanguage={roomSetup?.isHost ? null : selectedLanguages?.[0]}
    />
  );
}


ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Main />
  </React.StrictMode>,
)
