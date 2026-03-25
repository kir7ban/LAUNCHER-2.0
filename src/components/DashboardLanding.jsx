import React from 'react';
import { useAgentContext } from '../context/AgentContext';
import ChatPanel from './ChatPanel';
import '../styles/DashboardLanding.css';

export default function DashboardLanding({ onNavigate }) {
  const { agents } = useAgentContext();

  const activeAgents = agents.filter((a) => a.status === 'active').length;

  return (
    <div className="dashboard-landing">
      {/* ── Embedded Chat ── */}
      <section className="dl-chat-section">
        <ChatPanel fresh />
      </section>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  return 'Evening';
}
