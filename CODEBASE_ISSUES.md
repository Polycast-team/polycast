# Polycast Codebase Issues & Inefficiencies

## Critical

- [x] **CORS Misconfiguration** - `polycast-backend/src/config/express.js` - Fixed: uses allowlist of specific origins (15 tests in `cors.test.js`)
- [x] **Monolithic App.jsx** - `polycast-frontend/src/App.jsx` - Refactored from 1504 to 526 lines (4 hooks, 4 components extracted)
- [ ] **Room Code Generation Blocking** - `polycast-backend/src/utils/room.js:16-25` - Synchronous loop (up to 90k iterations) can block event loop
- [ ] **No Rate Limiting** - API endpoints vulnerable to brute-force attacks
- [ ] **Missing Environment Variable Validation** - Backend crashes if required API keys missing

## Major Code Smells

- [ ] **Global Window State** - `polycast-frontend/src/authClient.js:56-58` - `window.pc_profileProficiency` and `window.pc_profileLanguages` pollute global scope
- [ ] **Duplicate DB Query Fallbacks** - `polycast-backend/src/services/authService.js:47-65` - Try-catch pattern for schema evolution is fragile
- [ ] **Hardcoded Model Names** - Gemini model versions scattered across multiple files (routes.js, config.js, popupGeminiService.js)
- [ ] **Event-Driven State Sync Issues** - `polycast-frontend/src/main.jsx:113-122` - Custom events + localStorage create race conditions
- [ ] **No Error Boundaries** - Frontend crashes on API errors

## Moderate Issues

- [ ] **Redis Optional but Not Well Tested** - `polycast-backend/src/services/redisService.js` - Silent fallbacks may hide deployment issues
- [ ] **No Request/Response Validation** - Minimal input validation (only null checks), should use Zod/Joi
- [ ] **Missing Tests** - Only ~6 test files (added `cors.test.js`), <10% coverage estimated
- [ ] **WebSocket Timeout Hardcoded** - `polycast-backend/src/websocket/connectionHandler.js:70` - 60-second timeout not configurable
- [ ] **Memory Leak Risk** - `polycast-backend/src/websocket/connectionHandler.js:7-24` - `rejectedRoomCodes` Map grows unbounded
- [ ] **No Audit Logging** - No logging of auth attempts, deletions, or account changes

## Performance Concerns

- [ ] **No Gemini Response Caching** - Each unique word hits API (no caching layer)
- [ ] **Unoptimized React Renders** - Multiple state updates in App.jsx that could batch better
- [ ] **Potential N+1 Queries** - No eager loading in dictionary/flashcard queries
- [ ] **WebSocket Broadcast** - No message queuing; direct broadcast may queue messages at scale

## Minor Issues

- [ ] **Inconsistent Logging** - Mix of console.log/console.error with custom prefixes, should use logger library
- [ ] **Magic Numbers** - Hardcoded values throughout (7 lines for Gemini response, 12 bcrypt rounds, 60s timeout)
- [ ] **No API Documentation** - Missing OpenAPI/Swagger specs
- [ ] **Large CSS Files** - 14KB+ App.css without component scoping
- [ ] **Unused Dependencies** - `locate-path` in package.json appears unused
- [ ] **Console Warnings in Production** - Verbose `console.log` statements left in production code
