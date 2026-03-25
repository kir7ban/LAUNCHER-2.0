import React from 'react';
import { useAgentContext } from '../context/AgentContext';
import '../styles/Sidebar.css';

export default function Sidebar({ collapsed, onToggle, activeView, onViewChange }) {
  const { conversations, activeConversation, setActiveConversation } = useAgentContext();

  const navItems = [
    { id: 'dashboard', icon: '🏠', label: 'Dashboard' },
    { id: 'chat', icon: '💬', label: 'Chat' },
    { id: 'agents', icon: '🤖', label: 'Agents' },
    { id: 'workflows', icon: '🔗', label: 'Workflows' },
  ];

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="logo" onClick={onToggle}>
          <span className="logo-icon">🎯</span>
          {!collapsed && <span className="logo-text">RBIN BDO Genie</span>}
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${activeView === item.id ? 'active' : ''}`}
            onClick={() => onViewChange(item.id)}
            title={item.label}
          >
            <span className="nav-icon">{item.icon}</span>
            {!collapsed && <span className="nav-label">{item.label}</span>}
          </button>
        ))}
      </nav>

      {!collapsed && (
        <div className="conversation-list">
          <div className="conv-list-header">
            <span>Recent Conversations</span>
            <button className="btn-icon" title="New chat">+</button>
          </div>
          {conversations.map((conv) => (
            <div
              key={conv.id}
              className={`conversation-item ${activeConversation === conv.id ? 'active' : ''}`}
              onClick={() => { setActiveConversation(conv.id); onViewChange('chat'); }}
            >
              <div className="conv-title">{conv.title}</div>
              <div className="conv-meta">{conv.timestamp}</div>
            </div>
          ))}
        </div>
      )}

      <div className="sidebar-footer">
        <button className="nav-item" title="Settings">
          <span className="nav-icon">⚙️</span>
          {!collapsed && <span className="nav-label">Settings</span>}
        </button>
      </div>
    </aside>
  );
}
