const express = require('express');
const cors = require('cors');

function setupExpress(app) {
    // Add CORS middleware to enable cross-origin requests
    app.use((req, res, next) => {
        // Log CORS details
        console.log(`[CORS] Request from origin: ${req.headers.origin}`);
        
        // Allow all origins for debugging
        res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.header('Access-Control-Allow-Credentials', 'true');
        
        // Log headers for debugging
        console.log(`[CORS] Response headers set:`, {
            'Access-Control-Allow-Origin': res.getHeader('Access-Control-Allow-Origin'),
            'Access-Control-Allow-Credentials': res.getHeader('Access-Control-Allow-Credentials')
        });
        
        if (req.method === 'OPTIONS') {
            return res.sendStatus(204);
        }
        next();
    });

    // Enable CORS for frontend on Render using the cors package
    app.use(cors({
      origin: true, // Allow all origins temporarily for debugging
      credentials: true
    }));

    // Enable JSON body parsing for POST requests (require application/json on client)
    app.use(express.json());
}

module.exports = setupExpress;
