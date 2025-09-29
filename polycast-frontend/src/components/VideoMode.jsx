import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import AudioRecorder from './AudioRecorder';
import ChatTranscript from './ChatTranscript';

function VideoMode({
  sendMessage,
  isRecording,
  onStartRecording,
  onStopRecording,
  roomSetup,
  // transcript props
  fullTranscript,
  currentPartial,
  transcriptBlocks,
  selectedProfile,
  studentHomeLanguage,
  // dictionary state from App
  selectedWords,
  setSelectedWords,
  wordDefinitions,
  setWordDefinitions,
  onAddWord,
  showTBA,
  registerWebrtcSignalHandler,
  unregisterWebrtcSignalHandler
}) {
  const mainVideoRef = useRef(null);
  const streamRef = useRef(null);
  const [hasRemoteTrack, setHasRemoteTrack] = useState(false);
  const [hasRemoteVideoTrack, setHasRemoteVideoTrack] = useState(false);
  const [remoteVideoPlaying, setRemoteVideoPlaying] = useState(false);
  const [remoteAttachError, setRemoteAttachError] = useState('');
  const [videoError, setVideoError] = useState('');
  const [videoReady, setVideoReady] = useState(false);
  const [isHoveringVideo, setIsHoveringVideo] = useState(false);
  const containerRef = useRef(null);
  const [splitRatio, setSplitRatio] = useState(0.5); // 50/50 split
  const [dragging, setDragging] = useState(false);
  const [dividerHover, setDividerHover] = useState(false);
  const clamp = (v, min = 0.2, max = 0.8) => Math.min(max, Math.max(min, v));

  const pcRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);

  // Participants: local camera (me) + dynamic peers (p1..p4)
  const initialParticipants = React.useMemo(() => [
    { id: 'me', name: '', color: '#3b82f6', type: 'me' },
    { id: 'p1', name: '', color: '#f472b6' }
  ], []);
  const [participantOrder, setParticipantOrder] = useState(initialParticipants.map(p => p.id));
  const [mainParticipantId, setMainParticipantId] = useState('me');
  const [thumbScrollIndex, setThumbScrollIndex] = useState(0); // 0 or 1 with 4 thumbs showing 3 at a time
  const thumbVideoRef = useRef(null); // second <video> when local camera is in thumbnails
  const remoteThumbVideoRef = useRef(null); // <video> element for remote participant thumbnail

  const getParticipantById = (id) => initialParticipants.find(p => p.id === id);
  const availableIds = React.useMemo(() => ['me', ...(hasRemoteVideoTrack ? ['p1'] : [])], [hasRemoteVideoTrack]);
  const renderOrder = participantOrder.filter(id => availableIds.includes(id));
  const effectiveMainId = renderOrder.includes(mainParticipantId) ? mainParticipantId : 'me';
  const mainParticipant = getParticipantById(effectiveMainId);
  const thumbnails = renderOrder.filter(id => id !== effectiveMainId).map(getParticipantById);
  const visibleThumbs = 3; // show 3 fully, one cut off
  const maxScrollIndex = Math.max(0, thumbnails.length - visibleThumbs);

  useEffect(() => {
    async function initCamera() {
      try {
        // Request user-facing camera and mirror it
        streamRef.current = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 } },
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        });
        if (mainVideoRef.current) {
          const el = mainVideoRef.current;
          el.srcObject = streamRef.current;
          const onPlaying = () => setVideoReady(true);
          el.addEventListener('playing', onPlaying, { once: true });
          try {
            const p = el.play();
            if (p && typeof p.then === 'function') {
              await p.catch(() => {});
            }
          } finally {
            setTimeout(() => setVideoReady(true), 150);
          }
        }
        setVideoError('');
      } catch (err) {
        console.error('Camera error:', err);
        setVideoError('Camera access denied or unavailable');
        setVideoReady(true);
      }
    }
    initCamera();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

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

  // Bind remote stream to remote thumbnail when available
  useEffect(() => {
    const el = remoteThumbVideoRef.current;
    const s = remoteStreamRef.current;
    if (!el || !s) return;
    try {
      if (el.srcObject !== s) {
        el.srcObject = s;
        const p = el.play();
        if (p && typeof p.then === 'function') p.catch(() => {});
      }
    } catch (_) {}
  }, [hasRemoteVideoTrack, mainParticipantId, thumbnails.length]);

  // Always bind the appropriate stream to the main video element based on selection
  useEffect(() => {
    const el = mainVideoRef.current;
    if (!el) return;
    const desiredStream = (effectiveMainId === 'me') ? streamRef.current : remoteStreamRef.current;
    if (!desiredStream) return;
    try {
      if (el.srcObject !== desiredStream) {
        el.srcObject = desiredStream;
        const p = el.play();
        if (p && typeof p.then === 'function') p.catch(() => {});
      }
      // If remote is selected but we somehow don't have a video track, show a clear error
      if (effectiveMainId !== 'me') {
        const hasVideo = !!(desiredStream.getVideoTracks && desiredStream.getVideoTracks().length > 0);
        if (!hasVideo) setRemoteAttachError('No remote video track present in stream.');
      }
    } catch (_) {}
  }, [effectiveMainId, hasRemoteVideoTrack]);

  // Track play/error for remote main video
  useEffect(() => {
    const el = mainVideoRef.current;
    if (!el) return;
    const onPlaying = () => { setRemoteVideoPlaying(true); setRemoteAttachError(''); };
    const onError = (e) => { setRemoteAttachError(e?.message || 'Video element error'); };
    el.addEventListener('playing', onPlaying);
    el.addEventListener('error', onError);
    return () => { el.removeEventListener('playing', onPlaying); el.removeEventListener('error', onError); };
  }, [effectiveMainId]);

  // Give a small window to surface a connection error if no frames arrive
  useEffect(() => {
    if (effectiveMainId !== 'p1' || !hasRemoteTrack) return;
    setRemoteVideoPlaying(false);
    setRemoteAttachError('');
    const id = setTimeout(() => {
      if (!remoteVideoPlaying) setRemoteAttachError('No remote video received yet. Check connection or permissions.');
    }, 4000);
    return () => clearTimeout(id);
  }, [effectiveMainId, hasRemoteTrack]);

  // Ensure remote audio plays regardless of which video is displayed
  useEffect(() => {
    const el = remoteAudioRef.current;
    const s = remoteStreamRef.current;
    if (!el || !s) return;
    try {
      if (el.srcObject !== s) {
        el.srcObject = s;
        const p = el.play();
        if (p && typeof p.then === 'function') p.catch(() => {});
      }
    } catch (_) {}
  }, [hasRemoteTrack, hasRemoteVideoTrack]);

  useEffect(() => {
    const onMove = (e) => {
      if (!dragging || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const ratio = (clientX - rect.left) / rect.width;
      setSplitRatio(clamp(ratio));
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

  // No transcript font size handling here; ChatTranscript manages its own font size

  const isHost = !!(roomSetup && roomSetup.isHost);
  const allowMic = true; // allow mic for both host and students
  const inRoom = !!(roomSetup && roomSetup.roomCode);

  // WebRTC setup
  useEffect(() => {
    if (!inRoom) return;
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: ['stun:stun.l.google.com:19302'] },
        // Optional TURN fallback – replace with your own TURN if available
        ...(import.meta.env.VITE_TURN_URL && import.meta.env.VITE_TURN_USERNAME && import.meta.env.VITE_TURN_CREDENTIAL
          ? [{
              urls: import.meta.env.VITE_TURN_URL.split(',').map(u => u.trim()),
              username: import.meta.env.VITE_TURN_USERNAME,
              credential: import.meta.env.VITE_TURN_CREDENTIAL
            }]
          : [])
      ]
    });
    pcRef.current = pc;
    remoteStreamRef.current = new MediaStream();
    console.log('[WebRTC] Created RTCPeerConnection');

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, streamRef.current);
        console.log('[WebRTC] Added local track:', track.kind);
      });
    }

    pc.ontrack = (event) => {
      console.log('[WebRTC] ontrack fired. Streams:', event.streams?.length, 'tracks:', event.track?.kind);
      let stream = (event.streams && event.streams[0]) ? event.streams[0] : null;
      if (!stream) {
        // Some browsers (notably iOS Safari) do not populate event.streams; assemble manually
        if (!remoteStreamRef.current) remoteStreamRef.current = new MediaStream();
        remoteStreamRef.current.addTrack(event.track);
        stream = remoteStreamRef.current;
      } else {
        remoteStreamRef.current = stream;
      }
      if (event.track) {
        if (event.track.kind === 'video') {
          setHasRemoteVideoTrack(true);
          try { event.track.enabled = true; } catch (_) {}
        }
        if (event.track.kind === 'audio') {
          try { event.track.enabled = true; } catch (_) {}
        }
        setHasRemoteTrack(true);
      }
      // If remote is already/main selected, ensure it is attached immediately
      if (mainVideoRef.current && stream && (effectiveMainId !== 'me')) {
        try {
          if (mainVideoRef.current.srcObject !== stream) {
            mainVideoRef.current.srcObject = stream;
            const p = mainVideoRef.current.play();
            if (p && typeof p.then === 'function') p.catch(() => {});
          }
        } catch (_) {}
      }
      // Promote remote participant to main view automatically
      if (event.track?.kind === 'video') setMainParticipantId('p1');
    };

    pc.onicecandidate = (e) => {
      if (e.candidate && typeof sendMessage === 'function') {
        console.log('[WebRTC] ICE candidate generated, sending');
        sendMessage(JSON.stringify({ type: 'webrtc_ice', candidate: e.candidate }));
      }
    };
    pc.onconnectionstatechange = () => {
      console.log('[WebRTC] connectionState:', pc.connectionState);
    };
    pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] iceConnectionState:', pc.iceConnectionState);
    };

    const onSignal = async (data) => {
      if (!data || !pcRef.current) return;
      try {
        if (data.type === 'webrtc_offer' && isHost) {
          console.log('[WebRTC] Received offer (host). Setting remote description and creating answer');
          // Some browsers send/expect RTCSessionDescriptionInit; handle both safely
          const offerDesc = data.sdp?.type ? data.sdp : { type: 'offer', sdp: data.sdp?.sdp || data.sdp };
          await pcRef.current.setRemoteDescription(offerDesc);
          const answer = await pcRef.current.createAnswer();
          await pcRef.current.setLocalDescription(answer);
          console.log('[WebRTC] Sending answer');
          sendMessage(JSON.stringify({ type: 'webrtc_answer', sdp: pcRef.current.localDescription }));
        } else if (data.type === 'webrtc_answer' && !isHost) {
          console.log('[WebRTC] Received answer (student). Setting remote description');
          const answerDesc = data.sdp?.type ? data.sdp : { type: 'answer', sdp: data.sdp?.sdp || data.sdp };
          await pcRef.current.setRemoteDescription(answerDesc);
        } else if (data.type === 'webrtc_ice' && data.candidate) {
          try {
            console.log('[WebRTC] Adding remote ICE candidate');
            await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
          } catch {}
        }
      } catch (err) {
        console.warn('Signaling error:', err);
      }
    };
    if (registerWebrtcSignalHandler) registerWebrtcSignalHandler(onSignal);

    const startOffer = async () => {
      if (!isHost) {
        try {
          console.log('[WebRTC] Creating offer (student)');
          const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
          await pc.setLocalDescription(offer);
          console.log('[WebRTC] Sending offer');
          sendMessage(JSON.stringify({ type: 'webrtc_offer', sdp: pc.localDescription }));
        } catch (err) {
          console.warn('Failed to create/send offer:', err);
        }
      }
    };
    startOffer();

    return () => {
      if (unregisterWebrtcSignalHandler) unregisterWebrtcSignalHandler();
      try { pcRef.current && pcRef.current.close(); } catch {}
      pcRef.current = null;
    };
  }, [inRoom, isHost, sendMessage]);

  // Auto-unmute by default in Video mode
  useEffect(() => {
    if (allowMic && !isRecording && typeof onStartRecording === 'function') {
      try { onStartRecording(); } catch (_) {}
    }
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Word definition popup is handled within ChatTranscript

  const [isNarrow, setIsNarrow] = useState(() => typeof window !== 'undefined' && window.innerWidth < 900);
  useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth < 900);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const leftPercent = Math.round(splitRatio * 100);
  const rightPercent = 100 - leftPercent;

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
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', padding: '16px', minHeight: '100vh', width: '100%', overflow: 'hidden', boxSizing: 'border-box' }}>
      {!videoReady && !videoError && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#0f1020', color: '#d1d5db', padding: 24, borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 18, height: 18, borderRadius: '50%', border: '3px solid #6366f1', borderTopColor: 'transparent', animation: 'pc_spin 0.9s linear infinite' }} />
            <div>Starting camera…</div>
          </div>
          <style>{`@keyframes pc_spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
        </div>
      )}
      
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
        {/* LEFT: video */}
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
            overflow: 'hidden',
            justifyContent: 'flex-start'
          }}
        >
          <div
            style={{ position: 'relative', background: 'transparent', borderRadius: 0, overflow: 'visible', display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}
          >
            {/* 16:10 aspect wrapper - no absolute box, scales with width */}
            <div style={{ width: '100%', padding: 12, boxSizing: 'border-box', display: 'flex', justifyContent: 'center', position: 'relative' }}>
              <div style={{ width: '100%', aspectRatio: '16 / 10', background: '#111827', borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
                {mainParticipant && mainParticipant.id === 'me' ? (
                  <video
                    ref={mainVideoRef}
                    playsInline
                    muted
                    autoPlay
                    style={{ width: '100%', height: '100%', objectFit: 'contain', transform: 'scaleX(-1)', display: 'block', background: '#000' }}
                  />
                ) : hasRemoteVideoTrack ? (
                  <video
                    ref={mainVideoRef}
                    playsInline
                    autoPlay
                    muted
                    style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', background: '#000' }}
                  />
                ) : (
                  // No placeholder: show an explicit connection message instead
                  <div style={{ width: '100%', height: '100%', background: '#0f1020', color: '#fbbf24', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                    {remoteAttachError || 'Waiting for remote video…'}
                  </div>
                )}
                
                {/* Hover toolbar - always visible when mic allowed */}
                {allowMic && (
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
                      opacity: 1,
                      transform: 'translateY(0)',
                      pointerEvents: 'auto'
                    }}
                  >
                <button
                  onClick={() => {
                    try {
                      const tracks = (streamRef.current && streamRef.current.getAudioTracks) ? streamRef.current.getAudioTracks() : [];
                      tracks.forEach(t => { t.enabled = !isRecording; });
                    } catch (_) {}
                    if (isRecording) {
                      (onStopRecording || (() => {}))();
                    } else {
                      (onStartRecording || (() => {}))();
                    }
                  }}
                  aria-label={isRecording ? 'Mute microphone' : 'Unmute microphone'}
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
                    // Mic (unmuted)
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3z" />
                      <path d="M19 11a7 7 0 0 1-14 0" />
                      <path d="M12 19v2" />
                    </svg>
                  ) : (
                    // Mic off (muted)
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3z" />
                      <path d="M19 11a7 7 0 0 1-14 0" />
                      <path d="M12 19v2" />
                      <line x1="4" y1="4" x2="20" y2="20" />
                    </svg>
                  )}
                </button>
              </div>
            )}
              </div>
            </div>

            {videoError && (
              <div style={{ position: 'absolute', inset: 0, color: '#f87171', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>
                {videoError}
              </div>
            )}
          </div>

          {/* Hidden audio pipeline - allow when hosting or not in room */}
          {allowMic && (
            <div style={{ display: 'none' }}>
              <AudioRecorder sendMessage={sendMessage} isRecording={isRecording} selectedProfile={selectedProfile} />
            </div>
          )}

          {hasRemoteTrack && (
            <audio ref={remoteAudioRef} autoPlay playsInline />
          )}

          {/* Bottom thumbnails strip */}
          <div
            style={{
              position: 'relative',
              marginTop: 0,
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
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  height: '100%',
                  display: 'flex',
                  gap: 12,
                  paddingRight: 80,
                  transform: `translateX(${-thumbScrollIndex * (212 + 12)}px)`,
                  transition: 'transform 200ms ease'
                }}
              >
                {thumbnails.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => {
                      setParticipantOrder(prev => {
                        const a = [...prev];
                        const i = a.indexOf(p.id);
                        const j = a.indexOf(mainParticipantId);
                        if (i !== -1 && j !== -1) { const tmp = a[i]; a[i] = a[j]; a[j] = tmp; }
                        return a;
                      });
                      setMainParticipantId(p.id);
                    }}
                    title={`Promote`}
                    style={{
                      height: '100%',
                      aspectRatio: '16 / 10',
                      width: 'auto',
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
                        style={{ width: '100%', height: '100%', objectFit: 'contain', transform: 'scaleX(-1)', background: '#000' }}
                      />
                    ) : p.id === 'p1' && hasRemoteVideoTrack ? (
                      <video
                        ref={remoteThumbVideoRef}
                        playsInline
                        muted
                        style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
                      />
                    ) : (
                      <div style={{ width: '100%', height: '100%', background: '#0f1020', color: '#b3b3e7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
                        {p.id === 'p1' ? (remoteAttachError || 'Waiting…') : ''}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
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

        {/* Divider */}
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
              transform: 'translateX(-4px)'
            }}
            aria-label="Resize panels"
            role="separator"
            aria-orientation="vertical"
            title="Drag to resize"
          >
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
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <ChatTranscript
              fullTranscript={fullTranscript}
              currentPartial={currentPartial}
              transcriptBlocks={transcriptBlocks}
              selectedProfile={selectedProfile}
              roomSetup={roomSetup}
              selectedWords={selectedWords}
              setSelectedWords={setSelectedWords}
              wordDefinitions={wordDefinitions}
              setWordDefinitions={setWordDefinitions}
              onAddWord={onAddWord}
            />
          </div>
        </div>
      </div>
      
      {/* Word definition popup is now managed inside ChatTranscript */}
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
  selectedProfile: PropTypes.string.isRequired,
  studentHomeLanguage: PropTypes.string
};

export default VideoMode;


