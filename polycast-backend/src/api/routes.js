const express = require('express');
const { generateRoomCode, activeRooms } = require('../utils/room');
const redisService = require('../services/redisService');
const popupGeminiService = require('../services/popupGeminiService');
const openaiService = require('../services/openaiService');
const dictService = require('../profile-data/dictionaryService');
const axios = require('axios');
const config = require('../config/config');
const authService = require('../services/authService');
const authMiddleware = require('./middleware/auth');

// OpenAI TTS configuration
const OPENAI_TTS_MODEL = 'gpt-4o-mini-tts';
const DEFAULT_OPENAI_VOICE = 'alloy';

const router = express.Router();
// Auth
router.post('/auth/register', async (req, res) => {
    console.log('[Auth] register hit. content-type:', req.headers['content-type']);
    console.log('[Auth] register body:', req.body);
    try {
        const { username, password, nativeLanguage = 'English', targetLanguage = 'English' } = req.body || {};
        if (!username || !password) return res.status(400).json({ error: 'username and password are required' });
        const existing = await authService.findUserByUsername(username);
        if (existing) return res.status(409).json({ error: 'Username already exists' });
        const profile = await authService.createUser({ username, password, nativeLanguage, targetLanguage });
        const token = authService.issueToken(profile);
        return res.status(201).json({ token, profile });
    } catch (e) {
        console.error('[Auth] register error:', e);
        res.status(500).json({ error: 'Failed to register' });
    }
});

router.post('/auth/login', async (req, res) => {
    console.log('[Auth] login hit. content-type:', req.headers['content-type']);
    console.log('[Auth] login body:', req.body);
    try {
        const { username, password } = req.body || {};
        if (!username || !password) return res.status(400).json({ error: 'username and password are required' });
        const user = await authService.findUserByUsername(username);
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });
        const ok = await authService.verifyPassword(password, user.password_hash);
        if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
        const token = authService.issueToken(user);
        const profile = {
            id: user.id,
            username: user.username,
            native_language: user.native_language,
            target_language: user.target_language,
        };
        return res.json({ token, profile });
    } catch (e) {
        console.error('[Auth] login error:', e);
        res.status(500).json({ error: 'Failed to login' });
    }
});

router.get('/auth/me', authMiddleware, async (req, res) => {
    try {
        const profile = await authService.getProfileById(req.user.id);
        if (!profile) return res.status(404).json({ error: 'Not found' });
        return res.json(profile);
    } catch (e) {
        console.error('[Auth] me error:', e);
        res.status(500).json({ error: 'Failed to load profile' });
    }
});

// Profile
router.get('/profiles/me', authMiddleware, async (req, res) => {
    try {
        const profile = await authService.getProfileById(req.user.id);
        if (!profile) return res.status(404).json({ error: 'Not found' });
        return res.json(profile);
    } catch (e) {
        console.error('[Profiles] get me error:', e);
        res.status(500).json({ error: 'Failed to load profile' });
    }
});

