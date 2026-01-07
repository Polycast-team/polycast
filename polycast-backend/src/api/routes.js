const express = require('express');
const { generateRoomCode, activeRooms } = require('../utils/room');
const redisService = require('../services/redisService');
const popupGeminiService = require('../services/popupGeminiService');
const dictService = require('../profile-data/dictionaryService');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { YoutubeTranscript } = require('youtube-transcript');
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
        const { username, password, nativeLanguage, targetLanguage, proficiencyLevel } = req.body || {};
        if (!username || !password) return res.status(400).json({ error: 'username and password are required' });
        if (!nativeLanguage || !targetLanguage) return res.status(400).json({ error: 'nativeLanguage and targetLanguage are required' });
        const existing = await authService.findUserByUsername(username);
        if (existing) return res.status(409).json({ error: 'Username already exists' });
        let level = parseInt(proficiencyLevel, 10);
        if (!Number.isFinite(level)) level = 3;
        level = Math.max(1, Math.min(5, level));
        const profile = await authService.createUser({ username, password, nativeLanguage, targetLanguage, proficiencyLevel: level });
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
            proficiency_level: user.proficiency_level,
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
        const { nativeLanguage, targetLanguage, proficiencyLevel } = req.body || {};
        if (!nativeLanguage || !targetLanguage) return res.status(400).json({ error: 'nativeLanguage and targetLanguage are required' });
        let level = undefined;
        if (proficiencyLevel !== undefined) {
            const parsed = parseInt(proficiencyLevel, 10);
            if (Number.isFinite(parsed)) level = Math.max(1, Math.min(5, parsed));
        }
        const updated = await authService.updateProfileLanguages(req.user.id, { nativeLanguage, targetLanguage, proficiencyLevel: level });
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

// Practice sentence generation using Gemini, enforcing uniqueness
router.get('/sentences/practice', authMiddleware, async (req, res) => {
    try {
        if (!config.geminiApiKey) {
            return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server' });
        }
        const { fromLang, toLang, targetWord, proficiencyLevel } = req.query || {};

        const level = (() => {
            const parsed = parseInt(proficiencyLevel, 10);
            if (Number.isFinite(parsed)) return Math.max(1, Math.min(5, parsed));
            if (req.user?.id) return undefined; // will fetch from profile
            return 3;
        })();

        // Load user profile if no level provided
        let effectiveLevel = level;
        if (effectiveLevel === undefined) {
            try {
                const profile = await authService.getProfileById(req.user.id);
                effectiveLevel = Math.max(1, Math.min(5, parseInt(profile?.proficiency_level || 3, 10)));
            } catch (_) {
                effectiveLevel = 3;
            }
        }

        const genAI = new GoogleGenerativeAI(config.geminiApiKey);
        const model = genAI.getGenerativeModel({ model: GEMINI_CHAT_MODEL, systemInstruction: `You generate a single natural sentence in ${fromLang}. Target language for translation practice is ${toLang}. The learner proficiency level is ${effectiveLevel} (1=absolute beginner, 5=advanced). Avoid profanity and sensitive content. Keep length 8-18 words.

IMPORTANT: The sentence must be written entirely in ${fromLang} with no code-switching into ${toLang}. If a targetWord is provided, craft a scenario that would lead a translator to use that ${toLang} word, but do NOT include ${toLang} vocabulary in the ${fromLang} sentence itself. Output only the sentence, no quotes.` });

        // Build prompt
        const safeWord = (typeof targetWord === 'string' && targetWord.trim()) ? targetWord.trim() : '';
        const prompt = `Generate one ${fromLang} sentence suitable for a ${toLang} learner at level ${effectiveLevel}. ${safeWord ? `Create a context where the ${toLang} word "${safeWord}" would be used in translation, but write entirely in ${fromLang} without inserting ${toLang} words.` : ''} No offensive content. 8-18 words. Respond with only the sentence.`;

        // Uniqueness guard: try a few times to get unseen sentence
        const seenSet = new Set();
        let attempts = 0;
        let finalSentence = '';
        while (attempts < 5) {
            attempts++;
            const result = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: prompt }] }] });
            let sentence = '';
            if (result?.response?.text) {
                const raw = await result.response.text();
                sentence = (raw || '').replace(/^["'\s]+|["'\s]+$/g, '').trim();
            }
            if (!sentence) continue;
            const normalized = sentence.replace(/\s+/g, ' ').trim().toLowerCase();
            if (seenSet.has(normalized)) continue;

            // Check DB uniqueness table
            try {
                const { rows } = await require('../profile-data/pool').query('INSERT INTO practice_sentences (sentence) VALUES ($1) ON CONFLICT DO NOTHING RETURNING id', [sentence]);
                if (rows && rows.length > 0) {
                    finalSentence = sentence;
                    break;
                }
            } catch (_) {
                // If DB fails, fallback to in-memory seen set only
                if (!seenSet.has(normalized)) {
                    finalSentence = sentence;
                    break;
                }
            }
            seenSet.add(normalized);
        }

        if (!finalSentence) {
            return res.status(502).json({ error: 'Failed to generate a unique sentence' });
        }

        return res.json({ nativeSentence: finalSentence, targetWord: safeWord || null });
    } catch (error) {
        console.error('[Practice Sentences] Error:', error?.response?.data || error?.message || error);
        res.status(500).json({ error: 'Failed to generate sentence' });
    }
});

