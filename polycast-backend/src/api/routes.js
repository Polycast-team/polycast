const express = require('express');
const { generateRoomCode, activeRooms } = require('../utils/room');
const redisService = require('../services/redisService');
const popupGeminiService = require('../services/popupGeminiService');
const dictService = require('../profile-data/dictionaryService');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config/config');
const authService = require('../services/authService');
const authMiddleware = require('./middleware/auth');

// Model configuration
const OPENAI_TTS_MODEL = 'gpt-4o-mini-tts';
const DEFAULT_OPENAI_VOICE = 'alloy';
const OPENAI_REALTIME_MODEL = config.openaiRealtimeVoiceModel || 'gpt-realtime';
const OPENAI_REALTIME_AUDIO_FORMAT = config.openaiRealtimeVoiceFormat || 'mp3';
const GEMINI_CHAT_MODEL = config.geminiChatModel || 'gemini-2.5-flash-lite-preview-09-2025';

const router = express.Router();
// Auth
router.post('/auth/register', async (req, res) => {
    console.log('[Auth] register hit. content-type:', req.headers['content-type']);
    console.log('[Auth] register body:', req.body);
    try {
        const { username, password, nativeLanguage, targetLanguage } = req.body || {};
        if (!username || !password) return res.status(400).json({ error: 'username and password are required' });
        if (!nativeLanguage || !targetLanguage) return res.status(400).json({ error: 'nativeLanguage and targetLanguage are required' });
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
        if (!user) return res.status(401).json({ error: 'Account not found' });
        const ok = await authService.verifyPassword(password, user.password_hash);
        if (!ok) return res.status(401).json({ error: 'Incorrect password' });
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

router.delete('/auth/account', authMiddleware, async (req, res) => {
    try {
        const ok = await authService.deleteProfile(req.user.id);
        if (!ok) return res.status(404).json({ error: 'Not found' });
        return res.json({ ok: true });
    } catch (e) {
        console.error('[Auth] delete account error:', e);
        res.status(500).json({ error: 'Failed to delete account' });
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


// AI Chat endpoint (Gemini Flash)
router.post('/ai/chat', async (req, res) => {
    if (!config.geminiApiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server' });
    }

    try {
        const {
            messages = [],
            prompt,
            systemPrompt,
            temperature,
        } = req.body || {};

        const conversation = Array.isArray(messages) ? messages : [];
        const promptText = typeof prompt === 'string' ? prompt.trim() : '';
        if (!conversation.length && !promptText) {
            return res.status(400).json({ error: 'messages or prompt is required' });
        }

        const genAI = new GoogleGenerativeAI(config.geminiApiKey);
        const generationConfig = {};
        if (typeof temperature === 'number' && Number.isFinite(temperature)) {
            const clamped = Math.max(0, Math.min(1.5, temperature));
            generationConfig.temperature = clamped;
        }

        const modelOptions = { model: GEMINI_CHAT_MODEL };
        if (Object.keys(generationConfig).length > 0) {
            modelOptions.generationConfig = generationConfig;
        }
        if (typeof systemPrompt === 'string' && systemPrompt.trim()) {
            modelOptions.systemInstruction = systemPrompt.trim();
        }

        const model = genAI.getGenerativeModel(modelOptions);

        const contents = [];

        conversation.forEach((msg) => {
            const text = normaliseMessageText(msg?.content);
            if (!text) return;
            const role = typeof msg?.role === 'string' ? msg.role.toLowerCase() : 'user';
            const geminiRole = role === 'assistant' ? 'model' : 'user';
            contents.push({ role: geminiRole, parts: [{ text }] });
        });

        if (promptText) {
            contents.push({ role: 'user', parts: [{ text: promptText }] });
        }

        if (!contents.length) {
            return res.status(400).json({ error: 'No valid messages to send' });
        }

        const result = await model.generateContent({ contents });
        let assistantText = '';

        if (result?.response?.text) {
            const raw = await result.response.text();
            if (typeof raw === 'string') {
                assistantText = raw.trim();
            }
        }

        if (!assistantText && Array.isArray(result?.response?.candidates)) {
            const candidate = result.response.candidates.find((c) => Array.isArray(c?.content?.parts));
            if (candidate) {
                assistantText = candidate.content.parts
                    .map((part) => (typeof part?.text === 'string' ? part.text : ''))
                    .join('')
                    .trim();
            }
        }

        if (!assistantText) {
            return res.status(502).json({ error: 'Language model returned an empty response' });
        }

        return res.json({
            message: {
                role: 'assistant',
                content: assistantText,
            },
            usage: null,
        });
    } catch (error) {
        console.error('[AI Chat] Gemini error:', error?.response?.data || error?.message || error);
        const message = error?.response?.data?.error?.message || error?.message || 'Failed to generate AI response';
        return res.status(error?.response?.status || 500).json({ error: message });
    }
});

// Helper to normalize chat message content for Gemini inputs
function normaliseMessageText(content) {
    if (content === undefined || content === null) return '';
    if (typeof content === 'string') return content.trim();
    if (Array.isArray(content)) {
        const combined = content
            .map((part) => {
                if (!part) return '';
                if (typeof part === 'string') return part;
                if (typeof part === 'object') {
                    if (typeof part.text === 'string') return part.text;
                    if (typeof part.value === 'string') return part.value;
                    if (typeof part.content === 'string') return part.content;
                }
                return '';
            })
            .filter(Boolean)
            .join(' ');
        return combined.trim();
    }
    if (typeof content === 'object') {
        if (typeof content.text === 'string') return content.text.trim();
        if (typeof content.value === 'string') return content.value.trim();
        if (Array.isArray(content.content)) return normaliseMessageText(content.content);
    }
    return '';
}

// Create ephemeral Realtime session token for voice mode
router.post('/ai/voice/session', async (req, res) => {
    if (!config.openaiApiKey) {
        return res.status(500).json({ error: 'OPENAI_API_KEY is not configured on the server' });
    }

    try {
        const { voice: requestedVoice, instructions } = req.body || {};

        const resolvedVoice = typeof requestedVoice === 'string' && requestedVoice.trim()
            ? requestedVoice.trim()
            : DEFAULT_OPENAI_VOICE;

        const buildSessionPayload = (modelName) => {
            const trimmedInstructions = (typeof instructions === 'string' && instructions.trim())
                ? instructions.trim()
                : undefined;

            const turnDetection = {
                type: config.openaiRealtimeVadType || 'server_vad',
            };

            if (turnDetection.type === 'server_vad') {
                const { openaiRealtimeVadThreshold, openaiRealtimeVadSilenceMs, openaiRealtimeVadPrefixPaddingMs } = config;
                if (Number.isFinite(openaiRealtimeVadThreshold)) {
                    turnDetection.threshold = openaiRealtimeVadThreshold;
                }
                if (Number.isFinite(openaiRealtimeVadSilenceMs)) {
                    turnDetection.silence_duration_ms = openaiRealtimeVadSilenceMs;
                }
                if (Number.isFinite(openaiRealtimeVadPrefixPaddingMs)) {
                    turnDetection.prefix_padding_ms = openaiRealtimeVadPrefixPaddingMs;
                }
            }

            const payload = {
                model: modelName,
                voice: resolvedVoice,
                modalities: ['audio', 'text'],
                // Enable tuned server-side VAD so the model knows when you're done speaking
                turn_detection: turnDetection,
                // Enable user speech transcription events over the data channel
                input_audio_transcription: { model: 'whisper-1' },
            };

            const noiseReductionType = typeof config.openaiRealtimeNoiseReduction === 'string'
                ? config.openaiRealtimeNoiseReduction.trim()
                : '';
            if (noiseReductionType) {
                payload.input_audio_noise_reduction = { type: noiseReductionType };
            }

            if (trimmedInstructions) {
                payload.instructions = trimmedInstructions;
            }

            return payload;
        };

        const requestSession = async (modelName) => axios.post(
            'https://api.openai.com/v1/realtime/sessions',
            buildSessionPayload(modelName),
            {
                headers: {
                    Authorization: `Bearer ${config.openaiApiKey}`,
                    'Content-Type': 'application/json',
                    'OpenAI-Beta': 'realtime=v1',
                },
            }
        );

        let oaResponse;
        const modelAttempt = OPENAI_REALTIME_MODEL;
        oaResponse = await requestSession(modelAttempt);

        const data = oaResponse.data || {};
        const clientSecret = data.client_secret || (data.value
            ? {
                value: data.value,
                expires_at: data.expires_at,
            }
            : null);

        res.json({
            client_secret: clientSecret,
            session: data.session || {
                id: data.id,
                model: data.model || modelAttempt,
                output_modalities: data.output_modalities,
                audio: data.audio,
                instructions: data.instructions,
                expires_at: data.expires_at,
            },
        });
    } catch (error) {
        const status = error?.response?.status || 500;
        const oaData = error?.response?.data;
        console.error('[AI Voice] session error:', oaData || error?.message || error);

        const safePayload = (() => {
            try {
                return JSON.stringify(buildSessionPayload(OPENAI_REALTIME_MODEL));
            } catch (_) {
                return undefined;
            }
        })();

        const message = oaData?.error?.message || error?.message || 'Failed to create realtime session';
        res.status(status).json({
            error: message,
            details: oaData?.error?.param ? { param: oaData.error.param, code: oaData.error.code } : undefined,
            requestPayload: process.env.NODE_ENV === 'production' ? undefined : safePayload,
        });
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

// Tatoeba sentence fetching
router.get('/sentences/tatoeba', authMiddleware, async (req, res) => {
    try {
        const { fromLang, toLang, targetWord } = req.query || {};
        
        // Map language names to Tatoeba ISO codes
        const langMap = {
            'English': 'eng',
            'Spanish': 'spa',
            'French': 'fra',
            'German': 'deu',
            'Italian': 'ita',
            'Portuguese': 'por',
            'Russian': 'rus',
            'Japanese': 'jpn',
            'Chinese': 'cmn',
            'Korean': 'kor'
        };
        
        const fromCode = langMap[fromLang] || 'eng';
        const toCode = langMap[toLang] || 'spa';
        
        console.log('[Tatoeba] Request params:', { fromLang, toLang, fromCode, toCode, targetWord });
        
        // Fetch sentences from Tatoeba - using correct API format
        const searchUrl = targetWord 
            ? `https://tatoeba.org/eng/api_v0/search?from=${fromCode}&query=${encodeURIComponent(targetWord)}&trans_filter=limit&trans_link=direct&trans_to=${toCode}&to=${toCode}`
            : `https://tatoeba.org/eng/api_v0/search?from=${fromCode}&trans_filter=limit&trans_link=direct&trans_to=${toCode}&to=${toCode}`;
        
        console.log('[Tatoeba] API URL:', searchUrl);
        
        const response = await axios.get(searchUrl);
        
        console.log('[Tatoeba] Response status:', response.status);
        console.log('[Tatoeba] Response data:', response.data);
        
        if (response.data && response.data.results && response.data.results.length > 0) {
            // Randomly select a sentence from the results
            const randomIndex = Math.floor(Math.random() * response.data.results.length);
            const result = response.data.results[randomIndex];
            const nativeSentence = result.text;
            
            // Parse translations - Tatoeba API structure
            let targetSentence = null;
            if (result.translations && result.translations.length > 0) {
                // Get the first translation
                const translation = result.translations[0];
                if (translation && translation.text) {
                    targetSentence = translation.text;
                }
            }
            
            console.log('[Tatoeba] Parsed result:', { 
                selectedIndex: randomIndex, 
                totalResults: response.data.results.length,
                nativeSentence, 
                targetSentence, 
                targetWord 
            });
            
            return res.json({
                nativeSentence,
                targetSentence,
                targetWord: targetWord || null
            });
        } else {
            console.log('[Tatoeba] No results found');
            return res.status(404).json({ error: 'No sentences found' });
        }
    } catch (error) {
        console.error('[Tatoeba] Error:', error?.response?.data || error?.message || error);
        res.status(500).json({ error: 'Failed to fetch sentence from Tatoeba' });
    }
});


module.exports = router;
