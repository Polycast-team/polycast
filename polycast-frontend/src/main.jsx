import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import AppRouter from './AppRouter.jsx'
import MobileShell from './components/MobileShell.jsx'
import ProfileSelectorScreen from './components/ProfileSelectorScreen.jsx';
import LanguageSelectorScreen from './components/LanguageSelectorScreen.jsx';
import { shouldUseMobileApp } from './utils/deviceDetection.js';
import { getLanguageForProfile } from './utils/profileLanguageMapping.js';
import './components/RoomSelectionScreen.css'; // Import styles
import './index.css'
import apiService from './services/apiService.js'

function Main() {
  const [roomSetup, setRoomSetup] = useState(null);
  const [selectedLanguages, setSelectedLanguages] = useState(null);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [forceFlashcardMobile, setForceFlashcardMobile] = useState(false);

  // Check if device should use mobile app (only once, no resize listener)
  useEffect(() => {
    setIsMobile(shouldUseMobileApp());
  }, []);

  // Always render the unified responsive App; keep detection for future defaults only

  // Host flow: clicking Host should immediately create a room and jump straight into transcript
  const handleHostClick = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await apiService.postJson(apiService.createRoomUrl(), {});
      // Directly enter App with host room setup and default language/profile
      setRoomSetup({ isHost: true, roomCode: data.roomCode });
      setSelectedLanguages(['English']);
      setSelectedProfile('joshua');
    } catch (err) {
      console.error('Error creating room:', err);
      setError(`Failed to create room: ${err.message}`);
    } finally {
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

  // Step 2: Language/Profile selection (students only)
  if (roomSetup && !selectedLanguages) {
    if (!roomSetup.isHost) {
      // Students still see profile selection screen
      return <ProfileSelectorScreen 
        onProfileSelected={(languages, profile) => {
          setSelectedLanguages(languages);
          setSelectedProfile(profile);
        }}
        userRole="student"
      />;
    } else {
      // Host path now skips setup; languages/profile already set
      // Fall through to main app render
    }
  }

  // Step 3: Main app
  const propsToPass = {
    targetLanguages: selectedLanguages || ['English'], // Default fallback
    selectedProfile: selectedProfile,
    onReset: () => {
      setRoomSetup(null);
      setSelectedLanguages(null);
      setSelectedProfile(null);
      setForceFlashcardMobile(false); // Reset mobile mode when resetting
    },
    roomSetup: roomSetup?.roomCode ? roomSetup : null, // Only pass room setup when there's a valid room code
    userRole: roomSetup?.isHost ? 'host' : 'student',
    studentHomeLanguage: roomSetup?.isHost ? null : selectedLanguages?.[0],
    onJoinRoom: (roomCode) => {
      // Update roomSetup to connect student to the room
      setRoomSetup({ isHost: false, roomCode: roomCode });
    },
    onFlashcardModeChange: () => {},
    onProfileChange: (newProfile) => {
      // Update profile in main.jsx state and recalculate languages
      console.log('Profile change requested in main.jsx:', newProfile);
      const newLanguage = getLanguageForProfile(newProfile);
      setSelectedLanguages([newLanguage]);
      setSelectedProfile(newProfile);
    }
  };
  
  console.log('Props being passed to AppRouter:', JSON.stringify(propsToPass, null, 2));
  
  return isMobile ? (
    <MobileShell>
      <AppRouter {...propsToPass} />
    </MobileShell>
  ) : (
    <AppRouter {...propsToPass} />
  );
}


ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Main />
  </React.StrictMode>,
)
