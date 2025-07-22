const express = require('express');
const { generateRoomCode, activeRooms } = require('../utils/room');
const redisService = require('../services/redisService');
const llmService = require('../services/llmService');
const { generateTextWithGemini } = require('../services/llmService');

const router = express.Router();

// Room Management API Endpoints
router.post('/create-room', async (req, res) => {
    try {
        const roomCode = await generateRoomCode();
        const roomData = {
            hostWs: null,
            students: [],
            transcript: [],
            createdAt: Date.now()
        };
        activeRooms.set(roomCode, roomData);
        await redisService.saveRoom(roomCode, roomData);
        console.log(`[Room] Created new room: ${roomCode}`);
        res.status(201).json({ roomCode });
    } catch (error) {
        console.error('[Room] Error creating room:', error);
        res.status(500).json({ error: 'Failed to create room' });
    }
});

router.get('/check-room/:roomCode', async (req, res) => {
    const { roomCode } = req.params;
    if (activeRooms.has(roomCode)) {
        console.log(`[Room] Room check success (memory): ${roomCode}`);
        res.status(200).json({ exists: true });
        return;
    }
    try {
        const exists = await redisService.roomExists(roomCode);
        if (exists) {
            const roomData = await redisService.getRoom(roomCode);
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

// Translation API
router.get('/translate/:language/:text', async (req, res) => {
    try {
        const { language, text } = req.params;
        const translatedText = await llmService.translateText(decodeURIComponent(text), language);
        res.json({ translation: translatedText });
    } catch (error) {
        console.error("Translation API error:", error);
        res.status(500).json({ error: error.message });
    }
});

// Dictionary API
router.get('/dictionary/:word', async (req, res) => {
    try {
        const { word } = req.params;
        const context = req.query.context || '';
        const targetLanguage = req.query.targetLanguage || 'Spanish';
        console.log(`[Dictionary API] Getting definition for: ${word}${context ? ' with context: "' + context + '"' : ''} in ${targetLanguage}`);
        
        const prompt = `You are an expert language teacher helping a student understand a word in its specific context.\n\nThe word "${word}" appears in this context: "${context}"\n\nYour task is to:\n1. Identify the SINGLE best definition that applies to how this word is used in this specific context\n2. Provide a definition number that represents this specific meaning (you can use any appropriate number)\n\nOutput ONLY a JSON object with these fields:\n{\n  "translation": "${targetLanguage} translation of the word as used in this specific context",\n  "partOfSpeech": "The part of speech of the word in this context (noun, verb, adjective, etc.)",\n  "definition": "A clear and concise definition appropriate for how the word is used in this context only",\n  "example": "A simple example sentence showing a similar usage to the context",\n  "definitionNumber": A number representing this specific meaning (e.g., 1, 2, 3, etc.),\n  "contextualExplanation": "A short phrase IN ${targetLanguage} (10 words max) explaining what '${word}' means here."\n}\n\nDo NOT provide multiple definitions or explanations outside the JSON.`;
        
        const llmResponse = await generateTextWithGemini(prompt, 0.2);
        
        const jsonMatch = llmResponse.match(/\{[\s\S]*?\}/);
        if (!jsonMatch) {
            throw new Error('Could not extract JSON from LLM response');
        }
        const jsonStr = jsonMatch[0];
        const parsedResponse = JSON.parse(jsonStr);
        
        const wordSenseId = `${word.toLowerCase()}_${parsedResponse.definitionNumber || 1}`;
        
        const formattedResponse = {
            wordSenseId: wordSenseId,
            word: word,
            translation: parsedResponse.translation || '',
            partOfSpeech: parsedResponse.partOfSpeech || '',
            definition: parsedResponse.definition || '',
            definitions: [{
                text: parsedResponse.definition || '',
                example: parsedResponse.example || ''
            }],
            definitionNumber: parsedResponse.definitionNumber || 1,
            contextualExplanation: parsedResponse.contextualExplanation || '',
            isContextual: true
        };

        // Flashcard content generation would go here...

        res.json(formattedResponse);
    } catch (error) {
        console.error("Dictionary API error:", error);
        res.status(500).json({ error: error.message });
    }
});


module.exports = router;
