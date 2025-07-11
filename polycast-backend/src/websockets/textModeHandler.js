// src/websockets/textModeHandler.js
const url = require('url');
const textModeLLM = require('../services/textModeLLM');

const clientTargetLanguages = new Map();

function handleTextModeConnection(ws, req) {
    let targetLangsArray = ['Spanish'];
    try {
        const parsedUrl = url.parse(req.url, true);
        if (parsedUrl.query && parsedUrl.query.targetLangs) {
            targetLangsArray = parsedUrl.query.targetLangs
                .split(',')
                .map(lang => decodeURIComponent(lang.trim()))
                .filter(lang => lang.length > 0);
            if (targetLangsArray.length === 0) {
                targetLangsArray = ['Spanish'];
            }
        }
    } catch (e) {
        console.error('Error parsing connection URL for target languages:', e);
    }
    clientTargetLanguages.set(ws, targetLangsArray);

    ws.on('message', async (message) => {
        let parsed;
        try {
            parsed = JSON.parse(message);
        } catch (e) {
            console.warn('[TextServer] Received non-JSON message. Ignoring.');
            return;
        }
        if (parsed.type === 'text_translate') {
            const { sourceLang, sourceText } = parsed;
            const targetLangs = clientTargetLanguages.get(ws) || ['Spanish'];
            try {
                const results = await textModeLLM.translateTextBatch(sourceText, sourceLang, targetLangs);
                ws.send(JSON.stringify({ type: 'translations_batch', data: results }));
            } catch (err) {
                console.error('[TextServer] TextModeLLM batch translation error:', err);
                ws.send(JSON.stringify({ type: 'translation_error', message: err.message }));
            }
        }
    });

    ws.on('close', () => {
        clientTargetLanguages.delete(ws);
        console.log('Text client disconnected');
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        clientTargetLanguages.delete(ws);
    });

    ws.send(JSON.stringify({ type: 'info', message: `Connected to Polycast Text Mode backend (Targets: ${targetLangsArray.join(', ')})` }));
}

module.exports = handleTextModeConnection;
