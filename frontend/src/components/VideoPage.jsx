import React, { useEffect } from 'react';

const VideoPage = () => {
  useEffect(() => {
    // Log when this component mounts to help with debugging
    console.log('VideoPage component mounted');
    
    // Add title for this page
    document.title = 'Polycast Video';
    
    return () => {
      console.log('VideoPage component unmounted');
    };
  }, []);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      backgroundColor: '#1a1a2e',
      color: 'white',
      fontFamily: 'Arial, sans-serif',
      padding: '20px'
    }}>
      <h1 style={{ fontSize: '2.5rem', marginBottom: '1.5rem' }}>Welcome to Polycast Video!</h1>
      <p style={{ fontSize: '1.2rem', maxWidth: '600px', textAlign: 'center' }}>
        This is a dedicated video page for the Polycast application. You can access this page directly at: polycast-frontend.onrender.com/video
      </p>
      <div style={{ marginTop: '2rem' }}>
        <a 
          href="/"
          style={{
            color: '#4ade80', 
            textDecoration: 'none',
            border: '1px solid #4ade80',
            padding: '10px 20px',
            borderRadius: '5px',
            marginTop: '20px',
            display: 'inline-block',
            transition: 'background-color 0.3s'
          }}
          onMouseOver={(e) => e.target.style.backgroundColor = 'rgba(74, 222, 128, 0.1)'}
          onMouseOut={(e) => e.target.style.backgroundColor = 'transparent'}
        >
          Go Back to Main App
        </a>
      </div>
    </div>
  );
};

export default VideoPage;
