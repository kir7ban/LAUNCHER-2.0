import React from 'react';
import '../styles/DashboardHeader.css';

export default function DashboardHeader({ activeView }) {
  const titles = {
    dashboard: 'Dashboard',
    chat: '',
    agents: 'Agent Management',
    workflows: 'Workflow Orchestrations',
  };

  return (
    <header className="dashboard-header">
      <div className="header-left">
        <h1 className="header-title">{titles[activeView] || ''}</h1>
      </div>
      <div className="header-right">
      </div>
    </header>
  );
}
