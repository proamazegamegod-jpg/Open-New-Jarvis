import React, { useEffect, useRef, useState } from 'react';
import electronBridge, { demoCommands, demoTranscript } from '../bridge.js';
import VoiceBar from '../components/VoiceBar.jsx';
import WorkflowList from '../components/WorkflowList.jsx';
import ExecutionStatus from '../components/ExecutionStatus.jsx';
import WorkflowEditorModal from '../components/WorkflowEditorModal.jsx';
import WorkflowPromptModal from '../components/WorkflowPromptModal.jsx';
import CommandBar from '../components/CommandBar.jsx';
import '../workflow-app.css';

const VOICE_TRIGGER_DEDUPE_MS = 60000;
const TRANSCRIPT_REFRESH_MS = 1000;
const STT_CLEAR_GUARD_MS = 2500;

const createIdleExecutionState = () => ({
  phase: 'idle',
  workflowId: '',
  workflowName: '',
  message: 'Click Run, type a workflow name, or use voice to start.',
  steps: []
});

const normalizeTriggerText = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ');

const tokenizeText = (value) => normalizeTriggerText(value).split(' ').filter(Boolean);

const hasOrderedWordMatch = (messageWords, candidateWords) => {
  if (candidateWords.length < 2) {
    return false;
  }

  let candidateIndex = 0;

  for (const word of messageWords) {
    if (word === candidateWords[candidateIndex]) {
      candidateIndex += 1;
      if (candidateIndex === candidateWords.length) {
        return true;
      }
    }
  }

  return false;
};

const getCandidateMatchScore = (normalizedMessage, messageWords, candidate) => {
  if (!candidate) {
    return 0;
  }

  if (normalizedMessage === candidate) {
    return 400 + candidate.length;
  }

  if (normalizedMessage.includes(candidate)) {
    return 300 + candidate.length;
  }

  const candidateWords = candidate.split(' ').filter(Boolean);
  if (hasOrderedWordMatch(messageWords, candidateWords)) {
    return 200 + candidateWords.length * 10;
  }

  if (candidate.length >= 5 && candidate.includes(normalizedMessage)) {
    return 120 + normalizedMessage.length;
  }

  return 0;
};

const isStartListeningCommand = (value) => {
  const normalized = normalizeTriggerText(value);
  return (
    normalized === 'start' ||
    normalized.includes('start listening') ||
    normalized.includes('resume listening')
  );
};

const isStopListeningCommand = (value) => {
  const normalized = normalizeTriggerText(value);
  return (
    normalized === 'stop' ||
    normalized.includes('stop listening') ||
    normalized.includes('stop transcription')
  );
};

const getWorkflowName = (workflow) => workflow?.name || workflow?.id || 'Workflow';

const createStepStatuses = (workflow) =>
  (workflow?.steps || []).map((step, index) => ({
    id: `${workflow.id || 'workflow'}-${index}`,
    label: step,
    status: 'pending'
  }));

