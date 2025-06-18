import React, { useRef, useEffect, useState } from 'react';
import PropTypes from 'prop-types';

function VideoMode() {
  const videoRef = useRef(null);
  const [hasPermission, setHasPermission] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let stream = null;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user'
          },
          audio: false 
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setHasPermission(true);
          setError(null);
        }
      } catch (err) {
        console.error('Error accessing camera:', err);
        setHasPermission(false);
        setError('Camera access denied or unavailable');
      }
    };

    startCamera();

    // Cleanup function
    return () => {
      if (stream) {
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
            Please enable camera permissions and refresh the page
          </div>
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