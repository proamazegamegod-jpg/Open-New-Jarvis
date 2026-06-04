import React, { useEffect, useMemo, useRef, useState } from 'react';
import electronBridge, {
  demoCommands,
  demoMessages,
  demoTranscript
} from './bridge.js';

const emptyCommand = {
  id: '',
  trigger: '',
  steps: [''],
  confirm: false
};

const whatYouGet = [
  {
    title: 'Voice first control',
    description:
      'Live transcript stays visible while speech becomes safe, reviewable actions.'
  },
  {
    title: 'Command recipes',
    description:
      'Build repeatable workflows with triggers, multi-step instructions, and confirmation gates.'
  },
  {
    title: 'Desktop native power',
    description:
      'Local integrations and execution controls stay available only in the Electron app.'
  },
  {
    title: 'Browser preview ready',
    description:
      'Deploy the same React surface to Vercel for a conversion-focused landing page.'
  }
];

const keyFeatures = [
  {
    title: 'Interactive preview',
    description:
      'Try the assistant in your browser: see demo responses, test triggers, and preview command behavior without installing.'
  },
  {
    title: 'Command library',
    description:
      'Create, edit, validate, dry-run, and run human-readable automation recipes. Each recipe shows preconditions, rollback steps, and confirmation settings.'
  },
  {
    title: 'Live STT and TTS',
    description:
      'Real-time transcription and optional local speech output keep interactions fast and private on desktop.'
  },
  {
    title: 'Safe execution',
    description:
      'Dry-run mode and confirmation gates prevent accidental actions. Shell or admin steps require explicit approval.'
  }
];

const comparisonCards = [
  {
    title: 'Web preview',
    description:
      'Polished marketing surface with a safe, interactive demo. Great for discovery and conversion.'
  },
  {
    title: 'Desktop app',
    description:
      'Full feature set: live STT, editable command recipes, dry-runs, execution controls, and local integrations.'
  }
];

const workflowSteps = [
  'Speak or type — capture a live transcript or enter a prompt.',
  'Review — Jarvis proposes a command or answer; validate and edit the steps.',
  'Dry-run or execute — simulate the workflow, then run it when you’re ready.'
];

