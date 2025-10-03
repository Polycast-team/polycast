import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import AppRouter from './AppRouter.jsx'
import MobileShell from './components/MobileShell.jsx'
// import ProfileSelectorScreen from './components/ProfileSelectorScreen.jsx';
import LanguageSelectorScreen from './components/LanguageSelectorScreen.jsx';
import { shouldUseMobileApp } from './utils/deviceDetection.js';
import { getLanguageForProfile, registerProfileLanguages, clearProfileLanguageRegistry } from './utils/profileLanguageMapping.js';
import './components/RoomSelectionScreen.css'; // Import styles
import './index.css'
import apiService from './services/apiService.js'
import authClient from './services/authClient.js'
import { initThemeFromStorage } from './theme/palettes.js'

function Main() {
  const [roomSetup, setRoomSetup] = useState(null);
  const [selectedLanguages, setSelectedLanguages] = useState(null);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [currentProfile, setCurrentProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [forceFlashcardMobile, setForceFlashcardMobile] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [authToken, setAuthToken] = useState(() => authClient.getToken ? authClient.getToken() : '');

  // Check if device should use mobile app (only once, no resize listener)
  useEffect(() => {
    setIsMobile(shouldUseMobileApp());
  }, []);

  // Initialize theme from localStorage (or defaults)
  useEffect(() => {
    try {
      initThemeFromStorage();
    } catch {}
  }, []);

  useEffect(() => {
    let aborted = false;

    async function loadProfile() {
      try {
        const profile = await authClient.me();
        if (!profile) {
          if (!aborted) {
            setProfileLoading(false);
          }
          return;
        }
        if (!profile.username || !profile.native_language || !profile.target_language) {
          throw new Error('Profile response missing language fields');
        }
        if (aborted) return;
        registerProfileLanguages(profile.username, {
          nativeLanguage: profile.native_language,
          targetLanguage: profile.target_language,
        });
        setCurrentProfile(profile);
        setSelectedProfile(profile.username);
        setSelectedLanguages([profile.target_language]);
      } catch (err) {
        console.error('Failed to load profile data', err);
        if (!aborted) {
          if (authClient.clearToken) {
            authClient.clearToken();
          }
          clearProfileLanguageRegistry();
          setCurrentProfile(null);
          setSelectedProfile(null);
          setSelectedLanguages(null);
        }
      } finally {
        if (!aborted) {
          setProfileLoading(false);
        }
      }
    }

    if (!authToken) {
      setCurrentProfile(null);
      setSelectedProfile(null);
      setSelectedLanguages(null);
      setProfileLoading(false);
      clearProfileLanguageRegistry();
      return () => {
        aborted = true;
      };
    }

    setProfileLoading(true);
    loadProfile();

    return () => {
      aborted = true;
    };
  }, [authToken]);

  useEffect(() => {
    const handleAuthChanged = () => {
      const token = authClient.getToken ? authClient.getToken() : '';
      setAuthToken(token);
      if (token) {
        setProfileLoading(true);
      } else {
        clearProfileLanguageRegistry();
        setCurrentProfile(null);
        setSelectedProfile(null);
        setSelectedLanguages(null);
        setProfileLoading(false);
      }
    };
    const handleStorage = (event) => {
      if (event.key === 'pc_jwt') {
        handleAuthChanged();
      }
    };

    const authEventName = authClient.AUTH_EVENT || 'pc-auth-changed';

    window.addEventListener(authEventName, handleAuthChanged);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener(authEventName, handleAuthChanged);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // Always render the unified responsive App; keep detection for future defaults only

  // Host flow: clicking Host should immediately create a room and jump straight into transcript
  const handleHostClick = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await apiService.postJson(apiService.createRoomUrl(), {});
      if (!currentProfile) {
        throw new Error('Cannot create a room before profile data is loaded');
      }
      // Directly enter App with host room setup and current profile
      setRoomSetup({ isHost: true, roomCode: data.roomCode });
      setSelectedLanguages([currentProfile.target_language]);
      setSelectedProfile(currentProfile.username);
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
      if (pending && !roomSetup && currentProfile) {
        setRoomSetup({ isHost: true, roomCode: pending });
        setSelectedLanguages([currentProfile.target_language]);
        setSelectedProfile(currentProfile.username);
        sessionStorage.removeItem('pc_pendingHostRoom');
      }
    } catch (err) {
      console.error('Failed to resume pending host room', err);
    }
  }, [roomSetup, currentProfile]);

  // Route-based auth flow now handles login/register; always render AppRouter

  // Always render the main app; users can host or join from within modes

  // Step 3: Main app
  const propsToPass = {
    targetLanguages: selectedLanguages,
    selectedProfile,
    currentProfile,
    profileLoading,
    onReset: () => {
      setRoomSetup(null);
      if (currentProfile) {
        setSelectedLanguages([currentProfile.target_language]);
        setSelectedProfile(currentProfile.username);
      } else {
        setSelectedLanguages(null);
        setSelectedProfile(null);
      }
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