const DesktopApp = () => {
  const [transcript, setTranscript] = useState(electronBridge.isDesktop ? '' : demoTranscript);
  const [finalTranscript, setFinalTranscript] = useState('');
  const [input, setInput] = useState('');
  const [commandLibrary, setCommandLibrary] = useState(demoCommands);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState(null);
  const [createError, setCreateError] = useState('');
  const [editorError, setEditorError] = useState('');
  const [isCreatingWorkflow, setIsCreatingWorkflow] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [geminiKeyStatus, setGeminiKeyStatus] = useState(
    electronBridge.isDesktop
      ? 'Using your saved Gemini key when present, otherwise GEMINI_API_KEY from .env.'
      : 'Gemini key settings are available in the desktop app.'
  );
  const [isSavingGeminiKey, setIsSavingGeminiKey] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [sttEnabled, setSttEnabled] = useState(true);
  const [sttStatus, setSttStatus] = useState(electronBridge.isDesktop ? 'Waiting' : 'Preview');
  const [sttConnection, setSttConnection] = useState(
    electronBridge.isDesktop ? 'Offline' : 'Preview'
  );
  const [sttMessage, setSttMessage] = useState(
    electronBridge.isDesktop ? 'Voice control is offline.' : demoTranscript
  );
  const [executionState, setExecutionState] = useState(createIdleExecutionState);
  const sttEnabledRef = useRef(true);
  const commandLibraryRef = useRef(commandLibrary);
  const transcriptRef = useRef(transcript);
  const lastTriggerRef = useRef({ text: '', workflowId: '', at: 0 });
  const transcriptIgnoreUntilRef = useRef(0);
  const geminiMatchInFlightRef = useRef(false);

  useEffect(() => {
    sttEnabledRef.current = sttEnabled;
  }, [sttEnabled]);

  useEffect(() => {
    commandLibraryRef.current = commandLibrary;
  }, [commandLibrary]);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  const refreshCommandArea = async (message) => {
    setInput('');
    setFinalTranscript('');
    if (electronBridge.isDesktop) {
      const sttResponse = await electronBridge.clearSttContext();
      if (sttResponse?.ok) {
        const nextTranscript = String(sttResponse.data?.transcript || '');
        setTranscript(nextTranscript);
        transcriptRef.current = nextTranscript;
        setSttMessage(String(sttResponse.data?.message || ''));
        setSttStatus(sttResponse.data?.status || 'Waiting');
        setSttConnection(sttResponse.data?.connection || 'Offline');
      }
    } else {
      transcriptRef.current = '';
      setTranscript('');
      setSttMessage('');
    }
    if (message) {
      setStatusMessage(message);
    }

    const response = await electronBridge.listCommands();
    if (response?.ok && Array.isArray(response.data) && response.data.length > 0) {
      setCommandLibrary(response.data);
    }
  };

  const shouldIgnoreTranscript = () => Date.now() < transcriptIgnoreUntilRef.current;

  useEffect(() => {
    let isMounted = true;
    let unsubscribeStt = () => {};
    let unsubscribeProgress = () => {};

    if (electronBridge.isDesktop) {
      const syncSttState = (payload) => {
        if (!payload || !isMounted) {
          return;
        }

        setSttEnabled(Boolean(payload.enabled));
        setSttStatus(payload.status || 'Waiting');
        setSttConnection(payload.connection || 'Offline');
        setSttMessage(String(payload.message || ''));
        const nextTranscript = String(payload.transcript || '');
        setTranscript(nextTranscript);
        transcriptRef.current = nextTranscript;
        if (!nextTranscript) {
          setFinalTranscript('');
        }
      };

      electronBridge.getSttState().then((response) => {
        if (!response?.ok) {
          return;
        }
        syncSttState(response.data);
      });

      electronBridge.getAppSettings().then((response) => {
        if (!response?.ok || !isMounted) {
          return;
        }

        const nextKey = String(response.data?.geminiApiKey || '');
        setGeminiApiKey(nextKey);
        setGeminiKeyStatus(
          nextKey
            ? 'Using your saved Gemini API key.'
            : 'Using GEMINI_API_KEY from .env when available.'
        );
      });

      const unsubscribePartial = electronBridge.onSttPartial((payload) => {
        if (!payload || !isMounted || !sttEnabledRef.current || shouldIgnoreTranscript()) {
          return;
        }

        const text = String(payload.text ?? payload.partial ?? payload).trim();
        setTranscript(text);
        transcriptRef.current = text;
      });

      const unsubscribeFinal = electronBridge.onSttFinal((payload) => {
        if (!payload || !isMounted || shouldIgnoreTranscript()) {
          return;
        }

        const text = String(payload.text ?? '').trim();
        if (!text) {
          return;
        }

        if (isStartListeningCommand(text)) {
          setFinalTranscript('');
          void electronBridge.setSttEnabled(true).then((response) => {
            if (response?.ok) {
              syncSttState(response.data);
            }
          });
          return;
        }

        if (isStopListeningCommand(text)) {
          setFinalTranscript('');
          void electronBridge.setSttEnabled(false).then((response) => {
            if (response?.ok) {
              syncSttState(response.data);
            }
          });
          return;
        }

        if (!sttEnabledRef.current) {
          return;
        }

        setFinalTranscript(text);
        setTranscript(text);
        transcriptRef.current = text;
      });

      const unsubscribeState = electronBridge.onSttState(syncSttState);

      unsubscribeStt = () => {
        unsubscribePartial();
        unsubscribeFinal();
        unsubscribeState();
      };

      unsubscribeProgress = electronBridge.onWorkflowProgress((payload) => {
        if (!payload || !isMounted) {
          return;
        }

        const workflow = commandLibraryRef.current.find((item) => item.id === payload.workflowId) || {
          id: payload.workflowId,
          name: payload.workflowId,
          steps: []
        };

        setExecutionState((previous) => {
          const nextSteps =
            previous.workflowId === payload.workflowId && previous.steps.length > 0
              ? [...previous.steps]
              : createStepStatuses(workflow);

          nextSteps[payload.actionIndex] = {
            id: `${payload.workflowId}-${payload.actionIndex}`,
            label:
              payload.description ||
              nextSteps[payload.actionIndex]?.label ||
              `Step ${payload.actionIndex + 1}`,
            status: payload.status
          };

          return {
            phase: payload.status === 'failed' ? 'failed' : 'running',
            workflowId: payload.workflowId,
            workflowName: getWorkflowName(workflow),
            message:
              payload.status === 'failed'
                ? payload.error || 'A workflow step failed.'
                : payload.status === 'completed'
                  ? 'Finishing workflow...'
                  : payload.description || 'Running workflow...',
            steps: nextSteps
          };
        });
      });
    }

    electronBridge.listCommands().then((result) => {
      if (!isMounted || !result?.ok || !Array.isArray(result.data) || result.data.length === 0) {
        return;
      }
      setCommandLibrary(result.data);
    });

    return () => {
      isMounted = false;
      unsubscribeStt();
      unsubscribeProgress();
    };
  }, []);

  const toggleListening = async () => {
    if (!electronBridge.isDesktop) {
      return;
    }

    const response = await electronBridge.setSttEnabled(!sttEnabled);
    if (!response?.ok) {
      setStatusMessage(response?.error || 'Could not update voice control.');
      return;
    }

    setSttEnabled(Boolean(response.data?.enabled));
    setSttStatus(response.data?.status || 'Waiting');
    setSttConnection(response.data?.connection || 'Offline');
    setSttMessage(String(response.data?.message || ''));
    const nextTranscript = String(response.data?.transcript || '');
    setTranscript(nextTranscript);
    transcriptRef.current = nextTranscript;
    if (!nextTranscript) {
      setFinalTranscript('');
    }
  };

  const findMatchingWorkflow = (messageText) => {
    const normalizedMessage = normalizeTriggerText(messageText);
    if (!normalizedMessage) {
      return null;
    }

    const messageWords = tokenizeText(messageText);
    let bestMatch = null;
    let bestScore = 0;

    commandLibraryRef.current.forEach((workflow) => {
      const candidates = [
        normalizeTriggerText(workflow.trigger),
        normalizeTriggerText(workflow.name),
        normalizeTriggerText(workflow.id)
      ].filter(Boolean);

      const score = candidates.reduce((highest, candidate) => {
        const candidateScore = getCandidateMatchScore(normalizedMessage, messageWords, candidate);
        return Math.max(highest, candidateScore);
      }, 0);

      if (score > bestScore) {
        bestScore = score;
        bestMatch = workflow;
      }
    });

    return bestMatch;
  };

  const resolveWorkflowMatch = async (messageText, source) => {
    const localMatch = findMatchingWorkflow(messageText);
    if (localMatch) {
      return localMatch;
    }

    if (!source.startsWith('voice') || geminiMatchInFlightRef.current) {
      return null;
    }

    geminiMatchInFlightRef.current = true;

    try {
      const response = await electronBridge.matchWorkflowIntent(messageText);
      if (!response?.ok) {
        return null;
      }

      return response.data?.workflow || null;
    } finally {
      geminiMatchInFlightRef.current = false;
    }
  };

  const runWorkflow = async (workflow, source = 'click') => {
    setStatusMessage('');
    setExecutionState({
      phase: 'running',
      workflowId: workflow.id,
      workflowName: getWorkflowName(workflow),
      message: `Running from ${source}.`,
      steps: createStepStatuses(workflow)
    });

    const response = await electronBridge.executeCommand(workflow);
    if (response?.ok) {
      setExecutionState((previous) => ({
        ...previous,
        phase: 'done',
        message: response.data?.result || 'Workflow finished.',
        steps:
          previous.steps.length > 0
            ? previous.steps.map((step) => ({
                ...step,
                status: step.status === 'failed' ? 'failed' : 'completed'
              }))
            : previous.steps
      }));
      transcriptIgnoreUntilRef.current = Date.now() + STT_CLEAR_GUARD_MS;
      await refreshCommandArea(`Finished ${getWorkflowName(workflow)}. Ready for the next command.`);
      return true;
    }

    setExecutionState((previous) => ({
      ...previous,
      phase: 'failed',
      message: response?.error || 'Workflow failed.'
    }));
    transcriptIgnoreUntilRef.current = Date.now() + STT_CLEAR_GUARD_MS;
    await refreshCommandArea(
      `There was a problem running ${getWorkflowName(workflow)}. Try again when ready.`
    );
    return false;
  };

  const runTriggeredWorkflow = async (messageText, source) => {
    if (shouldIgnoreTranscript()) {
      return false;
    }

    const matchedWorkflow = await resolveWorkflowMatch(messageText, source);
    if (!matchedWorkflow) {
      return false;
    }

    const normalizedMessage = normalizeTriggerText(messageText);
    const now = Date.now();
    const isVoiceSource = source.startsWith('voice');

    if (
      isVoiceSource &&
      lastTriggerRef.current.workflowId === matchedWorkflow.id &&
      now - lastTriggerRef.current.at < VOICE_TRIGGER_DEDUPE_MS
    ) {
      return true;
    }

    lastTriggerRef.current = { text: normalizedMessage, workflowId: matchedWorkflow.id, at: now };
    await runWorkflow(matchedWorkflow, source);
    return true;
  };

  useEffect(() => {
    if (!finalTranscript || !sttEnabledRef.current) {
      return;
    }

    if (isStartListeningCommand(finalTranscript) || isStopListeningCommand(finalTranscript)) {
      return;
    }

    if (shouldIgnoreTranscript()) {
      return;
    }

    void runTriggeredWorkflow(finalTranscript, 'voice');
  }, [finalTranscript]);

  useEffect(() => {
    if (!electronBridge.isDesktop) {
      return undefined;
    }

    const interval = setInterval(() => {
      if (!sttEnabledRef.current) {
        return;
      }

      if (shouldIgnoreTranscript()) {
        return;
      }

      const currentTranscript = transcriptRef.current;
      if (!currentTranscript) {
        return;
      }

      if (
        isStartListeningCommand(currentTranscript) ||
        isStopListeningCommand(currentTranscript)
      ) {
        return;
      }

      void runTriggeredWorkflow(currentTranscript, 'voice refresh');
    }, TRANSCRIPT_REFRESH_MS);

    return () => clearInterval(interval);
  }, []);

  const handleSubmitCommand = async () => {
    if (!electronBridge.isDesktop) {
      setExecutionState({
        phase: 'idle',
        workflowId: '',
        workflowName: '',
        message: 'Execution works in the desktop app.',
        steps: []
      });
      return;
    }

    const trimmed = input.trim();
    if (!trimmed) {
      return;
    }

    const didRun = await runTriggeredWorkflow(trimmed, 'text');
    if (!didRun) {
      setExecutionState({
        phase: 'idle',
        workflowId: '',
        workflowName: '',
        message: `No workflow matched "${trimmed}". Try the exact workflow name or trigger.`,
        steps: []
      });
      setInput('');
    }
  };

  const openCreateWorkflow = () => {
    if (!electronBridge.supportsCommandEditing) {
      setStatusMessage('Workflow editing is available in the desktop app.');
      return;
    }

    setCreateError('');
    setIsCreateModalOpen(true);
  };

  const openEditWorkflow = (workflow) => {
    if (!electronBridge.supportsCommandEditing) {
      setStatusMessage('Workflow editing is available in the desktop app.');
      return;
    }

    setEditorError('');
    setEditingWorkflow(workflow);
    setIsEditorOpen(true);
  };

  const handleSaveWorkflow = async (payload) => {
    const response = await electronBridge.saveCommand(payload);
    if (!response?.ok) {
      const message =
        response?.error ||
        response?.data?.issues?.map((issue) => issue.message).join(' ') ||
        'Could not save the workflow.';
      setEditorError(message);
      return { ok: false };
    }

    setCommandLibrary((previous) => {
      const next = previous.filter((item) => item.id !== response.data.id);
      return [...next, response.data];
    });
    setIsEditorOpen(false);
    setEditingWorkflow(null);
    setEditorError('');
    setStatusMessage(`Saved ${getWorkflowName(response.data)}.`);
    return { ok: true };
  };

  const handleCreateWorkflow = async (prompt) => {
    setCreateError('');
    setStatusMessage('');
    setIsCreatingWorkflow(true);

    const synthesisResponse = await electronBridge.synthesizeCommand(prompt);
    if (!synthesisResponse?.ok) {
      setCreateError(synthesisResponse?.error || 'Could not generate the workflow.');
      setIsCreatingWorkflow(false);
      return { ok: false };
    }

    const saveResponse = await electronBridge.saveCommand(synthesisResponse.data);
    if (!saveResponse?.ok) {
      const message =
        saveResponse?.error ||
        saveResponse?.data?.issues?.map((issue) => issue.message).join(' ') ||
        'Could not save the generated workflow.';
      setCreateError(message);
      setIsCreatingWorkflow(false);
      return { ok: false };
    }

    setCommandLibrary((previous) => {
      const next = previous.filter((item) => item.id !== saveResponse.data.id);
      return [...next, saveResponse.data];
    });
    setIsCreateModalOpen(false);
    setStatusMessage(`Created ${getWorkflowName(saveResponse.data)} with Gemini.`);
    setIsCreatingWorkflow(false);
    return { ok: true };
  };

  const handleSaveGeminiKey = async () => {
    if (!electronBridge.isDesktop) {
      return;
    }

    setIsSavingGeminiKey(true);
    const response = await electronBridge.setGeminiApiKey(geminiApiKey);
    if (!response?.ok) {
      setGeminiKeyStatus(response?.error || 'Could not save the Gemini API key.');
      setIsSavingGeminiKey(false);
      return;
    }

    const savedKey = String(response.data?.geminiApiKey || '');
    setGeminiApiKey(savedKey);
    setGeminiKeyStatus(
      savedKey
        ? 'Saved. The app will now use your Gemini API key.'
        : 'Saved. The app will now fall back to GEMINI_API_KEY from .env.'
    );
    setIsSavingGeminiKey(false);
  };

  return (
    <div className="workflow-app-shell">
      <div className="workflow-app">
        <VoiceBar
          appName="Nyctw Jarvis"
          transcript={transcript || sttMessage}
          sttStatus={sttStatus}
          sttConnection={sttConnection}
          isListening={sttEnabled}
          canListen={electronBridge.isDesktop}
          onToggleListening={toggleListening}
        />

        <main className="workflow-main">
          <div className="workflow-workspace">
            <section className="workflow-section workflow-section--list">
              <div className="workflow-section__header">
                <div>
                  <p className="workflow-kicker">Workflows</p>
                  <h2>Your workflows</h2>
                  <p className="workflow-section__copy">
                    Start from your saved commands first, then watch execution in the side terminal.
                  </p>
                </div>
                <button
                  className="workflow-button workflow-button--primary"
                  onClick={openCreateWorkflow}
                  disabled={!electronBridge.supportsCommandEditing}
                >
                  Create Workflow
                </button>
              </div>

              <CommandBar
                value={input}
                onChange={setInput}
                onSubmit={handleSubmitCommand}
                canRun={electronBridge.isDesktop}
              />

              {statusMessage && <p className="workflow-note">{statusMessage}</p>}

              {!electronBridge.supportsCommandEditing && (
                <p className="workflow-note">
                  Editing and execution stay available when the Electron app is connected.
                </p>
              )}

              <WorkflowList
                workflows={commandLibrary}
                onRun={(workflow) => runWorkflow(workflow)}
                onEdit={openEditWorkflow}
                canRun={electronBridge.isDesktop}
                canEdit={electronBridge.supportsCommandEditing}
              />
            </section>

            <aside className="workflow-terminal-rail">
              <ExecutionStatus executionState={executionState} />
              <section className="workflow-section workflow-settings-card">
                <div className="workflow-settings-card__header">
                  <div>
                    <p className="workflow-kicker">Gemini</p>
                    <h2>Your API key</h2>
                  </div>
                </div>

                <div className="workflow-form workflow-settings-form">
                  <label>
                    Gemini API key
                    <input
                      type="password"
                      value={geminiApiKey}
                      onChange={(event) => setGeminiApiKey(event.target.value)}
                      placeholder="Paste your Gemini API key"
                      disabled={!electronBridge.isDesktop || isSavingGeminiKey}
                    />
                  </label>
                </div>

                <div className="workflow-settings-actions">
                  <button
                    className="workflow-button workflow-button--secondary"
                    onClick={handleSaveGeminiKey}
                    disabled={!electronBridge.isDesktop || isSavingGeminiKey}
                  >
                    {isSavingGeminiKey ? 'Saving...' : 'Save key'}
                  </button>
                </div>

                <p className="workflow-note">{geminiKeyStatus}</p>
              </section>
            </aside>
          </div>
        </main>
      </div>

      <WorkflowEditorModal
        isOpen={isEditorOpen}
        workflow={editingWorkflow}
        existingWorkflows={commandLibrary}
        errorMessage={editorError}
        onClose={() => {
          setIsEditorOpen(false);
          setEditingWorkflow(null);
          setEditorError('');
        }}
        onSave={handleSaveWorkflow}
      />
      <WorkflowPromptModal
        isOpen={isCreateModalOpen}
        isBusy={isCreatingWorkflow}
        errorMessage={createError}
        onClose={() => {
          setIsCreateModalOpen(false);
          setCreateError('');
        }}
        onCreate={handleCreateWorkflow}
      />
    </div>
  );
};

export default DesktopApp;
