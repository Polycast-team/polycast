/**
 * OpenAI Realtime Voice Service - Python-Style Push-to-Talk
 * Based exactly on the working Python patterns
 */

export interface VoiceSessionConfig {
  voice: string;
  instructions: string;
  inputAudioFormat: string;
  outputAudioFormat: string;
  deviceId?: string; // Optional audio input device ID
}

interface VoiceMessage {
  type: string;
  event_id?: string;
  session?: any;
  item?: any;
  delta?: any;
  transcript?: string;
  audio?: string;
  error?: any;
}

export class OpenAIVoiceSession {
  private ws: WebSocket | null = null;
  private isConnected = false;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private audioProcessor: ScriptProcessorNode | AudioWorkletNode | null = null;
  private isRecording = false;  // Like spacebar_pressed in Python
  private isAIResponding = false;
  private lastAudioSendTime = 0;
  private audioBuffer: ArrayBuffer[] = []; // Accumulate audio chunks
  private responseTimeout: NodeJS.Timeout | null = null;
  private responseStartTime: number = 0;
  private justInterrupted: boolean = false; // Flag to prevent immediate response after interrupt
  private ignoreAudioUntil: number = 0; // Timestamp to ignore audio deltas after interrupt
  private actualSampleRate: number = 48000; // Store actual microphone sample rate

  // Callbacks
  onTranscriptUpdate: (transcript: string, isComplete: boolean) => void = () => {};
  onUserTranscriptUpdate: (transcript: string) => void = () => {};
  onAudioData: (audioData: Float32Array) => void = () => {};
  onConnectionChange: (connected: boolean) => void = () => {};
  onRecordingStateChange: (isRecording: boolean) => void = () => {};
  onError: (error: string) => void = () => {};

