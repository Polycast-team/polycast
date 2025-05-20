// Basic server setup placeholder
require('dotenv').config(); // Ensure .env is loaded at the very top
console.log('Server starting...');

const fs = require('fs');
const path = require('path');
const MODE_FILE = path.join(__dirname, 'mode.json');

// Helper to load mode from disk
function loadModeFromDisk() {
    try {
        if (fs.existsSync(MODE_FILE)) {
            const data = JSON.parse(fs.readFileSync(MODE_FILE, 'utf8'));
            if (typeof data.isTextMode === 'boolean') {
                console.log(`[Mode] Loaded isTextMode=${data.isTextMode} from disk`);
                return data.isTextMode;
            }
        }
    } catch (e) {
        console.warn('[Mode] Failed to read mode.json:', e);
    }
    return false;
}

// Helper to save mode to disk
function saveModeToDisk(isTextMode) {
    try {
        fs.writeFileSync(MODE_FILE, JSON.stringify({ isTextMode }), 'utf8');
        console.log(`[Mode] Saved isTextMode=${isTextMode} to disk`);
    } catch (e) {
        console.error('[Mode] Failed to save mode.json:', e);
    }
}

// Debug: Print OpenAI API Key (should be defined, or print warning)
if (process.env.OPENAI_API_KEY) {
    console.log('OpenAI API Key loaded:', process.env.OPENAI_API_KEY.slice(0, 8) + '...');
} else {
    console.warn('OpenAI API Key is NOT loaded! Check your .env file and dotenv config.');
}

const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const url = require('url'); // To parse connection URL
const config = require('./config/config');
const speechService = require('./services/speechService');
const llmService = require('./services/llmService');
const { transcribeAudio } = require('./services/whisperService');
const { generateImage } = require('./services/imageService');
const redisService = require('./services/redisService');

// Initialize Express app
const app = express();

// Add CORS middleware to enable cross-origin requests
app.use((req, res, next) => {
    // Log CORS details
    console.log(`[CORS] Request from origin: ${req.headers.origin}`);
    
    // Allow all origins for debugging
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    // Log headers for debugging
    console.log(`[CORS] Response headers set:`, {
        'Access-Control-Allow-Origin': res.getHeader('Access-Control-Allow-Origin'),
        'Access-Control-Allow-Credentials': res.getHeader('Access-Control-Allow-Credentials')
    });
    
    next();
});

// Enable CORS for frontend on Render using the cors package
app.use(cors({
  origin: true, // Allow all origins temporarily for debugging
  credentials: true
}));

// Enable JSON body parsing for POST requests
app.use(express.json());

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
// Pass request object to connection handler
const wss = new WebSocket.Server({ 
    server,
    // Set a generous ping timeout (10 minutes of inactivity)
    clientTracking: true,
    // The WebSocket spec doesn't have a standard ping interval, but we can simulate it
});

// Set up a heartbeat interval to keep connections alive
function heartbeat() {
    this.isAlive = true;
    console.log('Received pong from client');
}

// Send pings to all clients every 30 seconds
const pingInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
        // If the client hasn't responded to the previous ping, terminate the connection
        if (ws.isAlive === false) {
            console.log('Client did not respond to ping, terminating connection');
            return ws.terminate();
        }
        
        // Mark as not alive, will be reset when pong is received
        ws.isAlive = false;
        // Send a ping
        ws.ping();
    });
}, 30000); // 30 seconds ping interval

// Clean up interval when server closes
wss.on('close', () => {
    clearInterval(pingInterval);
    console.log('WebSocket server closed, cleared ping interval');
});

console.log(`WebSocket server created with heartbeat enabled.`);

// === Room Management & WebSocket Handling ===

// Room management system
const activeRooms = new Map(); // Map of roomCode -> {hostWs, students, transcript}

// Track client connection attempts - prevent multiple connection spam
const connectionAttempts = new Map();

// Global list of all rejected room codes - to prevent reconnection attempts
const rejectedRoomCodes = new Set();

// Generate a unique 5-digit room code
async function generateRoomCode() {
    // Try up to 5 times to generate a unique code
    for (let attempts = 0; attempts < 5; attempts++) {
        const code = Math.floor(10000 + Math.random() * 90000).toString(); // 5-digit number
        
        // Check both in-memory map and Redis
        if (!activeRooms.has(code) && !(await redisService.roomExists(code))) {
            return code;
        }
    }
    
    // If we couldn't generate a unique code after 5 attempts, try a more systematic approach
    let code = 10000;
    while (code < 100000) {
        if (!activeRooms.has(code.toString()) && !(await redisService.roomExists(code.toString()))) {
            return code.toString();
        }
        code++;
    }
    
    throw new Error('Failed to generate a unique room code');
}

// Client tracking
const clientTextBuffers = new Map();
const clientTargetLanguages = new Map(); // Keep for language from URL, will store an array now
const clientRooms = new Map(); // Track which room each client belongs to

