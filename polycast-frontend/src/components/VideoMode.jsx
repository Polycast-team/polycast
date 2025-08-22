import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import AudioRecorder from './AudioRecorder';
import TranscriptionDisplay from './TranscriptionDisplay';
import WordDefinitionPopup from './WordDefinitionPopup';
import { getLanguageForProfile, getNativeLanguageForProfile, getUITranslationsForProfile } from '../utils/profileLanguageMapping';
import apiService from '../services/apiService.js';
import { extractSentenceWithWord } from '../utils/wordClickUtils';

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
  const [isHoveringVideo, setIsHoveringVideo] = useState(false);
  const containerRef = useRef(null);
  const [splitRatio, setSplitRatio] = useState(0.5); // 50/50 split
  const [dragging, setDragging] = useState(false);
  const [dividerHover, setDividerHover] = useState(false);
  const clamp = (v, min = 0.2, max = 0.8) => Math.min(max, Math.max(min, v));
  
  const ui = getUITranslationsForProfile(selectedProfile);

  // --- Placeholder multi-participant layout state (kept local to this file) ---
  // We model a simple list of participants: local camera ("me") + 4 placeholders.
  // The strip shows 3 thumbnails and a 4th partially cut off; clicking the red arrow
  // scrolls to reveal the hidden one. Clicking a thumbnail swaps it with the main.
  const initialParticipants = React.useMemo(() => [
    { id: 'me', name: 'You', color: '#3b82f6', type: 'me' },
    { id: 'p1', name: 'Person 1', color: '#f472b6' },
    { id: 'p2', name: 'Person 2', color: '#22c55e' },
    { id: 'p3', name: 'Person 3', color: '#f59e0b' },
    { id: 'p4', name: 'Person 4', color: '#a78bfa' }
  ], []);
  const [participantOrder, setParticipantOrder] = useState(initialParticipants.map(p => p.id));
  const [mainParticipantId, setMainParticipantId] = useState('me');
  const [thumbScrollIndex, setThumbScrollIndex] = useState(0); // 0 or 1 with 4 thumbs showing 3 at a time
  const thumbVideoRef = useRef(null); // second <video> when local camera is in thumbnails

  const getParticipantById = (id) => initialParticipants.find(p => p.id === id);
  const mainParticipant = getParticipantById(mainParticipantId);
  const thumbnails = participantOrder.filter(id => id !== mainParticipantId).map(getParticipantById);
  const visibleThumbs = 3; // show 3 fully, one cut off
  const maxScrollIndex = Math.max(0, thumbnails.length - visibleThumbs);

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

  // Keep the thumbnail "me" video wired if/when local feed is not main
  useEffect(() => {
    const isMeInThumbs = mainParticipantId !== 'me' && thumbVideoRef.current && streamRef.current;
    if (isMeInThumbs) {
      try {
        thumbVideoRef.current.srcObject = streamRef.current;
        const p = thumbVideoRef.current.play();
        if (p && typeof p.then === 'function') p.catch(() => {});
      } catch (_) {}
    }
  }, [mainParticipantId, thumbnails.length]);

  // Reconnect main video when switching back to "me"
  useEffect(() => {
    const isMeMain = mainParticipantId === 'me' && videoRef.current && streamRef.current;
    if (isMeMain) {
      try {
        videoRef.current.srcObject = streamRef.current;
        const p = videoRef.current.play();
        if (p && typeof p.then === 'function') p.catch(() => {});
      } catch (_) {}
    }
  }, [mainParticipantId]);

  // Divider drag handlers
  useEffect(() => {
    const onMove = (e) => {
      if (!dragging || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const ratio = (clientX - rect.left) / rect.width;
      setSplitRatio(clamp(ratio));
      // Prevent touch scrolling while dragging
      if (e.cancelable) e.preventDefault();
    };
    const onUp = () => setDragging(false);
    const onLeave = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('mouseleave', onLeave);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('mouseleave', onLeave);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [dragging]);

  // Font size controls
  useEffect(() => {
    const handleFontSizeChange = (e) => {
      setFontSize(prev => Math.max(12, Math.min(60, prev + e.detail)));
    };
    window.addEventListener('changeFontSize', handleFontSizeChange);
    return () => window.removeEventListener('changeFontSize', handleFontSizeChange);
  }, []);

  const isHost = !!(roomSetup && roomSetup.isHost);
  
  // Word click handler using UNIFIED API
  const handleWordClick = async (word, event) => {
    try {
      const nativeLanguage = getNativeLanguageForProfile(selectedProfile);
      const targetLanguage = getLanguageForProfile(selectedProfile);
      
      // Extract sentence and mark the clicked word
      const sentence = extractSentenceWithWord(fullTranscript, word);
      // For video mode clicks, mark first occurrence (simpler than tracking instances)
      const sentenceWithMarkedWord = sentence.replace(
        new RegExp(`\\b(${word})\\b`, 'i'),
        '~$1~'
      );
      
      console.log(`[VideoMode] Using unified API for word: "${word}"`);
      console.log(`[VideoMode] Sentence with marked word:`, sentenceWithMarkedWord);
      
      const url = apiService.getUnifiedWordDataUrl(
        word,
        sentenceWithMarkedWord,
        nativeLanguage,
        targetLanguage
      );
      
      const unifiedData = await apiService.fetchJson(url);
      
      // Store unified data for popup display
      setWordDefinitions(prev => ({
        ...prev,
        [word.toLowerCase()]: {
          ...unifiedData,
          // Ensure compatibility with popup
          word: word,
          translation: unifiedData.translation || word,
          contextualExplanation: unifiedData.definition || 'Definition unavailable',
          definition: unifiedData.definition || 'Definition unavailable',
          example: unifiedData.exampleForDictionary || unifiedData.example || '',
          frequency: unifiedData.frequency || 5
        }
      }));
      
      setPopupInfo({
        visible: true,
        word: word,
        position: { x: event.clientX, y: event.clientY }
      });
    } catch (err) {
      console.error('Error fetching word definitions with unified API:', err);
      // Fallback data
      setWordDefinitions(prev => ({
        ...prev,
        [word.toLowerCase()]: {
          word: word,
          translation: word,
          contextualExplanation: 'Definition unavailable',
          definition: 'Definition unavailable',
          example: `~${word}~`
        }
      }));
      setPopupInfo({
        visible: true,
        word: word,
        position: { x: event.clientX, y: event.clientY }
      });
    }
  };

  const [isNarrow, setIsNarrow] = useState(() => typeof window !== 'undefined' && window.innerWidth < 900);
  useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth < 900);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const leftPercent = Math.round(splitRatio * 100);
  const rightPercent = 100 - leftPercent;

  // While dragging, show global ew-resize cursor and disable text selection
  useEffect(() => {
    if (!dragging) return;
    const prevCursor = document.body.style.cursor;
    const prevSelect = document.body.style.userSelect;
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
    return () => {
      document.body.style.cursor = prevCursor || '';
      document.body.style.userSelect = prevSelect || '';
    };
  }, [dragging]);

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', padding: '16px', minHeight: '100vh', overflow: 'hidden', boxSizing: 'border-box' }}>
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
      
      {/* Split container fits entirely above the bottom toolbar */}
      <div
        ref={containerRef}
        style={{
          display: 'flex',
          flexDirection: isNarrow ? 'column' : 'row',
          gap: isNarrow ? 12 : 0,
          alignItems: 'stretch',
          width: '100%',
          height: 'calc(100vh - (var(--bottom-toolbar-h, 72px) + 10px + env(safe-area-inset-bottom)))',
          overflow: 'hidden',
          boxSizing: 'border-box',
          position: 'relative'
        }}
      >
        {/* LEFT: video + placeholder participants strip */}
        <div
          style={{
            width: isNarrow ? '100%' : `${leftPercent}%`,
            flexGrow: 0,
            flexShrink: 0,
            minWidth: isNarrow ? '100%' : '20%',
            maxWidth: isNarrow ? '100%' : '80%',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            overflow: 'hidden'
          }}
        >
          <div
            style={{ position: 'relative', background: '#0f1020', borderRadius: 12, overflow: 'hidden', flex: 1 }}
            onMouseEnter={() => setIsHoveringVideo(true)}
            onMouseLeave={() => setIsHoveringVideo(false)}
          >
            {mainParticipant && mainParticipant.id === 'me' ? (
              <video
                ref={videoRef}
                playsInline
                muted
                style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', display: 'block' }}
              />
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: mainParticipant ? mainParticipant.color : '#374151'
                }}
              >
                <span style={{ fontSize: 36, fontWeight: 900, color: '#111827', textShadow: '0 2px 10px rgba(0,0,0,0.25)' }}>
                  {mainParticipant ? mainParticipant.name : ''}
                </span>
              </div>
            )}
            {videoError && (
              <div style={{ position: 'absolute', inset: 0, color: '#f87171', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>
                {videoError}
              </div>
            )}

            {/* Hover toolbar (Zoom-like) */}
            <div
              style={{
                position: 'absolute',
                left: 12,
                right: 12,
                bottom: 12,
                background: 'rgba(0, 0, 0, 0.45)',
                borderRadius: 10,
                padding: '8px 12px',
                display: 'flex',
                gap: 10,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: isHoveringVideo ? 1 : 0,
                transform: `translateY(${isHoveringVideo ? 0 : 8}px)`,
                transition: 'opacity 160ms ease, transform 160ms ease',
                pointerEvents: isHoveringVideo ? 'auto' : 'none'
              }}
            >
              <button
                onClick={isRecording ? (onStopRecording || (() => {})) : (onStartRecording || (() => {}))}
                title={isRecording ? 'Mute' : 'Unmute'}
                style={{
                  background: isRecording ? '#ef4444' : '#10b981',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '8px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer'
                }}
              >
                {isRecording ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 1a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                    <path d="M19 10a7 7 0 0 1-14 0"/>
                    <line x1="12" y1="17" x2="12" y2="23"/>
                    <line x1="8" y1="23" x2="16" y2="23"/>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 1a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                    <path d="M19 10a7 7 0 0 1-14 0"/>
                    <line x1="12" y1="17" x2="12" y2="23"/>
                    <line x1="8" y1="23" x2="16" y2="23"/>
                    <line x1="4" y1="4" x2="20" y2="20"/>
                  </svg>
                )}
                <span style={{ fontWeight: 600 }}>{isRecording ? 'Mute' : 'Unmute'}</span>
              </button>
            </div>
          </div>

          {/* Hidden audio pipeline to drive transcript */}
          <div style={{ display: 'none' }}>
            <AudioRecorder sendMessage={sendMessage} isRecording={isRecording} />
          </div>

          {/* Bottom thumbnails strip (carousel) */}
          <div
            style={{
              position: 'relative',
              marginTop: 10,
              height: 120,
              borderRadius: 10,
              background: 'transparent',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                overflow: 'hidden'
              }}
            >
              {/* Inner row with transform to simulate scrolling */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  height: '100%',
                  display: 'flex',
                  gap: 12,
                  paddingRight: 80, // leave space for arrow button
                  transform: `translateX(${-thumbScrollIndex * (212 + 12)}px)`,
                  transition: 'transform 200ms ease'
                }}
              >
                {thumbnails.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => {
                      // Swap clicked participant with main: update order and main id
                      setParticipantOrder(prev => {
                        const a = [...prev];
                        const i = a.indexOf(p.id);
                        const j = a.indexOf(mainParticipantId);
                        if (i !== -1 && j !== -1) {
                          const tmp = a[i];
                          a[i] = a[j];
                          a[j] = tmp;
                        }
                        return a;
                      });
                      setMainParticipantId(p.id);
                    }}
                    title={`Promote ${p.name}`}
                    style={{
                      width: 212,
                      height: '100%',
                      borderRadius: 10,
                      overflow: 'hidden',
                      cursor: 'pointer',
                      boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
                      border: '1px solid rgba(255,255,255,0.08)'
                    }}
                  >
                    {p.id === 'me' ? (
                      <video
                        ref={thumbVideoRef}
                        playsInline
                        muted
                        style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
                      />
                    ) : (
                      <div style={{ width: '100%', height: '100%', background: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: 22, fontWeight: 900, color: '#111827' }}>{p.name}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            {/* Right arrow button */}
            <button
              onClick={() => setThumbScrollIndex((i) => (i >= maxScrollIndex ? 0 : i + 1))}
              style={{
                position: 'absolute',
                right: 0,
                top: 0,
                bottom: 0,
                width: 68,
                border: 'none',
                background: '#ef4444',
                color: '#fff',
                fontWeight: 900,
                fontSize: 26,
                borderRadius: 10,
                cursor: maxScrollIndex === 0 ? 'default' : 'pointer',
                opacity: thumbnails.length > visibleThumbs ? 1 : 0.7
              }}
              title={maxScrollIndex > 0 ? 'Show next' : 'No more'}
            >
              →
            </button>
          </div>
        </div>

        {/* Invisible divider overlay positioned at the border */}
        {!isNarrow && (
          <div
            onMouseDown={() => setDragging(true)}
            onTouchStart={() => setDragging(true)}
            onMouseEnter={() => setDividerHover(true)}
            onMouseLeave={() => setDividerHover(false)}
            style={{
              position: 'absolute',
              left: `${leftPercent}%`,
              top: 0,
              width: 8,
              height: '100%',
              cursor: 'ew-resize',
              background: 'transparent',
              userSelect: 'none',
              zIndex: 20,
              transform: 'translateX(-4px)' // Center the 8px wide area on the border
            }}
            aria-label="Resize panels"
            role="separator"
            aria-orientation="vertical"
            title="Drag to resize"
          >
            {/* Optional: subtle visual indicator on hover */}
            {(dividerHover || dragging) && (
              <div style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: 2,
                height: '60%',
                background: '#8b7bff',
                borderRadius: 1,
                boxShadow: '0 0 8px #7c62ff',
                transition: 'opacity 0.2s ease'
              }} />
            )}
          </div>
        )}

        {/* Drag overlay to guarantee pointer capture and cursor across the page */}
        {dragging && (
          <div
            style={{ position: 'fixed', inset: 0, cursor: 'ew-resize', zIndex: 9999, background: 'transparent' }}
          />
        )}

        {/* RIGHT: transcript */}
        <div
          onWheel={(e) => e.stopPropagation()}
          style={{
            width: isNarrow ? '100%' : `${rightPercent}%`,
            flexGrow: 0,
            flexShrink: 0,
            minWidth: isNarrow ? '100%' : '20%',
            maxWidth: isNarrow ? '100%' : '80%',
            boxSizing: 'border-box',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            background: '#181b2f',
            borderRadius: 10,
            boxShadow: '0 2px 12px 0 rgba(124,98,255,0.14)'
          }}
        >
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            <TranscriptionDisplay
              showTBA={showTBA}
              fullTranscript={fullTranscript}
              currentPartial={currentPartial}
              targetLanguages={targetLanguages}
              translations={translations}
              showLiveTranscript={true}
              showTranslation={false}
              selectedWords={selectedWords}
              setSelectedWords={setSelectedWords}
              wordDefinitions={wordDefinitions}
              setWordDefinitions={setWordDefinitions}
              isStudentMode={roomSetup && !roomSetup.isHost}
              studentHomeLanguage={studentHomeLanguage}
              selectedProfile={selectedProfile}
              onAddWord={onAddWord}
            />
          </div>
        </div>
      </div>
      
      {/* Word definition popup */}
      {popupInfo.visible && (
        <WordDefinitionPopup
          word={popupInfo.word}
          definition={wordDefinitions[popupInfo.word.toLowerCase()]}
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
  selectedProfile: PropTypes.string.isRequired,
  studentHomeLanguage: PropTypes.string
};

export default VideoMode;


