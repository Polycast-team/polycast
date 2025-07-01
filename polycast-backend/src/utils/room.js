const redisService = require('../../services/redisService');
const activeRooms = new Map(); // Map of roomCode -> {hostWs, students, transcript}

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

module.exports = {
    generateRoomCode,
    activeRooms,
};
