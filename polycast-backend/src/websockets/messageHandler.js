const WebSocket = require('ws');
const { createStreamingSession } = require('../services/deepgramService');
const llmService = require('../services/llmService');
const redisService = require('../services/redisService');

async function handleWebSocketMessage(ws, message, clientData) {
    const { clientRooms, clientTargetLanguages, activeRooms } = clientData;

    const clientRoom = clientRooms.get(ws);
    const isInRoom = !!clientRoom;
    const isRoomHost = isInRoom && clientRoom.isHost;

    // Helper to detect signaling frames regardless of transport form
    function isSignalingPayload(raw) {
        try {
            if (Buffer.isBuffer(raw)) {
                const s = raw.toString('utf8');
                const d = JSON.parse(s);
                return d && (d.type === 'webrtc_offer' || d.type === 'webrtc_answer' || d.type === 'webrtc_ice');
            }
            if (typeof raw === 'string') {
                const d = JSON.parse(raw);
                return d && (d.type === 'webrtc_offer' || d.type === 'webrtc_answer' || d.type === 'webrtc_ice');
            }
        } catch (_) {}
        return false;
    }

    // Previously blocked student audio; now allow students to send audio for transcription
    // Keep allowing signaling payloads as before

    if (Buffer.isBuffer(message)) {
        try {
            const msgString = message.toString('utf8');
            const data = JSON.parse(msgString);
            if (data && data.type === 'text_submit') {
                ws.send(JSON.stringify({ type: 'error', message: 'Text submissions are not supported.' }));
                return;
            }
            // Buffer payloads can also carry signaling in some clients; handle here
            if (data && (data.type === 'webrtc_offer' || data.type === 'webrtc_answer' || data.type === 'webrtc_ice')) {
                console.log('[Signaling] Buffer payload', data.type);
                return forwardSignaling(ws, data, { clientRooms, activeRooms });
            }
        } catch (err) {
            // Not JSON, so treat as audio buffer
        }
        await handleAudioMessage(ws, message, clientData);
    } else if (typeof message === 'string') {
        try {
            const data = JSON.parse(message);
            if (data.type === 'text_submit') {
                ws.send(JSON.stringify({ type: 'error', message: 'Text submissions are not supported.' }));
            } else if (data.type === 'webrtc_offer' || data.type === 'webrtc_answer' || data.type === 'webrtc_ice') {
                console.log('[Signaling] Text payload', data.type);
                return forwardSignaling(ws, data, { clientRooms, activeRooms });
            }
        } catch (err) {
            console.error('Failed to parse or handle text_submit:', err);
        }
    } else {
        console.warn('[Server] Received unexpected non-buffer message, ignoring.');
    }
}

// Minimal signaling forwarder for 1:1 calls (host <-> first student)
function forwardSignaling(ws, data, { clientRooms, activeRooms }) {
    const clientRoom = clientRooms.get(ws);
    if (!clientRoom) return;
    const { roomCode, isHost } = clientRoom;
    const room = activeRooms.get(roomCode);
    if (!room) return;

    // Determine target peer
    let targets = [];
    if (isHost) {
        // Host sends to the first student only for now (1:1)
        targets = room.students.slice(0, 1);
    } else {
        // Student sends to the host
        if (room.hostWs) targets = [room.hostWs];
    }

    console.log(`[Signaling] Forwarding ${data.type} from ${isHost ? 'host' : 'student'} in room ${roomCode} to ${targets.length} peer(s)`);

    for (const peer of targets) {
        try {
            if (peer && peer.readyState === WebSocket.OPEN) {
                peer.send(JSON.stringify(data));
            }
        } catch (err) {
            console.error('[Signaling] Failed to forward signaling message:', err);
        }
    }
}