  async connect(config: VoiceSessionConfig): Promise<void> {
    try {
      // Store config for later use
      this.config = config;
      
      // Connect to the OpenAI proxy on the backend service
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const backendHost = 'polycast-server.onrender.com';
      const url = `${protocol}//${backendHost}/openai-proxy`;
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log('Connected to OpenAI Realtime API proxy');
        this.isConnected = true;
        
        // Wait for session.created before sending config
        this.onConnectionChange(true);
        this.initializeAudio().catch(console.error);
      };

      this.ws.onmessage = (event) => {
        if (typeof event.data === 'string') {
          try {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Error parsing JSON message:', error);
          }
        }
      };

      this.ws.onclose = () => {
        console.log('Disconnected from OpenAI Realtime API');
        this.isConnected = false;
        this.cleanup();
        this.onConnectionChange(false);
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.onError('Connection error');
      };

    } catch (error) {
      console.error('Failed to connect:', error);
      this.onError('Failed to connect to OpenAI');
    }
  }

  private async initializeAudio(): Promise<void> {
    try {
      console.log('🎤 Initializing audio (NEW: Backend Processing Mode)...');
      
      // Simplified audio setup - backend handles all processing
      const audioConstraints: MediaTrackConstraints = {
        sampleRate: 48000, // Use device's preferred rate
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: false,
        autoGainControl: false
      };
      
      // Add device ID if specified
      if (this.config?.deviceId) {
        audioConstraints.deviceId = { exact: this.config.deviceId };
        console.log('🎤 Using specific audio device:', this.config.deviceId);
      }
      
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ 
        audio: audioConstraints
      });

      console.log('🎤 Microphone access granted');
      
      // Get actual settings - store for backend communication
      const audioTrack = this.mediaStream.getAudioTracks()[0];
      const settings = audioTrack.getSettings();
      this.actualSampleRate = settings.sampleRate || 48000;
      
      console.log('🔧 MediaStream Settings:');
      console.log('  - Sample Rate:', settings.sampleRate, 'Hz');
      console.log('  - Channel Count:', settings.channelCount);
      console.log('  - Echo Cancellation:', settings.echoCancellation);
      
      // Create AudioContext to match media stream (no forced resampling)
      this.audioContext = new AudioContext({ sampleRate: this.actualSampleRate });
      
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      
      console.log('🔧 AudioContext Settings:');
      console.log('  - Sample Rate:', this.audioContext.sampleRate, 'Hz');
      console.log('  - State:', this.audioContext.state);
      console.log('  - ✅ Raw audio will be sent to backend for processing');
      
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      
      // Use ScriptProcessorNode for simpler, more reliable audio capture
      const bufferSize = 4096;
      const scriptProcessor = this.audioContext.createScriptProcessor(bufferSize, 1, 1);
      this.audioProcessor = scriptProcessor;
      
      scriptProcessor.onaudioprocess = (event) => {
        // Python-style: accumulate audio while recording, send only on release
        if (this.isRecording && !this.isAIResponding) {
          const inputData = event.inputBuffer.getChannelData(0);
          
          // DEBUG: Check audio data statistics
          let minValue = Infinity;
          let maxValue = -Infinity;
          let hasAudio = false;
          let nonZeroSamples = 0;
          
          for (let i = 0; i < inputData.length; i++) {
            const sample = inputData[i];
            if (Math.abs(sample) > 0.005) {
              hasAudio = true;
              nonZeroSamples++;
            }
            minValue = Math.min(minValue, sample);
            maxValue = Math.max(maxValue, sample);
          }
          
          if (hasAudio) {
            // NEW: Just store raw audio data - backend will handle all processing
            const rawAudioArray = Array.from(inputData);
            this.audioBuffer.push(rawAudioArray as any); // Store as any for compatibility
            
            // DEBUG: Log audio statistics for first chunk
            if (this.audioBuffer.length === 1) {
              console.log('🎤 Recording raw audio - backend will process...');
              console.log('🔧 Raw Audio Debug:');
              console.log('  - Buffer Size:', inputData.length, 'samples');
              console.log('  - Sample Rate:', this.actualSampleRate, 'Hz');
              console.log('  - Non-zero samples:', nonZeroSamples);
              console.log('  - Min value:', minValue.toFixed(6));
              console.log('  - Max value:', maxValue.toFixed(6));
              console.log('  - ✅ Raw Float32 data - backend will resample to 24kHz and convert to PCM16');
            }
          }
        }
      };

      source.connect(scriptProcessor);
      scriptProcessor.connect(this.audioContext.destination);
      console.log('✅ Audio initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize audio:', error);
      throw error;
    }
  }

  private float32ToPCM16(float32Array: Float32Array): ArrayBuffer {
    const pcm16 = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(pcm16);
    
    // DEBUG: Track conversion statistics
    let clippedSamples = 0;
    let minInt16 = Infinity;
    let maxInt16 = -Infinity;
    
    for (let i = 0; i < float32Array.length; i++) {
      const originalSample = float32Array[i];
      const sample = Math.max(-1, Math.min(1, originalSample));
      
      if (originalSample !== sample) {
        clippedSamples++;
      }
      
      const int16Value = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      const roundedValue = Math.round(int16Value);
      
      minInt16 = Math.min(minInt16, roundedValue);
      maxInt16 = Math.max(maxInt16, roundedValue);
      
      view.setInt16(i * 2, roundedValue, true);
    }
    
    // DEBUG: Log conversion statistics occasionally
    if (this.audioBuffer.length === 0) { // Only for first conversion
      console.log('🔧 PCM16 Conversion DEBUG:');
      console.log('  - Input samples:', float32Array.length);
      console.log('  - Output bytes:', pcm16.byteLength);
      console.log('  - Clipped samples:', clippedSamples);
      console.log('  - Int16 range:', minInt16, 'to', maxInt16);
    }
    
    return pcm16;
  }

  private pcm16ToFloat32(pcm16: ArrayBuffer): Float32Array {
    const view = new DataView(pcm16);
    const float32 = new Float32Array(pcm16.byteLength / 2);
    for (let i = 0; i < float32.length; i++) {
      const int16 = view.getInt16(i * 2, true);
      float32[i] = int16 < 0 ? int16 / 0x8000 : int16 / 0x7FFF;
    }
    return float32;
  }

  private resampleAudio(inputBuffer: Float32Array, inputSampleRate: number, outputSampleRate: number): Float32Array {
    if (inputSampleRate === outputSampleRate) {
      return inputBuffer;
    }
    
    const ratio = inputSampleRate / outputSampleRate;
    const outputLength = Math.round(inputBuffer.length / ratio);
    const output = new Float32Array(outputLength);
    
    // Simple linear interpolation resampling
    for (let i = 0; i < outputLength; i++) {
      const sourceIndex = i * ratio;
      const index = Math.floor(sourceIndex);
      const fraction = sourceIndex - index;
      
      if (index + 1 < inputBuffer.length) {
        // Linear interpolation between samples
        output[i] = inputBuffer[index] * (1 - fraction) + inputBuffer[index + 1] * fraction;
      } else {
        // Use last sample if we're at the end
        output[i] = inputBuffer[inputBuffer.length - 1];
      }
    }
    
    return output;
  }

  private config: VoiceSessionConfig | null = null;

  private handleMessage(message: VoiceMessage): void {
    const eventType = message.type;
    
    // Filter out transcript deltas for cleaner logs
    if (!['response.audio_transcript.delta'].includes(eventType)) {
      console.log('Received message:', eventType);
    }
    
    switch (eventType) {
      case 'session.created':
        console.log('✅ Session created, now sending configuration...');
        if (this.config) {
          // Send session config AFTER session is created
          const sessionConfig = {
            type: 'session.update',
            session: {
              modalities: ['audio', 'text'],
              instructions: this.config.instructions,
              voice: this.config.voice,
              input_audio_format: this.config.inputAudioFormat,
              output_audio_format: this.config.outputAudioFormat,
              // EXPLICITLY set turn_detection to null to disable automatic responses
              turn_detection: null,
              // Enable input transcription so we can see what user said
              input_audio_transcription: {
                model: 'whisper-1'
              }
            }
          };
          
          console.log('📤 Sending session config:', JSON.stringify(sessionConfig, null, 2));
          this.sendMessage(sessionConfig);
        }
        break;

      case 'session.updated':
        console.log('✅ Session updated successfully - manual control enabled');
        break;

      case 'response.audio.delta':
        // Ignore audio deltas completely after interrupt to let cancel take effect
        if (Date.now() < this.ignoreAudioUntil) {
          console.log('🔇 Ignoring audio delta after interrupt');
          break;
        }
        
        if (!this.isAIResponding) {
          console.log('🤖 AI started speaking');
          this.isAIResponding = true;
        }
        
        if (message.delta) {
          try {
            const audioData = this.base64ToArrayBuffer(message.delta);
            const float32Audio = this.pcm16ToFloat32(audioData);
            this.onAudioData(float32Audio);
          } catch (error) {
            console.error('Error processing audio delta:', error);
          }
        }
        break;

      case 'response.audio.done':
        // Ignore audio.done messages during interrupt period
        if (Date.now() < this.ignoreAudioUntil) {
          console.log('🔇 Ignoring audio.done after interrupt');
          break;
        }
        
        console.log('🔵 AI finished speaking');
        this.isAIResponding = false;
        break;

      case 'response.created':
        console.log('🤖 Response generation started...');
        this.responseStartTime = Date.now();
        
        // Set a timeout to detect if response gets stuck
        this.responseTimeout = setTimeout(() => {
          console.error('⚠️ Response timeout detected! No content received within 15 seconds.');
          console.log('🔄 Attempting to recover...');
          this.handleStuckResponse();
        }, 15000); // 15 second timeout
        break;

      case 'response.output_item.added':
        // Clear timeout since we got actual response content
        if (this.responseTimeout) {
          clearTimeout(this.responseTimeout);
          this.responseTimeout = null;
        }
        break;

      case 'response.done':
        console.log('🔵 Response complete');
        this.isAIResponding = false;
        this.justInterrupted = false; // Reset interrupt flag on successful completion
        this.ignoreAudioUntil = 0; // Reset audio ignore flag
        
        // Clear timeout since response completed
        if (this.responseTimeout) {
          clearTimeout(this.responseTimeout);
          this.responseTimeout = null;
        }
        break;

      case 'response.audio_transcript.delta':
        // Ignore transcript deltas during interrupt period
        if (Date.now() < this.ignoreAudioUntil) {
          console.log('🔇 Ignoring transcript delta after interrupt');
          break;
        }
        
        if (message.delta) {
          this.onTranscriptUpdate(message.delta, false);
        }
        break;

      case 'response.audio_transcript.done':
        // Ignore transcript done during interrupt period
        if (Date.now() < this.ignoreAudioUntil) {
          console.log('🔇 Ignoring transcript done after interrupt');
          break;
        }
        
        if (message.transcript) {
          console.log('🤖 =================== AI SAID ===================');
          console.log('🤖 AI Response:', message.transcript);
          console.log('🤖 ===============================================');
          this.onTranscriptUpdate(message.transcript, true);
        }
        break;

      case 'input_audio_buffer.committed':
        console.log('✅ Audio buffer committed - user speech captured');
        console.log('📤 Expecting user transcription to start...');
        break;

      case 'input_audio_buffer.cleared':
        console.log('🗑️ Audio buffer cleared - ready for new speech');
        break;

      case 'input_audio_buffer.speech_started':
        console.log('🚨 WARNING: input_audio_buffer.speech_started detected!');
        console.log('🚨 This means turn detection is STILL ACTIVE despite setting it to null!');
        break;

      case 'input_audio_buffer.speech_stopped':
        console.log('🚨 WARNING: input_audio_buffer.speech_stopped detected!');
        console.log('🚨 Turn detection is causing automatic responses!');
        break;

      case 'conversation.item.input_audio_transcription.completed':
        if (message.transcript) {
          console.log('👤 ================= USER SAID =================');
          console.log('👤 User Speech:', message.transcript);
          console.log('👤 ==========================================');
          this.onUserTranscriptUpdate(message.transcript);
        } else {
          console.log('⚠️ User transcription completed but no transcript provided');
          // Still update with empty transcript to replace placeholder
          this.onUserTranscriptUpdate('(No speech detected)');
        }
        break;

      case 'conversation.item.input_audio_transcription.failed':
        console.log('❌ User speech transcription failed:', message);
        // Replace placeholder with error message
        this.onUserTranscriptUpdate('(Speech transcription failed)');
        break;

      case 'error':
        console.error('OpenAI error:', message.error);
        this.onError(message.error?.message || 'Unknown error');
        break;

      default:
        // Ignore speech_started/speech_stopped - we control manually
        break;
    }
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  sendMessage(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  // PYTHON-STYLE METHODS - spacebar press/release
  startRecording(): void {
    if (!this.isConnected) {
      console.warn('Cannot start recording, not connected');
      return;
    }
    
    console.log('🎤 SPACEBAR PRESSED - Push-to-talk ACTIVE (NEW: Raw Audio Mode)');
    
    // NEW: Clear raw audio buffer
    this.sendMessage({
      type: 'raw_audio_clear'
    });
    
    // Clear our local audio accumulation buffer
    this.audioBuffer = [];
    
    // Start accepting/accumulating raw audio
    this.isRecording = true;
    this.onRecordingStateChange(true);
    this.isAIResponding = false;
    this.lastAudioSendTime = 0;
  }

  stopRecording(): void {
    if (!this.isRecording) {
      return;
    }
    
    console.log('🎤 SPACEBAR RELEASED - Processing accumulated audio');
    this.isRecording = false;
    this.onRecordingStateChange(false);
    
    if (this.justInterrupted) {
      // After an interrupt, we need to wait for the system to stabilize
      console.log('🔄 Just interrupted AI - waiting for system to stabilize before sending new audio');
      this.justInterrupted = false;
      
      // Give a short delay to let the interrupt settle, then send the new audio
      setTimeout(() => {
        this.processAccumulatedAudio();
      }, 500); // 500ms delay to let interrupt complete
      
    } else {
      // Normal case - send audio immediately
      this.processAccumulatedAudio();
    }
  }

  private processAccumulatedAudio(): void {
    if (this.isConnected && !this.isAIResponding && this.audioBuffer.length > 0) {
      console.log('📤 Sending raw audio to backend for processing...');
      
      // Calculate total raw audio statistics
      let totalSamples = 0;
      for (const chunk of this.audioBuffer) {
        totalSamples += (chunk as any).length; // Raw audio arrays
      }
      
      const durationMs = (totalSamples / this.actualSampleRate * 1000);
      
      console.log('🔧 Raw Audio Statistics:');
      console.log('  - Total chunks:', this.audioBuffer.length);
      console.log('  - Total samples:', totalSamples);
      console.log('  - Duration (ms):', durationMs.toFixed(2));
      console.log('  - Sample rate:', this.actualSampleRate, 'Hz');
      console.log('  - ✅ Backend will resample to 24kHz and convert to PCM16');
      
      // Immediately add placeholder for user speech to maintain conversation order
      this.onUserTranscriptUpdate("Processing your speech...");
      
      // NEW: Send raw audio chunks to backend
      console.log(`📤 Sending ${this.audioBuffer.length} raw audio chunks to backend`);
      
      for (let i = 0; i < this.audioBuffer.length; i++) {
        const rawAudioData = this.audioBuffer[i] as any; // Raw Float32 array
        
        // DEBUG: Log raw audio info for first chunk
        if (i === 0) {
          console.log('🔧 Raw Audio DEBUG (first chunk):');
          console.log('  - Samples:', rawAudioData.length);
          console.log('  - Sample rate:', this.actualSampleRate, 'Hz');
          console.log('  - Duration (ms):', (rawAudioData.length / this.actualSampleRate * 1000).toFixed(2));
        }
        
        // NEW: Send raw audio to backend
        this.sendMessage({
          type: 'raw_audio_chunk',
          audioData: rawAudioData,
          sampleRate: this.actualSampleRate
        });
      }
      
      // NEW: Commit raw audio (backend will process and send to OpenAI)
      this.sendMessage({
        type: 'raw_audio_commit'
      });
      
      // Manually create response
      this.sendMessage({
        type: 'response.create'
      });
      
      // Clear the buffer after sending
      this.audioBuffer = [];
    } else if (this.audioBuffer.length === 0) {
      console.log('⚠️ No audio accumulated to send');
    } else if (this.isAIResponding) {
      console.log('⚠️ AI still responding, not sending new audio');
    }
  }

  interruptAI(): void {
    if (this.isConnected && this.isAIResponding) {
      console.log('🛑 Interrupting AI response');
      
      // Set flag to ignore incoming audio for 2 seconds to let cancel take effect
      this.ignoreAudioUntil = Date.now() + 2000;
      
      // Clear any existing timeout
      if (this.responseTimeout) {
        clearTimeout(this.responseTimeout);
        this.responseTimeout = null;
      }
      
      // Send multiple cancel commands to be sure
      this.sendMessage({
        type: 'response.cancel'
      });
      
      // Wait a bit then send another cancel in case the first was missed
      setTimeout(() => {
        if (this.isAIResponding) {
          console.log('🔄 Sending backup cancel command');
          this.sendMessage({
            type: 'response.cancel'
          });
        }
      }, 100);
      
      // Reset AI state immediately
      this.isAIResponding = false;
      this.justInterrupted = true;
      
      // Clear the audio buffer and start fresh recording
      this.sendMessage({
        type: 'input_audio_buffer.clear'
      });
      
      // Start recording for new user input
      this.isRecording = true;
      this.onRecordingStateChange(true);
      this.audioBuffer = [];
      
      console.log('✅ Interrupt complete, recording new input...');
    }
  }

  private handleStuckResponse(): void {
    console.log('🔧 Handling stuck response...');
    
    // Clear the timeout
    if (this.responseTimeout) {
      clearTimeout(this.responseTimeout);
      this.responseTimeout = null;
    }
    
    // Reset AI state
    this.isAIResponding = false;
    this.justInterrupted = false; // Reset interrupt flag during recovery
    this.ignoreAudioUntil = 0; // Reset audio ignore flag
    
    // Try to cancel any stuck response
    this.sendMessage({
      type: 'response.cancel'
    });
    
    // Clear audio buffer to start fresh
    this.sendMessage({
      type: 'input_audio_buffer.clear'
    });
    
    // Notify user of the issue
    this.onError('Response timed out. Please try speaking again.');
    
    console.log('✅ Recovery attempt completed. Ready for new input.');
  }

  private cleanup(): void {
    this.isRecording = false;
    this.onRecordingStateChange(false);
    this.isAIResponding = false;
    this.justInterrupted = false;
    this.ignoreAudioUntil = 0;
    
    // Clear any pending timeout
    if (this.responseTimeout) {
      clearTimeout(this.responseTimeout);
      this.responseTimeout = null;
    }
    
    if (this.audioProcessor) {
      this.audioProcessor.disconnect();
      this.audioProcessor = null;
    }
    
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.cleanup();
  }

  get connected(): boolean {
    return this.isConnected;
  }
}