const releaseUrl =
  'https://github.com/proamazegamegod-jpg/Open-New-Jarvis/releases/download/V1/Open-New-Jarvis%20Setup%201.0.0.exe';
const releasePageUrl = 'https://github.com/proamazegamegod-jpg/Open-New-Jarvis/releases/tag/V1';
const repositoryUrl = 'https://github.com/proamazegamegod-jpg/Open-New-Jarvis';

export const demoTranscript =
  'Wake word detected. Reviewing the request, validating the command recipe, and preparing a safe dry-run.';

export const demoCommands = [
  {
    id: 'start-coding',
    name: 'Coding Setup',
    trigger: 'start coding',
    summary: 'Open VS Code, a terminal, and coding tabs.',
    confirm: false,
    actions: [
      {
        type: 'open_app',
        executablePath: '%LOCALAPPDATA%\\Programs\\Microsoft VS Code\\Code.exe'
      },
      {
        type: 'wait',
        ms: 1500
      },
      {
        type: 'run_command',
        command: 'Set-Location $HOME'
      },
      {
        type: 'open_url',
        url: 'https://github.com/'
      },
      {
        type: 'open_url',
        url: 'https://stackoverflow.com/'
      }
    ],
    steps: [
      'Open app: %LOCALAPPDATA%\\Programs\\Microsoft VS Code\\Code.exe',
      'Wait 1500ms',
      'Run command: Set-Location $HOME',
      'Open URL: https://github.com/',
      'Open URL: https://stackoverflow.com/'
    ]
  },
  {
    id: 'open-docs',
    name: 'Open Docs',
    trigger: 'open docs',
    summary: 'Open documentation in your browser and navigate to the right page.',
    confirm: false,
    actions: [
      {
        type: 'open_url',
        url: 'https://github.com/proamazegamegod-jpg/Open-New-Jarvis'
      }
    ],
    steps: ['Open URL: https://github.com/proamazegamegod-jpg/Open-New-Jarvis']
  }
];

const wait = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const toSafeBrowserUrl = (value) => {
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

const browserReply = (messageText) => {
  const normalized = String(messageText || '').trim().toLowerCase();

  if (!normalized) {
    return 'Ask about workflows, commands, or voice control and the preview will answer briefly.';
  }

  if (normalized.includes('deploy') || normalized.includes('vercel')) {
    return 'Use a clear download CTA, a short promise, and a polished preview that points to the desktop app.';
  }

  if (normalized.includes('command') || normalized.includes('automation')) {
    return 'Command recipes should show trigger, steps, and confirmation gates before execution.';
  }

  if (normalized.includes('voice') || normalized.includes('transcript')) {
    return 'Voice workflows work best when the transcript is live, visible, and separate from the answer.';
  }

  return `Preview: Open-New-Jarvis would turn "${messageText}" into a short command plan or next step.`;
};

const isElectronAvailable =
  typeof window !== 'undefined' && typeof window.electron === 'object' && window.electron !== null;

const fallbackBridge = {
  isDesktop: false,
  supportsCommandEditing: false,
  releaseUrl,
  releasePageUrl,
  repositoryUrl,
  async getAppSettings() {
    return {
      ok: true,
      data: {
        geminiApiKey: ''
      }
    };
  },
  async setGeminiApiKey() {
    return {
      ok: false,
      error: 'Gemini key settings are available in the desktop app.'
    };
  },
  async llmChat(messages) {
    const latestMessage = messages[messages.length - 1];
    await wait(300);

    return {
      ok: true,
      data: {
        content: browserReply(latestMessage?.content)
      }
    };
  },
  async validateCommand() {
    return {
      ok: false,
      error: 'Command validation is available in the desktop app.'
    };
  },
  async synthesizeCommand() {
    return {
      ok: false,
      error: 'AI workflow creation is available in the desktop app.'
    };
  },
  async matchWorkflowIntent() {
    return {
      ok: true,
      data: {
        workflow: null,
        workflowId: null,
        confidence: 0,
        reason: 'Voice intent matching is available in the desktop app.'
      }
    };
  },
  async dryRunCommand() {
    return {
      ok: false,
      error: 'Dry-runs are available in the desktop app.'
    };
  },
  async executeCommand() {
    return {
      ok: false,
      error: 'Command execution is available in the desktop app.'
    };
  },
  async listCommands() {
    return {
      ok: true,
      data: demoCommands
    };
  },
  async saveCommand() {
    return {
      ok: false,
      error: 'Saving commands is available in the desktop app.'
    };
  },
  async deleteCommand() {
    return {
      ok: false,
      error: 'Deleting commands is available in the desktop app.'
    };
  },
  async duplicateCommand() {
    return {
      ok: false,
      error: 'Duplicating commands is available in the desktop app.'
    };
  },
  async importCommands() {
    return {
      ok: false,
      error: 'Importing commands is available in the desktop app.'
    };
  },
  async exportCommand() {
    return {
      ok: false,
      error: 'Exporting commands is available in the desktop app.'
    };
  },
  async openExternalUrl(url) {
    const safeUrl = toSafeBrowserUrl(url);
    if (!safeUrl) {
      return {
        ok: false,
        error: 'Blocked unsafe URL.'
      };
    }

    if (typeof window !== 'undefined' && typeof window.open === 'function') {
      window.open(safeUrl, '_blank', 'noopener,noreferrer');
      return { ok: true };
    }

    return {
      ok: false,
      error: 'Opening URLs is unavailable.'
    };
  },
  async getSttState() {
    return {
      ok: true,
      data: {
        enabled: false,
        status: 'Preview',
        connection: 'Preview'
      }
    };
  },
  async setSttEnabled() {
    return {
      ok: false,
      error: 'Voice control is available in the desktop app.'
    };
  },
  async clearSttContext() {
    return {
      ok: true,
      data: {
        enabled: false,
        status: 'Preview',
        connection: 'Preview',
        transcript: '',
        message: ''
      }
    };
  },
  onWorkflowProgress() {
    return () => {};
  },
  onSttPartial() {
    return () => {};
  },
  onSttFinal() {
    return () => {};
  },
  onSttStatus() {
    return () => {};
  },
  onSttState() {
    return () => {};
  }
};

const electronBridge = isElectronAvailable
  ? {
      ...window.electron,
      isDesktop: true,
      supportsCommandEditing: true,
      releaseUrl,
      releasePageUrl,
      repositoryUrl
    }
  : fallbackBridge;

export default electronBridge;
