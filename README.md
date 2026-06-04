# mini-jarvis (hackathon scaffold)

Electron + React scaffold with IPC stubs, a mocked Gemini client, and a placeholder STT WebSocket server.

## Getting started

1. Install dependencies:
   - `npm install`
2. Add your Gemini API key:
   - Create/update `.env` in the project root:
     - `GEMINI_API_KEY=your_key_here`
3. Run the dev stack:
   - `npm run dev`

This runs:
- Vite renderer dev server
- Placeholder STT server on `ws://localhost:9000`
- Electron main process

## What is stubbed

- `src/services/geminiClient.js` returns a mock response. **TODO** comment marks where to add the real API call.
- `src/services/sttClient.js` expects JSON messages from `ws://localhost:9000` and forwards partial transcripts to the renderer.
- `scripts/stt-server-placeholder.js` emits fake transcript chunks every 1.5s. Replace with faster-whisper output.
- IPC handlers in `src/main/ipc.js` call stubbed service modules and return JSON.
- Command execution paths return placeholder results with **TODO** comments.

# Open-New-Jarvis
