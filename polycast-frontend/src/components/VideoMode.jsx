import React, { useRef, useEffect, useState } from 'react';
import PropTypes from 'prop-types';

function VideoMode() {
  const videoRef = useRef(null);
  const [hasPermission, setHasPermission] = useState(null);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  const requestCameraAccess = async () => {
    console.log(`VideoMode: Attempting camera access (attempt ${retryCount + 1})`);
    setHasPermission(null);
    setError(null);
    
    try {
      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia not supported in this browser');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: false 
      });
      
      console.log('VideoMode: Camera access granted, setting up video stream');
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setHasPermission(true);
        setError(null);
      }
    } catch (err) {
      console.error('VideoMode: Error accessing camera:', err);
      setHasPermission(false);
      
      // Provide more specific error messages
      if (err.name === 'NotAllowedError') {
        setError('Camera access denied. Please allow camera permissions and refresh.');
      } else if (err.name === 'NotFoundError') {
        setError('No camera found. Please connect a camera and try again.');
      } else if (err.name === 'NotReadableError') {
        setError('Camera is being used by another application.');
      } else if (err.name === 'OverconstrainedError') {
        setError('Camera constraints not supported by your device.');
      } else {
        setError(`Camera error: ${err.message || 'Unknown error'}`);
      }
    }
  };

  useEffect(() => {
    // Add a small delay to ensure component is mounted
    const timer = setTimeout(() => {
      requestCameraAccess();
    }, 100);

    // Cleanup function
    return () => {
      clearTimeout(timer);
      // Stop any existing video stream
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject;
        stream.getTracks().forEach(track => track.stop());
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