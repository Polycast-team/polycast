import React, { useRef, useEffect, useState } from 'react';
import PropTypes from 'prop-types';

function VideoMode() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [hasPermission, setHasPermission] = useState(null);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const initializingRef = useRef(false);

  const requestCameraAccess = async () => {
    // Prevent multiple simultaneous requests
    if (initializingRef.current) {
      console.log('VideoMode: Camera access already in progress, skipping...');
      return;
    }

    // If we already have a working stream, don't request again
    if (streamRef.current && hasPermission === true) {
      console.log('VideoMode: Camera already active, skipping request...');
      return;
    }

    initializingRef.current = true;
    console.log(`VideoMode: Attempting camera access (attempt ${retryCount + 1})`);
    setHasPermission(null);
    setError(null);
    
    try {
      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia not supported in this browser');
      }

      console.log('VideoMode: getUserMedia API is available, requesting permissions...');

      // Add a timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Camera request timed out after 10 seconds')), 10000);
      });

      const cameraPromise = navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: false 
      });

      const stream = await Promise.race([cameraPromise, timeoutPromise]);
      
      console.log('VideoMode: Camera access granted, setting up video stream');
      
      // Store the stream in ref for persistence
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setHasPermission(true);
        setError(null);
      }
    } catch (err) {
      console.error('VideoMode: Error accessing camera:', err);
      setHasPermission(false);
      
      // Provide more specific error messages
      if (err.message && err.message.includes('timed out')) {
        setError('Camera request timed out. This might be a browser issue. Try refreshing the page or checking browser settings.');
      } else if (err.name === 'NotAllowedError') {
        setError('Camera access denied. Please allow camera permissions and try again.');
      } else if (err.name === 'NotFoundError') {
        setError('No camera found. Please connect a camera and try again.');
      } else if (err.name === 'NotReadableError') {
        setError('Camera is being used by another application.');
      } else if (err.name === 'OverconstrainedError') {
        setError('Camera constraints not supported by your device.');
      } else {
        setError(`Camera error: ${err.message || 'Unknown error'}`);
      }
    } finally {
      initializingRef.current = false;
    }
  };

  useEffect(() => {
    console.log('VideoMode: Component mounted, checking for existing stream...');
    
    // If we already have a stream, just set it up
    if (streamRef.current && videoRef.current) {
      console.log('VideoMode: Reusing existing stream');
      videoRef.current.srcObject = streamRef.current;
      setHasPermission(true);
      setError(null);
      return;
    }

    // Add a small delay to ensure component is mounted
    const timer = setTimeout(() => {
      requestCameraAccess();
    }, 100);

    // Cleanup function
    return () => {
      clearTimeout(timer);
      // Note: We don't stop the stream here to allow it to persist across re-mounts
      // The stream will be stopped when the component is actually destroyed
    };
  }, []);

  // Separate cleanup effect that only runs on actual unmount
  useEffect(() => {
    return () => {
      console.log('VideoMode: Component unmounting, stopping stream...');
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  if (hasPermission === false) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '400px',
        background: '#1a1a1a',
        color: '#fff',
        fontSize: '18px',
        borderRadius: '12px',
        margin: '20px'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>📹</div>
          <div>{error || 'Camera access required for video mode'}</div>
          <div style={{ fontSize: '14px', marginTop: '10px', color: '#aaa' }}>
            Please enable camera permissions and try again
          </div>
          <button 
            onClick={() => {
              setRetryCount(prev => prev + 1);
              requestCameraAccess();
            }}
            style={{
              marginTop: '15px',
              padding: '8px 16px',
              background: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Retry Camera Access
          </button>
        </div>
      </div>
    );
  }

  if (hasPermission === null) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '400px',
        background: '#1a1a1a',
        color: '#fff',
        fontSize: '18px',
        borderRadius: '12px',
        margin: '20px'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>📹</div>
          <div>Requesting camera access...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '20px',
      background: '#0a0a0a',
      borderRadius: '12px',
      margin: '20px'
    }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          width: '100%',
          maxWidth: '800px',
          height: 'auto',
          borderRadius: '12px',
          transform: 'scaleX(-1)', // Mirror the video
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
        }}
      />
    </div>
  );
}

VideoMode.propTypes = {};

export default VideoMode;