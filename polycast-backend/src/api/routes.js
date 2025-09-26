const express = require('express');
const { generateRoomCode, activeRooms } = require('../utils/room');
const redisService = require('../services/redisService');
const popupGeminiService = require('../services/popupGeminiService');
const dictService = require('../profile-data/dictionaryService');
const axios = require('axios');
const WebSocket = require('ws');
const config = require('../config/config');
const authService = require('../services/authService');
const authMiddleware = require('./middleware/auth');

// OpenAI model configuration
const OPENAI_TTS_MODEL = 'gpt-4o-mini-tts';
const DEFAULT_OPENAI_VOICE = 'alloy';
const OPENAI_CHAT_MODEL = config.openaiChatModel || 'gpt-5';
const OPENAI_REALTIME_MODEL = config.openaiRealtimeVoiceModel || 'gpt-realtime';
const OPENAI_REALTIME_AUDIO_FORMAT = config.openaiRealtimeVoiceFormat || 'mp3';

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


// AI Chat endpoint (GPT-5 via Responses API)
router.post('/ai/chat', async (req, res) => {
    if (!config.openaiApiKey) {
        return res.status(500).json({ error: 'OPENAI_API_KEY is not configured on the server' });
    }

    try {
        const {
            messages = [],
            prompt,
            systemPrompt,
            temperature,
        } = req.body || {};

        const conversation = Array.isArray(messages) ? messages : [];
        if (!conversation.length && !prompt) {
            return res.status(400).json({ error: 'messages or prompt is required' });
        }

        const inputMessages = mapConversationToInput(conversation);

        if (prompt && typeof prompt === 'string') {
            inputMessages.push({
                role: 'user',
                content: [
                    {
                        type: 'input_text',
                        text: prompt,
                    },
                ],
            });
        }

        const payload = {
            model: OPENAI_CHAT_MODEL,
            input: inputMessages,
        };

        if (typeof temperature === 'number' && Number.isFinite(temperature)) {
            payload.temperature = temperature;
        }

        if (systemPrompt && typeof systemPrompt === 'string') {
            payload.instructions = systemPrompt;
        }

        const oaResponse = await axios.post(
            'https://api.openai.com/v1/responses',
            payload,
            {
                headers: {
                    Authorization: `Bearer ${config.openaiApiKey}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        const data = oaResponse.data || {};
        const outputs = Array.isArray(data.output) ? data.output : (Array.isArray(data.outputs) ? data.outputs : []);
        let assistantText = '';

        outputs.forEach((output) => {
            const contentPieces = Array.isArray(output?.content) ? output.content : [];
            contentPieces.forEach((piece) => {
                if (piece?.type === 'output_text' && typeof piece?.text === 'string') {
                    assistantText += piece.text;
                }
            });
        });

        if (!assistantText && typeof data?.output_text === 'string') {
            assistantText = data.output_text;
        }

        if (!assistantText) {
            return res.status(502).json({ error: 'Language model returned an empty response' });
        }

        return res.json({
            message: {
                role: 'assistant',
                content: assistantText.trim(),
            },
            usage: data?.usage || null,
        });
    } catch (error) {
        console.error('[AI Chat] Error:', error?.response?.data || error?.message || error);
        const message = error?.response?.data?.error?.message || error?.message || 'Failed to generate AI response';
        return res.status(error?.response?.status || 500).json({ error: message });
    }
});

// Helper to normalize messages for Responses API
function mapConversationToInput(messages = []) {
    return messages
        .filter((msg) => {
            if (!msg || typeof msg.role !== 'string' || msg.content === undefined || msg.content === null) {
                return false;
            }
            const role = msg.role.toLowerCase();
            return role === 'user' || role === 'assistant';
        })
        .map((msg) => {
            const role = msg.role.toLowerCase();
            const isAssistant = role === 'assistant';
            return {
                role: msg.role,
                content: [
                    {
                        type: isAssistant ? 'output_text' : 'input_text',
                        text: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
                    },
                ],
            };
        });
}

// Voice response endpoint leveraging OpenAI realtime voice models
router.post('/ai/voice/respond', async (req, res) => {
    if (!config.openaiApiKey) {
        return res.status(500).json({ error: 'OPENAI_API_KEY is not configured on the server' });
    }

    try {
        const {
            messages = [],
            voice = DEFAULT_OPENAI_VOICE,
            temperature,
            systemPrompt,
        } = req.body || {};

        const conversation = Array.isArray(messages) ? messages : [];
        if (!conversation.length) {
            return res.status(400).json({ error: 'messages are required to generate a voice response' });
        }

        const wsHeaders = {
            Authorization: `Bearer ${config.openaiApiKey}`,
            'OpenAI-Beta': 'realtime=v1',
        };

        const ws = new WebSocket(`wss://api.openai.com/v1/realtime?model=${encodeURIComponent(OPENAI_REALTIME_MODEL)}`, {
            headers: wsHeaders,
        });

        const audioChunks = [];
        let transcript = '';
        const transcriptSegments = [];
        let responseId = null;
        let settled = false;

        const cleanup = (err) => {
            if (!settled) {
                settled = true;
                try { ws.close(); } catch (_) {}
                if (err) {
                    res.status(err.status || 500).json({ error: err.message || 'Realtime request failed' });
                }
            }
        };

        const inputItems = conversation.map((msg) => {
            const role = (msg.role || 'user').toLowerCase() === 'assistant' ? 'assistant' : 'user';
            const text = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
            const contentType = role === 'assistant' ? 'output_text' : 'input_text';
            return {
                type: 'message',
                role,
                content: [
                    {
                        type: contentType,
                        // Realtime input expects `text` for both input/output variants
                        text,
                    },
                ],
            };
        });

        const instructions = typeof systemPrompt === 'string' && systemPrompt.trim().length > 0
            ? systemPrompt.trim()
            : undefined;

        const sendCreateEvent = () => {
            const responsePayload = {
                type: 'response.create',
                response: {
                    output_modalities: ['audio', 'text'],
                    input: inputItems,
                    audio: {
                        output: {
                            voice: voice || DEFAULT_OPENAI_VOICE,
                            format: OPENAI_REALTIME_AUDIO_FORMAT,
                        },
                    },
                },
            };

            if (instructions) {
                responsePayload.response.instructions = instructions;
            }

            if (typeof temperature === 'number' && Number.isFinite(temperature)) {
                responsePayload.response.temperature = temperature;
            }

            ws.send(JSON.stringify(responsePayload));
        };

        const timeout = setTimeout(() => {
            cleanup({ status: 504, message: 'Realtime voice request timed out' });
        }, 30000);

        ws.on('open', () => {
            sendCreateEvent();
        });

        ws.on('error', (err) => {
            clearTimeout(timeout);
            cleanup({ status: 502, message: err?.message || 'Realtime connection failed' });
        });

        ws.on('close', () => {
            clearTimeout(timeout);
            if (!settled) {
                cleanup({ status: 500, message: 'Realtime connection closed unexpectedly' });
            }
        });

        ws.on('message', (data) => {
            let event;
            try {
                event = JSON.parse(data.toString());
            } catch (err) {
                return;
            }

            switch (event?.type) {
                case 'response.created':
                    responseId = event?.response?.id || responseId;
                    break;
                case 'response.output_audio.delta':
                    if (!responseId || event?.response_id === responseId || !event?.response_id) {
                        if (typeof event?.delta === 'string') {
                            audioChunks.push(event.delta);
                        }
                    }
                    break;
                case 'response.output_audio.done':
                    // no-op; handled on completion
                    break;
                case 'response.output_text.delta':
                    if (typeof event?.delta === 'string') {
                        transcript += event.delta;
                        transcriptSegments.push(event.delta);
                    }
                    break;
                case 'response.output_text.done':
                    break;
                case 'response.error':
                    clearTimeout(timeout);
                    cleanup({ status: 502, message: event?.error?.message || 'Realtime error' });
                    break;
                case 'response.completed':
                case 'response.finalized':
                case 'response.done':
                    clearTimeout(timeout);
                    if (!settled) {
                        const audioBase64 = audioChunks.join('');
                        if (!audioBase64) {
                            cleanup({ status: 502, message: 'Realtime response did not include audio data' });
                            return;
                        }
                        cleanup(null);
                        res.json({
                            transcript: transcript.trim(),
                            transcriptSegments,
                            audio: audioBase64,
                            format: OPENAI_REALTIME_AUDIO_FORMAT,
                            usage: event?.response?.usage || null,
                        });
                    }
                    break;
                default:
                    break;
            }
        });
    } catch (error) {
        console.error('[AI Voice] Error:', error?.response?.data || error?.message || error);
        const message = error?.response?.data?.error?.message || error?.message || 'Failed to generate voice response';
        return res.status(500).json({ error: message });
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