const App = () => {
  const [transcript, setTranscript] = useState(demoTranscript);
  const [input, setInput] = useState('');
  const [chatMessages, setChatMessages] = useState(demoMessages);
  const [commandLibrary, setCommandLibrary] = useState(demoCommands);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorCommand, setEditorCommand] = useState(emptyCommand);
  const [validationResult, setValidationResult] = useState(null);
  const [commandStatus, setCommandStatus] = useState('');
  const streamTimerRef = useRef(null);
  const previewRef = useRef(null);

  const modeLabel = electronBridge.isDesktop ? 'Desktop app live' : 'Web preview mode';
  const modeDescription = electronBridge.isDesktop
    ? 'Connected to the Electron bridge with live command actions.'
    : 'Browser-safe landing page with demo responses and desktop download prompts.';

  const stats = useMemo(
    () => [
      { label: 'Demo commands', value: `${commandLibrary.length || demoCommands.length}` },
      { label: 'Browser preview', value: electronBridge.isDesktop ? 'Live bridge' : 'Ready' },
      { label: 'Desktop download', value: 'Primary CTA' }
    ],
    [commandLibrary.length]
  );

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

  const scrollToPreview = () => {
    previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const startStreaming = (fullText) => {
    if (streamTimerRef.current) {
      clearInterval(streamTimerRef.current);
    }

    const messageId = `assistant-${Date.now()}`;
    setChatMessages((prev) => [...prev, { id: messageId, role: 'assistant', content: '' }]);

    const chunks = String(fullText || '').split(' ');
    let index = 0;

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
      }
    }, 35);
  };

  const sendMessage = async () => {
    const messageText = input.trim();
    if (!messageText) {
      return;
    }

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
    <div className="app-shell">
      <header className="topbar">
        <button className="menu-toggle" onClick={scrollToPreview}>
          <span className="menu-icon" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span>Menu</span>
        </button>

        <div className="brand-lockup brand-lockup-center">
          <div className="brand-mark">OJ</div>
          <div>
            <p className="eyebrow">Open-New-Jarvis</p>
            <h1>Voice-powered workflows, polished for download.</h1>
          </div>
        </div>

        <nav className="utility-actions">
          <button className="utility-link" onClick={scrollToPreview}>
            Preview
          </button>
          <a className="utility-link" href="#download">
            Download
          </a>
          <a className="utility-link" href={electronBridge.repositoryUrl} target="_blank" rel="noreferrer">
            GitHub
          </a>
        </nav>
      </header>

      <main className="page">
        <section className="hero">
          <div className="hero-copy">
            <span className="pill">{modeLabel}</span>
            <h2>Voice-powered workflows, polished for desktop.</h2>
            <p className="hero-text">
              Download the desktop app to turn speech into safe, reviewable actions — or try the
              browser preview to see it in action.
            </p>

            <div className="hero-actions">
              <a
                className="button primary"
                href={electronBridge.releaseUrl}
                target="_blank"
                rel="noreferrer"
              >
                Download for desktop
              </a>
              <button className="button secondary" onClick={scrollToPreview}>
                See product preview
              </button>
            </div>

            <p className="mode-description">{modeDescription}</p>
            <div className="hero-progress" aria-hidden="true" />

            <div className="stats-grid">
              {stats.map((stat) => (
                <div key={stat.label} className="stat-card">
                  <strong>{stat.value}</strong>
                  <span>{stat.label}</span>
                </div>
              ))}
            </div>
          </div>

          <aside className="hero-panel">
            <div className="hero-panel-header">
              <span>A real product, not a prototype</span>
              <span>Built for desktop and the web</span>
            </div>
            <div className="hero-note">
              Open-New-Jarvis pairs a polished marketing surface with a powerful desktop
              experience. The landing page gives visitors a clear, interactive preview while the
              Electron app unlocks live STT, editable command recipes, dry-runs, and safe
              execution controls.
            </div>
            <ul className="hero-checklist">
              <li>Primary CTA keeps the download path obvious above the fold</li>
              <li>Interactive browser preview supports discovery before install</li>
              <li>Desktop mode keeps live integrations and execution controls available</li>
            </ul>
            <div className="hero-panel-footer">
              <span>Absolute black canvas</span>
              <span>Gold-only primary action</span>
            </div>
          </aside>
        </section>

        <section id="why" className="section-block">
          <div className="section-heading">
            <span className="eyebrow">Why Open-New-Jarvis</span>
            <h3>A real product, not a prototype.</h3>
          </div>
          <article className="surface-card long-copy-card">
            <p>
              Open-New-Jarvis pairs a polished marketing surface with a powerful desktop
              experience. The landing page gives visitors a clear, interactive preview while the
              Electron app unlocks live STT, editable command recipes, dry-runs, and safe
              execution controls.
            </p>
          </article>
        </section>

        <section className="section-block">
          <div className="section-heading">
            <span className="eyebrow">What you get</span>
            <h3>Voice-first automation with clear review points.</h3>
          </div>

          <div className="feature-grid">
            {whatYouGet.map((feature) => (
              <article key={feature.title} className="surface-card">
                <h4>{feature.title}</h4>
                <p>{feature.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="features" className="section-block">
          <div className="section-heading">
            <span className="eyebrow">Key features</span>
            <h3>What makes the landing page and desktop app work together.</h3>
          </div>

          <div className="feature-grid">
            {keyFeatures.map((feature) => (
              <article key={feature.title} className="surface-card">
                <h4>{feature.title}</h4>
                <p>{feature.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section-block workflow-grid">
          <article className="surface-card">
            <span className="eyebrow">How it works</span>
            <h3>Speak, review, then run when ready.</h3>
            <ol className="workflow-list">
              {workflowSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </article>

          <article className="surface-card callout-card">
            <span className="eyebrow">Download CTA</span>
            <h3>Ready to try it?</h3>
            <p>
              Download Open-New-Jarvis for desktop to unlock live workflows and local automation.
              Prefer to explore first? Open the product preview in your browser.
            </p>
            <a
              className="button primary"
              href={electronBridge.releaseUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open release downloads
            </a>
          </article>
        </section>

        <section id="preview" ref={previewRef} className="section-block preview-section">
          <div className="section-heading">
            <span className="eyebrow">Interactive preview</span>
            <h3>See the browser demo and the desktop workflow side by side.</h3>
          </div>

          <div className="preview-grid">
            <article className="surface-card preview-chat">
              <div className="panel-header">
                <div>
                  <h4>Assistant preview</h4>
                  <p>Use the same surface for a marketing preview or a live Electron session.</p>
                </div>
                <span className="mode-badge">{modeLabel}</span>
              </div>

              <div className="transcript">
                <strong>Live transcript</strong>
                <span>{transcript || 'Waiting for transcript...'}</span>
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
                  placeholder="Ask Jarvis about workflows, commands, or deployment..."
                />
                <button className="button primary" onClick={sendMessage}>
                  Send
                </button>
              </div>
            </article>

            <article className="surface-card preview-commands">
              <div className="panel-header">
                <div>
                  <h4>Demo commands</h4>
                  <p>
                    Create, edit, validate, dry-run, and run human-readable automation recipes.
                  </p>
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
                  Edit, validate, and run commands in the Electron app after download.
                </div>
              )}

              <div className="command-status">{commandStatus}</div>
              <div className="command-list">
                {commandLibrary.map((command) => (
                  <div key={command.id} className="command-card">
                    <div className="command-meta">
                      <div className="command-topline">
                        <strong>{command.id}</strong>
                        <span>
                          {command.confirm ? 'Confirmation required' : 'No confirmation required'}
                        </span>
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
                      <div className="command-detail-grid">
                        <div className="command-detail-block">
                          <strong>Preconditions</strong>
                          <ul className="step-list">
                            {(command.preconditions || [
                              'Review the command inputs before continuing'
                            ]).map((item) => (
                              <li key={`${command.id}-pre-${item}`}>{item}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="command-detail-block">
                          <strong>Rollback steps</strong>
                          <ul className="step-list">
                            {(command.rollback || [
                              'Stop execution and restore the prior working state manually'
                            ]).map((item) => (
                              <li key={`${command.id}-rollback-${item}`}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
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
            </article>
          </div>
        </section>

        <section className="section-block">
          <div className="section-heading">
            <span className="eyebrow">Web preview versus desktop app</span>
            <h3>Discovery on the web, full power on desktop.</h3>
          </div>
          <div className="faq-grid">
            {comparisonCards.map((item) => (
              <article key={item.title} className="surface-card">
                <h4>{item.title}</h4>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="download" className="section-block">
          <article className="surface-card cta-banner">
            <div>
              <span className="eyebrow">Download CTA</span>
              <h3>Ready to try it?</h3>
              <p>
                Download Open-New-Jarvis for desktop to unlock live workflows and local
                automation. Prefer to explore first? Open the product preview in your browser.
              </p>
            </div>
            <div className="hero-actions">
              <a
                className="button primary"
                href={electronBridge.releaseUrl}
                target="_blank"
                rel="noreferrer"
              >
                Download for desktop
              </a>
              <button className="button secondary" onClick={scrollToPreview}>
                See product preview
              </button>
            </div>
          </article>
        </section>
      </main>

      <footer className="site-footer">
        Built for quick demos and real workflows. The web preview is Vercel-ready and the
        Electron app is optimized for power users who want voice-first automation with reviewable,
        repeatable command recipes.
      </footer>

      {isEditorOpen && (
        <div className="modal-backdrop">
          <div className="modal">
            <h2>Command Editor</h2>
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

export default App;
