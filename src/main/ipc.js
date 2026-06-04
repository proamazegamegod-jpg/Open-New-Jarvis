const { spawn } = require('child_process');
const { ipcMain, shell } = require('electron');
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

const spawnDetached = (command, args = [], options = {}) =>
  new Promise((resolve) => {
    try {
      const child = spawn(command, args, {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
        ...options
      });

      let settled = false;
      const finish = (result) => {
        if (settled) {
          return;
        }
        settled = true;
        resolve(result);
      };

      child.once('error', (error) => {
        finish({
          ok: false,
          error: error?.message || `Failed to launch ${command}.`
        });
      });

      child.once('spawn', () => {
        child.unref();
        finish({ ok: true });
      });
    } catch (error) {
      resolve({
        ok: false,
        error: error?.message || `Failed to launch ${command}.`
      });
    }
  });

const workspaceToolAttempts = {
  vscode: {
    win32: [
      { command: 'code', args: [] },
      { command: 'cmd', args: ['/c', 'start', '', 'code'] }
    ],
    darwin: [{ command: 'open', args: ['-a', 'Visual Studio Code'] }],
    linux: [{ command: 'code', args: [] }]
  },
  terminal: {
    win32: [
      { command: 'wt', args: [] },
      { command: 'cmd', args: ['/c', 'start', '', 'wt'] },
      { command: 'cmd', args: ['/c', 'start', '', 'cmd.exe'] }
    ],
    darwin: [{ command: 'open', args: ['-a', 'Terminal'] }],
    linux: [
      { command: 'x-terminal-emulator', args: [] },
      { command: 'gnome-terminal', args: [] },
      { command: 'konsole', args: [] },
      { command: 'xterm', args: [] }
    ]
  }
};

const codingWebResources = [
  { id: 'github', label: 'GitHub', url: 'https://github.com' },
  { id: 'stackoverflow', label: 'Stack Overflow', url: 'https://stackoverflow.com' },
  { id: 'claude', label: 'Claude', url: 'https://claude.ai' }
];

const launchWorkspaceTool = async (toolId) => {
  const normalizedToolId = String(toolId || '')
    .trim()
    .toLowerCase();
  const attemptsByPlatform = workspaceToolAttempts[normalizedToolId];
  const attempts = attemptsByPlatform?.[process.platform];

  if (!attemptsByPlatform) {
    return {
      ok: false,
      error: `Unsupported workspace tool "${normalizedToolId || 'unknown'}".`
    };
  }

  if (!attempts || attempts.length === 0) {
    return {
      ok: false,
      error: `Tool "${normalizedToolId}" is not supported on ${process.platform}.`
    };
  }

  const errors = [];
  for (const attempt of attempts) {
    const result = await spawnDetached(attempt.command, attempt.args, attempt.options);
    if (result.ok) {
      return {
        ok: true,
        data: {
          toolId: normalizedToolId,
          platform: process.platform
        }
      };
    }
    errors.push(result.error);
  }

  return {
    ok: false,
    error: errors.filter(Boolean).join(' | ') || `Failed to launch ${normalizedToolId}.`
  };
};

const runCodingWorkspaceRoutine = async () => {
  const opened = [];
  const failed = [];

  const pushOpened = (label) => {
    opened.push(label);
  };

  const pushFailed = (label, error) => {
    failed.push({
      label,
      error: error || 'Failed to complete operation.'
    });
  };

  const vscodeLaunch = await launchWorkspaceTool('vscode');
  if (vscodeLaunch?.ok) {
    pushOpened('VS Code');
  } else {
    const fallbackUrl = 'https://github.dev';
    const safeFallbackUrl = toSafeExternalUrl(fallbackUrl);
    if (!safeFallbackUrl) {
      pushFailed('VS Code Web', 'Fallback URL was blocked or invalid.');
    } else {
      try {
        await shell.openExternal(safeFallbackUrl);
        pushOpened('VS Code Web');
      } catch (error) {
        pushFailed('VS Code Web', error?.message || 'Failed to open VS Code web fallback.');
      }
    }
  }

  const terminalLaunch = await launchWorkspaceTool('terminal');
  if (terminalLaunch?.ok) {
    pushOpened('Terminal');
  } else {
    pushFailed('Terminal', terminalLaunch?.error || 'Terminal launch failed.');
  }

  for (const resource of codingWebResources) {
    const safeUrl = toSafeExternalUrl(resource.url);
    if (!safeUrl) {
      pushFailed(resource.label, 'Blocked unsafe URL.');
      continue;
    }

    try {
      await shell.openExternal(safeUrl);
      pushOpened(resource.label);
    } catch (error) {
      pushFailed(resource.label, error?.message || 'Failed to open URL.');
    }
  }

  const summary =
    opened.length > 0
      ? `Opened: ${opened.join(', ')}`
      : 'No workspace resources were opened.';

  return {
    ok: failed.length === 0,
    data: {
      opened,
      failed,
      summary
    },
    error: failed.length > 0 ? failed.map((item) => `${item.label}: ${item.error}`).join(' | ') : undefined
  };
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

    try {
      await shell.openExternal(safeUrl);
      return {
        ok: true
      };
    } catch (error) {
      return {
        ok: false,
        error: error?.message || 'Failed to open URL.'
      };
    }
  });

  ipcMain.handle('launchWorkspaceTool', async (_event, toolId) => {
    return launchWorkspaceTool(toolId);
  });

  ipcMain.handle('runCodingWorkspaceRoutine', async () => {
    return runCodingWorkspaceRoutine();
  });
};

module.exports = registerIpcHandlers;
