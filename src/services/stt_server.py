import argparse
import asyncio
import json
import os
import sys
import time
from typing import Set

# --- FORCE-LINKER (CUDA DLLS) ---
venv_path = sys.prefix
nvidia_base = os.path.join(venv_path, "Lib", "site-packages", "nvidia")
cuda_paths = [
    os.path.join(nvidia_base, "cublas", "bin"),
    os.path.join(nvidia_base, "cudnn", "bin"),
    os.path.join(nvidia_base, "cuda_nvrtc", "bin"),
]

for path in cuda_paths:
    if os.path.exists(path):
        os.environ["PATH"] = path + os.pathsep + os.environ.get("PATH", "")
        try:
            os.add_dll_directory(path)
        except Exception:
            pass
# -------------------------------

try:
    import numpy as np
except ImportError:  # pragma: no cover
    np = None

try:
    import sounddevice as sd
except ImportError:  # pragma: no cover
    sd = None

try:
    import torch
except ImportError:  # pragma: no cover
    torch = None

try:
    from faster_whisper import WhisperModel
except ImportError:  # pragma: no cover
    WhisperModel = None

try:
    import websockets
except ImportError:  # pragma: no cover
    websockets = None

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


clients: Set["websockets.WebSocketServerProtocol"] = set()


async def broadcast(payload):
    if not clients:
        return
    message = json.dumps(payload)
    stale = []
    for client in clients:
        try:
            await client.send(message)
        except Exception:
            stale.append(client)
    for client in stale:
        clients.discard(client)


async def handle_client(ws):
    clients.add(ws)
    try:
        await ws.wait_closed()
    finally:
        clients.discard(ws)


def parse_args():
    parser = argparse.ArgumentParser(description="Live STT server (faster-whisper + VAD).")
    parser.add_argument("--host", default="localhost")
    parser.add_argument("--port", type=int, default=9000)
    parser.add_argument("--model", default="tiny.en")
    parser.add_argument("--device", default="cuda")
    parser.add_argument("--compute-type", default="float16")
    parser.add_argument("--sample-rate", type=int, default=16000)
    parser.add_argument("--chunk-ms", type=int, default=32)
    parser.add_argument("--vad-threshold", type=float, default=0.5)
    parser.add_argument("--silence-seconds", type=float, default=1.0)
    parser.add_argument("--partial-interval", type=float, default=0.8)
    parser.add_argument("--mock", action="store_true")
    return parser.parse_args()


def load_vad():
    if torch is None:
        raise RuntimeError("torch is required. Install it in your STT environment.")
    vad_model, _utils = torch.hub.load(
        repo_or_dir="snakers4/silero-vad",
        model="silero_vad",
        force_reload=False,
        trust_repo=True,
    )
    vad_model.eval()
    return vad_model


def transcribe_buffer(buffer, model):
    if np is None:
        return ""
    audio_data = np.concatenate(buffer).flatten()
    segments, _ = model.transcribe(audio_data, beam_size=1)
    return " ".join(segment.text for segment in segments if segment.text).strip()


async def transcribe_loop(queue, args, vad_model, model):
    silence_chunks = int(args.sample_rate / (args.chunk_ms * 0.001) * args.silence_seconds)
    buffer = []
    is_speaking = False
    silence_counter = 0
    last_partial = 0.0

    await broadcast({"type": "status", "state": "idling"})

    while True:
        chunk = await queue.get()
        if chunk is None:
            break

        if np is None or torch is None:
            continue

        tensor_chunk = torch.from_numpy(chunk.flatten()).unsqueeze(0)
        prob = float(vad_model(tensor_chunk, args.sample_rate).item())

        if prob > args.vad_threshold:
            if not is_speaking:
                await broadcast({"type": "status", "state": "listening"})
                is_speaking = True
            buffer.append(chunk)
            silence_counter = 0

            now = time.time()
            if now - last_partial >= args.partial_interval:
                text = transcribe_buffer(buffer, model)
                if text:
                    await broadcast({"type": "partial", "text": text})
                last_partial = now
        elif is_speaking:
            buffer.append(chunk)
            silence_counter += 1
            if silence_counter > silence_chunks:
                await broadcast({"type": "status", "state": "processing"})
                text = transcribe_buffer(buffer, model)
                if text:
                    await broadcast({"type": "final", "text": text})
                buffer = []
                is_speaking = False
                silence_counter = 0
                last_partial = 0.0
                await broadcast({"type": "status", "state": "idling"})


async def mock_loop():
    samples = [
        "hello open-new-jarvis",
        "validate the deployment command",
        "dry run the cleanup task",
        "search the web for gemini models",
    ]
    idx = 0
    while True:
        await broadcast({"type": "partial", "text": samples[idx % len(samples)]})
        idx += 1
        await asyncio.sleep(1.5)


async def main_async(args):
    if websockets is None:
        raise RuntimeError("websockets is required. Run: pip install websockets")

    async with websockets.serve(handle_client, args.host, args.port):
        print(f"[stt] listening on ws://{args.host}:{args.port}")

        if args.mock:
            await mock_loop()
            return

        if sd is None:
            raise RuntimeError("sounddevice is required. Run: pip install sounddevice")
        if WhisperModel is None:
            raise RuntimeError("faster-whisper is required. Run: pip install faster-whisper")
        if np is None:
            raise RuntimeError("numpy is required. Run: pip install numpy")

        vad_model = load_vad()
        model = WhisperModel(args.model, device=args.device, compute_type=args.compute_type)
        queue = asyncio.Queue()
        loop = asyncio.get_running_loop()

        def audio_callback(indata, _frames, _time, status):
            if status:
                print(status, file=sys.stderr)
            loop.call_soon_threadsafe(queue.put_nowait, indata.copy())

        blocksize = int(args.sample_rate * (args.chunk_ms / 1000.0))
        with sd.InputStream(
            samplerate=args.sample_rate,
            channels=1,
            blocksize=blocksize,
            dtype="float32",
            callback=audio_callback,
        ):
            await transcribe_loop(queue, args, vad_model, model)


def main():
    args = parse_args()
    try:
        asyncio.run(main_async(args))
    except KeyboardInterrupt:
        sys.exit(0)
    except Exception as exc:
        print(f"[stt] error: {exc}")
        sys.exit(1)


if __name__ == "__main__":
    main()
