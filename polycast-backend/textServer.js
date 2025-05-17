// textServer.js
// Standalone backend for Polycast text mode translation
require('dotenv').config();
console.log('Text Mode Server starting...');

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const url = require('url');
const config = require('./config/config');
const textModeLLM = require('./services/textModeLLM');

const app = express();
const server = http.createServer(app);

// Use a different port for text mode (default 8090)
const TEXT_MODE_PORT = process.env.PORT || process.env.TEXT_MODE_PORT || 8090;

const wss = new WebSocket.Server({ server });
console.log(`Text Mode WebSocket server created.`);

const clientTargetLanguages = new Map();

wss.on('connection', (ws, req) => {
    // Parse target languages from connection URL query param
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
                console.log(`Client connected. Invalid targetLangs in URL, defaulting to ${targetLangsArray[0]}`);
            } else {
                console.log(`Client connected. Target languages from URL: ${targetLangsArray.join(', ')}`);
            }
        } else {
            console.log(`Client connected. No targetLangs in URL, defaulting to ${targetLangsArray[0]}`);
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
});

server.listen(TEXT_MODE_PORT, () => {
    console.log(`Text Mode HTTP server listening on port ${TEXT_MODE_PORT}`);
});

// Health check endpoint
app.get('/', (req, res) => {
    res.status(200).send('Polycast Text Mode Backend Server is running.');
});

module.exports = { server, wss };
