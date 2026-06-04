const path = require('path');
const { pathToFileURL } = require('url');
const { app, BrowserWindow } = require('electron');
const registerIpcHandlers = require('./ipc');
const { createSttClient } = require('../services/sttClient');

require('dotenv').config();

let mainWindow;
let sttClient;
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
    }
  });
};

app.whenReady().then(() => {
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

  if (process.platform !== 'darwin') {
    app.quit();
  }
});
