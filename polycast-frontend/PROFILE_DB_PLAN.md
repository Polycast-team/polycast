## Goal
Move all profile-related data out of localStorage into a PostgreSQL 16 database with secure auth. Persist for each profile:
- username, password (hashed)
- native language, target language
- dictionary contents (full Gemini unified payload values, including example sentences, translation, definition, frequency)
- flashcard study interval (rename from "flashcard interval" → "study interval") and related review timing

## High-level Architecture
- Keep current unified Gemini flow on the backend; upon success, persist entries to DB and return the saved record to the client.
- Frontend reads/writes via REST APIs; stop using localStorage except for one-time migration/import.
- Auth via username/password → JWT; attach Authorization: Bearer <token> for API calls.

## Data Model (PostgreSQL 16)
- profiles
  - id (uuid PK)
  - username (text unique)
  - password_hash (text)
  - native_language (text)
  - target_language (text)
  - created_at (timestamptz default now())
  - updated_at (timestamptz default now())
- dictionary_entries
  - id (uuid PK)
  - profile_id (uuid FK → profiles.id)
  - word (text, index (profile_id, word))
  - word_sense_id (text)  // unique per profile+word sense
  - translation (text)
  - definition (text)
  - frequency (int)
  - example_sentences_generated (text) // the long unified string
  - example_for_dictionary (text)
  - contextual_explanation (text)
  - raw_unified_json (jsonb) // full payload as safety net
  - in_flashcards (boolean default true)
  - created_at (timestamptz default now())
  - updated_at (timestamptz default now())
- flashcards
  - id (uuid PK)
  - profile_id (uuid FK)
  - dictionary_entry_id (uuid FK → dictionary_entries.id)
  - study_interval_level (int) // renamed from interval
  - due_at (timestamptz)
  - last_reviewed_at (timestamptz)
  - correct_count (int default 0)
  - incorrect_count (int default 0)
  - created_at (timestamptz default now())
  - updated_at (timestamptz default now())

---

## Backend TODO (polycast-backend)

### Configuration & Utilities
- [ ] Add `.env` vars: `DATABASE_URL`, `JWT_SECRET`, `BCRYPT_ROUNDS=12` (or similar)
- [ ] Create `src/db/pool.js` to export a `pg.Pool` using `DATABASE_URL`
- [ ] Create `src/db/migrations/` with SQL migrations for tables defined above
- [ ] Add a minimal migration runner script `src/db/migrate.js` (node-postgres) and npm scripts: `migrate:up`, `migrate:down`

