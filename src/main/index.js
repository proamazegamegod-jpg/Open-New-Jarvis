const path = require('path');
const { pathToFileURL } = require('url');
const { app, BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const net = require('net');
const registerIpcHandlers = require('./ipc');
const { createSttClient } = require('../services/sttClient');

require('dotenv').config();

let mainWindow;
let sttClient;
let sttProcess;
let handlersRegistered = false;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
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

  sttClient = createSttClient({
    url: 'ws://localhost:9000',
    onPartial: (payload) => {
      if (!mainWindow || mainWindow.isDestroyed()) {
        return;
      }
      mainWindow.webContents.send('stt:partial', payload);
    },
    onFinal: (payload) => {
      if (!mainWindow || mainWindow.isDestroyed()) {
        return;
      }
      mainWindow.webContents.send('stt:final', payload);
    },
    onStatus: (payload) => {
      if (!mainWindow || mainWindow.isDestroyed()) {
        return;
      }
      mainWindow.webContents.send('stt:status', payload);
    }
  });
};

const isPortOpen = (port) =>
  new Promise((resolve) => {
    const socket = new net.Socket();
    const cleanup = (result) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(800);
    socket.once('connect', () => cleanup(true));
    socket.once('error', () => cleanup(false));
    socket.once('timeout', () => cleanup(false));
    socket.connect(port, '127.0.0.1');
  });

const ensureSttServer = async () => {
  const isRunning = await isPortOpen(9000);
  if (isRunning) {
    return;
  }

  const repoRoot = path.resolve(__dirname, '..', '..');
  const scriptPath = path.join(repoRoot, 'scripts', 'stt-runner.ps1');
  sttProcess = spawn(
    'powershell',
    ['-ExecutionPolicy', 'Bypass', '-File', scriptPath],
    {
      cwd: repoRoot,
      stdio: 'ignore',
      windowsHide: true
    }
  );
};

app.whenReady().then(async () => {
  await ensureSttServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (sttClient) {
    sttClient.stop();
  }
  if (sttProcess && !sttProcess.killed) {
    sttProcess.kill();
  }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});
