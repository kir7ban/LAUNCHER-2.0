import React from 'react';
import { useAgentContext } from '../context/AgentContext';
import '../styles/AgentPanel.css';

export default function AgentPanel({ onSelectAgent }) {
  const { agents } = useAgentContext();

  return (
    <div className="agent-panel">
      <div className="agent-panel-header">
        <h3>Active Agents</h3>
        <span className="agent-count">{agents.filter((a) => a.status === 'active').length} / {agents.length}</span>
      </div>
      <div className="agent-list">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className={`agent-card status-${agent.status}`}
            onClick={() => onSelectAgent(agent)}
          >
            <div className="agent-card-header">
              <span className="agent-icon">{agent.icon}</span>
              <div className="agent-info">
                <span className="agent-name">{agent.name}</span>
                <span className={`agent-status ${agent.status}`}>{agent.status}</span>
              </div>
            </div>
            <div className="agent-card-body">
              <div className="agent-stat">
                <span className="stat-num">{agent.tasksCompleted}</span>
                <span className="stat-desc">tasks</span>
              </div>
              <div className="agent-stat">
                <span className="stat-num">{agent.avgResponseTime}</span>
                <span className="stat-desc">avg time</span>
              </div>
              <div className="agent-stat">
                <span className="stat-num">{agent.successRate}</span>
                <span className="stat-desc">success</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
