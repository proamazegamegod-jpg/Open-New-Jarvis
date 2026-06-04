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
            <h1>Voice-powered workflows, polished for desktop.</h1>
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
          {electronBridge.isDesktop && (
            <Link className="utility-link" to="/app">
              Open app
            </Link>
          )}
        </nav>
      </header>

      <main className="page">
        <section className="hero">
          <div className="hero-copy">
            <span className="pill">Marketing website</span>
            <h2>VOICE-POWERED WORKFLOWS, POLISHED FOR DESKTOP.</h2>
            <p className="hero-text">
              Download the desktop app to turn speech into safe, reviewable actions - or use this
              landing page as the polished website you deploy to Vercel.
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
              {electronBridge.isDesktop && (
                <Link className="button secondary" to="/app">
                  Open desktop app
                </Link>
              )}
            </div>

            <p className="mode-description">
              Separate routes now keep the website focused on marketing while Electron opens the
              actual workspace at <strong>/app</strong>.
            </p>
            <div className="hero-progress" aria-hidden="true" />

            <div className="stats-grid">
              <div className="stat-card">
                <strong>2</strong>
                <span>Separate experiences</span>
              </div>
              <div className="stat-card">
                <strong>/</strong>
                <span>Landing route</span>
              </div>
              <div className="stat-card">
                <strong>/app</strong>
                <span>Desktop route</span>
              </div>
            </div>
          </div>

          <aside className="hero-panel">
            <div className="hero-panel-header">
              <span>A real product, not a prototype</span>
              <span>Website and app now separated</span>
            </div>
            <p className="hero-note">
              The landing page remains the browser-facing marketing surface. The actual desktop
              app UI lives on its own route and no longer shares the same screen as the website.
            </p>
            <ul className="hero-checklist">
              <li>Vercel serves the marketing route at /</li>
              <li>Electron opens the actual desktop workspace</li>
              <li>Routing stays minimal and scalable with react-router-dom</li>
            </ul>
          </aside>
        </section>

        <section className="section-block">
          <div className="section-heading">
            <span className="eyebrow">What you get</span>
            <h3>SEPARATE THE SITE FROM THE PRODUCT.</h3>
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
            <span className="eyebrow">Key features</span>
            <h3>ONE CODEBASE, TWO CLEAR EXPERIENCES.</h3>
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
            <span className="eyebrow">Preview</span>
            <h3>MARKETING WEBSITE VS DESKTOP WORKSPACE.</h3>
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
              <span className="eyebrow">Download CTA</span>
              <h3>READY TO TRY IT?</h3>
              <p>
                Download Open-New-Jarvis for desktop to unlock the real workspace. Keep the
                landing page for conversion, branding, and preview content.
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
              {electronBridge.isDesktop && (
                <Link className="button secondary" to="/app">
                  Open desktop app
                </Link>
              )}
            </div>
          </article>
        </section>
      </main>

      <footer className="site-footer">
        Website route: <strong>/</strong>. Desktop workspace route: <strong>/app</strong>. Vercel
        can host the landing page while Electron boots directly into the real product UI.
      </footer>
    </div>
  );
};

export default Landing;
