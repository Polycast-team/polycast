const { createClient } = require('@deepgram/sdk');
const config = require('../config/config');

let deepgram = null;

/**
 * Initialize Deepgram client
 */
function initializeDeepgram() {
    if (!config.deepgramApiKey) {
        throw new Error('Deepgram API key is not configured.');
    }

    if (!deepgram) {
        deepgram = createClient(config.deepgramApiKey);
        console.log('Deepgram client initialized successfully.');
    }

    return deepgram;
}

/**
 * Transcribes audio data using the Deepgram Nova-2 API.
 * @param {Buffer} audioBuffer The audio data as a Buffer.
 * @param {string} [filename='audio.webm'] The filename to use for the request.
 * @param {Object} [options={}] Additional transcription options.
 * @returns {Promise<string>} The transcribed text.
 * @throws {Error} If the API call fails or returns an error.
 */
async function transcribeAudio(audioBuffer, filename = 'audio.webm', options = {}) {
    if (!audioBuffer || audioBuffer.length === 0) {
        throw new Error('Audio buffer is empty or invalid.');
    }

    const client = initializeDeepgram();

    console.log(`Sending ${audioBuffer.length} bytes to Deepgram Nova-3 API...`);

    try {
        // Determine MIME type from filename
        let mimeType = 'audio/webm';
        if (filename.endsWith('.wav')) mimeType = 'audio/wav';
        else if (filename.endsWith('.mp3')) mimeType = 'audio/mpeg';
        else if (filename.endsWith('.m4a')) mimeType = 'audio/mp4';
        else if (filename.endsWith('.ogg')) mimeType = 'audio/ogg';

        // Deepgram transcription options
        const transcriptionOptions = {
            model: 'nova-2', // Use Nova-2 model for high accuracy
            language: 'en', // Primary language
            smart_format: true, // Enable smart formatting (punctuation, etc.)
            punctuate: true, // Add punctuation
            utterances: false, // Don't split into utterances for real-time use
            detect_language: false, // Skip language detection for speed (we know it's English)
            filler_words: false, // Remove filler words for cleaner output
            profanity_filter: false, // Don't filter profanity
            redact: false, // Don't redact sensitive info
            diarize: false, // Don't do speaker diarization for single speaker
            paragraphs: false, // Don't split into paragraphs
            summarize: false, // Don't summarize
            ...options // Allow override of any option
        };

        console.log('Deepgram transcription options:', transcriptionOptions);

        // Call Deepgram prerecorded transcription API
        const response = await client.listen.prerecorded.transcribeFile(
            audioBuffer,
            transcriptionOptions
        );

        console.log('Deepgram API response status: SUCCESS');

        // Extract transcription from response
        if (response.result && response.result.results && response.result.results.channels) {
            const channel = response.result.results.channels[0];
            if (channel.alternatives && channel.alternatives.length > 0) {
                const transcript = channel.alternatives[0].transcript;

                if (transcript && transcript.trim()) {
                    console.log('Transcription received:', transcript);
                    return transcript.trim();
                } else {
                    console.warn('Deepgram returned empty transcript');
                    return '';
                }
            }
        }

        // Handle case where no transcription was generated
        console.warn('No transcription found in Deepgram response');
        return '';

    } catch (error) {
        console.error('Error calling Deepgram API:', error);

        // Handle specific Deepgram errors
        if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
            throw new Error('Deepgram API Error: Network connection failed');
        } else if (error.status === 401) {
            throw new Error('Deepgram API Error: Invalid API key');
        } else if (error.status === 400) {
            throw new Error('Deepgram API Error: Invalid audio format or parameters');
        } else if (error.status === 402) {
            throw new Error('Deepgram API Error: Insufficient credits');
        } else if (error.status === 429) {
            throw new Error('Deepgram API Error: Rate limit exceeded');
        }

        // Re-throw with a more specific error message if available
        const errorMessage = error.message || 'Failed to transcribe audio.';
        throw new Error(`Deepgram API Error: ${errorMessage}`);
    }
}

/**
 * Create a streaming transcription session (for real-time transcription)
 * @param {Function} onTranscript Callback for transcription results
 * @param {Function} onError Callback for errors
 * @param {Object} options Streaming options
 * @returns {Object} Streaming session object
 */
function createStreamingSession(onTranscript, onError, options = {}) {
    const client = initializeDeepgram();

    const streamingOptions = {
        model: 'nova-2',
        language: 'en',
        smart_format: true,
        punctuate: true,
        interim_results: true, // Get interim results for real-time feel
        endpointing: 300, // ms of silence before considering utterance complete
        utterance_end_ms: 1000, // ms of silence before finalizing utterance
        vad_events: true, // Voice activity detection events
        ...options
    };

    try {
        const connection = client.listen.live.transcription(streamingOptions);

        connection.on('open', () => {
            console.log('Deepgram streaming connection opened');
        });

        connection.on('Results', (data) => {
            const transcript = data.channel?.alternatives?.[0]?.transcript;
            if (transcript) {
                const isInterim = !data.is_final;
                onTranscript(transcript, isInterim);
            }
        });

        connection.on('error', (error) => {
            console.error('Deepgram streaming error:', error);
            onError(error);
        });

        connection.on('close', () => {
            console.log('Deepgram streaming connection closed');
        });

        return {
            send: (audioChunk) => {
                if (connection.getReadyState() === 1) {
                    connection.send(audioChunk);
                }
            },
            close: () => {
                connection.finish();
            }
        };

    } catch (error) {
        console.error('Error creating Deepgram streaming session:', error);
        throw new Error(`Failed to create streaming session: ${error.message}`);
    }
}

module.exports = {
    transcribeAudio,
    createStreamingSession,
    initializeDeepgram
};
