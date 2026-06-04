const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  llmChat: (messages, options) => ipcRenderer.invoke('llmChat', messages, options),
  synthesizeCommand: (prompt) => ipcRenderer.invoke('synthesizeCommand', prompt),
  validateCommand: (command) => ipcRenderer.invoke('validateCommand', command),
  dryRunCommand: (command) => ipcRenderer.invoke('dryRunCommand', command),
  executeCommand: (command) => ipcRenderer.invoke('executeCommand', command),
  listCommands: () => ipcRenderer.invoke('listCommands'),
  saveCommand: (command) => ipcRenderer.invoke('saveCommand', command),
  onSttPartial: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('stt:partial', listener);
    return () => ipcRenderer.removeListener('stt:partial', listener);
  },
  onSttFinal: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('stt:final', listener);
    return () => ipcRenderer.removeListener('stt:final', listener);
  }
});
