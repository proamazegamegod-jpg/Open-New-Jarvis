const releaseUrl = 'https://github.com/proamazegamegod-jpg/Open-New-Jarvis/releases';
const repositoryUrl = 'https://github.com/proamazegamegod-jpg/Open-New-Jarvis';

export const demoTranscript =
  'Wake word detected. Reviewing the request, validating the command recipe, and preparing a safe dry-run.';

export const assistantGreeting =
  'Open-New-Jarvis turns speech into a reviewable command recipe, shows the live transcript, and keeps execution gated until you approve it.';

export const demoMessages = [
  {
    id: 'assistant-demo-1',
    role: 'assistant',
    content: assistantGreeting
  }
];

export const demoCommands = [
  {
    id: 'triage-standup',
    trigger: 'summarize updates',
    steps: ['collect latest notes', 'group by priority', 'draft concise standup summary'],
    preconditions: ['Confirm the latest updates are available', 'Select the standup audience'],
    rollback: ['Discard the generated summary draft', 'Re-run with a narrower date range if needed'],
    summary: 'Summarize updates, group by priority, and draft a concise standup.',
    confirm: false
  },
  {
    id: 'prepare-release-note',
    trigger: 'draft release notes',
    steps: ['scan recent changes', 'extract user-facing updates', 'assemble release-ready markdown'],
    preconditions: ['Point to the correct release range', 'Review user-facing changes before publishing'],
    rollback: ['Clear the generated markdown', 'Restore the previous release-note draft'],
    summary:
      'Scan recent changes, extract user-facing updates, and assemble release-ready markdown.',
    confirm: true
  },
  {
    id: 'open-docs',
    trigger: 'open docs',
    steps: ['open browser', 'navigate to docs'],
    preconditions: ['Choose the target documentation set', 'Confirm the destination page'],
    rollback: ['Close the opened tab', 'Return to the previous browsing context'],
    summary: 'Open documentation in your browser and navigate to the right page.',
    confirm: true
  }
];

const wait = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

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
  repositoryUrl,
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
  onSttPartial() {
    return () => {};
  }
};

const electronBridge = isElectronAvailable
  ? {
      ...window.electron,
      isDesktop: true,
      supportsCommandEditing: true,
      releaseUrl,
      repositoryUrl
    }
  : fallbackBridge;

export default electronBridge;
