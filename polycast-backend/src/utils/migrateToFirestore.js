const redisService = require('../services/redisService');
const firestoreService = require('../services/firestoreService');

async function migrateRooms() {
    console.log('Starting room migration from Redis to Firestore...');

    try {
        // Get all rooms from Redis
        const roomCodes = await redisService.getAllRooms();
        console.log(`Found ${roomCodes.length} rooms to migrate`);

        for (const roomCode of roomCodes) {
            const roomData = await redisService.getRoom(roomCode);
            if (roomData) {
                await firestoreService.saveRoom(roomCode, roomData);
                console.log(`Migrated room: ${roomCode}`);
            }
        }

        console.log('Migration completed successfully');
    } catch (error) {
        console.error('Migration error:', error);
    }
}

// Run migration if this file is executed directly
if (require.main === module) {
    migrateRooms();
}

module.exports = { migrateRooms };
