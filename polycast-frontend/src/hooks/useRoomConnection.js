import { useState, useRef, useCallback } from 'react';

/**
 * Hook for managing WebSocket room connection state
 * Handles reconnection logic, error tracking, and WebRTC signaling
 */
export function useRoomConnection() {
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [invalidRoom, setInvalidRoom] = useState(false);
  const [errorMessages, setErrorMessages] = useState([]);
  const [signalLog, setSignalLog] = useState([]);

  const maxReconnectAttempts = 3;

  // WebRTC signaling refs
  const webrtcSignalHandlerRef = useRef(null);
  const pendingWebrtcSignalsRef = useRef([]);

  // Reset reconnect attempts on successful connection
  const handleConnectionOpen = useCallback((socketUrl) => {
    console.log('WebSocket connection opened with URL:', socketUrl);
    setSignalLog(prev => [`ws: open ${socketUrl}`, ...prev].slice(0, 10));
    setReconnectAttempts(0);
  }, []);

  const handleConnectionClose = useCallback(() => {
    console.log('WebSocket connection closed');
    setSignalLog(prev => ['ws: close', ...prev].slice(0, 10));
  }, []);

  const handleConnectionError = useCallback((event) => {
    console.error('WebSocket error:', event);
    setSignalLog(prev => [`ws: error ${event?.type || ''}`, ...prev].slice(0, 10));
    setErrorMessages(prev => [...prev, `WebSocket error: ${event.type}`]);
  }, []);

  // Callback for useWebSocket shouldReconnect
  const shouldReconnect = useCallback((closeEvent) => {
    // Don't reconnect if room is invalid
    if (invalidRoom) {
      console.log('Not reconnecting because room was rejected');
      return false;
    }

    const shouldTry = reconnectAttempts < maxReconnectAttempts;
    if (shouldTry) {
      setReconnectAttempts(prev => prev + 1);
      console.log(`WebSocket reconnect attempt ${reconnectAttempts + 1}/${maxReconnectAttempts}`);
    } else {
      console.log(`WebSocket reconnection stopped after ${maxReconnectAttempts} attempts`);
    }
    return shouldTry;
  }, [invalidRoom, reconnectAttempts]);

  // Calculate reconnect interval with exponential backoff
  const getReconnectInterval = useCallback((attemptNumber) => {
    return Math.min(3000 * Math.pow(1.5, attemptNumber), 30000);
  }, []);

  // WebRTC signal handler registration
  const registerWebrtcSignalHandler = useCallback((handler) => {
    webrtcSignalHandlerRef.current = handler;
    // Deliver any pending signals
    const pending = pendingWebrtcSignalsRef.current;
    pendingWebrtcSignalsRef.current = [];
    pending.forEach((msg) => {
      try { handler(msg); } catch (e) { console.warn('Failed delivering pending signal:', e); }
    });
  }, []);

  const unregisterWebrtcSignalHandler = useCallback(() => {
    webrtcSignalHandlerRef.current = null;
  }, []);

  // Handle WebRTC signal messages
  const handleWebrtcSignal = useCallback((parsedData) => {
    try {
      const summary = parsedData.type === 'webrtc_ice'
        ? `ice: ${parsedData?.candidate?.candidate?.slice(0, 28) || 'candidate'}`
        : `${parsedData.type.replace('webrtc_', '')}`;
      setSignalLog(prev => [`rtc: ${summary}`, ...prev].slice(0, 10));
    } catch (_) {}

    const handler = webrtcSignalHandlerRef.current;
    if (handler) {
      try { handler(parsedData); } catch (e) { console.warn('Failed to handle webrtc signal via handler:', e); }
    } else {
      pendingWebrtcSignalsRef.current.push(parsedData);
    }
  }, []);

  // Handle room error (invalid room)
  const handleRoomError = useCallback((message, onReset) => {
    console.error('Room Error:', message);
    setErrorMessages(prev => [...prev, `Room Error: ${message}`]);
    setInvalidRoom(true);
    alert(`Room error: ${message}`);
    setTimeout(() => onReset && onReset(), 1000);
  }, []);

  // Add info message to signal log
  const logInfo = useCallback((message) => {
    setSignalLog(prev => [`info: ${message}`, ...prev].slice(0, 10));
  }, []);

  return {
    reconnectAttempts,
    invalidRoom,
    setInvalidRoom,
    errorMessages,
    setErrorMessages,
    signalLog,
    setSignalLog,
    webrtcSignalHandlerRef,
    pendingWebrtcSignalsRef,
    handleConnectionOpen,
    handleConnectionClose,
    handleConnectionError,
    shouldReconnect,
    getReconnectInterval,
    registerWebrtcSignalHandler,
    unregisterWebrtcSignalHandler,
    handleWebrtcSignal,
    handleRoomError,
    logInfo
  };
}