// YouTube API - Search for videos with captions
router.get('/youtube/search', async (req, res) => {
    if (!config.youtubeApiKey) {
        return res.status(500).json({ error: 'YOUTUBE_API_KEY is not configured on the server' });
    }

    try {
        const { q, language = 'en', pageToken, maxResults = 12 } = req.query || {};
        if (!q || !q.trim()) {
            return res.status(400).json({ error: 'Search query (q) is required' });
        }

        // Search YouTube for videos with captions
        const searchParams = new URLSearchParams({
            part: 'snippet',
            q: q.trim(),
            type: 'video',
            videoCaption: 'closedCaption', // Only videos with captions
            relevanceLanguage: language,
            maxResults: Math.min(50, Math.max(1, parseInt(maxResults, 10) || 12)),
            key: config.youtubeApiKey,
        });

        if (pageToken) {
            searchParams.append('pageToken', pageToken);
        }

        const searchResponse = await axios.get(
            `https://www.googleapis.com/youtube/v3/search?${searchParams.toString()}`
        );

        const videoIds = (searchResponse.data.items || [])
            .map(item => item.id?.videoId)
            .filter(Boolean);

        if (videoIds.length === 0) {
            return res.json({
                videos: [],
                nextPageToken: searchResponse.data.nextPageToken || null,
                prevPageToken: searchResponse.data.prevPageToken || null,
            });
        }

        // Get video details including content details for caption info
        const videosParams = new URLSearchParams({
            part: 'snippet,contentDetails',
            id: videoIds.join(','),
            key: config.youtubeApiKey,
        });

        const videosResponse = await axios.get(
            `https://www.googleapis.com/youtube/v3/videos?${videosParams.toString()}`
        );

        // Get caption details for each video to determine if human or auto-generated
        const captionPromises = videoIds.map(async (videoId) => {
            try {
                const captionsParams = new URLSearchParams({
                    part: 'snippet',
                    videoId,
                    key: config.youtubeApiKey,
                });
                const captionsResponse = await axios.get(
                    `https://www.googleapis.com/youtube/v3/captions?${captionsParams.toString()}`
                );
                const captions = captionsResponse.data.items || [];
                // Check if there are manual (human) captions vs auto-generated
                const hasManual = captions.some(c => c.snippet?.trackKind === 'standard');
                const hasAuto = captions.some(c => c.snippet?.trackKind === 'asr');
                return {
                    videoId,
                    captionType: hasManual ? 'human' : (hasAuto ? 'auto' : 'unknown'),
                    availableLanguages: captions.map(c => c.snippet?.language).filter(Boolean),
                };
            } catch (err) {
                console.warn(`[YouTube] Failed to get captions for ${videoId}:`, err?.message);
                return { videoId, captionType: 'unknown', availableLanguages: [] };
            }
        });

        const captionInfos = await Promise.all(captionPromises);
        const captionMap = {};
        captionInfos.forEach(info => { captionMap[info.videoId] = info; });

        const videos = (videosResponse.data.items || []).map(video => {
            const captionInfo = captionMap[video.id] || {};
            return {
                videoId: video.id,
                title: video.snippet?.title,
                description: video.snippet?.description,
                thumbnail: video.snippet?.thumbnails?.medium?.url || video.snippet?.thumbnails?.default?.url,
                channelTitle: video.snippet?.channelTitle,
                publishedAt: video.snippet?.publishedAt,
                duration: video.contentDetails?.duration,
                captionType: captionInfo.captionType || 'unknown',
                availableLanguages: captionInfo.availableLanguages || [],
            };
        });

        return res.json({
            videos,
            nextPageToken: searchResponse.data.nextPageToken || null,
            prevPageToken: searchResponse.data.prevPageToken || null,
        });
    } catch (error) {
        console.error('[YouTube Search] Error:', error?.response?.data || error?.message || error);
        const message = error?.response?.data?.error?.message || error?.message || 'Failed to search YouTube';
        res.status(error?.response?.status || 500).json({ error: message });
    }
});

// YouTube API - Get subtitles/transcript for a video
router.get('/youtube/subtitles/:videoId', async (req, res) => {
    try {
        const { videoId } = req.params;
        const { language } = req.query;

        if (!videoId) {
            return res.status(400).json({ error: 'Video ID is required' });
        }

        console.log(`[YouTube Subtitles] Fetching subtitles for video: ${videoId}, language: ${language || 'auto'}`);

        // Use youtube-transcript library to fetch subtitles
        let transcript;
        try {
            if (language) {
                transcript = await YoutubeTranscript.fetchTranscript(videoId, { lang: language });
            } else {
                transcript = await YoutubeTranscript.fetchTranscript(videoId);
            }
        } catch (transcriptError) {
            // Try without language specification if it fails
            if (language) {
                console.warn(`[YouTube Subtitles] Failed with language ${language}, trying without...`);
                transcript = await YoutubeTranscript.fetchTranscript(videoId);
            } else {
                throw transcriptError;
            }
        }

        if (!transcript || transcript.length === 0) {
            return res.status(404).json({ error: 'No subtitles available for this video' });
        }

        // Format subtitles with timing info
        const subtitles = transcript.map((item, index) => ({
            index,
            text: item.text,
            start: item.offset / 1000, // Convert ms to seconds
            duration: item.duration / 1000,
            end: (item.offset + item.duration) / 1000,
        }));

        return res.json({
            videoId,
            language: language || 'auto',
            subtitles,
            totalCount: subtitles.length,
        });
    } catch (error) {
        console.error('[YouTube Subtitles] Error:', error?.message || error);
        const message = error?.message || 'Failed to fetch subtitles';

        if (message.includes('disabled') || message.includes('Transcript is disabled')) {
            return res.status(403).json({ error: 'Subtitles are disabled for this video' });
        }
        if (message.includes('not found') || message.includes('No transcript')) {
            return res.status(404).json({ error: 'No subtitles available for this video' });
        }

        res.status(500).json({ error: message });
    }
});


module.exports = router;
