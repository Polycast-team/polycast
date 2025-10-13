const { v2: speech } = require('@google-cloud/speech');
const config = require('../config/config');

let speechClient;
let recognizerPromise;

function getSpeechClient() {
    if (!config.googleSpeechRecognizer) {
        throw new Error('GOOGLE_SPEECH_RECOGNIZER is not configured.');
    }

    if (!speechClient) {
        speechClient = new speech.SpeechClient({
            apiEndpoint: config.googleSpeechEndpoint || 'us-speech.googleapis.com',
        });
    }
    return speechClient;
}

async function resolveRecognizerName() {
    if (!recognizerPromise) {
        recognizerPromise = (async () => {
            const raw = config.googleSpeechRecognizer;
            if (!raw) {
                throw new Error('GOOGLE_SPEECH_RECOGNIZER environment variable is required.');
            }

            if (raw.startsWith('projects/')) {
                return raw;
            }

            const envProject =
                process.env.GOOGLE_CLOUD_PROJECT ||
                process.env.GCLOUD_PROJECT ||
                process.env.GCP_PROJECT ||
                process.env.GCP_PROJECT_ID ||
                null;

            const client = getSpeechClient();
            const projectId = envProject || await client.getProjectId().catch(() => null);
            if (!projectId) {
                throw new Error(
                    'Unable to determine Google Cloud project. Provide a full recognizer resource name or set GOOGLE_CLOUD_PROJECT.',
                );
            }

            const region = config.googleSpeechRegion || 'us';
            return `projects/${projectId}/locations/${region}/recognizers/${raw}`;
        })();
    }
    return recognizerPromise;
}

function buildRecognitionConfig(options = {}) {
    const languageCodes = Array.isArray(options.languageCodes) && options.languageCodes.length
        ? options.languageCodes
        : ['en-US'];

    const features = {
        enableAutomaticPunctuation: true,
        ...(options.features || {}),
    };

    const configPayload = {
        model: options.model || 'chirp_3',
        languageCodes,
        explicitDecodingConfig: {
            encoding: 'LINEAR16',
            sampleRateHertz: options.sampleRateHertz || 16000,
            audioChannelCount: options.audioChannelCount || 1,
        },
        features,
    };

    if (options.transcriptNormalization) {
        configPayload.transcriptNormalization = options.transcriptNormalization;
    }

    if (options.adaptation) {
        configPayload.adaptation = options.adaptation;
    }

    if (options.translationConfig) {
        configPayload.translationConfig = options.translationConfig;
    }

    if (options.denoiserConfig) {
        configPayload.denoiserConfig = options.denoiserConfig;
    }

    return configPayload;
}

async function transcribeAudio(audioBuffer, _filename = 'audio.wav', options = {}) {
    if (!audioBuffer || !audioBuffer.length) {
        throw new Error('Audio buffer is empty or invalid.');
    }

    const client = getSpeechClient();
    const recognizer = await resolveRecognizerName();
    const recognitionConfig = buildRecognitionConfig(options);

    const request = {
        recognizer,
        config: recognitionConfig,
        audio: {
            content: audioBuffer,
        },
    };

    const callOptions = {
        otherArgs: {
            headers: {
                'x-goog-request-params': `recognizer=${recognizer}`,
            },
        },
    };

    const [response] = await client.recognize(request, callOptions);
    const results = Array.isArray(response?.results) ? response.results : [];

    const transcripts = results
        .map((result) => result?.alternatives?.[0]?.transcript || '')
        .filter(Boolean);

    return transcripts.join(' ').trim();
}

function createStreamingSession(onTranscript, onError = () => {}, options = {}) {
    if (typeof onTranscript !== 'function') {
        throw new Error('onTranscript callback is required.');
    }

    const client = getSpeechClient();
    const pendingChunks = [];
    let stream = null;
    let ready = false;
    let closed = false;

    const session = {
        send: (audioChunk) => {
            if (closed || !audioChunk) return;
            const buffer = Buffer.isBuffer(audioChunk)
                ? audioChunk
                : Buffer.from(audioChunk);
            if (!buffer.length) return;

            if (ready && stream) {
                try {
                    stream.write({ audio: buffer });
                } catch (err) {
                    console.error('[Speech] Failed to write audio chunk:', err);
                }
            } else {
                pendingChunks.push(buffer);
            }
        },
        close: () => {
            closed = true;
            if (stream) {
                try {
                    stream.end();
                } catch (err) {
                    console.warn('[Speech] Error ending streaming session:', err);
                }
            }
        },
    };

    (async () => {
        try {
            const recognizer = await resolveRecognizerName();
            if (closed) return;

            const callOptions = {
                otherArgs: {
                    headers: {
                        'x-goog-request-params': `recognizer=${recognizer}`,
                    },
                },
            };

            stream = client.streamingRecognize(callOptions);

            stream.on('data', (response) => {
                try {
                    const results = Array.isArray(response?.results) ? response.results : [];
                    results.forEach((result) => {
                        const transcript = result?.alternatives?.[0]?.transcript || '';
                        if (!transcript.trim()) return;
                        const isInterim = !(result?.isFinal);
                        onTranscript(transcript, isInterim);
                    });
                } catch (err) {
                    console.error('[Speech] Error handling streaming response:', err);
                }
            });

            stream.on('error', (err) => {
                if (closed) return;
                closed = true;
                console.error('[Speech] Streaming error:', err);
                onError(err);
            });

            stream.on('end', () => {
                ready = false;
            });

            const recognitionConfig = buildRecognitionConfig(options);
            const streamingFeatures = {
                interimResults: options.interimResults !== undefined ? !!options.interimResults : true,
            };

            if (options.enableVoiceActivityEvents !== undefined) {
                streamingFeatures.enableVoiceActivityEvents = !!options.enableVoiceActivityEvents;
            }

            if (options.voiceActivityTimeout) {
                streamingFeatures.voiceActivityTimeout = options.voiceActivityTimeout;
            }

            const streamingConfig = {
                config: recognitionConfig,
                streamingFeatures,
            };

            if (options.configMask) {
                streamingConfig.configMask = options.configMask;
            }

            stream.write({
                recognizer,
                streamingConfig,
            });

            ready = true;
            while (pendingChunks.length && !closed) {
                const chunk = pendingChunks.shift();
                stream.write({ audio: chunk });
            }
        } catch (error) {
            console.error('[Speech] Failed to initialize streaming session:', error);
            onError(error);
        }
    })();

    return session;
}

module.exports = {
    transcribeAudio,
    createStreamingSession,
    getSpeechClient,
    resolveRecognizerName,
};
