import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
const VOICE_TRIGGER_HOLD_MS = 5000;
const VOICE_TRIGGER_COOLDOWN_MS = 1200;
const VOICE_OPEN_YOUTUBE_SEARCH_REGEX = /^open youtube and search\s+(.+)$/;
const VOICE_START_CODING_REGEX = /^start coding(?:\s+.*)?$/;

const getSttText = (payload) => {
  if (typeof payload === 'string') {
    return payload;
  }
  if (payload && typeof payload === 'object') {
    return payload.text ?? payload.partial ?? payload.transcript ?? '';
  }
  return '';
};

const formatWorkspaceRoutineStatus = (result) => {
  const opened = Array.isArray(result?.data?.opened) ? result.data.opened : [];
  const failed = Array.isArray(result?.data?.failed) ? result.data.failed : [];
  const openedMessage = opened.length > 0 ? `Opened: ${opened.join(', ')}.` : 'No resources opened.';
  const failedMessage =
    failed.length > 0
      ? ` Failed: ${failed.map((item) => `${item.label}${item.error ? ` (${item.error})` : ''}`).join('; ')}.`
      : '';
  return `Start coding routine complete. ${openedMessage}${failedMessage}`;
};

const DesktopApp = () => {
  const [transcript, setTranscript] = useState(
    electronBridge.isDesktop ? '' : demoTranscript
  );
  const [finalTranscript, setFinalTranscript] = useState('');
  const [input, setInput] = useState('');
  const [chatMessages, setChatMessages] = useState(demoMessages);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [commandLibrary, setCommandLibrary] = useState(demoCommands);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorCommand, setEditorCommand] = useState(emptyCommand);
  const [validationResult, setValidationResult] = useState(null);
  const [commandStatus, setCommandStatus] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [sttEnabled, setSttEnabled] = useState(true);
  const [lastSttAt, setLastSttAt] = useState(null);
  const [sttStatus, setSttStatus] = useState('Waiting');
  const [sttConnection, setSttConnection] = useState('Offline');
  const [isHoldingVoiceTrigger, setIsHoldingVoiceTrigger] = useState(false);
  const [voiceHoldProgress, setVoiceHoldProgress] = useState(0);
  const [isVoiceTriggerArmed, setIsVoiceTriggerArmed] = useState(false);
  const [isVoiceTriggerCoolingDown, setIsVoiceTriggerCoolingDown] = useState(false);
  const streamTimerRef = useRef(null);
  const requestIdRef = useRef(0);
  const cancelledRequestRef = useRef(null);
  const sttEnabledRef = useRef(true);
  const sendMessageWithTextRef = useRef(null);
  const voiceTriggerArmedRef = useRef(false);
  const voiceTriggerCoolingDownRef = useRef(false);
  const voiceTriggerKeyDownRef = useRef(false);
  const voiceTriggerHoldStartedAtRef = useRef(0);
  const voiceTriggerHoldTimerRef = useRef(null);
  const voiceTriggerCooldownTimerRef = useRef(null);
  const commandStatusTimerRef = useRef(null);

  useEffect(() => {
    sttEnabledRef.current = sttEnabled;
  }, [sttEnabled]);

  const startVoiceTriggerCooldown = () => {
    if (voiceTriggerCooldownTimerRef.current) {
      clearTimeout(voiceTriggerCooldownTimerRef.current);
      voiceTriggerCooldownTimerRef.current = null;
    }

    voiceTriggerCoolingDownRef.current = true;
    setIsVoiceTriggerCoolingDown(true);

    voiceTriggerCooldownTimerRef.current = setTimeout(() => {
      voiceTriggerCoolingDownRef.current = false;
      setIsVoiceTriggerCoolingDown(false);
      voiceTriggerCooldownTimerRef.current = null;
    }, VOICE_TRIGGER_COOLDOWN_MS);
  };

  const handleVoiceTriggeredTranscript = async (spokenText) => {
    if (commandStatusTimerRef.current) {
      clearTimeout(commandStatusTimerRef.current);
      commandStatusTimerRef.current = null;
    }

    const text = String(spokenText || '').trim();
    if (!text) {
      voiceTriggerArmedRef.current = false;
      setIsVoiceTriggerArmed(false);
      startVoiceTriggerCooldown();
      return;
    }

    voiceTriggerArmedRef.current = false;
    setIsVoiceTriggerArmed(false);
    setFinalTranscript(text);
    setTranscript(`Voice command: ${text}`);
    setLastSttAt(Date.now());

    const normalized = text.toLowerCase();
    const youtubeSearchMatch = normalized.match(VOICE_OPEN_YOUTUBE_SEARCH_REGEX);
    const isStartCoding = VOICE_START_CODING_REGEX.test(normalized);
    const openYouTube = async (url, successMessage, failureMessage) => {
      const response = await electronBridge.openExternalUrl(url);
      setCommandStatus(response?.ok ? successMessage : response?.error || failureMessage);
    };
    try {
      if (normalized === 'open youtube') {
        await openYouTube('https://www.youtube.com', 'Opened YouTube.', 'Unable to open YouTube.');
      } else if (youtubeSearchMatch) {
        const query = youtubeSearchMatch[1]?.trim();
        if (!query) {
          await openYouTube(
            'https://www.youtube.com',
            'Opened YouTube.',
            'Unable to open YouTube.'
          );
        } else {
          const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
          await openYouTube(
            url,
            `Opened YouTube search for "${query}".`,
            'Unable to open YouTube search.'
          );
        }
      } else if (isStartCoding) {
        const routineResult = await electronBridge.runCodingWorkspaceRoutine();
        setCommandStatus(formatWorkspaceRoutineStatus(routineResult));
      } else {
        await sendMessageWithTextRef.current?.(text);
      }
    } catch (error) {
      setCommandStatus(error?.message || `Voice command "${text}" failed. Please try again.`);
    } finally {
      startVoiceTriggerCooldown();
    }
  };

  useEffect(() => {
    let isMounted = true;
    let unsubscribe = () => {};

    if (electronBridge.isDesktop) {
      unsubscribe = electronBridge.onSttPartial((payload) => {
        if (!payload || !isMounted) {
          return;
        }

        if (!sttEnabledRef.current) {
          return;
        }

        const text = getSttText(payload);
        if (!text) {
          return;
        }
        setTranscript(String(text));
        setLastSttAt(Date.now());
      });
      const unsubscribeFinal = electronBridge.onSttFinal((payload) => {
        if (!isMounted) {
          return;
        }
        const text = String(getSttText(payload)).trim();
        if (!text) {
          return;
        }

        setLastSttAt(Date.now());

        if (voiceTriggerArmedRef.current) {
          void handleVoiceTriggeredTranscript(text);
          return;
        }

        const normalized = text.toLowerCase().trim();
        const isStopCommand =
          normalized === 'stop' ||
          normalized.includes('stop listening') ||
          normalized.includes('stop transcription');
        const isStartCommand =
          normalized === 'start' ||
          normalized.includes('start listening') ||
          normalized.includes('resume listening');

        if (isStartCommand) {
          setSttEnabled(true);
          setTranscript('STT resumed.');
          setFinalTranscript(text);
          setLastSttAt(Date.now());
          return;
        }

        if (!sttEnabledRef.current) {
          return;
        }

        if (isStopCommand) {
          setSttEnabled(false);
          setTranscript('STT paused.');
          setFinalTranscript(text);
          setLastSttAt(Date.now());
          return;
        }

        setFinalTranscript(text);
      });
      const previousUnsubscribe = unsubscribe;
      const unsubscribeStatus = electronBridge.onSttStatus((payload) => {
        if (!payload || !isMounted) {
          return;
        }
        if (payload.state === 'connected') {
          setSttConnection('Connected');
          return;
        }
        if (payload.state === 'disconnected') {
          setSttConnection('Offline');
          return;
        }
        if (!sttEnabledRef.current) {
          return;
        }
        if (payload.state === 'listening') {
          setSttStatus('Live');
        } else if (payload.state === 'processing') {
          setSttStatus('Processing');
        } else if (payload.state === 'idling') {
          setSttStatus('Idle');
        }
      });
      unsubscribe = () => {
        previousUnsubscribe();
        unsubscribeFinal();
        unsubscribeStatus();
      };
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
      if (voiceTriggerHoldTimerRef.current) {
        clearInterval(voiceTriggerHoldTimerRef.current);
      }
      if (voiceTriggerCooldownTimerRef.current) {
        clearTimeout(voiceTriggerCooldownTimerRef.current);
      }
      if (commandStatusTimerRef.current) {
        clearTimeout(commandStatusTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!electronBridge.isDesktop) {
        setSttStatus('Preview');
        return;
      }
      if (!sttEnabledRef.current) {
        setSttStatus('Off');
        return;
      }
      if (sttConnection === 'Offline') {
        setSttStatus('Offline');
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
  }, [lastSttAt, sttConnection]);

  useEffect(() => {
    if (!electronBridge.isDesktop) {
      return () => {};
    }

    const clearHold = () => {
      if (voiceTriggerHoldTimerRef.current) {
        clearInterval(voiceTriggerHoldTimerRef.current);
        voiceTriggerHoldTimerRef.current = null;
      }
      voiceTriggerKeyDownRef.current = false;
      setIsHoldingVoiceTrigger(false);
      if (!voiceTriggerArmedRef.current) {
        setVoiceHoldProgress(0);
      }
    };

    const shouldIgnoreTarget = (target) => {
      if (!target) {
        return false;
      }

      const element = target;
      const tag = element.tagName?.toLowerCase();
      return (
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        element.isContentEditable === true
      );
    };

    const onKeyDown = (event) => {
      if (event.key?.toLowerCase() !== 'r') {
        return;
      }

      if (event.repeat || voiceTriggerKeyDownRef.current || shouldIgnoreTarget(event.target)) {
        return;
      }

      if (voiceTriggerArmedRef.current || voiceTriggerCoolingDownRef.current) {
        return;
      }

      voiceTriggerKeyDownRef.current = true;
      voiceTriggerHoldStartedAtRef.current = Date.now();
      setIsHoldingVoiceTrigger(true);
      setVoiceHoldProgress(0);
      if (commandStatusTimerRef.current) {
        clearTimeout(commandStatusTimerRef.current);
        commandStatusTimerRef.current = null;
      }
      setCommandStatus('Hold R to 100% to arm voice command mode.');

      voiceTriggerHoldTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - voiceTriggerHoldStartedAtRef.current;
        const progress = Math.min((elapsed / VOICE_TRIGGER_HOLD_MS) * 100, 100);
        setVoiceHoldProgress(progress);

        if (elapsed < VOICE_TRIGGER_HOLD_MS) {
          return;
        }

        if (voiceTriggerHoldTimerRef.current) {
          clearInterval(voiceTriggerHoldTimerRef.current);
          voiceTriggerHoldTimerRef.current = null;
        }
        if (!voiceTriggerArmedRef.current) {
          voiceTriggerArmedRef.current = true;
          setIsVoiceTriggerArmed(true);
          setTranscript('Voice trigger armed. Speak your command now.');
          setCommandStatus('Voice trigger armed. Waiting for final STT transcript.');
          if (commandStatusTimerRef.current) {
            clearTimeout(commandStatusTimerRef.current);
          }
          commandStatusTimerRef.current = setTimeout(() => {
            if (voiceTriggerArmedRef.current) {
              voiceTriggerArmedRef.current = false;
              setIsVoiceTriggerArmed(false);
              setVoiceHoldProgress(0);
              startVoiceTriggerCooldown();
              setCommandStatus('Voice trigger timed out. Hold R again to retry.');
            }
          }, 12000);
        }
      }, 100);
    };

    const onKeyUp = (event) => {
      if (event.key?.toLowerCase() !== 'r') {
        return;
      }

      clearHold();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      clearHold();
    };
  }, []);

  const memoryItems = useMemo(
    () => [
      { label: 'Mode', value: electronBridge.isDesktop ? 'Desktop live' : 'Browser demo' },
      { label: 'STT', value: `${sttStatus}${sttConnection === 'Connected' ? '' : ' (Offline)'}` },
      { label: 'Messages', value: String(chatMessages.length) },
      { label: 'Commands', value: String(commandLibrary.length) }
    ],
    [chatMessages.length, commandLibrary.length, sttConnection, sttStatus]
  );

  const startStreaming = useCallback((fullText) => {
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
  }, []);

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

  const sendMessageWithText = useCallback(async (messageText) => {
    const trimmed = String(messageText || '').trim();
    if (!trimmed) {
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    const outgoingMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed
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
  }, [chatMessages, startStreaming]);

  useEffect(() => {
    sendMessageWithTextRef.current = sendMessageWithText;
  }, [sendMessageWithText]);

  const voiceTriggerMessage = isVoiceTriggerArmed
    ? 'Voice trigger is active and waiting for your next spoken command.'
    : isVoiceTriggerCoolingDown
      ? 'Voice trigger cooling down...'
      : isHoldingVoiceTrigger
        ? `Hold R progress: ${Math.round(voiceHoldProgress)}%`
        : 'Hold R for 5 seconds, then say commands like "open youtube" or "start coding".';

  const sendMessage = async () => {
    const messageText = input.trim();
    if (!messageText) {
      return;
    }
    await sendMessageWithText(messageText);
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
            <p className="desktop-copy">
              {transcript || (electronBridge.isDesktop ? 'Waiting for transcript...' : demoTranscript)}
            </p>
            {finalTranscript && <p className="desktop-copy">Final: {finalTranscript}</p>}
            <p className="desktop-copy">STT: {sttStatus}</p>
            <p className="desktop-copy">Connection: {sttConnection}</p>
            {electronBridge.isDesktop && (
              <>
                <p className="desktop-copy">
                  {voiceTriggerMessage}
                </p>
                <div className="voice-hold-progress" aria-hidden="true">
                  <div
                    className={`voice-hold-progress-bar${isVoiceTriggerArmed ? ' active' : ''}`}
                    style={{ width: `${isVoiceTriggerArmed ? 100 : voiceHoldProgress}%` }}
                  />
                </div>
              </>
            )}
            {electronBridge.isDesktop && (
              <div className="stt-actions">
                <button
                  className="button secondary"
                  onClick={() => setSttEnabled((prev) => !prev)}
                >
                  {sttEnabled ? 'Stop listening' : 'Start listening'}
                </button>
              </div>
            )}
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
            <button
              className="button secondary"
              onClick={() => sendMessageWithText(finalTranscript || transcript)}
              disabled={!finalTranscript && !transcript}
            >
              Voice → Gemini
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
