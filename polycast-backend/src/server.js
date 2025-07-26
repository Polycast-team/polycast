console.log('Server starting...');

const http = require('http');
const express = require('express');
const WebSocket = require('ws');
const config = require('./config/config');
const setupExpress = require('./config/express');
const setupHeartbeat = require('./websockets/heartbeat');
const handleWebSocketConnection = require('./websockets/connectionHandler');
const apiRoutes = require('./api/routes');

const app = express();
setupExpress(app);

const server = http.createServer(app);

const wss = new WebSocket.Server({ 
    server,
    clientTracking: true,
});

const heartbeat = setupHeartbeat(wss);

wss.on('connection', (ws, req) => {
    handleWebSocketConnection(ws, req, heartbeat);
});

app.use('/api', apiRoutes);

const PORT = process.env.PORT || config.port || 3000;

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

module.exports = { app, server };