import React from 'react';
import '../styles/AgentDetailModal.css';

export default function AgentDetailModal({ agent, onClose }) {
  if (!agent) return null;

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
          <h3>Recent Activity</h3>
          <div className="logs-list">
            {agent.logs.map((log, i) => (
              <div key={i} className={`log-entry log-${log.type}`}>
                <span className="log-time">{log.time}</span>
                <span className="log-message">{log.message}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn-primary">Send Task</button>
          <button className="btn-outline">View Full Logs</button>
          {agent.status === 'active' ? (
            <button className="btn-danger">Pause Agent</button>
          ) : (
            <button className="btn-success">Activate Agent</button>
          )}
        </div>
      </div>
    </div>
  );
}
