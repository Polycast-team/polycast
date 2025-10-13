# Polycast – Project Overview (2025)

This repository contains a real-time language learning platform with a React (Vite) frontend and a Node.js/Express backend. It supports audio/video transcription, an AI‑assisted dictionary, and a spaced‑repetition flashcard system. Profiles and study data can be persisted in PostgreSQL.

## Top-level layout
- `polycast-frontend/`: React app (Vite)
- `polycast-backend/`: Node.js/Express API + WebSocket server

## Frontend (polycast-frontend)
- `src/main.jsx`: App bootstrap; renders `AppRouter`
- `src/AppRouter.jsx`: Routes for `/`, `/login`, `/register`
- `src/App.jsx`: Main container (audio, video, dictionary, flashcards)
- `components/Login.jsx`, `components/Register.jsx`: Auth screens
- `components/TranscriptionDisplay.jsx`, `components/DictionaryTable.jsx`, `components/FlashcardMode.jsx`, `components/VideoMode.jsx`
- `services/apiService.js`: Base API utilities
- `services/authClient.js`: login/register/me + JWT storage
- `hooks/*`, `utils/*`: Flashcard logic, helpers

## Backend (polycast-backend)
- `src/server.js`: Express + WebSocket server
- `src/config/config.js`: Env config (PORT, GEMINI_API_KEY, GOOGLE_SPEECH_RECOGNIZER/REGION/ENDPOINT, optional OPENAI_API_KEY/REDIS_URL)
- `src/api/routes.js`: REST API
  - Auth: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
  - Profiles: `GET /api/profiles/me`, `PUT /api/profiles/me`
  - Dictionary: `GET /api/dictionary`, `POST /api/dictionary`, `DELETE /api/dictionary/:id`
  - AI (unified): `GET /api/dictionary/unified`
  - Flashcards: `GET /api/flashcards/due`, `POST /api/flashcards/from-dictionary/:dictionaryEntryId`, `PUT /api/flashcards/:id/study-interval`
  - TTS: `POST /api/generate-audio`, legacy `POST /api/tts`
- `src/services/*`: AI and Redis helpers
- `src/websockets/*`: Transcription and signaling handlers

### Profile Data (database)
- `src/profile-data/pool.js`: Postgres pool (`DATABASE_URL`, supports `?sslmode=require`)
- `src/profile-data/migrate.js`: Run SQL migrations
- `src/profile-data/migrations/`: Schema
  - `000_profiles_ensure_columns.sql`: Ensure `profiles` has UUID `id` PK + core columns
  - `002_dictionary_entries.sql`: `dictionary_entries` (FK → `profiles(id)`)
  - `003_username_unique.sql`: Unique index on `profiles.username`
  - `004_flashcards.sql`: `flashcards` (FKs → `profiles`, `dictionary_entries`)
- `src/profile-data/dictionaryService.js`, `src/profile-data/flashcardsService.js`
- `src/services/authService.js`, `src/api/middleware/auth.js`
- Reset (danger): `src/profile-data/reset.js`, `src/profile-data/reset_all.js`

## Environment variables
- Frontend: `VITE_API_BASE_URL`, `VITE_WS_BASE_URL`
- Backend (current): `PORT`, `GEMINI_API_KEY`, `GOOGLE_SPEECH_RECOGNIZER`, `GOOGLE_SPEECH_REGION`, `GOOGLE_SPEECH_ENDPOINT`; optional `OPENAI_API_KEY`, `REDIS_URL`
- Backend (DB): `DATABASE_URL` (External, often with `?sslmode=require`), `JWT_SECRET`, optional `BCRYPT_ROUNDS`

## Local development
- Frontend: `cd polycast-frontend && npm install && npm run dev`
- Backend: `cd polycast-backend && npm install && npm run dev`
- Migrations: `node src/profile-data/migrate.js`
- Full reset (danger): `node src/profile-data/reset_all.js`

## Deployment tips
- Prefer Node 20 LTS on Render
- Set `DATABASE_URL`, `JWT_SECRET`, and API keys in Render env
- Post-deploy command: `node src/profile-data/migrate.js`
