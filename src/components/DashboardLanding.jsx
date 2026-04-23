import React from 'react';
import { useAgentContext } from '../context/AgentContext';
import ChatPanel from './ChatPanel';
import '../styles/DashboardLanding.css';

export default function DashboardLanding({ onNavigate, onSelectAgent }) {
  const { agents, conversations, createConversation, setPendingMessage } = useAgentContext();

  const handleFreshSubmit = (content) => {
    createConversation(content.length > 40 ? content.substring(0, content.lastIndexOf(' ', 40)) + '...' : content);
    setPendingMessage(content);
    onNavigate('chat');
  };

  return (
    <div className="dashboard-landing">
      {/* Compact Chat Widget */}
      <section className="dl-chat-section">
        <ChatPanel fresh onFreshSubmit={handleFreshSubmit} />
      </section>
    </div>
  );
}
