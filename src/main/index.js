const { app, BrowserWindow } = require('electron');
const path = require('path');
const registerIpcHandlers = require('./ipc');
const { createSttClient } = require('../services/sttClient');

require('dotenv').config();

let mainWindow;
let sttClient;

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

  registerIpcHandlers();

  const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  sttClient = createSttClient({
    url: 'ws://localhost:9000',
    onPartial: (payload) => {
      if (!mainWindow || mainWindow.isDestroyed()) {
        return;
      }
      mainWindow.webContents.send('stt:partial', payload);
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