// Modify connection handler to accept request object (req) and make it async
wss.on('connection', (ws, req) => {
    // Initialize the heartbeat
    ws.isAlive = true;
    
    // Listen for pong responses
    ws.on('pong', heartbeat);
    
    // Parse URL parameters
    const parsedUrl = url.parse(req.url, true); // true parses query string
    const query = parsedUrl.query;
    
    // EARLY REJECTION: Immediately reject connection if trying to join a known bad room code
    if (query && query.roomCode && query.isHost === 'false' && rejectedRoomCodes.has(query.roomCode)) {
        console.log(`[Room] Immediately rejected student connection for known bad room code: ${query.roomCode}`);
        ws.send(JSON.stringify({
            type: 'room_error',
            message: 'This room does not exist or has expired. Please check the code and try again.'
        }));
        ws.close();
        return;
    }
    
    // Set a timeout for joining a room (60 seconds)
    // This prevents lingering connections that never successfully join a room
    const joinRoomTimeout = setTimeout(() => {
        // If the connection hasn't been added to a room by this time,
        // and it's still open, close it
        if (!clientRooms.has(ws) && ws.readyState === ws.OPEN) {
            console.log('[Room] Closing connection - timed out waiting to join a room');
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Connection timed out waiting to join a room.'
            }));
            ws.close();
        }
    }, 60000); // 60 seconds timeout
    
    // 1. Parse target languages
    let targetLangsArray = ['Spanish']; // Default
    try {
        if (query && query.targetLangs) {
            // Split comma-separated string, decode, trim, filter empty
            targetLangsArray = query.targetLangs
                .split(',')
                .map(lang => decodeURIComponent(lang.trim()))
                .filter(lang => lang.length > 0);
            
            if (targetLangsArray.length === 0) {
                targetLangsArray = ['Spanish']; // Fallback if parsing results in empty array
                console.log(`Client connected. Invalid targetLangs in URL, defaulting to ${targetLangsArray[0]}`);
            } else {
                 console.log(`Client connected. Target languages from URL: ${targetLangsArray.join(', ')}`);
            }
        } else {
            console.log(`Client connected. No targetLangs in URL, defaulting to ${targetLangsArray[0]}`);
        }
    } catch (e) {
        console.error('Error parsing connection URL for target languages:', e);
        // Proceed with default
    }
    
    // 2. Handle room functionality
    let roomCode = null;
    let isHost = false;
    
    try {
        if (query && query.roomCode) {
            roomCode = query.roomCode;
            isHost = query.isHost === 'true';
            
            // Verify room exists
            if (!activeRooms.has(roomCode)) {
                if (isHost) {
                    // Create room if host is connecting and room doesn't exist yet
                    activeRooms.set(roomCode, {
                        hostWs: ws,
                        students: [],
                        transcript: [],
                        createdAt: Date.now()
                    });
                    console.log(`[Room] Host created room on connect: ${roomCode}`);
                } else {
                    // Reject connection if student tries to join non-existent room
                    console.log(`[Room] Rejected student - room not found: ${roomCode}`);
                    
                    // Add to rejected rooms set to prevent future reconnection attempts
                    rejectedRoomCodes.add(roomCode);
                    
                    ws.send(JSON.stringify({ 
                        type: 'room_error', 
                        message: 'Room not found. Please check the code and try again.' 
                    }));
                    ws.close();
                    return;
                }
            } else {
                // Room exists
                const room = activeRooms.get(roomCode);
                
                if (isHost) {
                    // Update host connection
                    room.hostWs = ws;
                    console.log(`[Room] Host joined existing room: ${roomCode}`);
                } else {
                    // Add student to room
                    room.students.push(ws);
                    console.log(`[Room] Student joined room: ${roomCode} (total students: ${room.students.length})`);
                    
                    // Send current transcript to newly joined student
                    if (room.transcript.length > 0) {
                        ws.send(JSON.stringify({
                            type: 'transcript_history',
                            data: room.transcript
                        }));
                    }
                }
            }
            
            // Track which room this client belongs to
            clientRooms.set(ws, {
                roomCode,
                isHost
            });
            
            // Clear the join room timeout since connection has successfully joined a room
            clearTimeout(joinRoomTimeout);
            
            // Confirmation message
            ws.send(JSON.stringify({
                type: 'room_joined',
                roomCode,
                isHost,
                message: isHost ? 
                    `You are hosting room ${roomCode}` : 
                    `You joined room ${roomCode} as a student`
            }));
        }
    } catch (e) {
        console.error('Error handling room connection:', e);
    }
    
    clientTargetLanguages.set(ws, targetLangsArray); // Store the array
    clientTextBuffers.set(ws, { text: '', lastEndTimeMs: 0 }); // Ensure this uses correct state

    ws.on('message', async (message) => {
        // Log the raw message and its type for debugging
        console.log('[WS DEBUG] Raw message:', message);
        console.log('[WS DEBUG] typeof message:', typeof message);
        
        // Check if client is in a room
        const clientRoom = clientRooms.get(ws);
        const isInRoom = !!clientRoom;
        const isRoomHost = isInRoom && clientRoom.isHost;
        
        // Students aren't allowed to send audio/text for processing
        if (isInRoom && !isRoomHost) {
            console.log(`[Room] Rejected message from student in room ${clientRoom.roomCode}`);
            ws.send(JSON.stringify({ 
                type: 'error', 
                message: 'Students cannot send audio or text for transcription' 
            }));
            return;
        }
        
        if (Buffer.isBuffer(message)) {
            // Try to parse as string first
            try {
                const msgString = message.toString('utf8');
                console.log('[WS DEBUG] Buffer as string:', msgString);
                const data = JSON.parse(msgString);
                if (data && data.type === 'text_submit') {
                    console.log('[WS DEBUG] Parsed text_submit from buffer:', data);
                    if (isTextMode) {
                        const translateThis = data.text;
                        const sourceLang = data.lang;
                        const targetLangs = clientTargetLanguages.get(ws) || ['Spanish'];
                        // Always include English as a possible translation target
                        const allLangs = Array.from(new Set(['English', ...targetLangs]));
                        
                        // Use textModeLLM with sourceLang and targetLangs
                        const textModeLLM = require('./services/textModeLLM');
                        const translations = await textModeLLM.translateTextBatch(translateThis, sourceLang, allLangs);
                        
                        // Prepare response for host
                        const hostResponse = { 
                            type: 'recognized', 
                            lang: sourceLang, 
                            data: translateThis 
                        };
                        
                        // Send to host
                        ws.send(JSON.stringify(hostResponse));
                        
                        // Broadcast to students if this is a host in a room
                        if (isRoomHost) {
                            const room = activeRooms.get(clientRoom.roomCode);
                            if (room) {
                                // Store the transcript and translations for late joiners
                                room.transcript.push({
                                    text: translateThis,
                                    timestamp: Date.now()
                                });
                                
                                // Keep only the most recent 50 items
                                if (room.transcript.length > 50) {
                                    room.transcript = room.transcript.slice(-50);
                                }
                                
                                // Broadcast to all students in room
                                room.students.forEach(student => {
                                    if (student.readyState === WebSocket.OPEN) {
                                        student.send(JSON.stringify(hostResponse));
                                        
                                        // Also send translations to students
                                        for (const lang of allLangs) {
                                            if (lang !== sourceLang) {
                                                student.send(JSON.stringify({ 
                                                    type: 'translation', 
                                                    lang, 
                                                    data: translations[lang] 
                                                }));
                                            }
                                        }
                                    }
                                });
                            }
                        }
                        
                        // Send translations to host
                        for (const lang of allLangs) {
                            if (lang !== sourceLang) {
                                ws.send(JSON.stringify({ 
                                    type: 'translation', 
                                    lang, 
                                    data: translations[lang] 
                                }));
                            }
                        }
                    } else {
                        ws.send(JSON.stringify({ type: 'error', message: 'Text submissions are only allowed in text mode.' }));
                    }
                    return; // Do not process as audio
                }
            } catch (err) {
                console.log('[WS DEBUG] Buffer is not JSON, treating as audio. Error:', err.message);
                // Not JSON, so treat as audio buffer
            }
            console.log(`[Server WS] Received audio buffer, size: ${message.length}`); // Log buffer reception
            try {
                // Process audio and get transcription
                const transcription = await transcribeAudio(message, 'audio.webm');
                if (transcription && ws.readyState === ws.OPEN) {
                    // Translate to all target languages (batch)
                    let targetLangs = clientTargetLanguages.get(ws) || ['Spanish'];
                    
                    // Check if this is a host with students in the room - ensure Spanish is included for students
                    if (isRoomHost) {
                        const room = activeRooms.get(clientRoom.roomCode);
                        if (room && room.students && room.students.length > 0) {
                            // Only add Spanish if it's not already in the target languages
                            if (!targetLangs.includes('Spanish')) {
                                targetLangs = [...targetLangs, 'Spanish'];
                                console.log(`[Polycast] Added Spanish translation for students in room ${clientRoom.roomCode}`);
                            }
                        }
                    }
                    
                    console.log(`[Polycast] Calling Gemini for batch translation: '${transcription}' -> ${targetLangs.join(', ')}`);
                    const translations = await llmService.translateTextBatch(transcription, targetLangs);
                    
                    // Prepare recognized response
                    const recognizedResponse = { 
                        type: 'recognized', 
                        data: transcription 
                    };
                    
                    // Send to host
                    ws.send(JSON.stringify(recognizedResponse));
                    
                    // Broadcast to students if this is a host in a room
                    if (isRoomHost) {
                        const room = activeRooms.get(clientRoom.roomCode);
                        if (room) {
                            // Store the transcript for late joiners
                            room.transcript.push({
                                text: transcription,
                                timestamp: Date.now()
                            });
                            
                            // Keep only the most recent 50 items
                            if (room.transcript.length > 50) {
                                room.transcript = room.transcript.slice(-50);
                            }
                            
                            // Broadcast to all students in room
                            room.students.forEach(student => {
                                if (student.readyState === WebSocket.OPEN) {
                                    student.send(JSON.stringify(recognizedResponse));
                                    
                                    // Send Spanish translation to students, regardless of what other languages are available
                                    if (translations['Spanish']) {
                                        student.send(JSON.stringify({ 
                                            type: 'translation', 
                                            lang: 'Spanish', 
                                            data: translations['Spanish'] 
                                        }));
                                    } else {
                                        // Fallback: send the first available translation if Spanish isn't available
                                        const availableLangs = Object.keys(translations);
                                        if (availableLangs.length > 0) {
                                            const firstLang = availableLangs[0];
                                            student.send(JSON.stringify({ 
                                                type: 'translation', 
                                                lang: 'Spanish', // Still label it as Spanish for the student UI
                                                data: translations[firstLang] 
                                            }));
                                        }
                                    }
                                }
                            });
                            
                            // Persist transcript update to Redis
                            redisService.updateTranscript(clientRoom.roomCode, room.transcript)
                                .catch(err => console.error(`[Redis] Failed to update transcript for room ${clientRoom.roomCode}:`, err));
                        }
                    }
                    
                    // Send translations to host
                    for (const lang of targetLangs) {
                        ws.send(JSON.stringify({ 
                            type: 'translation', 
                            lang, 
                            data: translations[lang] 
                        }));
                    }
                }
            } catch (err) {
                console.error('Whisper transcription error:', err);
                if (ws.readyState === ws.OPEN) {
                    ws.send(JSON.stringify({ 
                        type: 'error', 
                        message: 'Transcription failed: ' + err.message + ' (Try using Chrome or Edge)'
                    }));
                }
            }
        } else if (typeof message === 'string') {
            console.log('[WS DEBUG] Received string message:', message);
            try {
                const data = JSON.parse(message);
                if (data.type === 'text_submit') {
                    console.log('[WS DEBUG] Parsed text_submit from string:', data);
                    if (isTextMode) {
                        const translateThis = data.text;
                        const sourceLang = data.lang;
                        const targetLangs = clientTargetLanguages.get(ws) || ['Spanish'];
                        // Always include English as a possible translation target
                        const allLangs = Array.from(new Set(['English', ...targetLangs]));
                        // Use textModeLLM for text mode, llmService for audio mode
                        if (isTextMode) {
                            // Use textModeLLM with sourceLang and targetLangs
                            const textModeLLM = require('./services/textModeLLM');
                            const translations = await textModeLLM.translateTextBatch(translateThis, sourceLang, allLangs);
                            for (const lang of allLangs) {
                                if (lang !== sourceLang) {
                                    ws.send(JSON.stringify({ type: 'translation', lang, data: translations[lang] }));
                                }
                            }
                        } else {
                            // Use llmService for audio mode (default prompt)
                            const llmService = require('./services/llmService');
                            for (const lang of allLangs) {
                                if (lang !== sourceLang) {
                                    const translation = await llmService.translateText(translateThis, lang);
                                    ws.send(JSON.stringify({ type: 'translation', lang, data: translation }));
                                }
                            }
                        }
                        ws.send(JSON.stringify({ type: 'recognized', lang: sourceLang, data: translateThis }));
                    } else {
                        ws.send(JSON.stringify({ type: 'error', message: 'Text submissions are only allowed in text mode.' }));
                    }
                }
            } catch (err) {
                console.error('Failed to parse or handle text_submit:', err);
            }
        } else {
            console.warn('[Server] Received unexpected non-buffer message, ignoring.');
        }
    });

    ws.on('close', async () => {
        // Clear the join room timeout to prevent memory leaks
        clearTimeout(joinRoomTimeout);
        
        // Check if the client was in a room
        const clientRoom = clientRooms.get(ws);
        if (clientRoom) {
            const { roomCode, isHost } = clientRoom;
            
            // Get room data
            const room = activeRooms.get(roomCode);
            if (room) {
                if (isHost) {
                    console.log(`[Room] Host disconnected from room: ${roomCode}`);
                    
                    // Check if there are other hosts in the room before closing
                    // Since our system can only have one host per room by design, this change is for future extensibility
                    // In case multiple hosts are supported in the future
                    
                    // For now, just add a flag to keep the room open
                    // This will prevent premature room closures
                    const keepRoomOpen = true; // Set to true to keep room open when host is still present
                    
                    if (!keepRoomOpen) {
                        console.log(`[Room] Closing room ${roomCode} as no host remains`);
                        
                        // Notify all students that host has ended the session
                        room.students.forEach(student => {
                            if (student.readyState === WebSocket.OPEN) {
                                student.send(JSON.stringify({
                                    type: 'host_disconnected',
                                    message: 'The host has ended the session.'
                                }));
                            }
                        });
                        
                        // Delete room data from Redis
                        try {
                            await redisService.deleteRoom(roomCode);
                            console.log(`[Room] Successfully deleted room ${roomCode} from Redis`);
                        } catch (error) {
                            console.error(`[Room] Failed to delete room ${roomCode} from Redis:`, error);
                        }
                        
                        // Remove from in-memory room map
                        activeRooms.delete(roomCode);
                    } else {
                        console.log(`[Room] Keeping room ${roomCode} open even though host disconnected`);
                        // Update Redis with current room state
                        try {
                            await redisService.saveRoom(roomCode, room);
                        } catch (error) {
                            console.error(`[Room] Failed to update room ${roomCode} in Redis after host disconnect:`, error);
                        }
                    }
                } else {
                    // Student disconnected - remove from room's student list
                    console.log(`[Room] Student disconnected from room: ${roomCode}`);
                    
                    // Remove student from room's student list
                    room.students = room.students.filter(student => student !== ws);
                    console.log(`[Room] Room ${roomCode} now has ${room.students.length} student(s)`);
                    
                    // Update Redis with current room state (student count)
                    try {
                        await redisService.saveRoom(roomCode, room);
                    } catch (error) {
                        console.error(`[Room] Failed to update room ${roomCode} in Redis after student disconnect:`, error);
                    }
                }
            }
            
            // Remove client's room tracking
            clientRooms.delete(ws);
        }
        
        // Clean up other client data
        clientTextBuffers.delete(ws);
        clientTargetLanguages.delete(ws);
        console.log('Client disconnected');
    });
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        clientTextBuffers.delete(ws);
        clientTargetLanguages.delete(ws);
    });
    ws.send(JSON.stringify({ type: 'info', message: `Connected to Polycast backend (Targets: ${targetLangsArray.join(', ')})` }));
});

