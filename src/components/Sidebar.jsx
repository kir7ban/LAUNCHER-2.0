import React, { useState, useRef, useEffect } from 'react';
import { FiMessageSquare, FiCpu, FiGitMerge, FiSettings, FiPlus, FiTrash2, FiSun, FiMoon, FiSearch, FiMenu, FiChevronsLeft, FiChevronsRight, FiX } from 'react-icons/fi';
import { useAgentContext } from '../context/AgentContext';
import { useTheme } from '../context/ThemeContext';
import SearchDropdown from './SearchDropdown';
import '../styles/Sidebar.css';

export default function Sidebar({ collapsed, onToggle, activeView, onViewChange, onSelectAgent }) {
  const { conversations, activeConversation, setActiveConversation, setConversations, createConversation, agents, workflows } = useAgentContext();
  const { theme, toggleTheme } = useTheme();

  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [hoverExpanded, setHoverExpanded] = useState(false);
  const searchRef = useRef(null);
  const hoverTimerRef = useRef(null);

  const isExpanded = !collapsed || hoverExpanded;

  const handleMouseEnter = () => {
    if (!collapsed) return;
    hoverTimerRef.current = setTimeout(() => setHoverExpanded(true), 200);
  };

  const handleMouseLeave = () => {
    clearTimeout(hoverTimerRef.current);
    setHoverExpanded(false);
  };

  // Reset hover state when collapse state changes
  useEffect(() => {
    setHoverExpanded(false);
  }, [collapsed]);

  useEffect(() => {
    const handleClick = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowSearch(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSearchSelect = (view, item) => {
    setShowSearch(false);
    setSearchQuery('');
    setActiveIndex(-1);
    if (view === 'agents' && onSelectAgent) {
      onSelectAgent(item);
    } else if (view === 'chat') {
      setActiveConversation(item.id);
      onViewChange('chat');
    } else {
      onViewChange(view);
    }
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Escape') setShowSearch(false);
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(prev => prev + 1); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(prev => Math.max(-1, prev - 1)); }
  };

  const navItems = [
    { id: 'new-chat', icon: <FiPlus size={18} />, label: 'New Chat' },
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
    <>
      {/* Mobile hamburger button — visible only when sidebar is collapsed on mobile */}
      {collapsed && (
        <button
          className="sidebar-mobile-toggle visible"
          onClick={onToggle}
          aria-label="Open sidebar"
        >
          <FiMenu size={20} />
        </button>
      )}

      {/* Mobile overlay backdrop */}
      {!collapsed && (
        <div className="sidebar-overlay" onClick={onToggle} />
      )}

      <aside
        className={`sidebar ${collapsed ? 'collapsed' : ''} ${hoverExpanded ? 'hover-expanded' : ''}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Toggle row — always visible */}
        <div className="sidebar-toggle-row">
          {isExpanded && <span className="sidebar-toggle-label">Menu</span>}
          <button
            className="sidebar-toggle-btn"
            onClick={onToggle}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <FiChevronsRight size={16} /> : <FiChevronsLeft size={16} />}
          </button>
        </div>

        {isExpanded && (
          <div className="sidebar-search" ref={searchRef}>
            <div className="sidebar-search-box">
              <FiSearch size={14} className="sidebar-search-icon" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setShowSearch(true); setActiveIndex(-1); }}
                onFocus={() => searchQuery && setShowSearch(true)}
                onKeyDown={handleSearchKeyDown}
              />
            </div>
            {showSearch && (
              <SearchDropdown
                query={searchQuery}
                agents={agents}
                conversations={conversations}
                workflows={workflows}
                onSelect={handleSearchSelect}
                onClose={() => setShowSearch(false)}
                activeIndex={activeIndex}
              />
            )}
          </div>
        )}
        <nav className="sidebar-nav">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${activeView === (item.id === 'new-chat' ? 'chat' : item.id) ? 'active' : ''}`}
            onClick={() => item.id === 'new-chat' ? handleNewChat() : onViewChange(item.id)}
            title={item.label}
          >
            <span className="nav-icon">{item.icon}</span>
            {isExpanded && <span className="nav-label">{item.label}</span>}
          </button>
        ))}
      </nav>

      {isExpanded && (
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
        <button
          className="nav-item"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <span className="nav-icon">
            {theme === 'dark' ? <FiSun size={18} /> : <FiMoon size={18} />}
          </span>
          {isExpanded && <span className="nav-label">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
        </button>
        <button className="nav-item" title="Settings">
          <span className="nav-icon"><FiSettings size={18} /></span>
          {isExpanded && <span className="nav-label">Settings</span>}
        </button>
      </div>
    </aside>
    </>
  );
}
