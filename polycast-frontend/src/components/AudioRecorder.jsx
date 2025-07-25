import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';

function AudioRecorder({ sendMessage, isRecording }) {
  const streamRef = useRef(null); 
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const sourceRef = useRef(null);
  const [micError, setMicError] = useState(null);
  
  // Get microphone access on mount
  useEffect(() => {
    async function getStream() {
      try {
        streamRef.current = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            sampleRate: 16000, // Deepgram prefers 16kHz for speech
            channelCount: 1,   // Mono audio
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        setMicError(null);
      } catch (err) {
        setMicError('Microphone access denied or unavailable');
        console.error('Mic error:', err);
      }
    }
    
    getStream();
    
    return () => {
      // Clean up on unmount
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);
  
  // Handle recording state changes
  useEffect(() => {
    if (!streamRef.current || micError) return;
    
    if (isRecording) {
      console.log('Starting audio streaming with Web Audio API');
      
      // Create audio context
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000
      });
      
      const audioContext = audioContextRef.current;
      sourceRef.current = audioContext.createMediaStreamSource(streamRef.current);
      
      // Create a script processor to capture raw audio data
      const bufferSize = 4096; // Process in 4096 sample chunks
      processorRef.current = audioContext.createScriptProcessor(bufferSize, 1, 1);
      
      processorRef.current.onaudioprocess = (event) => {
        const inputBuffer = event.inputBuffer;
        const inputData = inputBuffer.getChannelData(0); // Get mono channel
        
        // Convert Float32Array to 16-bit PCM
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          pcmData[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
        }
        
        // Send raw PCM data to backend
        sendMessage(pcmData.buffer);
      };
      
      // Connect the nodes
      sourceRef.current.connect(processorRef.current);
      processorRef.current.connect(audioContext.destination);
      
    } else {
      // Stop recording
      console.log('Stopping audio streaming');
      
      if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
      }
      
      if (sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
      }
      
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      
      // Send signal to close Deepgram streaming session
      sendMessage('STOP_STREAM');
    }
  }, [isRecording, sendMessage, micError]);
  
  return (
    <div className="audio-recorder">
      {micError && <div style={{ color: 'red' }}>{micError}</div>}
    </div>
  );
}

AudioRecorder.propTypes = {
  sendMessage: PropTypes.func.isRequired,
  isRecording: PropTypes.bool.isRequired,
};

export default AudioRecorder;