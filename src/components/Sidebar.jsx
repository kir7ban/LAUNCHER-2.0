import React from 'react';
import { FiHome, FiMessageSquare, FiCpu, FiGitMerge, FiSettings, FiPlus, FiTrash2 } from 'react-icons/fi';
import { useAgentContext } from '../context/AgentContext';
import '../styles/Sidebar.css';

export default function Sidebar({ collapsed, onToggle, activeView, onViewChange }) {
  const { conversations, activeConversation, setActiveConversation, setConversations, createConversation } = useAgentContext();

  const navItems = [
    { id: 'dashboard', icon: <FiHome size={18} />, label: 'Dashboard' },
    { id: 'chat', icon: <FiMessageSquare size={18} />, label: 'Chat' },
    { id: 'agents', icon: <FiCpu size={18} />, label: 'Agents' },
    { id: 'workflows', icon: <FiGitMerge size={18} />, label: 'Workflows' },
  ];

  const handleNewChat = () => {
    createConversation('New Conversation');
    onViewChange('chat');
  };

  const handleDeleteConv = (convId) => {
    setConversations(prev => prev.filter(c => c.id !== convId));
    if (activeConversation === convId && conversations.length > 1) {
      const remaining = conversations.filter(c => c.id !== convId);
      setActiveConversation(remaining[0]?.id);
    }
  };

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
            <button className="btn-icon" title="New chat" onClick={handleNewChat}>
              <FiPlus size={16} />
            </button>
          </div>
          {conversations.map((conv) => (
            <div
              key={conv.id}
              className={`conversation-item ${activeConversation === conv.id ? 'active' : ''}`}
              onClick={() => { setActiveConversation(conv.id); onViewChange('chat'); }}
            >
              <div className="conv-title">{conv.title}</div>
              <div className="conv-meta">{conv.timestamp}</div>
              <button
                className="conv-delete-btn"
                onClick={(e) => { e.stopPropagation(); handleDeleteConv(conv.id); }}
                title="Delete conversation"
              >
                <FiTrash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="sidebar-footer">
        <button className="nav-item" title="Settings">
          <span className="nav-icon"><FiSettings size={18} /></span>
          {!collapsed && <span className="nav-label">Settings</span>}
        </button>
      </div>
    </aside>
  );
}
