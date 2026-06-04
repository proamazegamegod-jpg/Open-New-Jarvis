const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { app, BrowserWindow, ipcMain } = require('electron');
const { execFile, spawn } = require('child_process');
const WebSocket = require('ws');
const { uIOhook, UiohookKey } = require('uiohook-napi');
const registerIpcHandlers = require('./ipc');
const { createSttClient } = require('../services/sttClient');

require('dotenv').config();

let mainWindow;
let sttClient;
let sttProcess;
let handlersRegistered = false;
let hotkeyHookStarted = false;
let hotkeyToggleInFlight = false;
let sttProcessStopping = false;
const STT_HOST = '127.0.0.1';
const STT_PORT = 9000;
const STT_URL = `ws://${STT_HOST}:${STT_PORT}`;
const STT_HEALTH_TIMEOUT_MS = 1200;
const STT_PROCESS_KILL_DELAY_MS = 400;
const STT_TOGGLE_KEYS = new Set([UiohookKey.R, UiohookKey[1], UiohookKey.Numpad1]);
const pressedKeys = new Set();
let sttToggleHotkeyArmed = false;
const sttState = {
  enabled: true,
  status: 'Waiting',
  connection: 'Offline',
  transcript: '',
  message: 'Voice control is offline.'
};

const emitSttState = () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send('stt:state', { ...sttState });
};

const updateSttState = (nextState) => {
  Object.assign(sttState, nextState);
  if (!sttState.enabled) {
    sttState.transcript = '';
    sttState.message = '';
  } else if (sttState.transcript) {
    sttState.message = sttState.transcript;
  } else if (sttState.connection === 'Starting' || sttState.status === 'Starting') {
    sttState.message = 'Starting voice control...';
  } else if (sttState.connection === 'Offline' || sttState.status === 'Offline') {
    sttState.message = 'Voice control is offline.';
  } else if (sttState.status === 'Processing') {
    sttState.message = 'Processing speech...';
  } else if (sttState.status === 'Waiting' || sttState.status === 'Idle' || sttState.status === 'Listening') {
    sttState.message = 'Listening for speech.';
  } else {
    sttState.message = '';
  }
  emitSttState();
};

const clearSttContext = () => {
  const nextState = {
    transcript: ''
  };

  if (!sttState.enabled) {
    nextState.status = 'Off';
    nextState.connection = 'Stopped';
  } else if (sttState.connection === 'Connected') {
    nextState.status = 'Waiting';
  }

  updateSttState(nextState);

  return {
    ok: true,
    data: { ...sttState }
  };
};

const stopSttClient = () => {
  if (!sttClient) {
    return;
  }

  sttClient.stop();
  sttClient = null;
};

const attachSttClient = () => {
  if (sttClient) {
    return;
  }

  sttClient = createSttClient({
    url: STT_URL,
    onPartial: (payload) => {
      if (!sttState.enabled) {
        return;
      }
      const transcript = String(payload?.text ?? payload?.partial ?? '').trim();
      updateSttState({
        transcript
      });
      if (!mainWindow || mainWindow.isDestroyed()) {
        return;
      }
      mainWindow.webContents.send('stt:partial', payload);
    },
    onFinal: (payload) => {
      if (!sttState.enabled) {
        return;
      }
      const transcript = String(payload?.text ?? '').trim();
      updateSttState({
        transcript
      });
      if (!mainWindow || mainWindow.isDestroyed()) {
        return;
      }
      mainWindow.webContents.send('stt:final', payload);
    },
    onStatus: (payload) => {
      const next = {};

      if (payload.state === 'connected') {
        next.connection = 'Connected';
        if (
          sttState.enabled &&
          (sttState.status === 'Offline' || sttState.status === 'Waiting' || sttState.status === 'Starting')
        ) {
          next.status = 'Waiting';
        }
      } else if (payload.state === 'disconnected') {
        next.connection = sttState.enabled ? 'Offline' : 'Stopped';
        next.status = sttState.enabled ? 'Offline' : 'Off';
        next.transcript = '';
      } else if (payload.state === 'listening') {
        next.status = 'Listening';
      } else if (payload.state === 'processing') {
        next.status = 'Processing';
      } else if (payload.state === 'idling') {
        next.status = sttState.enabled ? 'Idle' : 'Off';
      }

      updateSttState(next);
    }
  });
};

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });

  if (!handlersRegistered) {
    registerIpcHandlers();
    handlersRegistered = true;
  }

  const isDev = !app.isPackaged || process.env.NODE_ENV === 'development';
  const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';

  if (isDev) {
    mainWindow.loadURL(`${devServerUrl}/app`);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    const rendererEntry = path.resolve(__dirname, '..', '..', 'dist', 'index.html');
    const rendererUrl = pathToFileURL(rendererEntry);
    rendererUrl.hash = '/app';
    mainWindow.loadURL(rendererUrl.toString());
  }

  mainWindow.webContents.on('did-finish-load', () => {
    emitSttState();
  });
};

