import React, { useState } from 'react';
import { FiSearch } from 'react-icons/fi';
import { useAgentContext } from '../context/AgentContext';
import '../styles/AgentPanel.css';

export default function AgentPanel({ onSelectAgent }) {
  const { agents } = useAgentContext();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const filtered = agents.filter(a => {
    if (filter !== 'all' && a.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return a.name.toLowerCase().includes(q) || a.capabilities.some(c => c.toLowerCase().includes(q));
    }
    return true;
  });

  const filters = [
    { id: 'all', label: 'All' },
    { id: 'active', label: 'Active' },
    { id: 'idle', label: 'Idle' },
    { id: 'error', label: 'Error' },
  ];

  return (
    <div className="agent-panel-view">
      <div className="agent-panel-toolbar">
        <div className="agent-filter-bar">
          {filters.map(f => (
            <button
              key={f.id}
              className={`filter-pill ${filter === f.id ? 'active' : ''}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
              {f.id !== 'all' && (
                <span className="filter-count">
                  {agents.filter(a => a.status === f.id).length}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="agent-search-box">
          <FiSearch size={14} />
          <input
            type="text"
            placeholder="Search agents..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>
      <div className="agents-grid-view">
        {filtered.map((agent) => (
          <div
            key={agent.id}
            className={`agent-card-large status-${agent.status}`}
            onClick={() => onSelectAgent(agent)}
          >
            <div className="agent-card-large-header">
              <span className="agent-icon-large">{agent.icon}</span>
              <span className={`status-badge ${agent.status}`}>{agent.status}</span>
            </div>
            <h3>{agent.name}</h3>
            <p className="agent-desc">{agent.description}</p>
            <div className="agent-card-stats">
              <div className="stat">
                <span className="stat-value">{agent.tasksCompleted}</span>
                <span className="stat-label">Tasks Done</span>
              </div>
              <div className="stat">
                <span className="stat-value">{agent.avgResponseTime}</span>
                <span className="stat-label">Avg Time</span>
              </div>
              <div className="stat">
                <span className="stat-value">{agent.successRate}</span>
                <span className="stat-label">Success</span>
              </div>
            </div>
            <div className="agent-capabilities">
              {agent.capabilities.map((cap, i) => (
                <span key={i} className="capability-tag">{cap}</span>
              ))}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="agent-empty-state">No agents match your search.</div>
        )}
      </div>
    </div>
  );
}
