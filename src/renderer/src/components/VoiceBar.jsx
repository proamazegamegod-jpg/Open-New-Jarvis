import React from 'react';

const VoiceBar = ({
  appName,
  transcript,
  sttStatus,
  sttConnection,
  isListening,
  canListen,
  onToggleListening
}) => {
  return (
    <header className="voice-bar">
      <div className="voice-bar__title">
        <p className="workflow-kicker">Workflow runner</p>
        <h1>{appName}</h1>
      </div>

      <button
        className="workflow-button workflow-button--voice"
        onClick={onToggleListening}
        disabled={!canListen}
      >
        {isListening ? 'Stop listening' : '🎤 Start'}
      </button>

      <div className="voice-bar__transcript">
        <span className="voice-bar__status">
          {sttStatus}
          {sttConnection ? ` · ${sttConnection}` : ''}
        </span>
        <p>{transcript}</p>
      </div>
    </header>
  );
};

export default VoiceBar;
