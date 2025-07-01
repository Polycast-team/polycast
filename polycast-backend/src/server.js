require('dotenv').config();
console.log('Server starting...');

const http = require('http');
const express = require('express');
const WebSocket = require('ws');
const config = require('../config/config');
const setupExpress = require('./config/express');
const setupHeartbeat = require('./websockets/heartbeat');
const handleWebSocketConnection = require('./websockets/connectionHandler');
const handleTextModeConnection = require('./websockets/textModeHandler');
const apiRoutes = require('./api/routes');
const { loadModeFromDisk } = require('./utils/mode');

// Debug: Print OpenAI API Key (should be defined, or print warning)
if (process.env.OPENAI_API_KEY) {
    console.log('OpenAI API Key loaded:', process.env.OPENAI_API_KEY.slice(0, 8) + '...');
} else {
    console.warn('OpenAI API Key is NOT loaded! Check your .env file and dotenv config.');
}

const app = express();
setupExpress(app);

const server = http.createServer(app);

const wss = new WebSocket.Server({ 
    server,
    clientTracking: true,
});

const heartbeat = setupHeartbeat(wss);

let isTextMode = loadModeFromDisk();

wss.on('connection', (ws, req) => {
    if (isTextMode) {
        handleTextModeConnection(ws, req);
    } else {
        handleWebSocketConnection(ws, req, heartbeat, isTextMode);
    }
});

app.use('/api', apiRoutes);

const PORT = process.env.PORT || config.port || 3000;

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

module.exports = { app, server };