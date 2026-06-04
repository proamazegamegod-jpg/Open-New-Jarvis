import React from 'react';

const CommandBar = ({ value, onChange, onSubmit, canRun }) => {
  return (
    <footer className="command-bar">
      <input
        value={value}
        disabled={!canRun}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            onSubmit();
          }
        }}
        placeholder="Type a workflow name or trigger"
      />
      <button
        className="workflow-button workflow-button--primary"
        onClick={onSubmit}
        disabled={!canRun}
      >
        Send
      </button>
    </footer>
  );
};

export default CommandBar;
