import React, { useState } from 'react';
import { useAgentContext } from '../context/AgentContext';
import '../styles/AgentDetailModal.css';

export default function AgentDetailModal({ agent, onClose, onNavigateToChat }) {
  const { setAgents } = useAgentContext();
  const [showAllLogs, setShowAllLogs] = useState(false);

  if (!agent) return null;

  const handleSendTask = () => {
    onClose();
    if (onNavigateToChat) onNavigateToChat(agent.name);
  };

  const handleToggleStatus = () => {
    setAgents(prev => prev.map(a =>
      a.id === agent.id
        ? { ...a, status: a.status === 'active' ? 'idle' : 'active' }
        : a
    ));
  };

  const generateMockLogs = () => {
    const types = ['info', 'success', 'warning', 'error'];
    const messages = [
      'Processing incoming request',
      'Task completed successfully',
      'Response time exceeded threshold',
      'Connection retry attempt',
      'Data validation passed',
      'Cache refreshed',
      'Scheduled maintenance check',
      'User session authenticated',
      'Report generated and sent',
      'Configuration updated',
      'Health check passed',
      'Queue processing complete',
      'Rate limit warning',
      'Backup completed',
      'API response cached',
    ];
    return messages.map((msg, i) => ({
      time: `${String(9 + Math.floor(i / 4)).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}:00`,
      message: msg,
      type: types[i % types.length],
    }));
  };

  const displayedLogs = showAllLogs ? generateMockLogs() : agent.logs;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>

        <div className="modal-header">
          <span className="modal-agent-icon">{agent.icon}</span>
          <div className="modal-agent-info">
            <h2>{agent.name}</h2>
            <span className={`status-badge ${agent.status}`}>{agent.status}</span>
          </div>
        </div>

        <p className="modal-description">{agent.description}</p>

        <div className="modal-section">
          <h3>Model</h3>
          <div className="model-badge">{agent.model}</div>
        </div>

        <div className="modal-section">
          <h3>Performance</h3>
          <div className="modal-stats">
            <div className="modal-stat">
              <span className="modal-stat-value">{agent.tasksCompleted}</span>
              <span className="modal-stat-label">Tasks Completed</span>
            </div>
            <div className="modal-stat">
              <span className="modal-stat-value">{agent.avgResponseTime}</span>
              <span className="modal-stat-label">Avg Response Time</span>
            </div>
            <div className="modal-stat">
              <span className="modal-stat-value">{agent.successRate}</span>
              <span className="modal-stat-label">Success Rate</span>
            </div>
          </div>
        </div>

        <div className="modal-section">
          <h3>Capabilities</h3>
          <div className="capabilities-list">
            {agent.capabilities.map((cap, i) => (
              <span key={i} className="capability-chip">{cap}</span>
            ))}
          </div>
        </div>

        <div className="modal-section">
          <h3>{showAllLogs ? 'Full Logs' : 'Recent Activity'}</h3>
          <div className="logs-list">
            {displayedLogs.map((log, i) => (
              <div key={i} className={`log-entry log-${log.type}`}>
                <span className="log-time">{log.time}</span>
                <span className="log-message">{log.message}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn-primary" onClick={handleSendTask}>Send Task</button>
          <button className="btn-outline" onClick={() => setShowAllLogs(!showAllLogs)}>
            {showAllLogs ? 'Show Recent' : 'View Full Logs'}
          </button>
          {agent.status === 'active' ? (
            <button className="btn-danger" onClick={handleToggleStatus}>Pause Agent</button>
          ) : (
            <button className="btn-success" onClick={handleToggleStatus}>Activate Agent</button>
          )}
        </div>
      </div>
    </div>
  );
}
