# Migration Plan: Render → Firebase/Google Cloud

## Phase 1: Preparation & Setup (2-3 hours)

### 1.1 Google Cloud Setup
- [x] Create Google Cloud Project
- [x] Enable required APIs: Cloud Run, Cloud SQL, Memorystore, Firebase
- [x] Set up billing and configure budget alerts
- [x] Create service accounts for deployment

### 1.2 Firebase Setup
- [x] Initialize Firebase project (use same GCP project)
- [x] Install Firebase CLI tools locally
- [x] Configure Firebase Hosting

### 1.3 Database Migration Prep
- [x] ~~Export PostgreSQL data from Render~~ (SKIPPED - databases disabled for now)
- [x] ~~Document current Redis usage patterns~~ (SKIPPED - databases disabled for now)
- [x] Note all environment variables

## Phase 2: Backend Migration to Cloud Run (30 minutes)

### 2.1 Create Dockerfile for Backend
- [ ] Create Dockerfile in polycast-backend/
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 8080
CMD ["node", "src/server.js"]
```

### 2.2 Deploy to Cloud Run
- [ ] Build and push Docker image to Container Registry
- [ ] Deploy to Cloud Run with:
  - [ ] WebSocket support enabled
  - [ ] Environment variables configured (API keys only)
  - [ ] Public access enabled
- [ ] Get new backend URL

## Phase 3: Frontend Migration (25 minutes)

### 3.1 Update Frontend Code
- [ ] Replace all `polycast-server.onrender.com` references with new Cloud Run URL
- [ ] Update WebSocket URLs to use new Cloud Run endpoint
- [ ] Update environment variables

### 3.2 Deploy to Firebase Hosting
- [ ] Build production bundle: `npm run build`
- [ ] Deploy: `firebase deploy --only hosting`
- [ ] Test deployment

## Phase 4: Testing & Verification (15 minutes)

### 4.1 Basic Testing
- [ ] Test frontend loads correctly
- [ ] Verify API endpoints work (Gemini, Deepgram, OpenAI)
- [ ] Test WebSocket connections
- [ ] Test audio/video features (non-database features)

### 4.2 Final Steps
- [ ] Document new URLs
- [ ] Update any local development configs
- [ ] Celebrate! 🎉

## ~~Phase 5: Database Migration (Future)~~
**DEFERRED**: Database features (PostgreSQL, Redis) can be added later when needed:
- Cloud SQL setup
- Memorystore Redis
- Data migration
- User profiles/progress

## Cost Estimates

### Google Cloud (Pay-as-you-go) - Simplified Setup
- Cloud Run: ~$5-15/month (based on usage)
- Firebase Hosting: ~$0-5/month (likely free tier)
- **Total: ~$5-20/month** (scales with usage)
- **Plus**: $300 free credits for first 90 days

### Current Render Costs
- Based on suspended services shown: likely $25-50/month minimum
- Less flexible scaling

## Required Environment Variables to Update

### Backend (.env)
```
DATABASE_URL=postgresql://[CLOUD_SQL_CONNECTION]
REDIS_URL=redis://[MEMORYSTORE_IP]:6379
FRONTEND_URL=https://[YOUR_PROJECT].web.app
```

### Frontend (.env)
```
VITE_API_BASE_URL=https://[CLOUD_RUN_URL]
VITE_WS_BASE_URL=wss://[CLOUD_RUN_URL]
```

## Key Benefits
- **Better scalability**: Auto-scales based on traffic
- **Cost efficiency**: Pay only for what you use
- **Improved performance**: Google's global infrastructure
- **Native integrations**: Direct integration with Gemini API
- **Enhanced monitoring**: Built-in Google Cloud observability

## Files Requiring Updates (Hardcoded URLs Found)
- `/polycast-frontend/src/App.jsx` (3 locations)
- `/polycast-frontend/src/hooks/useFlashcardSRS.js` (1 location)
- `/polycast-frontend/src/mobile/MobileApp.jsx` (1 location)
- `/polycast-frontend/src/mobile/components/MobileFlashcardMode.jsx` (1 location)
- `/polycast-frontend/src/mobile/components/MobileProfileSelector.jsx` (1 location)
- `/polycast-frontend/src/utils/flashcardAudio.js` (1 location)
- `/polycast-frontend/.env.example` (2 locations)
- `/polycast-frontend/vite.config.js` (1 location)

This migration preserves all functionality while moving to a more scalable, cost-effective infrastructure.