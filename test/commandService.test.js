const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const Module = require('module');

const repoRoot = path.resolve(__dirname, '..');
const commandServicePath = path.join(repoRoot, 'src', 'services', 'commandService.js');
const commandSchemaPath = path.join(repoRoot, 'src', 'services', 'commandSchema.js');

const clearModule = (modulePath) => {
  delete require.cache[modulePath];
};

const loadCommandService = ({ geminiResponse, userDataDir }) => {
  const originalLoad = Module._load;

  Module._load = function mockLoad(request, parent, isMain) {
    if (request === 'electron') {
      return {
        app: {
          getPath: () => userDataDir
        },
        shell: {
          openExternal: async () => {}
        }
      };
    }

    if (request === './geminiClient') {
      return {
        synthesizeWorkflow: async () => geminiResponse
      };
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  clearModule(commandServicePath);
  clearModule(commandSchemaPath);

  try {
    return require(commandServicePath);
  } finally {
    Module._load = originalLoad;
  }
};

test('synthesizeCommand normalizes Gemini workflows and avoids duplicate ids', async () => {
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'onj-command-service-'));
  const commandService = loadCommandService({
    userDataDir,
    geminiResponse: {
      ok: true,
      data: {
        id: 'start-coding',
        name: 'Generated Coding Setup',
        trigger: 'start coding',
        summary: 'Open GitHub and wait briefly.',
        confirm: false,
        actions: [
          {
            type: 'open_url',
            url: 'https://github.com/'
          },
          {
            type: 'wait',
            ms: 500
          }
        ]
      }
    }
  });

  try {
    const result = await commandService.synthesizeCommand('Open GitHub and wait.');

    assert.equal(result.ok, true);
    assert.equal(result.data.id, 'start-coding-1');
    assert.equal(result.data.name, 'Generated Coding Setup');
    assert.equal(result.data.trigger, 'start coding');
    assert.equal(result.data.confirm, true);
    assert.deepEqual(result.data.steps, ['Open URL: https://github.com/', 'Wait 500ms']);
  } finally {
    await fs.rm(userDataDir, { recursive: true, force: true });
  }
});

test('synthesizeCommand rejects invalid Gemini workflows with validation details', async () => {
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'onj-command-service-'));
  const commandService = loadCommandService({
    userDataDir,
    geminiResponse: {
      ok: true,
      data: {
        id: 'unsafe-workflow',
        name: 'Unsafe Workflow',
        trigger: 'unsafe workflow',
        summary: 'Should fail validation.',
        actions: [
          {
            type: 'delete_everything'
          }
        ]
      }
    }
  });

  try {
    const result = await commandService.synthesizeCommand('Delete everything.');

    assert.equal(result.ok, false);
    assert.match(result.error, /Unsupported action type/);
    assert.equal(result.data.issues[0].path, 'actions[0].type');
  } finally {
    await fs.rm(userDataDir, { recursive: true, force: true });
  }
});
