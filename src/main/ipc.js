const { ipcMain, shell } = require('electron');
const geminiClient = require('../services/geminiClient');
const commandService = require('../services/commandService');

const toSafeExternalUrl = (value) => {
  try {
    const parsed = new URL(String(value || ''));
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.toString();
  } catch (_error) {
    return null;
  }
};

const registerIpcHandlers = () => {
  ipcMain.handle('llmChat', async (_event, messages, options) => {
    return geminiClient.chat(messages, options);
  });

  ipcMain.handle('synthesizeCommand', async (_event, prompt) => {
    return commandService.synthesizeCommand(prompt);
  });

  ipcMain.handle('validateCommand', async (_event, command) => {
    return commandService.validateCommand(command);
  });

  ipcMain.handle('dryRunCommand', async (_event, command) => {
    return commandService.dryRunCommand(command);
  });

  ipcMain.handle('executeCommand', async (_event, command) => {
    return commandService.executeCommand(command);
  });

  ipcMain.handle('listCommands', async () => {
    return commandService.listCommands();
  });

  ipcMain.handle('saveCommand', async (_event, command) => {
    return commandService.saveCommand(command);
  });

  ipcMain.handle('openExternalUrl', async (_event, url) => {
    const safeUrl = toSafeExternalUrl(url);
    if (!safeUrl) {
      return {
        ok: false,
        error: 'Blocked unsafe URL.'
      };
    }

    await shell.openExternal(safeUrl);
    return {
      ok: true
    };
  });
};

module.exports = registerIpcHandlers;
