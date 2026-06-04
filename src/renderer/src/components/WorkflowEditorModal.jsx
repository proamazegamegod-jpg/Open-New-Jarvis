import React, { useEffect, useMemo, useState } from 'react';

const ACTION_OPTIONS = [
  { value: 'open_app', label: 'Open app' },
  { value: 'run_command', label: 'Run command' },
  { value: 'open_url', label: 'Open link' },
  { value: 'wait', label: 'Wait' }
];

const createDraftAction = (type = 'open_app') => ({
  id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  type,
  executablePath: '',
  argsText: '',
  command: '',
  url: '',
  ms: '1000'
});

const actionToDraft = (action, index) => ({
  id: `${action.type || 'step'}-${index}`,
  type: action.type || 'open_app',
  executablePath: action.executablePath || '',
  argsText: Array.isArray(action.args) ? action.args.join(', ') : '',
  command: action.command || '',
  url: action.url || '',
  ms: action.ms === undefined ? '1000' : String(action.ms)
});

const workflowToDraft = (workflow) => {
  if (!workflow) {
    return {
      id: '',
      name: '',
      trigger: '',
      summary: '',
      confirm: false,
      actions: [createDraftAction()]
    };
  }

  return {
    id: workflow.id || '',
    name: workflow.name || workflow.id || '',
    trigger: workflow.trigger || '',
    summary: workflow.summary || '',
    confirm: Boolean(workflow.confirm),
    actions: Array.isArray(workflow.actions) && workflow.actions.length > 0
      ? workflow.actions.map(actionToDraft)
      : [createDraftAction()]
  };
};

const slugify = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const createUniqueWorkflowId = (baseValue, existingWorkflows, currentId) => {
  const baseId = slugify(baseValue) || 'workflow';
  const takenIds = new Set(
    existingWorkflows.filter((workflow) => workflow.id !== currentId).map((workflow) => workflow.id)
  );

  if (!takenIds.has(baseId)) {
    return baseId;
  }

  let suffix = 2;
  let nextId = `${baseId}-${suffix}`;
  while (takenIds.has(nextId)) {
    suffix += 1;
    nextId = `${baseId}-${suffix}`;
  }

  return nextId;
};

const buildActionPayload = (action) => {
  if (action.type === 'open_app') {
    return {
      type: action.type,
      executablePath: action.executablePath.trim(),
      args: action.argsText
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    };
  }

  if (action.type === 'run_command') {
    return {
      type: action.type,
      command: action.command.trim()
    };
  }

  if (action.type === 'open_url') {
    return {
      type: action.type,
      url: action.url.trim()
    };
  }

  return {
    type: action.type,
    ms: Number(action.ms)
  };
};