const isSttServerAvailable = () =>
  new Promise((resolve) => {
    const socket = new WebSocket(STT_URL);
    let settled = false;

    const cleanup = (result) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      try {
        socket.removeAllListeners();
      } catch (_error) {
        // Ignore listener cleanup issues during shutdown.
      }
      try {
        if (socket.readyState === WebSocket.OPEN) {
          socket.close();
        } else if (socket.readyState === WebSocket.CONNECTING) {
          socket.once('error', () => {});
          socket.terminate();
        }
      } catch (_error) {
        // Ignore close races during health checks.
      }
      resolve(result);
    };

    const timeout = setTimeout(() => cleanup(false), STT_HEALTH_TIMEOUT_MS);
    socket.once('open', () => cleanup(true));
    socket.once('error', () => cleanup(false));
    socket.once('unexpected-response', () => cleanup(false));
  });

const runPowerShell = (command) =>
  new Promise((resolve, reject) => {
    execFile(
      'powershell',
      ['-NoProfile', '-Command', command],
      { windowsHide: true },
      (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }

        resolve({ stdout: String(stdout || '').trim(), stderr: String(stderr || '').trim() });
      }
    );
  });

const stopProcessTree = async (rootPid) => {
  if (!rootPid) {
    return;
  }

  const script = `
    $rootPid = ${Number(rootPid)}
    $all = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue
    $pending = [System.Collections.Generic.Queue[int]]::new()
    $ids = [System.Collections.Generic.List[int]]::new()
    $pending.Enqueue($rootPid)
    while ($pending.Count -gt 0) {
      $current = $pending.Dequeue()
      if ($ids.Contains($current)) { continue }
      $ids.Add($current)
      $children = $all | Where-Object { $_.ParentProcessId -eq $current } | Select-Object -ExpandProperty ProcessId
      foreach ($child in $children) {
        $pending.Enqueue([int]$child)
      }
    }
    $ordered = $ids | Sort-Object -Descending
    foreach ($id in $ordered) {
      Stop-Process -Id $id -ErrorAction SilentlyContinue
    }
  `;

  await runPowerShell(script);
};

const getSttProcessOnPort = async () => {
  const script = `
    $conn = Get-NetTCPConnection -LocalPort ${STT_PORT} -ErrorAction SilentlyContinue |
      Where-Object { $_.State -eq 'Listen' } |
      Select-Object -First 1
    if (-not $conn) { return }
    Get-CimInstance Win32_Process -Filter "ProcessId = $($conn.OwningProcess)" |
      Select-Object ProcessId, Name, ExecutablePath, CommandLine |
      ConvertTo-Json -Compress
  `;

  try {
    const { stdout } = await runPowerShell(script);
    if (!stdout) {
      return null;
    }

    return JSON.parse(stdout);
  } catch (_error) {
    return null;
  }
};

const stopStaleSttProcess = async () => {
  const processInfo = await getSttProcessOnPort();
  if (!processInfo) {
    return false;
  }

  const processName = String(processInfo.Name || '').toLowerCase();
  const commandLine = String(processInfo.CommandLine || '').toLowerCase();

  if (!processName.startsWith('python') || !commandLine.includes('stt_server.py')) {
    return false;
  }

  try {
    await runPowerShell(`Stop-Process -Id ${processInfo.ProcessId}`);
    await new Promise((resolve) => {
      setTimeout(resolve, STT_PROCESS_KILL_DELAY_MS);
    });
    return true;
  } catch (_error) {
    return false;
  }
};

const stopOwnedSttProcess = async () => {
  if (!sttProcess || sttProcess.killed) {
    sttProcess = null;
    return false;
  }

  const ownedPid = sttProcess.pid;
  sttProcessStopping = true;

  try {
    stopSttClient();
    await stopProcessTree(ownedPid);
    await new Promise((resolve) => {
      setTimeout(resolve, STT_PROCESS_KILL_DELAY_MS);
    });
    sttProcess = null;
    return true;
  } catch (_error) {
    return false;
  } finally {
    sttProcessStopping = false;
  }
};

const waitForSttServer = async (attempts = 30, delayMs = 500) => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (await isSttServerAvailable()) {
      return true;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, delayMs);
    });
  }

  return false;
};