router.put('/profiles/me', authMiddleware, async (req, res) => {
    try {
        const { nativeLanguage, targetLanguage } = req.body || {};
        if (!nativeLanguage || !targetLanguage) return res.status(400).json({ error: 'nativeLanguage and targetLanguage are required' });
        const updated = await authService.updateProfileLanguages(req.user.id, { nativeLanguage, targetLanguage });
        return res.json(updated);
    } catch (e) {
        console.error('[Profiles] update me error:', e);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

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

// Translation API removed

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

// QUICK LOOKUP - fast preview for transcript click (translation + concise explanation)
router.get('/dictionary/quick', async (req, res) => {
    try {
        const { word, sentenceWithMarkedWord, nativeLanguage = 'English', targetLanguage = 'English' } = req.query || {};
        if (!word || !word.trim()) return res.status(400).json({ error: 'word is required' });
        if (!sentenceWithMarkedWord || !sentenceWithMarkedWord.trim()) return res.status(400).json({ error: 'sentenceWithMarkedWord is required' });
        const quick = await popupGeminiService.getQuickSenseSummary(
            word.trim(),
            sentenceWithMarkedWord.trim(),
            nativeLanguage,
            targetLanguage
        );
        return res.json(quick);
    } catch (e) {
        console.error('[Quick API] Error:', e);
        res.status(500).json({ error: e?.message || 'Failed to get quick summary' });
    }
});

router.post('/ai/chat', async (req, res) => {
    try {
        const { messages, systemPrompt, temperature, model, maxOutputTokens } = req.body || {};
        if (!Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({ error: 'messages must be a non-empty array' });
        }

        const chatMessages = [...messages];
        if (systemPrompt && typeof systemPrompt === 'string') {
            chatMessages.unshift({ role: 'system', content: systemPrompt });
        }

        const normalizedMessages = chatMessages.map(msg => ({
            role: msg?.role || 'user',
            content: msg?.content ?? '',
        }));

        const result = await openaiService.sendChatCompletion({
            messages: normalizedMessages,
            model: model || 'gpt-5-mini',
            temperature: typeof temperature === 'number' ? temperature : 0.6,
        });

        return res.json({
            message: result.text,
            usage: result.usage,
            stopReason: result.stopReason,
            model: result.modelUsed,
        });
    } catch (error) {
        console.error('[AI Chat] error:', error);
        const status = error.statusCode || error.status || 500;
        res.status(status).json({ error: error.message || 'Failed to generate response', details: error.details || undefined });
    }
});

router.post('/ai/voice-session', async (req, res) => {
    try {
        const { voice, instructions, modalities, temperature } = req.body || {};
        const session = await openaiService.createRealtimeSession({
            voice: voice || 'marin',
            instructions,
            outputModalities: Array.isArray(modalities) && modalities.length ? modalities : ['text', 'audio'],
            temperature: typeof temperature === 'number' ? temperature : 0.7,
        });

        return res.json(session);
    } catch (error) {
        console.error('[AI Voice] error:', error);
        const status = error.statusCode || error.status || 500;
        res.status(status).json({ error: error.message || 'Failed to create realtime session', details: error.details || undefined });
    }
});

// Dictionary (persisted) - auth required
router.get('/dictionary', authMiddleware, async (req, res) => {
    try {
        const rows = await dictService.listEntries(req.user.id);
        res.json(rows);
    } catch (e) {
        console.error('[Dictionary] list error:', e);
        res.status(500).json({ error: 'Failed to list dictionary entries' });
    }
});

router.post('/dictionary', authMiddleware, async (req, res) => {
    try {
        console.log('[Dictionary] create hit. userId=', req.user?.id, 'body keys=', Object.keys(req.body || {}));
        const { word, senseKey, geminiUnifiedText, geminiUnifiedJson, studyIntervalLevel, dueAt } = req.body || {};
        if (!word || !senseKey || !geminiUnifiedText) return res.status(400).json({ error: 'word, senseKey, and geminiUnifiedText are required' });
        const saved = await dictService.createEntry(req.user.id, {
            word,
            senseKey,
            geminiUnifiedText,
            geminiUnifiedJson,
            studyIntervalLevel,
            dueAt,
        });
        console.log('[Dictionary] create saved id=', saved?.id, 'word=', saved?.word, 'sense=', saved?.sense_key);
        res.status(201).json(saved);
    } catch (e) {
        console.error('[Dictionary] create error:', e);
        res.status(500).json({ error: e?.message || 'Failed to create dictionary entry' });
    }
});

router.delete('/dictionary/:id', authMiddleware, async (req, res) => {
    try {
        console.log('[Dictionary] delete hit. userId=', req.user?.id, 'id=', req.params?.id);
        const ok = await dictService.deleteEntry(req.user.id, req.params.id);
        if (!ok) return res.status(404).json({ error: 'Not found' });
        res.json({ ok: true });
    } catch (e) {
        console.error('[Dictionary] delete error:', e);
        res.status(500).json({ error: 'Failed to delete dictionary entry' });
    }
});

// SRS update on a word_sense
router.put('/dictionary/:id/srs', authMiddleware, async (req, res) => {
    try {
        const updated = await dictService.updateSrs(req.user.id, req.params.id, {
            studyIntervalLevel: req.body?.studyIntervalLevel,
            dueAt: req.body?.dueAt,
        });
        if (!updated) return res.status(404).json({ error: 'Not found' });
        res.json(updated);
    } catch (e) {
        console.error('[Dictionary] update SRS error:', e);
        res.status(500).json({ error: 'Failed to update SRS' });
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

        if (!config.openaiApiKey) {
            return res.status(500).json({ error: 'OPENAI_API_KEY is not configured on the server' });
        }

        // Use OpenAI Text-to-Speech (latest model)
        const model = OPENAI_TTS_MODEL;
        const selectedVoice = DEFAULT_OPENAI_VOICE; // Frontend sends Google-style voice; ignore and default

        const oaResponse = await axios.post(
            'https://api.openai.com/v1/audio/speech',
            {
                model,
                input: cleanText,
                voice: selectedVoice,
                format: 'mp3'
            },
            {
                headers: {
                    Authorization: `Bearer ${config.openaiApiKey}`,
                    'Content-Type': 'application/json'
                },
                responseType: 'arraybuffer'
            }
        );

        const audioBuffer = Buffer.from(oaResponse.data);
        const base64 = audioBuffer.toString('base64');
        res.json({ audioUrl: `data:audio/mp3;base64,${base64}` });
    } catch (error) {
        console.error('[TTS] Error (OpenAI):', error?.response?.data || error?.message || error);
        const message = error?.response?.data?.error?.message || error?.message || 'Failed to generate audio';
        res.status(500).json({ error: message });
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

        if (!config.openaiApiKey) {
            return res.status(500).json({ error: 'OPENAI_API_KEY is not configured on the server' });
        }

        const model = OPENAI_TTS_MODEL;
        const selectedVoice = DEFAULT_OPENAI_VOICE;

        const oaResponse = await axios.post(
            'https://api.openai.com/v1/audio/speech',
            {
                model,
                input: cleanText,
                voice: selectedVoice,
                format: 'mp3'
            },
            {
                headers: {
                    Authorization: `Bearer ${config.openaiApiKey}`,
                    'Content-Type': 'application/json'
                },
                responseType: 'arraybuffer'
            }
        );

        const audioBuffer = Buffer.from(oaResponse.data);
        // Return as blob for legacy compatibility
        res.set({
            'Content-Type': 'audio/mpeg',
            'Content-Length': audioBuffer.length
        });
        res.send(audioBuffer);
    } catch (error) {
        console.error('[TTS Legacy] Error (OpenAI):', error?.response?.data || error?.message || error);
        const message = error?.response?.data?.error?.message || error?.message || 'Failed to generate audio';
        res.status(500).json({ error: message });
    }
});


module.exports = router;
