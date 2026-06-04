const { ipcMain } = require('electron');
const geminiClient = require('../services/geminiClient');
const commandService = require('../services/commandService');

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
};

module.exports = registerIpcHandlers;
