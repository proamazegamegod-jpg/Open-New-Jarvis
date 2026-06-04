import React from 'react';

const ExecutionStatus = ({ executionState }) => {
  const statusLabel =
    executionState.phase === 'running'
      ? 'Running'
      : executionState.phase === 'done'
        ? 'Done'
        : executionState.phase === 'failed'
          ? 'Failed'
          : 'Ready';

  return (
    <section className="execution-status execution-status--terminal" aria-live="polite">
      <div className="execution-status__header">
        <div>
          <p className="workflow-kicker">Execution terminal</p>
          <h3>{executionState.workflowName || 'Ready to run'}</h3>
        </div>
        <span className={`execution-status__badge execution-status__badge--${executionState.phase}`}>
          {statusLabel}
        </span>
      </div>

      <div className="execution-status__screen">
        <p className="execution-status__message">
          <span className="execution-status__prompt">$</span>
          {executionState.message}
        </p>

        {executionState.steps.length > 0 && (
          <ul className="execution-status__steps">
            {executionState.steps.map((step) => (
              <li key={step.id}>
                <span>{step.label}</span>
                <strong>{step.status}</strong>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};

export default ExecutionStatus;
