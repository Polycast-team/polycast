# Polycast Frontend

React + Vite frontend for the Polycast language learning application.

## Environment Variables

The following environment variables must be set for the application to work properly:

### Required for Production
- `VITE_API_BASE_URL` - Backend API URL (e.g., `https://polycast-server.onrender.com`)
- `VITE_WS_BASE_URL` - WebSocket URL (e.g., `wss://polycast-server.onrender.com`)

### Optional
- `VITE_APP_VERSION` - Application version (defaults to `1.0.0`)

## Development

```bash
npm install
npm run dev
```

## Building for Production

```bash
npm run build
```

## Deployment

This frontend is deployed on Render.com. Set the required environment variables in your deployment configuration.

### Render.com
Set environment variables in: Dashboard → Your Service → Environment tab
