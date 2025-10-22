const { v2: speech } = require('@google-cloud/speech');
const fs = require('fs');
const os = require('os');
const path = require('path');
const config = require('../config/config');

let speechClient;
let recognizerPromise;
let explicitCredentials;
let explicitCredentialsChecked = false;

function normalisePrivateKey(key) {
    if (typeof key !== 'string') return key;
    return key.includes('\\n') ? key.replace(/\\n/g, '\n') : key;
}

function buildCredentialResponse(raw, source) {
    if (!raw || typeof raw !== 'object') {
        console.error(`[Speech] Ignoring malformed credentials from ${source || 'unknown source'}. Expected JSON object.`);
        return null;
    }

    const clientEmail = raw.client_email;
    const privateKey = normalisePrivateKey(raw.private_key);

    if (!clientEmail || !privateKey) {
        console.error('[Speech] Service account JSON is missing client_email or private_key.');
        return null;
    }

    return {
        credentials: {
            client_email: clientEmail,
            private_key: privateKey,
        },
        projectId: raw.project_id,
        source: source || 'environment',
    };
}

function tryParseJson(value, sourceLabel) {
    if (!value) return null;
    try {
        return JSON.parse(value);
    } catch (err) {
        console.error(`[Speech] Failed to parse JSON credentials from ${sourceLabel}:`, err?.message || err);
        return null;
    }
}

function resolveCredentialFilePath(candidatePath) {
    if (!candidatePath || typeof candidatePath !== 'string') return null;

    const expanded = candidatePath.startsWith('~')
        ? path.join(os.homedir(), candidatePath.slice(1))
        : candidatePath;

    const attempts = new Set([
        expanded,
        path.resolve(expanded),
    ]);

    // Add potential "latest" suffixes (for secret manager mounts)
    Array.from(attempts).forEach((attempt) => {
        attempts.add(path.join(attempt, 'latest'));
        if (attempt.endsWith('latest')) {
            attempts.add(attempt);
        }
    });

    for (const attempt of attempts) {
        try {
            const stat = fs.statSync(attempt);
            if (stat.isFile()) {
                return attempt;
            }
            if (stat.isDirectory()) {
                const latestPath = path.join(attempt, 'latest');
                if (fs.existsSync(latestPath) && fs.statSync(latestPath).isFile()) {
                    return latestPath;
                }
            }
        } catch {
            // Ignore missing paths
        }
    }

    return null;
}

function loadExplicitCredentials() {
    // Base64-encoded credentials (prefer explicit speech-specific variables)
    const base64Candidates = [
        { value: process.env.GOOGLE_SPEECH_CREDENTIALS_BASE64, source: 'GOOGLE_SPEECH_CREDENTIALS_BASE64' },
        { value: process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64, source: 'GOOGLE_APPLICATION_CREDENTIALS_BASE64' },
    ];

    for (const { value, source } of base64Candidates) {
        if (!value) continue;
        try {
            const decoded = Buffer.from(value.trim(), 'base64').toString('utf8');
            const parsed = tryParseJson(decoded, source);
            if (parsed) {
                const result = buildCredentialResponse(parsed, source);
                if (result) return result;
            }
        } catch (err) {
            console.error(`[Speech] Failed to decode base64 credentials from ${source}:`, err?.message || err);
        }
    }

    // Plain JSON stored directly in an env variable
    const jsonCandidates = [
        { value: process.env.GOOGLE_SPEECH_CREDENTIALS_JSON, source: 'GOOGLE_SPEECH_CREDENTIALS_JSON' },
        { value: process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON, source: 'GOOGLE_APPLICATION_CREDENTIALS_JSON' },
        { value: process.env.GOOGLE_CLOUD_KEYFILE_CONTENT, source: 'GOOGLE_CLOUD_KEYFILE_CONTENT' },
    ];

    for (const { value, source } of jsonCandidates) {
        if (!value) continue;
        const parsed = tryParseJson(value, source);
        if (parsed) {
            const result = buildCredentialResponse(parsed, source);
            if (result) return result;
        }
    }

    // Fall back to GOOGLE_APPLICATION_CREDENTIALS path (or speech-specific override)
    const pathCandidates = [
        { value: process.env.GOOGLE_SPEECH_CREDENTIALS_PATH, source: 'GOOGLE_SPEECH_CREDENTIALS_PATH' },
        { value: process.env.GOOGLE_APPLICATION_CREDENTIALS, source: 'GOOGLE_APPLICATION_CREDENTIALS' },
    ];

    for (const { value, source } of pathCandidates) {
        if (!value) continue;
        const resolvedPath = resolveCredentialFilePath(value.trim());
        if (!resolvedPath) {
            console.warn(`[Speech] Credentials path ${value} not found or unreadable.`);
            continue;
        }
        try {
            const fileContents = fs.readFileSync(resolvedPath, 'utf8');
            const parsed = tryParseJson(fileContents, `${source} (${resolvedPath})`);
            if (parsed) {
                const result = buildCredentialResponse(parsed, `${source} (${resolvedPath})`);
                if (result) {
                    // Update environment to the resolved path so downstream libraries can use it.
                    process.env.GOOGLE_APPLICATION_CREDENTIALS = resolvedPath;
                    return result;
                }
            }
        } catch (err) {
            console.error(`[Speech] Failed to read credentials file at ${resolvedPath}:`, err?.message || err);
        }
    }

    return null;
}