// === Room Management API Endpoints ===

// Create a new room (HOST endpoint)
app.post('/api/create-room', async (req, res) => {
    try {
        const roomCode = await generateRoomCode();
        
        // Initialize the room with empty values
        const roomData = {
            hostWs: null,  // Will be set when host connects via WebSocket
            students: [],  // List of student WebSocket connections
            transcript: [], // Current transcript data
            createdAt: Date.now() // Timestamp for cleanup later
        };
        
        // Set in memory
        activeRooms.set(roomCode, roomData);
        
        // Persist in Redis
        await redisService.saveRoom(roomCode, roomData);
        
        console.log(`[Room] Created new room: ${roomCode}`);
        res.status(201).json({ roomCode });
    } catch (error) {
        console.error('[Room] Error creating room:', error);
        res.status(500).json({ error: 'Failed to create room' });
    }
});

// Check if a room exists (STUDENT endpoint)
app.get('/api/check-room/:roomCode', async (req, res) => {
    const { roomCode } = req.params;
    
    // Check if room exists in memory
    if (activeRooms.has(roomCode)) {
        console.log(`[Room] Room check success (memory): ${roomCode}`);
        res.status(200).json({ exists: true });
        return;
    }
    
    // If not in memory, check Redis
    try {
        const exists = await redisService.roomExists(roomCode);
        if (exists) {
            // Room exists in Redis, get its data
            const roomData = await redisService.getRoom(roomCode);
            
            // Initialize the room in memory
            activeRooms.set(roomCode, {
                hostWs: null,
                students: [],
                transcript: roomData.transcript || [],
                createdAt: roomData.createdAt || Date.now()
            });
            
            console.log(`[Room] Room check success (redis): ${roomCode}`);
            res.status(200).json({ exists: true });
        } else {
            console.log(`[Room] Room check failed - not found: ${roomCode}`);
            res.status(404).json({ exists: false, message: 'Room not found' });
        }
    } catch (error) {
        console.error(`[Room] Error checking room ${roomCode}:`, error);
        res.status(500).json({ error: 'Failed to check room' });
    }
});

// === Polycast Mode State ===
let isTextMode = loadModeFromDisk();

// Set PORT from env, config, or fallback to 3000
const PORT = process.env.PORT || config.port || 3000;

// API routes
app.get('/api/translate/:language/:text', async (req, res) => {
    try {
        const { language, text } = req.params;
        const translatedText = await llmService.translateText(decodeURIComponent(text), language);
        res.json({ translation: translatedText });
    } catch (error) {
        console.error("Translation API error:", error);
        res.status(500).json({ error: error.message });
    }
});

// Dictionary API route - provides a contextual definition for a word
app.get('/api/dictionary/:word', async (req, res) => {
    try {
        const { word } = req.params;
        const context = req.query.context || '';
        console.log(`[Dictionary API] Getting definition for: ${word}${context ? ' with context: "' + context + '"' : ''}`);
        
        // Create a prompt for the new word//definition//translation format
        const prompt = `You are helping a language learner understand the meaning of a word in a sentence.

Word: "${word}"
Context: "${context}"

Respond with the word, followed by the text of your best definition for this word in this context, followed by the Spanish translation. These should be separated by '//', for example 'charge//To rush forward to attack.//cargar'`;
        
        // Log prompt for debugging
        console.log('[Dictionary API] Using new prompt format:', prompt);
        
        // Generate the response using Gemini with low temperature for consistency
        const llmResponse = await generateTextWithGemini(prompt, 0.2);
        console.log(`[Dictionary API] Raw Gemini response: ${llmResponse}`);
        
        // Parse the response in the format: word//definition//translation
        const parts = llmResponse.trim().split('//');
        
        if (parts.length >= 3) {
            const responseWord = parts[0].trim();
            const responseDefinition = parts[1].trim();
            const translation = parts[2].trim();
            
            // Format for backward compatibility with existing frontend
            const formattedResponse = {
                word: responseWord,
                translation: translation,
                partOfSpeech: 'unknown', // We'll need to infer this or add it to the prompt format
                definition: responseDefinition,
                definitions: [{
                    text: responseDefinition,
                    example: context || 'No example available.'
                }],
                isContextual: true
            };
            
            console.log(`[Dictionary API] Processed response for "${word}": ${JSON.stringify(formattedResponse, null, 2)}`);
            res.json(formattedResponse);
        } else {
            // Fallback if response doesn't match expected format
            console.error('[Dictionary API] Error: Response not in expected format');
            res.status(500).json({
                error: 'Response not in expected format',
                raw: llmResponse,
                word: word,
                definition: 'Definition unavailable',
                translation: 'Translation unavailable'
            });
        }
    } catch (error) {
        console.error("Dictionary API error:", error);
        res.status(500).json({ error: error.message });
    }
});

// === IMAGE GENERATION ENDPOINT ===
app.get('/api/generate-image', async (req, res) => {
    const prompt = req.query.prompt || '';
    const size = req.query.size || '1024x1024';
    const moderation = req.query.moderation || 'auto';
    
    console.log(`[Image Generation] Request received. Prompt: "${prompt.substring(0, 30)}...", Size: ${size}, Moderation: ${moderation}`);
    
    try {
        const imgPayload = await generateImage(prompt, size, moderation);

        // imgPayload is now a data-URI (or the file URL you create)
        console.log('[Image Generation] Success! Image payload ready');
        res.json({ url: imgPayload });
    } catch (error) {
        console.error('[Image Generation] Error:', error.message, error.stack);
        res.status(500).json({ error: 'Failed to generate image.' });
    }
});

