const http = require('http');
const express = require('express');
const setupExpress = require('../config/express');

describe('CORS Configuration', () => {
    let app;
    let server;
    let port;

    beforeAll((done) => {
        app = express();
        setupExpress(app);
        app.get('/test', (req, res) => res.json({ ok: true }));
        server = app.listen(0, () => {
            port = server.address().port;
            done();
        });
    });

    afterAll((done) => {
        server.close(done);
    });

    const makeRequest = (origin, method = 'GET') => {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'localhost',
                port,
                path: '/test',
                method,
                headers: origin ? { Origin: origin } : {}
            };

            if (method === 'OPTIONS') {
                options.headers['Access-Control-Request-Method'] = 'GET';
            }

            const req = http.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    let body = null;
                    try {
                        body = data ? JSON.parse(data) : null;
                    } catch (e) {
                        // Non-JSON response (error pages)
                        body = data;
                    }
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        body
                    });
                });
            });

            req.on('error', reject);
            req.end();
        });
    };

    describe('Allowed Origins', () => {
        const allowedOrigins = [
            'http://localhost:5173',
            'http://localhost:3000',
            'https://polycast-205e8.web.app',
            'https://polycast-205e8.firebaseapp.com',
            'https://polycast-frontend.onrender.com'
        ];

        test.each(allowedOrigins)('should allow requests from %s', async (origin) => {
            const response = await makeRequest(origin);

            expect(response.status).toBe(200);
            expect(response.headers['access-control-allow-origin']).toBe(origin);
            expect(response.headers['access-control-allow-credentials']).toBe('true');
        });

        test.each(allowedOrigins)('should handle preflight OPTIONS from %s', async (origin) => {
            const response = await makeRequest(origin, 'OPTIONS');

            expect(response.status).toBe(204);
            expect(response.headers['access-control-allow-origin']).toBe(origin);
        });
    });

    describe('Blocked Origins', () => {
        const blockedOrigins = [
            'https://malicious-site.com',
            'http://localhost:8080',
            'https://evil.example.com',
            'http://attacker.io'
        ];

        test.each(blockedOrigins)('should block requests from %s', async (origin) => {
            const response = await makeRequest(origin);

            // CORS error - no allow-origin header for blocked origins
            expect(response.headers['access-control-allow-origin']).toBeUndefined();
        });
    });

    describe('No Origin Header', () => {
        test('should allow requests without Origin header (curl, mobile apps)', async () => {
            const response = await makeRequest(null);

            expect(response.status).toBe(200);
            expect(response.body).toEqual({ ok: true });
        });
    });

    describe('Chrome Extension CORS', () => {
        const originalEnv = process.env.ALLOWED_EXTENSION_IDS;

        afterEach(() => {
            // Restore original environment variable
            if (originalEnv !== undefined) {
                process.env.ALLOWED_EXTENSION_IDS = originalEnv;
            } else {
                delete process.env.ALLOWED_EXTENSION_IDS;
            }
        });

        test('should allow requests from whitelisted chrome extension', async () => {
            process.env.ALLOWED_EXTENSION_IDS = 'test-extension-id-123';

            const response = await makeRequest('chrome-extension://test-extension-id-123');

            expect(response.status).toBe(200);
            expect(response.headers['access-control-allow-origin']).toBe('chrome-extension://test-extension-id-123');
            expect(response.headers['access-control-allow-credentials']).toBe('true');
        });

        test('should block requests from non-whitelisted chrome extension', async () => {
            process.env.ALLOWED_EXTENSION_IDS = 'test-extension-id-123';

            const response = await makeRequest('chrome-extension://malicious-extension-456');

            // CORS error - no allow-origin header for blocked extension
            expect(response.headers['access-control-allow-origin']).toBeUndefined();
        });

        test('should support multiple extension IDs', async () => {
            process.env.ALLOWED_EXTENSION_IDS = 'ext-id-1,ext-id-2,ext-id-3';

            const response1 = await makeRequest('chrome-extension://ext-id-1');
            const response2 = await makeRequest('chrome-extension://ext-id-2');
            const response3 = await makeRequest('chrome-extension://ext-id-3');

            expect(response1.headers['access-control-allow-origin']).toBe('chrome-extension://ext-id-1');
            expect(response2.headers['access-control-allow-origin']).toBe('chrome-extension://ext-id-2');
            expect(response3.headers['access-control-allow-origin']).toBe('chrome-extension://ext-id-3');
        });

        test('should block all chrome extensions when ALLOWED_EXTENSION_IDS not set', async () => {
            delete process.env.ALLOWED_EXTENSION_IDS;

            const response = await makeRequest('chrome-extension://any-extension-id');

            expect(response.headers['access-control-allow-origin']).toBeUndefined();
        });

        test('should handle extension IDs with whitespace in comma-separated list', async () => {
            process.env.ALLOWED_EXTENSION_IDS = ' ext-1 , ext-2 , ext-3 ';

            const response = await makeRequest('chrome-extension://ext-2');

            expect(response.headers['access-control-allow-origin']).toBe('chrome-extension://ext-2');
        });
    });
});
