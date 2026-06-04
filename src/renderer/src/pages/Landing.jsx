import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import electronBridge from '../bridge.js';

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
      'Give visitors a clear product tour without mixing the real desktop workspace into the marketing site.'
  },
  {
    title: 'Desktop workspace',
    description:
      'Electron opens directly into the actual app interface with chat, command editing, transcript tools, and workspace panels.'
  },
  {
    title: 'Safe execution',
    description:
      'Dry-run mode and confirmation gates keep automation reviewable before any action runs.'
  },
  {
    title: 'Scalable architecture',
    description:
      'Routing keeps the website and product UI separate so each can evolve without cross-contaminating the other.'
  }
];

const previewCards = [
  {
    title: 'Landing page',
    description:
      'Built for discovery, conversion, and deployment to Vercel. This route stays focused on messaging, features, and download CTAs.'
  },
  {
    title: 'Desktop app',
    description:
      'Opens into the actual product experience with live transcript, command library, editor modal, and chat workflow.'
  }
];

const FeatureCard = ({ title, description }) => {
  return (
    <article className="surface-card feature-card">
      <div className="feature-card__icon-slot" aria-hidden="true" />
      <h4>{title}</h4>
      <p>{description}</p>
    </article>
  );
};

const Landing = () => {
  const previewRef = useRef(null);

  const scrollToPreview = () => {
    previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="app-shell landing-shell">
      <div className="browser-frame" aria-hidden="true">
        <div className="browser-frame__controls">
          <span>&lsaquo;</span>
          <span>&rsaquo;</span>
          <span>&#8635;</span>
          <span className="browser-frame__globe">&#9711;</span>
        </div>
        <div className="browser-frame__address">localhost:5173</div>
        <div className="browser-frame__status">
          <span className="browser-frame__signal" />
          <span className="browser-frame__signal browser-frame__signal--muted" />
        </div>
      </div>

      <header className="landing-header">
        <div className="brand-lockup landing-brand-lockup">
          <div className="brand-mark">OJ</div>
          <div className="landing-brand-copy">
            <div className="landing-brand-name">OPEN-NEW-JARVIS</div>
            <p>VOICE-POWERED WORKFLOWS, POLISHED FOR DESKTOP.</p>
          </div>
        </div>

        <nav className="utility-actions landing-nav">
          <button className="utility-link" onClick={scrollToPreview}>
            Preview
          </button>
          <a className="utility-link" href={electronBridge.releaseUrl} target="_blank" rel="noreferrer">
            Download
          </a>
          <a className="utility-link" href={electronBridge.repositoryUrl} target="_blank" rel="noreferrer">
            GitHub
          </a>
        </nav>
      </header>

      <main className="page landing-page">
        <section className="hero hero-centered">
          <div className="hero-copy hero-copy-centered">
            <h1 className="landing-hero-title">POWERED WORKFLOWS, POLISHED FOR DESKTOP.</h1>
            <p className="hero-text landing-hero-text">
              Download the desktop app to turn speech into safe, reviewable actions - or use this
              landing page as the polished website you deploy to Vercel.
            </p>

            <div className="hero-actions hero-actions-primary">
              <Link className="button primary hero-cta hero-cta-wide" to="/app">
                ENTER THE APP
              </Link>
              <a
                className="button secondary hero-cta-wide"
                href={electronBridge.releaseUrl}
                target="_blank"
                rel="noreferrer"
              >
                DOWNLOAD FOR DESKTOP
              </a>
            </div>

            <div className="hero-actions hero-actions-secondary">
              <button className="button secondary hero-cta-wide hero-cta-preview" onClick={scrollToPreview}>
                SEE PRODUCT PREVIEW
              </button>
            </div>
          </div>

          <div className="landing-hero-strip">
            <article className="surface-card landing-callout">
              <h3>A REAL PRODUCT, NOT A PROTOTYPE</h3>
              <p>
                Open-New-Jarvis pairs a polished marketing surface with a real desktop experience
                built for voice-first workflows and safe execution.
              </p>
            </article>
            <article className="surface-card landing-callout">
              <h3>WEBSITE AND APP NOW SEPARATED</h3>
              <p>
                Browser visitors stay on the landing page, while Electron opens directly into the
                actual app at <strong>/app</strong>.
              </p>
            </article>
          </div>
        </section>

        <section className="section-block">
          <div className="section-heading">
            <h2>What you get</h2>
            <p>
              The landing page keeps discovery and conversion clean, while the desktop app carries
              the actual workflow engine.
            </p>
          </div>

          <div className="feature-grid">
            {whatYouGet.map((feature) => (
              <FeatureCard
                key={feature.title}
                title={feature.title}
                description={feature.description}
              />
            ))}
          </div>
        </section>

        <section className="section-block">
          <div className="section-heading">
            <h2>Key features</h2>
            <p>The app remains safe and reviewable, and the website stays focused on the pitch.</p>
          </div>

          <div className="feature-grid">
            {keyFeatures.map((feature) => (
              <FeatureCard
                key={feature.title}
                title={feature.title}
                description={feature.description}
              />
            ))}
          </div>
        </section>

        <section ref={previewRef} className="section-block">
          <div className="section-heading">
            <h2>Product preview</h2>
            <p>See the split between the browser-facing landing experience and the actual desktop workspace.</p>
          </div>

          <div className="preview-grid">
            {previewCards.map((card) => (
              <article key={card.title} className="surface-card">
                <h4>{card.title}</h4>
                <p>{card.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="download" className="section-block">
          <article className="surface-card cta-banner">
            <div>
              <h2>Ready to try it?</h2>
              <p>
                Download Open-New-Jarvis for desktop to unlock the real workspace. Prefer to
                explore first? Open the product preview in your browser.
              </p>
            </div>
            <div className="hero-actions">
              <Link className="button primary hero-cta" to="/app">
                ENTER THE APP
              </Link>
              <a
                className="button secondary"
                href={electronBridge.releaseUrl}
                target="_blank"
                rel="noreferrer"
              >
                DOWNLOAD FOR DESKTOP
              </a>
            </div>
            <p className="landing-download-note">
              Direct download link: <a href={electronBridge.releaseUrl}>{electronBridge.releaseUrl}</a>
            </p>
          </article>
        </section>
      </main>

      <footer className="site-footer">
        Built for quick demos and real workflows. The web preview is Vercel-ready and the Electron
        app is optimized for power users who want voice-first automation with reviewable,
        repeatable command recipes.
      </footer>
    </div>
  );
};

export default Landing;