const WorkflowEditorModal = ({
  isOpen,
  workflow,
  existingWorkflows,
  errorMessage,
  onClose,
  onSave
}) => {
  const [draft, setDraft] = useState(workflowToDraft(workflow));

  useEffect(() => {
    if (isOpen) {
      setDraft(workflowToDraft(workflow));
    }
  }, [isOpen, workflow]);

  const modalTitle = useMemo(
    () => (workflow ? `Edit ${workflow.name || workflow.id}` : 'Create workflow'),
    [workflow]
  );

  if (!isOpen) {
    return null;
  }

  const saveWorkflow = async () => {
    const baseValue = draft.name || draft.trigger;
    const payload = {
      id: draft.id || createUniqueWorkflowId(baseValue, existingWorkflows, workflow?.id),
      name: draft.name.trim(),
      trigger: draft.trigger.trim(),
      summary: draft.summary.trim(),
      confirm: draft.confirm,
      actions: draft.actions.map(buildActionPayload)
    };

    await onSave(payload);
  };

  return (
    <div className="workflow-modal-backdrop" role="presentation">
      <div className="workflow-modal" role="dialog" aria-modal="true" aria-labelledby="workflow-modal-title">
        <div className="workflow-modal__header">
          <div>
            <p className="workflow-kicker">Workflow editor</p>
            <h2 id="workflow-modal-title">{modalTitle}</h2>
          </div>
          <button className="workflow-button workflow-button--secondary" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="workflow-form">
          <label>
            Name
            <input
              value={draft.name}
              onChange={(event) => setDraft((previous) => ({ ...previous, name: event.target.value }))}
              placeholder="Coding Setup"
            />
          </label>

          <label>
            Trigger
            <input
              value={draft.trigger}
              onChange={(event) => setDraft((previous) => ({ ...previous, trigger: event.target.value }))}
              placeholder="start coding"
            />
          </label>

          <label>
            Description
            <textarea
              value={draft.summary}
              onChange={(event) => setDraft((previous) => ({ ...previous, summary: event.target.value }))}
              rows={3}
              placeholder="Open VS Code, a terminal, and your coding tabs."
            />
          </label>

          <div className="workflow-steps-editor">
            <div className="workflow-steps-editor__header">
              <div>
                <p className="workflow-kicker">Steps</p>
                <h3>What should this workflow do?</h3>
              </div>
              <button
                className="workflow-button workflow-button--secondary"
                onClick={() =>
                  setDraft((previous) => ({
                    ...previous,
                    actions: [...previous.actions, createDraftAction()]
                  }))
                }
              >
                Add step
              </button>
            </div>

            <div className="workflow-step-list">
              {draft.actions.map((action, index) => (
                <div key={action.id} className="workflow-step-card">
                  <div className="workflow-step-card__header">
                    <span>Step {index + 1}</span>
                    <button
                      className="workflow-button workflow-button--ghost"
                      onClick={() =>
                        setDraft((previous) => ({
                          ...previous,
                          actions:
                            previous.actions.length === 1
                              ? [createDraftAction()]
                              : previous.actions.filter((item) => item.id !== action.id)
                        }))
                      }
                    >
                      Remove
                    </button>
                  </div>

                  <label>
                    Step type
                    <select
                      value={action.type}
                      onChange={(event) =>
                        setDraft((previous) => ({
                          ...previous,
                          actions: previous.actions.map((item) =>
                            item.id === action.id ? createDraftAction(event.target.value) : item
                          )
                        }))
                      }
                    >
                      {ACTION_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  {action.type === 'open_app' && (
                    <>
                      <label>
                        App path
                        <input
                          value={action.executablePath}
                          onChange={(event) =>
                            setDraft((previous) => ({
                              ...previous,
                              actions: previous.actions.map((item) =>
                                item.id === action.id
                                  ? { ...item, executablePath: event.target.value }
                                  : item
                              )
                            }))
                          }
                          placeholder="%LOCALAPPDATA%\\Programs\\Microsoft VS Code\\Code.exe"
                        />
                      </label>
                      <label>
                        Arguments (optional)
                        <input
                          value={action.argsText}
                          onChange={(event) =>
                            setDraft((previous) => ({
                              ...previous,
                              actions: previous.actions.map((item) =>
                                item.id === action.id ? { ...item, argsText: event.target.value } : item
                              )
                            }))
                          }
                          placeholder="--new-window, C:\\Users\\asus\\Desktop"
                        />
                      </label>
                    </>
                  )}

                  {action.type === 'run_command' && (
                    <label>
                      Command
                      <textarea
                        value={action.command}
                        onChange={(event) =>
                          setDraft((previous) => ({
                            ...previous,
                            actions: previous.actions.map((item) =>
                              item.id === action.id ? { ...item, command: event.target.value } : item
                            )
                          }))
                        }
                        rows={3}
                        placeholder="Set-Location $HOME"
                      />
                    </label>
                  )}

                  {action.type === 'open_url' && (
                    <label>
                      Link
                      <input
                        value={action.url}
                        onChange={(event) =>
                          setDraft((previous) => ({
                            ...previous,
                            actions: previous.actions.map((item) =>
                              item.id === action.id ? { ...item, url: event.target.value } : item
                            )
                          }))
                        }
                        placeholder="https://github.com/"
                      />
                    </label>
                  )}

                  {action.type === 'wait' && (
                    <label>
                      Wait time in milliseconds
                      <input
                        type="number"
                        min="0"
                        step="100"
                        value={action.ms}
                        onChange={(event) =>
                          setDraft((previous) => ({
                            ...previous,
                            actions: previous.actions.map((item) =>
                              item.id === action.id ? { ...item, ms: event.target.value } : item
                            )
                          }))
                        }
                      />
                    </label>
                  )}
                </div>
              ))}
            </div>
          </div>

          {errorMessage && <p className="workflow-form__error">{errorMessage}</p>}
        </div>

        <div className="workflow-modal__actions">
          <button className="workflow-button workflow-button--secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="workflow-button workflow-button--primary" onClick={saveWorkflow}>
            Save workflow
          </button>
        </div>
      </div>
    </div>
  );
};

export default WorkflowEditorModal;
