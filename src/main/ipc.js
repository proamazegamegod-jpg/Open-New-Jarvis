const path = require('path');
const { app, ipcMain, dialog, shell } = require('electron');
const geminiClient = require('../services/geminiClient');
const commandService = require('../services/commandService');

const toSafeExternalUrl = (value) => {
  try {
    const parsed = new URL(value);
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

  ipcMain.handle('matchWorkflowIntent', async (_event, utterance) => {
    return commandService.matchWorkflowIntent(utterance);
  });

  ipcMain.handle('validateCommand', async (_event, command) => {
    return commandService.validateCommand(command);
  });

  ipcMain.handle('dryRunCommand', async (_event, command) => {
    return commandService.dryRunCommand(command);
  });

  ipcMain.handle('executeCommand', async (_event, command) => {
    return commandService.executeCommand(command, {
      onProgress: (payload) => {
        _event.sender.send('workflow:progress', payload);
      }
    });
  });

  ipcMain.handle('listCommands', async () => {
    return commandService.listCommands();
  });

  ipcMain.handle('saveCommand', async (_event, command) => {
    return commandService.saveCommand(command);
  });

  ipcMain.handle('deleteCommand', async (_event, workflowId) => {
    return commandService.deleteCommand(workflowId);
  });

  ipcMain.handle('duplicateCommand', async (_event, workflowId) => {
    return commandService.duplicateCommand(workflowId);
  });

  ipcMain.handle('importCommands', async (event) => {
    const result = await dialog.showOpenDialog({
      title: 'Import workflows',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });

    if (result.canceled || !result.filePaths[0]) {
      return { ok: false, error: 'Import cancelled.' };
    }

    return commandService.importCommands(result.filePaths[0], {
      sender: event.sender
    });
  });

  ipcMain.handle('exportCommand', async (_event, workflowId) => {
    const result = await dialog.showSaveDialog({
      title: 'Export workflow',
      defaultPath: path.join(app.getPath('documents'), `${workflowId || 'workflow'}.json`),
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });

    if (result.canceled || !result.filePath) {
      return { ok: false, error: 'Export cancelled.' };
    }

    return commandService.exportCommand(workflowId, result.filePath);
  });

  ipcMain.handle('openExternalUrl', async (_event, url) => {
    const safeUrl = toSafeExternalUrl(url);
    if (!safeUrl) {
      return {
        ok: false,
        error: 'Blocked unsafe URL.'
      };
    }

    try {
      await shell.openExternal(safeUrl);
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error?.message || 'Failed to open URL.'
      };
    }
  });
};

module.exports = registerIpcHandlers;
