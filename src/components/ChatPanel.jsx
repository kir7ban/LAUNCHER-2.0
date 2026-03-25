import React, { useState, useRef, useEffect } from 'react';
import { useAgentContext } from '../context/AgentContext';
import '../styles/ChatPanel.css';

export default function ChatPanel({ fresh = false }) {
  const ctx = useAgentContext();
  const [localMessages, setLocalMessages] = useState([]);

  // In fresh mode use isolated local state; otherwise use shared context
  const messages = fresh ? localMessages : ctx.messages;
  const sendMessage = fresh
    ? (content) => {
        const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const userMsg = { id: localMessages.length + 1, role: 'user', content, timestamp: ts };
        setLocalMessages((prev) => [...prev, userMsg]);
        setTimeout(() => {
          setLocalMessages((prev) => [
            ...prev,
            {
              id: prev.length + 1,
              role: 'orchestrator',
              content: `Got it! I'm analyzing your request and routing it to the right agents...\n\nI'll delegate this to the **Triage Process** agent for classification and the appropriate service agent for resolution.`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              agentId: 'orchestrator',
              delegations: [
                { agent: 'Triage Process', task: 'Classify & route request', status: 'in-progress' },
                { agent: 'Facility & IT Support', task: 'Process service request', status: 'pending' },
              ],
            },
          ]);
        }, 800);
        setTimeout(() => {
          setLocalMessages((prev) => [
            ...prev,
            {
              id: prev.length + 1,
              role: 'agent',
              content: `I've classified your request and routed it to the appropriate agent. The task has been assigned and is being processed.\n\nYou'll receive a confirmation shortly with the reference number and expected resolution time.`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              agentId: 'triage-process',
              agentName: 'Triage Process',
              agentIcon: '🔀',
            },
          ]);
        }, 2500);
      }
    : ctx.sendMessage;

  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const toolsMenuRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Close tools menu on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (toolsMenuRef.current && !toolsMenuRef.current.contains(e.target)) {
        setShowToolsMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
      // Simulate voice transcription
      setInput((prev) => prev + (prev ? ' ' : '') + 'Voice input transcribed...');
    } else {
      setIsRecording(true);
      // In production, start Web Speech API / MediaRecorder
    }
  };

  const handleToolAction = (tool) => {
    setShowToolsMenu(false);
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

  return (
    <div className="chat-panel">
      <div className="messages-area">
        {messages.map((msg) => (
          <div key={msg.id} className={`message message-${msg.role}`}>
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
                <div className="message-content">{renderMarkdown(msg.content)}</div>
                {msg.delegations && (
                  <div className="delegation-list">
                    <div className="delegation-title">Task Delegations:</div>
                    {msg.delegations.map((d, i) => (
                      <div key={i} className={`delegation-item delegation-${d.status}`}>
                        <span className="delegation-status-icon">
                          {d.status === 'completed' && '✅'}
                          {d.status === 'in-progress' && '⏳'}
                          {d.status === 'pending' && '⏸️'}
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
                <div className="message-content">{renderMarkdown(msg.content)}</div>
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

          {/* Left toolbar */}
          <div className="input-toolbar input-toolbar-left">
            <button
              className="toolbar-btn"
              title="Attach file"
              onClick={() => { fileInputRef.current.removeAttribute('capture'); fileInputRef.current.setAttribute('accept', '*/*'); fileInputRef.current.click(); }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
              </svg>
            </button>

            <div className="tools-menu-wrapper" ref={toolsMenuRef}>
              <button
                className={`toolbar-btn ${showToolsMenu ? 'active' : ''}`}
                title="Tools & integrations"
                onClick={() => setShowToolsMenu(!showToolsMenu)}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="1" /><circle cx="12" cy="5" r="1" /><circle cx="12" cy="19" r="1" />
                </svg>
              </button>

              {showToolsMenu && (
                <div className="tools-dropdown">
                  <div className="tools-dropdown-header">Integrations</div>
                  <button className="tools-dropdown-item" onClick={() => handleToolAction('onedrive')}>
                    <span className="tools-item-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M10.5 18.5l-1.12-1.93A4.46 4.46 0 016 12.5a4.49 4.49 0 014.5-4.5c1.63 0 3.06.87 3.85 2.17l.15.26.3-.04A3.49 3.49 0 0118.5 14a3.49 3.49 0 01-1.08 2.53L10.5 18.5zM10.5 9.5a3 3 0 00-3 3c0 1.1.6 2.1 1.54 2.63l.29.17.87 1.49 5.39-1.54A2 2 0 0016.5 14a2 2 0 00-2-2h-.73l-.35-.87A3 3 0 0010.5 9.5z"/></svg>
                    </span>
                    <div className="tools-item-info">
                      <span className="tools-item-name">OneDrive</span>
                      <span className="tools-item-desc">Browse & attach from OneDrive</span>
                    </div>
                  </button>
                  <button className="tools-dropdown-item" onClick={() => handleToolAction('sharepoint')}>
                    <span className="tools-item-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
                    </span>
                    <div className="tools-item-info">
                      <span className="tools-item-name">SharePoint</span>
                      <span className="tools-item-desc">Browse SharePoint documents</span>
                    </div>
                  </button>
                  <button className="tools-dropdown-item" onClick={() => handleToolAction('camera')}>
                    <span className="tools-item-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                    </span>
                    <div className="tools-item-info">
                      <span className="tools-item-name">Camera</span>
                      <span className="tools-item-desc">Take a photo to attach</span>
                    </div>
                  </button>
                  <button className="tools-dropdown-item" onClick={() => handleToolAction('screenshot')}>
                    <span className="tools-item-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                    </span>
                    <div className="tools-item-info">
                      <span className="tools-item-name">Screenshot</span>
                      <span className="tools-item-desc">Capture & share your screen</span>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Text area */}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Send a message to the Orchestrator..."
            rows={1}
          />

          {/* Right toolbar */}
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
        <div className="input-hint">
          Press <kbd>Enter</kbd> to send · <kbd>Shift+Enter</kbd> for new line · Attach files or use tools via the toolbar
        </div>
      </div>
    </div>
  );
}

function renderMarkdown(text) {
  // Simple markdown rendering
  const lines = text.split('\n');
  return lines.map((line, i) => {
    // Bold
    line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Bullet points
    if (line.startsWith('- ')) {
      return (
        <div key={i} className="md-list-item" dangerouslySetInnerHTML={{ __html: '• ' + line.slice(2) }} />
      );
    }
    // Numbered list
    if (/^\d+\.\s/.test(line)) {
      return <div key={i} className="md-list-item" dangerouslySetInnerHTML={{ __html: line }} />;
    }
    if (line === '') return <br key={i} />;
    return <div key={i} dangerouslySetInnerHTML={{ __html: line }} />;
  });
}