// Endpoint to get current mode
app.get('/mode', (req, res) => {
    res.json({ isTextMode });
});

// Endpoint to set current mode
app.post('/mode', (req, res) => {
    if (typeof req.body.isTextMode === 'boolean') {
        isTextMode = req.body.isTextMode;
        saveModeToDisk(isTextMode);
        res.json({ isTextMode });
    } else {
        res.status(400).json({ error: 'Missing or invalid isTextMode' });
    }
});

// PostgreSQL Database Connection
const { Pool } = require('pg');

// Database connection using environment variables or direct connection string
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://data_5rgr_user:3mDZqEEuOVr3SzkyO1M8UvvAvTdkdNQI@dpg-d0jn3fvfte5s7380vqs0-a.oregon-postgres.render.com/data_5rgr',
    ssl: {
        rejectUnauthorized: false // Required for Render PostgreSQL
    }
});

// Initialize the database tables
async function initializeDatabase() {
    const client = await pool.connect();
    try {
        // Create profiles table if it doesn't exist
        await client.query(`
            CREATE TABLE IF NOT EXISTS profiles (
                profile_name VARCHAR(255) PRIMARY KEY,
                selected_words TEXT[],
                last_updated TIMESTAMP DEFAULT NOW()
            )
        `);
        
        // Create flashcards table if it doesn't exist
        await client.query(`
            CREATE TABLE IF NOT EXISTS flashcards (
                id SERIAL PRIMARY KEY,
                profile_name VARCHAR(255) REFERENCES profiles(profile_name) ON DELETE CASCADE,
                word_sense_id VARCHAR(255) NOT NULL,
                word VARCHAR(255) NOT NULL,
                definition TEXT,
                translation TEXT,
                part_of_speech VARCHAR(50),
                context TEXT,
                definition_number INTEGER,
                example TEXT,
                in_flashcards BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(profile_name, word_sense_id)
            )
        `);
        
        // Insert sample data for the 'cat' profile if it doesn't exist
        const profileCheck = await client.query('SELECT * FROM profiles WHERE profile_name = $1', ['cat']);
        if (profileCheck.rowCount === 0) {
            // Insert cat profile
            await client.query(
                'INSERT INTO profiles (profile_name, selected_words) VALUES ($1, $2)',
                ['cat', ['charge', 'run']]
            );
            
            // Insert sample flashcards
            await client.query(`
                INSERT INTO flashcards 
                (profile_name, word_sense_id, word, definition, translation, part_of_speech, context, definition_number, example, in_flashcards)
                VALUES 
                ('cat', 'charge24', 'charge', 'energize a battery by passing a current through it', 'cargar', 'verb', 'I need to charge my phone', 24, 'Remember to charge your devices overnight', true),
                ('cat', 'run1', 'run', 'move at a speed faster than a walk', 'correr', 'verb', 'She likes to run in the park', 1, 'He runs every morning to stay fit', true)
                ON CONFLICT (profile_name, word_sense_id) DO NOTHING
            `);
        }
        
        console.log('[Database] Initialization completed successfully');
        // Test database connection explicitly after initialization
        return pool.connect();
    } catch (err) {
        console.error('[Database] Error initializing database:', err);
    } finally {
        client.release();
    }
}

// Initialize database on startup
initializeDatabase()
    .then(() => {
        console.log('[Database] Initialization completed successfully');
        // Test database connection explicitly after initialization
        return pool.connect();
    })
    .then(client => {
        console.log('[Database] Connection test successful after initialization');
        // Perform a quick test query to verify DB is working
        return client.query('SELECT current_timestamp AS server_time')
            .then(result => {
                console.log('[Database] Test query successful, server time:', result.rows[0].server_time);
                client.release();
            })
            .catch(err => {
                console.error('[Database] Test query failed:', err);
                client.release();
            });
    })
    .catch(err => {
        console.error('[Database] Initialization or connection test failed:', err);
    });
initializeDatabase().catch(err => {
    console.error('Failed to initialize database:', err);
});

// Legacy in-memory storage as fallback
const profileStorage = {
    // This will be populated from the database as needed
};

// Profile-specific words endpoints
// GET endpoint to retrieve flashcards and highlighted words for a specific profile
app.get('/api/profile/:profile/words', async (req, res) => {
    const profile = req.params.profile;
    
    console.log(`[Profile API] GET request for profile: ${profile}`);
    console.log(`[Profile API] REQUEST: ${req.method} ${req.originalUrl}`);
    console.log(`[Profile API] Headers:`, JSON.stringify(req.headers, null, 2));
    
    // DEBUG: If profile is 'mouse', insert a test flashcard
    if (profile === 'mouse') {
        try {
            console.log(`[Profile API] DEBUG: Creating test flashcard for 'mouse' profile`);
            const client = await pool.connect();
            
            // Get the structure of the flashcards table to see available columns
            const tableInfo = await client.query(
                `SELECT column_name FROM information_schema.columns 
                 WHERE table_name = 'flashcards' ORDER BY ordinal_position`
            );
            console.log(`[Profile API] DEBUG: Flashcards table columns:`, 
                tableInfo.rows.map(row => row.column_name).join(', '));
            

            client.release();
        } catch (err) {
            console.error('[DEBUG] Failed to upsert test flashcard for mouse:', err);
        }
    }
    
    try {
        console.log(`[Profile API] Attempting database connection for GET request`);
        const client = await pool.connect();
        console.log(`[Profile API] Database connection successful for GET request`);
        try {
            console.log(`[Profile API] Starting database operations for GET request`);
            // Check if profile exists, create if it doesn't
            console.log(`[Profile API] Checking if profile '${profile}' exists`);
            const profileCheck = await client.query('SELECT * FROM profiles WHERE profile_name = $1', [profile]);
            console.log(`[Profile API] Profile check result: ${profileCheck.rowCount} rows found`);
            
            if (profileCheck.rowCount === 0) {
                // Profile doesn't exist, create it
                console.log(`[Profile API] Profile '${profile}' doesn't exist, creating it`);
                const createResult = await client.query(
                    'INSERT INTO profiles (profile_name, selected_words) VALUES ($1, $2) RETURNING *', 
                    [profile, []]
                );
                console.log(`[Profile API] Profile created successfully:`, createResult.rows[0]);
            } else {
                console.log(`[Profile API] Profile exists:`, profileCheck.rows[0]);
            }
            
            // Get profile data
            console.log(`[Profile API] Retrieving selected_words for profile '${profile}'`);
            const profileResult = await client.query('SELECT selected_words FROM profiles WHERE profile_name = $1', [profile]);
            const selectedWords = profileResult.rows[0]?.selected_words || [];
            console.log(`[Profile API] Retrieved ${selectedWords.length} selected words`);
            
            // Get flashcards with detailed logging
            console.log(`[Profile API] Executing query to get flashcards for profile '${profile}'`);
            const flashcardsQuery = 'SELECT * FROM flashcards WHERE profile_name = $1';
            console.log(`[Profile API] SQL query: ${flashcardsQuery} with params [${profile}]`);
            
            const flashcardsResult = await client.query(flashcardsQuery, [profile]);
            console.log(`[Profile API] Flashcards query executed, returned ${flashcardsResult.rowCount} rows`);
            
            console.log(`[Profile API] Retrieved ${flashcardsResult.rowCount} flashcards from database for profile ${profile}`);
            if (flashcardsResult.rowCount > 0) {
                console.log(`[Profile API] Sample flashcard: ${JSON.stringify(flashcardsResult.rows[0])}`);
            }
            
            // Enhanced debugging
            flashcardsResult.rows.forEach((card, index) => {
                console.log(`[Profile API] Flashcard ${index + 1}: ${card.word_sense_id} - ${card.word}`);
            });
            
            // Format data to match the expected structure
            const flashcards = {};
            try {
                // Process all flashcards with error handling for each card
                for (const card of flashcardsResult.rows) {
                    try {
                        // Protect against null or invalid card data
                        if (!card || !card.word_sense_id || !card.word) {
                            console.log(`[Profile API] WARNING: Skipping invalid card data:`, card);
                            continue;
                        }
                        
                        // Create the proper word sense ID by combining word and definition number
                        // This ensures consistency with how the frontend creates IDs
                        const definitionNumber = card.definition_number || 1;
                        const properWordSenseId = `${card.word.toLowerCase()}${definitionNumber}`;
                        
                        console.log(`[Profile API] Creating flashcard entry with ID: ${properWordSenseId} (from DB ID: ${card.word_sense_id})`); 
                        
                        // Add the specific sense entry with the correct ID format
                        flashcards[properWordSenseId] = {
                            word: card.word,
                            wordSenseId: properWordSenseId, // Use the properly formatted ID
                            definition: card.definition || '',
                            translation: card.translation || '',
                            partOfSpeech: card.part_of_speech || 'unknown',
                            contextSentence: card.context || '', // Map to the expected frontend property name
                            context: card.context || '',
                            definitionNumber: definitionNumber,
                            example: card.example || '',
                            exampleSentencesRaw: card.example || '', // Additional property for frontend compatibility
                            inFlashcards: true // Always set this to true when coming from DB
                        };
                    } catch (cardError) {
                        console.error(`[Profile API] Error processing flashcard: ${card?.word_sense_id || 'unknown'}`, cardError);
                        // Continue processing other cards
                    }
                }
                
                // Remove any potential legacy base word entries that aren't actual flashcards
                // Only keep entries that have a wordSenseId property
                Object.keys(flashcards).forEach(key => {
                    const card = flashcards[key];
                    if (!card.wordSenseId) {
                        console.log(`[Profile API] Removing legacy base word entry: ${key}`);
                        delete flashcards[key];
                    }
                });
            } catch (dataProcessingError) {
                console.error(`[Profile API] Error processing flashcard data:`, dataProcessingError);
                // Continue with whatever flashcards were successfully processed
            }
            
            const profileData = {
                flashcards,
                selectedWords
            };
            
            // Very detailed logging of the actual response data
            console.log(`[Profile API] Returning ${Object.keys(profileData.flashcards).length} flashcards and ${profileData.selectedWords.length} selected words for profile: ${profile}`);
            console.log(`[Profile API] Flashcard keys: ${Object.keys(profileData.flashcards).join(', ')}`);
            
            // Log the actual content of the flashcards object
            console.log(`[Profile API] FULL RESPONSE DATA:`, JSON.stringify(profileData, null, 2));
            
            // Log a structured summary of what's being returned
            const flashcardSummary = Object.keys(profileData.flashcards).map(key => {
                const card = profileData.flashcards[key];
                // Only return a subset of info to avoid huge logs
                if (card.word) {
                    return { 
                        key,
                        word: card.word, 
                        hasDefinition: !!card.definition,
                        defLength: card.definition ? card.definition.length : 0,
                        inFlashcards: card.inFlashcards
                    };
                }
                return { key, type: 'baseWordEntry' };
            });
            
            if (flashcardSummary.length > 0) {
                console.log(`[Profile API] Flashcards summary:`, JSON.stringify(flashcardSummary, null, 2));
            } else {
                console.log(`[Profile API] WARNING: No flashcards found in response data`);
            }
            
            // Add a content-type header explicitly to ensure JSON parsing works correctly
            res.setHeader('Content-Type', 'application/json');
            
            console.log(`[Profile API] Sending response for GET /api/profile/${profile}/words`);
            
            // Create a direct string response to ensure proper formatting
            const responseString = JSON.stringify(profileData);
            console.log(`[Profile API] Response string length: ${responseString.length} bytes`);
            
            // Send the response as JSON
            res.status(200).send(responseString);
        } finally {
            client.release();
        }
    } catch (err) {
        console.error(`[Profile API] Error retrieving data for profile ${profile}:`, err);
        res.status(500).json({ error: 'Failed to retrieve profile data' });
    }
});

