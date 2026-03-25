import React from 'react';
import { useAgentContext } from '../context/AgentContext';
import '../styles/DashboardHeader.css';

export default function DashboardHeader({ activeView }) {
  const { agents } = useAgentContext();
  const activeCount = agents.filter((a) => a.status === 'active').length;

  const titles = {
    dashboard: 'Dashboard',
    chat: 'Orchestrator Chat',
    agents: 'Agent Management',
    workflows: 'Workflow Orchestrations',
  };

  return (
    <header className="dashboard-header">
      <div className="header-left">
        <h1 className="header-title">{titles[activeView] || 'Dashboard'}</h1>
        <div className="header-status">
          <span className="status-dot active" />
          <span>{activeCount} agents active</span>
        </div>
      </div>
      <div className="header-right">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input type="text" placeholder="Search agents, conversations..." />
        </div>
        <button className="btn-icon notification-btn" title="Notifications">
          🔔
          <span className="notification-badge">3</span>
        </button>
        <div className="user-avatar" title="User Profile">
          <span>U</span>
        </div>
      </div>
    </header>
  );
}
