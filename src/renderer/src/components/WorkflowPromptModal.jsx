import React, { useEffect, useState } from 'react';

const WorkflowPromptModal = ({ isOpen, isBusy, errorMessage, onClose, onCreate }) => {
  const [prompt, setPrompt] = useState('');

  useEffect(() => {
    if (isOpen) {
      setPrompt('');
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleCreate = async () => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt || isBusy) {
      return;
    }

    await onCreate(trimmedPrompt);
  };

  return (
    <div className="workflow-modal-backdrop" role="presentation">
      <div className="workflow-modal" role="dialog" aria-modal="true" aria-labelledby="workflow-prompt-title">
        <div className="workflow-modal__header">
          <div>
            <p className="workflow-kicker">Create workflow</p>
            <h2 id="workflow-prompt-title">Describe the workflow you want</h2>
          </div>
          <button className="workflow-button workflow-button--secondary" onClick={onClose} disabled={isBusy}>
            Close
          </button>
        </div>

        <div className="workflow-form">
          <label>
            Workflow request
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={5}
              placeholder="Example: Open VS Code, start a PowerShell in my home folder, then open GitHub and Stack Overflow."
              disabled={isBusy}
            />
          </label>

          <p className="workflow-note">
            Gemini will turn this into a workflow using the supported actions and save it to your library.
          </p>

          {errorMessage && <p className="workflow-form__error">{errorMessage}</p>}
        </div>

        <div className="workflow-modal__actions">
          <button className="workflow-button workflow-button--secondary" onClick={onClose} disabled={isBusy}>
            Cancel
          </button>
          <button
            className="workflow-button workflow-button--primary"
            onClick={handleCreate}
            disabled={isBusy || !prompt.trim()}
          >
            {isBusy ? 'Creating...' : 'Create with Gemini'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WorkflowPromptModal;
