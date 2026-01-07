import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * Hook for managing recording state and controls
 * Handles start/stop recording, notification display, and keyboard shortcuts
 */
export function useRecordingControls(roomSetup) {
  const [isRecording, setIsRecording] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationOpacity, setNotificationOpacity] = useState(1);

  const isRecordingRef = useRef(isRecording);
  const notificationTimeoutRef = useRef(null);

  // Keep ref in sync with state
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
    };
  }, []);

  const handleStartRecording = useCallback(() => {
    console.log('APP: Start Recording');
    setIsRecording(true);
  }, []);

  const handleStopRecording = useCallback(() => {
    console.log('APP: Stop Recording');
    setIsRecording(false);
  }, []);

  const onAudioSent = useCallback(() => {
    console.log("Audio chunk sent");
    setShowNotification(true);
    setNotificationOpacity(1);

    // Clear any existing timeout
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
    }

    // Set new timeout for fade and hide
    notificationTimeoutRef.current = setTimeout(() => {
      setNotificationOpacity(0); // Start fading out
      notificationTimeoutRef.current = setTimeout(() => {
        setShowNotification(false); // Hide after fade
      }, 1000);
    }, 1000);
  }, []);

  // Page Up/Page Down recording hotkeys (only for hosts)
  useEffect(() => {
    // Only add hotkeys for hosts (not students)
    if (roomSetup && !roomSetup.isHost) return;

    function handlePageKey(e) {
      if (e.repeat) return; // Prevent holding key from triggering repeatedly
      if (e.key === "PageUp") {
        e.preventDefault();
        handleStartRecording();
      }
      if (e.key === "PageDown") {
        e.preventDefault();
        handleStopRecording();
      }
    }
    window.addEventListener("keydown", handlePageKey);
    return () => window.removeEventListener("keydown", handlePageKey);
  }, [roomSetup, handleStartRecording, handleStopRecording]);

  return {
    isRecording,
    setIsRecording,
    showNotification,
    notificationOpacity,
    handleStartRecording,
    handleStopRecording,
    onAudioSent,
    isRecordingRef
  };
}
