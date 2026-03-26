import React from 'react';
import { useAgentContext } from '../context/AgentContext';
import { FiUsers, FiCheckCircle, FiClock, FiGitMerge } from 'react-icons/fi';
import ChatPanel from './ChatPanel';
import '../styles/DashboardLanding.css';

export default function DashboardLanding({ onNavigate, onSelectAgent }) {
  const { agents, conversations, workflows, createConversation, setPendingMessage } = useAgentContext();
  const activeAgents = agents.filter(a => a.status === 'active').length;
  const totalTasks = agents.reduce((sum, a) => sum + a.tasksCompleted, 0);
  const avgTime = (agents.reduce((sum, a) => sum + parseFloat(a.avgResponseTime), 0) / agents.length).toFixed(1) + 's';
  const activeWorkflows = workflows.filter(w => w.status === 'active').length;

  // Aggregate recent activity from agent logs
  const recentActivity = agents
    .flatMap(a => a.logs.map(log => ({ ...log, agentName: a.name, agentIcon: a.icon, agentId: a.id })))
    .sort((a, b) => b.time.localeCompare(a.time))
    .slice(0, 6);

  const quickActions = [
    { icon: '🌐', text: 'Claim my internet reimbursement for March' },
    { icon: '🍽️', text: "What is lunch menu for today?" },
    { icon: '🎫', text: 'Want to Raise a Ticket?' },
  ];

  const handleQuickAction = (text) => {
    createConversation(text.length > 40 ? text.substring(0, text.lastIndexOf(' ', 40)) + '...' : text);
    setPendingMessage(text);
    onNavigate('chat');
  };

  const handleFreshSubmit = (content) => {
    createConversation(content.length > 40 ? content.substring(0, content.lastIndexOf(' ', 40)) + '...' : content);
    setPendingMessage(content);
    onNavigate('chat');
  };

  return (
    <div className="dashboard-landing">
      {/* Welcome Banner */}
      <div className="dl-welcome-banner">
        <h1 className="dl-welcome-title">Welcome back to <span className="genie-brand">BDO Genie</span></h1>
        <p className="dl-welcome-sub">{activeAgents} agents active, {conversations.length} recent conversations</p>
      </div>

      {/* Stats Row */}
      <div className="dl-kpis">
        <div className="dl-kpi-card">
          <div className="dl-kpi-icon dl-kpi-icon--agents"><FiUsers size={20} /></div>
          <div className="dl-kpi-data">
            <span className="dl-kpi-value">{activeAgents}/{agents.length}</span>
            <span className="dl-kpi-label">Agents Active</span>
          </div>
        </div>
        <div className="dl-kpi-card">
          <div className="dl-kpi-icon dl-kpi-icon--tasks"><FiCheckCircle size={20} /></div>
          <div className="dl-kpi-data">
            <span className="dl-kpi-value">{totalTasks.toLocaleString()}</span>
            <span className="dl-kpi-label">Tasks Completed</span>
          </div>
        </div>
        <div className="dl-kpi-card">
          <div className="dl-kpi-icon dl-kpi-icon--active"><FiClock size={20} /></div>
          <div className="dl-kpi-data">
            <span className="dl-kpi-value">{avgTime}</span>
            <span className="dl-kpi-label">Avg Response Time</span>
          </div>
        </div>
        <div className="dl-kpi-card">
          <div className="dl-kpi-icon dl-kpi-icon--success"><FiGitMerge size={20} /></div>
          <div className="dl-kpi-data">
            <span className="dl-kpi-value">{activeWorkflows}</span>
            <span className="dl-kpi-label">Active Workflows</span>
          </div>
        </div>
      </div>

      {/* Activity + Quick Actions row */}
      <div className="dl-columns">
        <div>
          <div className="dl-section__header">
            <h2 className="dl-section__title">Recent Activity</h2>
          </div>
          <div className="dl-activity-list">
            {recentActivity.map((item, i) => (
              <div key={i} className="dl-activity-item" onClick={() => {
                const agent = agents.find(a => a.id === item.agentId);
                if (agent && onSelectAgent) onSelectAgent(agent);
              }} style={{ cursor: 'pointer' }}>
                <span className="dl-activity-item__icon">{item.agentIcon}</span>
                <div className="dl-activity-item__content">
                  <span className="dl-activity-item__agent">{item.agentName}</span>
                  <span className="dl-activity-item__action">{item.message}</span>
                </div>
                <div className={`dl-activity-item__dot dl-activity-item__dot--${item.type}`} />
                <span className="dl-activity-item__time">{item.time}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="dl-section__header">
            <h2 className="dl-section__title">Quick Actions</h2>
          </div>
          <div className="dl-quick-actions">
            {quickActions.map((action, i) => (
              <button key={i} className="dl-quick-action" onClick={() => handleQuickAction(action.text)}>
                <span className="dl-quick-action__icon">{action.icon}</span>
                <span className="dl-quick-action__label">{action.text}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Compact Chat Widget */}
      <section className="dl-chat-section">
        <ChatPanel fresh onFreshSubmit={handleFreshSubmit} />
      </section>
    </div>
  );
}
