const url = require('url');
const handleWebSocketMessage = require('./messageHandler');
const { activeRooms } = require('../utils/room');
const redisService = require('../../services/redisService');

const rejectedRoomCodes = new Set();
const clientTextBuffers = new Map();
const clientTargetLanguages = new Map();
const clientRooms = new Map();

function handleWebSocketConnection(ws, req, heartbeat, isTextMode) {
    ws.isAlive = true;
    ws.on('pong', heartbeat);

    const parsedUrl = url.parse(req.url, true);
    const query = parsedUrl.query;

    if (query && query.roomCode && query.isHost === 'false' && rejectedRoomCodes.has(query.roomCode)) {
        console.log(`[Room] Immediately rejected student connection for known bad room code: ${query.roomCode}`);
        ws.send(JSON.stringify({
            type: 'room_error',
            message: 'This room does not exist or has expired. Please check the code and try again.'
        }));
        ws.close();
        return;
    }

    const joinRoomTimeout = setTimeout(() => {
        if (!clientRooms.has(ws) && ws.readyState === ws.OPEN) {
            console.log('[Room] Closing connection - timed out waiting to join a room');
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Connection timed out waiting to join a room.'
            }));
            ws.close();
        }
    }, 60000);

    let targetLangsArray = [];
    try {
        if (query && query.targetLangs) {
            targetLangsArray = query.targetLangs
                .split(',')
                .map(lang => decodeURIComponent(lang.trim()))
                .filter(lang => lang.length > 0);
            console.log(`Client connected. Target languages from URL: ${targetLangsArray.join(', ')}`);
        } else {
            console.log(`Client connected. No targetLangs in URL, no languages set`);
        }
    } catch (e) {
        console.error('Error parsing connection URL for target languages:', e);
    }

    if (query && query.roomCode) {
        const roomCode = query.roomCode;
        const isHost = query.isHost === 'true';

        if (!activeRooms.has(roomCode)) {
            if (isHost) {
                activeRooms.set(roomCode, { hostWs: ws, students: [], transcript: [], createdAt: Date.now() });
                console.log(`[Room] Host created room on connect: ${roomCode}`);
            } else {
                console.log(`[Room] Rejected student - room not found: ${roomCode}`);
                rejectedRoomCodes.add(roomCode);
                ws.send(JSON.stringify({ type: 'room_error', message: 'Room not found. Please check the code and try again.' }));
                ws.close();
                return;
            }
        } else {
            const room = activeRooms.get(roomCode);
            if (isHost) {
                room.hostWs = ws;
                console.log(`[Room] Host joined existing room: ${roomCode}`);
            } else {
                room.students.push(ws);
                console.log(`[Room] Student joined room: ${roomCode} (total students: ${room.students.length})`);
                if (room.transcript.length > 0) {
                    ws.send(JSON.stringify({ type: 'transcript_history', data: room.transcript }));
                }
            }
        }

        clientRooms.set(ws, { roomCode, isHost });
        clearTimeout(joinRoomTimeout);

        ws.send(JSON.stringify({
            type: 'room_joined',
            roomCode,
            isHost,
            message: isHost ? `You are hosting room ${roomCode}` : `You joined room ${roomCode} as a student`
        }));
    }

    clientTargetLanguages.set(ws, targetLangsArray);
    clientTextBuffers.set(ws, { text: '', lastEndTimeMs: 0 });

    ws.on('message', (message) => handleWebSocketMessage(ws, message, { clientRooms, clientTargetLanguages, activeRooms, isTextMode }));

    ws.on('close', async () => {
        clearTimeout(joinRoomTimeout);
        const clientRoom = clientRooms.get(ws);
        if (clientRoom) {
            const { roomCode, isHost } = clientRoom;
            const room = activeRooms.get(roomCode);
            if (room) {
                if (isHost) {
                    console.log(`[Room] Host disconnected from room: ${roomCode}`);
                    const keepRoomOpen = true; 
                    if (!keepRoomOpen) {
                        room.students.forEach(student => {
                            if (student.readyState === WebSocket.OPEN) {
                                student.send(JSON.stringify({ type: 'host_disconnected', message: 'The host has ended the session.' }));
                            }
                        });
                        try {
                            await redisService.deleteRoom(roomCode);
                            console.log(`[Room] Successfully deleted room ${roomCode} from Redis`);
                        } catch (error) {
                            console.error(`[Room] Failed to delete room ${roomCode} from Redis:`, error);
                        }
                        activeRooms.delete(roomCode);
                    } else {
                        console.log(`[Room] Keeping room ${roomCode} open even though host disconnected`);
                        try {
                            await redisService.saveRoom(roomCode, room);
                        } catch (error) {
                            console.error(`[Room] Failed to update room ${roomCode} in Redis after host disconnect:`, error);
                        }
                    }
                } else {
                    console.log(`[Room] Student disconnected from room: ${roomCode}`);
                    room.students = room.students.filter(student => student !== ws);
                    console.log(`[Room] Room ${roomCode} now has ${room.students.length} student(s)`);
                    try {
                        await redisService.saveRoom(roomCode, room);
                    } catch (error) {
                        console.error(`[Room] Failed to update room ${roomCode} in Redis after student disconnect:`, error);
                    }
                }
            }
            clientRooms.delete(ws);
        }
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
}

module.exports = handleWebSocketConnection;
