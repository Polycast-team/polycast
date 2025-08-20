const express = require('express');
const { generateRoomCode, activeRooms } = require('../utils/room');
const redisService = require('../services/redisService');
const llmService = require('../services/llmService');
const { generateTextWithGemini } = require('../services/llmService');
const popupGeminiService = require('../services/popupGeminiService');
const { TextToSpeechClient } = require('@google-cloud/text-to-speech');

const ttsClient = new TextToSpeechClient();

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

// Sense Candidates API (for Add Word flow) - MUST be before /dictionary/:word
router.get('/dictionary/senses', async (req, res) => {
    try {
        const { word, nativeLanguage = 'English', targetLanguage = 'English' } = req.query || {};
        if (!word || !word.trim()) {
            return res.status(400).json({ error: 'word is required' });
        }
        const senses = await popupGeminiService.getSenseCandidates(word.trim(), nativeLanguage, targetLanguage);
        return res.json({ word: word.trim(), nativeLanguage, targetLanguage, senses });
    } catch (error) {
        console.error('[Senses API] Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// UNIFIED API - Single endpoint for all word data needs (popup & flashcards)
router.get('/dictionary/unified', async (req, res) => {
    try {
        const { word, sentenceWithMarkedWord, nativeLanguage = 'English', targetLanguage = 'English' } = req.query || {};
        if (!word || !word.trim()) {
            return res.status(400).json({ error: 'word is required' });
        }
        if (!sentenceWithMarkedWord || !sentenceWithMarkedWord.trim()) {
            return res.status(400).json({ error: 'sentenceWithMarkedWord is required' });
        }
        
        console.log(`[Unified API] Processing: word="${word}", sentence="${sentenceWithMarkedWord}", native="${nativeLanguage}", target="${targetLanguage}"`);
        
        const unifiedData = await popupGeminiService.getUnifiedWordData(
            word.trim(),
            sentenceWithMarkedWord.trim(),
            nativeLanguage,
            targetLanguage
        );
        
        return res.json(unifiedData);
    } catch (error) {
        console.error('[Unified API] Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Contextual single-sense API (for transcript add flow) - DEPRECATED, kept for backward compatibility
router.get('/dictionary/contextual-sense', async (req, res) => {
    try {
        const { word, context = '', nativeLanguage = 'English', targetLanguage = 'English' } = req.query || {};
        if (!word || !word.trim()) {
            return res.status(400).json({ error: 'word is required' });
        }
        const sense = await popupGeminiService.getContextualSense(word.trim(), context, nativeLanguage, targetLanguage);
        return res.json({ word: word.trim(), nativeLanguage, targetLanguage, sense });
    } catch (error) {
        console.error('[ContextualSense API] Error:', error);
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
        
        // Use the new popupGeminiService
        const definition = await popupGeminiService.getContextualDefinition(word, context, targetLanguage);
        
        // Format response to match existing popup expectations
        const formattedResponse = {
            word: word,
            translation: definition.translation,
            contextualExplanation: definition.contextualExplanation,
            // Additional fields that may be used by the popup
            partOfSpeech: '',
            definition: definition.contextualExplanation,
            isContextual: true
        };

        res.json(formattedResponse);
    } catch (error) {
        console.error("Dictionary API error:", error);
        res.status(500).json({ error: error.message });
    }
});

// Generate example sentence pairs for flashcards
router.post('/examples', async (req, res) => {
    try {
        const { word, sentenceWithTilde, targetLanguage, nativeLanguage } = req.body || {};
        if (!word || !sentenceWithTilde || !targetLanguage || !nativeLanguage) {
            return res.status(400).json({ error: 'Missing required fields: word, sentenceWithTilde, targetLanguage, nativeLanguage' });
        }

        const examples = await popupGeminiService.generateExamplePairs(
            word,
            sentenceWithTilde,
            targetLanguage,
            nativeLanguage
        );

        res.json({ exampleSentencesGenerated: examples });
    } catch (error) {
        console.error('[Examples API] Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Text-to-Speech API using Google Cloud
router.post('/generate-audio', async (req, res) => {
    try {
        const { text, voice, speakingRate, pitch } = req.body || {};
        if (!text || !text.trim()) {
            return res.status(400).json({ error: 'Missing text' });
        }

        // Strip tildes from text before synthesis
        const cleanText = text.trim().replace(/~/g, '');
        
        // Randomly choose between natural male and female voices
        const voices = ['en-US-Neural2-J', 'en-US-Neural2-F']; // J=male, F=female
        const randomVoice = voices[Math.floor(Math.random() * voices.length)];

        const request = {
            input: { text: cleanText },
            voice: {
                languageCode: (voice && voice.languageCode) || 'en-US',
                name: (voice && voice.name) || randomVoice
            },
            audioConfig: {
                audioEncoding: 'MP3',
                speakingRate: speakingRate ?? 1.0,
                pitch: pitch ?? 0.0
            }
        };

        const [response] = await ttsClient.synthesizeSpeech(request);
        const base64 = Buffer.from(response.audioContent).toString('base64');
        
        res.json({ audioUrl: `data:audio/mp3;base64,${base64}` });
    } catch (error) {
        console.error('[TTS] Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Legacy TTS API endpoint for backward compatibility
router.post('/tts', async (req, res) => {
    try {
        const { text, voice, speakingRate, pitch } = req.body || {};
        if (!text || !text.trim()) {
            return res.status(400).json({ error: 'Missing text' });
        }

        // Strip tildes from text before synthesis
        const cleanText = text.trim().replace(/~/g, '');
        
        // Randomly choose between natural male and female voices
        const voices = ['en-US-Neural2-J', 'en-US-Neural2-F']; // J=male, F=female
        const randomVoice = voices[Math.floor(Math.random() * voices.length)];

        const request = {
            input: { text: cleanText },
            voice: {
                languageCode: (voice && voice.languageCode) || 'en-US',
                name: (voice && voice.name) || randomVoice
            },
            audioConfig: {
                audioEncoding: 'MP3',
                speakingRate: speakingRate ?? 1.0,
                pitch: pitch ?? 0.0
            }
        };

        const [response] = await ttsClient.synthesizeSpeech(request);
        
        // Return as blob for legacy compatibility
        res.set({
            'Content-Type': 'audio/mpeg',
            'Content-Length': response.audioContent.length
        });
        res.send(response.audioContent);
    } catch (error) {
        console.error('[TTS Legacy] Error:', error);
        res.status(500).json({ error: error.message });
    }
});


module.exports = router;
