const fs = require('fs/promises');
const path = require('path');
const { app, shell } = require('electron');
const { spawn } = require('child_process');
const geminiClient = require('./geminiClient');
const {
  ACTION_TYPES,
  createStartCodingWorkflow,
  normalizeWorkflow,
  validateWorkflow
} = require('./commandSchema');

const defaultCommands = [
  createStartCodingWorkflow(),
  normalizeWorkflow({
    id: 'open-docs',
    name: 'Open Docs',
    trigger: 'open docs',
    summary: 'Open the Open-New-Jarvis repository in your browser.',
    confirm: false,
    actions: [
      {
        type: ACTION_TYPES.OPEN_URL,
        url: 'https://github.com/proamazegamegod-jpg/Open-New-Jarvis'
      }
    ]
  })
];

let commands = [];
let loadPromise;

const getWorkflowsFilePath = () => path.join(app.getPath('userData'), 'workflows.json');

const expandEnvironmentVariables = (value) =>
  String(value || '').replace(/%([^%]+)%/g, (_match, name) => process.env[name] || '');

const cloneForUi = (workflow) => ({
  ...workflow,
  actions: workflow.actions.map((action) => ({ ...action })),
  steps: [...workflow.steps]
});

const hydrateWorkflows = (items) =>
  items
    .map((item) => normalizeWorkflow(item))
    .filter((workflow) => validateWorkflow(workflow).valid);

const persistCommands = async () => {
  const filePath = getWorkflowsFilePath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(commands, null, 2), 'utf8');
};

const ensureCommandsLoaded = async () => {
  if (loadPromise) {
    await loadPromise;
    return;
  }

  loadPromise = (async () => {
    try {
      const raw = await fs.readFile(getWorkflowsFilePath(), 'utf8');
      const parsed = JSON.parse(raw);
      const hydrated = hydrateWorkflows(Array.isArray(parsed) ? parsed : []);
      commands = hydrated.length > 0 ? hydrated : defaultCommands.map(cloneForUi);
    } catch (_error) {
      commands = defaultCommands.map(cloneForUi);
      await persistCommands();
    }
  })();

  await loadPromise;
};

const toValidationResponse = (workflow) => {
  const normalizedWorkflow = normalizeWorkflow(workflow || {});
  const validation = validateWorkflow(normalizedWorkflow);

  if (!validation.valid) {
    return {
      ok: false,
      error: validation.issues[0]?.message || 'Workflow validation failed.',
      data: {
        valid: false,
        issues: validation.issues,
        command: normalizedWorkflow
      }
    };
  }

  return {
    ok: true,
    data: {
      valid: true,
      issues: [],
      command: normalizedWorkflow
    }
  };
};

const emitProgress = (onProgress, workflow, action, actionIndex, status, extras = {}) => {
  if (!onProgress) {
    return;
  }

  onProgress({
    workflowId: workflow.id,
    actionIndex,
    actionType: action.type,
    status,
    description: workflow.steps[actionIndex],
    ...extras
  });
};

const executeAction = async (action) => {
  switch (action.type) {
    case ACTION_TYPES.OPEN_APP: {
      const executablePath = expandEnvironmentVariables(action.executablePath);
      return new Promise((resolve, reject) => {
        const child = spawn(executablePath, action.args || [], {
          detached: true,
          stdio: 'ignore',
          windowsHide: false
        });
        child.once('error', reject);
        child.once('spawn', () => {
          child.unref();
          resolve({ message: `Opened application: ${executablePath}` });
        });
      });
    }

    case ACTION_TYPES.RUN_COMMAND:
      return new Promise((resolve, reject) => {
        const child = spawn('powershell', ['-NoExit', '-Command', action.command], {
          detached: true,
          stdio: 'ignore',
          windowsHide: false
        });
        child.once('error', reject);
        child.once('spawn', () => {
          child.unref();
          resolve({ message: `Started PowerShell command: ${action.command}` });
        });
      });

    case ACTION_TYPES.OPEN_URL:
      await shell.openExternal(action.url);
      return { message: `Opened URL: ${action.url}` };

    case ACTION_TYPES.WAIT:
      await new Promise((resolve) => {
        setTimeout(resolve, action.ms);
      });
      return { message: `Waited ${action.ms}ms` };

    default:
      throw new Error(`Unsupported action type: ${action.type}`);
  }
};