function getExplicitCredentials() {
    if (explicitCredentialsChecked) {
        return explicitCredentials;
    }
    explicitCredentialsChecked = true;
    explicitCredentials = loadExplicitCredentials();

    if (explicitCredentials) {
        console.log(`[Speech] Loaded explicit Google credentials from ${explicitCredentials.source}.`);
        if (!process.env.GOOGLE_CLOUD_PROJECT && explicitCredentials.projectId) {
            process.env.GOOGLE_CLOUD_PROJECT = explicitCredentials.projectId;
        }
    } else {
        console.log('[Speech] Using Application Default Credentials for Google Speech API.');
    }

    return explicitCredentials;
}

function getSpeechClient() {
    if (!config.googleSpeechRecognizer) {
        throw new Error('GOOGLE_SPEECH_RECOGNIZER is not configured.');
    }

    if (!speechClient) {
        const clientConfig = {
            apiEndpoint: config.googleSpeechEndpoint || 'us-speech.googleapis.com',
        };

        const explicit = getExplicitCredentials();
        if (explicit) {
            clientConfig.credentials = explicit.credentials;
            if (explicit.projectId) {
                clientConfig.projectId = explicit.projectId;
            }
        }

        console.log('[Speech] Initializing SpeechClient with config:', {
            apiEndpoint: clientConfig.apiEndpoint,
            hasExplicitCredentials: !!explicit,
            projectId: clientConfig.projectId || '(unset)',
        });

        speechClient = new speech.SpeechClient(clientConfig);
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
                console.log('[Speech] Using fully-qualified recognizer from config:', raw);
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
            console.log('[Speech] Resolving recognizer name:', {
                providedValue: raw,
                resolvedProjectId: projectId || '(unknown)',
                region: config.googleSpeechRegion || 'us',
                endpoint: config.googleSpeechEndpoint || 'us-speech.googleapis.com',
            });
            if (!projectId) {
                throw new Error(
                    'Unable to determine Google Cloud project. Provide a full recognizer resource name or set GOOGLE_CLOUD_PROJECT.',
                );
            }

            const region = config.googleSpeechRegion || 'us';
            const resolved = `projects/${projectId}/locations/${region}/recognizers/${raw}`;
            console.log('[Speech] Computed recognizer resource:', resolved);
            return resolved;
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

            console.log('[Speech] Starting streaming session with recognizer:', recognizer, {
                interimResults: streamingFeatures.interimResults,
                enableVoiceActivityEvents: streamingFeatures.enableVoiceActivityEvents || false,
                voiceActivityTimeout: streamingFeatures.voiceActivityTimeout || null,
                model: recognitionConfig.model,
                languageCodes: recognitionConfig.languageCodes,
                endpoint: config.googleSpeechEndpoint || 'us-speech.googleapis.com',
            });

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
