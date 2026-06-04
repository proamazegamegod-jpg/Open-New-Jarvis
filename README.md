# mini-jarvis (hackathon scaffold)

Electron + React scaffold with IPC stubs, a Gemini client, and a real-time STT WebSocket server (faster-whisper).

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
- Real STT server on `ws://localhost:9000`
- Electron main process

## What is stubbed

- `src/services/geminiClient.js` calls Gemini using `GEMINI_API_KEY` from `.env`.
- `src/services/stt_server.py` streams live microphone transcription via faster-whisper.
- `src/services/sttClient.js` forwards partial/final transcripts to the renderer.
- IPC handlers in `src/main/ipc.js` call stubbed service modules and return JSON.
- Command execution paths return placeholder results with **TODO** comments.

## STT setup (real mic)

1. Install Python dependencies:
   - `pip install faster-whisper sounddevice websockets numpy torch`
2. Run the real STT server:
   - `npm run stt`

If you want a fake transcript generator:
- `npm run stt:mock`

### Using your existing voice-control env

The STT runner checks, in order:
1. `C:\Users\asus\Desktop\voice_pc\.venv\Scripts\python.exe`
2. `C:\Users\asus\Desktop\voice_pc\venv\Scripts\python.exe`
3. `C:\Users\asus\Desktop\voice_pc\env\Scripts\python.exe`
4. `C:\Users\asus\miniconda3\envs\voice-control\python.exe`

To override, set:
- `STT_PYTHON` to the full path of your env’s Python.

# Open-New-Jarvis
