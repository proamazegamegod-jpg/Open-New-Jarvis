const { URL } = require('url');

const ACTION_TYPES = Object.freeze({
  OPEN_APP: 'open_app',
  RUN_COMMAND: 'run_command',
  OPEN_URL: 'open_url',
  WAIT: 'wait'
});

const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

const addIssue = (issues, path, message) => {
  issues.push({ path, message });
};

const validateAction = (action, index) => {
  const issues = [];
  const path = `actions[${index}]`;

  if (!action || typeof action !== 'object' || Array.isArray(action)) {
    addIssue(issues, path, 'Action must be an object.');
    return issues;
  }

  if (!isNonEmptyString(action.type)) {
    addIssue(issues, `${path}.type`, 'Action type is required.');
    return issues;
  }

  if (!Object.values(ACTION_TYPES).includes(action.type)) {
    addIssue(
      issues,
      `${path}.type`,
      `Unsupported action type "${action.type}". Supported types: ${Object.values(ACTION_TYPES).join(', ')}.`
    );
    return issues;
  }

  switch (action.type) {
    case ACTION_TYPES.OPEN_APP:
      if (!isNonEmptyString(action.executablePath)) {
        addIssue(
          issues,
          `${path}.executablePath`,
          'open_app requires a non-empty executablePath.'
        );
      }
      if (action.args !== undefined) {
        if (!Array.isArray(action.args) || action.args.some((arg) => !isNonEmptyString(arg))) {
          addIssue(
            issues,
            `${path}.args`,
            'open_app args must be an array of non-empty strings when provided.'
          );
        }
      }
      break;

    case ACTION_TYPES.RUN_COMMAND:
      if (!isNonEmptyString(action.command)) {
        addIssue(issues, `${path}.command`, 'run_command requires a non-empty command.');
      }
      break;

    case ACTION_TYPES.OPEN_URL:
      if (!isNonEmptyString(action.url)) {
        addIssue(issues, `${path}.url`, 'open_url requires a non-empty url.');
        break;
      }
      try {
        const parsedUrl = new URL(action.url);
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
          addIssue(
            issues,
            `${path}.url`,
            'open_url only supports http and https URLs.'
          );
        }
      } catch (_error) {
        addIssue(issues, `${path}.url`, 'open_url requires a valid absolute URL.');
      }
      break;

    case ACTION_TYPES.WAIT:
      if (!Number.isInteger(action.ms) || action.ms < 0) {
        addIssue(issues, `${path}.ms`, 'wait requires a non-negative integer ms value.');
      }
      break;

    default:
      break;
  }

  return issues;
};

const validateWorkflow = (workflow) => {
  const issues = [];

  if (!workflow || typeof workflow !== 'object' || Array.isArray(workflow)) {
    addIssue(issues, 'workflow', 'Workflow must be an object.');
    return { valid: false, issues };
  }

  if (!isNonEmptyString(workflow.id)) {
    addIssue(issues, 'id', 'Workflow id is required.');
  }

  if (workflow.name !== undefined && !isNonEmptyString(workflow.name)) {
    addIssue(issues, 'name', 'Workflow name must be a non-empty string when provided.');
  }

  if (!isNonEmptyString(workflow.trigger)) {
    addIssue(issues, 'trigger', 'Workflow trigger is required.');
  }

  if (workflow.confirm !== undefined && typeof workflow.confirm !== 'boolean') {
    addIssue(issues, 'confirm', 'Workflow confirm must be a boolean when provided.');
  }

  if (!Array.isArray(workflow.actions) || workflow.actions.length === 0) {
    addIssue(
      issues,
      'actions',
      'Workflow actions are required. Add at least one action.'
    );
  } else {
    workflow.actions.forEach((action, index) => {
      issues.push(...validateAction(action, index));
    });
  }

  return {
    valid: issues.length === 0,
    issues
  };
};

const describeAction = (action) => {
  switch (action.type) {
    case ACTION_TYPES.OPEN_APP:
      return `Open app: ${action.executablePath}`;
    case ACTION_TYPES.RUN_COMMAND:
      return `Run command: ${action.command}`;
    case ACTION_TYPES.OPEN_URL:
      return `Open URL: ${action.url}`;
    case ACTION_TYPES.WAIT:
      return `Wait ${action.ms}ms`;
    default:
      return `Action: ${action.type}`;
  }
};

const normalizeWorkflow = (workflow) => {
  const actions = Array.isArray(workflow.actions)
    ? workflow.actions.map((action) => {
        if (!action || typeof action !== 'object') {
          return action;
        }

        const normalizedAction = { ...action, type: String(action.type || '').trim() };
        if (normalizedAction.type === ACTION_TYPES.OPEN_APP) {
          normalizedAction.executablePath = String(normalizedAction.executablePath || '').trim();
          normalizedAction.args = Array.isArray(normalizedAction.args)
            ? normalizedAction.args.map((arg) => String(arg).trim()).filter(Boolean)
            : [];
        }
        if (normalizedAction.type === ACTION_TYPES.RUN_COMMAND) {
          normalizedAction.command = String(normalizedAction.command || '').trim();
        }
        if (normalizedAction.type === ACTION_TYPES.OPEN_URL) {
          normalizedAction.url = String(normalizedAction.url || '').trim();
        }
        if (normalizedAction.type === ACTION_TYPES.WAIT) {
          normalizedAction.ms = Number(normalizedAction.ms);
        }
        return normalizedAction;
      })
    : [];

  return {
    id: String(workflow.id || '').trim(),
    name: String(workflow.name || workflow.id || workflow.trigger || '').trim(),
    trigger: String(workflow.trigger || '').trim(),
    summary: String(workflow.summary || '').trim(),
    confirm: workflow.confirm === true,
    actions,
    steps: actions.map(describeAction)
  };
};

const createStartCodingWorkflow = () =>
  normalizeWorkflow({
    id: 'start-coding',
    name: 'Coding Setup',
    trigger: 'start coding',
    summary: 'Open VS Code, a PowerShell terminal, and a couple of coding tabs.',
    confirm: false,
    actions: [
      {
        type: ACTION_TYPES.OPEN_APP,
        executablePath: '%LOCALAPPDATA%\\Programs\\Microsoft VS Code\\Code.exe'
      },
      {
        type: ACTION_TYPES.WAIT,
        ms: 1500
      },
      {
        type: ACTION_TYPES.RUN_COMMAND,
        command: 'Set-Location $HOME'
      },
      {
        type: ACTION_TYPES.OPEN_URL,
        url: 'https://github.com/'
      },
      {
        type: ACTION_TYPES.OPEN_URL,
        url: 'https://stackoverflow.com/'
      }
    ]
  });

module.exports = {
  ACTION_TYPES,
  createStartCodingWorkflow,
  describeAction,
  normalizeWorkflow,
  validateAction,
  validateWorkflow
};
