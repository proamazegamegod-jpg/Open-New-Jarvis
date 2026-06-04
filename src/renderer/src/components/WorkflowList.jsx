import React from 'react';
import WorkflowCard from './WorkflowCard.jsx';

const WorkflowList = ({ workflows, onRun, onEdit, canRun, canEdit }) => {
  if (!workflows.length) {
    return (
      <div className="workflow-empty-state">
        <h3>No workflows yet</h3>
        <p>Create your first workflow to open apps, terminals, and commands with one action.</p>
      </div>
    );
  }

  return (
    <div className="workflow-list">
      {workflows.map((workflow) => (
        <WorkflowCard
          key={workflow.id}
          workflow={workflow}
          onRun={onRun}
          onEdit={onEdit}
          canRun={canRun}
          canEdit={canEdit}
        />
      ))}
    </div>
  );
};

export default WorkflowList;
