console.log('Server starting...');

const http = require('http');
const express = require('express');
const WebSocket = require('ws');
const config = require('./config/config');
const setupExpress = require('./config/express');
const setupHeartbeat = require('./websockets/heartbeat');
const handleWebSocketConnection = require('./websockets/connectionHandler');
const apiRoutes = require('./api/routes');
const pool = require('./profile-data/pool');

async function ensureSchema() {
    try {
        console.log('[Schema] Ensuring profiles.proficiency_level column exists...');
        await pool.query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS proficiency_level INT NOT NULL DEFAULT 3`);
        await pool.query(`DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'profiles_proficiency_level_chk'
          ) THEN
            ALTER TABLE profiles ADD CONSTRAINT profiles_proficiency_level_chk CHECK (proficiency_level BETWEEN 1 AND 5);
          END IF;
        END$$;`);

        console.log('[Schema] Ensuring practice_sentences table exists...');
        await pool.query(`CREATE TABLE IF NOT EXISTS practice_sentences (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          sentence TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`);
        await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uniq_practice_sentences_lower_sentence
          ON practice_sentences ((lower(trim(both FROM sentence))))`);
        console.log('[Schema] Schema ensured');
    } catch (e) {
        console.error('[Schema] ensure failed:', e?.message || e);
        // Do not crash; app can still run but endpoints relying on schema may error
    }
}

async function boot() {
    const app = express();
    setupExpress(app);

    // Ensure DB schema before wiring routes
    await ensureSchema();

    const server = http.createServer(app);

    const wss = new WebSocket.Server({ 
        server,
        clientTracking: true,
    });

    const heartbeat = setupHeartbeat(wss);

    wss.on('connection', (ws, req) => {
        handleWebSocketConnection(ws, req, heartbeat);
    });

    app.get('/health', (req, res) => {
        res.status(200).json({ 
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime()
        });
    });

    app.use('/api', apiRoutes);

    const PORT = process.env.PORT || config.port || 8080;
    const HOST = '0.0.0.0';

    server.listen(PORT, HOST, () => {
        console.log(`Server is running on ${HOST}:${PORT}`);
    });

    module.exports = { app, server };
}

boot();