const getUniqueWorkflowId = (baseId) => {
  const normalizedBaseId = String(baseId || 'workflow')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase();

  let nextId = normalizedBaseId || 'workflow';
  let counter = 0;

  while (commands.some((command) => command.id === nextId)) {
    counter += 1;
    nextId = `${normalizedBaseId || 'workflow'}-${counter}`;
  }

  return nextId;
};

const MIN_WORKFLOW_MATCH_CONFIDENCE = 0.75;

const toWorkflowIntentOptions = () =>
  commands.map((workflow) => ({
    id: workflow.id,
    name: workflow.name || workflow.id,
    trigger: workflow.trigger || workflow.id
  }));

const synthesizeCommand = async (prompt) => {
  await ensureCommandsLoaded();

  const trimmedPrompt = String(prompt || '').trim();
  if (!trimmedPrompt) {
    return { ok: false, error: 'Workflow prompt is required.' };
  }

  const synthesisResponse = await geminiClient.synthesizeWorkflow(trimmedPrompt);
  if (!synthesisResponse?.ok) {
    return synthesisResponse;
  }

  const generatedCommand = normalizeWorkflow({
    ...synthesisResponse.data,
    id: getUniqueWorkflowId(
      synthesisResponse.data?.id ||
        synthesisResponse.data?.name ||
        synthesisResponse.data?.trigger ||
        trimmedPrompt
    ),
    name: synthesisResponse.data?.name || trimmedPrompt,
    trigger: synthesisResponse.data?.trigger || trimmedPrompt,
    summary: synthesisResponse.data?.summary || `Generated from: ${trimmedPrompt}`,
    confirm: true,
    actions: synthesisResponse.data?.actions
  });
  const validationResponse = toValidationResponse(generatedCommand);
  if (!validationResponse.ok) {
    return {
      ok: false,
      error: validationResponse.error || 'Gemini returned an invalid workflow.',
      data: validationResponse.data
    };
  }

  return {
    ok: true,
    data: cloneForUi(generatedCommand)
  };
};

const matchWorkflowIntent = async (utterance) => {
  await ensureCommandsLoaded();

  const trimmedUtterance = String(utterance || '').trim();
  if (!trimmedUtterance) {
    return { ok: false, error: 'Voice transcript is required.' };
  }

  const matchResponse = await geminiClient.matchWorkflowIntent(
    trimmedUtterance,
    toWorkflowIntentOptions()
  );
  if (!matchResponse?.ok) {
    return matchResponse;
  }

  const workflowId = matchResponse.data?.workflowId || null;
  const confidence = Number(matchResponse.data?.confidence || 0);
  const reason = matchResponse.data?.reason || '';

  if (!workflowId || confidence < MIN_WORKFLOW_MATCH_CONFIDENCE) {
    return {
      ok: true,
      data: {
        workflow: null,
        workflowId: null,
        confidence,
        reason
      }
    };
  }

  const workflow = commands.find((item) => item.id === workflowId);
  if (!workflow) {
    return {
      ok: true,
      data: {
        workflow: null,
        workflowId: null,
        confidence: 0,
        reason: 'Gemini returned a workflow that does not exist.'
      }
    };
  }

  return {
    ok: true,
    data: {
      workflow: cloneForUi(workflow),
      workflowId,
      confidence,
      reason
    }
  };
};

const validateCommand = async (command) => toValidationResponse(command);

const dryRunCommand = async (command) => {
  const validationResponse = toValidationResponse(command);
  if (!validationResponse.ok) {
    return validationResponse;
  }

  const workflow = validationResponse.data.command;
  return {
    ok: true,
    data: {
      result: 'Dry-run ready.',
      actionPlan: workflow.actions.map((action, actionIndex) => ({
        actionIndex,
        actionType: action.type,
        status: 'pending',
        description: workflow.steps[actionIndex]
      })),
      command: workflow
    }
  };
};

