import React from 'react';
import { FiCpu, FiMessageSquare, FiGitMerge } from 'react-icons/fi';
import '../styles/SearchDropdown.css';

export default function SearchDropdown({ query, agents, conversations, workflows, onSelect, onClose, activeIndex }) {
  if (!query.trim()) return null;
  const q = query.toLowerCase();

  const matchedAgents = agents.filter(a =>
    a.name.toLowerCase().includes(q) || a.capabilities.some(c => c.toLowerCase().includes(q))
  ).slice(0, 3);

  const matchedConversations = conversations.filter(c =>
    c.title.toLowerCase().includes(q)
  ).slice(0, 3);

  const matchedWorkflows = workflows.filter(w =>
    w.name.toLowerCase().includes(q)
  ).slice(0, 3);

  const hasResults = matchedAgents.length || matchedConversations.length || matchedWorkflows.length;

  // Build flat list of all results for keyboard navigation
  const allResults = [
    ...matchedAgents.map(a => ({ type: 'agents', item: a })),
    ...matchedConversations.map(c => ({ type: 'chat', item: c })),
    ...matchedWorkflows.map(w => ({ type: 'workflows', item: w })),
  ];

  let flatIndex = 0;

  return (
    <div className="search-dropdown" role="listbox">
      {!hasResults && <div className="search-empty">No results for "{query}"</div>}

      {matchedAgents.length > 0 && (
        <div className="search-section">
          <div className="search-section-title"><FiCpu size={12} /> Agents</div>
          {matchedAgents.map(a => {
            const idx = flatIndex++;
            return (
              <button
                key={a.id}
                className={`search-result-item ${activeIndex === idx ? 'active' : ''}`}
                onClick={() => onSelect('agents', a)}
                role="option"
                aria-selected={activeIndex === idx}
              >
                <span className="search-result-icon">{a.icon}</span>
                <span className="search-result-text">{a.name}</span>
                <span className={`status-badge ${a.status}`}>{a.status}</span>
              </button>
            );
          })}
        </div>
      )}

      {matchedConversations.length > 0 && (
        <div className="search-section">
          <div className="search-section-title"><FiMessageSquare size={12} /> Conversations</div>
          {matchedConversations.map(c => {
            const idx = flatIndex++;
            return (
              <button
                key={c.id}
                className={`search-result-item ${activeIndex === idx ? 'active' : ''}`}
                onClick={() => onSelect('chat', c)}
                role="option"
                aria-selected={activeIndex === idx}
              >
                <span className="search-result-text">{c.title}</span>
                <span className="search-result-meta">{c.timestamp}</span>
              </button>
            );
          })}
        </div>
      )}

      {matchedWorkflows.length > 0 && (
        <div className="search-section">
          <div className="search-section-title"><FiGitMerge size={12} /> Workflows</div>
          {matchedWorkflows.map(w => {
            const idx = flatIndex++;
            return (
              <button
                key={w.id}
                className={`search-result-item ${activeIndex === idx ? 'active' : ''}`}
                onClick={() => onSelect('workflows', w)}
                role="option"
                aria-selected={activeIndex === idx}
              >
                <span className="search-result-text">{w.name}</span>
                <span className={`status-badge ${w.status}`}>{w.status}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
