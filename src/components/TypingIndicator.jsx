import React from 'react';
import '../styles/TypingIndicator.css';

export default function TypingIndicator({ agentName, agentIcon }) {
  return (
    <div className="typing-indicator-wrapper">
      <div className="typing-indicator-bubble">
        <div className="typing-indicator-header">
          <span className="typing-indicator-icon">{agentIcon}</span>
          <span className="typing-indicator-name">{agentName}</span>
        </div>
        <div className="typing-dots">
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="typing-dot" />
        </div>
      </div>
    </div>
  );
}