const executeCommand = async (command, options = {}) => {
  const validationResponse = toValidationResponse(command);
  if (!validationResponse.ok) {
    return validationResponse;
  }

  const workflow = validationResponse.data.command;
  const onProgress = options.onProgress;
  const actionResults = [];

  workflow.actions.forEach((action, actionIndex) => {
    emitProgress(onProgress, workflow, action, actionIndex, 'pending');
  });

  for (let actionIndex = 0; actionIndex < workflow.actions.length; actionIndex += 1) {
    const action = workflow.actions[actionIndex];
    emitProgress(onProgress, workflow, action, actionIndex, 'running');

    try {
      const result = await executeAction(action);
      actionResults.push({
        actionIndex,
        actionType: action.type,
        status: 'completed',
        ...result
      });
      emitProgress(onProgress, workflow, action, actionIndex, 'completed', result);
    } catch (error) {
      const failure = {
        actionIndex,
        actionType: action.type,
        status: 'failed',
        error: error.message
      };
      actionResults.push(failure);
      emitProgress(onProgress, workflow, action, actionIndex, 'failed', {
        error: error.message
      });
    }
  }

  const failedCount = actionResults.filter((result) => result.status === 'failed').length;

  return {
    ok: failedCount === 0,
    error: failedCount > 0 ? `${failedCount} action(s) failed.` : undefined,
    data: {
      result:
        failedCount > 0
          ? 'Workflow completed with failures.'
          : 'Workflow completed successfully.',
      command: workflow,
      actionResults
    }
  };
};

const listCommands = async () => {
  await ensureCommandsLoaded();

  return {
    ok: true,
    data: commands.map(cloneForUi)
  };
};

const saveCommand = async (command) => {
  await ensureCommandsLoaded();

  const validationResponse = toValidationResponse(command);
  if (!validationResponse.ok) {
    return validationResponse;
  }

  const workflow = validationResponse.data.command;
  const index = commands.findIndex((item) => item.id === workflow.id);

  if (index >= 0) {
    commands[index] = workflow;
  } else {
    commands.push(workflow);
  }

  await persistCommands();

  return {
    ok: true,
    data: cloneForUi(workflow)
  };
};

const deleteCommand = async (workflowId) => {
  await ensureCommandsLoaded();

  const index = commands.findIndex((item) => item.id === workflowId);
  if (index < 0) {
    return { ok: false, error: `Workflow "${workflowId}" was not found.` };
  }

  const [removedWorkflow] = commands.splice(index, 1);
  await persistCommands();

  return {
    ok: true,
    data: cloneForUi(removedWorkflow)
  };
};

const duplicateCommand = async (workflowId) => {
  await ensureCommandsLoaded();

  const workflow = commands.find((item) => item.id === workflowId);
  if (!workflow) {
    return { ok: false, error: `Workflow "${workflowId}" was not found.` };
  }

  const duplicateWorkflow = normalizeWorkflow({
    ...cloneForUi(workflow),
    id: getUniqueWorkflowId(`${workflow.id}-copy`),
    trigger: `${workflow.trigger} copy`
  });

  commands.push(duplicateWorkflow);
  await persistCommands();

  return {
    ok: true,
    data: cloneForUi(duplicateWorkflow)
  };
};

const importCommands = async (filePath) => {
  await ensureCommandsLoaded();

  const raw = await fs.readFile(filePath, 'utf8');
  const parsed = JSON.parse(raw);
  const sourceItems = Array.isArray(parsed) ? parsed : [parsed];
  const importedWorkflows = [];

  for (const sourceItem of sourceItems) {
    const validationResponse = toValidationResponse(sourceItem);
    if (!validationResponse.ok) {
      return validationResponse;
    }

    const workflow = validationResponse.data.command;
    const existingIndex = commands.findIndex((item) => item.id === workflow.id);
    if (existingIndex >= 0) {
      commands[existingIndex] = workflow;
    } else {
      commands.push(workflow);
    }
    importedWorkflows.push(cloneForUi(workflow));
  }

  await persistCommands();

  return {
    ok: true,
    data: importedWorkflows
  };
};

const exportCommand = async (workflowId, filePath) => {
  await ensureCommandsLoaded();

  const workflow = commands.find((item) => item.id === workflowId);
  if (!workflow) {
    return { ok: false, error: `Workflow "${workflowId}" was not found.` };
  }

  await fs.writeFile(filePath, JSON.stringify(workflow, null, 2), 'utf8');

  return {
    ok: true,
    data: cloneForUi(workflow)
  };
};

module.exports = {
  deleteCommand,
  dryRunCommand,
  duplicateCommand,
  executeCommand,
  exportCommand,
  importCommands,
  listCommands,
  matchWorkflowIntent,
  saveCommand,
  synthesizeCommand,
  validateCommand
};
