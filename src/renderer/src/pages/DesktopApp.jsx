import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import electronBridge, {
  assistantGreeting,
  demoCommands,
  demoMessages,
  demoTranscript
} from '../bridge.js';

const emptyCommand = {
  id: '',
  trigger: '',
  steps: [''],
  confirm: false
};

const DesktopApp = () => {
  const [transcript, setTranscript] = useState(demoTranscript);
  const [input, setInput] = useState('');
  const [chatMessages, setChatMessages] = useState(demoMessages);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [commandLibrary, setCommandLibrary] = useState(demoCommands);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorCommand, setEditorCommand] = useState(emptyCommand);
  const [validationResult, setValidationResult] = useState(null);
  const [commandStatus, setCommandStatus] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [lastSttAt, setLastSttAt] = useState(null);
  const [sttStatus, setSttStatus] = useState('Waiting');
  const streamTimerRef = useRef(null);
  const requestIdRef = useRef(0);
  const cancelledRequestRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    let unsubscribe = () => {};

    if (electronBridge.isDesktop) {
      unsubscribe = electronBridge.onSttPartial((payload) => {
        if (!payload || !isMounted) {
          return;
        }

        const text = payload.text ?? payload.partial ?? payload;
        setTranscript(String(text));
        setLastSttAt(Date.now());
      });
    }

    electronBridge.listCommands().then((result) => {
      if (isMounted && result?.ok && Array.isArray(result.data) && result.data.length > 0) {
        setCommandLibrary(result.data);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();

      if (streamTimerRef.current) {
        clearInterval(streamTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!electronBridge.isDesktop) {
        setSttStatus('Preview');
        return;
      }
      if (!lastSttAt) {
        setSttStatus('Waiting');
        return;
      }
      const delta = Date.now() - lastSttAt;
      setSttStatus(delta < 4000 ? 'Live' : 'Idle');
    }, 1000);

    return () => clearInterval(interval);
  }, [lastSttAt]);

  const memoryItems = useMemo(
    () => [
      { label: 'Mode', value: electronBridge.isDesktop ? 'Desktop live' : 'Browser demo' },
      { label: 'STT', value: sttStatus },
      { label: 'Messages', value: String(chatMessages.length) },
      { label: 'Commands', value: String(commandLibrary.length) }
    ],
    [chatMessages.length, commandLibrary.length, sttStatus]
  );

  const startStreaming = (fullText) => {
    if (streamTimerRef.current) {
      clearInterval(streamTimerRef.current);
    }

    const messageId = `assistant-${Date.now()}`;
    setChatMessages((prev) => [...prev, { id: messageId, role: 'assistant', content: '' }]);

    const chunks = String(fullText || '').split(' ');
    let index = 0;
    setIsStreaming(true);

    streamTimerRef.current = setInterval(() => {
      index += 1;
      setChatMessages((prev) =>
        prev.map((message) =>
          message.id === messageId
            ? { ...message, content: chunks.slice(0, index).join(' ') }
            : message
        )
      );

      if (index >= chunks.length) {
        clearInterval(streamTimerRef.current);
        streamTimerRef.current = null;
        setIsStreaming(false);
      }
    }, 35);
  };

  const stopStreaming = () => {
    cancelledRequestRef.current = requestIdRef.current;
    if (streamTimerRef.current) {
      clearInterval(streamTimerRef.current);
      streamTimerRef.current = null;
    }
    setIsStreaming(false);
  };

  const startNewConversation = () => {
    setConversationHistory((prev) => [...prev, chatMessages]);
    setChatMessages([
      {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: assistantGreeting
      }
    ]);
  };

  const goBackConversation = () => {
    if (conversationHistory.length === 0) {
      return;
    }
    const previous = conversationHistory[conversationHistory.length - 1];
    setConversationHistory((prev) => prev.slice(0, -1));
    setChatMessages(previous);
  };

  const sendMessage = async () => {
    const messageText = input.trim();
    if (!messageText) {
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    const outgoingMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: messageText
    };
    const nextMessages = [...chatMessages, outgoingMessage];

    setChatMessages(nextMessages);
    setInput('');

    const response = await electronBridge.llmChat(
      nextMessages.map((message) => ({ role: message.role, content: message.content })),
      { temperature: 0.3 }
    );

    if (cancelledRequestRef.current === requestId) {
      return;
    }

    if (!response?.ok) {
      setChatMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'system',
          content: response?.error || 'LLM request failed.'
        }
      ]);
      return;
    }

    startStreaming(response.data?.content || 'No response returned.');
  };

  const openEditor = (command) => {
    if (!electronBridge.supportsCommandEditing) {
      setCommandStatus('Command editing is available in the desktop app.');
      return;
    }

    setEditorCommand(command ? { ...command } : { ...emptyCommand });
    setValidationResult(null);
    setIsEditorOpen(true);
  };

  const updateStep = (index, value) => {
    setEditorCommand((prev) => {
      const steps = [...prev.steps];
      steps[index] = value;
      return { ...prev, steps };
    });
  };

  const addStep = () => {
    setEditorCommand((prev) => ({ ...prev, steps: [...prev.steps, ''] }));
  };

  const removeStep = (index) => {
    setEditorCommand((prev) => ({
      ...prev,
      steps: prev.steps.filter((_step, stepIndex) => stepIndex !== index)
    }));
  };

  const validateCommand = async () => {
    const response = await electronBridge.validateCommand(editorCommand);
    setValidationResult(response);
  };

  const saveCommand = async () => {
    const response = await electronBridge.saveCommand(editorCommand);
    if (response?.ok) {
      setCommandLibrary((prev) => {
        const next = prev.filter((item) => item.id !== editorCommand.id);
        return [...next, editorCommand];
      });
      setIsEditorOpen(false);
      setCommandStatus(`Saved ${editorCommand.id}.`);
    } else {
      setValidationResult(response);
    }
  };

  const runCommand = async (command, mode) => {
    setCommandStatus(`${mode === 'dry' ? 'Dry-run' : 'Run'}: ${command.id}`);
    const response =
      mode === 'dry'
        ? await electronBridge.dryRunCommand(command)
        : await electronBridge.executeCommand(command);

    if (response?.ok) {
      setCommandStatus(`${mode === 'dry' ? 'Dry-run' : 'Run'} complete.`);
    } else {
      setCommandStatus(response?.error || 'Command failed.');
    }
  };

  return (
    <div className="desktop-shell">
      <header className="desktop-header">
        <div>
          <p className="eyebrow">Desktop workspace</p>
          <h1>OPEN-NEW-JARVIS APP</h1>
        </div>
        <nav className="desktop-header-actions">
          <Link className="button secondary" to="/">
            Back to landing
          </Link>
          <a className="button primary" href={electronBridge.releaseUrl} target="_blank" rel="noreferrer">
            Releases
          </a>
        </nav>
      </header>

      <main className="desktop-layout">
        <aside className="desktop-sidebar">
          <section className="desktop-panel">
            <span className="eyebrow">Workspace memory</span>
            <h2>SESSION OVERVIEW</h2>
            <div className="memory-list">
              {memoryItems.map((item) => (
                <div key={item.label} className="memory-card">
                  <strong>{item.value}</strong>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="desktop-panel">
            <span className="eyebrow">Live transcript</span>
            <p className="desktop-copy">{transcript || 'Waiting for transcript...'}</p>
            <p className="desktop-copy">STT: {sttStatus}</p>
          </section>
        </aside>

        <section className="desktop-panel desktop-chat-panel">
          <div className="panel-header">
            <div>
              <h2>CHAT</h2>
              <p>Talk to the assistant, review its answer, and keep the transcript visible.</p>
            </div>
            <div className="chat-actions">
              <button className="button secondary" onClick={goBackConversation} disabled={!conversationHistory.length}>
                Back
              </button>
              <button className="button secondary" onClick={startNewConversation}>
                New
              </button>
              <button className="button primary" onClick={stopStreaming} disabled={!isStreaming}>
                Stop
              </button>
            </div>
          </div>

          <div className="messages">
            {chatMessages.map((message) => (
              <div key={message.id} className={`message ${message.role}`}>
                <span className="role">{message.role}</span>
                <p>{message.content}</p>
              </div>
            ))}
          </div>

          <div className="chat-input">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  sendMessage();
                }
              }}
              placeholder="Ask Jarvis about commands, memory, or tasks..."
            />
            <button className="button primary" onClick={sendMessage}>
              Send
            </button>
          </div>
        </section>

        <section className="desktop-panel desktop-command-panel">
          <div className="panel-header">
            <div>
              <h2>COMMAND LIBRARY</h2>
              <p>Create, validate, dry-run, and execute reusable command recipes.</p>
            </div>
            <button
              className="button secondary"
              onClick={() => openEditor()}
              disabled={!electronBridge.supportsCommandEditing}
            >
              New command
            </button>
          </div>

          {!electronBridge.supportsCommandEditing && (
            <div className="inline-banner">
              Editing and execution are only live when Electron is connected to the preload bridge.
            </div>
          )}

          <div className="command-status">{commandStatus}</div>
          <div className="command-list">
            {commandLibrary.map((command) => (
              <div key={command.id} className="command-card">
                <div className="command-meta">
                  <div className="command-topline">
                    <strong>{command.id}</strong>
                    <span>{command.confirm ? 'Confirmation required' : 'Ready to run'}</span>
                  </div>
                  <p className="command-summary">
                    {command.summary ||
                      'Review the trigger, steps, and safety controls before execution.'}
                  </p>
                  <span className="command-trigger">Trigger: {command.trigger}</span>
                  <ul className="step-list">
                    {command.steps.map((step) => (
                      <li key={`${command.id}-${step}`}>{step}</li>
                    ))}
                  </ul>
                </div>

                <div className="command-actions">
                  <button
                    className="button secondary"
                    onClick={() => openEditor(command)}
                    disabled={!electronBridge.supportsCommandEditing}
                  >
                    Edit
                  </button>
                  <button
                    className="button secondary"
                    onClick={() => runCommand(command, 'dry')}
                    disabled={!electronBridge.isDesktop}
                  >
                    Dry-run
                  </button>
                  <button
                    className="button primary"
                    onClick={() => runCommand(command, 'run')}
                    disabled={!electronBridge.isDesktop}
                  >
                    Run
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {isEditorOpen && (
        <div className="modal-backdrop">
          <div className="modal">
            <h2>COMMAND EDITOR</h2>
            <label>
              Id
              <input
                value={editorCommand.id}
                onChange={(event) =>
                  setEditorCommand((prev) => ({ ...prev, id: event.target.value }))
                }
              />
            </label>
            <label>
              Trigger
              <input
                value={editorCommand.trigger}
                onChange={(event) =>
                  setEditorCommand((prev) => ({ ...prev, trigger: event.target.value }))
                }
              />
            </label>
            <div className="steps">
              <div className="steps-header">
                <span>Steps</span>
                <button className="button secondary" onClick={addStep}>
                  Add step
                </button>
              </div>
              {editorCommand.steps.map((step, index) => (
                <div key={`step-${index}`} className="step-row">
                  <input
                    value={step}
                    onChange={(event) => updateStep(index, event.target.value)}
                  />
                  <button className="button secondary" onClick={() => removeStep(index)}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={editorCommand.confirm}
                onChange={(event) =>
                  setEditorCommand((prev) => ({ ...prev, confirm: event.target.checked }))
                }
              />
              Require confirmation before execution
            </label>
            <div className="validation">
              <button className="button secondary" onClick={validateCommand}>
                Validate
              </button>
              {validationResult && (
                <span>
                  {validationResult.ok
                    ? 'Validation passed.'
                    : validationResult.error || 'Validation failed.'}
                </span>
              )}
            </div>
            <div className="modal-actions">
              <button className="button secondary" onClick={() => setIsEditorOpen(false)}>
                Cancel
              </button>
              <button className="button primary" onClick={saveCommand}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DesktopApp;
