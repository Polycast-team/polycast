import React from 'react';
import { Link } from 'react-router-dom';
import './LandingPage.css';

function LandingPage() {
  return (
    <div className="landing-root">
      <header className="landing-header">
        <div className="landing-logo">Polycast</div>
        <nav className="landing-nav">
          <Link className="landing-link" to="/login">Login</Link>
          <Link className="landing-cta" to="/register">Create Account</Link>
        </nav>
      </header>

      <main className="landing-main">
        <section className="landing-hero">
          <h1>Language classrooms that listen in real time.</h1>
          <p>
            Polycast helps teachers and learners connect through live transcription, AI flashcards, and
            realtime voice feedback. Focus on teaching — we handle the translation.
          </p>
          <div className="landing-actions">
            <Link className="landing-primary" to="/register">Get Started</Link>
            <Link className="landing-secondary" to="/login">I already have an account</Link>
          </div>
        </section>

        <section className="landing-showcase">
          <div className="landing-card">
            <h3>Realtime Understanding</h3>
            <p>Stream speech, transcripts, and translations instantly so every learner keeps up.</p>
          </div>
          <div className="landing-card">
            <h3>Adaptive Study</h3>
            <p>Generate flashcards and review sessions automatically from live lessons.</p>
          </div>
          <div className="landing-card">
            <h3>Voice-first AI</h3>
            <p>Hold natural conversations powered by GPT realtime with transcripts you can trust.</p>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <span>© {new Date().getFullYear()} Polycast</span>
        <span className="landing-footer-note">Built for teachers, learners, and polyglots everywhere.</span>
      </footer>
    </div>
  );
}

export default LandingPage;
