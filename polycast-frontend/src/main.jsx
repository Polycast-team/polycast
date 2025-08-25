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

  // If we reloaded after creating a room from inside the app (video->Host call), pick it up
  useEffect(() => {
    try {
      const pending = sessionStorage.getItem('pc_pendingHostRoom');
      if (pending && !roomSetup) {
        setRoomSetup({ isHost: true, roomCode: pending });
        setSelectedLanguages(['English']);
        setSelectedProfile('joshua');
        sessionStorage.removeItem('pc_pendingHostRoom');
      }
    } catch {}
  }, [roomSetup]);

  // Show login/profile selection first
  if (!selectedProfile) {
    return (
      <ProfileSelectorScreen
        onProfileSelected={(languages, profile) => {
          setSelectedLanguages(languages);
          setSelectedProfile(profile);
        }}
        userRole="student"
      />
    );
  }

  // Always render the main app; users can host or join from within modes

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
    roomSetup: roomSetup?.roomCode ? roomSetup : null, // Only pass room setup when valid
    userRole: roomSetup?.isHost ? 'host' : null, // no fixed role prior to joining
    studentHomeLanguage: roomSetup?.isHost ? null : selectedLanguages?.[0],
    onJoinRoom: (roomCode) => {
      setRoomSetup({ isHost: false, roomCode });
    },
    onHostRoom: async () => {
      await handleHostClick();
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
