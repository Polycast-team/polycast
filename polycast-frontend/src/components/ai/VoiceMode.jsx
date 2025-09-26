import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import tokenizeText from '../../utils/tokenizeText';
import { extractSentenceWithWord } from '../../utils/wordClickUtils';
import { getLanguageForProfile, getNativeLanguageForProfile } from '../../utils/profileLanguageMapping';
import aiService from '../../services/aiService';
import apiService from '../../services/apiService';
import WordDefinitionPopup from '../WordDefinitionPopup';
import './VoiceMode.css';

const ICE_SERVERS = [
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

function VoiceMode({
  selectedProfile,
  baseInstructions,
  onClose,
  onAddWord,
  selectedWords,
  wordDefinitions,
  setWordDefinitions,
}) {
  const nativeLanguage = getNativeLanguageForProfile(selectedProfile);
  const targetLanguage = getLanguageForProfile(selectedProfile);

  const [status, setStatus] = useState('connecting');
  const [error, setError] = useState('');
  const [conversation, setConversation] = useState([]); // [{id, role, content}]
  const [isClosing, setIsClosing] = useState(false);
  const [popupInfo, setPopupInfo] = useState({ visible: false, word: '', position: { x: 0, y: 0 } });

  const remoteAudioRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const pcRef = useRef(null);
  const dataChannelRef = useRef(null);
  const localStreamRef = useRef(null);
  const pendingAssistantRef = useRef({});
  const pendingUserRef = useRef({});
  const isMountedRef = useRef(true);
  const hasSentIntroRef = useRef(false);

  const instructions = useMemo(() => (
    typeof baseInstructions === 'string' && baseInstructions.trim() ? baseInstructions.trim() : undefined
  ), [baseInstructions]);

  const addOrUpdateMessage = useCallback((id, role, text = '', { replace = false } = {}) => {
    if (!id) return;
    setConversation((prev) => {
      const existingIndex = prev.findIndex((entry) => entry.id === id);
      if (existingIndex === -1) {
        return [...prev, { id, role, content: text }];
      }
      const next = [...prev];
      const existing = next[existingIndex];
      next[existingIndex] = {
        ...existing,
        content: replace ? text : `${existing.content || ''}${text}`,
      };
      return next;
    });
  }, []);

  const closePopup = useCallback(() => setPopupInfo((prev) => ({ ...prev, visible: false })), []);

  const handleWordClick = useCallback(async (word, event, surroundingText = '') => {
    if (!event) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const popupWidth = 380;
    const spaceOnRight = viewportWidth - rect.right;
    const fitsOnRight = spaceOnRight >= popupWidth + 10;
    const xPos = fitsOnRight ? rect.right + 5 : rect.left - popupWidth - 5;
    setPopupInfo({
      visible: true,
      word,
      position: { x: Math.max(5, Math.min(viewportWidth - popupWidth - 5, xPos)), y: rect.top - 5 },
    });

    try {
      const sentence = extractSentenceWithWord(surroundingText || word, word);
      const sentenceWithMarkedWord = sentence.replace(new RegExp(`\\b(${word})\\b`, 'i'), '~$1~');
      const url = apiService.getUnifiedWordDataUrl(word, sentenceWithMarkedWord, nativeLanguage, targetLanguage);
      const unifiedData = await apiService.fetchJson(url);
      setWordDefinitions((prev) => ({
        ...prev,
        [word.toLowerCase()]: {
          ...unifiedData,
          word,
          translation: unifiedData.translation || word,
          contextualExplanation: unifiedData.definition || 'Definition unavailable',
          definition: unifiedData.definition || 'Definition unavailable',
          example: unifiedData.exampleForDictionary || unifiedData.example || '',
          frequency: unifiedData.frequency || 5,
        },
      }));
    } catch (err) {
      setWordDefinitions((prev) => ({
        ...prev,
        [word.toLowerCase()]: {
          word,
          translation: word,
          contextualExplanation: 'Definition unavailable',
          definition: 'Definition unavailable',
          example: `~${word}~`,
        },
      }));
    }
  }, [nativeLanguage, setWordDefinitions, targetLanguage]);

  const renderTokens = useCallback((text, keyPrefix) => {
    const tokens = tokenizeText(text || '');
    return tokens.map((token, index) => {
      const isWord = /^[\p{L}\p{M}\d']+$/u.test(token);
      const isSelected = isWord && selectedWords.some((w) => w.toLowerCase() === token.toLowerCase());
      const tokenKey = `${keyPrefix}-${index}`;
      return (
        <span
          key={tokenKey}
          onClick={isWord ? (e) => handleWordClick(token, e, text) : undefined}
          style={{
            cursor: isWord ? 'pointer' : 'default',
            color: isWord ? '#fde68a' : undefined,
            background: isWord && isSelected ? 'rgba(253,224,71,0.18)' : undefined,
            borderRadius: isWord && isSelected ? 4 : undefined,
            padding: isWord && isSelected ? '0 2px' : undefined,
          }}
        >
          {token}
        </span>
      );
    });
  }, [handleWordClick, selectedWords]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [conversation]);

  const cleanupConnection = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);

    try {
      dataChannelRef.current?.close?.();
    } catch (_) {}
    dataChannelRef.current = null;

    try {
      pcRef.current?.close?.();
    } catch (_) {}
    pcRef.current = null;

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    hasSentIntroRef.current = false;

    if (isMountedRef.current) {
      setStatus((prev) => (prev === 'error' ? prev : 'ended'));
    }
  }, [isClosing]);

  useEffect(() => {
    isMountedRef.current = true;

    const initialise = async () => {
      try {
        setStatus('connecting');
        setError('');

        const session = await aiService.createVoiceSession({
          voice: undefined,
          instructions,
        });

        const clientSecret = session?.client_secret?.value || session?.client_secret || session?.client_secret?.token;
        const model = session?.session?.model || session?.model || 'gpt-realtime';
        if (!clientSecret) {
          throw new Error('Realtime session token unavailable.');
        }

        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        pcRef.current = pc;

        const remoteStream = new MediaStream();
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = remoteStream;
        }

        pc.ontrack = (event) => {
          const [remote] = event.streams;
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = remote;
          }
        };

        pc.onconnectionstatechange = () => {
          if (!isMountedRef.current) return;
          switch (pc.connectionState) {
            case 'connected':
              setStatus((prev) => (prev === 'connecting' ? 'ready' : prev));
              break;
            case 'failed':
            case 'disconnected':
              setError('Realtime connection dropped.');
              setStatus('error');
              cleanupConnection();
              break;
            default:
              break;
          }
        };

        pc.oniceconnectionstatechange = () => {
          if (!isMountedRef.current) return;
          if (pc.iceConnectionState === 'failed') {
            setError('ICE connection failed.');
            setStatus('error');
            cleanupConnection();
          }
        };

        let outbound;
        try {
          outbound = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (mediaErr) {
          throw new Error('Microphone permission is required for voice mode.');
        }

        localStreamRef.current = outbound;
        outbound.getTracks().forEach((track) => pc.addTrack(track, outbound));

        const setupChannel = (channel) => {
          dataChannelRef.current = channel;
          channel.onopen = () => {
            if (!isMountedRef.current) return;
            setStatus('ready');
            if (!hasSentIntroRef.current) {
              try {
                channel.send(JSON.stringify({ type: 'response.create' }));
                hasSentIntroRef.current = true;
              } catch (sendErr) {
                console.warn('[VoiceMode] failed to trigger welcome turn', sendErr);
              }
            }
          };
          channel.onmessage = (event) => {
            let payload;
            try {
              payload = JSON.parse(typeof event.data === 'string' ? event.data : new TextDecoder().decode(event.data));
            } catch (err) {
              console.debug('[VoiceMode] non-JSON realtime message', event.data);
              return;
            }
            handleRealtimeEvent(payload);
          };
        };

        pc.ondatachannel = (event) => {
          setupChannel(event.channel);
        };

        const outboundChannel = pc.createDataChannel('oai-events');
        setupChannel(outboundChannel);

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const sdpResponse = await fetch(`https://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`, {
          method: 'POST',
          body: offer.sdp,
          headers: {
            Authorization: `Bearer ${clientSecret}`,
            'Content-Type': 'application/sdp',
            'OpenAI-Beta': 'realtime=v1',
          },
        });

        if (!sdpResponse.ok) {
          let body = '';
          try { body = await sdpResponse.text(); } catch (_) {}
          throw new Error(body || `Realtime offer failed with status ${sdpResponse.status}`);
        }

        const answer = await sdpResponse.text();
        await pc.setRemoteDescription({ type: 'answer', sdp: answer });

        setStatus('ready');
      } catch (err) {
        console.error('[VoiceMode] initialisation error', err);
        if (!isMountedRef.current) return;
        setError(err?.message || 'Failed to start realtime voice session.');
        setStatus('error');
      }
    };

    const handleRealtimeEvent = (event) => {
      if (!event || typeof event !== 'object') return;

      if (process.env.NODE_ENV !== 'production') {
        console.debug('[VoiceMode] event', event.type, event);
      }

      switch (event.type) {
        case 'response.output_text.delta': {
          const id = `${event.response_id || 'assistant'}-${event.output_index ?? 0}`;
          const delta = event.delta || '';
          pendingAssistantRef.current[id] = (pendingAssistantRef.current[id] || '') + delta;
          addOrUpdateMessage(id, 'assistant', delta, { replace: false });
          setStatus((prev) => (prev === 'connecting' ? 'responding' : 'responding'));
          break;
        }
        case 'response.output_text.done': {
          const id = `${event.response_id || 'assistant'}-${event.output_index ?? 0}`;
          const final = pendingAssistantRef.current[id] || '';
          pendingAssistantRef.current[id] = '';
          addOrUpdateMessage(id, 'assistant', final, { replace: true });
          setStatus('ready');
          break;
        }
        case 'response.completed':
        case 'response.done':
          setStatus('ready');
          break;
        case 'response.error':
          setError(event?.error?.message || 'Realtime response error');
          setStatus('error');
          break;
        case 'output_audio_buffer.started':
          setStatus('responding');
          break;
        case 'output_audio_buffer.stopped':
          setStatus('ready');
          break;
        case 'conversation.item.created': {
          const item = event.item;
          if (!item) break;
          const id = item.id || `item-${Date.now()}`;
          if (item.role === 'user') {
            const contentText = extractContentText(item.content);
            if (contentText) {
              addOrUpdateMessage(id, 'user', contentText, { replace: true });
              pendingUserRef.current[id] = contentText;
            }
          }
          break;
        }
        case 'conversation.item.input_audio_transcription.delta': {
          const id = `${event.item_id || 'user'}-live`;
          const delta = event.delta || '';
          pendingUserRef.current[id] = (pendingUserRef.current[id] || '') + delta;
          addOrUpdateMessage(id, 'user', delta, { replace: false });
          setStatus('listening');
          break;
        }
        case 'conversation.item.input_audio_transcription.completed': {
          const id = `${event.item_id || 'user'}-live`;
          const transcript = event.transcript || pendingUserRef.current[id] || '';
          pendingUserRef.current[id] = '';
          addOrUpdateMessage(id, 'user', transcript, { replace: true });
          setStatus('ready');
          break;
        }
        case 'rate_limits.updated':
          break;
        default:
          break;
      }
    };

    initialise();

    return () => {
      isMountedRef.current = false;
      cleanupConnection();
    };
  }, [instructions, cleanupConnection, addOrUpdateMessage]);

  const extractContentText = (content = []) => {
    if (!Array.isArray(content)) return '';
    return content
      .map((part) => part?.text || part?.transcript || '')
      .join(' ');
  };

  const handleEndSession = useCallback(() => {
    cleanupConnection();
    onClose?.();
  }, [cleanupConnection, onClose]);

  const isWordInDictionary = useCallback((word) => (
    Object.values(wordDefinitions || {}).some(
      (entry) => entry && entry.inFlashcards && entry.word === (word || '').toLowerCase(),
    )
  ), [wordDefinitions]);

  const statusLabel = useMemo(() => {
    switch (status) {
      case 'connecting':
        return 'Connecting to realtime voice…';
      case 'ready':
        return 'Listening — start speaking!';
      case 'listening':
        return 'Listening…';
      case 'responding':
        return 'AI is responding…';
      case 'ended':
        return 'Session ended';
      case 'error':
        return 'Error';
      default:
        return '';
    }
  }, [status]);

  return (
    <div className="voice-mode-overlay">
      <div className="voice-mode-surface">
        <button
          type="button"
          className="voice-close-btn"
          onClick={handleEndSession}
          aria-label="Close voice mode"
        >
          ×
        </button>

        <div className="voice-center">
          <div className={`voice-orb voice-orb-${status}`}>
            <span className="voice-orb-ring ring-1" />
            <span className="voice-orb-ring ring-2" />
            <span className="voice-orb-ring ring-3" />
            <div className="voice-orb-core" />
          </div>

          <div className="voice-status-block">
            <h2>Polycast Voice</h2>
            <p className="voice-status-text">{statusLabel}</p>
            {error ? (
              <p className="voice-status-error">{error}</p>
            ) : (
              <p className="voice-status-hint">Speak naturally — Polycast is listening and will respond in real time.</p>
            )}
          </div>

          <button type="button" className="voice-end-btn" onClick={handleEndSession}>
            End Session
          </button>
        </div>

        <div className="voice-transcript-panel" ref={scrollContainerRef}>
          {conversation.length === 0 ? (
            <div className="voice-placeholder">Waiting for the conversation to begin…</div>
          ) : (
            conversation.map((turn) => (
              <div key={turn.id} className={`voice-transcript-turn voice-transcript-${turn.role}`}>
                <div className="voice-transcript-label">{turn.role === 'assistant' ? 'Polycast AI' : 'You'}</div>
                <div className="voice-transcript-text">{renderTokens(turn.content, turn.id)}</div>
              </div>
            ))
          )}
        </div>

        <audio ref={remoteAudioRef} autoPlay playsInline />
      </div>

      {popupInfo.visible && (
        <WordDefinitionPopup
          word={popupInfo.word}
          definition={wordDefinitions[popupInfo.word.toLowerCase()]}
          position={popupInfo.position}
          isInDictionary={isWordInDictionary(popupInfo.word)}
          onAddToDictionary={() => onAddWord && onAddWord(popupInfo.word)}
          onRemoveFromDictionary={() => {}}
          loading={false}
          nativeLanguage={nativeLanguage}
          onClose={closePopup}
        />
      )}
    </div>
  );
}

VoiceMode.propTypes = {
  selectedProfile: PropTypes.string.isRequired,
  baseInstructions: PropTypes.string,
  onClose: PropTypes.func.isRequired,
  onAddWord: PropTypes.func,
  selectedWords: PropTypes.array.isRequired,
  wordDefinitions: PropTypes.object.isRequired,
  setWordDefinitions: PropTypes.func.isRequired,
};

VoiceMode.defaultProps = {
  baseInstructions: undefined,
  onAddWord: undefined,
};

export default VoiceMode;
