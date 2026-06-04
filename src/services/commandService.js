const commands = [
  {
    id: 'open-docs',
    trigger: 'open docs',
    steps: ['open browser', 'navigate to docs'],
    confirm: true
  }
];

const synthesizeCommand = async (prompt) => {
  // TODO: Replace with LLM-backed synthesis.
  return {
    ok: true,
    data: {
      id: 'generated-command',
      trigger: String(prompt || ''),
      steps: ['TODO: generated step 1', 'TODO: generated step 2'],
      confirm: true
    }
  };
};

const validateCommand = async (command) => {
  // TODO: Replace with schema validation + LLM safety checks.
  return {
    ok: true,
    data: {
      valid: true,
      issues: [],
      command
    }
  };
};

const dryRunCommand = async (command) => {
  // TODO: Replace with real dry-run logic.
  return {
    ok: true,
    data: {
      result: 'Dry-run not implemented yet.',
      command
    }
  };
};

const executeCommand = async (command) => {
  // TODO: Replace with real execution logic.
  return {
    ok: true,
    data: {
      result: 'Execution not implemented yet.',
      command
    }
  };
};

const listCommands = async () => {
  return {
    ok: true,
    data: commands
  };
};

const saveCommand = async (command) => {
  if (!command || !command.id) {
    return {
      ok: false,
      error: 'Command must include an id.'
    };
  }

  const index = commands.findIndex((item) => item.id === command.id);
  if (index >= 0) {
    commands[index] = command;
  } else {
    commands.push(command);
  }

  return {
    ok: true,
    data: command
  };
};

module.exports = {
  synthesizeCommand,
  validateCommand,
  dryRunCommand,
  executeCommand,
  listCommands,
  saveCommand
};
