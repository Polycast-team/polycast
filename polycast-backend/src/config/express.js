const express = require('express');
const cors = require('cors');

function setupExpress(app) {
    // CORS configuration with allowed origins
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:3000',
      'https://polycast-205e8.web.app',
      'https://polycast-205e8.firebaseapp.com',
      'https://polycast-frontend.onrender.com',
      'https://www.youtube.com'  // Allow Chrome extension on YouTube
    ];

    app.use(cors({
      origin: function(origin, callback) {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true
    }));

    // Enable JSON body parsing for POST requests (require application/json on client)
    app.use(express.json());
}

module.exports = setupExpress;
