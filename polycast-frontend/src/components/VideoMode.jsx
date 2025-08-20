import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import TranscriptionDisplay from './TranscriptionDisplay';
import AudioRecorder from './AudioRecorder';
import WordDefinitionPopup from './WordDefinitionPopup';
import { getLanguageForProfile, getNativeLanguageForProfile, getUITranslationsForProfile } from '../utils/profileLanguageMapping';
import apiService from '../services/apiService.js';

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
  const [fontSize, setFontSize] = useState(20);
  const [popupInfo, setPopupInfo] = useState({ visible: false, word: '', position: { x: 0, y: 0 } });
  const [wordDefinitionsPopup, setWordDefinitionsPopup] = useState({});
  
  const ui = getUITranslationsForProfile(selectedProfile);

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

  // Font size controls
  useEffect(() => {
    const handleFontSizeChange = (e) => {
      setFontSize(prev => Math.max(12, Math.min(60, prev + e.detail)));
    };
    window.addEventListener('changeFontSize', handleFontSizeChange);
    return () => window.removeEventListener('changeFontSize', handleFontSizeChange);
  }, []);

  const isHost = !!(roomSetup && roomSetup.isHost);
  
  // Word click handler
  const handleWordClick = async (word, event) => {
    try {
      const targetLanguage = getNativeLanguageForProfile(selectedProfile);
      const contextSentence = fullTranscript;
      const data = await apiService.fetchJson(apiService.getWordPopupUrl(word, contextSentence, targetLanguage));
      
      setWordDefinitionsPopup(prev => ({
        ...prev,
        [word.toLowerCase()]: data
      }));
      
      setPopupInfo({
        visible: true,
        word: word,
        position: { x: event.clientX, y: event.clientY }
      });
    } catch (err) {
      console.error('Error fetching word definitions:', err);
    }
  };

  return (
    <div style={{ position: 'relative', display: 'flex', gap: 16, padding: 16, alignItems: 'flex-start', minHeight: 'calc(100vh - 140px)' }}>
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

      {/* Right: custom transcript with font controls */}
      <div style={{ flex: '1 1 50%', display: 'flex', flexDirection: 'column' }}>
        <div style={{
          width: '100%',
          height: 'calc(100vh - 200px)',
          minHeight: '400px',
          background: '#181b2f',
          color: '#fff',
          borderTop: '6px solid #7c62ff',
          borderRadius: 10,
          boxShadow: '0 2px 12px 0 rgba(124, 98, 255, 0.14)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}>
          {/* Header with font controls */}
          <div style={{ 
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 20px 10px 20px',
            borderBottom: '1px solid #333'
          }}>
            <span style={{ 
              letterSpacing: 0.5, 
              fontWeight: 800, 
              fontSize: 20, 
              color: '#b3b3e7', 
              textTransform: 'uppercase', 
              opacity: 0.92 
            }}>
              {ui.transcriptHeader}
            </span>
            
            {/* Font size controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('changeFontSize', { detail: -2 }))}
                style={{
                  background: '#23233a', color: '#fff', border: 'none', borderRadius: 6, width: 28, height: 28,
                  fontSize: 18, fontWeight: 700, cursor: 'pointer', transition: 'background 0.2s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                –
              </button>
              <span style={{ color: '#aaa', fontSize: 14, fontWeight: 500, minWidth: 30, textAlign: 'center' }}>
                {fontSize}px
              </span>
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('changeFontSize', { detail: 2 }))}
                style={{
                  background: '#23233a', color: '#fff', border: 'none', borderRadius: 6, width: 28, height: 28,
                  fontSize: 18, fontWeight: 700, cursor: 'pointer', transition: 'background 0.2s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                +
              </button>
            </div>
          </div>
          
          {/* Transcript content */}
          <div style={{ 
            flex: 1, 
            overflowY: 'auto', 
            padding: '15px 20px',
            fontSize: `${fontSize}px`,
            lineHeight: 1.6
          }}>
            {fullTranscript ? (
              <div>
                {fullTranscript.split(/(\s+)/).map((token, index) => {
                  const word = token.trim().toLowerCase().replace(/[^\w]/g, '');
                  if (!word || token.match(/^\s+$/)) {
                    return <span key={index}>{token}</span>;
                  }
                  return (
                    <span
                      key={index}
                      onClick={(e) => handleWordClick(word, e)}
                      style={{
                        cursor: 'pointer',
                        transition: 'background-color 0.2s',
                      }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = '#333'}
                      onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                    >
                      {token}
                    </span>
                  );
                })}
                {currentPartial && (
                  <span style={{ color: '#777', fontStyle: 'italic' }}>
                    {' ' + currentPartial}
                  </span>
                )}
              </div>
            ) : (
              <div style={{ color: '#777', fontStyle: 'italic' }}>
                {isHost ? 'Click "Unmute" to start recording...' : 'Waiting for host to start...'}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Word definition popup */}
      {popupInfo.visible && (
        <WordDefinitionPopup
          word={popupInfo.word}
          definition={wordDefinitionsPopup[popupInfo.word.toLowerCase()]}
          position={popupInfo.position}
          isInDictionary={Object.values(wordDefinitions).some(e => e && e.inFlashcards && e.word === (popupInfo.word || '').toLowerCase())}
          onAddToDictionary={() => onAddWord && onAddWord(popupInfo.word)}
          onRemoveFromDictionary={() => {}}
          onClose={() => setPopupInfo({ visible: false, word: '', position: { x: 0, y: 0 } })}
          loading={false}
          nativeLanguage={getNativeLanguageForProfile(selectedProfile)}
        />
      )}
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


