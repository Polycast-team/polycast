import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import TranscriptionDisplay from './TranscriptionDisplay';
import AudioRecorder from './AudioRecorder';

function VideoMode({
  sendMessage,
  isRecording,
  onStartRecording,
  onStopRecording,
  roomSetup,
  // transcript props
  fullTranscript,
  currentPartial,
  translations,
  targetLanguages,
  showLiveTranscript,
  setShowLiveTranscript,
  showTranslation,
  setShowTranslation,
  selectedProfile,
  studentHomeLanguage,
  // dictionary state from App
  selectedWords,
  setSelectedWords,
  wordDefinitions,
  setWordDefinitions,
  onAddWord,
  showTBA
}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [videoError, setVideoError] = useState('');
  const [videoReady, setVideoReady] = useState(false);

  useEffect(() => {
    async function initCamera() {
      try {
        // Request user-facing camera and mirror it
        streamRef.current = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false
        });
        if (videoRef.current) {
          const el = videoRef.current;
          el.srcObject = streamRef.current;
          // Mark ready as soon as video starts playing
          const onPlaying = () => setVideoReady(true);
          el.addEventListener('playing', onPlaying, { once: true });
          try {
            const p = el.play();
            if (p && typeof p.then === 'function') {
              await p.catch(() => {});
            }
          } finally {
            // Fallback: ensure we don't keep loader forever
            setTimeout(() => setVideoReady(true), 150);
          }
        }
        setVideoError('');
      } catch (err) {
        console.error('Camera error:', err);
        setVideoError('Camera access denied or unavailable');
        setVideoReady(true); // dismiss loader to show error overlay
      }
    }
    initCamera();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const isHost = !!(roomSetup && roomSetup.isHost);

  return (
    <div style={{ position: 'relative', display: 'flex', gap: 16, padding: 16, alignItems: 'flex-start' }}>
      {/* Full-screen loading overlay while camera initializes */}
      {!videoReady && !videoError && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#0f1020', color: '#d1d5db', padding: 24, borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 18, height: 18, borderRadius: '50%', border: '3px solid #6366f1', borderTopColor: 'transparent', animation: 'pc_spin 0.9s linear infinite' }} />
            <div>Starting camera…</div>
          </div>
          <style>{`@keyframes pc_spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
        </div>
      )}
      {/* Left: mirrored webcam */}
      <div style={{ flex: '1 1 50%', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ position: 'relative', background: '#0f1020', borderRadius: 12, overflow: 'hidden' }}>
          <video
            ref={videoRef}
            playsInline
            muted
            style={{ width: '100%', height: 'auto', transform: 'scaleX(-1)', display: 'block' }}
          />
          {videoError && (
            <div style={{ position: 'absolute', inset: 0, color: '#f87171', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>
              {videoError}
            </div>
          )}
        </div>

        {/* Mute/Unmute control available to all users */}
        <div style={{ display: 'flex', gap: 8 }}>
          {isRecording ? (
            <button
              onClick={onStopRecording || (() => {})}
              style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 12px', cursor: 'pointer' }}
            >
              Mute
            </button>
          ) : (
            <button
              onClick={onStartRecording || (() => {})}
              style={{ background: '#4CAF50', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 12px', cursor: 'pointer' }}
            >
              Unmute
            </button>
          )}
        </div>

        {/* Hidden audio pipeline to drive transcript */}
        <div style={{ display: 'none' }}>
          <AudioRecorder sendMessage={sendMessage} isRecording={isRecording} />
        </div>
      </div>

      {/* Right: transcript (reused) */}
      <div style={{ flex: '1 1 50%' }}>
        <TranscriptionDisplay
          fullTranscript={fullTranscript}
          currentPartial={currentPartial}
          translations={translations}
          targetLanguages={targetLanguages}
          showLiveTranscript={true}
          showTranslation={false}
          defaultFontSize={20}
          compactLines
          isStudentMode={roomSetup && !roomSetup.isHost}
          studentHomeLanguage={studentHomeLanguage}
          selectedWords={selectedWords}
          setSelectedWords={setSelectedWords}
          wordDefinitions={wordDefinitions}
          setWordDefinitions={setWordDefinitions}
          selectedProfile={selectedProfile}
          showTBA={showTBA}
          onAddWord={onAddWord}
        />
      </div>
    </div>
  );
}

VideoMode.propTypes = {
  sendMessage: PropTypes.func.isRequired,
  isRecording: PropTypes.bool.isRequired,
  onStartRecording: PropTypes.func,
  onStopRecording: PropTypes.func,
  roomSetup: PropTypes.object,
  fullTranscript: PropTypes.string,
  currentPartial: PropTypes.string,
  translations: PropTypes.object,
  targetLanguages: PropTypes.array,
  showLiveTranscript: PropTypes.bool,
  setShowLiveTranscript: PropTypes.func,
  showTranslation: PropTypes.bool,
  setShowTranslation: PropTypes.func,
  selectedProfile: PropTypes.string.isRequired,
  studentHomeLanguage: PropTypes.string
};

export default VideoMode;


