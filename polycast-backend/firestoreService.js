const admin = require('firebase-admin');
const config = require('../config/config');

// Initialize Firebase Admin
let db;
try {
    // For local development, use service account
    if (process.env.NODE_ENV !== 'production') {
        const serviceAccount = require('../../serviceAccountKey.json');
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: 'polycast-205e8'
        });
    } else {
        // For production (Firebase App Hosting), use default credentials
        admin.initializeApp({
            projectId: 'polycast-205e8'
        });
    }

    db = admin.firestore();
    console.log('[Firestore] Successfully initialized');
} catch (error) {
    console.error('[Firestore] Initialization error:', error);
}

// Room collection reference
const roomsCollection = db.collection('rooms');
const usersCollection = db.collection('users');

// Room Management Functions
async function saveRoom(roomCode, roomData) {
    try {
        const docRef = roomsCollection.doc(roomCode);
        const firestoreData = {
            isActive: true,
            hasHost: !!roomData.hostWs,
            studentCount: roomData.students ? roomData.students.length : 0,
            transcript: roomData.transcript || [],
            createdAt: roomData.createdAt || Date.now(),
            lastActivity: Date.now(),
            expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000) // 12 hours
        };

        await docRef.set(firestoreData, { merge: true });
        console.log(`[Firestore] Saved room ${roomCode}`);
        return true;
    } catch (error) {
        console.error(`[Firestore] Error saving room ${roomCode}:`, error);
        return false;
    }
}

async function roomExists(roomCode) {
    try {
        const doc = await roomsCollection.doc(roomCode).get();
        return doc.exists;
    } catch (error) {
        console.error(`[Firestore] Error checking room ${roomCode}:`, error);
        return false;
    }
}

async function getRoom(roomCode) {
    try {
        const doc = await roomsCollection.doc(roomCode).get();
        if (!doc.exists) return null;
        return doc.data();
    } catch (error) {
        console.error(`[Firestore] Error getting room ${roomCode}:`, error);
        return null;
    }
}

async function deleteRoom(roomCode) {
    try {
        await roomsCollection.doc(roomCode).delete();
        console.log(`[Firestore] Deleted room ${roomCode}`);
        return true;
    } catch (error) {
        console.error(`[Firestore] Error deleting room ${roomCode}:`, error);
        return false;
    }
}

async function updateTranscript(roomCode, transcript) {
    try {
        await roomsCollection.doc(roomCode).update({
            transcript: transcript,
            lastActivity: Date.now()
        });
        return true;
    } catch (error) {
        console.error(`[Firestore] Error updating transcript for room ${roomCode}:`, error);
        return false;
    }
}

async function getAllRooms() {
    try {
        const snapshot = await roomsCollection.where('isActive', '==', true).get();
        const rooms = [];
        snapshot.forEach(doc => {
            rooms.push(doc.id);
        });
        return rooms;
    } catch (error) {
        console.error('[Firestore] Error getting all rooms:', error);
        return [];
    }
}

// User Profile and Flashcard Functions
async function getUserProfile(profileId) {
    try {
        const doc = await usersCollection.doc(profileId).get();
        if (!doc.exists) {
            // Create default profile
            const defaultProfile = {
                createdAt: Date.now(),
                lastActive: Date.now(),
                settings: {
                    newCardsPerDay: 20,
                    targetLanguage: 'Spanish'
                }
            };
            await usersCollection.doc(profileId).set(defaultProfile);
            return defaultProfile;
        }
        return doc.data();
    } catch (error) {
        console.error(`[Firestore] Error getting user profile ${profileId}:`, error);
        return null;
    }
}

async function saveFlashcard(profileId, flashcardData) {
    try {
        const flashcardsRef = usersCollection.doc(profileId).collection('flashcards');
        const docRef = await flashcardsRef.add({
            ...flashcardData,
            createdAt: Date.now()
        });
        console.log(`[Firestore] Saved flashcard for profile ${profileId}`);
        return docRef.id;
    } catch (error) {
        console.error(`[Firestore] Error saving flashcard:`, error);
        return null;
    }
}

async function getUserFlashcards(profileId) {
    try {
        const flashcardsRef = usersCollection.doc(profileId).collection('flashcards');
        const snapshot = await flashcardsRef.get();
        const flashcards = [];
        snapshot.forEach(doc => {
            flashcards.push({ id: doc.id, ...doc.data() });
        });
        return flashcards;
    } catch (error) {
        console.error(`[Firestore] Error getting flashcards for profile ${profileId}:`, error);
        return [];
    }
}

async function updateFlashcard(profileId, flashcardId, updates) {
    try {
        const docRef = usersCollection.doc(profileId).collection('flashcards').doc(flashcardId);
        await docRef.update({
            ...updates,
            lastReviewed: Date.now()
        });
        return true;
    } catch (error) {
        console.error(`[Firestore] Error updating flashcard:`, error);
        return false;
    }
}

// Dictionary cache functions (optional)
async function cacheDictionaryEntry(word, definition) {
    try {
        await db.collection('dictionary').doc(word.toLowerCase()).set({
            word: word,
            definition: definition,
            cachedAt: Date.now()
        });
        return true;
    } catch (error) {
        console.error(`[Firestore] Error caching dictionary entry:`, error);
        return false;
    }
}

async function getCachedDefinition(word) {
    try {
        const doc = await db.collection('dictionary').doc(word.toLowerCase()).get();
        if (!doc.exists) return null;

        const data = doc.data();
        // Check if cache is still fresh (e.g., 30 days)
        const cacheAge = Date.now() - data.cachedAt;
        if (cacheAge > 30 * 24 * 60 * 60 * 1000) {
            return null; // Cache expired
        }

        return data.definition;
    } catch (error) {
        console.error(`[Firestore] Error getting cached definition:`, error);
        return null;
    }
}

// Export the same interface as redisService for easy migration
module.exports = {
    // Room functions (matching redisService interface)
    saveRoom,
    roomExists,
    getRoom,
    deleteRoom,
    updateTranscript,
    getAllRooms,
    isFirestoreAvailable: () => !!db,

    // Additional functions for user data
    getUserProfile,
    saveFlashcard,
    getUserFlashcards,
    updateFlashcard,

    // Dictionary cache
    cacheDictionaryEntry,
    getCachedDefinition
};
