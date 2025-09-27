import React, { useEffect, useRef, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import aiService from '../../services/aiService.js';
import './VoiceSessionPanel.css';

const ASSISTANT = 'assistant';
const USER = 'user';

function VoiceSessionPanel({
  open,
  onClose,
  selectedProfile,
  nativeLanguage,
  targetLanguage,
  renderTokenizedText,
  onMessageComplete,
  systemInstructions,
}) {
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [transcripts, setTranscripts] = useState([]);
  const [micEnabled, setMicEnabled] = useState(true);

  const pcRef = useRef(null);
  const dataChannelRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const assistantBufferRef = useRef('');
  const userBufferRef = useRef('');

  const assistantMessageIdRef = useRef(null);
  const userMessageIdRef = useRef(null);

  const cleanup = useCallback(() => {
    if (dataChannelRef.current) {
      try { dataChannelRef.current.close(); } catch (_) {}
    }
    if (pcRef.current) {
      try { pcRef.current.close(); } catch (_) {}
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    pcRef.current = null;
    dataChannelRef.current = null;
    localStreamRef.current = null;
    assistantBufferRef.current = '';
    userBufferRef.current = '';
    setMicEnabled(true);
    setStatus('idle');
  }, []);

  const updateTranscript = useCallback((id, role, text, final = false) => {
    setTranscripts(prev => {
      const existingIndex = prev.findIndex(entry => entry.id === id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = { ...updated[existingIndex], text, final };
        return updated;
      }
      return [...prev, { id, role, text, final }];
    });
  }, []);

  const finalizeTranscript = useCallback((id, role, text) => {
    updateTranscript(id, role, text, true);
    onMessageComplete?.({ role, content: text });
  }, [onMessageComplete, updateTranscript]);

  const handleServerEvent = useCallback((event) => {
    let payload;
    try {
      payload = JSON.parse(event.data);
    } catch (err) {
      console.warn('[VoiceSessionPanel] Failed to parse event', err);
      return;
    }

    if (!payload?.type) return;

    if (payload.type === 'response.output_text.delta') {
      const responseId = payload.response_id || payload.response?.id || 'assistant';
      assistantMessageIdRef.current = `assistant-${responseId}`;
      const chunk = payload.delta || payload.text || '';
      assistantBufferRef.current = `${assistantBufferRef.current}${chunk}`;
      updateTranscript(assistantMessageIdRef.current, ASSISTANT, assistantBufferRef.current, false);
      return;
    }

    if (payload.type === 'response.output_text.done') {
      const responseId = payload.response_id || payload.response?.id || 'assistant';
      const transcript = assistantBufferRef.current.trim();
      if (transcript) {
        finalizeTranscript(`assistant-${responseId}`, ASSISTANT, transcript);
      }
      assistantBufferRef.current = '';
      assistantMessageIdRef.current = null;
      return;
    }

    if (payload.type === 'conversation.item.input_text.delta') {
      const itemId = payload.item_id || payload.item?.id || 'user';
      userMessageIdRef.current = `user-${itemId}`;
      const chunk = payload.delta || payload.text || '';
      userBufferRef.current = `${userBufferRef.current}${chunk}`;
      updateTranscript(userMessageIdRef.current, USER, userBufferRef.current, false);
      return;
    }

    if (payload.type === 'conversation.item.input_text.done') {
      const itemId = payload.item_id || payload.item?.id || 'user';
      const transcript = userBufferRef.current.trim();
      if (transcript) {
        finalizeTranscript(`user-${itemId}`, USER, transcript);
      }
      userBufferRef.current = '';
      userMessageIdRef.current = null;
      return;
    }

    if (payload.type === 'response.done' && Array.isArray(payload.response?.output)) {
      // Fallback: extract concatenated text from final response if deltas were missed
      const text = payload.response.output
        .flatMap(item => item.content || [])
        .filter(content => content.type === 'output_text' && content.text)
        .map(content => content.text)
        .join(' ')
        .trim();
      if (text) {
        const responseId = payload.response.id || Date.now();
        finalizeTranscript(`assistant-${responseId}`, ASSISTANT, text);
      }
      return;
    }

    if (payload.type === 'conversation.item.created' && payload.item?.role === 'user') {
      const text = payload.item?.content?.map?.(part => part.text).filter(Boolean).join(' ').trim();
      if (text) {
        const itemId = payload.item.id || Date.now();
        finalizeTranscript(`user-${itemId}`, USER, text);
      }
    }
  }, [finalizeTranscript, updateTranscript]);

  const configureSession = useCallback(() => {
    if (!dataChannelRef.current || dataChannelRef.current.readyState !== 'open') return;

    const sessionUpdate = {
      type: 'session.update',
      session: {
        type: 'realtime',
        instructions: systemInstructions,
        output_modalities: ['audio', 'text'],
        audio: {
          output: {
            voice: 'marin',
          },
        },
      },
    };

    try {
      dataChannelRef.current.send(JSON.stringify(sessionUpdate));
    } catch (err) {
      console.warn('[VoiceSessionPanel] Failed to send session.update', err);
    }

    const greetingEvent = {
      type: 'response.create',
      response: {
        instructions: 'Welcome the learner briefly and ask how you can support their language goals.',
      },
    };

    try {
      dataChannelRef.current.send(JSON.stringify(greetingEvent));
    } catch (err) {
      console.warn('[VoiceSessionPanel] Failed to send greeting response.create', err);
    }
  }, [systemInstructions]);

  const initConnection = useCallback(async () => {
    setError('');
    setTranscripts([]);

    try {
      setStatus('connecting');
      const secretResponse = await aiService.createRealtimeVoiceSession({
        voice: 'marin',
        instructions: systemInstructions,
        modalities: ['audio', 'text'],
        temperature: 0.6,
      });

      const clientSecret = secretResponse?.value || secretResponse?.client_secret?.value;
      if (!clientSecret) {
        throw new Error('Realtime client secret missing from response');
      }

      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      const remoteAudio = remoteAudioRef.current;
      if (remoteAudio) {
        remoteAudio.autoplay = true;
        remoteAudio.playsInline = true;
      }

      pc.ontrack = (event) => {
        if (remoteAudio) {
          [remoteAudio.srcObject] = event.streams;
        }
      };

      const dc = pc.createDataChannel('oai-events');
      dataChannelRef.current = dc;
      dc.addEventListener('message', handleServerEvent);
      dc.addEventListener('open', () => {
        setStatus('connected');
        configureSession();
      });
      dc.addEventListener('close', () => {
        setStatus('idle');
      });

      const localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = localStream;
      localStream.getAudioTracks().forEach(track => pc.addTrack(track, localStream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpResponse = await fetch('https://api.openai.com/v1/realtime/calls', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${clientSecret}`,
          'Content-Type': 'application/sdp',
        },
        body: offer.sdp,
      });

      if (!sdpResponse.ok) {
        const text = await sdpResponse.text();
        throw new Error(text || 'Failed to negotiate realtime connection');
      }

      const answer = {
        type: 'answer',
        sdp: await sdpResponse.text(),
      };
      await pc.setRemoteDescription(answer);
    } catch (err) {
      console.error('[VoiceSessionPanel] init error', err);
      setError(err?.message || 'Unable to start realtime voice session.');
      setStatus('error');
      cleanup();
    }
  }, [cleanup, configureSession, handleServerEvent, systemInstructions]);

  useEffect(() => {
    if (!open) {
      cleanup();
      return undefined;
    }
    initConnection();
    return () => {
      cleanup();
    };
  }, [open, initConnection, cleanup]);

  useEffect(() => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getAudioTracks().forEach(track => {
      track.enabled = micEnabled;
    });
  }, [micEnabled]);

  if (!open) return null;

  return (
    <div className="voice-panel">
      <div className="voice-panel-header">
        <div>
          <h3>Voice conversation</h3>
          <span className={`voice-status ${status}`}>
            {status === 'connecting' && 'Connecting…'}
            {status === 'connected' && 'Live'}
            {status === 'error' && 'Error'}
            {status === 'idle' && 'Ready'}
          </span>
        </div>
        <div className="voice-panel-controls">
          <button
            type="button"
            className={`voice-control ${micEnabled ? 'active' : 'muted'}`}
            onClick={() => setMicEnabled(prev => !prev)}
          >
            {micEnabled ? 'Mute mic' : 'Unmute'}
          </button>
          <button type="button" className="voice-control end" onClick={onClose}>
            End session
          </button>
        </div>
      </div>

      {error && (
        <div className="voice-error">{error}</div>
      )}

      <div className="voice-transcripts">
        {transcripts.map(entry => (
          <div key={entry.id} className={`voice-transcript ${entry.role}`}>
            <div className="speaker-label">{entry.role === USER ? 'You' : 'Polycast AI'}</div>
            <div className="transcript-text">
              {renderTokenizedText(entry.text, entry.id)}
              {!entry.final && <span className="transcript-pending">…</span>}
            </div>
          </div>
        ))}
        {transcripts.length === 0 && (
          <div className="voice-placeholder">
            Start speaking and Polycast AI will respond instantly.
          </div>
        )}
      </div>

      <audio ref={remoteAudioRef} hidden />
    </div>
  );
}

VoiceSessionPanel.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  selectedProfile: PropTypes.string.isRequired,
  nativeLanguage: PropTypes.string.isRequired,
  targetLanguage: PropTypes.string.isRequired,
  renderTokenizedText: PropTypes.func.isRequired,
  onMessageComplete: PropTypes.func,
  systemInstructions: PropTypes.string.isRequired,
};

export default VoiceSessionPanel;
