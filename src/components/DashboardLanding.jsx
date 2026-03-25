import React from 'react';
import ChatPanel from './ChatPanel';
import '../styles/DashboardLanding.css';

export default function DashboardLanding({ onNavigate }) {
  return (
    <div className="dashboard-landing">
      <section className="dl-chat-section">
        <ChatPanel fresh />
      </section>
    </div>
  );
}
