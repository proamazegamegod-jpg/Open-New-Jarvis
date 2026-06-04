const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  llmChat: (messages, options) => ipcRenderer.invoke('llmChat', messages, options),
  getAppSettings: () => ipcRenderer.invoke('getAppSettings'),
  setGeminiApiKey: (value) => ipcRenderer.invoke('setGeminiApiKey', value),
  synthesizeCommand: (prompt) => ipcRenderer.invoke('synthesizeCommand', prompt),
  matchWorkflowIntent: (utterance) => ipcRenderer.invoke('matchWorkflowIntent', utterance),
  validateCommand: (command) => ipcRenderer.invoke('validateCommand', command),
  dryRunCommand: (command) => ipcRenderer.invoke('dryRunCommand', command),
  executeCommand: (command) => ipcRenderer.invoke('executeCommand', command),
  listCommands: () => ipcRenderer.invoke('listCommands'),
  saveCommand: (command) => ipcRenderer.invoke('saveCommand', command),
  deleteCommand: (workflowId) => ipcRenderer.invoke('deleteCommand', workflowId),
  duplicateCommand: (workflowId) => ipcRenderer.invoke('duplicateCommand', workflowId),
  importCommands: () => ipcRenderer.invoke('importCommands'),
  exportCommand: (workflowId) => ipcRenderer.invoke('exportCommand', workflowId),
  openExternalUrl: (url) => ipcRenderer.invoke('openExternalUrl', url),
  getSttState: () => ipcRenderer.invoke('getSttState'),
  setSttEnabled: (enabled) => ipcRenderer.invoke('setSttEnabled', enabled),
  clearSttContext: () => ipcRenderer.invoke('clearSttContext'),
  onWorkflowProgress: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('workflow:progress', listener);
    return () => ipcRenderer.removeListener('workflow:progress', listener);
  },
  onSttPartial: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('stt:partial', listener);
    return () => ipcRenderer.removeListener('stt:partial', listener);
  },
  onSttFinal: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('stt:final', listener);
    return () => ipcRenderer.removeListener('stt:final', listener);
  },
  onSttStatus: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('stt:status', listener);
    return () => ipcRenderer.removeListener('stt:status', listener);
  },
  onSttState: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('stt:state', listener);
    return () => ipcRenderer.removeListener('stt:state', listener);
  }
});
