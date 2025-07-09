const WebSocket = require('ws');
const { transcribeAudio } = require('../services/whisperService');
const llmService = require('../services/llmService');
const textModeLLM = require('../services/textModeLLM');
const redisService = require('../services/redisService');

async function handleWebSocketMessage(ws, message, clientData) {
    const { clientRooms, clientTargetLanguages, activeRooms, isTextMode } = clientData;
    
    console.log('[WS DEBUG] Raw message:', message);
    console.log('[WS DEBUG] typeof message:', typeof message);
    
    const clientRoom = clientRooms.get(ws);
    const isInRoom = !!clientRoom;
    const isRoomHost = isInRoom && clientRoom.isHost;
    
    if (isInRoom && !isRoomHost) {
        console.log(`[Room] Rejected message from student in room ${clientRoom.roomCode}`);
        ws.send(JSON.stringify({ 
            type: 'error', 
            message: 'Students cannot send audio or text for transcription' 
        }));
        return;
    }
    
    if (Buffer.isBuffer(message)) {
        try {
            const msgString = message.toString('utf8');
            const data = JSON.parse(msgString);
            if (data && data.type === 'text_submit') {
                if (isTextMode) {
                    await handleTextSubmit(ws, data, clientData);
                } else {
                    ws.send(JSON.stringify({ type: 'error', message: 'Text submissions are only allowed in text mode.' }));
                }
                return;
            }
        } catch (err) {
            // Not JSON, so treat as audio buffer
        }
        await handleAudioMessage(ws, message, clientData);
    } else if (typeof message === 'string') {
        try {
            const data = JSON.parse(message);
            if (data.type === 'text_submit') {
                if (isTextMode) {
                    await handleTextSubmit(ws, data, clientData);
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
}

async function handleTextSubmit(ws, data, clientData) {
    const { clientRooms, clientTargetLanguages, activeRooms } = clientData;
    const clientRoom = clientRooms.get(ws);
    const isRoomHost = clientRoom && clientRoom.isHost;

    const translateThis = data.text;
    const sourceLang = data.lang;
    const targetLangs = clientTargetLanguages.get(ws) || [];
    const allLangs = Array.from(new Set(['English', ...targetLangs]));
    
    const translations = await textModeLLM.translateTextBatch(translateThis, sourceLang, allLangs);
    
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

    try {
        const transcription = await transcribeAudio(message, 'audio.webm');
        if (transcription && ws.readyState === ws.OPEN) {
            let targetLangs = clientTargetLanguages.get(ws) || [];
            
            const translations = await llmService.translateTextBatch(transcription, targetLangs);
            
            const recognizedResponse = { type: 'recognized', data: transcription };
            ws.send(JSON.stringify(recognizedResponse));
            
            if (isRoomHost) {
                const room = activeRooms.get(clientRoom.roomCode);
                if (room) {
                    room.transcript.push({ text: transcription, timestamp: Date.now() });
                    if (room.transcript.length > 50) {
                        room.transcript = room.transcript.slice(-50);
                    }
                    
                    room.students.forEach(student => {
                        if (student.readyState === WebSocket.OPEN) {
                            student.send(JSON.stringify(recognizedResponse));
                            for (const lang of targetLangs) {
                                student.send(JSON.stringify({ type: 'translation', lang, data: translations[lang] }));
                            }
                        }
                    });
                    
                    redisService.updateTranscript(clientRoom.roomCode, room.transcript)
                        .catch(err => console.error(`[Redis] Failed to update transcript for room ${clientRoom.roomCode}:`, err));
                }
            }
            
            for (const lang of targetLangs) {
                ws.send(JSON.stringify({ type: 'translation', lang, data: translations[lang] }));
            }
        }
    } catch (err) {
        console.error('Whisper transcription error:', err);
        if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ type: 'error', message: 'Transcription failed: ' + err.message + ' (Try using Chrome or Edge)' }));
        }
    }
}

module.exports = handleWebSocketMessage;
