import React, { useState } from 'react';
import { FiSearch } from 'react-icons/fi';
import { useAgentContext } from '../context/AgentContext';
import '../styles/AgentPanel.css';

export default function AgentPanel({ onSelectAgent }) {
  const { agents } = useAgentContext();
  const [search, setSearch] = useState('');

  const filtered = agents.filter(a => {
    if (search) {
      const q = search.toLowerCase();
      return a.name.toLowerCase().includes(q) || a.capabilities.some(c => c.toLowerCase().includes(q));
    }
    return true;
  });

  return (
    <div className="agent-panel-view">
      <div className="agent-panel-toolbar">
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
            </div>
            <h3>{agent.name}</h3>
            <p className="agent-desc">{agent.description}</p>
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
