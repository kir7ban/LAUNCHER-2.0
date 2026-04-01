import React, { useState, useRef, useEffect } from 'react';
import { useAgentContext } from '../context/AgentContext';
import BoschFooter from './BoschFooter';
import '../styles/LandingPage.css';

const FEATURES = [
  { icon: '🤖', title: 'Multi-Agent Orchestration', desc: 'One query, multiple agents collaborating to deliver comprehensive answers.' },
  { icon: '⚡', title: 'Real-Time Responses', desc: 'Average response under 1 second. See delegation in real time.' },
  { icon: '📎', title: 'File Attachments', desc: 'Upload documents, receipts, files. Agents extract what they need.' },
  { icon: '🔬', title: 'Workflow Automation', desc: 'Chain agents into automated workflows for multi-step processes.' },
  { icon: '🔒', title: 'Enterprise Security', desc: 'Governance compliance, access control, and audit trails.' },
  { icon: '🌓', title: 'Dark & Light Themes', desc: 'Full theme support. Easy on the eyes, day or night.' },
];

const USE_CASES = [
  {
    userMsg: 'Claim my internet reimbursement for March',
    agentMsg: '🌐 I\'ll process your March internet claim. Please upload your receipt.',
    title: 'Internet Reimbursement',
    desc: 'Submit claims in seconds with automated receipt validation',
  },
  {
    userMsg: 'Book a cab to office tomorrow 9 AM',
    agentMsg: '🚕 Booking confirmed! Cab arrives at 8:45 AM. Fare: ₹340',
    title: 'Cab Booking',
    desc: 'Smart route optimization and fare estimates',
  },
  {
    userMsg: 'What\'s on the canteen menu today?',
    agentMsg: '🍽️ Today: Paneer Butter Masala, Dal Fry, Jeera Rice, Gulab Jamun',
    title: 'Canteen Menu',
    desc: 'Check menus and pre-order meals instantly',
  },
];

export default function LandingPage({ onSendQuery }) {
  const { agents } = useAgentContext();
  const [heroInput, setHeroInput] = useState('');
  const agentsSectionRef = useRef(null);
  const fadeRefs = useRef([]);

  const handleHeroSend = () => {
    if (!heroInput.trim()) return;
    onSendQuery(heroInput.trim());
  };

  const handleHeroKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleHeroSend();
    }
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('lp-visible');
          }
        });
      },
      { threshold: 0.15 }
    );

    fadeRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const addFadeRef = (el) => {
    if (el && !fadeRefs.current.includes(el)) {
      fadeRefs.current.push(el);
    }
  };

  const scrollToAgents = () => {
    agentsSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="landing-page">
      {/* Hero */}
      <section className="lp-hero">
        <div className="lp-hero-inner">
          <h1 className="lp-hero-title">
            RBIN App <span>Launcher 2.0</span>
          </h1>
          <h1 className="lp-hero-title">
            AI agents <span>centralized.</span>
          </h1>
          <p className="lp-hero-subtitle">
            Seamlessly interact with multiple agents for all your task needs.
            Experience a unified workspace where intelligence is curated and
            collaboration is effortless.
          </p>
          {/* Big chatbox — replicates the new-chat input */}
          <div className="lp-chatbox">
            <div className="lp-chatbox-container">
              <textarea
                value={heroInput}
                onChange={(e) => setHeroInput(e.target.value)}
                onKeyDown={handleHeroKeyDown}
                placeholder="Send a message to the Orchestrator..."
                rows={1}
              />
              <div className="lp-chatbox-toolbar">
                <button
                  className="lp-chatbox-send"
                  onClick={handleHeroSend}
                  disabled={!heroInput.trim()}
                  aria-label="Send"
                >
                  <span>➤</span>
                </button>
              </div>
            </div>
          </div>
          <div className="lp-hero-buttons">
            <button className="lp-btn-outline" onClick={scrollToAgents}>
              Learn More ↓
            </button>
          </div>
        </div>
      </section>

      {/* Agent Showcase */}
      <section
        className="lp-agents lp-fade-section"
        ref={(el) => { agentsSectionRef.current = el; addFadeRef(el); }}
      >
        <div className="lp-section">
          <h2 className="lp-section-title">Meet Your Agents</h2>
          <p className="lp-section-subtitle">
            {agents.length} specialized agents working together through one
            intelligent orchestrator
          </p>
          <div className="lp-agents-grid">
            {agents.map((agent) => (
              <div className="lp-agent-card" key={agent.id}>
                <div className="lp-agent-icon">{agent.icon}</div>
                <div className="lp-agent-name">{agent.name}</div>
                <div className="lp-agent-desc">{agent.description.split(',')[0]}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Key Features */}
      <section className="lp-fade-section" ref={addFadeRef}>
        <div className="lp-section">
          <h2 className="lp-section-title">Powerful Capabilities</h2>
          <p className="lp-section-subtitle">
            Built for enterprise, designed for simplicity
          </p>
          <div className="lp-features-grid">
            {FEATURES.map((f) => (
              <div className="lp-feature-card" key={f.title}>
                <div className="lp-feature-icon">{f.icon}</div>
                <div>
                  <div className="lp-feature-title">{f.title}</div>
                  <div className="lp-feature-desc">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="lp-usecases lp-fade-section" ref={addFadeRef}>
        <div className="lp-section">
          <h2 className="lp-section-title">See It In Action</h2>
          <p className="lp-section-subtitle">
            Real conversations, real results
          </p>
          <div className="lp-usecases-grid">
            {USE_CASES.map((uc) => (
              <div className="lp-usecase-card" key={uc.title}>
                <div className="lp-chat-preview">
                  <div className="lp-chat-bubble user">{uc.userMsg}</div>
                  <div className="lp-chat-bubble agent">{uc.agentMsg}</div>
                </div>
                <div className="lp-usecase-title">{uc.title}</div>
                <div className="lp-usecase-desc">{uc.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="lp-cta lp-fade-section" ref={addFadeRef}>
        <h2 className="lp-cta-title">Ready to get started?</h2>
        <p className="lp-cta-subtitle">
          Experience the power of intelligent agent orchestration
        </p>
        <button className="lp-btn-primary" onClick={() => {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}>
          Try it now ↑
        </button>
      </section>

      <BoschFooter />
    </div>
  );
}