### Auth
- [ ] Add `bcrypt` and `jsonwebtoken` deps
- [ ] Create `src/services/authService.js` (hash/verify, issue/verify JWT)
- [ ] Add routes `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- [ ] Create middleware `src/api/middleware/auth.js` to decode JWT and set `req.user`

### Profiles API
- [ ] Create `src/services/profileService.js` with get/update for native/target languages
- [ ] Routes:
  - [ ] `GET /api/profiles/me` → { username, nativeLanguage, targetLanguage }
  - [ ] `PUT /api/profiles/me` → update native/target languages

### Dictionary API
- [ ] Create `src/services/dictionaryService.js` (CRUD for dictionary_entries)
- [ ] Routes (auth required):
  - [ ] `GET /api/dictionary` → list entries for current profile
  - [ ] `POST /api/dictionary` → add one entry (accepts unified payload shape)
  - [ ] `POST /api/dictionary/batch` → bulk add (from AddWordPopup senses)
  - [ ] `DELETE /api/dictionary/:id` → remove entry
- [ ] Integrate `popupGeminiService.getUnifiedWordData` path: after generating, persist to DB, return saved row

### Flashcards API
- [ ] Create `src/services/flashcardService.js`
- [ ] Routes (auth required):
  - [ ] `GET /api/flashcards/due` → compute and return due cards for profile
  - [ ] `PUT /api/flashcards/:id/study-interval` → update `study_interval_level`, `due_at`, `last_reviewed_at`
  - [ ] `POST /api/flashcards/from-dictionary/:dictionaryEntryId` → ensure flashcard row exists

### Migration (localStorage → DB)
- [ ] Add `POST /api/migrate/local` (auth required): accepts `{ selectedWords, wordDefinitions }` and imports into `dictionary_entries` + creates `flashcards` with initial study intervals
- [ ] Ensure idempotency by deduping on `(profile_id, word_sense_id)`

### WS/Room Integration (optional now)
- [ ] Keep current room flow; DB is independent of room lifecycle

### Security & Ops
- [ ] Rate limit auth endpoints
- [ ] CORS: allow frontend origin
- [ ] Add backups/retention note for DB

---

## Frontend TODO (polycast-frontend)

### Auth UI & Client
- [ ] Create `src/components/Auth/Login.jsx`, `Register.jsx`
- [ ] Add `src/services/authClient.js` (login/register/me, token storage)
- [ ] On login: store JWT (httpOnly cookie preferred; if local, localStorage fallback) and fetch profile

### API Client
- [ ] Update `src/services/apiService.js` to attach `Authorization` header when token present
- [ ] Add methods:
  - [ ] `getProfile()`, `updateProfile()`
  - [ ] `listDictionary()`, `createDictionaryEntry()`, `createDictionaryBatch()`, `deleteDictionaryEntry()`
  - [ ] `getDueFlashcards()`, `updateStudyInterval(id, payload)`, `ensureFlashcardFromDictionary(id)`
  - [ ] `migrateLocalToServer(payload)`

### Replace localStorage State
- [ ] Create hook `src/hooks/useServerDictionary.js` to fetch and manage entries from API
- [ ] Create hook `src/hooks/useProfileSettings.js` to manage native/target language via API
- [ ] Update `App.jsx` to use server-backed hooks; remove localStorage migrations
- [ ] Update `TranscriptionDisplay.jsx` add-word flow: call unified endpoint (unchanged), then refresh server dictionary
- [ ] Update `FlashcardMode.jsx` to read cards from API; rename interval → study interval throughout UI

### One-time Migration UX
- [ ] On first login for a profile, detect legacy localStorage keys and show “Import to cloud” dialog
- [ ] Call `migrateLocalToServer` then clear legacy keys upon success

### Terminology & UI Text
- [ ] Replace “interval” → “study interval” in labels/tooltips

### Tests
- [ ] Update unit tests for hooks and API client

---

## Deployment & Env
- [ ] Backend (Render):
  - Required (current app): `PORT`, `GEMINI_API_KEY`, `DEEPGRAM_API_KEY`
  - Optional (current app): `OPENAI_API_KEY` (TTS only), `REDIS_URL`
  - Required (DB phases): `DATABASE_URL` (Postgres 16), `JWT_SECRET`
  - Optional (DB phases): `BCRYPT_ROUNDS` (default 12)
- [ ] Frontend: set `VITE_API_BASE_URL`, `VITE_WS_BASE_URL`

## Rollout Plan (Phases)
- [x] Phase 1: Backend DB bootstrap (COMPLETED)
  - [x] DB pool
  - [x] Migrations for `profiles` (idempotent patch to existing table, add UUID PK)
  - [x] Auth (register/login/me), JWT middleware
  - [x] Profile settings API (GET/PUT native/target language)
- [x] Phase 2: Dictionary persistence (SERVER DONE)
  - [x] Table `dictionary_entries` with FK → `profiles(id)`
  - [x] CRUD endpoints (GET list, POST create/upsert, DELETE)
  - [x] Keep unified Gemini endpoint; client can generate then persist
  - [ ] Frontend integration (replace localStorage reads/writes with server calls)
- [ ] Phase 3: Flashcards persistence
  - `flashcards` table, study interval rename
  - Due cards + update study interval endpoints
- [ ] Phase 4: Frontend migration
  - Replace localStorage hooks with server-backed hooks
  - One-time import prompt and API, then cleanup

## Notes
- Passwords are never stored in plaintext; use bcrypt.
- Consider `raw_unified_json` (jsonb) to preserve full Gemini data for future evolution.
- Keep changes isolated in new files; minimize edits in large components.

## Next Actions
- Backend
  - [ ] Add unique constraint on `profiles.username` if not present
  - [ ] Phase 3 migrations and endpoints for `flashcards`
- Frontend
  - [ ] Add auth client (login/register/me) and persist token
  - [ ] Implement server-backed dictionary hook (list/create/delete)
  - [ ] Swap add-word flow to: call unified → POST `/api/dictionary` → refresh list
  - [ ] Rename UI labels from “interval” → “study interval” (Phase 3)


