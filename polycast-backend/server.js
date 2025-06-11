/**
 * Simple proxy server for OpenAI Realtime API
 * This allows us to add the required beta headers that can't be added directly in browser WebSocket connections
 */
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import cors from 'cors';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import OpenAI from 'openai';
import multer from 'multer';
import fs from 'fs';
import pg from 'pg';

// Load environment variables from .env.local if present
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env.local') });

// Database connection
const { Pool } = pg;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test database connection
pool.connect((err, client, release) => {
    if (err) {
        console.error('❌ Error connecting to database:', err);
    } else {
        console.log('✅ Database connected successfully');
        release();
    }
});

// Initialize database tables
async function initializeTables() {
    try {
        // Create word_frequencies table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS word_frequencies (
                id SERIAL PRIMARY KEY,
                language VARCHAR(10) NOT NULL,
                word VARCHAR(100) NOT NULL,
                frequency DECIMAL(4,2) NOT NULL,
                rank INTEGER NOT NULL,
                user_frequency INTEGER NOT NULL,
                tier VARCHAR(20) NOT NULL,
                UNIQUE(language, word)
            )
        `);

        // Create verb_conjugations table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS verb_conjugations (
                id SERIAL PRIMARY KEY,
                infinitive VARCHAR(200) NOT NULL,
                form VARCHAR(200) NOT NULL,
                tense VARCHAR(100),
                person VARCHAR(100),
                mood VARCHAR(100),
                translation VARCHAR(200),
                language VARCHAR(10) DEFAULT 'es'
            )
        `);

        // Create indexes for performance
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_word_freq_lang_word ON word_frequencies(language, word)
        `);
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_word_freq_lang_rank ON word_frequencies(language, rank)
        `);
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_conjugations_form ON verb_conjugations(form)
        `);

        console.log('✅ Database tables initialized');
    } catch (error) {
        console.error('❌ Error initializing database tables:', error);
    }
}

// Initialize tables on startup
initializeTables();

// Verify API key is loaded
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
    console.error('ERROR: OPENAI_API_KEY not set');
    process.exit(1);
} else {
    console.log('✓ OpenAI API key loaded successfully');
    console.log('API key starts with:', apiKey.substring(0, 10) + '...');
}

const PORT = process.env.PORT || 3001;

// Create Express app
const app = express();

// Configure middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.static('public'));

// Add file upload handling for Whisper transcription
const upload = multer({ 
    dest: 'uploads/',
    limits: {
        fileSize: 25 * 1024 * 1024 // 25MB limit for Whisper API
    }
});

// Ensure uploads directory exists
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// Add Whisper transcription endpoint
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
    try {
        console.log('📤 Received transcription request');
        console.log('📋 Request body:', req.body);
        console.log('📋 Request file info:', req.file ? { 
            originalname: req.file.originalname, 
            mimetype: req.file.mimetype, 
            size: req.file.size,
            path: req.file.path 
        } : 'No file');
        
        const audioFile = req.file;
        const language = req.body.language; // Don't default to 'en' anymore
        
        if (!audioFile) {
            return res.status(400).json({ error: 'No audio file provided' });
        }
        
        console.log(`🎵 Processing audio file: ${audioFile.originalname}, size: ${audioFile.size} bytes`);
        console.log(`📋 File details - mimetype: ${audioFile.mimetype}, encoding: ${audioFile.encoding}`);
        
        // Create OpenAI client
        const openai = new OpenAI({ apiKey });
        
        // Transcribe using OpenAI client
        if (language) {
            console.log(`🚀 Sending to OpenAI Whisper API with language: ${language}`);
        } else {
            console.log(`🚀 Sending to OpenAI Whisper API with automatic language detection`);
        }
        
        // Ensure the file has the correct WebM extension for OpenAI
        const originalPath = audioFile.path;
        const webmPath = originalPath + '.webm';
        
        // Rename the file to have .webm extension
        fs.renameSync(originalPath, webmPath);
        
        const transcriptionParams = {
            file: fs.createReadStream(webmPath),
            model: "whisper-1",
            temperature: 0.1, // Slightly higher than 0 but still conservative to reduce hallucinations
            response_format: "verbose_json", // Get detailed response including probabilities
            condition_on_previous_text: false // Prevent carrying over context that might cause hallucinations
        };
        
        // Only add language if specified, otherwise let Whisper auto-detect
        if (language) {
            transcriptionParams.language = language;
        }
        
        console.log('🔄 Calling OpenAI transcription API...');
        const transcription = await openai.audio.transcriptions.create(transcriptionParams);
        console.log('✅ OpenAI API call completed');
        
        console.log('📊 Transcription details:');
        console.log(`  Text: "${transcription.text}"`);
        console.log(`  Language: ${transcription.language || 'auto-detected'}`);
        console.log(`  Raw transcription object:`, JSON.stringify(transcription, null, 2));
        
        // Filter out likely hallucinations using probability thresholds
        let finalText = transcription.text;
        let isFiltered = false;
        
        if (transcription.segments) {
            console.log(`  Segments: ${transcription.segments.length}`);
            
            // Check each segment for hallucination indicators
            const filteredSegments = transcription.segments.filter(segment => {
                const noSpeechProb = segment.no_speech_prob || 0;
                const avgLogProb = segment.avg_logprob || 0;
                
                console.log(`    Segment: "${segment.text}" | no_speech_prob: ${noSpeechProb.toFixed(3)} | avg_logprob: ${avgLogProb.toFixed(3)}`);
                
                // Filter out segments with high no_speech_prob or very low avg_logprob
                if (noSpeechProb > 0.6) {
                    console.log(`    ❌ Filtered segment (high no_speech_prob: ${noSpeechProb.toFixed(3)}): "${segment.text}"`);
                    return false;
                }
                
                if (avgLogProb < -1.0) {
                    console.log(`    ❌ Filtered segment (low avg_logprob: ${avgLogProb.toFixed(3)}): "${segment.text}"`);
                    return false;
                }
                
                // Also filter common hallucination phrases
                const text = segment.text.toLowerCase().trim();
                const commonHallucinations = [
                    'thank you for watching',
                    'thanks for watching',
                    'subscribe to my channel',
                    'like and subscribe',
                    'please subscribe',
                    'don\'t forget to subscribe',
                    '감사합니다', // Korean "thank you"
                    'ありがとうございます', // Japanese "thank you"
                    '謝謝', // Chinese "thank you"
                ];
                
                if (commonHallucinations.some(phrase => text.includes(phrase))) {
                    console.log(`    ❌ Filtered common hallucination: "${segment.text}"`);
                    return false;
                }
                
                return true;
            });
            
            // If we filtered out segments, reconstruct the text
            if (filteredSegments.length !== transcription.segments.length) {
                finalText = filteredSegments.map(seg => seg.text).join('').trim();
                isFiltered = true;
                console.log(`  🧹 Filtered ${transcription.segments.length - filteredSegments.length} segments`);
                console.log(`  Final text: "${finalText}"`);
            }
        }
        
        // If the final text is empty or too short after filtering, consider it noise
        if (!finalText || finalText.trim().length < 3) {
            console.log('  🔇 Final text too short after filtering, treating as noise');
            finalText = '';
        }
        
        console.log(`✅ Transcription ${isFiltered ? '(filtered)' : '(unfiltered)'}: "${finalText}"`);
        
        // Clean up uploaded file (with new name)
        fs.unlinkSync(webmPath);
        
        // Debug: Check what we're about to send
        const responseData = { text: finalText };
        console.log('📤 Sending response to frontend:', JSON.stringify(responseData));
        console.log('📤 Response data type check:', typeof responseData.text, 'length:', responseData.text ? responseData.text.length : 'undefined');
        
        // Return transcription
        res.json(responseData);
        
    } catch (error) {
        console.error('❌ Transcription error:', error);
        
        // Clean up file if it exists (try both original and renamed)
        if (req.file && req.file.path) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (cleanupError) {
                // File might have been renamed, try the webm version
                try {
                    fs.unlinkSync(req.file.path + '.webm');
                } catch (cleanupError2) {
                    console.error('Error cleaning up files:', cleanupError, cleanupError2);
                }
            }
        }
        
        res.status(500).json({ 
            error: 'Transcription failed', 
            details: error.message 
        });
    }
});

// Word frequency API endpoints
app.get('/api/word-frequency/:language/:word', async (req, res) => {
    try {
        const { language, word } = req.params;
        console.log(`🔍 Looking up word: "${word}" in language: ${language}`);
        
        const result = await pool.query(
            'SELECT frequency, rank, user_frequency FROM word_frequencies WHERE language = $1 AND word = $2',
            [language.toLowerCase(), word.toLowerCase()]
        );
        
        if (result.rows.length > 0) {
            console.log(`✅ Found word: ${word} with frequency: ${result.rows[0].frequency}`);
            res.json({
                frequency: parseFloat(result.rows[0].frequency),
                userFrequency: result.rows[0].user_frequency,
                rank: result.rows[0].rank
            });
        } else {
            console.log(`❌ Word not found: ${word}`);
            res.json(null);
        }
    } catch (error) {
        console.error('❌ Error looking up word frequency:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

app.get('/api/word-range/:language/:startRank/:endRank', async (req, res) => {
    try {
        const { language, startRank, endRank } = req.params;
        console.log(`📊 Getting word range: ${startRank}-${endRank} for ${language}`);
        
        const result = await pool.query(
            'SELECT word, frequency, rank, user_frequency FROM word_frequencies WHERE language = $1 AND rank BETWEEN $2 AND $3 ORDER BY rank',
            [language.toLowerCase(), parseInt(startRank), parseInt(endRank)]
        );
        
        const words = result.rows.map(row => ({
            word: row.word,
            frequency: parseFloat(row.frequency),
            rank: row.rank,
            userFrequency: row.user_frequency
        }));
        
        console.log(`✅ Found ${words.length} words in range`);
        res.json(words);
    } catch (error) {
        console.error('❌ Error getting word range:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

app.get('/api/conjugations/:form', async (req, res) => {
    try {
        const { form } = req.params;
        console.log(`🔄 Looking up conjugation: "${form}"`);
        
        const result = await pool.query(
            'SELECT infinitive, form, tense, person, mood, translation, language FROM verb_conjugations WHERE form = $1',
            [form.toLowerCase()]
        );
        
        console.log(`✅ Found ${result.rows.length} conjugation matches`);
        res.json(result.rows);
    } catch (error) {
        console.error('❌ Error looking up conjugation:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Batch word lookup for better performance
app.post('/api/words-batch', async (req, res) => {
    try {
        const { language, words } = req.body;
        
        if (!Array.isArray(words) || words.length === 0) {
            return res.status(400).json({ error: 'Words array is required' });
        }
        
        console.log(`📦 Batch lookup for ${words.length} words in ${language}`);
        
        // Create placeholders for the IN query
        const placeholders = words.map((_, index) => `$${index + 2}`).join(',');
        const result = await pool.query(
            `SELECT word, frequency, rank, user_frequency FROM word_frequencies WHERE language = $1 AND word IN (${placeholders})`,
            [language.toLowerCase(), ...words.map(w => w.toLowerCase())]
        );
        
        // Convert to map for easy lookup
        const wordMap = {};
        result.rows.forEach(row => {
            wordMap[row.word] = {
                frequency: parseFloat(row.frequency),
                userFrequency: row.user_frequency,
                rank: row.rank
            };
        });
        
        console.log(`✅ Found ${result.rows.length}/${words.length} words in batch`);
        res.json(wordMap);
    } catch (error) {
        console.error('❌ Error in batch word lookup:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Audio processing functions for backend
class AudioProcessor {
    static resampleAudio(inputBuffer, inputSampleRate, outputSampleRate) {
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
                output[i] = inputBuffer[index] * (1 - fraction) + inputBuffer[index + 1] * fraction;
            } else {
                output[i] = inputBuffer[inputBuffer.length - 1];
            }
        }
        
        return output;
    }
    
    static float32ToPCM16(float32Array) {
        const pcm16 = new ArrayBuffer(float32Array.length * 2);
        const view = new DataView(pcm16);
        
        for (let i = 0; i < float32Array.length; i++) {
            const sample = Math.max(-1, Math.min(1, float32Array[i]));
            const int16Value = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
            view.setInt16(i * 2, Math.round(int16Value), true);
        }
        
        return pcm16;
    }
    
    static arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return Buffer.from(binary, 'binary').toString('base64');
    }
    
    static processRawAudio(audioData, inputSampleRate) {
        console.log('🔧 Backend Audio Processing:');
        console.log('  - Input samples:', audioData.length);
        console.log('  - Input sample rate:', inputSampleRate, 'Hz');
        
        const targetSampleRate = 24000; // OpenAI expects 24kHz
        
        // Convert array to Float32Array if needed
        const float32Data = audioData instanceof Float32Array ? audioData : new Float32Array(audioData);
        
        // Resample to 24kHz if needed
        let processedData = float32Data;
        if (inputSampleRate !== targetSampleRate) {
            processedData = AudioProcessor.resampleAudio(float32Data, inputSampleRate, targetSampleRate);
            console.log('  - Resampled to:', targetSampleRate, 'Hz');
            console.log('  - Output samples:', processedData.length);
        }
        
        // Convert to PCM16
        const pcm16Buffer = AudioProcessor.float32ToPCM16(processedData);
        console.log('  - PCM16 bytes:', pcm16Buffer.byteLength);
        
        // Convert to base64 for OpenAI
        const base64Audio = AudioProcessor.arrayBufferToBase64(pcm16Buffer);
        console.log('  - Base64 length:', base64Audio.length);
        console.log('  - Duration (ms):', (pcm16Buffer.byteLength / 2 / targetSampleRate * 1000).toFixed(2));
        
        return base64Audio;
    }
}

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ server });

// Handle WebSocket connections
wss.on('connection', (ws) => {
    console.log('Client connected');
    
    // Create connection to OpenAI
    // Note: Node.js WebSocket allows headers directly, unlike browser WebSocket
    const openaiWs = new WebSocket(`wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01`, {
        headers: {
            'openai-beta': 'realtime=v1',
            'Authorization': `Bearer ${apiKey}`
        }
    });
    
    console.log('Attempting to connect to OpenAI...');

    // Store accumulated raw audio chunks for processing
    let audioBuffer = [];
    
    // Handle messages from client
    ws.on('message', (message) => {
        if (openaiWs.readyState === WebSocket.OPEN) {
            // Convert Buffer to string if necessary
            const messageStr = Buffer.isBuffer(message) ? message.toString('utf8') : message;
            
            try {
                const parsed = JSON.parse(messageStr);
                
                // NEW: Handle raw audio chunks from frontend
                if (parsed.type === 'raw_audio_chunk') {
                    console.log('🎤 Received raw audio chunk from frontend');
                    console.log('  - Samples:', parsed.audioData.length);
                    console.log('  - Sample rate:', parsed.sampleRate, 'Hz');
                    
                    // Accumulate raw audio data
                    audioBuffer.push({
                        data: parsed.audioData,
                        sampleRate: parsed.sampleRate
                    });
                    
                    // Don't forward to OpenAI yet - wait for commit
                    return;
                }
                
                // NEW: Handle audio buffer commit - process all accumulated audio
                if (parsed.type === 'raw_audio_commit') {
                    console.log('📤 Processing accumulated raw audio...');
                    console.log('  - Total chunks:', audioBuffer.length);
                    
                    if (audioBuffer.length > 0) {
                        // Combine all audio chunks
                        const firstChunk = audioBuffer[0];
                        const sampleRate = firstChunk.sampleRate;
                        
                        // Flatten all audio data into one array
                        let totalSamples = 0;
                        audioBuffer.forEach(chunk => totalSamples += chunk.data.length);
                        
                        const combinedAudio = new Float32Array(totalSamples);
                        let offset = 0;
                        
                        audioBuffer.forEach(chunk => {
                            combinedAudio.set(chunk.data, offset);
                            offset += chunk.data.length;
                        });
                        
                        console.log('  - Combined samples:', combinedAudio.length);
                        console.log('  - Duration (ms):', (combinedAudio.length / sampleRate * 1000).toFixed(2));
                        
                        // Process audio on backend
                        const processedBase64 = AudioProcessor.processRawAudio(combinedAudio, sampleRate);
                        
                        // Send processed audio to OpenAI
                        const audioMessage = {
                            type: 'input_audio_buffer.append',
                            audio: processedBase64
                        };
                        
                        console.log('📤 Sending processed audio to OpenAI');
                        openaiWs.send(JSON.stringify(audioMessage));
                        
                        // Clear buffer
                        audioBuffer = [];
                    }
                    
                    // Forward the commit message to OpenAI
                    const commitMessage = {
                        type: 'input_audio_buffer.commit'
                    };
                    openaiWs.send(JSON.stringify(commitMessage));
                    return;
                }
                
                // Handle regular buffer clear
                if (parsed.type === 'raw_audio_clear' || parsed.type === 'input_audio_buffer.clear') {
                    console.log('🗑️ Clearing audio buffer');
                    audioBuffer = [];
                    
                    // Forward clear to OpenAI
                    const clearMessage = {
                        type: 'input_audio_buffer.clear'
                    };
                    openaiWs.send(JSON.stringify(clearMessage));
                    return;
                }
                
                // OLD: Handle pre-processed audio (for backward compatibility)
                if (parsed.type === 'input_audio_buffer.append' && parsed.audio) {
                    console.log('⚠️ Received pre-processed audio (old format)');
                    console.log('  - Base64 length:', parsed.audio.length);
                    // Forward as-is for now (deprecated path)
                }
                
                // Forward all other messages to OpenAI
                if (!parsed.type.includes('delta')) {
                    console.log('Forwarding message to OpenAI:', parsed.type);
                }
                openaiWs.send(messageStr);
                
            } catch (parseError) {
                console.log('Forwarding non-JSON message to OpenAI:', typeof messageStr);
                openaiWs.send(messageStr);
            }
        }
    });

    // Add connection event handlers for OpenAI WebSocket
    openaiWs.on('open', () => {
        console.log('Successfully connected to OpenAI Realtime API');
    });

    // Handle messages from OpenAI
    openaiWs.on('message', (message) => {
        let messageStr = Buffer.isBuffer(message) ? message.toString('utf8') : message;
        
        // DEBUG: Parse and log important messages from OpenAI
        try {
            const parsed = JSON.parse(messageStr);
            if (parsed.type === 'conversation.item.input_audio_transcription.failed') {
                console.log('🔧 TRANSCRIPTION FAILURE DEBUG - OpenAI to Client:');
                console.log('  - Message type:', parsed.type);
                console.log('  - Event ID:', parsed.event_id);
                console.log('  - Item ID:', parsed.item_id);
                console.log('  - Content Index:', parsed.content_index);
                console.log('  - Error details:', JSON.stringify(parsed.error, null, 2));
            } else if (parsed.type === 'input_audio_buffer.committed') {
                console.log('✅ Audio buffer committed successfully by OpenAI');
            } else if (parsed.type === 'input_audio_buffer.cleared') {
                console.log('🗑️ Audio buffer cleared by OpenAI');
            } else if (parsed.type && !parsed.type.includes('delta') && !parsed.type.includes('transcript')) {
                console.log('Received from OpenAI:', parsed.type);
            }
        } catch (parseError) {
            console.log('Received non-JSON message from OpenAI, length:', messageStr.length);
        }
        
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(messageStr);
        }
    });

    // Handle close events
    ws.on('close', (code, reason) => {
        console.log(`Client connection closed: ${code} - ${reason}`);
        if (openaiWs.readyState === WebSocket.OPEN || 
            openaiWs.readyState === WebSocket.CONNECTING) {
            openaiWs.close();
        }
    });

    openaiWs.on('close', (code, reason) => {
        console.log(`OpenAI connection closed: ${code} - ${reason}`);
        if (ws.readyState === WebSocket.OPEN) {
            ws.close(code, 'OpenAI connection closed: ' + reason);
        }
    });

    // Handle errors
    openaiWs.on('error', (error) => {
        console.error('OpenAI WebSocket error:', error);
        if (ws.readyState === WebSocket.OPEN) {
            ws.close(1011, 'Error in OpenAI connection');
        }
    });

    ws.on('error', (error) => {
        console.error('Client WebSocket error:', error);
        if (openaiWs.readyState === WebSocket.OPEN || 
            openaiWs.readyState === WebSocket.CONNECTING) {
            openaiWs.close(1011, 'Error in client connection');
        }
    });
});

// Set up Socket.IO server for video calling signaling
const io = new SocketIOServer(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Store active calls and profiles
const activeCalls = new Map(); // Map<code, {hostSocketId, hostProfile, ...}>
const connectedProfiles = new Map(); // Map<socketId, {profile, ...}>

// Generate random 5-digit code
function generateCallCode() {
    return Math.floor(10000 + Math.random() * 90000).toString();
}

io.on('connection', (socket) => {
    console.log(`📞 Socket.IO client connected: ${socket.id}`);

    // Register profile
    socket.on('register-profile', (data) => {
        connectedProfiles.set(socket.id, {
            profile: data.profile,
            nativeLanguage: data.nativeLanguage,
            targetLanguage: data.targetLanguage
        });
        console.log(`👤 Profile registered: ${data.profile} (${socket.id})`);
    });

    // Host a call
    socket.on('host-call', () => {
        const profile = connectedProfiles.get(socket.id);
        if (!profile) {
            socket.emit('error', { message: 'Profile not registered' });
            return;
        }

        const code = generateCallCode();
        activeCalls.set(code, {
            hostSocketId: socket.id,
            hostProfile: profile.profile,
            nativeLanguage: profile.nativeLanguage,
            targetLanguage: profile.targetLanguage,
            joinerSocketId: null
        });

        console.log(`🏠 Call hosted: ${code} by ${profile.profile} (${socket.id})`);
        socket.emit('call-hosted', { code });
    });

    // Join a call
    socket.on('join-call', (data) => {
        const { code } = data;
        const profile = connectedProfiles.get(socket.id);
        
        if (!profile) {
            socket.emit('error', { message: 'Profile not registered' });
            return;
        }

        const call = activeCalls.get(code);
        if (!call) {
            console.log(`❌ Call not found: ${code}`);
            socket.emit('call-not-found', { code });
            return;
        }

        if (call.joinerSocketId) {
            socket.emit('error', { message: 'Call is already full' });
            return;
        }

        // Update call with joiner info
        call.joinerSocketId = socket.id;
        call.joinerProfile = profile.profile;

        console.log(`🤝 ${profile.profile} (${socket.id}) joined call ${code}`);

        // Notify both parties
        socket.emit('call-found', { 
            hostSocketId: call.hostSocketId,
            hostProfile: call.hostProfile 
        });
        
        io.to(call.hostSocketId).emit('call-join-request', {
            joinerSocketId: socket.id,
            joinerProfile: profile.profile
        });
    });

    // WebRTC signaling - Forward offer from joiner to host
    socket.on('webrtc-offer', (data) => {
        const { offer, targetSocketId } = data;
        console.log(`📡 Forwarding WebRTC offer from ${socket.id} to ${targetSocketId}`);
        
        io.to(targetSocketId).emit('webrtc-offer', {
            offer,
            callerSocketId: socket.id
        });
    });

    // WebRTC signaling - Forward answer from host to joiner
    socket.on('webrtc-answer', (data) => {
        const { answer, targetSocketId } = data;
        console.log(`📡 Forwarding WebRTC answer from ${socket.id} to ${targetSocketId}`);
        
        io.to(targetSocketId).emit('webrtc-answer', {
            answer,
            answererSocketId: socket.id
        });
    });

    // WebRTC signaling - Forward ICE candidates
    socket.on('webrtc-ice-candidate', (data) => {
        const { candidate, targetSocketId } = data;
        console.log(`🧊 Forwarding ICE candidate from ${socket.id} to ${targetSocketId}`);
        
        io.to(targetSocketId).emit('webrtc-ice-candidate', {
            candidate,
            senderSocketId: socket.id
        });
    });

    // Transcript message relay
    socket.on('transcript-message', (data) => {
        const { text } = data;
        // Find active call involving this socket
        let relayed = false;
        for (const [code, call] of activeCalls.entries()) {
            if (call.hostSocketId === socket.id || call.joinerSocketId === socket.id) {
                const targetSocketId = call.hostSocketId === socket.id ? call.joinerSocketId : call.hostSocketId;
                if (targetSocketId) {
                    io.to(targetSocketId).emit('transcript-message', { text });
                    console.log(`📝 Relayed transcript from ${socket.id} to ${targetSocketId}: ${text}`);
                    relayed = true;
                }
                break;
            }
        }
        if (!relayed) {
            console.log(`⚠️ Transcript relay failed: no active call found for socket ${socket.id}`);
        }
    });

    // End call
    socket.on('end-call', () => {
        handleCallEnd(socket.id, 'Call ended by user');
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
        console.log(`📞 Socket.IO client disconnected: ${socket.id} (${reason})`);
        handleCallEnd(socket.id, 'User disconnected');
        connectedProfiles.delete(socket.id);
    });

    // Helper function to handle call cleanup
    function handleCallEnd(socketId, reason) {
        // Find and clean up any active calls involving this socket
        for (const [code, call] of activeCalls.entries()) {
            if (call.hostSocketId === socketId || call.joinerSocketId === socketId) {
                console.log(`📞 Ending call ${code}: ${reason}`);
                
                // Notify the other party
                const otherSocketId = call.hostSocketId === socketId ? call.joinerSocketId : call.hostSocketId;
                if (otherSocketId) {
                    io.to(otherSocketId).emit('call-ended', { reason });
                }
                
                // Remove the call
                activeCalls.delete(code);
                break;
            }
        }
    }
});

console.log('📞 Socket.IO signaling server initialized');

// Start server
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
