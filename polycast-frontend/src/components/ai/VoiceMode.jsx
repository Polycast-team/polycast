import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import tokenizeText from '../../utils/tokenizeText';
import { extractSentenceWithWord } from '../../utils/wordClickUtils';
import {
  getLanguageForProfile,
  getNativeLanguageForProfile,
  getVoiceTranslationsForProfile,
  getUITranslationsForProfile,
} from '../../utils/profileLanguageMapping.js';
import aiService from '../../services/aiService';
import apiService from '../../services/apiService';
import WordDefinitionPopup from '../WordDefinitionPopup';
import './VoiceMode.css';

const ICE_SERVERS = [
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

const DEFAULT_WORD_RATE = 5.4; // words per second fallback when duration unknown
const MIN_WORD_RATE = 3.5;
const MAX_WORD_RATE = 8.0;

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
  const voiceStrings = getVoiceTranslationsForProfile(selectedProfile);
  const ui = getUITranslationsForProfile(selectedProfile);

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
  const assistantStreamFlagsRef = useRef({});
  const assistantAnimationTimersRef = useRef({});
  const assistantAnimatedBuffersRef = useRef({});
  const assistantPlaybackRef = useRef({});
  const pendingUserRef = useRef({});
  const isMountedRef = useRef(true);
  const hasSentIntroRef = useRef(false);

  const instructions = useMemo(() => (
    typeof baseInstructions === 'string' && baseInstructions.trim() ? baseInstructions.trim() : undefined
  ), [baseInstructions]);

  const defaultVoiceInstructions = useMemo(() => {
    if (!nativeLanguage || !targetLanguage) {
      throw new Error('VoiceMode requires native and target languages to craft instructions');
    }
    return `You are Polycast AI, a helpful and concise language tutor. You are speaking with a learner whose native language is ${nativeLanguage} and whose target language is ${targetLanguage}. Keep replies brief, speak clearly, and always provide a matching text transcript while you talk.`;
  }, [nativeLanguage, targetLanguage]);

  const normaliseTextFragment = useCallback((fragment) => {
    if (!fragment) return '';
    if (typeof fragment === 'string') return fragment;
    if (Array.isArray(fragment)) {
      return fragment
        .map((item) => {
          if (typeof item === 'string') return item;
          if (item && typeof item === 'object') {
            if (Array.isArray(item.content)) {
              return item.content.map((entry) => normaliseTextFragment(entry)).join('');
            }
            return item.text
              || item.transcript
              || item.content
              || item.delta
              || item.value
              || '';
          }
          return '';
        })
        .join('');
    }
    if (typeof fragment === 'object') {
      if (Array.isArray(fragment.content)) {
        return fragment.content.map((entry) => normaliseTextFragment(entry)).join('');
      }
      return fragment.text
        || fragment.transcript
        || fragment.content
        || fragment.delta
        || fragment.value
        || '';
    }
    return '';
  }, []);

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

  const extractTextFromEvent = useCallback((event) => {
    if (!event || typeof event !== 'object') return '';

    const fromDirect = normaliseTextFragment(event.delta)
      || normaliseTextFragment(event.output_text)
      || normaliseTextFragment(event.text)
      || normaliseTextFragment(event.transcript)
      || normaliseTextFragment(event.part)
      || normaliseTextFragment(event.item)
      || normaliseTextFragment(event.content)
      || normaliseTextFragment(event.message);
    if (fromDirect) return fromDirect;

    const fromResponse = (response) => {
      if (!response || typeof response !== 'object') return '';
      const outputs = response.output || response.outputs;
      if (!Array.isArray(outputs)) return '';
      for (let i = 0; i < outputs.length; i += 1) {
        const text = normaliseTextFragment(outputs[i]?.content);
        if (text) return text;
      }
      return '';
    };

    return fromResponse(event.response) || '';
  }, [normaliseTextFragment]);

  const extractTextMapFromResponse = useCallback((response) => {
    const map = {};
    if (!response || typeof response !== 'object') return map;
    const outputs = response.output || response.outputs;
    if (!Array.isArray(outputs)) return map;
    outputs.forEach((output, index) => {
      const text = normaliseTextFragment(output?.content);
      if (text) {
        map[index] = text;
      }
    });
    return map;
  }, [normaliseTextFragment]);

  const cancelPlaybackTimer = useCallback((id) => {
    const playback = assistantPlaybackRef.current[id];
    if (playback?.frame) {
      cancelAnimationFrame(playback.frame);
      playback.frame = null;
    }
  }, []);

  const stopAssistantAnimation = useCallback((id) => {
    const timer = assistantAnimationTimersRef.current[id];
    if (timer) {
      clearInterval(timer);
      delete assistantAnimationTimersRef.current[id];
    }
    delete assistantAnimatedBuffersRef.current[id];
  }, []);

  const buildPlaybackTokens = useCallback((text) => {
    if (!text) return [];
    const matches = text.match(/\S+\s*/g);
    return matches ? matches : [text];
  }, []);

  const schedulePlaybackFrame = useCallback((id) => {
    const playback = assistantPlaybackRef.current[id];
    if (!playback) return;

    const tick = () => {
      const current = assistantPlaybackRef.current[id];
      if (!current) return;

      const now = performance.now();
      const elapsedSeconds = current.startTime ? Math.max((now - current.startTime) / 1000, 0) : 0;
      const rate = current.wordRate || DEFAULT_WORD_RATE;
      const targetCount = current.tokens.length ? Math.floor(elapsedSeconds * rate) : 0;
      const clamped = Math.min(current.tokens.length, targetCount);

      if (clamped > current.displayedCount) {
        current.displayedCount = clamped;
        const displayText = current.tokens.slice(0, clamped).join('');
        addOrUpdateMessage(id, 'assistant', displayText, { replace: true });
      }

      if (current.complete && current.displayedCount >= current.tokens.length) {
        current.frame = null;
        delete assistantPlaybackRef.current[id];
        return;
      }

      current.frame = requestAnimationFrame(tick);
    };

    if (playback.frame) return;
    playback.frame = requestAnimationFrame(tick);
  }, [addOrUpdateMessage]);

  const animateAssistantMessage = useCallback((id, finalText) => {
    stopAssistantAnimation(id);
    const parts = finalText.match(/\S+\s*/g) || [finalText];
    let index = 0;
    assistantAnimatedBuffersRef.current[id] = '';
    addOrUpdateMessage(id, 'assistant', '', { replace: true });

    const emitNext = () => {
      const chunk = parts[index];
      if (!chunk) {
        stopAssistantAnimation(id);
        addOrUpdateMessage(id, 'assistant', finalText, { replace: true });
        return;
      }
      assistantAnimatedBuffersRef.current[id] = `${assistantAnimatedBuffersRef.current[id]}${chunk}`;
      addOrUpdateMessage(id, 'assistant', assistantAnimatedBuffersRef.current[id], { replace: true });
      index += 1;
      if (index >= parts.length) {
        stopAssistantAnimation(id);
      }
    };

    emitNext();
    if (parts.length > 1) {
      assistantAnimationTimersRef.current[id] = setInterval(() => {
        emitNext();
        if (!assistantAnimationTimersRef.current[id]) {
          clearInterval(assistantAnimationTimersRef.current[id]);
        }
      }, 80);
    }
  }, [addOrUpdateMessage, stopAssistantAnimation]);

  const applyAssistantDelta = useCallback((id, fragment) => {
    const delta = normaliseTextFragment(fragment);
    if (!delta) return;
    assistantStreamFlagsRef.current[id] = true;
    pendingAssistantRef.current[id] = (pendingAssistantRef.current[id] || '') + delta;
    const playback = assistantPlaybackRef.current[id];
    if (playback) {
      playback.tokens = buildPlaybackTokens(pendingAssistantRef.current[id]);
      schedulePlaybackFrame(id);
    } else {
      stopAssistantAnimation(id);
      addOrUpdateMessage(id, 'assistant', delta, { replace: false });
    }
  }, [addOrUpdateMessage, buildPlaybackTokens, normaliseTextFragment, schedulePlaybackFrame, stopAssistantAnimation]);

  const finalizeAssistantMessage = useCallback((id, fragment) => {
    const text = normaliseTextFragment(fragment) || pendingAssistantRef.current[id] || '';
    pendingAssistantRef.current[id] = '';
    const wasStreaming = assistantStreamFlagsRef.current[id];
    delete assistantStreamFlagsRef.current[id];
    const playback = assistantPlaybackRef.current[id];
    if (playback) {
      playback.tokens = buildPlaybackTokens(text);
      playback.complete = true;
      schedulePlaybackFrame(id);
      return;
    }
    if (!text) {
      stopAssistantAnimation(id);
      return;
    }
    if (wasStreaming) {
      stopAssistantAnimation(id);
      addOrUpdateMessage(id, 'assistant', text, { replace: true });
      return;
    }
    animateAssistantMessage(id, text);
  }, [addOrUpdateMessage, animateAssistantMessage, buildPlaybackTokens, normaliseTextFragment, schedulePlaybackFrame, stopAssistantAnimation]);

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

  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const handleScroll = () => {
      const threshold = 80;
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      setShouldAutoScroll(distanceFromBottom < threshold);
    };

    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!shouldAutoScroll) return;
    const el = scrollContainerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [conversation, shouldAutoScroll]);

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
                channel.send(JSON.stringify({
                  type: 'response.create',
                  response: {
                    modalities: ['text', 'audio'],
                    instructions: instructions || defaultVoiceInstructions,
                  },
                }));
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
          applyAssistantDelta(id, event.delta || extractTextFromEvent(event));
          setStatus('responding');
          break;
        }
        case 'response.output_text.done': {
          const id = `${event.response_id || 'assistant'}-${event.output_index ?? 0}`;
          const fromResponse = extractTextMapFromResponse(event.response);
          const final = fromResponse[event.output_index ?? 0] || extractTextFromEvent(event);
          finalizeAssistantMessage(id, final);
          setStatus('ready');
          break;
        }
        case 'response.output_item.added':
        case 'response.output_item.created': {
          const id = `${event.response_id || 'assistant'}-${event.output_index ?? 0}`;
          applyAssistantDelta(id, extractTextFromEvent(event));
          setStatus('responding');
          break;
        }
        case 'response.content_part.delta':
        case 'response.content_part.added': {
          if (event.part?.type !== 'output_text') break;
          const id = `${event.response_id || 'assistant'}-${event.output_index ?? 0}`;
          const fragment = event.part?.delta || event.part?.text || event.part?.content || extractTextFromEvent(event);
          applyAssistantDelta(id, fragment);
          setStatus('responding');
          break;
        }
        case 'response.content_part.done': {
          if (event.part?.type !== 'output_text') break;
          const id = `${event.response_id || 'assistant'}-${event.output_index ?? 0}`;
          const fragment = event.part?.content || event.part?.text || extractTextFromEvent(event);
          finalizeAssistantMessage(id, fragment);
          setStatus('ready');
          break;
        }
        case 'response.output_audio_transcript.delta': {
          const id = `${event.response_id || 'assistant'}-${event.output_index ?? 0}`;
          applyAssistantDelta(id, event.delta || extractTextFromEvent(event));
          const playback = assistantPlaybackRef.current[id];
          if (playback) {
            playback.tokens = tokenizeText(pendingAssistantRef.current[id] || '');
            schedulePlaybackFrame(id);
          }
          setStatus('responding');
          break;
        }
        case 'response.output_audio_transcript.done': {
          const id = `${event.response_id || 'assistant'}-${event.output_index ?? 0}`;
          const fromResponse = extractTextMapFromResponse(event.response);
          const final = event.transcript || fromResponse[event.output_index ?? 0] || extractTextFromEvent(event);
          finalizeAssistantMessage(id, final);
          setStatus('ready');
          break;
        }
        case 'response.completed':
        case 'response.done': {
          if (event.response) {
            const fromResponse = extractTextMapFromResponse(event.response);
            Object.entries(fromResponse).forEach(([index, text]) => {
              const id = `${event.response?.id || 'assistant'}-${index}`;
              finalizeAssistantMessage(id, text);
            });
          }
          setStatus('ready');
          break;
        }
        case 'response.error':
          setError(event?.error?.message || 'Realtime response error');
          setStatus('error');
          break;
        case 'output_audio_buffer.started': {
          const id = `${event.response_id || 'assistant'}-${event.output_index ?? 0}`;
          const playback = assistantPlaybackRef.current[id] || {
            tokens: buildPlaybackTokens(pendingAssistantRef.current[id] || ''),
            displayedCount: 0,
            wordRate: null,
            complete: false,
            frame: null,
          };
          playback.startTime = performance.now();
          playback.complete = false;
          playback.displayedCount = 0;
          playback.tokens = buildPlaybackTokens(pendingAssistantRef.current[id] || '');
          playback.wordRate = playback.wordRate || DEFAULT_WORD_RATE;
          cancelPlaybackTimer(id);
          assistantPlaybackRef.current[id] = playback;
          stopAssistantAnimation(id);
          addOrUpdateMessage(id, 'assistant', '', { replace: true });
          schedulePlaybackFrame(id);
          setStatus('responding');
          break;
        }
        case 'output_audio_buffer.stopped': {
          const id = `${event.response_id || 'assistant'}-${event.output_index ?? 0}`;
          const playback = assistantPlaybackRef.current[id];
          if (playback && playback.startTime) {
            const elapsed = Math.max((performance.now() - playback.startTime) / 1000, 0.4);
            const totalWords = playback.tokens.length || buildPlaybackTokens(pendingAssistantRef.current[id] || '').length;
            if (totalWords > 0) {
              const computedRate = totalWords / elapsed;
              playback.wordRate = Math.min(MAX_WORD_RATE, Math.max(MIN_WORD_RATE, computedRate));
            }
            playback.complete = true;
            schedulePlaybackFrame(id);
          }
          setStatus('ready');
          break;
        }
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
          try {
            const channel = dataChannelRef.current;
            if (channel && channel.readyState === 'open') {
              channel.send(JSON.stringify({
                type: 'response.create',
                response: {
                  modalities: ['text', 'audio'],
                  instructions: instructions || defaultVoiceInstructions,
                },
              }));
            }
          } catch (e) {
            console.warn('[VoiceMode] failed to request response after user speech', e);
          }
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
      Object.keys(assistantAnimationTimersRef.current).forEach((key) => clearInterval(assistantAnimationTimersRef.current[key]));
      assistantAnimationTimersRef.current = {};
      assistantAnimatedBuffersRef.current = {};
      Object.keys(assistantPlaybackRef.current).forEach((key) => cancelPlaybackTimer(key));
      assistantPlaybackRef.current = {};
    };
  }, [
    instructions,
    cleanupConnection,
    addOrUpdateMessage,
    normaliseTextFragment,
    applyAssistantDelta,
    extractTextFromEvent,
    extractTextMapFromResponse,
    finalizeAssistantMessage,
    cancelPlaybackTimer,
  ]);

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
        return voiceStrings.statusConnecting;
      case 'ready':
        return voiceStrings.statusReady;
      case 'listening':
        return voiceStrings.statusListening;
      case 'responding':
        return voiceStrings.statusResponding;
      case 'ended':
        return voiceStrings.statusEnded;
      case 'error':
        return voiceStrings.statusError;
      default:
        return '';
    }
  }, [status, voiceStrings]);

  return (
    <div className="voice-mode-overlay">
      <div className="voice-mode-surface">
        <button
          type="button"
          className="voice-close-btn"
          onClick={handleEndSession}
          aria-label={voiceStrings.closeButtonAria}
        >
          ×
        </button>

        <div className="voice-layout">
          <div className="voice-center">
            <div className={`voice-orb voice-orb-${status}`}>
              <span className="voice-orb-ring ring-1" />
              <span className="voice-orb-ring ring-2" />
              <span className="voice-orb-ring ring-3" />
              <div className="voice-orb-core" />
            </div>

            <div className="voice-status-block">
              <h2>{ui.voiceHeading}</h2>
              <p className="voice-status-text">{statusLabel}</p>
              {error ? (
                <p className="voice-status-error">{error}</p>
              ) : (
                <p className="voice-status-hint">{ui.voiceHint}</p>
              )}
            </div>

            <button type="button" className="voice-end-btn" onClick={handleEndSession}>
              {ui.endSession}
            </button>
          </div>

          <div className="voice-transcript-panel" ref={scrollContainerRef}>
            {conversation.length === 0 ? (
              <div className="voice-placeholder">{ui.voiceWaiting}</div>
            ) : (
              conversation.map((turn) => (
                <div key={turn.id} className={`voice-transcript-turn voice-transcript-${turn.role}`}>
                  <div className="voice-transcript-label">{turn.role === 'assistant' ? voiceStrings.assistantLabel : voiceStrings.userLabel}</div>
                  <div className="voice-transcript-text">{renderTokens(turn.content, turn.id)}</div>
                </div>
              ))
            )}
          </div>
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