// POST endpoint to save flashcards and highlighted words for a specific profile
app.post('/api/profile/:profile/words', async (req, res) => {
    const { profile } = req.params;
    const { flashcards, selectedWords } = req.body;
    
    console.log(`[Profile API] POST request for profile: ${profile}`);
    console.log(`[Profile API] Received flashcards: ${Object.keys(flashcards || {}).length} entries`);
    console.log(`[Profile API] Received selectedWords: ${(selectedWords || []).length} entries`);
    console.log(`[Profile API] Request body: ${JSON.stringify(req.body, null, 2)}`);
    
    // Log a sample of flashcards (first 2) for debugging
    const flashcardKeys = Object.keys(flashcards || {});
    if (flashcardKeys.length > 0) {
        console.log(`[Profile API] Sample flashcard structure for ${flashcardKeys[0]}:`, 
            JSON.stringify(flashcards[flashcardKeys[0]], null, 2));
        if (flashcardKeys.length > 1) {
            console.log(`[Profile API] Sample flashcard structure for ${flashcardKeys[1]}:`, 
                JSON.stringify(flashcards[flashcardKeys[1]], null, 2));
        }
    }
    
    const client = await pool.connect();
    try {
        // Begin transaction
        console.log(`[Profile API] Starting database transaction`);
        const beginResult = await client.query('BEGIN');
        console.log(`[Profile API] Transaction started successfully`, beginResult);
        
        // Upsert profile to update selected words
        console.log(`[Profile API] Attempting to upsert profile with selectedWords`);
        try {
            const profileResult = await client.query(
                'INSERT INTO profiles (profile_name, selected_words, last_updated) VALUES ($1, $2, $3) ON CONFLICT (profile_name) DO UPDATE SET selected_words = $2, last_updated = $3 RETURNING *',
                [profile, selectedWords || [], new Date()]
            );
            console.log(`[Profile API] Profile upsert succeeded, rows affected:`, profileResult.rowCount);
            console.log(`[Profile API] Profile data:`, JSON.stringify(profileResult.rows[0], null, 2));
        } catch (profileErr) {
            console.error(`[Profile API] Profile upsert failed:`, profileErr);
            throw profileErr; // Rethrow to be caught by outer try/catch
        }
        
        // Handle flashcards - we need to do this as a multi-step process:
        // 1. Get existing flashcards for this profile
        console.log(`[Profile API] Querying existing flashcards for profile: ${profile}`);
        const existingFlashcardsResult = await client.query(
            'SELECT word_sense_id FROM flashcards WHERE profile_name = $1',
            [profile]
        );
        const existingFlashcardIds = existingFlashcardsResult.rows.map(row => row.word_sense_id);
        console.log(`[Profile API] Found ${existingFlashcardIds.length} existing flashcards in database`);
        console.log(`[Profile API] Existing flashcard IDs:`, existingFlashcardIds);
        
        // 2. Determine which flashcards to insert/update/delete
        const flashcardIds = Object.keys(flashcards || {});
        const flashcardsToDelete = existingFlashcardIds.filter(id => !flashcardIds.includes(id));
        console.log(`[Profile API] Total flashcards in request: ${flashcardIds.length}`);
        console.log(`[Profile API] Flashcards to delete: ${flashcardsToDelete.length}`);
        console.log(`[Profile API] Flashcards to insert/update: ${flashcardIds.length}`);
        
        // 3. Delete flashcards that are no longer present
        if (flashcardsToDelete.length > 0) {
            console.log(`[Profile API] Deleting ${flashcardsToDelete.length} flashcards that are no longer present`);
            try {
                const deleteResult = await client.query(
                    'DELETE FROM flashcards WHERE profile_name = $1 AND word_sense_id = ANY($2::varchar[]) RETURNING word_sense_id',
                    [profile, flashcardsToDelete]
                );
                console.log(`[Profile API] Successfully deleted ${deleteResult.rowCount} flashcards`);
                if (deleteResult.rows.length > 0) {
                    console.log(`[Profile API] Deleted flashcard IDs:`, deleteResult.rows.map(r => r.word_sense_id));
                }
            } catch (deleteErr) {
                console.error(`[Profile API] Error deleting flashcards:`, deleteErr);
                throw deleteErr;
            }
        }
        
        // 4. Upsert each flashcard
        for (const wordSenseId of flashcardIds) {
            const card = flashcards[wordSenseId];
            
            // Debug log to see the exact data we're working with
            console.log(`[Profile API] Processing flashcard: ${wordSenseId}`, JSON.stringify(card, null, 2));
            
            // If the card doesn't have a word property, add it using the key (wordSenseId)
            if (card && !card.word) {
                // Extract the base word from the wordSenseId (removing any trailing numbers)
                const baseWord = wordSenseId.replace(/\d+$/, '');
                console.log(`[Profile API] Adding missing word property: '${baseWord}' to flashcard ${wordSenseId}`);
                card.word = baseWord;
            }
            
            // Basic validation to prevent null card values
            if (!card) {
                console.error(`[Profile API] Invalid flashcard data for ${wordSenseId}: card is null/undefined`);
                console.log(`[Profile API] Skipping invalid flashcard: ${wordSenseId}`);
                continue; // Skip this flashcard
            }
            
            // Extract the values with appropriate fallbacks
            const wordValue = card.word || wordSenseId.replace(/\d+$/, '');
            const definitionValue = card.definition || '';
            const translationValue = card.translation || '';
            const partOfSpeechValue = card.partOfSpeech || 'unknown';
            const contextValue = card.contextSentence || card.context || '';
            
            // Parse definition number or extract from wordSenseId as fallback
            let definitionNumber = card.definitionNumber || null;
            if (definitionNumber === null || definitionNumber === undefined) {
                const numMatch = wordSenseId.match(/\d+$/);
                definitionNumber = numMatch ? parseInt(numMatch[0]) : 1;
            }
            
            // Example sentence fallback
            const exampleValue = card.example || card.exampleSentencesRaw || contextValue || '';
            
            try {
                console.log(`[Profile API] Executing upsert for flashcard ${wordSenseId} with SQL parameters:`);
                console.log(`  - profile: ${profile}`);
                console.log(`  - wordSenseId: ${wordSenseId}`);
                console.log(`  - word: ${wordValue}`);
                console.log(`  - definition: ${definitionValue.substring(0, 50)}${definitionValue.length > 50 ? '...' : ''}`);
                console.log(`  - partOfSpeech: ${partOfSpeechValue}`);
                console.log(`  - definitionNumber: ${definitionNumber}`);
                console.log(`  - inFlashcards: ${card.inFlashcards === false ? false : true}`);
                
                const flashcardResult = await client.query(`
                    INSERT INTO flashcards (
                        profile_name, word_sense_id, word, definition, translation, 
                        part_of_speech, context, definition_number, example, in_flashcards
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                    ON CONFLICT (profile_name, word_sense_id) DO UPDATE SET
                        word = $3,
                        definition = $4,
                        translation = $5,
                        part_of_speech = $6,
                        context = $7,
                        definition_number = $8,
                        example = $9,
                        in_flashcards = $10
                    RETURNING *
                `, [
                    profile,
                    wordSenseId,
                    wordValue,
                    definitionValue,
                    translationValue,
                    partOfSpeechValue,
                    contextValue,
                    definitionNumber,
                    exampleValue,
                    card.inFlashcards === false ? false : true
                ]);
                
                console.log(`[Profile API] Flashcard upsert result for ${wordSenseId}:`, {
                    success: flashcardResult.rowCount > 0,
                    operation: existingFlashcardIds.includes(wordSenseId) ? 'update' : 'insert',
                    rowCount: flashcardResult.rowCount
                });
            } catch (flashcardErr) {
                console.error(`[Profile API] Error upserting flashcard ${wordSenseId}:`, flashcardErr);
                throw flashcardErr;
            }
        }
        
        // Commit transaction
        console.log(`[Profile API] Attempting to commit transaction`);
        await client.query('COMMIT');
        console.log(`[Profile API] Transaction committed successfully`);
        
        // Verify data was saved by doing a count query
        const verifyResult = await client.query(
            'SELECT COUNT(*) FROM flashcards WHERE profile_name = $1',
            [profile]
        );
        console.log(`[Profile API] Verification: Profile ${profile} now has ${verifyResult.rows[0].count} flashcards in database`);
        
        console.log(`[Profile API] Successfully stored data for profile: ${profile}`);
        
        // Return success message
        res.json({
            success: true,
            message: `Data for profile '${profile}' saved successfully`,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        // Roll back transaction on error
        console.error(`[Profile API] ERROR storing data for profile ${profile}:`, err);
        console.log(`[Profile API] Rolling back transaction due to error`);
        try {
            await client.query('ROLLBACK');
            console.log(`[Profile API] Transaction rollback successful`);
        } catch (rollbackErr) {
            console.error(`[Profile API] Failed to rollback transaction:`, rollbackErr);
        }
        res.status(500).json({
            success: false,
            message: `Failed to save data for profile '${profile}'`,
            error: err.message
        });
    } finally {
        client.release();
    }
});

// Start the HTTP server
server.listen(PORT, () => {
    console.log(`HTTP server listening on port ${PORT}`);
});

// Room cleanup - run every minute
setInterval(() => {
    console.log('[Cleanup] Running room cleanup check');
    const now = Date.now();
    const MAX_ROOM_AGE_MS = 60 * 60 * 1000; // 60 minutes
    
    // Check each active room
    for (const [roomCode, roomData] of activeRooms.entries()) {
        const roomAge = now - roomData.createdAt;
        
        // If room is older than MAX_ROOM_AGE_MS, clean it up
        if (roomAge > MAX_ROOM_AGE_MS) {
            console.log(`[Cleanup] Removing inactive room: ${roomCode} (age: ${Math.floor(roomAge / 60000)} minutes)`);
            
            // Close all connections in this room
            if (roomData.hostWs && roomData.hostWs.readyState === WebSocket.OPEN) {
                roomData.hostWs.send(JSON.stringify({
                    type: 'room_expired',
                    message: 'This room has expired due to inactivity.'
                }));
                roomData.hostWs.close();
            }
            
            roomData.students.forEach(studentWs => {
                if (studentWs.readyState === WebSocket.OPEN) {
                    studentWs.send(JSON.stringify({
                        type: 'room_expired',
                        message: 'This room has expired due to inactivity.'
                    }));
                    studentWs.close();
                }
            });
            
            // Remove room data
            activeRooms.delete(roomCode);
            redisService.deleteRoom(roomCode).catch(console.error);
        }
    }
}, 60000); // Run every minute

// Global cleanup admin endpoint - clears all rejected rooms and force-disconnects problematic connections
app.post('/api/admin/global-cleanup', async (req, res) => {
    const adminKey = req.headers['x-admin-key'];
    
    // Basic authentication
    if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    try {
        // Count of all connections before
        const connectionsBefore = wss.clients.size;
        let closedConnections = 0;
        
        // Force close all problematic WebSocket connections
        wss.clients.forEach(client => {
            const clientRoom = clientRooms.get(client);
            
            // Close connections that either:
            // 1. Have no room association (lingering)
            // 2. Are students trying to connect to a room in the rejected list
            if (!clientRoom || 
                (clientRoom && !clientRoom.isHost && rejectedRoomCodes.has(clientRoom.roomCode))) {
                
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({
                        type: 'admin_terminated',
                        message: 'Your connection has been terminated by an administrator.'
                    }));
                    client.close();
                    closedConnections++;
                }
            }
        });
        
        // Count of rejected rooms before
        const rejectedBefore = rejectedRoomCodes.size;
        
        // Clear all rejected room codes
        rejectedRoomCodes.clear();
        
        return res.status(200).json({
            success: true,
            message: `Global cleanup completed. Closed ${closedConnections} of ${connectionsBefore} connections. Cleared ${rejectedBefore} rejected room codes.`
        });
    } catch (error) {
        console.error('[Admin] Error performing global cleanup:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Force-terminate a room (admin endpoint)
app.post('/api/admin/terminate-room/:roomCode', async (req, res) => {
    const { roomCode } = req.params;
    const adminKey = req.headers['x-admin-key'];
    
    // Basic authentication
    if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    try {
        if (activeRooms.has(roomCode)) {
            const roomData = activeRooms.get(roomCode);
            
            // Close all connections
            let disconnectedClients = 0;
            
            if (roomData.hostWs && roomData.hostWs.readyState === WebSocket.OPEN) {
                roomData.hostWs.send(JSON.stringify({
                    type: 'room_terminated',
                    message: 'This room has been terminated by an administrator.'
                }));
                roomData.hostWs.close();
                disconnectedClients++;
            }
            
            roomData.students.forEach(studentWs => {
                if (studentWs.readyState === WebSocket.OPEN) {
                    studentWs.send(JSON.stringify({
                        type: 'room_terminated',
                        message: 'This room has been terminated by an administrator.'
                    }));
                    studentWs.close();
                    disconnectedClients++;
                }
            });
            
            // Remove from memory and Redis
            activeRooms.delete(roomCode);
            await redisService.deleteRoom(roomCode);
            
            return res.status(200).json({ 
                success: true, 
                message: `Room ${roomCode} terminated. ${disconnectedClients} active connections closed.` 
            });
        } else {
            // Check if room exists in Redis
            const exists = await redisService.roomExists(roomCode);
            
            if (exists) {
                await redisService.deleteRoom(roomCode);
                return res.status(200).json({ 
                    success: true, 
                    message: `Room ${roomCode} deleted from persistent storage. No active connections.` 
                });
            } else {
                return res.status(404).json({ 
                    success: false, 
                    message: `Room ${roomCode} not found` 
                });
            }
        }
    } catch (error) {
        console.error(`[Admin] Error terminating room ${roomCode}:`, error);
        return res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Basic health check endpoint (optional)
app.get('/', (req, res) => {
    res.status(200).send('Polycast Backend Server is running.');
});

// Graceful shutdown (optional but good practice)
process.on('SIGTERM', () => {
    console.info('SIGTERM signal received: closing HTTP server');
    wss.close(() => {
        console.log('WebSocket server closed');
    });
    server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
});

// Export for testing purposes
// === Dictionary API Endpoints ===

// Endpoint to get definition from local JSON dictionary files
app.get('/api/local-dictionary/:letter/:word', async (req, res) => {
    const { letter, word } = req.params;
    const contextSentence = req.query.context || '';
    
    // Validate letter is a single character a-z
    if (!/^[a-z]$/.test(letter)) {
        return res.status(400).json({ error: 'Letter parameter must be a single letter a-z' });
    }
    
    try {
        // Get possible definitions for this word from a dictionary source
        // For now we're providing a simpler version without definitions list
        // In the actual implementation, we would fetch definitions from dictionary API
        
        // Use the new format with possible definitions
        const prompt = `You are helping a language learner understand the meaning of a word in a sentence.

Word: "${word}"
Context: "${contextSentence}"
Possible definitions:
1. A definition of ${word}
2. Another possible definition of ${word}

Which definition matches the word as used in the context sentence above? Respond with the word, followed by the text of the best matching definition, followed by the Spanish translation. These should be separated by '//', for example 'charge//To rush forward to attack.//cargar'`;
        
        // Log the prompt for debugging
        console.log('--- LLM Definition Prompt ---');
        console.log(prompt);
        console.log('--- End LLM Definition Prompt ---');
        
        // If this is a test or development environment, return mock data
        if (process.env.NODE_ENV === 'test' || process.env.MOCK_LLM === 'true') {
            console.log('Using mock LLM data for dictionary');
            return res.json(mockDictionaryResponse(word));
        }
        
        // Generate the response directly with Gemini
        const llmResponse = await generateTextWithGemini(prompt, 0.3);
        
        // Parse the JSON response
        try {
            // Parse the response in the format: word//definition//translation
            const parts = llmResponse.trim().split('//');
            
            if (parts.length >= 3) {
                const responseWord = parts[0].trim();
                const responseDefinition = parts[1].trim();
                const translation = parts[2].trim();
                
                console.log(`Parsed response for ${word}:`, { responseWord, responseDefinition, translation });
                
                // Format response to be compatible with existing frontend expectations
                const normalizedResponse = {
                    word: responseWord,
                    translation: translation,
                    partOfSpeech: 'unknown', // We don't get this in the new format
                    frequencyRating: 3, // Default value since we don't get this in the new format
                    definitions: [{
                        text: responseDefinition,
                        example: contextSentence || 'No example available.'
                    }],
                    isContextual: true
                };
                
                res.json(normalizedResponse);
            } else {
                console.log(`Invalid response format for ${word}:`, llmResponse);
                throw new Error('Response not in expected format (word//definition//translation)');
            }
        } catch (parseError) {
            console.error(`Error parsing LLM response for ${word}:`, parseError);
            throw new Error('Failed to parse LLM response');
        }
    } catch (error) {
        console.error(`Error getting definition for ${word}:`, error);
        res.status(500).json({ error: 'Failed to get definition', message: error.message });
    }
});

// New endpoint for disambiguating word definitions using Gemini
app.post('/api/disambiguate-word', async (req, res) => {
    try {
        const { word, contextSentence, definitions, existingFlashcardSenseIds = [] } = req.body;
        
        if (!word || !contextSentence || !definitions || !Array.isArray(definitions)) {
            return res.status(400).json({ 
                error: 'Missing required parameters (word, contextSentence, definitions)' 
            });
        }
        
        console.log(`\n[WORD SENSE DISAMBIGUATION] Processing '${word}' in context: "${contextSentence}"`);
        console.log(`[WORD SENSE DISAMBIGUATION] Found ${definitions.length} possible definitions in dictionary`);
        
        // The context sentence may have the target word emphasized with asterisks
        // Example: "I am going to *charge* my phone"
        console.log(`Context received with emphasis: ${contextSentence}`);

        // Create a prompt for the LLM to use context to disambiguate
        const prompt = `You are helping a language learner understand the meaning of a word in a sentence.

Word: "${word}"
Context: "${contextSentence}"
Possible definitions:
${definitions.map((def, idx) => `${idx + 1}. (${def.partOfSpeech}) ${def.definition}`).join('\n')}

Which definition matches the word as used in the context sentence above? Respond with the word, followed by the text of the best matching definition, followed by the Spanish translation. These should be separated by '//', for example 'charge//To rush forward to attack.//cargar'`;
        
        console.log(`[WORD SENSE DISAMBIGUATION] Sending prompt to Gemini for disambiguation (FIRST CALL)`);
        console.log(`==================================================`);
        console.log(`DISAMBIGUATION CALL - PROMPT:`);
        console.log(prompt);
        console.log(`==================================================`);
        
        // Call Gemini API with a custom function since llmService doesn't have generateText
        // Pass a specific debug tag for tracking in logs
        const response = await generateTextWithGemini(prompt, 0.1, 'DISAMBIGUATE');
        
        console.log(`==================================================`);
        console.log(`DISAMBIGUATION CALL - RESPONSE:`);
        console.log(response);
        console.log(`==================================================`);
        
        // Parse the response in the format: word//definition//translation
        const parts = response.trim().split('//');
        
        if (parts.length >= 3) {
            const responseWord = parts[0].trim();
            const responseDefinition = parts[1].trim();
            const translation = parts[2].trim();
            
            // Find the dictionary definition entry that best matches the response
            const bestMatch = definitions.find(def => 
                def.definition.toLowerCase().includes(responseDefinition.toLowerCase()) || 
                responseDefinition.toLowerCase().includes(def.definition.toLowerCase()));
            
            // If we can't find a match, use the first definition or create a simple one
            const matchedDefinition = bestMatch || {
                partOfSpeech: 'unknown',
                definition: responseDefinition
            };
            
            console.log(`[WORD SENSE DISAMBIGUATION] Gemini identified definition: ${responseDefinition}`);
            console.log(`[WORD SENSE DISAMBIGUATION] Translation: ${translation}`);
            
            // Create a unique sense ID for this definition
            const definitionHash = responseDefinition.substring(0, 8).replace(/\W+/g, '');
            const wordSenseId = `${word.toLowerCase()}_${matchedDefinition.partOfSpeech || 'unknown'}_${definitionHash}`;
            
            // STEP 2: Generate example sentences and frequency ratings
            console.log(`[WORD SENSE DISAMBIGUATION] Step 2: Generating examples and frequency ratings`);
            
            const examplesPrompt = `Return three example sentences using the word '${responseWord}' in the context of '${responseDefinition}' with each sentence separated by '//.' After the three sentences, provide a frequency rating of 1-5 for how common that word is, followed by a frequency rating for how common that definition is for that word.

Use the following criteria:

Vocabulary Frequency (1–5):
Rate how common the word is in general vocabulary, considering how likely it is to appear in everyday conversation, school materials, news articles, and basic media.
1: Highly rare or technical; almost never appears outside specific fields
2: Somewhat uncommon; appears occasionally in books or niche conversations
3: Neutral; part of educated vocabulary but not basic
4: Common; heard regularly by most speakers
5: Core/basic vocabulary known and used by nearly all fluent speakers

Definition Frequency (1–5):
Rate how common this specific meaning of the word is compared to its other meanings.
1: Obscure or outdated definition
2: Infrequently used definition
3: Less typical but still recognized
4: One of the common meanings
5: Most typical or dominant meaning

Examples for calibration:
- "apple" as a fruit = 5, "deciduous" = 2, "syzygy" = 1
- "run" meaning "to jog" = 5, "run" meaning "to operate a play" = 3, "run" meaning "a small stream" = 2

Your response should follow this exact format without any additional text:
[example sentence 1]//[example sentence 2]//[example sentence 3]//[word frequency]//[definition frequency]`;
            
            let examples = [];
            let wordFrequency = 3;
            let definitionFrequency = 3;
            
            try {
                console.log(`[WORD SENSE DISAMBIGUATION] Sending prompt to Gemini for examples (SECOND CALL)`);
                console.log(`==================================================`);
                console.log(`2ND CALL - PROMPT:`);
                console.log(examplesPrompt);
                console.log(`==================================================`);
                
                // Call Gemini API for example sentences and frequency ratings
                // Pass a specific debug tag for tracking in logs
                const examplesResponse = await generateTextWithGemini(examplesPrompt, 0.2, 'EXAMPLES');
                
                console.log(`==================================================`);
                console.log(`2ND CALL - RESPONSE:`);
                console.log(examplesResponse);
                console.log(`==================================================`);
                
                // Parse the response (example1//example2//example3//wordFreq//defFreq)
                const exampleParts = examplesResponse.trim().split('//');
                
                if (exampleParts.length >= 5) {
                    examples = [
                        exampleParts[0].trim(),
                        exampleParts[1].trim(),
                        exampleParts[2].trim()
                    ];
                    wordFrequency = parseInt(exampleParts[3].trim(), 10) || 3;
                    definitionFrequency = parseInt(exampleParts[4].trim(), 10) || 3;
                    
                    console.log(`[WORD SENSE DISAMBIGUATION] Successfully parsed examples and frequencies`);
                    console.log(`Word frequency: ${wordFrequency}, Definition frequency: ${definitionFrequency}`);
                } else {
                    console.log(`[WORD SENSE DISAMBIGUATION] Unexpected examples response format. Using defaults.`);
                    // Generate simple example sentences as fallback
                    examples = [
                        `The word "${word}" can be used in a sentence like this.`,
                        `Here is another example with "${word}".`,
                        `"${word}" is also used in this way.`
                    ];
                }
            } catch (exampleError) {
                console.error(`[WORD SENSE DISAMBIGUATION] Error generating examples:`, exampleError);
                examples = [
                    `The word "${word}" can be used in a sentence like this.`,
                    `Here is another example with "${word}".`,
                    `"${word}" is also used in this way.`
                ];
            }
            
            // Check if we already have a flashcard for this sense
            if (existingFlashcardSenseIds.includes(wordSenseId)) {
                console.log(`[WORD SENSE DISAMBIGUATION] ⚠️ This sense of '${word}' already exists in flashcards. No new card needed.`);
                return res.json({
                    word,
                    contextSentence,
                    disambiguatedDefinition: {
                        ...matchedDefinition,
                        translation: translation,
                        responseDefinition: responseDefinition
                    },
                    examples: examples,
                    wordFrequency: wordFrequency,
                    definitionFrequency: definitionFrequency,
                    wordSenseId,
                    existingFlashcard: true,
                    rawLlmResponse: response
                });
            } else {
                console.log(`[WORD SENSE DISAMBIGUATION] ✓ New sense of '${word}' identified! Creating new flashcard with ID: ${wordSenseId}`);
                return res.json({
                    word,
                    contextSentence,
                    disambiguatedDefinition: {
                        ...matchedDefinition,
                        translation: translation,
                        responseDefinition: responseDefinition
                    },
                    examples: examples,
                    wordFrequency: wordFrequency,
                    definitionFrequency: definitionFrequency,
                    wordSenseId,
                    existingFlashcard: false,
                    rawLlmResponse: response
                });
            }
        } else {
            console.log(`[WORD SENSE DISAMBIGUATION] ⚠️ Failed to parse Gemini response in expected format`);
            // Try to extract something useful from the response
            const cleanResponse = response.trim();
            const fallbackDefinition = definitions.length > 0 ? definitions[0] : { 
                partOfSpeech: 'unknown',
                definition: 'No definition available' 
            };
            
            return res.json({
                word,
                contextSentence,
                allDefinitions: definitions,
                disambiguatedDefinition: {
                    ...fallbackDefinition,
                    translation: 'Translation unavailable',
                    responseDefinition: cleanResponse.includes('//') ? cleanResponse.split('//')[1] : cleanResponse
                },
                wordSenseId: `${word.toLowerCase()}_${fallbackDefinition.partOfSpeech || 'unknown'}_fallback`,
                rawLlmResponse: response,
                error: 'Could not parse Gemini response in expected format'
            });
        }
    } catch (error) {
        console.error('[WORD SENSE DISAMBIGUATION] Error:', error);
        return res.status(500).json({ error: 'Error disambiguating definition' });
    }
});

// Helper function to find the best matching definition from the LLM response
// Helper function to find the best matching definition from the LLM response
// Returns { match: <definition object>, sampleSentence: <string|null> }
function findBestMatchingDefinition(llmResponse, definitions) {
    if (!llmResponse || !definitions || !definitions.length) {
        console.log('[WORD SENSE DISAMBIGUATION] Empty response or definitions');
        return null;
    }
    
    console.log('[WORD SENSE DISAMBIGUATION] Parsing response:', llmResponse.substring(0, 200));
    
    // First try to parse JSON from the response
    try {
        // Extract JSON object if it's embedded in text
        const jsonMatch = llmResponse.match(/\{[\s\S]*?\}/); // Find first JSON-like object
        let sampleSentence = null;
        
        if (jsonMatch) {
            const jsonStr = jsonMatch[0];
            console.log('[WORD SENSE DISAMBIGUATION] Found JSON:', jsonStr);
            
            const parsedResponse = JSON.parse(jsonStr);
            if (parsedResponse.sampleSentence) {
                sampleSentence = parsedResponse.sampleSentence;
            }
            if (parsedResponse.partOfSpeech && parsedResponse.definition) {
                // Find the definition that matches both part of speech and definition
                const exactMatch = definitions.find(def => 
                    def.partOfSpeech.toLowerCase() === parsedResponse.partOfSpeech.toLowerCase() && 
                    def.definition.toLowerCase() === parsedResponse.definition.toLowerCase()
                );
                
                if (exactMatch) {
                    console.log('[WORD SENSE DISAMBIGUATION] Found exact match from JSON response');
                    return { match: exactMatch, sampleSentence };
                }
                
                // If no exact match, find the closest match
                let bestMatch = null;
                let highestSimilarity = 0;
                
                for (const def of definitions) {
                    // Check part of speech first
                    if (def.partOfSpeech.toLowerCase() === parsedResponse.partOfSpeech.toLowerCase()) {
                        const similarity = calculateSimilarity(parsedResponse.definition, def.definition);
                        
                        if (similarity > highestSimilarity) {
                            highestSimilarity = similarity;
                            bestMatch = def;
                        }
                    }
                }
                
                if (bestMatch) {
                    console.log('[WORD SENSE DISAMBIGUATION] Found best match from JSON by similarity');
                    return { match: bestMatch, sampleSentence };
                }
            }
        }
    } catch (e) {
        console.log('[WORD SENSE DISAMBIGUATION] Error parsing JSON:', e.message);
        // Fall back to the original method if JSON parsing fails
    }
    
    // Fallback: Try to find exact text matches
    for (const def of definitions) {
        const fullDefinition = `(${def.partOfSpeech}) ${def.definition}`;
        if (llmResponse.includes(fullDefinition)) {
            console.log('[WORD SENSE DISAMBIGUATION] Found match by exact text');
            return { match: def, sampleSentence: null };
        }
    }
    
    // If no exact match, use partial matching on the definition text
    let bestMatch = null;
    let highestSimilarity = 0;
    
    for (const def of definitions) {
        // Simple similarity check - how much of the definition is in the response
        const similarity = calculateSimilarity(llmResponse, def.definition);
        
        if (similarity > highestSimilarity) {
            highestSimilarity = similarity;
            bestMatch = def;
        }
    }
    
    console.log('[WORD SENSE DISAMBIGUATION] Found match by text similarity');
    return { match: bestMatch, sampleSentence: null };
}

// Simple function to calculate text similarity
function calculateSimilarity(text1, text2) {
    const text1Lower = text1.toLowerCase();
    const text2Lower = text2.toLowerCase();
    
    // Count how many words from text2 appear in text1
    const words = text2Lower.split(/\s+/);
    let matches = 0;
    
    for (const word of words) {
        if (word.length > 3 && text1Lower.includes(word)) { // Only check words longer than 3 chars
            matches++;
        }
    }
    
    return matches / words.length; // Return percentage of matching words
}

/**
 * A simple function to generate text using Gemini
 * Since llmService doesn't have a direct generateText function,
 * we'll implement our own here using the same initialization pattern
 * @param {string} prompt The prompt to send to Gemini
 * @param {number} temperature The temperature setting (0-1)
 * @returns {Promise<string>} The generated text response
 */
async function generateTextWithGemini(prompt, temperature = 0.7, debugTag = '') {
    try {
        // Make sure we have the Google API key available
        if (!process.env.GOOGLE_API_KEY) {
            throw new Error('Google API Key (GOOGLE_API_KEY) is not configured');
        }
        
        // More explicit debugging for Render.com to clearly see what's happening
        const tag = debugTag ? `[GEMINI-${debugTag}]` : '[GEMINI]';
        
        console.log('====================================================================');
        console.log(`${tag} GENERATING TEXT [temperature=${temperature}]`);
        console.log(`${tag} PROMPT SUMMARY: ${prompt.substring(0, 100)}...`);
        console.log('====================================================================');
        
        // Use the raw Google API directly instead of going through llmService
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
        const model = genAI.getGenerativeModel({ model: "models/gemini-2.0-flash" });
        
        // Generate content with the provided temperature
        console.log(`${tag} SENDING REQUEST TO GEMINI API...`);
        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { temperature: temperature }
        });
        
        const response = result.response;
        const text = response.text();
        
        console.log('====================================================================');
        console.log(`${tag} RECEIVED RESPONSE [${text.length} chars]`);
        console.log(`${tag} RESPONSE SUMMARY: ${text.substring(0, 100)}...`);
        console.log('====================================================================');
        
        return text;
    } catch (error) {
        console.error('====================================================================');
        console.error(`[GEMINI-ERROR] ERROR GENERATING TEXT:`);
        console.error(error);
        console.error('====================================================================');
        throw error;
    }
}

module.exports = { server, wss };