const ensureSttServer = async () => {
  const isRunning = await isSttServerAvailable();
  if (isRunning) {
    updateSttState({
      connection: 'Connected',
      status: sttState.enabled ? 'Waiting' : 'Off',
      transcript: sttState.enabled ? sttState.transcript : ''
    });
    return true;
  }

  await stopStaleSttProcess();

  if (sttProcess && !sttProcess.killed) {
    return waitForSttServer();
  }

  const repoRoot = path.resolve(__dirname, '..', '..');
  const scriptPath = path.join(repoRoot, 'scripts', 'stt-runner.ps1');
  if (app.isPackaged && !fs.existsSync(scriptPath)) {
    updateSttState({
      connection: 'Offline',
      status: 'Offline',
      transcript: ''
    });
    return false;
  }

  updateSttState({
    connection: 'Starting',
    status: sttState.enabled ? 'Starting' : 'Off',
    transcript: ''
  });

  sttProcess = spawn(
    'powershell',
    ['-ExecutionPolicy', 'Bypass', '-File', scriptPath, '--host', STT_HOST, '--port', String(STT_PORT)],
    {
      cwd: repoRoot,
      stdio: 'pipe',
      windowsHide: true
    }
  );

  sttProcess.stdout.on('data', (chunk) => {
    process.stdout.write(String(chunk));
  });
  sttProcess.stderr.on('data', (chunk) => {
    process.stderr.write(String(chunk));
  });
  sttProcess.once('exit', () => {
    sttProcess = null;
    if (sttProcessStopping) {
      return;
    }
    if (!sttState.enabled) {
      return;
    }

    void (async () => {
      const stillAvailable = await isSttServerAvailable();
      if (stillAvailable) {
        updateSttState({
          connection: 'Connected',
          status: sttState.enabled ? 'Waiting' : 'Off',
          transcript: sttState.enabled ? sttState.transcript : ''
        });
        attachSttClient();
        return;
      }

      stopSttClient();
      updateSttState({
        connection: 'Offline',
        status: 'Offline',
        transcript: ''
      });
    })();
  });

  const ready = await waitForSttServer();
  if (!ready) {
    updateSttState({
      connection: 'Offline',
      status: 'Offline',
      transcript: ''
    });
    return false;
  }

  updateSttState({
    connection: 'Connected',
    status: sttState.enabled ? 'Waiting' : 'Off',
    transcript: sttState.enabled ? sttState.transcript : ''
  });
  return true;
};

const setSttEnabled = async (enabled) => {
  if (!enabled) {
    stopSttClient();
    await stopOwnedSttProcess();
    updateSttState({
      enabled: false,
      status: 'Off',
      connection: 'Stopped',
      transcript: ''
    });
    return { ok: true, data: { ...sttState } };
  }

  updateSttState({
    enabled: true,
    status: 'Waiting',
    connection: 'Offline',
    transcript: ''
  });

  const ready = await ensureSttServer();
  if (!ready) {
    return {
      ok: false,
      error: 'STT server did not start.',
      data: { ...sttState }
    };
  }
  attachSttClient();
  emitSttState();

  return { ok: true, data: { ...sttState } };
};

const areToggleKeysPressed = () =>
  pressedKeys.has(UiohookKey.R) &&
  (pressedKeys.has(UiohookKey[1]) || pressedKeys.has(UiohookKey.Numpad1));

const toggleSttFromHotkey = async () => {
  if (hotkeyToggleInFlight) {
    return;
  }

  hotkeyToggleInFlight = true;

  try {
    await setSttEnabled(!sttState.enabled);
  } finally {
    hotkeyToggleInFlight = false;
  }
};

const registerSttToggleHotkey = () => {
  if (hotkeyHookStarted) {
    return;
  }

  uIOhook.on('keydown', (event) => {
    if (!event || !STT_TOGGLE_KEYS.has(event.keycode)) {
      return;
    }

    pressedKeys.add(event.keycode);
    if (areToggleKeysPressed() && !sttToggleHotkeyArmed) {
      sttToggleHotkeyArmed = true;
      void toggleSttFromHotkey();
    }
  });

  uIOhook.on('keyup', (event) => {
    if (!event || !STT_TOGGLE_KEYS.has(event.keycode)) {
      return;
    }

    pressedKeys.delete(event.keycode);
    if (!areToggleKeysPressed()) {
      sttToggleHotkeyArmed = false;
    }
  });

  uIOhook.start();
  hotkeyHookStarted = true;
};

app.whenReady().then(async () => {
  const ready = await ensureSttServer();
  if (ready) {
    attachSttClient();
  }
  registerSttToggleHotkey();
  createWindow();

  ipcMain.handle('getSttState', async () => ({ ok: true, data: { ...sttState } }));
  ipcMain.handle('setSttEnabled', async (_event, enabled) => setSttEnabled(Boolean(enabled)));
  ipcMain.handle('clearSttContext', async () => clearSttContext());

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      emitSttState();
    }
  });
});

app.on('will-quit', () => {
  if (hotkeyHookStarted) {
    try {
      uIOhook.stop();
    } catch (_error) {
      // Ignore shutdown races from the low-level hook.
    }
  }
});

app.on('window-all-closed', () => {
  stopSttClient();
  if (sttProcess && !sttProcess.killed) {
    sttProcess.kill();
  }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});