async function handleTextSubmit(ws, data, clientData) {
    const { clientRooms, clientTargetLanguages, activeRooms } = clientData;
    const clientRoom = clientRooms.get(ws);
    const isRoomHost = clientRoom && clientRoom.isHost;

    const translateThis = data.text;
    const sourceLang = data.lang;
    const targetLangs = clientTargetLanguages.get(ws) || [];
    const allLangs = Array.from(new Set(['English', ...targetLangs]));

    const translations = await llmService.translateTextBatch(translateThis, allLangs, sourceLang);

    const hostResponse = {
        type: 'recognized',
        lang: sourceLang,
        data: translateThis
    };

    ws.send(JSON.stringify(hostResponse));

    if (isRoomHost) {
        const room = activeRooms.get(clientRoom.roomCode);
        if (room) {
            room.transcript.push({ text: translateThis, timestamp: Date.now() });
            if (room.transcript.length > 50) {
                room.transcript.slice(-50);
            }
            room.students.forEach(student => {
                if (student.readyState === WebSocket.OPEN) {
                    student.send(JSON.stringify(hostResponse));
                    for (const lang of allLangs) {
                        if (lang !== sourceLang) {
                            student.send(JSON.stringify({ type: 'translation', lang, data: translations[lang] }));
                        }
                    }
                }
            });
        }
    }
    for (const lang of allLangs) {
        if (lang !== sourceLang) {
            ws.send(JSON.stringify({ type: 'translation', lang, data: translations[lang] }));
        }
    }
}

async function handleAudioMessage(ws, message, clientData) {
    const { clientRooms, clientTargetLanguages, activeRooms } = clientData;
    const clientRoom = clientRooms.get(ws);
    const isRoomHost = clientRoom && clientRoom.isHost;

    // Handle stop streaming signal
    if (message.toString() === 'STOP_STREAM') {
        if (ws.deepgramSession) {
            console.log('[Audio] Closing Deepgram streaming session');
            ws.deepgramSession.close();
            ws.deepgramSession = null;
        }
        return;
    }

    // Initialize Deepgram streaming session if not exists
    if (!ws.deepgramSession) {
        console.log('[Audio] Creating new Deepgram streaming session');
        console.log('[Audio] Environment:', process.env.NODE_ENV || 'development');
        console.log('[Audio] Deepgram API Key configured:', !!require('../config/config').deepgramApiKey);
        ws.deepgramSession = createStreamingSession(
            (transcript, isInterim) => {
                // Send real-time updates to frontend
                const response = {
                    type: 'streaming_transcript',
                    text: transcript,
                    isInterim: isInterim,
                    speaker: isRoomHost ? 'host' : 'student'
                };
                console.log('[Transcript] Sending to client:', { text: transcript.substring(0, 50), isInterim });
                ws.send(JSON.stringify(response));
                
                // Broadcast to peer(s)
                if (isRoomHost) {
                    const room = activeRooms.get(clientRoom.roomCode);
                    if (room) {
                        room.students.forEach(student => {
                            if (student.readyState === WebSocket.OPEN) {
                                student.send(JSON.stringify(response));
                            }
                        });
                        
                        // Store only final transcripts
                        if (!isInterim) {
                            room.transcript.push({ text: transcript, timestamp: Date.now() });
                            if (room.transcript.length > 50) {
                                room.transcript = room.transcript.slice(-50);
                            }
                            redisService.updateTranscript(clientRoom.roomCode, room.transcript)
                                .catch(err => console.error(`[Redis] Failed to update transcript:`, err));
                        }
                    }
                } else {
                    // Student speaking → forward to host
                    const room = activeRooms.get(clientRoom.roomCode);
                    if (room && room.hostWs && room.hostWs.readyState === WebSocket.OPEN) {
                        room.hostWs.send(JSON.stringify(response));
                    }
                }
                
                // Translation calls are commented out for now
                // if (!isInterim) {
                //     const targetLangs = clientTargetLanguages.get(ws) || [];
                //     const translations = await llmService.translateTextBatch(transcript, targetLangs);
                //     for (const lang of targetLangs) {
                //         ws.send(JSON.stringify({ type: 'translation', lang, data: translations[lang] }));
                //     }
                // }
            },
            (error) => {
                console.error('[Deepgram] Streaming error:', error.message || error);
                console.error('[Deepgram] Error details:', JSON.stringify(error));
                ws.send(JSON.stringify({
                    type: 'error',
                    message: 'Streaming transcription error: ' + error.message
                }));
            }
        );
    }
    
    // Forward audio chunk to Deepgram
    try {
        // console.log('[Audio] Forwarding', message.length, 'bytes to Deepgram'); // noisy; keep commented
        ws.deepgramSession.send(message);
    } catch (err) {
        console.error('[Audio] Error sending to Deepgram:', err.message || err);
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Failed to send audio to transcription service'
        }));
    }
}

module.exports = handleWebSocketMessage;
