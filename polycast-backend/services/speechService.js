// Uncomment Azure SDK import
const sdk = require('microsoft-cognitiveservices-speech-sdk');

// Comment out AssemblyAI SDK import
// const { AssemblyAI } = require('assemblyai');

const config = require('../config/config'); // Load API keys

// Comment out AssemblyAI transcriber map
// const clientTranscribers = new Map();

// === AZURE CODE (Uncommented) ===

const clientRecognizers = new Map();

function createRecognizerForClient(ws, onRecognizing, onRecognized, onError) {
    if (!config.azureSpeechKey || !config.azureSpeechRegion) {
        throw new Error('Azure Speech Key or Region is not configured in .env');
    }

    const speechConfig = sdk.SpeechConfig.fromSubscription(config.azureSpeechKey, config.azureSpeechRegion);
    speechConfig.speechRecognitionLanguage = 'en-US'; // Set language

    // Add segmentation properties
    speechConfig.setProperty(sdk.PropertyId.SpeechServiceResponse_RequestSentenceBoundary, "true");
    // Set timeout back to a reasonable default for Azure
    speechConfig.setProperty(sdk.PropertyId.Speech_SegmentationSilenceTimeoutMs, "700"); 
    console.log('[SpeechService] Configured sentence boundary detection and 700ms silence timeout.');

    // Disable profanity masking (keep this setting)
    speechConfig.setProfanity(sdk.ProfanityOption.Raw);
    console.log('[SpeechService] Profanity masking disabled (set to Raw).');

    const pushStream = sdk.AudioInputStream.createPushStream();
    const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);
    const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

    console.log(`[SpeechService] Azure Recognizer created for client.`);

    // Setup event handlers for Azure Recognizer
    recognizer.recognizing = (s, e) => {
        if (e.result.reason === sdk.ResultReason.RecognizingSpeech) {
            onRecognizing(ws, e.result.text);
        }
    };
    recognizer.recognized = (s, e) => {
        if (e.result.reason === sdk.ResultReason.RecognizedSpeech) {
            console.log(`[SpeechService] Recognized: "${e.result.text}"`);
            onRecognized(ws, e.result); // Pass the full Azure result object
        } else if (e.result.reason === sdk.ResultReason.NoMatch) {
            console.log("[SpeechService] NOMATCH: Speech could not be recognized.");
        }
    };
    recognizer.canceled = (s, e) => {
        console.error(`[SpeechService] CANCELED: Reason=${e.reason}`);
        if (e.reason === sdk.CancellationReason.Error) {
             console.error(`[SpeechService] CANCELED: ErrorCode=${e.errorCode}`);
             console.error(`[SpeechService] CANCELED: ErrorDetails=${e.errorDetails}`);
             onError(ws, `Speech recognition canceled: ${e.errorDetails}`);
        }
        stopRecognitionForClient(ws);
    };
    recognizer.sessionStopped = (s, e) => {
        console.log("[SpeechService] Session stopped.");
        stopRecognitionForClient(ws);
    };

    clientRecognizers.set(ws, { recognizer, pushStream });
    return { recognizer, pushStream };
}

function startRecognitionForClient(ws, onRecognizing, onRecognized, onError) {
    console.log('[SpeechService] Starting Azure recognition for client...');
    try {
        const recognizerData = createRecognizerForClient(ws, onRecognizing, onRecognized, onError);
        recognizerData.recognizer.startContinuousRecognitionAsync(
            () => console.log('[SpeechService] Azure Continuous recognition started.'),
            (err) => {
                console.error(`[SpeechService] Error starting Azure recognition: ${err}`);
                onError(ws, `Error starting Azure recognition: ${err}`);
                stopRecognitionForClient(ws);
            }
        );
        // Note: Azure start is async fire-and-forget, errors handled by callbacks
        // Unlike AssemblyAI, we don't necessarily await connection here.
    } catch (error) {
        console.error('[SpeechService] Failed to create Azure recognizer:', error.message);
        onError(ws, `Failed to create Azure speech recognizer: ${error.message}`);
        throw error; // Re-throw error
    }
}

function pushAudioChunkForClient(ws, audioChunk) {
    const clientData = clientRecognizers.get(ws);
    if (clientData && clientData.pushStream) {
        clientData.pushStream.write(audioChunk);
    } else {
        // console.warn('[SpeechService] Azure: Attempted to push chunk for non-existent or stopped recognizer.');
    }
}

function stopRecognitionForClient(ws) {
    const clientData = clientRecognizers.get(ws);
    if (clientData) {
        console.log('[SpeechService] Azure: Stopping recognition and cleaning up for client...');
        clientRecognizers.delete(ws); // Remove first
        if (clientData.recognizer) {
            clientData.recognizer.stopContinuousRecognitionAsync(
                () => console.log('[SpeechService] Azure: Recognizer stopped.'),
                (err) => console.error(`[SpeechService] Azure: Error stopping recognizer: ${err}`)
            );
             clientData.recognizer.close(); 
             console.log('[SpeechService] Azure: Recognizer closed.');
        }
        if (clientData.pushStream) {
            clientData.pushStream.close();
            console.log('[SpeechService] Azure: Push stream closed.');
        }
        console.log(`[SpeechService] Azure: Client data removed. Active clients: ${clientRecognizers.size}`);
    } else {
        // console.log('[SpeechService] Azure: Stop requested for client with no active recognizer.');
    }
}

// === END AZURE CODE ===

// === ASSEMBLYAI IMPLEMENTATION (Commented Out) ===
/*
async function connectAssemblyAiForClient(ws, onRecognizing, onRecognized, onError) { ... }
async function startRecognitionForClient(ws, onRecognizing, onRecognized, onError) { ... }
function pushAudioChunkForClient(ws, audioChunk) { ... }
async function stopRecognitionForClient(ws) { ... }
*/
// === END ASSEMBLYAI IMPLEMENTATION ===

module.exports = {
    startRecognitionForClient,
    stopRecognitionForClient,
    pushAudioChunkForClient,
}; 