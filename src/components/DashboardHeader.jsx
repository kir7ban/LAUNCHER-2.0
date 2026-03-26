import React, { useState, useRef, useEffect } from 'react';
import { FiSearch, FiBell } from 'react-icons/fi';
import { useAgentContext } from '../context/AgentContext';
import SearchDropdown from './SearchDropdown';
import NotificationsDropdown from './NotificationsDropdown';
import '../styles/DashboardHeader.css';

export default function DashboardHeader({ activeView, onViewChange, onSelectAgent }) {
  const { agents, conversations, workflows, notifications, setActiveConversation } = useAgentContext();
  const activeCount = agents.filter(a => a.status === 'active').length;
  const unreadCount = notifications.filter(n => !n.read).length;

  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const searchRef = useRef(null);
  const notifRef = useRef(null);

  const titles = {
    dashboard: 'Dashboard',
    chat: 'Orchestrator Chat',
    agents: 'Agent Management',
    workflows: 'Workflow Orchestrations',
  };

  // Close on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowSearch(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotif(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') { setShowSearch(false); setShowNotif(false); }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
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
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => prev + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => Math.max(-1, prev - 1));
    }
  };

  return (
    <header className="dashboard-header">
      <div className="header-left">
        <h1 className="header-title">{titles[activeView] || 'Dashboard'}</h1>
        <div className="header-status">
          <span className="status-dot active" />
          <span>{activeCount} agents active</span>
        </div>
      </div>
      <div className="header-right">
        <div className="search-box" ref={searchRef}>
          <FiSearch size={14} className="search-icon-svg" />
          <input
            type="text"
            placeholder="Search agents, conversations..."
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setShowSearch(true); setActiveIndex(-1); }}
            onFocus={() => searchQuery && setShowSearch(true)}
            onKeyDown={handleSearchKeyDown}
          />
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
        <div className="notif-wrapper" ref={notifRef}>
          <button
            className="btn-icon notification-btn"
            title="Notifications"
            onClick={() => setShowNotif(!showNotif)}
          >
            <FiBell size={18} />
            {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
          </button>
          {showNotif && <NotificationsDropdown onClose={() => setShowNotif(false)} />}
        </div>
        <div className="user-avatar" title="User Profile">
          <span>U</span>
        </div>
      </div>
    </header>
  );
}
