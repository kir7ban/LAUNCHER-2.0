import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { useAgentContext } from '../context/AgentContext';
import TypingIndicator from './TypingIndicator';
import ChatWelcomeBackground from './ChatWelcomeBackground';
import '../styles/ChatPanel.css';

function StreamingText({ text, speed = 10 }) {
  const [displayed, setDisplayed] = useState('');
  const prefersReduced = useRef(window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  useEffect(() => {
    if (prefersReduced.current) {
      setDisplayed(text);
      return;
    }
    let i = 0;
    setDisplayed('');
    const timer = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(timer);
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed]);

  return <ReactMarkdown>{displayed}</ReactMarkdown>;
}

export default function ChatPanel({ fresh = false, onFreshSubmit }) {
  const ctx = useAgentContext();
  const [localMessages, setLocalMessages] = useState([]);

  // In fresh mode use isolated local state; otherwise use shared context
  const messages = fresh ? localMessages : ctx.messages;
  const sendMessage = fresh
    ? (content) => {
        if (onFreshSubmit) {
          onFreshSubmit(content);
        } else {
          const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const userMsg = { id: localMessages.length + 1, role: 'user', content, timestamp: ts };
          setLocalMessages((prev) => [...prev, userMsg]);
        }
      }
    : ctx.sendMessage;

  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Consume pending message from context
  const pendingMessage = !fresh ? ctx.pendingMessage : null;
  const setPendingMessage = !fresh ? ctx.setPendingMessage : null;

  useEffect(() => {
    if (!fresh && pendingMessage) {
      ctx.sendMessage(pendingMessage);
      setPendingMessage(null);
    }
  }, [pendingMessage]);

  const handleSend = () => {
    if (!input.trim() && attachments.length === 0) return;
    const content = attachments.length > 0
      ? `${input.trim()}\n\n📎 ${attachments.map(f => f.name).join(', ')}`
      : input.trim();
    sendMessage(content);
    setInput('');
    setAttachments([]);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      setAttachments((prev) => [...prev, ...files]);
    }
    e.target.value = '';
  };

  const removeAttachment = (index) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleVoiceInput = () => {
    if (isRecording) {
      setIsRecording(false);
      setInput((prev) => prev + (prev ? ' ' : '') + 'Voice input transcribed...');
    } else {
      setIsRecording(true);
    }
  };

  const handleToolAction = (tool) => {
    switch (tool) {
      case 'onedrive':
        alert('OneDrive picker would open here — connect via Microsoft Graph API');
        break;
      case 'sharepoint':
        alert('SharePoint document library browser would open here');
        break;
      case 'camera':
        fileInputRef.current.setAttribute('capture', 'environment');
        fileInputRef.current.setAttribute('accept', 'image/*');
        fileInputRef.current.click();
        break;
      case 'screenshot':
        alert('Screen capture would start here — use navigator.mediaDevices.getDisplayMedia()');
        break;
      default:
        break;
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <div className={`chat-panel${isEmpty ? ' chat-panel--has-bg chat-panel--empty' : ''}`}>
      {isEmpty && <ChatWelcomeBackground />}
      <div className="messages-area">
        {isEmpty && (
          <div className="chat-welcome">
            <div className="chat-welcome-content">
              <h2 className="chat-welcome-title">This is <span className="genie-brand">RBIN Launcher 2.0</span></h2>
              <p className="chat-welcome-sub">AI agents centralized.</p>
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`message message-${msg.role}`}>
            {msg.role === 'typing' && (
              <TypingIndicator agentName={msg.agentName} agentIcon={msg.agentIcon} />
            )}

            {msg.role === 'user' && (
              <div className="message-bubble user-bubble">
                <div className="message-content">{msg.content}</div>
                <span className="message-time">{msg.timestamp}</span>
              </div>
            )}

            {msg.role === 'orchestrator' && (
              <div className="message-bubble orchestrator-bubble">
                <div className="message-header">
                  <span className="agent-badge orchestrator">🎯 Orchestrator</span>
                  <span className="message-time">{msg.timestamp}</span>
                </div>
                <div className="message-content"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
                {msg.delegations && (
                  <div className="delegation-list">
                    <div className="delegation-title">Task Delegations:</div>
                    {msg.delegations.map((d, i) => (
                      <div key={i} className={`delegation-item delegation-${d.status}`}>
                        <span className="delegation-status-icon">
                          {d.status === 'completed' && (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          )}
                          {d.status === 'in-progress' && (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-secondary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                          )}
                          {d.status === 'pending' && (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/></svg>
                          )}
                        </span>
                        <span className="delegation-agent">{d.agent}</span>
                        <span className="delegation-task">{d.task}</span>
                        <span className={`delegation-status ${d.status}`}>{d.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {msg.role === 'agent' && (
              <div className="message-bubble agent-bubble">
                <div className="message-header">
                  <span className="agent-badge agent">
                    {msg.agentIcon} {msg.agentName}
                  </span>
                  <span className="message-time">{msg.timestamp}</span>
                </div>
                <div className="message-content"><StreamingText text={msg.content} /></div>
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-area">
        {/* Template prompts */}
        {messages.length === 0 && (
          <div className="template-suggestions">
            {[
              { icon: '🌐', text: 'Claim my internet reimbursement for March' },
              { icon: '🍽️', text: 'What is lunch menu for today?' },
              { icon: '🎫', text: 'Want to Raise a Ticket?' },
            ].map((prompt, idx) => (
              <button
                key={idx}
                className="suggestion-chip"
                onClick={() => sendMessage(prompt.text)}
              >
                <span className="suggestion-icon">{prompt.icon}</span>
                {prompt.text}
              </button>
            ))}
          </div>
        )}

        {/* Attachment preview strip */}
        {attachments.length > 0 && (
          <div className="attachments-strip">
            {attachments.map((file, idx) => (
              <div key={idx} className="attachment-badge">
                <span className="attachment-icon">
                  {file.type?.startsWith('image/') ? '🖼️' : '📄'}
                </span>
                <span className="attachment-name">{file.name}</span>
                <button className="attachment-remove" onClick={() => removeAttachment(idx)}>×</button>
              </div>
            ))}
          </div>
        )}

        <div className="input-container">
          {/* Hidden file input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            multiple
            style={{ display: 'none' }}
          />

          {/* Text area */}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Send a message to the Orchestrator..."
            rows={1}
          />

          {/* Right toolbar (voice + send) inside the box */}
          <div className="input-toolbar input-toolbar-right">
            <button
              className={`toolbar-btn voice-btn ${isRecording ? 'recording' : ''}`}
              title={isRecording ? 'Stop recording' : 'Voice input'}
              onClick={handleVoiceInput}
            >
              {isRecording ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
                </svg>
              )}
            </button>
            <button className="send-btn" onClick={handleSend} disabled={!input.trim() && attachments.length === 0}>
              <span>➤</span>
            </button>
          </div>
        </div>

        {/* Bottom toolbar (attach + integrations) below the box */}
        <div className="input-bottom-toolbar">
          <button
            className="toolbar-btn"
            title="Attach file"
            onClick={() => { fileInputRef.current.removeAttribute('capture'); fileInputRef.current.setAttribute('accept', '*/*'); fileInputRef.current.click(); }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
            </svg>
            <span>Attach</span>
          </button>

          <button className="toolbar-btn" title="OneDrive" onClick={() => handleToolAction('onedrive')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M10.5 18.5l-1.12-1.93A4.46 4.46 0 016 12.5a4.49 4.49 0 014.5-4.5c1.63 0 3.06.87 3.85 2.17l.15.26.3-.04A3.49 3.49 0 0118.5 14a3.49 3.49 0 01-1.08 2.53L10.5 18.5zM10.5 9.5a3 3 0 00-3 3c0 1.1.6 2.1 1.54 2.63l.29.17.87 1.49 5.39-1.54A2 2 0 0016.5 14a2 2 0 00-2-2h-.73l-.35-.87A3 3 0 0010.5 9.5z"/></svg>
            <span>OneDrive</span>
          </button>

          <button className="toolbar-btn" title="SharePoint" onClick={() => handleToolAction('sharepoint')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
            <span>SharePoint</span>
          </button>

          <button className="toolbar-btn" title="Camera" onClick={() => handleToolAction('camera')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
            <span>Camera</span>
          </button>

          <button className="toolbar-btn" title="Screenshot" onClick={() => handleToolAction('screenshot')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            <span>Screenshot</span>
          </button>
        </div>

        <div className="input-hint">
          Press <kbd>Enter</kbd> to send · <kbd>Shift+Enter</kbd> for new line · Attach files or use tools via the toolbar
        </div>
      </div>
    </div>
  );
}
