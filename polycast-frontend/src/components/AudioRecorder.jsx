import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';

function AudioRecorder({ sendMessage, isRecording, onAudioSent, autoSend, showNoiseLevel, onSetRecording }) {
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null); 
  const [micError, setMicError] = useState(null);
  
  // Audio processing refs
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const silenceDetectorRef = useRef(null);
  const speechDetectedRef = useRef(false); // Track if real speech was detected
  
  // RMS and frame tracking
  const rmsHistoryRef = useRef([]);
  const baselineRMSRef = useRef(null);
  const speechFramesRef = useRef(0);
  const silenceFramesRef = useRef(0);
  
  // Constants
  const FRAME_MS = 100;
  const GAP_MS = 900;            // flush after 900ms silence
  const MIN_SPEECH_MS = 250;     // need 250ms > thresh to mark as speech
  const MARGIN_DB = 6;           // threshold = noise + 6dB
  
  // Audio visualization state
  const [audioLevel, setAudioLevel] = useState(0);
  const [isSilent, setIsSilent] = useState(true);
  const [silenceDuration, setSilenceDuration] = useState(0);
  const [zeroCrossings, setZeroCrossings] = useState(0);
  const [threshold, setThreshold] = useState(0);
  
  // Track why the recorder was stopped
  const stopReasonRef = useRef('user'); // 'user' or 'auto'
  
  // Helper functions
  function rawRMS(arr) {
    const sum = arr.reduce((s, v) => {
      const f = (v - 128) / 128;
      return s + f * f;
    }, 0);
    return Math.sqrt(sum / arr.length);
  }
  
  function average(a) {
    return a.reduce((s, v) => s + v, 0) / a.length;
  }
  
  // Zero crossing rate calculation function
  function zeroCrossingRate(array) {
    let crossings = 0;
    for (let i = 1; i < array.length; i++) {
      const v1 = array[i - 1] - 128;
      const v2 = array[i] - 128;
      if ((v1 >= 0 && v2 < 0) || (v1 < 0 && v2 >= 0)) crossings++;
    }
    return crossings / array.length; // 0...0.5
  }
  
  // Calibrate noise floor
  const calibrateNoiseFloor = async (analyser) => {
    return new Promise((resolve) => {
      const samples = [];
      const dataArray = new Uint8Array(analyser.fftSize);
      
      const calibrationInterval = setInterval(() => {
        analyser.getByteTimeDomainData(dataArray);
        samples.push(rawRMS(dataArray));
        
        if (samples.length >= 750 / FRAME_MS) {
          clearInterval(calibrationInterval);
          const baseline = average(samples);
          console.log(`Noise floor calibrated: ${baseline.toFixed(4)}`);
          resolve(baseline);
        }
      }, FRAME_MS);
    });
  };
  
  // Get microphone access on mount
  useEffect(() => {
    async function getStream() {
      try {
        streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // Set up audio analyzer for detecting volume
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 1024; // Increased for better resolution
        
        const source = audioContextRef.current.createMediaStreamSource(streamRef.current);
        
        // Create band-pass: 300 Hz – 3400 Hz (speech frequencies)
        const hp = audioContextRef.current.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 300;
        
        const lp = audioContextRef.current.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 3400;
        
        // wire: mic → HP → LP → analyser
        source.connect(hp);
        hp.connect(lp);
        lp.connect(analyserRef.current);
        
        // Calibrate the noise floor
        const baseline = await calibrateNoiseFloor(analyserRef.current);
        baselineRMSRef.current = baseline;
        
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
      if (silenceDetectorRef.current) {
        clearInterval(silenceDetectorRef.current);
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
      // Start recording
      console.log('Starting recorder');
      
      const recorder = new MediaRecorder(streamRef.current);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      
      // Reset speech detection for this segment
      speechDetectedRef.current = false;
      speechFramesRef.current = 0;
      silenceFramesRef.current = 0;
      rmsHistoryRef.current = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };
      
      recorder.onstop = () => {
        // Only send if:
        // - Manual mode (autoSend is false)
        // - Or autoSend is true AND stopped by silence (not user)
        if (
          (!autoSend && audioChunksRef.current.length > 0) ||
          (autoSend && stopReasonRef.current === 'auto' && audioChunksRef.current.length > 0)
        ) {
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          console.log('Sending audio chunk, size:', blob.size, 'bytes, speech detected:', speechDetectedRef.current);
          sendMessage(blob);
          if (onAudioSent) onAudioSent();
        } else {
          // Discard chunk in auto-send mode if stopped by user
          audioChunksRef.current = [];
        }
      };
      
      recorder.start();
      
      // Start audio processing loop
      if (silenceDetectorRef.current) {
        clearInterval(silenceDetectorRef.current);
      }
      
      silenceDetectorRef.current = setInterval(() => {
        if (!analyserRef.current || !mediaRecorderRef.current || !baselineRMSRef.current) return;
        
        // Get time-domain audio data
        const dataArray = new Uint8Array(analyserRef.current.fftSize);
        analyserRef.current.getByteTimeDomainData(dataArray);
        
        // Calculate raw RMS
        const rms = rawRMS(dataArray);
        
        // Calculate zero crossing rate (still useful for visualization)
        const zcr = zeroCrossingRate(dataArray);
        setZeroCrossings(zcr.toFixed(3));
        
        // Add to history for smoothing
        rmsHistoryRef.current.push(rms);
        if (rmsHistoryRef.current.length > 3) rmsHistoryRef.current.shift();
        
        // Get smoothed RMS (3-frame average)
        const smoothRMS = average(rmsHistoryRef.current);
        
        // Scale for UI (0-100)
        setAudioLevel(smoothRMS * 100);
        
        // Threshold: baseline × 10^(marginDB/20)
        const thresh = baselineRMSRef.current * Math.pow(10, MARGIN_DB / 20);
        setThreshold(thresh * 100); // For display
        
        // Check if current level is above threshold
        const isSound = smoothRMS > thresh;
        
        if (isSound) {
          // Sound detected
          speechFramesRef.current++;
          if (silenceFramesRef.current !== 0) silenceFramesRef.current = 0;
          setIsSilent(false);
          
          // Mark as speech after MIN_SPEECH_MS
          if (!speechDetectedRef.current && 
              speechFramesRef.current * FRAME_MS >= MIN_SPEECH_MS) {
            speechDetectedRef.current = true;
            console.log(`Speech detected! RMS: ${(smoothRMS * 100).toFixed(1)}, Threshold: ${(thresh * 100).toFixed(1)}`);
          }
        } else {
          // Silence detected
          silenceFramesRef.current++;
          speechFramesRef.current = 0;
          setIsSilent(true);
          setSilenceDuration(silenceFramesRef.current * FRAME_MS);
          
          // Auto-send: simulate spacebar release when speech stops
          if (speechDetectedRef.current && 
              silenceFramesRef.current * FRAME_MS >= 500 &&
              autoSend && onSetRecording) {
            
            console.log('Auto-send: Simulating spacebar release after speech detection reset');
            speechDetectedRef.current = false;
            
            // Simulate spacebar release (stop recording)
            onSetRecording(false);
            
            // After a short delay, simulate spacebar press (start recording again)
            setTimeout(() => {
              if (autoSend) {
                console.log('Auto-send: Simulating spacebar press to resume recording');
                onSetRecording(true);
              }
            }, 100);
          }
          
          // Reset speech detection status after 500ms of silence (for UI display only)
          else if (speechDetectedRef.current && silenceFramesRef.current * FRAME_MS >= 500) {
            speechDetectedRef.current = false;
            console.log('Speech detection reset after extended silence');
          }
        }
      }, FRAME_MS);
      
    } else {
      // Stop recording if user releases key or autoSend is turned off
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        console.log('Stopping recorder (user released key or autoSend off)');
        stopReasonRef.current = 'user';
        mediaRecorderRef.current.stop();
        // Clear the chunks to prevent sending if autoSend was on and user stopped it
        if (autoSend) {
          audioChunksRef.current = [];
        }
      }
      
      // Reset speech detection status when recording stops
      speechDetectedRef.current = false;

      // Clear silence detector
      if (silenceDetectorRef.current) {
        clearInterval(silenceDetectorRef.current);
        silenceDetectorRef.current = null;
      }
      
      // Reset UI
      setAudioLevel(0);
      setIsSilent(true);
      setSilenceDuration(0);
    }
  }, [isRecording, sendMessage, onAudioSent, micError, autoSend]);
  
  return (
    <div className="audio-recorder">
      {micError && <div style={{ color: 'red' }}>{micError}</div>}
      
      {/* Audio level meter for debugging */}
      {showNoiseLevel && (
        <div style={{ 
          position: 'fixed', 
          bottom: '20px', 
          right: '20px', 
          padding: '10px', 
          background: 'rgba(0,0,0,0.8)',
          color: 'white',
          borderRadius: '5px',
          zIndex: 9999,
          fontSize: '12px',
          width: '180px'
        }}>
          <div>Level: {audioLevel.toFixed(1)}</div>
          <div>ZCR: {zeroCrossings}</div>
          <div>Threshold: {threshold.toFixed(1)}</div>
          <div>Speech frames: {speechFramesRef.current}</div>
          <div>Silence frames: {silenceFramesRef.current}</div>
          <div style={{ 
            height: '10px', 
            width: '100%', 
            background: '#333',
            marginTop: '5px'
          }}>
            <div style={{ 
              height: '100%', 
              width: `${Math.min(100, audioLevel)}%`, 
              background: isSilent ? '#f55' : '#5f5',
              transition: 'width 0.1s'
            }}></div>
            <div style={{
              position: 'absolute',
              height: '10px',
              width: '2px',
              background: '#fff',
              left: `calc(${Math.min(100, threshold)}% + 10px)`,
              marginTop: '-10px'
            }}></div>
          </div>
          <div style={{ marginTop: '5px' }}>
            {isSilent ? `Silent: ${silenceDuration}ms` : 'Speech detected'}
          </div>
          <div>
            Speech: {speechDetectedRef.current ? 'YES' : 'NO'}
          </div>
        </div>
      )}
    </div>
  );
}

AudioRecorder.propTypes = {
  sendMessage: PropTypes.func.isRequired,
  isRecording: PropTypes.bool.isRequired,
  onAudioSent: PropTypes.func,
  autoSend: PropTypes.bool,
  showNoiseLevel: PropTypes.bool,
  onSetRecording: PropTypes.func,
};

export default AudioRecorder;
