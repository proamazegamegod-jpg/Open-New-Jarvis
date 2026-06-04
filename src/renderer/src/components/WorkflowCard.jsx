import React from 'react';

const WorkflowCard = ({ workflow, onRun, onEdit, canRun, canEdit }) => {
  const previewSteps = (workflow.steps || []).slice(0, 3);
  const remainingSteps = Math.max((workflow.steps || []).length - previewSteps.length, 0);

  return (
    <article className="workflow-card">
      <div className="workflow-card__content">
        <div className="workflow-card__header">
          <div>
            <h3>{workflow.name || workflow.id}</h3>
            <p>{workflow.summary || 'Ready to run.'}</p>
          </div>
          <span className="workflow-card__trigger">Say or type: {workflow.trigger}</span>
        </div>

        {previewSteps.length > 0 && (
          <ol className="workflow-card__steps">
            {previewSteps.map((step, index) => (
              <li key={`${workflow.id}-${index}`}>{step}</li>
            ))}
          </ol>
        )}

        {remainingSteps > 0 && (
          <p className="workflow-card__more">+{remainingSteps} more step{remainingSteps > 1 ? 's' : ''}</p>
        )}
      </div>

      <div className="workflow-card__actions">
        <button
          className="workflow-button workflow-button--primary"
          onClick={() => onRun(workflow)}
          disabled={!canRun}
        >
          Run
        </button>
        <button
          className="workflow-button workflow-button--secondary"
          onClick={() => onEdit(workflow)}
          disabled={!canEdit}
        >
          Edit
        </button>
      </div>
    </article>
  );
};

export default WorkflowCard;
